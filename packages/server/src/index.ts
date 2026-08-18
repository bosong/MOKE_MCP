/**
 * Moke MCP Server 入口
 * 通过 Python 子进程调用 mockplus-context 获取设计数据
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './mcp/server.js';
import { logger } from './utils/logger.js';
import { verifyPythonEnv } from './api/client.js';
import { getPackageVersion } from './utils/version.js';

export interface ServerOptions {
  /** 保留接口兼容性，不再需要 wsPort */
}

/** 本包版本号（取自 package.json，供 CLI/MCP serverInfo 展示） */
export const VERSION = getPackageVersion();

// ─── 工具执行所需导出（供 CLI 本地调用 MCP Tools 复用） ───
export {
  parseMockplusUrl,
  fetchDesignData,
  fetchDesignDataYaml,
  fetchPageTreeForMetadata,
  fetchAllAssets,
  downloadImages,
  verifyPythonEnv,
} from './api/client.js';
export { extractVariables, generateDesignSystemRules } from './services/variable-extract.service.js';
export { getDesignScreenshot } from './services/screenshot.service.js';
export { buildPageTreeXml } from './services/design-context.service.js';

/** 启动 Moke MCP Server */
export async function startServer(_options: ServerOptions = {}): Promise<void> {
  logger.info('══════════════════════════════════════');
  logger.info(`  Moke MCP Server v${VERSION}`);
  logger.info('  摹客设计数据 → AI 编码助手');
  logger.info('  数据源: HTTP API (mockplus-context)');
  logger.info('══════════════════════════════════════');

  // 验证 Python 环境
  logger.info('[Server] 检查 Python 环境...');
  const pythonOk = await verifyPythonEnv();
  if (!pythonOk) {
    logger.warn('[Server] 未检测到 Python 3，请确保已安装 Python 3');
    logger.warn('[Server] 安装: brew install python3 或 https://www.python.org/downloads/');
  } else {
    logger.info('[Server] Python 3 环境就绪');
  }

  // 检查 Cookie 配置
  if (process.env.MOKE_COOKIE) {
    logger.info('[Server] 已检测到 MOKE_COOKIE 环境变量');
  } else {
    logger.info('[Server] 未设置 MOKE_COOKIE 环境变量');
    logger.info('[Server] 可通过以下方式配置 Cookie:');
    logger.info('[Server]   export MOKE_COOKIE="你的cookie"');
    logger.info('[Server]   或运行: moke-mcp cookie set');
  }

  // 创建 MCP Server 并注册 Tools
  const mcpServer = createMcpServer();
  logger.info('[Server] MCP Tools 已注册');

  // 启动 stdio 传输
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  logger.info('[Server] MCP Server 已启动 (stdio)');
  logger.info('[Server] 等待 AI 客户端连接...');
}

/** 停止 Server */
export async function stopServer(): Promise<void> {
  logger.info('[Server] 正在关闭...');
}

// 优雅退出
process.on('SIGINT', async () => {
  logger.info('[Server] 收到 SIGINT，正在退出...');
  await stopServer();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('[Server] 收到 SIGTERM，正在退出...');
  await stopServer();
  process.exit(0);
});

// ─── 自启动守护 ──────────────────────────────────────────
// 当本文件作为入口被直接执行 (node dist/index.js) 时自动启动 Server。
// 通过 import.meta.url 与 process.argv[1] 比对判断，避免被其他模块 import 时重复启动。
const invokedAsEntry =
  typeof import.meta.url === 'string' &&
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1]);

if (invokedAsEntry) {
  startServer().catch((err) => {
    logger.error('[Server] 启动失败:', err);
    process.exit(1);
  });
}
