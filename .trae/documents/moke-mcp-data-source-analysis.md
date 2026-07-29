# 摹客 MCP 数据获取方案分析

## 1. 背景

当前 MOKE_MCP 项目采用 **Plugin Bridge 模式**，通过摹客 DT 插件 + WebSocket 桥接获取设计数据。该方案存在以下痛点：

- 必须安装并运行摹客 DT 插件
- 必须打开摹客 DT 编辑器且加载目标设计文件
- 插件沙箱限制（主线程无法直接 HTTP，需通过 iframe 中转）
- 用户体验重，链路长

现评估两个社区开源项目的数据获取方式，作为替代方案。

---

## 2. 两个方案概览

### 2.1 mockplus-context（MySwallow）

| 维度 | 详情 |
|---|---|
| **仓库** | https://github.com/MySwallow/mockplus-context |
| **目标产品** | 摹客 DT（`app.mockplus.cn` - 设计/标注平台） |
| **数据获取方式** | REST API + Cookie 认证 |
| **核心技术栈** | Python 3（零外部依赖，仅 PyYAML） |
| **版本** | v0.7.0（23 commits，持续活跃） |
| **License** | MIT |
| **数据格式** | Sketch JSON → 结构化 YAML |
| **认证方式** | 浏览器 Cookie（~30 天有效） |
| **切图下载** | CDN 直链（`img01/02.mockplus.cn`） |
| **API 端点** | `GET /api/v1/app/module/{APP_ID}/design`（需 Cookie） |
| **页面数据源** | CDN 预签名 URL（`page_meta.dataURL`，无需 Cookie） |

**核心架构：**

```
URL → client.parse_url_or_short
    → client.fetch_index (REST API, 需 Cookie)
    → client.flatten_pages (提取页面列表)
    → client.get_page_data_cached (CDN 下载 Sketch JSON)
    → transform.transform (Sketch JSON → 结构化 YAML)
    → distill.py (可选, 机械蒸馏 -45~48% 体积)
    → 输出 YAML + 切图
```

**核心 API 端点：**

| 端点 | 用途 | 认证 |
|---|---|---|
| `GET /api/v1/app/module/{APP_ID}/design` | 获取项目页面树 | Cookie |
| `{page_meta.dataURL}` (CDN 预签名 URL) | 下载页面 Sketch JSON 数据 | 无需 |
| `{page_meta.imageURL}` (CDN) | 下载整页截图 | 无需 |
| `{slice.bitmapURL/svgURL}` (CDN) | 下载切图 | 无需 |

**关键能力：**

| 能力 | 说明 |
|---|---|
| **包含树重建** | 从 Sketch 原始平级兄弟结构重建视觉嵌套层级，`locationRelativeToParent` 为真·相对父坐标 |
| **坐标空间** | 支持 `parent-relative`（默认）和 `absolute-artboard`（兼容旧版） |
| **Token 去重** | 相同 fill/layout/effect 自动去重，节点上仅放引用，YAML 体积大幅下降 |
| **文字样式语义化** | `textStyle` 使用设计师命名（`sharedStyle.name`），AI 可直接用于 CSS 变量名 |
| **机械蒸馏** | v0.7 新增 `distill.py`，将 `layout_*` 查找表内联为行内 `pos: {x,y,w,h}`，YAML 体积再降 45~48% |
| **UUID 防歧义** | 截断 UUID 至前 8 位，与纯数字形歧义时保留全 UUID |
| **unhandledFields 探针** | 自动检测 Mockplus schema 升级新增字段，不静默丢数据 |
| **离线缓存** | 24h TTL 缓存 + 7 天过期回退，transform 版本升级后可离线用旧缓存重转 |
| **容错降级** | 单节点递归异常 → `_ERROR` 占位节点，不影响兄弟节点 |
| **切图按需** | 扫 YAML 收集 `imageRef` 后批量下载，不下全部 |
| **整页截图** | 支持 `--include-design` 下载整页 @2x 截图 |

**安装方式：**

```bash
# 1. 克隆仓库
git clone https://github.com/MySwallow/mockplus-context.git

# 2. 软链 skill 目录（Claude Code）
ln -s "$(pwd)/mockplus-context/skills/mockplus-context" ~/.claude/skills/mockplus-context

# 3. 安装依赖
pip install PyYAML

# 4. 配置 Cookie（一次性）
python3 skills/mockplus-context/scripts/mockplus.py cookie set
```

**使用方式（Agent Skill，非 CLI 给用户用）：**

```bash
# AI 自动执行：
mockplus data <URL> [--out PATH]           # 获取页面 YAML
mockplus download <URL> --nodes h1,h2      # 按需下载切图
mockplus all <URL> <OUT_DIR>               # 一站式：YAML + 切图 + 截图
mockplus tree <APP_ID>                     # 浏览项目页面树
mockplus cookie {set|test|status|clear}    # Cookie 管理
```

**输出 YAML 示例（v0.7 蒸馏后）：**

```yaml
metadata:
  name: Sample Page
  pageId: pgA1bC2X3
  device: ios1x
  size: { width: 375, height: 812 }
  components:
    <lib>/<comp>: { id, name, libraryName }
nodes:
  - id: 2F11A218
    name: Submit Bar
    type: VECTOR
    pos: {x: 0, y: 718, w: 375, h: 48}
    absolutePosition: { x: 0, y: 718 }
    children:
      - id: 67C9DB5F
        name: Submit Action
        type: TEXT
        pos: {x: 266, y: 19, w: 80, h: 22}
        fills: fill_000001
        text: "Submit Action"
        textStyle: Body/16px/Semibold/Center Style
globalVars:
  styles:
    fill_000003:
      - type: IMAGE
        imageRef: 2b417ea8...
        scaleMode: FILL
    Body/16px/Semibold/Center Style:
      fontFamily: PingFang SC
      fontWeight: 600
      fontSize: 16
_meta:
  coordinateSpace: parent-relative
  relayout:
    reparented: 21
  unhandledFields: []
```

---

### 2.2 mockplus-rp-skill（Retohsaka）

| 维度 | 详情 |
|---|---|
| **仓库** | https://github.com/Retohsaka/mockplus-rp-skill |
| **目标产品** | 摹客 RP（`rp.mockplus.cn` - 原型工具） |
| **数据获取方式** | REST API（无认证） |
| **核心技术栈** | 无代码（AI Agent Skill 指令，直接 curl） |
| **版本** | 最新 commit 2026-07-24（11 commits） |
| **License** | 未声明 |
| **数据格式** | 原始 JSON |
| **认证方式** | 无需认证 |
| **API 端点** | 2 个公开 REST API |

**核心 API 端点：**

| 端点 | 用途 | 认证 |
|---|---|---|
| `GET /api/v1/app/preview/{shareID}` | 获取原型所有页面列表 | 无需 |
| `GET /api/v1/artboard/preview/all/{nodeID}` | 获取某页面的画板组件内容 | 无需 |

**核心架构：**

```
分享链接 → curl Tree API → 获取页面列表
         → 用户选择页面
         → curl Board API → 获取画板组件 JSON
         → AI 直接分析 JSON
```

**核心能力：**

| 能力 | 说明 |
|---|---|
| **零认证** | 无需 Cookie/Token，直接调用公开 API |
| **页面树** | 获取原型所有页面和文件夹结构 |
| **组件分析** | 获取画板内组件类型、文本、位置、尺寸 |
| **并发拉取** | 支持多页面并行 curl |
| **多 IDE 支持** | Cursor、Trae、Qoder、Windsurf 等规则文件 |
| **对话式 AI 支持** | 豆包、Kimi、通义千问、DeepSeek 等 |

**安装方式：**

```bash
# 直接发 GitHub 地址给 AI 工具即可，无需安装

# Claude Code 用户（可选）：
git clone https://github.com/Retohsaka/mockplus-rp-skill.git ~/mockplus-rp-skill
ln -s ~/mockplus-rp-skill/mockplus-rp ~/.claude/skills/mockplus-rp
```

**API 返回结构（Board API）：**

```json
// 组件类型：
// rect（矩形）、text（文本）、image（图片）、group（组）、
// content-panel-v2（动态面板）、ellipse（圆形）、path（路径）
[
  {
    "components": [
      {
        "type": "rect",
        "position": { "x": 0, "y": 0 },
        "size": { "width": 375, "height": 812 },
        "components": [...]
      },
      {
        "type": "text",
        "value": "首页标题",
        "position": { "x": 16, "y": 54 },
        "size": { "width": 200, "height": 24 }
      }
    ]
  }
]
```

---

## 3. 关键差异对比

### 3.1 产品目标不同

```
摹客产品线：
├── 摹客 DT (app.mockplus.cn)     ← 设计工具（对标 Figma Design）
│   └── mockplus-context 支持此产品
│
└── 摹客 RP (rp.mockplus.cn)      ← 原型工具（对标 Axure RP）
    └── mockplus-rp-skill 支持此产品
```

**这是最关键的区别：两个方案针对的是摹客不同的产品，不是同一个产品的不同实现方式。**

### 3.2 数据丰富度对比

| 数据维度 | mockplus-context（DT） | mockplus-rp-skill（RP） |
|---|---|---|
| 图层树 | 完整 Sketch 层级 | 扁平组件列表 |
| 颜色/填充 | rgba/#RRGGBB 精确值 | 无 |
| 渐变/效果 | gradient/stroke/shadow/blur | 无 |
| 文本样式 | fontSize/fontFamily/fontWeight/lineHeight/letterSpacing | 仅 text value |
| 坐标系统 | 相对父坐标（包含树重建后） | 绝对画布坐标 |
| 布局（Auto Layout） | layoutMode/padding/itemSpacing | 无 |
| 圆角 | cornerRadius | 无 |
| 透明度 | opacity | 无 |
| 组件/实例 | SymbolMaster/SymbolInstance 关联 | 无 |
| 设计变量 | sharedColorStyle/sharedTextStyle | 无 |
| 切图 | CDN 下载（PNG + SVG） | 图片 URL |
| 整页截图 | @2x PNG | 无 |
| 可见性/锁定 | visible/locked | 无 |

### 3.3 架构对比

| 维度 | mockplus-context | mockplus-rp-skill |
|---|---|---|
| **数据传输** | Cookie 认证 API → CDN 下载 Sketch JSON → Python 转换 → YAML | 无认证 API → 原始 JSON |
| **处理链路** | 长（fetch → transform → distill → output） | 短（curl → AI 直接消费） |
| **运行环境** | Python 脚本 | AI 直接执行 curl |
| **缓存机制** | 24h TTL + 7 天过期回退 | 无 |
| **输出格式** | 结构化 YAML（经过去噪/去重/重建） | 原始 JSON |
| **依赖** | Python 3 + PyYAML | 无（仅 curl） |
| **适用场景** | 设计→代码还原 | 原型分析/需求理解 |

### 3.4 MCP 集成适配度

| 需求 | mockplus-context | mockplus-rp-skill |
|---|---|---|
| **对标 Figma MCP `get_design_context`** | 完美匹配：输出结构化 YAML，含完整样式/布局/文本 | 不匹配：无样式数据，无法生成代码 |
| **对标 Figma MCP `get_metadata`** | 完美匹配：完整节点树 + bounds | 部分匹配：有组件名/类型/位置 |
| **对标 Figma MCP `get_screenshot`** | 支持：整页 @2x 截图 | 不支持 |
| **对标 Figma MCP `get_variable_defs`** | 支持：sharedStyle 提取 | 不支持 |
| **对标 Figma MCP `download_images`** | 支持：切图 CDN 下载 | 仅提供图片 URL |
| **对标 Figma MCP `get_design_data`** | 完美匹配 | 不匹配 |
| **代码生成能力** | 高：坐标/样式数据充分 | 低：仅有位置和文本 |

---

## 4. 两种集成方案

### 方案 A：基于 mockplus-context API 方式

**核心思路：** 将 mockplus-context 的 API 调用链路（Cookie 认证 → REST API → CDN JSON → 转换 → YAML）集成到 MOKE_MCP Server 中，替代当前的 Plugin Bridge。

**架构变化：**

```
改造前（当前）：
AI Client → MCP Server (stdio) ← WebSocket → DT Plugin → 摹客 DT 编辑器

改造后（方案 A）：
AI Client → MCP Server (stdio) ← HTTP → app.mockplus.cn REST API + CDN
                                    ↑ 需 Cookie 认证
```

**具体集成方式：**

1. **MCP Server 中实现 HTTP Client**：直接调用 `app.mockplus.cn` 的 REST API
2. **复用 mockplus-context 的数据转换逻辑**：Sketch JSON → 结构化数据
3. **Cookie 管理**：通过 CLI `moke-mcp cookie set` 或环境变量 `MOKE_COOKIE` 配置
4. **MCP 工具直接调用 API**：
   - `get_metadata` → `GET /api/v1/app/module/{APP_ID}/design` → flatten_pages → 输出节点树
   - `get_design_context` → `GET page_meta.dataURL` (CDN) → transform → 输出 YAML/JSON
   - `get_screenshot` → `GET page_meta.imageURL` (CDN) → base64
   - `download_design_images` → extract_slices → CDN 下载切图

**优势：**
- 无需安装/运行摹客 DT 插件
- 无需打开摹客 DT 编辑器
- 直接 HTTP 调用，链路短
- mockplus-context 的 transform 逻辑成熟（包含树重建、坐标相对化、Token 去重）
- 设计数据丰富度对标 Figma MCP

**劣势：**
- 需要 Cookie 认证（用户需从浏览器复制，~30 天有效）
- API 路径是逆向工程出来的（非官方公开文档），可能随摹客升级而变化
- `unhandledFields` 探针机制只能检测不能自动适配
- 语言栈不匹配：mockplus-context 是 Python，MOKE_MCP 是 TypeScript（需重写 transform 逻辑）
- mockplus-context 使用 urllib 标准库（无第三方 HTTP 依赖），MOKE_MCP 需用 Node.js 重新实现相同逻辑

**关键风险：**
- API 稳定性：`/api/v1/app/module/{APP_ID}/design` 和 CDN 预签名 URL 是逆向工程产物，非官方公开 API
- Cookie 有效期：30 天到期后需用户重新配置

### 方案 B：基于 mockplus-rp-skill API 方式

**核心思路：** 使用摹客 RP 的公开 REST API（无需认证），直接从分享链接获取原型数据。

**架构变化：**

```
改造后（方案 B）：
AI Client → MCP Server (stdio) ← HTTP → rp.mockplus.cn REST API
                                    ↑ 无需认证
```

**具体集成方式：**

1. **MCP Server 中实现 HTTP Client**：直接调用 `rp.mockplus.cn` 的公开 API
2. **MCP 工具直接调用 API**：
   - `get_metadata` → `GET /api/v1/app/preview/{shareID}` → 解析页面树
   - `get_design_context` → `GET /api/v1/artboard/preview/all/{nodeID}` → 返回组件 JSON

**优势：**
- 零认证，用户体验最佳
- API 简单，仅 2 个端点
- 无需任何依赖（纯 HTTP）
- 完全公开的 API（分享链接本身就不需要登录）

**劣势：**
- **仅支持摹客 RP（原型工具），不支持摹客 DT（设计工具）**
- **数据极其有限**：无颜色/字体/样式/布局详细信息，无法用于设计→代码还原
- 无法对标 Figma MCP 的核心功能（`get_design_context`、`get_variable_defs` 等）
- 组件类型少（rect/text/image/group/content-panel-v2/ellipse/path）
- 无切图下载能力

**适用场景受限：**
- 仅适用于原型分析和需求理解
- 无法用于设计还原和代码生成

---

## 5. 决策建议

### 5.1 核心结论

| | mockplus-context（方案 A） | mockplus-rp-skill（方案 B） |
|---|---|---|
| **目标产品** | 摹客 DT（设计工具） | 摹客 RP（原型工具） |
| **对标 Figma MCP** | 可对标 | 无法对标 |
| **设计→代码** | 支持 | 不支持 |
| **数据丰富度** | 高 | 低 |
| **认证复杂度** | 需 Cookie | 无需 |
| **API 稳定性** | 逆向工程，有风险 | 公开 API，稳定 |
| **适配 MOKE_MCP 目标** | 高度匹配 | 基本不匹配 |

### 5.2 推荐方案：**方案 A（mockplus-context API 方式）**

**推荐理由：**

1. **产品匹配**：MOKE_MCP 目标是设计→代码，对标 Figma MCP，必须使用摹客 DT（设计工具）的数据。mockplus-rp-skill 针对的是摹客 RP（原型工具），两者是不同产品，不存在替代关系。

2. **数据完整**：只有 mockplus-context 的 Sketch JSON 数据源能提供颜色、字体、布局、效果、组件等设计细节，这是代码生成的基础。

3. **去掉插件**：mockplus-context 证明了可以仅通过 HTTP API（Cookie 认证）+ CDN 获取完整设计数据，不需要插件桥接。这正是本次优化的目标。

4. **成熟度高**：v0.7 版本已经过包含树重建、坐标相对化、Token 去重、机械蒸馏等多次迭代，transform 逻辑成熟可靠。

### 5.3 实施要点

如果用方案 A，MOKE_MCP 改造范围：

1. **删除插件包**（`packages/plugin/`）：不再需要摹客 DT 插件
2. **删除 Bridge 层**（`packages/server/src/bridge/`）：不再需要 WebSocket 桥接
3. **新增 HTTP Client 层**：在 MCP Server 中实现 API 调用
4. **移植 transform 逻辑**：将 Python 的 `transform.py` 逻辑用 TypeScript 重写
5. **新增 Cookie 管理**：CLI 增加 `moke-mcp cookie set/status` 命令
6. **新增缓存层**：实现类似 mockplus-context 的 24h 缓存机制

### 5.4 从 URL 推断产品类型

MOKE_MCP 可以通过 URL 自动判断数据源：

```
https://app.mockplus.cn/app/{APP_ID}/develop/design/{PAGE_ID}  → DT（方案 A）
https://rp.mockplus.cn/rps/{shareID}/{pageID}                   → RP（方案 B）
```

理论上两种方案可以共存，作为 MOKE_MCP 的两个数据源适配器。

---

## 6. 待决策问题

1. **是否确认使用方案 A（mockplus-context 方式）作为主要数据源？**
2. **是否需要同时支持方案 B（mockplus-rp-skill）作为 RP 原型的数据源适配器？**
3. **Cookie 认证的用户体验：是否可以接受用户首次使用时手动配置 Cookie？**
4. **transform 逻辑是 TypeScript 重写还是通过子进程调用 Python 脚本？**
   - TypeScript 重写：单语言栈，维护方便，但工作量大（~600 行 Python → TS）
   - 子进程调用：快速集成，但引入 Python 依赖
