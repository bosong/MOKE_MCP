"""test_transform.py - transform.py 单元测试(纯函数 + extract_node + 全链路)。"""
import json
import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import transform  # noqa: E402

FIXTURES = Path(__file__).resolve().parent / "fixtures"


def run_transform(data: dict, coords: str = "relative") -> dict:
    page_meta = {"name": "t", "path": "t", "id": "t-page", "device": "ios1x"}
    return transform.transform(data, page_meta, "t-app", coords=coords)


class TestColor(unittest.TestCase):
    def test_rgba_to_str_alpha1(self):
        self.assertEqual(transform.rgba_to_str({"r": 255, "g": 0, "b": 128, "a": 1}), "#FF0080")

    def test_rgba_to_str_alpha_lt1(self):
        self.assertEqual(transform.rgba_to_str({"r": 0, "g": 0, "b": 0, "a": 0.3}), "rgba(0, 0, 0, 0.30)")

    def test_rgba_to_str_none(self):
        self.assertIsNone(transform.rgba_to_str(None))

    def test_normalize_bg_8hex(self):
        self.assertEqual(transform.normalize_bg("#f5f5f5ff"), "#F5F5F5")

    def test_normalize_bg_8hex_alpha(self):
        self.assertEqual(transform.normalize_bg("#f5f5f580"), "rgba(245, 245, 245, 0.50)")

    def test_normalize_bg_dict(self):
        self.assertEqual(transform.normalize_bg({"r": 1, "g": 2, "b": 3, "a": 1}), "#010203")


class TestNumbers(unittest.TestCase):
    def test_round_num_int(self):
        self.assertEqual(transform.round_num(16.0), 16)

    def test_round_num_half(self):
        self.assertEqual(transform.round_num(16.25), 16.5)

    def test_round_num_none(self):
        self.assertIsNone(transform.round_num(None))

    def test_border_radius_uniform(self):
        self.assertEqual(transform._border_radius_str([8, 8, 8, 8]), "8px")

    def test_border_radius_mixed(self):
        self.assertEqual(transform._border_radius_str([8, 0, 8, 0]), "8px 0 8px 0")

    def test_border_radius_zero(self):
        self.assertIsNone(transform._border_radius_str([0, 0, 0, 0]))

    def test_stable_id_deterministic(self):
        a = transform.stable_id("x", {"left": 1, "top": 2}, ["p"])
        b = transform.stable_id("x", {"left": 1, "top": 2}, ["p"])
        self.assertEqual(a, b)
        c = transform.stable_id("x", {"left": 9, "top": 2}, ["p"])
        self.assertNotEqual(a, c)


class TestTypeMapping(unittest.TestCase):
    def test_sketch_real_type(self):
        self.assertEqual(transform._v5_type("Text"), "TEXT")
        self.assertEqual(transform._v5_type("SymbolInstance"), "INSTANCE")
        self.assertEqual(transform._v5_type("mask"), "MASK")

    def test_lower_type_fallback(self):
        self.assertEqual(transform._v5_type("", "text"), "TEXT")
        self.assertEqual(transform._v5_type("", "rect"), "RECTANGLE")
        self.assertEqual(transform._v5_type("", "line"), "LINE")
        self.assertEqual(transform._v5_type("", "group"), "FRAME")
        self.assertEqual(transform._v5_type("", "shape"), "VECTOR")
        self.assertEqual(transform._v5_type("", "slice"), "SLICE")

    def test_preview_real_type(self):
        self.assertEqual(transform._v5_type("shapeLayer", "shape"), "VECTOR")
        self.assertEqual(transform._v5_type("layerSection", "group"), "FRAME")
        self.assertEqual(transform._v5_type("textLayer", "text"), "TEXT")

    def test_unknown_type(self):
        self.assertEqual(transform._v5_type("WeirdWidget"), "_UNKNOWN_WEIRDWIDGET")
        self.assertEqual(transform._v5_type("", ""), "_UNKNOWN_")


class TestWeightAndSlice(unittest.TestCase):
    def test_weight_w6(self):
        self.assertEqual(transform._normalize_weight("W6"), 600)

    def test_weight_semibold(self):
        self.assertEqual(transform._normalize_weight("Semibold"), 600)

    def test_weight_int(self):
        self.assertEqual(transform._normalize_weight(700), 700)

    def test_slice_bitmap_str(self):
        self.assertEqual(
            transform._slice_bitmap_url({"bitmapURL": "https://img02.mockplus.cn/idoc/sketch/h/x.png"}),
            "https://img02.mockplus.cn/idoc/sketch/h/x.png")

    def test_slice_bitmap_dict(self):
        u = {"1": {"url": "https://img02.mockplus.cn/x/1.png"},
             "3": {"url": "https://img02.mockplus.cn/x/3.png"}}
        self.assertEqual(transform._slice_bitmap_url({"bitmapURL": u}),
                         "https://img02.mockplus.cn/x/3.png")

    def test_slice_bitmap_none(self):
        self.assertIsNone(transform._slice_bitmap_url({}))


class TestTokenTable(unittest.TestCase):
    def setUp(self):
        self.bank = transform.TokenTable()

    def test_seq_dedup(self):
        k1 = self.bank.fill_solid({"value": {"r": 255, "g": 0, "b": 0, "a": 1}})
        k2 = self.bank.fill_solid({"value": {"r": 255, "g": 0, "b": 0, "a": 1}})
        self.assertEqual(k1, k2)
        self.assertEqual(k1, "fill_000001")

    def test_named_preferred(self):
        k1 = self.bank.text_style({"font": {"size": 16}, "align": "left"}, preferred_name="Body")
        self.assertEqual(k1, "Body")

    def test_named_same_spec_reuse(self):
        st = {"font": {"size": 16, "weight": "W6"}, "align": "left"}
        k1 = self.bank.text_style(st, preferred_name="Body")
        k2 = self.bank.text_style(st, preferred_name="Body")
        self.assertEqual(k1, k2)
        self.assertEqual(k1, "Body")

    def test_named_diff_spec_suffix(self):
        k1 = self.bank.text_style({"font": {"size": 16}}, preferred_name="Body")
        k2 = self.bank.text_style({"font": {"size": 18}}, preferred_name="Body")
        self.assertEqual(k1, "Body")
        self.assertEqual(k2, "Body_2")

    def test_gradient_linear_spec(self):
        k = self.bank.fill_gradient_linear({
            "fromX": 0, "fromY": 0, "toX": 1, "toY": 0,
            "colorStops": [{"position": 0, "color": {"r": 255, "g": 0, "b": 0, "a": 1}},
                           {"position": 1, "color": {"r": 0, "g": 0, "b": 255, "a": 1}}]})
        spec = self.bank.styles[k]
        self.assertEqual(spec[0]["type"], "GRADIENT_LINEAR")
        self.assertIn("linear-gradient", spec[0]["gradient"])
        # from (0,0) → to (1,0):角度 90deg
        self.assertIn("90deg", spec[0]["gradient"])


class TestExtractNode(unittest.TestCase):
    def _ctx(self):
        return transform.TransformContext()

    def test_text_node_full(self):
        node = {
            "basic": {"sourceID": "t1", "name": "标题", "realType": "Text", "opacity": 1},
            "bounds": {"left": 0, "top": 0, "width": 100, "height": 30},
            "text": {"styles": [{
                "font": {"family": "PingFang SC", "weight": "W6",
                         "color": {"type": "normal", "value": {"r": 51, "g": 51, "b": 51, "a": 1}},
                         "size": 16},
                "align": "left",
                "space": {"lineHeight": 22, "letterSpacing": 1},
                "fontStyles": {"italic": True, "underLine": False, "lineThrough": False},
                "value": "你好"}]},
        }
        out = transform.extract_node(node, self._ctx(), [])
        self.assertEqual(out["type"], "TEXT")
        self.assertEqual(out["text"], "你好")
        self.assertEqual(out["textStyle"].startswith("textStyle_"), True)

    def test_text_weight_normalized(self):
        ctx = self._ctx()
        node = {
            "basic": {"sourceID": "t2", "name": "字", "realType": "Text", "opacity": 1},
            "bounds": {"left": 0, "top": 0, "width": 10, "height": 10},
            "text": {"styles": [{
                "font": {"family": "PingFang SC", "weight": "W6",
                         "color": {"type": "normal", "value": {"r": 0, "g": 0, "b": 0, "a": 1}},
                         "size": 14},
                "align": "left", "space": {}, "fontStyles": {"italic": True}, "value": "x"}]},
        }
        out = transform.extract_node(node, ctx, [])
        spec = ctx.bank.styles[out["textStyle"]]
        self.assertEqual(spec["fontWeight"], 600)
        self.assertEqual(spec["fontStyle"], "italic")

    def test_multi_fill_array(self):
        ctx = self._ctx()
        node = {
            "basic": {"sourceID": "mf", "name": "多填充", "realType": "Rectangle", "opacity": 1},
            "bounds": {"left": 0, "top": 0, "width": 10, "height": 10},
            "fill": {"colors": [
                {"type": "normal", "value": {"r": 255, "g": 255, "b": 255, "a": 1}},
                {"type": "linearGradient", "value": {
                    "fromX": 0, "fromY": 0, "toX": 1, "toY": 0,
                    "colorStops": [{"position": 0, "color": {"r": 0, "g": 0, "b": 0, "a": 1}},
                                   {"position": 1, "color": {"r": 255, "g": 255, "b": 255, "a": 1}}]}}]},
        }
        out = transform.extract_node(node, ctx, [])
        self.assertIsInstance(out["fills"], list)
        self.assertEqual(len(out["fills"]), 2)

    def test_multi_stroke_and_dash_inner(self):
        ctx = self._ctx()
        node = {
            "basic": {"sourceID": "ms", "name": "多描边", "realType": "Rectangle", "opacity": 1},
            "bounds": {"left": 0, "top": 0, "width": 10, "height": 10},
            "stroke": {"radius": [4, 4, 4, 4], "borders": [
                {"type": "center", "strokeWidth": 1,
                 "color": {"type": "normal", "value": {"r": 1, "g": 2, "b": 3, "a": 1}},
                 "dash": [4, 2], "offset": 0},
                {"type": "inside", "strokeWidth": 2,
                 "color": {"type": "normal", "value": {"r": 4, "g": 5, "b": 6, "a": 1}},
                 "dash": [], "offset": 0}]},
        }
        out = transform.extract_node(node, ctx, [])
        self.assertIsInstance(out["strokes"], list)
        self.assertEqual(len(out["strokes"]), 2)
        self.assertEqual(out["borderRadius"], "4px")
        # dash 从 border 内提取
        spec = ctx.bank.styles[out["strokes"][0]]
        self.assertEqual(spec.get("dash"), [4, 2])

    def test_multi_effect(self):
        ctx = self._ctx()
        node = {
            "basic": {"sourceID": "me", "name": "多阴影", "realType": "Rectangle", "opacity": 1},
            "bounds": {"left": 0, "top": 0, "width": 10, "height": 10},
            "effect": {"shadows": [
                {"offsetX": 0, "offsetY": 2, "blur": 4,
                 "color": {"type": "normal", "value": {"r": 0, "g": 0, "b": 0, "a": 0.3}},
                 "spread": 0, "type": "outside"},
                {"offsetX": 0, "offsetY": 0, "blur": 8,
                 "color": {"type": "normal", "value": {"r": 0, "g": 0, "b": 0, "a": 0.1}},
                 "spread": 0, "type": "inside"}]},
        }
        out = transform.extract_node(node, ctx, [])
        self.assertIsInstance(out["effects"], list)
        self.assertEqual(len(out["effects"]), 2)

    def test_multi_text_segments(self):
        ctx = self._ctx()
        node = {
            "basic": {"sourceID": "mt", "name": "多段", "realType": "Text", "opacity": 1},
            "bounds": {"left": 0, "top": 0, "width": 10, "height": 10},
            "text": {"styles": [
                {"font": {"size": 14, "weight": "Regular", "color": {"value": {"r": 0, "g": 0, "b": 0, "a": 1}}},
                 "align": "left", "space": {}, "fontStyles": {}, "value": "a"},
                {"font": {"size": 12, "weight": "Regular", "color": {"value": {"r": 0, "g": 0, "b": 0, "a": 1}}},
                 "align": "left", "space": {}, "fontStyles": {}, "value": "b"}]},
        }
        out = transform.extract_node(node, ctx, [])
        self.assertEqual(out.get("textSegments"), 2)

    def test_unknown_type_aggregated(self):
        ctx = self._ctx()
        node = {
            "basic": {"sourceID": "uw", "name": "未知", "realType": "WeirdWidget", "opacity": 1},
            "bounds": {"left": 0, "top": 0, "width": 10, "height": 10},
        }
        out = transform.extract_node(node, ctx, [])
        self.assertEqual(out["type"], "_UNKNOWN_WEIRDWIDGET")
        self.assertEqual(ctx.unknown_types, {"_UNKNOWN_WEIRDWIDGET": 1})

    def test_id_fallback_uuid_prefix(self):
        ctx = self._ctx()
        node = {
            "basic": {"id": "a1b2c3d4-9999-4777-8999-000011112222", "type": "rect",
                      "name": "小写矩形", "opacity": 1},
            "bounds": {"left": 0, "top": 0, "width": 10, "height": 10},
        }
        out = transform.extract_node(node, ctx, [])
        self.assertEqual(out["id"], "a1b2c3d4")

    def test_slice_bitmap_dict_fill(self):
        ctx = self._ctx()
        node = {
            "basic": {"id": "s1", "type": "slice", "name": "切图", "opacity": 1},
            "bounds": {"left": 0, "top": 0, "width": 10, "height": 10},
            "slice": {"bitmapURL": {"1": {"url": "https://img02.mockplus.cn/idoc/sketch/shh/x.png"}}},
        }
        out = transform.extract_node(node, ctx, [])
        spec = ctx.bank.styles[out["fills"]][0]
        self.assertEqual(spec["type"], "IMAGE")
        self.assertEqual(spec["imageRef"], "shh")


class TestFullTransform(unittest.TestCase):
    def test_real_doctor_home_healthy(self):
        data = json.loads((FIXTURES / "real-doctor-home.json").read_text())
        result = run_transform(data)
        meta = result["_meta"]
        self.assertEqual(meta["coordinateSpace"], "parent-relative")
        self.assertEqual(meta["stats"]["errors"], 0)
        self.assertFalse(meta.get("unknownTypes"))
        # 类型全部被识别(无 _UNKNOWN)
        types = set()
        def walk(n):
            types.add(n["type"])
            for c in n.get("children", []):
                walk(c)
        for n in result["nodes"]:
            walk(n)
        self.assertNotIn("_UNKNOWN_", types)
        self.assertIn("LINE", types)
        self.assertIn("IMAGE", types)

    def test_synthetic_edge_no_errors(self):
        data = json.loads((FIXTURES / "synthetic-edge.json").read_text())
        result = run_transform(data)
        self.assertEqual(result["_meta"]["stats"]["errors"], 0)
        self.assertEqual(result["_meta"]["unknownTypes"], {"_UNKNOWN_WEIRDWIDGET": 1})

    def test_absolute_coords_kept(self):
        data = json.loads((FIXTURES / "synthetic-edge.json").read_text())
        result = run_transform(data, coords="absolute")
        self.assertEqual(result["_meta"]["coordinateSpace"], "absolute-artboard")

    def test_invalid_coords_fail_fast(self):
        data = json.loads((FIXTURES / "synthetic-edge.json").read_text())
        with self.assertRaises(ValueError):
            run_transform(data, coords="bogus")


if __name__ == "__main__":
    unittest.main()
