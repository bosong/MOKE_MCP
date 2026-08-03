/**
 * moke-mcp serve 命令
 * 启动 MCP Server (通过 @moke-mcp/server 依赖启动)
 */

import { readConfig } from '../utils/config-file.js';
import { startServer } from '@moke-mcp/server';

export async function serveCommand(): Promise<void> {
  const config = readConfig();

  // 注意: 所有提示一律输出到 stderr, 避免污染 MCP stdio 的 stdout JSON-RPC 通道
  const banner = (msg: string) => console.error(msg);

  banner('🔌 启动 Moke MCP Server v0.2.0...');
  banner(`   数据源: HTTP API (app.mockplus.cn)`);
  banner(`   框架: ${config.codeGen.framework}`);
  banner(`   样式: ${config.codeGen.styleLibrary}`);
  banner('');

  // 检查 Cookie 配置
  if (process.env.MOKE_COOKIE) {
    banner('✅ 已检测到 MOKE_COOKIE 环境变量');
  } else {
    banner('💡 提示: 未设置 MOKE_COOKIE 环境变量');
    banner('   export MOKE_COOKIE="你的cookie"');
    banner('   或运行: moke-mcp cookie set');
    banner('');
  }

  // 直接通过依赖导入 startServer, 不再需要跨包路径 hack
  try {
    await startServer();
  } catch (err) {
    console.error('\n❌ 启动失败:', (err as Error).message);
    process.exit(1);
  }
}
