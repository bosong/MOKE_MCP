"""client.py 单元测试:URL 解析 / slice manifest / cookie 状态 / 缓存回退。"""
import json
import os
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import client  # noqa: E402


class TestParseUrl(unittest.TestCase):
    def test_full_url_with_target(self):
        self.assertEqual(
            client.parse_url_or_short(
                "https://app.mockplus.cn/app/yd2hUtESwQ5/develop/design/ltRDYTciO6"),
            ("yd2hUtESwQ5", "ltRDYTciO6"))

    def test_design_url_no_target(self):
        """`/app/{APP}/design` 尾段是路径,不应误判为 target(回归:曾返回 'design')。"""
        self.assertEqual(
            client.parse_url_or_short("https://app.mockplus.cn/app/yd2hUtESwQ5/design"),
            ("yd2hUtESwQ5", None))

    def test_develop_path_no_target(self):
        self.assertEqual(
            client.parse_url_or_short("https://app.mockplus.cn/app/yd2hUtESwQ5/develop/design"),
            ("yd2hUtESwQ5", None))

    def test_short_form(self):
        self.assertEqual(client.parse_url_or_short("app1:page1"), ("app1", "page1"))
        self.assertEqual(client.parse_url_or_short("app1:"), ("app1", None))
        self.assertEqual(client.parse_url_or_short("app1"), ("app1", None))

    def test_bad_url(self):
        with self.assertRaises(ValueError):
            client.parse_url_or_short("https://example.com/x/y")


class TestSliceManifest(unittest.TestCase):
    def test_url_hash(self):
        u = "https://img02.mockplus.cn/idoc/sketch/wbyrvwvvlh/icon.png"
        self.assertEqual(client.url_hash(u), "wbyrvwvvlh")
        self.assertIsNone(client.url_hash(None))

    def test_bitmap_str(self):
        self.assertEqual(
            client._slice_bitmap_url({"bitmapURL": "https://img02.mockplus.cn/x/y.png"}),
            "https://img02.mockplus.cn/x/y.png")

    def test_bitmap_dict_best_scale(self):
        """dict 形态选最大倍率 URL。"""
        s = {"bitmapURL": {
            "1": {"url": "https://img01.mockplus.cn/idoc/sketch/abc/img.png"},
            "2": {"url": "https://img01.mockplus.cn/idoc/sketch/abc/img@2x.png"},
        }}
        self.assertEqual(
            client._slice_bitmap_url(s),
            "https://img01.mockplus.cn/idoc/sketch/abc/img@2x.png")

    def test_bitmap_empty(self):
        self.assertIsNone(client._slice_bitmap_url({}))
        self.assertIsNone(client._slice_bitmap_url({"bitmapURL": ""}))

    def test_extract_slices_dedup_and_filter(self):
        data = {"layers": {"children": [
            {"basic": {"name": "a", "sourceID": "src-1"},
             "bounds": {"width": 100, "height": 50},
             "slice": {"bitmapURL": "https://img02.mockplus.cn/idoc/sketch/abc123/a.png"}},
            {"basic": {"name": "b", "sourceID": "src-2"},
             "slice": {"bitmapURL": {"2": {"url": "https://img01.mockplus.cn/idoc/sketch/xyz789/b@2x.png"}}}},
            {"basic": {"name": "a-dup", "sourceID": "src-3"},
             "slice": {"bitmapURL": "https://img02.mockplus.cn/idoc/sketch/abc123/a-dup.png"}},
            {"basic": {"name": "no-slice"}},
        ]}}
        all_slices = client.extract_slices(data)
        self.assertEqual([s["hash"] for s in all_slices], ["abc123", "xyz789"])
        self.assertEqual(all_slices[0]["width"], 100)
        wanted = client.extract_slices(data, wanted={"xyz789"})
        self.assertEqual([s["hash"] for s in wanted], ["xyz789"])


class TestCookieStatus(unittest.TestCase):
    def test_missing_cookie(self):
        with tempfile.TemporaryDirectory() as td:
            fp = Path(td) / "cookie"
            with mock.patch.dict(os.environ, {"MOCKPLUS_COOKIE_FILE": str(fp)}):
                st = client.cookie_status()
                self.assertFalse(st["exists"])
                self.assertEqual(st["path"], str(fp))

    def test_cookie_with_dates(self):
        with tempfile.TemporaryDirectory() as td:
            fp = Path(td) / "cookie"
            now = int(time.time())
            fp.write_text(
                f"# set_at: {now}\n"
                f"# expires_at: {now + 30 * 86400}\n"
                "abc=123;\n")
            with mock.patch.dict(os.environ, {"MOCKPLUS_COOKIE_FILE": str(fp)}):
                st = client.cookie_status()
                self.assertTrue(st["exists"])
                self.assertEqual(st["set_at"], now)
                self.assertEqual(st["days_left"], 30)


class TestStaleFallback(unittest.TestCase):
    def test_fetch_index_cached_hit(self):
        """24h 内缓存命中直接返回,不触网。"""
        with tempfile.TemporaryDirectory() as td:
            idx = {"code": 0, "payload": {"pages": []}}
            app = "app-cache-1"
            cache_dir = Path(td) / app
            cache_dir.mkdir(parents=True)
            (cache_dir / "_index.json").write_text(json.dumps(idx))
            with mock.patch.dict(os.environ, {"MOCKPLUS_CACHE_DIR": td}):
                got = client.fetch_index(app)
                self.assertEqual(got, idx)

    def test_fetch_index_stale_fallback_on_network_fail(self):
        """网络失败 + 缓存 3 天前(>TTL,<7 天上限)→ 回退过期缓存。"""
        with tempfile.TemporaryDirectory() as td:
            idx = {"code": 0, "payload": {"pages": [{"_id": "p1", "name": "P", "dataURL": "x"}]}}
            app = "app-stale-1"
            cache_dir = Path(td) / app
            cache_dir.mkdir(parents=True)
            fp = cache_dir / "_index.json"
            fp.write_text(json.dumps(idx))
            old = time.time() - 3 * 86400
            os.utime(fp, (old, old))
            with mock.patch.dict(os.environ, {"MOCKPLUS_CACHE_DIR": td}):
                with mock.patch.object(client, "_get", side_effect=OSError("offline")):
                    got = client.fetch_index(app)
                    self.assertEqual(got, idx)

    def test_flatten_pages(self):
        index = {"payload": {"pages": [
            {"_id": "g1", "name": "Group", "isGroup": True,
             "children": [{"_id": "p1", "name": "Page", "dataURL": "https://cdn/x",
                           "size": {"width": 375}}]},
        ]}}
        pages, groups = client.flatten_pages(index)
        self.assertEqual([p["id"] for p in pages], ["p1"])
        self.assertEqual(pages[0]["path"], "Group / Page")
        self.assertEqual([g["id"] for g in groups], ["g1"])


if __name__ == "__main__":
    unittest.main()
