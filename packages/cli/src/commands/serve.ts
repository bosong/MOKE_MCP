/**
 * moke-mcp serve 命令
 * 启动 MCP Server (通过 Python 子进程调用 mockplus-context)
 */

import { readConfig } from '../utils/config-file.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function serveCommand(): Promise<void> {
  const config = readConfig();

  console.log('🔌 启动 Moke MCP Server v0.2.0...');
  console.log(`   数据源: HTTP API (app.mockplus.cn)`);
  console.log(`   框架: ${config.codeGen.framework}`);
  console.log(`   样式: ${config.codeGen.styleLibrary}`);
  console.log('');

  // 检查 Cookie 配置
  if (process.env.MOKE_COOKIE) {
    console.log('✅ 已检测到 MOKE_COOKIE 环境变量');
  } else {
    console.log('💡 提示: 未设置 MOKE_COOKIE 环境变量');
    console.log('   export MOKE_COOKIE="你的cookie"');
    console.log('   或运行: moke-mcp cookie set');
    console.log('');
  }

  console.log('Moke MCP Server 就绪 - 请在 AI 客户端中配置 MCP Server');
  console.log('');
  console.log('配置示例 (Cursor / Claude Desktop / VS Code):');
  console.log('{');
  console.log('  "mcpServers": {');
  console.log('    "moke-mcp": {');
  console.log('      "command": "npx",');
  console.log('      "args": ["-y", "@moke-mcp/cli", "serve"],');
  console.log('      "env": {');
  console.log('        "MOKE_COOKIE": "你的cookie"');
  console.log('      }');
  console.log('    }');
  console.log('  }');
  console.log('}');

  // 动态导入 server 的 startServer
  try {
    const serverEntry = path.resolve(__dirname, '../../server/dist/index.js');
    const { startServer } = await import(serverEntry);
    await startServer();
  } catch (err) {
    console.error('\n❌ 无法启动 Server。请确保已安装 @moke-mcp/server。');
    console.error(`   ${(err as Error).message}`);
    console.error('   运行: npm install @moke-mcp/server');
    process.exit(1);
  }
}
