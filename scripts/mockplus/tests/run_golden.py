#!/usr/bin/env python3
"""run_golden.py - golden 回归:fixtures/*.json → transform(relative) → 与 .expected.json 语义等价对比。

用法:
    python3 tests/run_golden.py            # 对比(回归)
    python3 tests/run_golden.py --update   # 重新生成 golden(transform 契约变更时)

语义等价口径:token key(layout_/fill_/stroke_/effect_/textStyle_ 序号)按 spec 指纹归一化,
_meta 的 volatile 字段(版本号/警告/relayout 统计/时间戳)剥离后整体对比。
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import transform  # noqa: E402

FIXTURES = Path(__file__).resolve().parent / "fixtures"
VOLATILE_META = {"transformVersion", "sketchPluginVersion", "documentVersion",
                 "inputFieldsTotal", "warnings", "relayout", "stats"}


def _fp(spec) -> str:
    if isinstance(spec, dict):
        return repr(sorted((k, _fp(v)) for k, v in spec.items()))
    if isinstance(spec, list):
        return repr([_fp(x) for x in spec])
    return repr(spec)


def normalize(result: dict) -> dict:
    """把 token key 序号归一化为 spec 指纹名,剥掉 volatile _meta 字段。"""
    styles = (result.get("globalVars") or {}).get("styles") or {}
    key_of = {key: f"S{_fp(spec)}" for key, spec in styles.items()}

    def walk(n):
        out = {}
        for k, v in n.items():
            if k == "children":
                out[k] = [walk(c) for c in v]
            elif isinstance(v, str) and v in key_of:
                out[k] = key_of[v]
            elif isinstance(v, list) and all(isinstance(x, str) and x in key_of for x in v):
                out[k] = [key_of[x] for x in v]
            else:
                out[k] = v
        return out

    nodes = [walk(n) for n in result.get("nodes") or []]
    styles_norm = {key_of[k]: v for k, v in styles.items()}
    meta = {k: v for k, v in (result.get("_meta") or {}).items() if k not in VOLATILE_META}
    metadata = result.get("metadata") or {}
    # metadata.components 顺序无关,排序对比
    if isinstance(metadata.get("components"), dict):
        metadata = dict(metadata)
        metadata["components"] = dict(sorted(metadata["components"].items()))
    return {"metadata": metadata, "nodes": nodes,
            "globalVars": {"styles": styles_norm}, "_meta": meta}


def main(argv=None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    update = "--update" in args
    args = [a for a in args if a != "--update"]

    targets = [Path(a) for a in args] if args else sorted(FIXTURES.glob("*.json"))
    targets = [t for t in targets if t.name != "*.expected.json" and not t.name.endswith(".expected.json")]

    failed = 0
    for fp in targets:
        data = json.loads(fp.read_text())
        page_meta = {"name": "golden", "path": "golden", "id": "golden-page",
                     "device": data.get("device", "")}
        result = transform.transform(data, page_meta, "golden-app", coords="relative")
        got = normalize(result)
        gold_fp = fp.with_name(fp.stem + ".expected.json")
        if update:
            gold_fp.write_text(json.dumps(got, ensure_ascii=False, indent=1, sort_keys=True))
            print(f"UPDATED {gold_fp.name}")
            continue
        if not gold_fp.exists():
            print(f"MISSING-GOLDEN {fp.name}(先跑 --update)")
            failed += 1
            continue
        want = json.loads(gold_fp.read_text())
        if got == want:
            print(f"OK {fp.name}")
        else:
            failed += 1
            print(f"DIFF {fp.name}")
            # 打印首个差异路径(简化为整块对比提示)
            for k in ("metadata", "nodes", "globalVars", "_meta"):
                if got.get(k) != want.get(k):
                    print(f"  差异在顶层块: {k}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
