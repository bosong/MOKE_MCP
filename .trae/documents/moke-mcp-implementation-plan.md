# 摹客 MCP Server 实施规划

## 1. 概述

为摹客（Mockplus）开发一款对标 Figma MCP Server 的 MCP Server，使 AI 编码助手（Cursor、Claude Code、VS Code Copilot 等）能够直接读取摹客设计文件中的设计数据（图层结构、样式、颜色、排版、切图等），从而在设计→代码工作流中生成精准的前端代码。同时提供 CLI 工具支持项目初始化和配置管理。

### 目标对齐 Figma MCP 的能力矩阵

| Figma MCP 工具 | 摹客 MCP 对应工具 | 优先级 |
|---|---|---|
| `get_design_context` | `get_design_context` | P0 |
| `get_metadata` | `get_metadata` | P0 |
| `get_screenshot` | `get_screenshot` | P0 |
| `get_variable_defs` | `get_variable_defs` | P1 |
| `download_figma_images` | `download_design_images` | P1 |
| `get_figma_data` | `get_design_data` | P1 |
| `create_design_system_rules` | `create_design_system_rules` | P2 |

---

## 2. 当前状态分析

### 2.1 项目仓库状态
- 仓库路径：`/Users/songbo/Documents/trae_projects/MOKE_MCP`
- 当前状态：空仓库，无任何代码

### 2.2 摹客 API 能力
- **摹客 DT Plugin API**（`mockplus.cn/developers/plugin/api`）：
  - 提供 `DocumentNode` 树遍历，支持读取所有页面和图层
  - 支持读取图层属性：坐标、尺寸、颜色、文本内容、样式等
  - 支持 SVG 导出（`getSVGString`）
  - 支持 ImageData 获取（`getImageDataByHash`）
  - 支持资源管理（颜色资源、文本资源、图层资源、组件资源）
  - **限制**：沙箱环境，主线程无浏览器 API；需通过 iframe 进行网络通信
- **摹客3 平台**：宣称支持 "插件/Rest API"，但当前无公开 REST API 文档

### 2.3 Figma MCP 参考实现
- **Figma Desktop MCP Server**（官方）：通过本地 Figma 桌面应用插件获取设计数据
- **Figma-Context-MCP**（社区，GLips）：通过 Figma REST API 远程获取数据
- **架构模式**：MCP Server (stdio) ← WebSocket/HTTP → 设计工具插件/API

---

## 3. 架构设计

### 3.1 整体架构

```
┌──────────────────────────────────────────────────────────┐
│                    AI 客户端 (Cursor/Claude)               │
│                        stdio (JSON-RPC)                    │
├──────────────────────────────────────────────────────────┤
│                  Moke MCP Server (Node.js)                 │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ MCP 协议层   │  │  设计数据服务  │  │   CLI 工具模块   │  │
│  │ (Tools)     │  │  (Service)   │  │  (Commander)    │  │
│  └─────────────┘  └──────┬───────┘  └─────────────────┘  │
│                          │ WebSocket Server (port 19999)   │
└──────────────────────────┼───────────────────────────────┘
                           │ ws://127.0.0.1:19999
┌──────────────────────────┼───────────────────────────────┐
│              摹客 DT 编辑器 (浏览器)                        │
│  ┌───────────────────────┴──────────────────────────┐    │
│  │           Moke Bridge Plugin (摹客DT插件)          │    │
│  │  ┌──────────────┐  ┌─────────────────────────┐   │    │
│  │  │ 主线程        │  │  iframe (WebSocket       │   │    │
│  │  │ (Plugin API) │◄─►│   Client + UI)          │   │    │
│  │  │ 读取设计数据   │  │  message passing         │   │    │
│  │  └──────────────┘  └─────────────────────────┘   │    │
│  └──────────────────────────────────────────────────┘    │
│                     摹客 DT 文档数据                       │
└──────────────────────────────────────────────────────────┘
```

### 3.2 核心设计决策

1. **Plugin Bridge 模式**：由于摹客无公开 REST API，采用插件桥接模式（与 Figma Desktop MCP Server 同架构）
2. **WebSocket 通信**：DT 插件主线程通过 iframe 内的 WebSocket Client 与本地 MCP Server 通信
3. **Node.js + TypeScript**：MCP Server 使用 `@modelcontextprotocol/sdk` + TypeScript
4. **CLI 工具**：使用 Commander.js 实现命令行工具（`moke-mcp init/serve/config`）
5. **Monorepo 结构**：pnpm workspace 管理多包

---

## 4. 技术栈

| 组件 | 技术 | 版本要求 |
|---|---|---|
| 运行时 | Node.js | >= 18 |
| 语言 | TypeScript | >= 5.0 |
| 包管理 | pnpm | >= 8 |
| MCP SDK | @modelcontextprotocol/sdk | latest |
| WebSocket | ws (Node.js 端) | latest |
| CLI 框架 | commander | latest |
| Schema 校验 | zod | latest |
| 构建工具 | tsup | latest |
| 测试框架 | vitest | latest |
| 插件前端 | vanilla HTML/JS + iframe | - |

---

## 5. 项目文件结构

```
MOKE_MCP/
├── package.json                    # workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .gitignore
├── README.md
│
├── packages/
│   ├── server/                     # MCP Server 核心包
│   │   ├── package.json            # 包名: @moke-mcp/server
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts            # 入口：启动 WebSocket + MCP Server
│   │   │   ├── mcp/
│   │   │   │   ├── server.ts       # MCP Server 初始化 & 工具注册
│   │   │   │   └── tools/          # 各 Tool 实现
│   │   │   │       ├── get-design-context.ts
│   │   │   │       ├── get-metadata.ts
│   │   │   │       ├── get-screenshot.ts
│   │   │   │       ├── get-variable-defs.ts
│   │   │   │       ├── download-design-images.ts
│   │   │   │       ├── get-design-data.ts
│   │   │   │       └── create-design-system-rules.ts
│   │   │   ├── bridge/
│   │   │   │   ├── ws-server.ts    # WebSocket 服务端
│   │   │   │   └── protocol.ts     # Bridge 协议定义（请求/响应类型）
│   │   │   ├── services/
│   │   │   │   ├── design-context.service.ts   # 设计上下文转换
│   │   │   │   ├── metadata.service.ts         # 元数据提取
│   │   │   │   ├── screenshot.service.ts       # 截图处理
│   │   │   │   ├── code-gen.service.ts         # 代码生成（React/Vue + Tailwind/CSS）
│   │   │   │   └── variable-extract.service.ts # 变量提取
│   │   │   ├── types/
│   │   │   │   ├── bridge.ts        # Bridge 消息类型
│   │   │   │   ├── design.ts        # 设计数据中间表示（IR）
│   │   │   │   └── code-gen.ts      # 代码生成选项类型
│   │   │   └── utils/
│   │   │       ├── logger.ts
│   │   │       └── error-handler.ts
│   │   └── tests/
│   │       ├── tools/
│   │       └── services/
│   │
│   ├── cli/                         # CLI 工具包
│   │   ├── package.json             # 包名: @moke-mcp/cli, bin: moke-mcp
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts             # CLI 入口
│   │       ├── commands/
│   │       │   ├── init.ts          # moke-mcp init: 初始化项目配置
│   │       │   ├── serve.ts         # moke-mcp serve: 启动 MCP Server
│   │       │   └── config.ts        # moke-mcp config: 管理配置
│   │       └── utils/
│   │           └── config-file.ts   # 配置文件的读/写/校验
│   │
│   └── plugin/                      # 摹客 DT 插件包
│       ├── package.json             # 包名: @moke-mcp/plugin
│       ├── mockplus-plugin.json     # 摹客插件清单 (manifest)
│       ├── src/
│       │   ├── main.ts              # 插件主线程入口
│       │   ├── bridge/
│       │   │   ├── client.ts        # WebSocket 客户端（iframe 内运行）
│       │   │   └── protocol.ts      # 协议定义（复用 server 端类型）
│       │   ├── readers/
│       │   │   ├── document-reader.ts    # DocumentNode 遍历
│       │   │   ├── layer-reader.ts       # 图层属性读取
│       │   │   ├── style-reader.ts       # 样式/资源读取
│       │   │   └── screenshot-reader.ts  # 截图/SVG 导出
│       │   ├── ui/
│       │   │   ├── index.html       # 插件面板 UI
│       │   │   └── styles.css
│       │   └── types/
│       │       └── mockplus.d.ts    # 摹客 Plugin API 类型声明
│       └── build/                   # 构建输出（用于插件加载）
│
└── docs/
    └── api.md                       # API 文档
```

---

## 6. 分阶段实施计划

### Phase 1：基础设施搭建（P0）

**目标**：建立 monorepo、MCP Server 骨架、WebSocket Bridge、插件骨架

#### Step 1.1：初始化 monorepo
- 文件：`package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`
- 配置 pnpm workspace，创建 `packages/server`, `packages/cli`, `packages/plugin` 子包

#### Step 1.2：MCP Server 核心骨架
- 文件：`packages/server/src/index.ts`, `packages/server/src/mcp/server.ts`
- 使用 `@modelcontextprotocol/sdk` 初始化 `McpServer`
- 注册一个简单的 `ping` 工具验证 MCP 协议通信
- 实现 `StdioServerTransport` 连接

#### Step 1.3：WebSocket Bridge 通信层
- 文件：`packages/server/src/bridge/ws-server.ts`, `packages/server/src/bridge/protocol.ts`
- 定义 Bridge 协议消息类型：
  ```typescript
  // 请求类型
  type BridgeRequest =
    | { type: 'getDocument' }
    | { type: 'getNode'; nodeId: string }
    | { type: 'getScreenshot'; nodeId: string; format: 'png' | 'svg' }
    | { type: 'getVariables' }
    | { type: 'getStyles' }

  // 响应类型
  type BridgeResponse =
    | { type: 'document'; data: DocumentIR }
    | { type: 'node'; data: NodeIR }
    | { type: 'screenshot'; data: string; format: 'png' | 'svg' }
    | { type: 'variables'; data: VariableIR[] }
    | { type: 'styles'; data: StyleIR[] }
    | { type: 'error'; message: string }
  ```
- 文件：`packages/server/src/types/bridge.ts`, `packages/server/src/types/design.ts`
- 定义设计数据中间表示（IR），作为 MCP Server 和插件之间的标准数据格式

#### Step 1.4：CLI 工具骨架
- 文件：`packages/cli/src/index.ts`
- 使用 `commander` 实现基本 CLI 命令：
  ```bash
  moke-mcp init     # 初始化 .moke-mcp.json 配置
  moke-mcp serve    # 启动 MCP Server + WebSocket Bridge
  moke-mcp --help   # 帮助信息
  moke-mcp --version # 版本信息
  ```
- 文件：`packages/cli/src/commands/init.ts`, `packages/cli/src/commands/serve.ts`
- 文件：`packages/cli/src/utils/config-file.ts`（配置文件管理）

#### Step 1.5：摹客 DT 插件骨架
- 文件：`packages/plugin/mockplus-plugin.json`（插件清单）
- 文件：`packages/plugin/src/main.ts`（主线程入口）
- 文件：`packages/plugin/src/types/mockplus.d.ts`（Plugin API 类型声明，基于已获取的文档）
- 文件：`packages/plugin/src/bridge/client.ts`（iframe 内 WebSocket 客户端）
- 文件：`packages/plugin/src/ui/index.html`（简单 UI：连接状态、手动触发）
- 实现基本的 WS 连接和 ping/pong 心跳

**验证**：
- `pnpm install` 成功
- `moke-mcp serve` 启动后 MCP Inspector 可连接
- 插件加载后可建立 WebSocket 连接并收到 pong

---

### Phase 2：核心数据读取（P0）

**目标**：实现从摹客 DT 读取设计数据并通过 MCP Tools 暴露

#### Step 2.1：文档节点读取器
- 文件：`packages/plugin/src/readers/document-reader.ts`
- 从 `mockplus.root` 遍历 DocumentNode，获取所有 Page 和 Layer 树
- 递归读取节点属性：id, name, type, children, visible, locked

#### Step 2.2：图层属性读取器
- 文件：`packages/plugin/src/readers/layer-reader.ts`
- 读取各类图层属性：
  - 基础：x, y, width, height, rotation, opacity
  - 填充：fills (color, gradient, image fill)
  - 边框：strokes, strokeWeight, strokeAlign
  - 效果：effects (shadow, blur)
  - 文本：characters, fontSize, fontName, lineHeight, textAlign
  - 圆角：cornerRadius
  - 布局：layoutMode, padding, itemSpacing (Auto Layout)

#### Step 2.3：样式/变量读取器
- 文件：`packages/plugin/src/readers/style-reader.ts`
- 读取：SharedColorStyle, SharedTextStyle, SharedLayerStyle, SharedSymbolStyle
- 通过 `mockplus.libraries` 和资源的 `findResourceById` 获取

#### Step 2.4：MCP Tool：get_metadata
- 文件：`packages/server/src/mcp/tools/get-metadata.ts`
- 参数：`{ nodeId?: string }`（可选，默认当前选中节点或根节点）
- 返回：XML 格式的节点层级树（仅 id, name, type, bounds）
- 参考 Figma MCP `get_metadata` 的输出格式

#### Step 2.5：MCP Tool：get_design_context
- 文件：`packages/server/src/services/design-context.service.ts`
- 文件：`packages/server/src/mcp/tools/get-design-context.ts`
- 参数：`{ nodeId?: string, format?: 'yaml' | 'json' }`
- 返回：完整设计上下文数据，包含：
  - 节点树及属性
  - 样式信息
  - 组件实例信息
- 数据简化策略：过滤冗余属性，只保留代码生成相关

#### Step 2.6：MCP Tool：get_design_data（别名）
- 文件：`packages/server/src/mcp/tools/get-design-data.ts`
- 等同于 `get_design_context`，完全兼容 Figma MCP 命名习惯

**验证**：
- 打开摹客 DT 设计文件，通过 MCP Inspector 调用 `get_metadata` 可获取 XML 层级
- 调用 `get_design_context` 可获取含样式的完整 JSON/YAML 数据
- 对比 Figma MCP 的输出格式一致性

---

### Phase 3：视觉输出 + 代码生成（P1）

#### Step 3.1：截图功能实现
- 文件：`packages/plugin/src/readers/screenshot-reader.ts`
- 通过 `getSVGString` 获取 SVG，通过 `getImageDataByHash` + Canvas 转 PNG
- 文件：`packages/server/src/services/screenshot.service.ts`
- 文件：`packages/server/src/mcp/tools/get-screenshot.ts`
- 参数：`{ nodeId: string, format?: 'png' | 'svg' }`
- 返回：base64 编码的图片数据

#### Step 3.2：切图下载功能
- 文件：`packages/server/src/mcp/tools/download-design-images.ts`
- 参数：`{ nodeIds: string[], format?: 'png' | 'svg', outputDir?: string }`
- 通过 Bridge 获取切图数据，保存到本地文件系统

#### Step 3.3：Design Tokens 提取
- 文件：`packages/server/src/services/variable-extract.service.ts`
- 文件：`packages/server/src/mcp/tools/get-variable-defs.ts`
- 提取颜色变量、字体变量、间距变量
- 返回结构化 Design Token JSON，可映射为 CSS 变量

#### Step 3.4：代码生成服务
- 文件：`packages/server/src/services/code-gen.service.ts`
- 文件：`packages/server/src/types/code-gen.ts`
- 将设计 IR 转换为前端代码，支持：
  - **框架**：React, Vue
  - **样式方案**：Tailwind CSS, CSS Modules, Styled Components
  - 输出：结构化代码块（JSX/Vue SFC + 样式）
- 设计→代码映射策略：
  - Frame → div / View
  - Text → span / p / h1-h6 / Text
  - Rectangle → div (background)
  - Image → img / Image
  - Auto Layout → flexbox (解析 layoutMode, padding, itemSpacing)
  - 颜色填充 → background-color / color
  - 文本样式 → font-size, font-weight, line-height
  - 圆角 → border-radius

**验证**：
- `get_screenshot` 返回有效的 base64 PNG 可渲染查看
- `get_variable_defs` 返回颜色/字体 CSS 变量定义
- `get_design_context` 的响应中包含 React+Tailwind 代码建议

---

### Phase 4：高级功能 + CLI 完善（P2）

#### Step 4.1：设计系统规则生成
- 文件：`packages/server/src/mcp/tools/create-design-system-rules.ts`
- 基于提取的变量和组件，生成 Markdown/JSON 格式的设计规范文档
- 包含：颜色调色板、字体层级、间距系统、组件映射表

#### Step 4.2：CLI 配置管理
- 文件：`packages/cli/src/commands/config.ts`
- 子命令：
  ```bash
  moke-mcp config set wsPort 19999
  moke-mcp config set codeGen.framework react
  moke-mcp config set codeGen.styleLibrary tailwind
  moke-mcp config show
  ```
- 配置文件格式（`.moke-mcp.json`）：
  ```json
  {
    "wsPort": 19999,
    "codeGen": {
      "framework": "react",
      "styleLibrary": "tailwind",
      "typescript": true
    },
    "output": {
      "imageFormat": "png",
      "imageScale": 2
    }
  }
  ```

#### Step 4.3：CLI init 命令完善
- 在目标项目中生成 `.moke-mcp.json` + MCP 客户端配置片段
- 支持交互式问答选择配置项

#### Step 4.4：错误处理与日志
- 文件：`packages/server/src/utils/error-handler.ts`
- 文件：`packages/server/src/utils/logger.ts`
- 统一错误处理：Bridge 超时、插件断连、数据读取失败
- stderr 日志（MCP stdio 规范要求）

**验证**：
- `moke-mcp init` 在目标项目生成正确配置
- `create_design_system_rules` 返回 Markdown 格式规范文档
- 异常场景有友好的错误提示

---

### Phase 5：构建、测试与发布（P2）

#### Step 5.1：构建配置
- 使用 `tsup` 构建 `packages/server` 和 `packages/cli`
- 插件使用简单的构建脚本（bundle JS + 复制 HTML）
- 配置 `package.json` 的 `bin` 和 `main` 字段

#### Step 5.2：单元测试
- 文件：`packages/server/tests/**`
- 使用 `vitest` 测试：
  - Bridge 协议消息序列化/反序列化
  - 设计 IR 转换逻辑
  - 代码生成映射（给定 mock 数据，验证输出代码结构）

#### Step 5.3：MCP 配置模板
- 在 README 中提供常见 AI 客户端的 MCP 配置示例：
  - Cursor: `~/.cursor/mcp.json`
  - Claude Desktop: `claude_desktop_config.json`
  - VS Code Copilot: `.vscode/mcp.json`

#### Step 5.4：npm 发布
- `@moke-mcp/server` 发布到 npm
- `@moke-mcp/cli` 发布到 npm（主入口，npx 可执行）
- 插件通过摹客插件市场分发，或提供本地加载方式

---

## 7. Bridge 协议详细设计

### 7.1 消息格式

```typescript
interface BridgeMessage {
  id: string;          // UUID，用于请求-响应匹配
  type: 'request' | 'response' | 'event';
  payload: BridgeRequest | BridgeResponse | BridgeEvent;
}

// 插件 → Server 响应
interface NodeDataResponse {
  id: string;
  name: string;
  type: 'DOCUMENT' | 'PAGE' | 'FRAME' | 'GROUP' | 'TEXT'
       | 'RECTANGLE' | 'ELLIPSE' | 'IMAGE' | 'LINE'
       | 'SYMBOL_MASTER' | 'SYMBOL_INSTANCE' | 'SLICE' | 'HOTSPOT';
  children?: NodeDataResponse[];
  bounds: { x: number; y: number; width: number; height: number };
  fills?: FillData[];
  strokes?: StrokeData[];
  effects?: EffectData[];
  textData?: TextData;
  cornerRadius?: number;
  opacity?: number;
  visible?: boolean;
  componentId?: string;    // 组件实例关联的主组件 ID
}
```

### 7.2 设计 IR（中间表示）

设计 IR 是 MCP Server 和 DT Plugin 之间的标准数据格式，与摹客 Plugin API 解耦：

- `DocumentIR`：文档根节点，包含 pages 数组
- `NodeIR`：通用节点，包含完整属性
- `StyleIR`：颜色/文本/图层样式
- `VariableIR`：Design Token 变量
- `ScreenshotIR`：截图（base64 或 buffer）

这层抽象使得未来如果摹客开放 REST API，可以无缝切换数据源。

---

## 8. 预设与假设

| 项目 | 决策 | 理由 |
|---|---|---|
| 语言 | TypeScript | MCP SDK 原生支持，生态好 |
| 通信方式 | WebSocket | DT 插件可通过 iframe 建连，低延迟双向通信 |
| MCP 传输 | stdio | 标准 MCP 传输方式，兼容所有客户端 |
| Monorepo | pnpm workspace | 管理 server/cli/plugin 三个包的依赖 |
| 插件 UI | 最简 HTML | 只需连接状态和调试信息 |
| 代码生成 | React/Vue + Tailwind | 对齐 Figma MCP 默认输出格式 |
| 数据简化 | 仅保留布局/样式 | 参考 Figma-Context-MCP 的噪声过滤策略 |
| 安全 | 仅监听 127.0.0.1 | 本地 loopback，无外部暴露 |

### 已知限制
1. **插件必须运行**：需要摹客 DT 编辑器打开目标设计文件
2. **无远程 API**：无法像 Figma REST API 那样远程访问（等待摹客开放）
3. **沙箱限制**：插件内网络请求必须通过 iframe，主线程无法直接 HTTP
4. **无 Write 能力**：第一阶段不实现像 Figma MCP 的 "Write to Canvas"，专注读取

---

## 9. 验证步骤

### 阶段验证
1. **Phase 1 验证**：`moke-mcp serve` 启动 → MCP Inspector 连接 → ping/pong 通过
2. **Phase 2 验证**：打开摹客设计文件 → `get_metadata` 返回节点树 → `get_design_context` 返回完整设计数据
3. **Phase 3 验证**：`get_screenshot` 返回可渲染截图 → `get_variable_defs` 返回 Token → 代码生成输出合理前端代码
4. **Phase 4 验证**：`moke-mcp init` 生成配置 → CLI 配置读写正常
5. **端到端验证**：在 Cursor 中配置 Moke MCP → 粘贴摹客设计稿链接 → AI 生成符合设计的 React+Tailwind 代码

### 与 Figma MCP 对比验收
- [ ] `get_design_context` 输出格式与 Figma MCP 一致
- [ ] `get_metadata` XML 层级结构一致
- [ ] `get_screenshot` 图片质量达标
- [ ] 代码生成映射准确率 >= 85%
