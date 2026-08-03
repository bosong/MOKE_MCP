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

| 命令 | 说明 |
|------|------|
| `init` | 初始化项目配置，生成 `.moke-mcp.json` |
| `serve` | 启动 MCP Server（stdio 传输，供 AI 客户端调用） |
| `config` | 查看/管理配置文件 |
| `cookie set` | 交互式设置 Cookie |
| `cookie status` | 查看 Cookie 状态（路径、有效期） |
| `cookie clear` | 清除 Cookie |
| `cookie guide` | 显示 Cookie 获取教程 |

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
