"""scale.py - 设计数据单位缩放(字段级,按语义只缩放长度值)。

在 transform 之后、serialize 之前对 result dict 就地缩放:
- metadata.size.width/height
- layout_*  : locationRelativeToParent.{x,y} / dimensions.{width,height}
- textStyle_*: fontSize / lineHeight / letterSpacing
- stroke_*  : width
- effect_*  : offsetX / offsetY / blur / spread
- 节点 absolutePosition.{x,y}(若为独立 dict) 与 CSS border-radius(如 '25px 0 20px 0')

颜色/字体名/布尔/字符串等一律不动,避免把颜色分量当长度换算。
作用于 dict 层,因此 json(未蒸馏)/yaml(蒸馏后内联 layout)/raw 全部一致。
"""
import re
from typing import Dict

_CSS_NUM_RE = re.compile(r'^(-?\d*\.?\d+)(px)?$')


def _scale_num(v, scale: float):
    r = v * scale
    if abs(r - round(r)) < 1e-9:
        return int(round(r))
    return round(r, 4)


def _mul(obj: Dict, scale: float, *keys):
    for k in keys:
        v = obj.get(k)
        if isinstance(v, (int, float)) and not isinstance(v, bool):
            obj[k] = _scale_num(v, scale)


def _scale_css_radius(v: str, scale: float) -> str:
    """缩放 CSS border-radius 字符串,如 '25px 0 20px 0' -> '12.5px 0 10px 0'"""
    parts = []
    for seg in v.split():
        m = _CSS_NUM_RE.match(seg)
        if m:
            r = float(m.group(1)) * scale
            if abs(r - round(r)) < 1e-9:
                r = int(round(r))
            parts.append(f"{r}{m.group(2) or ''}")
        else:
            parts.append(seg)
    return ' '.join(parts)


def _walk_nodes(nodes, scale: float, seen: set):
    for n in nodes or []:
        ap = n.get("absolutePosition")
        if isinstance(ap, dict) and id(ap) not in seen:
            seen.add(id(ap))
            _mul(ap, scale, "x", "y")
        # 节点内联 CSS border-radius(长度值),如 '25px' / '25px 0 20px 0'
        br = n.get("borderRadius")
        if isinstance(br, str) and re.search(r'\d', br):
            n["borderRadius"] = _scale_css_radius(br, scale)
        _walk_nodes(n.get("children"), scale, seen)


def apply_scale(data: Dict, scale: float) -> Dict:
    if not scale or scale == 1:
        return data

    md = data.get("metadata") or {}
    if isinstance(md, dict):
        # 显式声明本次数值已缩放,避免消费端(AI)按 device 原始倍率二次换算
        md["scale"] = round(scale, 4)
        size = md.get("size")
        if isinstance(size, dict):
            _mul(size, scale, "width", "height")

    # seen:transform token 去重后可能出现不同 key 共享同一子 dict
    # (如多个 layout 共享同一 dimensions),按对象 identity 保证每份只缩一次
    seen: set = set()
    styles = ((data.get("globalVars") or {}).get("styles")) or {}
    for key, style in styles.items():
        if not isinstance(style, dict):
            continue
        if key.startswith("layout_"):
            lrp = style.get("locationRelativeToParent")
            if isinstance(lrp, dict) and id(lrp) not in seen:
                seen.add(id(lrp))
                _mul(lrp, scale, "x", "y")
            dims = style.get("dimensions")
            if isinstance(dims, dict) and id(dims) not in seen:
                seen.add(id(dims))
                _mul(dims, scale, "width", "height")
        elif key.startswith("textStyle_"):
            if id(style) not in seen:
                seen.add(id(style))
                _mul(style, scale, "fontSize", "lineHeight", "letterSpacing")
        elif key.startswith("stroke_"):
            if id(style) not in seen:
                seen.add(id(style))
                _mul(style, scale, "width")
        elif key.startswith("effect_"):
            if id(style) not in seen:
                seen.add(id(style))
                _mul(style, scale, "offsetX", "offsetY", "blur", "spread")

    _walk_nodes(data.get("nodes"), scale, seen)
    return data
