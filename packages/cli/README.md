# @moke-mcp/cli

摹客 MCP 命令行工具 —— 启动 Moke MCP Server，将摹客设计数据接入 AI 编码助手（Trae / Cursor / Claude Code / VS Code Copilot）。

## 安装

```bash
npm install -g @moke-mcp/cli
```

> `@moke-mcp/cli` 内置了 `@moke-mcp/server` 和 Python 脚本，安装后无需额外配置即可使用。

验证安装：

```bash
moke-mcp --help
```

## npx 免安装使用

无需全局安装，直接在 MCP 配置中使用 `npx`：

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

`npx -y` 会自动下载并缓存，首次使用稍慢，后续秒开。

## Cookie 配置

Moke MCP 通过摹客 REST API 获取设计数据，需要配置 Cookie 认证。支持三种方式：

### 方式 1：环境变量（推荐）

```bash
export MOKE_COOKIE="你的cookie"
```

### 方式 2：交互式配置

```bash
moke-mcp cookie set
```

### 方式 3：手动写入文件

将 Cookie 写入 `~/.config/mockplus/cookie`。

> 获取 Cookie：浏览器登录 app.mockplus.cn → F12 → Application → Cookies → 全选复制所有 `name=value`，用 `; ` 连接。

## 命令参考

### 核心命令

| 命令 | 说明 |
|------|------|
| `init` | 初始化项目配置，生成 `.moke-mcp.json` |
| `serve` | 启动 MCP Server（stdio 传输，供 AI 客户端调用） |
| `config` | 查看/管理配置文件 |

### Cookie 管理

| 命令 | 说明 |
|------|------|
| `cookie set` | 交互式设置 Cookie |
| `cookie status` | 查看 Cookie 状态（路径、有效期） |
| `cookie clear` | 清除 Cookie |
| `cookie guide` | 显示 Cookie 获取教程 |

### Tool 命令组（本地调用 MCP Tools）

无需 MCP 客户端，直接在终端调用 7 个 MCP Tools，适合调试和脚本集成。

| 命令 | 说明 |
|------|------|
| `tool get_metadata <url>` | 获取页面/分组 XML 层级树 |
| `tool get_design_context <url>` | 获取设计数据（YAML/JSON） |
| `tool get_screenshot <url>` | 获取整页 @2x 截图 |
| `tool get_variable_defs <url>` | 提取 Design Token |
| `tool download_design_images <url>` | 下载切图资源 |
| `tool get_design_data <url>` | `get_design_context` 别名 |
| `tool create_design_system_rules <url>` | 生成设计系统规范 |

#### Tool 选项

```bash
# get_design_context / get_design_data 选项
--format yaml|json     # 输出格式，默认 yaml
--raw                  # 输出未蒸馏原文（默认是蒸馏压缩后的数据）
-o, --out <path>       # 导出到文件

# get_screenshot 选项
-o, --output <path>    # PNG 保存路径
--base64               # 输出 base64 到 stdout

# download_design_images 选项
--refs <hash1,hash2>   # imageRef 列表（必填）
-o, --output <dir>     # 输出目录

# create_design_system_rules 选项
--framework react|vue  # 目标框架，默认 react
--style <style>        # 样式方案: tailwind|css-modules|styled-components
```

#### Tool 使用示例

```bash
# 查看页面树
moke-mcp tool get_metadata "https://app.mockplus.cn/app/xxx/develop/design/yyy"

# 获取设计数据并导出为 JSON
moke-mcp tool get_design_context "https://app.mockplus.cn/app/xxx/develop/design/yyy" \
  --format json -o design.json

# 获取截图
moke-mcp tool get_screenshot "https://app.mockplus.cn/app/xxx/develop/design/yyy" \
  -o ./preview.png

# 提取设计变量
moke-mcp tool get_variable_defs "https://app.mockplus.cn/app/xxx/develop/design/yyy"

# 生成 Tailwind 设计规范
moke-mcp tool create_design_system_rules "https://app.mockplus.cn/app/xxx/develop/design/yyy" \
  --framework react --style tailwind
```

## 快速开始

```bash
# 1. 配置 Cookie
export MOKE_COOKIE="你的cookie"

# 2. 启动 MCP Server
moke-mcp serve
```

## AI 编辑器 MCP 配置

### Trae

在项目根目录创建 `.trae/mcp.json`：

```json
{
  "mcpServers": {
    "moke-mcp": {
      "command": "moke-mcp",
      "args": ["serve"],
      "env": {
        "MOKE_COOKIE": "你的cookie"
      }
    }
  }
}
```

### Cursor

在项目根目录创建 `.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "moke-mcp": {
      "command": "moke-mcp",
      "args": ["serve"],
      "env": {
        "MOKE_COOKIE": "你的cookie"
      }
    }
  }
}
```

### VS Code Copilot

在项目根目录创建 `.vscode/mcp.json`：

```json
{
  "servers": {
    "moke-mcp": {
      "type": "stdio",
      "command": "moke-mcp",
      "args": ["serve"],
      "env": {
        "MOKE_COOKIE": "你的cookie"
      }
    }
  }
}
```

### Claude Desktop

编辑 Claude Desktop 配置文件：

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "moke-mcp": {
      "command": "moke-mcp",
      "args": ["serve"],
      "env": {
        "MOKE_COOKIE": "你的cookie"
      }
    }
  }
}
```

### Qoder（阿里灵码）

在项目根目录创建 `.qoder/mcp.json`：

```json
{
  "mcpServers": {
    "moke-mcp": {
      "command": "moke-mcp",
      "args": ["serve"],
      "env": {
        "MOKE_COOKIE": "你的cookie"
      }
    }
  }
}
```

配置完成后重启编辑器，AI 即可通过 7 个 MCP Tools 读取摹客设计数据。

## 前置要求

- Node.js >= 18
- Python 3（brew install python3）

## License

MIT
