"""distill.py 单元测试:YAML 机械蒸馏(内联 layout / UUID 截断 / 不变量)。"""
import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import distill  # noqa: E402

# 最小 YAML:一个可内联 layout + 一个全 UUID id
MINI_YAML = """metadata:
  size:
    width: 375
    height: 812
nodes:
  - id: a3b4c5d6-1111-2222-3333-444455556666
    type: FRAME
    name: "A"
    pos: null
    layout: layout_000001
globalVars:
  styles:
    layout_000001:
      locationRelativeToParent:
        x: 0
        y: 0
      dimensions:
        width: 375
        height: 812
_meta:
  coordinateSpace: parent-relative
  warnings: []
"""


class TestInline(unittest.TestCase):
    def test_inline_and_delete_definition(self):
        out, stats = distill.apply_text(MINI_YAML)
        self.assertIn("pos: {x: 0, y: 0, w: 375, h: 812}", out)
        # layout 定义块已删除,引用已被替换
        self.assertNotIn("layout_000001:", out)
        self.assertNotIn("layout: layout_000001", out)
        self.assertEqual(stats["layouts_inlined"], 1)
        self.assertEqual(stats["layouts_skipped"], [])
        self.assertGreater(stats["bytes_before"], stats["bytes_after"])

    def test_uuid_truncated(self):
        out, stats = distill.apply_text(MINI_YAML)
        self.assertIn("id: a3b4c5d6", out)
        self.assertNotIn("1111-2222-3333", out)
        self.assertEqual(stats["uuids"], 1)
        self.assertEqual(stats["uuids_kept_full"], 0)

    def test_distill_stamp(self):
        out, _ = distill.apply_text(MINI_YAML)
        self.assertIn("distilled: true", out)
        self.assertIn("distillVersion: %d" % distill.DISTILL_VERSION, out)

    def test_second_distill_rejected(self):
        out, _ = distill.apply_text(MINI_YAML)
        with self.assertRaises(distill.DistillError):
            distill.apply_text(out)

    def test_no_layout_raises(self):
        src = MINI_YAML.replace(
            "    layout_000001:\n"
            "      locationRelativeToParent:\n"
            "        x: 0\n"
            "        y: 0\n"
            "      dimensions:\n"
            "        width: 375\n"
            "        height: 812\n", "")
        src = src.replace("layout: layout_000001\n", "layout: null\n")
        with self.assertRaises(distill.DistillError):
            distill.apply_text(src)


class TestSkipped(unittest.TestCase):
    def test_unknown_key_skipped_not_inlined(self):
        """含未识别字段的 layout → 放弃内联(保真),引用与定义原样保留;可内联的照常内联。"""
        src = MINI_YAML.replace(
            "globalVars:",
            "  - id: bbbbcccc-1111-2222-3333-444455556666\n"
            "    type: RECTANGLE\n"
            "    name: B\n"
            "    pos: null\n"
            "    layout: layout_000002\n"
            "globalVars:")
        src = src.replace(
            "_meta:",
            "    layout_000002:\n"
            "      locationRelativeToParent:\n"
            "        x: 10\n"
            "        y: 10\n"
            "      dimensions:\n"
            "        width: 50\n"
            "        height: 50\n"
            "      customField: 1\n"
            "_meta:")
        out, stats = distill.apply_text(src)
        self.assertEqual(stats["layouts_inlined"], 1)
        self.assertEqual(stats["layouts_skipped"], ["layout_000002"])
        # 可内联的被替换,跳过的引用与定义保留
        self.assertIn("pos: {x: 0, y: 0, w: 375, h: 812}", out)
        self.assertNotIn("layout: layout_000001", out)
        self.assertIn("layout: layout_000002", out)
        self.assertIn("layout_000002:", out)

    def test_legacy_space_warning(self):
        """无 parent-relative 标记的输入 → 打 legacy 警示,pos 保留原语义。"""
        src = MINI_YAML.replace("  coordinateSpace: parent-relative\n", "")
        out, stats = distill.apply_text(src)
        self.assertTrue(stats["legacy_coordinate_space"])
        self.assertIn("distillWarnings", out)
        self.assertIn("v0.5 历史文件", out)


class TestInvariants(unittest.TestCase):
    def test_node_count_preserved(self):
        out, _ = distill.apply_text(MINI_YAML)
        self.assertEqual(
            distill._count(r"^\s*- id: ", MINI_YAML),
            distill._count(r"^\s*- id: ", out))

    def test_text_fields_preserved(self):
        src = MINI_YAML.replace('name: "A"', 'name: "Hello World"')
        out, _ = distill.apply_text(src)
        self.assertIn("Hello World", out)

    def test_dangling_ref_detected(self):
        """引用 layout 但定义未内联且已删 → 残留引用不变量应抛错。"""
        # 构造:引用 layout_000002,但表里只有 layout_000001(可内联) → 删除后悬空
        src = MINI_YAML.replace("layout: layout_000001", "layout: layout_000002")
        with self.assertRaises(distill.DistillError):
            distill.apply_text(src)


class TestUuidAmbiguity(unittest.TestCase):
    def test_numeric_prefix_kept_full(self):
        """前 8 位会被 YAML 读成数字(如八进制形)→ 保留全 UUID。"""
        src = MINI_YAML.replace(
            "a3b4c5d6-1111-2222-3333-444455556666",
            "03450216-1111-2222-3333-444455556666")
        out, stats = distill.apply_text(src)
        self.assertEqual(stats["uuids"], 0)
        self.assertEqual(stats["uuids_kept_full"], 1)
        self.assertIn("03450216-1111-2222-3333-444455556666", out)

    def test_short_collision_aborts(self):
        """两个 UUID 前 8 位相同 → 放弃蒸馏。"""
        src = MINI_YAML.replace(
            "a3b4c5d6-1111-2222-3333-444455556666",
            "deadbeef-1111-2222-3333-444455556666") + \
            "  - id: deadbeef-aaaa-bbbb-cccc-ddddeeeeffff\n" \
            "    type: TEXT\n    name: B\n    pos: null\n    layout: null\n"
        with self.assertRaises(distill.DistillError):
            distill.apply_text(src)


if __name__ == "__main__":
    unittest.main()
