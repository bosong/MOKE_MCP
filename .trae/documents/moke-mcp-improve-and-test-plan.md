# MOKE_MCP 整体改进 + 测试计划

## 1. 摘要（Summary）

对 MOKE_MCP 全库做一次「准确性验证 + 缺陷修复 + 能力补齐」：

1. **建立测试地基**：Python（unittest）+ TS（vitest）双端测试，用真实页面（`yd2hUtESwQ5`，用户已提供 Cookie 与链接）录制 golden fixtures，把「解析准确性」变成可回归验证的指标。
2. **修复 P0 契约 bug**：`checkCookieStatus` 永远返回 `exists:false`、`downloadImages` 假统计、`variable-extract` 阴影变量提取不到。
3. **Python 解析增强**：`fontStyle` 字段错位修复、多 fill/stroke/effect 支持、未知类型聚合进 `_meta`、distill 缩进稳健化。
4. **补齐设计→代码能力**：修复死代码 `code-gen.service.ts` 并接入新的 `code_gen` MCP tool。

## 2. 现状分析（Current State Analysis）

### 2.1 架构

```
AI Client → MCP Server (TS, stdio JSON-RPC)
  → packages/server/src/api/client.ts  (spawn 'python3 mockplus.py ...')
  → scripts/mockplus/ (从 GitHub mockplus-context 复制, v0.7.0)
      client.py      HTTP + Cookie → app.mockplus.cn API + CDN
      transform.py   Sketch JSON → 结构化 dict (token 去重)
      relayout.py    包含树重建 + 相对坐标 (parent-relative)
      distill.py     YAML 文本级蒸馏 (−49% 体积, 布局内联 + UUID 截断)
  → packages/server/src/services/  design-context / screenshot / variable-extract / code-gen
```

### 2.2 准确性评估结论

**架构方向正确**（token 去重、包含树重建、机械蒸馏都是合理的），但存在以下问题，准确性目前**没有任何测试证据**：

| # | 严重度 | 位置 | 问题 |
|---|---|---|---|
| 1 | P0 | `packages/server/src/api/client.ts` `checkCookieStatus` | 对 Python 文本输出做 `JSON.parse`，必失败 → 永远返回 `{exists:false}` |
| 2 | P0 | `packages/server/src/api/client.ts` `downloadImages` | 不解析真实下载结果，返回写死的 `{ok: hashes.length, fail: 0, cached: 0}` 假统计 |
| 3 | P0 | `variable-extract.service.ts` | EFFECT 判断用 Sketch 语义 `DROP_SHADOW/INNER_SHADOW/LAYER_BLUR`，transform 实际输出 Mockplus 语义 `outside/inside` → 阴影变量提取不到；stroke（`{width,color,position,dash}`）被误判 OTHER |
| 4 | P1 | `transform.py:267` | `fontStyle: font.get("fontWeight","")` 字段错位（fontStyle 应来自 italic，fontWeight 是独立字段） |
| 5 | P1 | `transform.py` | 多 fill/stroke/effect 只取第一个；多段 `text.styles` 只取首段（仅有 `textSegments` 计数） |
| 6 | P1 | `transform.py` | 未知 `realType` 静默透出 `_UNKNOWN_XXX`，无聚合统计 |
| 7 | P1 | `relayout.py` | 启发式重建（EPS 容差/z 证据/最小面积/跨界收养），声称「5 页 1582 节点实证」但语料不在仓库 → 无法复现回归 |
| 8 | P1 | `distill.py` | 正则硬编码 4 空格缩进，YAML 缩进变化即失效（有 fail-safe 但会整体放弃蒸馏） |
| 9 | P1 | `code-gen.service.ts` | **死代码**：无任何 tool 调用；TAG_MAP 是 v0.5 旧类型值；依赖 `node.pos`（JSON 模式 distill 不生效 → 无 pos） |
| 10 | P1 | 全库 | **零测试**：无任何 test 文件；`pnpm test` 直接失败；vitest 已装未配置 |
| 11 | P2 | `client.py` | index 响应无结构校验（假设 `payload.pages` 存在）；`X-MOCKPLUS-APP: idoc-for-web|1.41.0-cn` 硬编码，摹客升级有风险 |

### 2.3 已知数据流事实（决定方案设计）

- `get_design_context` yaml 模式走 distill → 节点有内联 `pos: {x,y,w,h}`；**json 模式（`fetchDesignData`）不走 distill** → 节点只有 `layout: layout_NNNNNN` 引用，坐标在 `globalVars.styles.layout_*` 里。
- TS 消费方（code-gen / variable-extract）目前假设 `node.pos`，与 json 形态不匹配。
- 用户提供的链接 `http://app.mockplus.cn/app/yd2hUtESwQ5/design` 是 **app 级链接**（tail=`design` 会被误判为 target_id），需先用 `mockplus tree yd2hUtESwQ5` 找到具体 page id 再录制。

## 3. 改进方案（Proposed Changes）

### 阶段 A：测试地基（最先做，后续所有改动靠它保护）

**A1. Python 单元测试**（`scripts/mockplus/tests/`，标准库 `unittest`，保持 mockplus 零第三方依赖）

| 文件 | 覆盖内容 |
|---|---|
| `tests/__init__.py` | 空包标记 |
| `tests/test_transform.py` | `rgba_to_str`/`normalize_bg`/`round_num`/`_border_radius_str`/`stable_id`；`TokenTable` 去重（同名同 spec 复用 / 同名异 spec 加后缀 / fingerprint 序号去重）；`extract_node` 全字段（fill/stroke/effect/textStyle/切片/蒙版）；未知类型；多段文本 warning；golden 快照 |
| `tests/test_relayout.py` | 合成语料验证：包含/纯堆叠保持兄弟/跨界收养 `adoptedBy`/z 证据不足禁用 z 过滤/整页背景不做父/环检测回退/相对坐标可逆性/幂等 |
| `tests/test_distill.py` | 布局内联、UUID 截断、纯数字歧义保留全 UUID、碰撞放弃、不变量破坏抛 `DistillError`、二次蒸馏拒绝 |
| `tests/test_client.py` | `parse_url_or_short`（含 app 级 URL、带 `design` 尾段）、`url_hash`、`extract_slices` 去重、cookie 读写（tmp 目录）、`_stale_fallback` |

运行：`python3 -m unittest discover -s scripts/mockplus/tests -v`

**A2. Golden 回归（准确性核心验证）**

- 新建 `scripts/mockplus/tests/fixtures/`：
  - `record_fixture.py`：录制工具。用真实 Cookie 拉 `yd2hUtESwQ5` 的 2-3 个真实页面 → **匿名化**（UUID/名称打码，保留结构）→ 存 `fixtures/real-page-<n>.json`。匿名化规则：节点 name 替换为 `N<idx>`、UUID 打码、坐标/颜色/字号等数值保留（它们是准确性验证对象）。
  - 合成 fixture：`synthetic-*.json` 覆盖边界：多 fill、多 stroke、多 effect、多段文本、渐变（linear/radial）、蒙版、SymbolInstance、未知 realType、全画布背景。
  - golden 文件：每个 fixture 固化 `.expected.json`（`--raw --format json` 未蒸馏 transform 输出）与 `.expected.distilled.yaml`。
- 断言方式：**语义等价对比器**（`tests/golden_compare.py`）——树形递归比较 id/name/type/几何/token 内容，token key（`layout_NNNNNN` 等序号）按指纹归一化后再比，避免序号漂移导致的假失败。
- 运行：`python3 -m unittest scripts/mockplus.tests.test_transform -v` 内嵌 golden 用例，或独立 `tests/run_golden.py`。

**A3. TS 单元测试**（vitest，`packages/server/tests/`）

- `packages/server/package.json` 增加 `"test": "vitest run"`，根 `pnpm test` 即生效。
- 用例：
  - `parseMockplusUrl`（合法/非法/带 page id/app 级链接）
  - `variable-extract.service.test.ts`：构造 JSON fixture 断言 COLOR/FONT/SPACING/EFFECT/OTHER 分类（含修复后的 outside/inside 阴影）
  - `design-context.service.test.ts`：`buildMetadataXml`/`buildPageTreeXml`/`jsonToYaml` 输出
  - `code-gen.service.test.ts`：修复后的 TAG_MAP 映射、坐标渲染（pos 内联 + layout 引用两种输入）
  - `screenshot.service.test.ts`：mock fs 读取 design.png/assets
  - `api/client.test.ts`：mock `spawn`（注入假 Python 输出）验证错误码映射、`checkCookieStatus` 修复、`downloadImages` 统计解析

**A4. 契约集成测试（TS ↔ Python，不依赖网络）**

- 新增测试脚本：直接用录制的 fixture JSON 文件（不经网络）跑本地 `transform.py` 管线（`MOCKPLUS_FIXTURE_DIR` 环境变量指向 fixtures，client 层走缓存回退逻辑），断言：json/yaml 双模式坐标语义等价、`_meta.relayout` 存在、无 `_ERROR` 节点、`unhandledFields` 为空或已知白名单。

**A5. 真实 API 冒烟（`@integration` tag，需 Cookie + 网络，执行阶段第一步）**

1. `mockplus cookie status` 验证 cookie。
2. `mockplus tree yd2hUtESwQ5 --format json` → 找到具体 page id。
3. 对每个 page 跑 `mockplus data`（yaml+json、raw+蒸馏）、`download`、`all`，断言退出码 0 + 结构完整。
4. 顺带完成 A2 的 fixtures 录制（匿名化后入库）。

### 阶段 B：P0 契约修复（TS 层）

| 文件 | 改动 | 方式 |
|---|---|---|
| `packages/server/src/api/client.ts` | `checkCookieStatus` | 改为解析 Python `cookie status` 文本输出（`Path:`/`Mode:`/`SetAt:`/`Expires:` 键值解析）或让 Python 侧 `cookie status --json` 输出 JSON（阶段 C 的 `mockplus.py` 改动配套）；优先选**后者**——加 `--json` flag，TS 侧继续 `JSON.parse`，最稳 |
| 同上 | `downloadImages` | Python 侧 `download` 增加 `--json` 输出 manifest 统计到 stdout；TS 侧解析真实 `{ok, fail, cached}`，不再写死 |
| `packages/server/src/services/variable-extract.service.ts` | EFFECT/stroke 分类 | 映射对齐 transform 实际输出：shadow `type: outside/inside` → `DROP_SHADOW/INNER_SHADOW`；stroke spec（含 `width/color/dash`）→ 新增 `STROKE` 类型或归入 EFFECT；`DesignVariable.type` 联合类型同步扩展 |

### 阶段 C：Python 解析增强（transform.py 为主）

| 文件 | 改动 |
|---|---|
| `scripts/mockplus/transform.py` | ① 修复 `fontStyle`：取 `italic` 标志 → `"italic"/"normal"`（fontWeight 保持独立字段）；② 多 fill/stroke/effect：节点字段升级为**数组引用** `fills: [k1, k2, ...]`（`strokes`/`effects` 同理），TokenTable 继续按 spec 去重；③ 未知 realType 聚合：`_meta.unknownTypes = {type: count}`（不再静默），测试断言用；④ 多段文本保持取首段 + `textSegments` 计数（富文本暂缓，避免过度工程） |
| `scripts/mockplus/transform.py` | `_meta` 增加 `stats: {nodeCount, errorNodes, warningCount}`，便于冒烟测试快速断言健康度 |
| `scripts/mockplus/mockplus.py` | `cookie status` 与 `download` 增加 `--json` 输出模式（配套阶段 B） |
| `scripts/mockplus/client.py` | `fetch_index` 增加响应结构校验：`payload.pages` 缺失时给出明确报错而非 `KeyError` 裸抛 |
| `scripts/mockplus/distill.py` | 缩进稳健化：`LAYOUT_BLOCK_RE` 从硬编码 4 空格改为探测缩进（匹配 `^( {2,8})(layout_\d+):` 并沿用探测到的缩进），保持文本级 fail-safe 语义不变 |
| `scripts/mockplus/relayout.py` | 本轮**不改变算法**（改动风险高、需数据支撑）；只通过 A2 真实语料回归建立基线，如回归发现几何误判再单独立项 |

**说明**：`fills` 数组化会改变输出契约，需同步更新：`packages/server/src/api/types.ts` 的 `DesignNode.fills/strokes/effects` 类型（`string \| string[]`）及 `relayout.py` 中 `reserved_keys` 收集逻辑（已遍历 `("fills","strokes","effects","textStyle")`，改为兼容 str 与 list）。

### 阶段 D：code-gen 修复 + 接入 MCP（补齐设计→代码能力）

| 文件 | 改动 |
|---|---|
| `packages/server/src/services/code-gen.service.ts` | ① TAG_MAP 对齐 transform 实际类型（`FRAME/RECTANGLE/ELLIPSE/VECTOR→div`、`TEXT→span`、`IMAGE→img`、`INSTANCE→div`、`MASK/SLICE→忽略或 div`）；② 坐标解析：新增 `resolveGeometry(node, styles)`——yaml 模式读 `node.pos`，json 模式从 `node.layout` 反查 `globalVars.styles.layout_*` 的 `locationRelativeToParent + dimensions`；③ 样式输出基于真实数据（color/borderRadius/opacity/fontSize/lineHeight），弱化脆弱的 name 启发式（`textStyle.includes('Bold')` 保留为兜底） |
| `packages/server/src/utils/geometry.ts` | 新增：`resolveGeometry` 纯函数（供 code-gen 与 design-context 复用，可单测） |
| `packages/server/src/api/types.ts` | `DesignNode` 补 `strokes/effects/opacity/borderRadius` 等字段类型；`fills/strokes/effects` 兼容 `string \| string[]` |
| `packages/server/src/mcp/server.ts` | 新增 `code_gen` tool：参数 `url/framework(react|vue)/styleLibrary(tailwind|css-modules|styled-components)/typescript(bool)` → `fetchDesignData(json)` → `resolveGeometry` + `generateCode` → 返回 `{markup, styles, imports}`；注册到 server 并更新 tool 描述 |
| `README.md` | 新增 `code_gen` 工具文档 + 工作流示例；同步修正 README 中「项目结构」与已实现能力描述 |

### 阶段 E：构建与脚本

| 文件 | 改动 |
|---|---|
| `packages/server/package.json` | `"test": "vitest run"` |
| 根 `package.json` | 增加 `"test:py": "python3 -m unittest discover -s scripts/mockplus/tests"` 便于一键跑双端 |

## 4. 假设与决策（Assumptions & Decisions）

1. **测试语料**：使用用户提供的 `yd2hUtESwQ5`（真实页面，Cookie 已配置）录制 2-3 页 fixtures 并匿名化入库；同时构造合成 fixture 覆盖边界。
2. **Python 测试框架**：标准库 `unittest`（不引入 pytest），与 mockplus 零依赖设计一致；`@integration` 冒烟用脚本内 tag 跳过（无 Cookie/断网时跳过）。
3. **Golden 对比**：语义等价对比（指纹归一化 token key），不做文本 diff——序号类 key 允许漂移，结构与内容必须一致。
4. **输出契约**：`fills/strokes/effects` 升级为数组引用（`string | string[]`），TS 类型与 relayout 的 `reserved_keys` 同步兼容；多段富文本暂不支持（保留 `textSegments` 计数）。
5. **relayout 算法**：本轮只建立回归基线不改写；发现几何误判再单独立项，避免无数据支撑的算法改动。
6. **distill**：保留文本级实现（离线蒸馏既有 YAML 文件仍有用），仅加固缩进探测；JSON 模式不走 distill（坐标由 TS 层 `resolveGeometry` 从 layout 引用反查，保证 json/yaml 语义等价）。
7. **测试链接是 app 级 URL**（tail=`design` 会被误判为 target_id），执行时先用 `mockplus tree yd2hUtESwQ5` 定位 page id，后续用 `<APP_ID>:<PAGE_ID>` 短形式或完整 page URL。

## 5. 验证（Verification）

1. **Python 单测 + golden**：`python3 -m unittest discover -s scripts/mockplus/tests -v` 全绿；golden 回归 100% 通过（`unhandledFields` 空或已知白名单、0 个 `_ERROR` 节点、relayout 无回退、几何可逆性 100%）。
2. **TS 单测**：`pnpm -r test`（vitest）全绿，含修复后的 `checkCookieStatus`/`downloadImages`/EFFECT 分类用例。
3. **契约集成**：对同一 fixture，json 模式 `resolveGeometry` 反查的坐标与 yaml 模式 `pos` 完全一致；`_meta.coordinateSpace = parent-relative` 且 `relayout` 统计存在。
4. **真实 API 冒烟**（需 Cookie + 网络）：`mockplus tree yd2hUtESwQ5` → 每页 `data/download/all` 退出码 0；`--stats` 健康（无 `_UNKNOWN_*` 或已登记白名单、warnings 无 `_ERROR`）。
5. **MCP 端到端**：`moke-mcp serve` 后调用 `code_gen` 工具对真实页面生成 React/Tailwind 代码，产物含绝对定位坐标且与设计稿几何一致；`get_variable_defs` 能列出 DROP_SHADOW/INNER_SHADOW 阴影 token。
6. **双形态一致性**：同一页面 yaml 与 json 输出坐标语义等价（spot-check 抽样节点核对）。
