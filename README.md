# MOKE MCP

将**摹客（Mockplus）设计数据**接入 AI 编码助手的 MCP Server。对标 Figma MCP，实现设计到代码的自动化工作流。

- Node.js >= 18 | Python 3 | [MIT License](./LICENSE)

## 功能特性

| 能力 | MCP Tool | 说明 |
|---|---|---|
| 元数据 | `get_metadata` | 获取页面/分组层级树（XML 格式） |
| 设计上下文 | `get_design_context` | 完整设计数据（YAML/JSON），含布局、样式、颜色、排版 |
| 截图 | `get_screenshot` | 整页 @2x PNG 截图（base64） |
| 设计变量 | `get_variable_defs` | Design Token 提取（颜色、字体、间距） |
| 切图下载 | `download_design_images` | 按需下载 PNG/SVG 切图到本地 |
| 设计数据 | `get_design_data` | `get_design_context` 别名（兼容 Figma MCP） |
| 设计规范 | `create_design_system_rules` | 生成 Tailwind/CSS 设计系统 Markdown 文档 |

**设计数据经过：** 包含树重建 → 坐标相对化 → Token 去重 → 机械蒸馏，AI 可直接消费。

> 代码生成（`code_gen`）当前不对外提供，推荐由大模型直接分析设计稿数据生成目标平台代码（如 Swift/React 等），效果更佳。

---

## 前置要求

- **Node.js** >= 18
- **Python 3**（数据转换脚本依赖）

```bash
# macOS
brew install python3

# 验证
python3 --version
```

---

## 安装

### 方式 1：npx 一键使用（推荐）

无需安装，直接运行：

```bash
npx @moke-mcp/cli serve
```

### 方式 2：全局安装

```bash
npm install -g @moke-mcp/cli
moke-mcp serve
```

### 方式 3：本地开发

```bash
git clone git@github.com:your-org/MOKE_MCP.git
cd MOKE_MCP
cd packages/server && npm install && npm run build && cd ../..
cd packages/cli && npm install && npm run build && cd ../..
node packages/cli/dist/index.js serve
```

---

## 配置 Cookie（首次使用必须）

摹客 API 需要浏览器 Cookie 认证，有效期约 30 天。

### 获取 Cookie

1. 浏览器打开 [app.mockplus.cn](https://app.mockplus.cn) 并登录
2. 按 `F12` → **Application** → **Cookies** → `app.mockplus.cn`
3. 复制所有 cookie，格式为 `name=value`，用 `; ` 连接

   ```
   token=xxxxx; JSESSIONID=yyyyy; _ga=zzzzz
   ```

### 配置方式（三选一，按优先级）

#### 方式 1：环境变量（推荐，Agent 中直接设置）

```bash
export MOKE_COOKIE="token=xxx; JSESSIONID=yyy; ..."
```

在 AI 编辑器的 MCP 配置中也可直接写入 `env` 字段（见下方编辑器配置）。

#### 方式 2：CLI 交互式

```bash
moke-mcp cookie set
# 粘贴 cookie → 回车 → Ctrl+D 完成
```

#### 方式 3：手动文件

```bash
mkdir -p ~/.config/mockplus
echo "你的cookie" > ~/.config/mockplus/cookie
chmod 600 ~/.config/mockplus/cookie
```

### 验证配置

```bash
moke-mcp cookie status
```

---

## 快速开始

```bash
# 1. 配置 Cookie
export MOKE_COOKIE="你的cookie"

# 2. 启动 Server
npx @moke-mcp/cli serve

# 3. 在 AI 编辑器中配置 MCP（见下方各编辑器 JSON）
# 4. 在 AI 对话中粘贴摹客设计稿 URL 即可
```

---

## AI 编辑器 MCP 配置

### Trae（字节跳动 AI IDE）

Trae MCP 配置文件位于项目目录的 `.trae/mcp.json`：

```json
{
  "mcpServers": {
    "moke-mcp": {
      "command": "npx",
      "args": ["-y", "@moke-mcp/cli", "serve"],
      "env": {
        "MOKE_COOKIE": "你的cookie"
      }
    }
  }
}
```

配置后在 Trae 中直接发送摹客设计稿 URL，AI 即可读取设计数据。

### Cursor

配置文件：`.cursor/mcp.json`（项目根目录下）

```json
{
  "mcpServers": {
    "moke-mcp": {
      "command": "npx",
      "args": ["-y", "@moke-mcp/cli", "serve"],
      "env": {
        "MOKE_COOKIE": "你的cookie"
      }
    }
  }
}
```

配置后重启 Cursor，在 Composer 中粘贴摹客 URL 即可使用。

### Claude Desktop

配置文件路径：

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "moke-mcp": {
      "command": "npx",
      "args": ["-y", "@moke-mcp/cli", "serve"],
      "env": {
        "MOKE_COOKIE": "你的cookie"
      }
    }
  }
}
```

配置后重启 Claude Desktop，在对话中粘贴摹客 URL 即可。

### VS Code Copilot

配置文件：`.vscode/mcp.json`（项目根目录下）

```json
{
  "servers": {
    "moke-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@moke-mcp/cli", "serve"],
      "env": {
        "MOKE_COOKIE": "你的cookie"
      }
    }
  }
}
```

配置后打开 VS Code Copilot Chat，使用 Agent 模式粘贴摹客 URL。

### Qoder（阿里灵码）

配置文件：`.qoder/mcp.json`（项目根目录下）

```json
{
  "mcpServers": {
    "moke-mcp": {
      "command": "npx",
      "args": ["-y", "@moke-mcp/cli", "serve"],
      "env": {
        "MOKE_COOKIE": "你的cookie"
      }
    }
  }
}
```

配置后在灵码对话中粘贴摹客 URL 即可。

---

## MCP Tools 参考

### get_metadata

获取设计文件的页面/分组层级树。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `url` | string | ✅ | 摹客设计稿 URL |

```text
用户：看看这个设计稿有哪些页面
https://app.mockplus.cn/app/xxx/develop/design/yyy
```

### get_design_context

获取完整设计上下文，返回结构化 YAML（含节点树、样式、布局、文本）。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `url` | string | ✅ | 摹客设计稿 URL |
| `format` | `"yaml"` \| `"json"` | ❌ | 输出格式，默认 `yaml` |

```text
用户：把这个设计稿还原成 Vue 组件
https://app.mockplus.cn/app/xxx/develop/design/yyy
```

### get_screenshot

获取整页 @2x PNG 截图（base64 编码）。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `url` | string | ✅ | 摹客设计稿 URL |

```text
用户：给我看看这个页面的截图
https://app.mockplus.cn/app/xxx/develop/design/yyy
```

### get_variable_defs

提取设计文件中的 Design Token（颜色、字体、间距等）。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `url` | string | ✅ | 摹客设计稿 URL |

```text
用户：提取这个设计稿的颜色和字体变量
https://app.mockplus.cn/app/xxx/develop/design/yyy
```

### download_design_images

下载切图资源（PNG/SVG）到本地目录。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `url` | string | ✅ | 摹客设计稿 URL |
| `imageRefs` | string[] | ✅ | 切图 hash 列表（从 globalVars.styles 中提取 type: IMAGE 的 imageRef） |
| `outputDir` | string | ❌ | 输出目录，默认 `./mockplus-assets` |

```text
用户：把这个页面的所有切图下载到 ./assets 目录
https://app.mockplus.cn/app/xxx/develop/design/yyy
```

### get_design_data

`get_design_context` 的别名，兼容 Figma MCP 命名习惯。参数同上。

### create_design_system_rules

基于 Design Token 生成设计系统规范文档。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `url` | string | ✅ | 摹客设计稿 URL |
| `framework` | `"react"` \| `"vue"` | ❌ | 目标框架，默认 `react` |
| `styleLibrary` | `"tailwind"` \| `"css-modules"` \| `"styled-components"` | ❌ | 样式方案，默认 `tailwind` |

```text
用户：基于这个设计稿生成 Tailwind 设计系统规范
https://app.mockplus.cn/app/xxx/develop/design/yyy
```

---

## CLI 命令参考

```bash
moke-mcp init             # 初始化项目配置（.moke-mcp.json）
moke-mcp serve            # 启动 MCP Server

# Cookie 管理
moke-mcp cookie set       # 交互式设置 Cookie
moke-mcp cookie status    # 查看 Cookie 状态
moke-mcp cookie clear     # 清除 Cookie
moke-mcp cookie guide     # 显示 Cookie 配置完整指南

# 配置管理
moke-mcp config show      # 显示当前配置
moke-mcp config set <key> <value>  # 设置配置项
```

---

## 工作流示例

### 示例 1：读取设计稿并生成代码

```text
你：把这个设计稿还原成 Vue 组件
   https://app.mockplus.cn/app/xxx/develop/design/yyy

AI：→ get_metadata  → 发现页面"首页"
   → get_design_context → 获取完整设计数据（YAML）
   → 分析节点树、颜色、字体、布局
   → 生成 Vue SFC 组件 + Tailwind 类名
```

### 示例 2：导出切图资源

```text
你：下载这个页面所有切图到 ./public/assets
   https://app.mockplus.cn/app/xxx/develop/design/yyy

AI：→ get_design_context → 扫描 globalVars 中 IMAGE fill 的 imageRef
   → download_design_images → 批量下载到指定目录
```

### 示例 3：生成设计系统规范

```text
你：为这个设计稿生成 Tailwind 配置和设计规范文档
   https://app.mockplus.cn/app/xxx/develop/design/yyy

AI：→ create_design_system_rules → 生成含颜色调色板、
   字体层级、Tailwind 配置的 Markdown 文档
```

---

## 项目结构

```
MOKE_MCP/
├── packages/
│   ├── server/             # MCP Server 核心包
│   │   └── src/
│   │       ├── api/        # HTTP 客户端（Python 子进程封装）
│   │       ├── mcp/        # MCP Tools 注册
│   │       └── services/   # 设计上下文/截图/变量提取/代码生成
│   └── cli/                # CLI 工具包
│       └── src/
│           └── commands/   # init / serve / config / cookie
├── scripts/
│   └── mockplus/           # Python 数据转换脚本（基于 mockplus-context）
└── .moke-mcp.json          # 项目配置文件
```

---

## 原理

```
AI Client (Trae/Cursor/Claude)
  │ stdio (MCP JSON-RPC)
  ▼
Moke MCP Server (Node.js)
  │ child_process.spawn('python3')
  ▼
mockplus-context scripts (Python)
  │ HTTP（Cookie 认证）
  ▼
app.mockplus.cn REST API + CDN
```

设计数据通过摹客 DT 的 Sketch JSON API 获取，经过 Python 脚本的包含树重建、坐标相对化和 Token 去重后，以结构化 YAML 形式返回给 AI。

---

## 常见问题

**Q: 提示 "Cookie 未配置" 怎么办？**

A: 运行 `moke-mcp cookie guide` 查看完整配置指南，或直接 `export MOKE_COOKIE="你的cookie"`。

**Q: Cookie 过期了怎么办？**

A: 重新从浏览器获取 cookie，运行 `moke-mcp cookie set` 或更新环境变量。有效期约 30 天。

**Q: 提示 "Python 3 未找到"？**

A: macOS 执行 `brew install python3`，或从 [python.org](https://www.python.org/downloads/) 下载安装。

**Q: 支持摹客 RP 吗？**

A: 当前仅支持摹客 DT（app.mockplus.cn），不支持摹客 RP（原型工具）。

**Q: 与 Figma MCP 的关系？**

A: Moke MCP 对标 Figma MCP 的工具集，输出格式兼容，但数据源为摹客 DT。详见 [Figma MCP 对比](./.trae/documents/moke-mcp-data-source-analysis.md)。

---

## 致谢

MOKE_MCP 的设计灵感来自以下两个优秀项目：

- **[mockplus-context](https://github.com/MySwallow/mockplus-context)** by [MySwallow](https://github.com/MySwallow) — Agent Skill 形式的摹客设计数据获取方案，其中 `mockplus.py` 脚本（REST API 调用、Cookie 认证、Sketch JSON 的 transform/distill 管线）被 MOKE_MCP 通过子进程方式复用，是数据获取的核心
- **[mockplus-rp-skill](https://github.com/Retohsaka/mockplus-rp-skill)** by [Retohsaka](https://github.com/Retohsaka) — 摹客 RP 原型工具的数据解析方案，为多产品线支持提供了参考思路

感谢两位作者的开源贡献。

---

## License

MIT
