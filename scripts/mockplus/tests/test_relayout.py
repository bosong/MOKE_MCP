"""relayout.py 单元测试:包含树重建 + 相对坐标改写。"""
import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import relayout  # noqa: E402


def _mk_result(styles, nodes, size=(1000, 1000), meta=None):
    return {
        "metadata": {"size": {"width": size[0], "height": size[1]}},
        "nodes": nodes,
        "globalVars": {"styles": styles},
        "_meta": meta or {},
    }


def _style(x, y, w, h):
    return {
        "locationRelativeToParent": {"x": x, "y": y},
        "dimensions": {"width": w, "height": h},
    }


class TestGeometry(unittest.TestCase):
    def test_contains(self):
        self.assertTrue(relayout._contains((0, 0, 100, 100), (10, 10, 20, 20), 1.0))
        self.assertFalse(relayout._contains((0, 0, 100, 100), (90, 90, 50, 50), 1.0))

    def test_eqb(self):
        self.assertTrue(relayout._eqb((1.0, 2.0, 3.0, 4.0), (1, 2, 3, 4), 0.5))
        self.assertFalse(relayout._eqb((1.0, 2.0, 3.0, 4.0), (1, 2, 3, 5), 0.5))

    def test_norm(self):
        self.assertEqual(relayout._norm(16.0), 16)
        self.assertEqual(relayout._norm(16.5), 16.5)


class TestRelayout(unittest.TestCase):
    def test_reparent_into_container(self):
        """内容物在前、容器在后(z 方向合法) → 重挂为子节点 + 相对坐标改写。"""
        styles = {
            "layout_000001": _style(100, 100, 200, 200),   # 容器 A(sib=0)
            "layout_000002": _style(110, 110, 50, 50),     # 内容物 a(sib=1)
            "layout_000003": _style(400, 400, 200, 200),   # 容器 B(sib=2)
            "layout_000004": _style(410, 410, 50, 50),     # 内容物 b(sib=3)
        }
        nodes = [
            {"id": "a", "type": "RECTANGLE", "layout": "layout_000002"},
            {"id": "A", "type": "FRAME", "layout": "layout_000001", "children": []},
            {"id": "b", "type": "RECTANGLE", "layout": "layout_000004"},
            {"id": "B", "type": "FRAME", "layout": "layout_000003", "children": []},
        ]
        out = relayout.apply(_mk_result(styles, nodes))
        meta = out["_meta"]
        # 无回退/异常告警(z 证据 2:0 合法)
        self.assertFalse(any("回退" in w or "异常" in w for w in meta.get("warnings", [])))
        self.assertEqual(meta["relayout"]["reparented"], 2)
        self.assertEqual(meta["relayout"]["zFilter"], "on")
        self.assertEqual(meta["coordinateSpace"], "parent-relative")
        # 顶层只剩两个容器,内容物成其子
        self.assertEqual([n["id"] for n in out["nodes"]], ["A", "B"])
        self.assertEqual([n["id"] for n in out["nodes"][0]["children"]], ["a"])
        self.assertEqual([n["id"] for n in out["nodes"][1]["children"]], ["b"])
        # 容器落盘绝对坐标,内容物写相对坐标
        self.assertEqual(out["nodes"][0]["absolutePosition"], {"x": 100, "y": 100})
        child = out["nodes"][0]["children"][0]
        cspec = out["globalVars"]["styles"][child["layout"]]
        self.assertEqual(cspec["locationRelativeToParent"], {"x": 10, "y": 10})

    def test_idempotent(self):
        """已是 parent-relative → 二次 apply 原样返回。"""
        styles = {"layout_000002": _style(100, 100, 200, 200),
                  "layout_000003": _style(110, 110, 50, 50)}
        nodes = [
            {"id": "a", "type": "FRAME", "layout": "layout_000002", "children": []},
            {"id": "b", "type": "RECTANGLE", "layout": "layout_000003"},
        ]
        once = relayout.apply(_mk_result(styles, nodes))
        twice = relayout.apply(once)
        self.assertEqual(once["nodes"], twice["nodes"])
        self.assertEqual(once["globalVars"], twice["globalVars"])

    def test_fail_fast_no_size(self):
        """metadata.size 缺失 → 回退原样 + 告警,不抛异常。"""
        result = {
            "metadata": {},
            "nodes": [{"id": "a", "type": "FRAME", "layout": "layout_000001"}],
            "globalVars": {"styles": {}},
            "_meta": {},
        }
        out = relayout.apply(result)
        self.assertEqual(out["nodes"], result["nodes"])
        self.assertTrue(any("size" in w for w in out["_meta"]["warnings"]))

    def test_z_evidence_off_fallback_keeps_siblings(self):
        """z 方向证据不足时禁用 z 过滤,容器在前的包含仍可重挂。"""
        styles = {
            "layout_000001": _style(100, 100, 200, 200),  # 容器在前(sib=0)
            "layout_000002": _style(110, 110, 50, 50),    # 内容物在后(sib=1)
        }
        nodes = [
            {"id": "c", "type": "FRAME", "layout": "layout_000001", "children": []},
            {"id": "d", "type": "RECTANGLE", "layout": "layout_000002"},
        ]
        out = relayout.apply(_mk_result(styles, nodes))
        meta = out["_meta"]
        # 全页仅一对包含且方向为"容器在前" → z 证据 0:1,禁用 z 过滤
        self.assertEqual(meta["relayout"]["zFilter"], "off")
        self.assertEqual(meta["relayout"]["reparented"], 1)
        self.assertEqual([n["id"] for n in out["nodes"]], ["c"])


class TestFrozenAndSlab(unittest.TestCase):
    def test_full_canvas_background_stays_root_sibling(self):
        """双轴 ≥95% 画布 → 整页背景,保持根层兄弟(不收养)。"""
        styles = {
            "layout_000001": _style(0, 0, 1000, 1000),   # 整页背景(sib=0)
            "layout_000002": _style(100, 100, 200, 200), # 真实容器(sib=1)
            "layout_000003": _style(110, 110, 50, 50),   # 内容物(sib=2)
        }
        nodes = [
            {"id": "bg", "type": "RECTANGLE", "layout": "layout_000001"},
            {"id": "c", "type": "FRAME", "layout": "layout_000002", "children": []},
            {"id": "d", "type": "RECTANGLE", "layout": "layout_000003"},
        ]
        out = relayout.apply(_mk_result(styles, nodes))
        self.assertEqual([n["id"] for n in out["nodes"]], ["bg", "c"])

    def test_frozen_slice_not_reparented(self):
        """SLICE 冻结:不参与重挂,仍留在根层。"""
        styles = {
            "layout_000001": _style(100, 100, 200, 200),
            "layout_000002": _style(110, 110, 50, 50),
        }
        nodes = [
            {"id": "c", "type": "FRAME", "layout": "layout_000001", "children": []},
            {"id": "s", "type": "SLICE", "layout": "layout_000002"},
        ]
        out = relayout.apply(_mk_result(styles, nodes))
        self.assertEqual([n["id"] for n in out["nodes"]], ["c", "s"])


if __name__ == "__main__":
    unittest.main()
