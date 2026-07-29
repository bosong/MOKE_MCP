/**
 * moke-mcp init 命令
 * 初始化项目配置
 */

import { getDefaultConfig, writeConfig, generateMCPClientConfig, readConfig } from '../utils/config-file.js';
import * as fs from 'fs';
import * as path from 'path';

export function initCommand(projectDir: string = process.cwd()): void {
  console.log('🚀 初始化 Moke MCP 项目配置...\n');

  const configPath = path.join(projectDir, '.moke-mcp.json');
  if (fs.existsSync(configPath)) {
    console.log('⚠️  .moke-mcp.json 已存在，当前配置:');
    const existing = readConfig(projectDir);
    console.log(JSON.stringify(existing, null, 2));
    console.log('\n如需重新生成，请删除现有文件后重试。');
    return;
  }

  // 创建默认配置
  const config = getDefaultConfig();
  writeConfig(config, projectDir);

  // 输出配置信息
  console.log('\n📋 当前配置:');
  console.log(`   框架:        ${config.codeGen.framework}`);
  console.log(`   样式方案:     ${config.codeGen.styleLibrary}`);
  console.log(`   TypeScript:  ${config.codeGen.typescript}`);
  console.log(`   图片格式:     ${config.output.imageFormat}`);
  console.log(`   图片倍率:     ${config.output.imageScale}x`);

  // 输出 MCP 客户端配置
  console.log('\n📎 MCP 客户端配置示例:\n');
  console.log(generateMCPClientConfig());

  // Cookie 配置提示
  console.log('\n🔑 下一步: 配置 Mockplus Cookie（首次使用必须）');
  console.log('   方式1: export MOKE_COOKIE="你的cookie"  （推荐）');
  console.log('   方式2: 运行 moke-mcp cookie set');
  console.log('');
  console.log('   如何获取 Cookie？运行 moke-mcp cookie guide 查看详细说明');

  console.log('\n✨ 初始化完成！运行 `moke-mcp serve` 启动服务。');
}
