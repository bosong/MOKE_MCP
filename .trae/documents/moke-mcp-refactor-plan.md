# MOKE_MCP 改造实施计划：Plugin Bridge → HTTP API

## 决策确认

| 问题 | 决策 |
|---|---|
| 1. 方案 A（mockplus-context API 方式） | **确认** |
| 2. 同时支持方案 B（RP） | **暂不需要** |
| 3. Cookie 认证 | **接受**：CLI `cookie set` + 环境变量 `MOKE_COOKIE` + 配置文件 `.moke-mcp.json` |
| 4. transform 逻辑实现 | **子进程调用 Python**：复用 mockplus-context 的 Python 脚本 |

---

## 1. 改造总览

```
改造前：
AI Client → MCP Server (stdio) ← WebSocket → DT Plugin → 摹客 DT 编辑器

改造后：
AI Client → MCP Server (stdio) ← child_process (Python) → app.mockplus.cn REST API
                              ← HTTP → app.mockplus.cn REST API + CDN
```

### 变更清单

| 操作 | 路径 | 说明 |
|---|---|---|
| **删除** | `packages/plugin/` | 不再需要摹客 DT 插件 |
| **删除** | `packages/server/src/bridge/` | 不再需要 WebSocket 桥接 |
| **删除** | `packages/server/src/types/bridge.ts` | Bridge 类型不再需要 |
| **删除** | `packages/server/src/types/design.ts` | 旧的 IR 类型定义替换 |
| **新增** | `packages/server/src/api/client.ts` | HTTP Client：调用 mockplus-context Python 脚本 |
| **新增** | `packages/server/src/api/types.ts` | 新的 API 数据类型定义 |
| **新增** | `packages/server/src/services/design-context.service.ts` | 设计上下文服务 |
| **新增** | `packages/server/src/services/screenshot.service.ts` | 截图服务 |
| **新增** | `packages/server/src/services/variable-extract.service.ts` | 变量提取服务 |
| **新增** | `packages/server/src/services/code-gen.service.ts` | 代码生成服务 |
| **修改** | `packages/server/src/mcp/server.ts` | Tool 实现改为基于 HTTP API |
| **修改** | `packages/server/src/index.ts` | 移除 WebSocket，改用 HTTP API |
| **修改** | `packages/server/src/utils/error-handler.ts` | 更新错误类型 |
| **修改** | `packages/cli/src/index.ts` | 新增 cookie 子命令 |
| **新增** | `packages/cli/src/commands/cookie.ts` | cookie 管理命令 |
| **修改** | `packages/cli/src/commands/serve.ts` | 不再启动 WebSocket |
| **修改** | `packages/cli/src/commands/init.ts` | 更新配置键 |
| **修改** | `packages/cli/src/utils/config-file.ts` | 移除 wsPort，新增 cookie 配置 |
| **修改** | `packages/server/package.json` | 移除 ws 依赖 |
| **修改** | `packages/cli/package.json` | 更新描述 |
| **修改** | `packages/server/tsconfig.json` | 路径更新 |
| **新增** | `scripts/` | Python 脚本目录（从 mockplus-context 抽取复用） |

---

## 2. 分步实施

### Step 1: 删除旧代码

删除不再需要的文件：
- `packages/plugin/` 整个目录
- `packages/server/src/bridge/` 整个目录
- `packages/server/src/types/bridge.ts`
- `packages/server/src/types/design.ts`

### Step 2: 新增 Python 脚本目录

在项目根创建 `scripts/mockplus/` 目录，复制 mockplus-context 的核心脚本：

```
scripts/mockplus/
├── mockplus.py          # argparse 入口
├── client.py            # API 客户端 + cookie + CDN
├── transform.py         # Sketch JSON → 结构化 YAML/JSON
└── distill.py           # 机械蒸馏（可选）
```

### Step 3: 新增 HTTP Client 层

创建 `packages/server/src/api/client.ts`：
- 封装 `child_process.spawn` 调用 `scripts/mockplus/mockplus.py`
- 实现以下方法：
  - `fetchPageTree(appId)` → `mockplus tree <APP_ID> --format json`
  - `fetchDesignData(url)` → `mockplus data <URL> --format json`
  - `fetchAllAssets(url, outDir)` → `mockplus all <URL> <OUT_DIR>`
  - `downloadImages(url, hashes)` → `mockplus download <URL> --nodes h1,h2`
  - `checkCookieStatus()` → `mockplus cookie status`
  - `setCookie(content)` → `mockplus cookie set`（通过 stdin 传入）

### Step 4: Cookie 管理实现

**4.1 配置来源优先级：**
1. 环境变量 `MOKE_COOKIE`（最高优先级，Agent 友好）
2. `~/.config/mockplus/cookie` 文件（Python 脚本默认路径）
3. `.moke-mcp.json` 中的 `cookieContent` 字段（项目级别）

**4.2 CLI 命令：**

```bash
moke-mcp cookie set              # 交互式设置 cookie（通过 stdin 传给 Python）
moke-mcp cookie status           # 检查 cookie 状态
moke-mcp cookie clear            # 清除 cookie
moke-mcp cookie show-path        # 显示 cookie 文件路径和使用说明
```

**4.3 Cookie 获取指引（show-path 命令输出）：**

```
📋 Cookie 配置方式（任选一种）：

方式1（推荐）：环境变量
export MOKE_COOKIE="你的完整cookie字符串"

方式2：Python 脚本管理（与 mockplus-context 共用）
moke-mcp cookie set  # 交互式输入

方式3：手动文件
将 cookie 写入 ~/.config/mockplus/cookie

─────────────────────────
如何获取 Cookie：
1. 浏览器打开 https://app.mockplus.cn 并登录
2. F12 → Application → Cookies → app.mockplus.cn
3. 复制所有 cookie 的 name=value，用 ; 连接
   示例: "token=xxx; session=yyy; ..."
```

### Step 5: 重构 MCP Tools

`packages/server/src/mcp/server.ts` 不再依赖 `BridgeServer`，改为依赖 `MockplusClient`：

| Tool | 改造前 | 改造后 |
|---|---|---|
| `get_metadata` | 通过 WS Bridge 获取节点 → 构建 XML | 调用 `client.fetchPageTree()` → 构建 XML |
| `get_design_context` | 通过 WS Bridge 获取节点 → JSON/YAML | 调用 `client.fetchDesignData()` → 返回 YAML/JSON |
| `get_screenshot` | 通过 WS Bridge 获取截图 | 调用 `client.fetchAllAssets()` → 读取 `design.png` → base64 |
| `get_variable_defs` | 通过 WS Bridge 获取变量 | 调用 `client.fetchDesignData()` → 提取 globalVars.styles |
| `download_design_images` | 通过 WS Bridge 逐个下载 | 调用 `client.downloadImages()` |
| `get_design_data` | 同 get_design_context | 同 get_design_context |
| `create_design_system_rules` | 基于变量生成 | 基于 design data 的 globalVars 生成 |

### Step 6: 重构 CLI

- 移除 `serve.ts` 中的 WebSocket 启动逻辑
- 新增 `cookie.ts` 子命令
- 更新 `init.ts` 中的配置项说明
- 更新 `config-file.ts` 的 Schema

### Step 7: 更新依赖和构建

- `packages/server/package.json`：移除 `ws`、`@types/ws` 依赖
- `packages/cli/package.json`：更新描述
- 根 `package.json`：移除 plugin 相关脚本
- 确保 `mockplus-context` 的 Python 脚本作为 bundled dependency

---

## 3. 文件结构（改造后）

```
MOKE_MCP/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .gitignore
│
├── scripts/
│   └── mockplus/                    # 从 mockplus-context 复制的 Python 脚本
│       ├── mockplus.py
│       ├── client.py
│       ├── transform.py
│       └── distill.py
│
├── packages/
│   ├── server/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── mcp/
│   │   │   │   └── server.ts
│   │   │   ├── api/
│   │   │   │   ├── client.ts        # Python 子进程调用封装
│   │   │   │   └── types.ts         # API 响应类型
│   │   │   ├── services/
│   │   │   │   ├── design-context.service.ts
│   │   │   │   ├── screenshot.service.ts
│   │   │   │   ├── variable-extract.service.ts
│   │   │   │   └── code-gen.service.ts
│   │   │   ├── types/
│   │   │   │   └── code-gen.ts
│   │   │   └── utils/
│   │   │       ├── logger.ts
│   │   │       └── error-handler.ts
│   │   └── tests/
│   │
│   └── cli/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── commands/
│           │   ├── init.ts
│           │   ├── serve.ts
│           │   ├── config.ts
│           │   └── cookie.ts         # 新增
│           └── utils/
│               └── config-file.ts
```

---

## 4. 关键设计细节

### 4.1 Python 子进程调用

```typescript
// packages/server/src/api/client.ts

import { spawn } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = path.resolve(__dirname, '../../../scripts/mockplus');

function runMockplus(args: string[], stdin?: string): Promise<{ stdout: string; stderr: string; code: number }> {
  const env = { ...process.env };
  // 如果设置了 MOKE_COOKIE 环境变量，优先使用
  if (process.env.MOKE_COOKIE) {
    env.MOCKPLUS_COOKIE = process.env.MOKE_COOKIE;
  }
  
  return new Promise((resolve, reject) => {
    const proc = spawn('python3', [path.join(SCRIPTS_DIR, 'mockplus.py'), ...args], {
      env,
      stdio: stdin ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
    });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });
    
    if (stdin) {
      proc.stdin.write(stdin);
      proc.stdin.end();
    }
    
    proc.on('close', (code) => resolve({ stdout, stderr, code: code ?? 0 }));
    proc.on('error', reject);
  });
}
```

### 4.2 URL 解析

```typescript
interface ParsedUrl {
  type: 'dt';        // 目前仅支持 DT
  appId: string;
  targetId?: string; // page ID，可选
}

function parseMockplusUrl(url: string): ParsedUrl {
  const m = url.match(/app\.mockplus\.cn\/app\/([^/?#]+)/);
  if (!m) throw new Error('无效的摹客 URL');
  const appId = m[1];
  const tail = url.replace(/[?#].*$/, '').split('/').pop();
  const targetId = (tail !== appId) ? tail : undefined;
  return { type: 'dt', appId, targetId };
}
```

### 4.3 错误处理

```typescript
// 错误码映射（复用 mockplus-context 退出码）
// 0  = 成功
// 2  = CLI 参数错
// 10 = cookie 未配置
// 11 = --from-file 文件不存在
// 12 = cookie 为空
// 14 = HTTP 层失败
// 15 = cookie test API 拒绝
// 21 = index API code != 0
// 22 = TARGET_ID 误判
```

### 4.4 配置文件更新

```json
// .moke-mcp.json 新结构
{
  "cookieContent": "",
  "cacheDir": "",
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
