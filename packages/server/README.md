# @moke-mcp/server

Moke MCP Server —— 基于 MCP 协议，将摹客设计数据暴露为 AI 编码助手可消费的 Tools。对标 Figma MCP，支持设计上下文获取、截图、Design Token 提取、切图下载、代码生成和设计系统规范输出。

## 架构

```
AI Client (Trae/Cursor/Claude)
  │ stdio (MCP Protocol)
  ▼
@moke-mcp/server          ← 本包
  │ child_process
  ▼
mockplus.py (Python)      ← mockplus-context 脚本
  │ HTTP + Cookie
  ▼
app.mockplus.cn REST API  ← 摹客云服务
```

## MCP Tools（7 个）

| Tool | 功能 | 输入 | 输出 |
|------|------|------|------|
| `get_metadata` | 获取页面/分组 XML 层级树 | 摹客 DT URL | XML 文档 |
| `get_design_context` | 获取结构化设计数据 | URL + format (yaml/json) | YAML / JSON |
| `get_screenshot` | 整页 @2x 截图 | URL | base64 PNG |
| `get_variable_defs` | Design Token 提取 | URL | 颜色/字体/间距/效果变量列表 |
| `download_design_images` | 切图下载 | URL + imageRef 列表 | 本地 PNG/SVG 文件 |
| `get_design_data` | get_design_context 别名 | URL + format | YAML / JSON |
| `create_design_system_rules` | 设计系统规范文档 | URL + framework + styleLibrary | Markdown |

## 安装

```bash
npm install @moke-mcp/server
```

## 编程方式使用

```typescript
import { startServer } from '@moke-mcp/server';

// 启动 MCP Server（stdio 传输）
await startServer();

// 优雅退出
process.on('SIGINT', async () => {
  process.exit(0);
});
```

## 环境变量

| 变量 | 说明 | 必填 |
|------|------|------|
| `MOKE_COOKIE` | 摹客登录 Cookie | 是 |

> Cookie 获取：浏览器登录 app.mockplus.cn → F12 → Application → Cookies → 复制全部 `name=value`，用 `; ` 连接。有效期约 30 天。

## 数据格式

### YAML（AI 优化格式）

经过 token 去重和包含树重建的蒸馏 YAML：

```yaml
metadata:
  name: 页面名称
  pageId: xxxx
  device: ios2x
  size: { width: 750, height: 1666 }
nodes:
  - id: 50419786
    name: 卡片背景
    type: FRAME
    pos: {x: 0, y: 0, w: 750, h: 1666}
    fills: fill_000001
    children:
      - id: ab2eb0a5
        name: 标题文本
        type: TEXT
        text: "Hello"
        textStyle: textStyle_000001
globalVars:
  styles:
    fill_000001: ["#FFFFFF"]
    textStyle_000001:
      fontFamily: PingFang SC
      fontSize: 30
      fontWeight: Bold
_meta:
  distilled: true
```

关键特性：
- **包含树重建**：平级兄弟节点按视觉包含重新嵌套，`locationRelativeToParent` 为真实相对父坐标（蒸馏后内联为 `pos`）
- **Token 去重**：相同 fill/layout/effect 自动引用同一 token key
- **蒸馏压缩**：layout 查找表内联、UUID 截断为前 8 位，平均减少约 49% 的 data volume（实测 8 个页面）

## 依赖

- `@modelcontextprotocol/sdk` >= 1.0 — MCP 协议 SDK
- Python 3 — 通过 child_process 调用 mockplus-context 脚本

## License

MIT
