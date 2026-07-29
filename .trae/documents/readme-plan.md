# README.md 编写计划

## 1. 目标

为 MOKE_MCP 项目创建完整的 README.md，包含安装方式、使用方式和主流 AI 编辑器的 MCP 配置方式。

## 2. README.md 结构

### 2.1 标题 + 简介
- 项目名称：Moke MCP
- 一句话描述：将摹客（Mockplus）设计数据接入 AI 编码助手的 MCP Server
- Badge：Node.js >= 18、Python 3、License MIT
- 对标说明：对标 Figma MCP，实现设计→代码工作流

### 2.2 功能特性
- 7 个 MCP Tools（get_metadata / get_design_context / get_screenshot / get_variable_defs / download_design_images / get_design_data / create_design_system_rules）
- 结构化 YAML 设计数据（经过包含树重建、坐标相对化、Token 去重）
- 整页 @2x 截图 + 切图下载
- Design Token 提取 + 设计系统规范生成
- Cookie 认证（环境变量，Agent 友好）

### 2.3 前置要求
- Node.js >= 18
- Python 3（brew install python3 或官网下载）

### 2.4 安装方式

#### 方式1：npx 一键使用（推荐）
```bash
npx @moke-mcp/cli serve
```

#### 方式2：全局安装
```bash
npm install -g @moke-mcp/server @moke-mcp/cli
moke-mcp serve
```

#### 方式3：本地开发
```bash
git clone <repo_url>
cd MOKE_MCP
npm install
npm run build
node packages/cli/dist/index.js serve
```

### 2.5 配置 Cookie（首次使用必须）
- 获取 Cookie 的步骤（浏览器 F12 → Application → Cookies → app.mockplus.cn）
- 三种配置方式：
  1. 环境变量（推荐，Agent 中直接设置）
  2. CLI 交互式：`moke-mcp cookie set`
  3. 手动文件：`~/.config/mockplus/cookie`

### 2.6 快速开始
- 典型工作流：Cookie 配置 → 启动 Server → 在 AI 客户端中配置 MCP → 粘贴摹客 URL

### 2.7 AI 编辑器 MCP 配置

按编辑器分别列出 JSON 配置：

- **Trae（字节跳动 AI IDE）**
  - 配置路径说明
  - JSON 示例（含 env.MOKE_COOKIE）

- **Cursor**
  - 配置路径：`.cursor/mcp.json`
  - JSON 示例

- **Claude Desktop**
  - 配置路径：`claude_desktop_config.json`
  - JSON 示例

- **VS Code Copilot**
  - 配置路径：`.vscode/mcp.json`
  - JSON 示例

- **Qoder（阿里灵码）**
  - 配置说明
  - JSON 示例

### 2.8 MCP Tools 参考
- 每个 Tool 的表格：名称、参数、描述、示例

### 2.9 CLI 命令参考
```bash
moke-mcp init          # 初始化项目配置
moke-mcp serve         # 启动 MCP Server
moke-mcp cookie set    # 设置 Cookie
moke-mcp cookie status # 查看 Cookie 状态
moke-mcp cookie guide  # 显示 Cookie 配置指南
moke-mcp config show   # 显示当前配置
moke-mcp config set    # 设置配置项
```

### 2.10 工作流示例
- 示例1：读取设计稿并生成代码
- 示例2：导出切图资源
- 示例3：生成设计系统规范

### 2.11 项目结构（简要）

### 2.12 License（MIT）
