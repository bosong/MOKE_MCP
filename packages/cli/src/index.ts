#!/usr/bin/env node
/**
 * moke-mcp CLI 入口
 * 摹客 MCP Server 命令行工具
 */

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { serveCommand } from './commands/serve.js';
import { configShowCommand, configSetCommand } from './commands/config.js';
import { cookieSetCommand, cookieStatusCommand, cookieClearCommand, cookieShowPathCommand } from './commands/cookie.js';
import { getCliVersion } from './utils/version.js';

const program = new Command();

program
  .name('moke-mcp')
  .description('摹客 MCP Server - 将摹客设计数据接入 AI 编码助手')
  .version(getCliVersion());

// init 命令
program
  .command('init')
  .description('初始化项目配置 (.moke-mcp.json)')
  .action(() => {
    initCommand();
  });

// serve 命令
program
  .command('serve')
  .description('启动 MCP Server (供 AI 客户端调用)')
  .action(() => {
    serveCommand();
  });

// config 命令组
const configCmd = program
  .command('config')
  .description('管理配置文件');

configCmd
  .command('show')
  .description('显示当前配置')
  .action(() => {
    configShowCommand();
  });

configCmd
  .command('set')
  .description('设置配置项')
  .argument('<key>', '配置键（支持点号路径，如 codeGen.framework）')
  .argument('<value>', '配置值')
  .action((key, value) => {
    configSetCommand(key, value);
  });

// cookie 命令组
const cookieCmd = program
  .command('cookie')
  .description('管理 Mockplus Cookie（用于 API 认证）');

cookieCmd
  .command('set')
  .description('交互式设置 Cookie（从浏览器复制粘贴）')
  .action(() => {
    cookieSetCommand();
  });

cookieCmd
  .command('status')
  .description('检查 Cookie 状态和环境变量配置')
  .action(() => {
    cookieStatusCommand();
  });

cookieCmd
  .command('clear')
  .description('清除 Cookie')
  .action(() => {
    cookieClearCommand();
  });

cookieCmd
  .command('guide')
  .description('显示 Cookie 配置完整指南')
  .action(() => {
    cookieShowPathCommand();
  });

program.parse();
