#!/usr/bin/env python3
"""record_fixture.py - 从本地缓存/网络把真实页面 Sketch JSON 匿名化后录制为 fixtures。

用法:
    python3 tests/record_fixture.py <APP_ID>:<PAGE_ID> [--out tests/fixtures/real-<n>.json]

匿名化规则(只打码业务内容,保留结构/几何/颜色/字号等验证对象):
- basic.name / text.value → N<idx> / T<idx>(确定性打码)
- slice.bitmapURL / svg / dataURL / imageURL → 替换域名与签名为占位
- UUID 保留原样(distill 截断是验证对象之一)
"""
import json
import re
import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import client  # noqa: E402


_NAME_RE = re.compile(r"[A-Za-z0-9_\-\.\u4e00-\u9fa5]+")
_URL_RE = re.compile(r"https?://[^\s\"']+")
_counter = [0]


def _token(s: str) -> str:
    return f"ANON{_counter[0]:04d}"


def anonymize(data) -> None:
    """原地匿名化。name/text/URL 打码,结构与数值保留。"""
    if isinstance(data, dict):
        # 先打 URL 字段
        for k in ("bitmapURL", "svgURL", "svg", "dataURL", "imageURL", "url"):
            v = data.get(k)
            if isinstance(v, str) and v.startswith("http"):
                data[k] = _URL_RE.sub(lambda m: "https://cdn.mockplus.test/" + _token(""), v)
        for k in ("name", "value"):
            v = data.get(k)
            if isinstance(v, str) and k == "name":
                _counter[0] += 1
                data[k] = _token(v)
            elif isinstance(v, str) and k == "value" and "font" not in data and "styles" not in data:
                # 只打 text.value(节点文本),不打颜色 value(dict)
                if len(v) > 0 and not v.startswith("#"):
                    _counter[0] += 1
                    data[k] = _token(v)
        for v in data.values():
            anonymize(v)
    elif isinstance(data, list):
        for v in data:
            anonymize(v)


def main(argv=None) -> int:
    args = sys.argv[1:] if argv is None else argv
    if not args:
        print(__doc__)
        return 2
    spec = args[0]
    out = Path(args[1]) if len(args) > 1 else None
    app_id, page_id = spec.split(":", 1)

    idx = client.fetch_index(app_id)
    pages, _ = client.flatten_pages(idx)
    page_meta = next(p for p in pages if p["id"] == page_id)
    data = client.get_page_data_cached(app_id, page_meta)

    _counter[0] = 0
    data_copy = json.loads(json.dumps(data))
    anonymize(data_copy)

    if out is None:
        name = re.sub(r"[^\w\-]+", "-", page_meta.get("name", page_id)).strip("-")
        out = Path(__file__).resolve().parent / "fixtures" / f"real-{name or page_id}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data_copy, ensure_ascii=False, indent=1))
    print(f"OK: {out} (name={page_meta.get('name')} size={len(data_copy['layers'].get('children', []))} top-children)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
