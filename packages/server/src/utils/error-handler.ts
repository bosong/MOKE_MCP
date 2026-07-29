/**
 * 统一错误处理
 */

import { logger } from './logger.js';

/** Moke MCP 自定义错误 */
export class MokeMCPError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'MokeMCPError';
  }
}

/** API 调用错误 */
export class MockplusError extends MokeMCPError {
  constructor(message: string, code: string = 'API_ERROR') {
    super(message, code);
    this.name = 'MockplusError';
  }
}

/** Cookie 未配置错误 */
export class CookieNotConfiguredError extends MokeMCPError {
  constructor() {
    super(
      'Cookie 未配置。请先配置 Cookie：\n' +
        '  方式1: export MOKE_COOKIE="你的cookie"  （推荐，Agent 中直接设置环境变量）\n' +
        '  方式2: 运行 moke-mcp cookie set 交互式输入\n' +
        '  方式3: 手动写入 ~/.config/mockplus/cookie\n\n' +
        '如何获取 Cookie：\n' +
        '  1. 浏览器打开 https://app.mockplus.cn 并登录\n' +
        '  2. F12 → Application → Cookies → app.mockplus.cn\n' +
        '  3. 复制所有 cookie 的 name=value，用 ; 连接',
      'COOKIE_NOT_CONFIGURED'
    );
    this.name = 'CookieNotConfiguredError';
  }
}

/** URL 无效错误 */
export class InvalidUrlError extends MokeMCPError {
  constructor(url: string) {
    super(
      `无效的摹客 URL: ${url}\n` +
        '请提供 app.mockplus.cn 开头的设计稿链接\n' +
        '格式: https://app.mockplus.cn/app/{APP_ID}/develop/design/{PAGE_ID}',
      'INVALID_URL'
    );
    this.name = 'InvalidUrlError';
  }
}

/** 将错误转为用户友好的 MCP Tool 返回内容 */
export function formatErrorForMcp(err: unknown): { content: Array<{ type: 'text'; text: string }> } {
  if (err instanceof MokeMCPError) {
    logger.error(`[${err.code}] ${err.message}`);
    return {
      content: [{ type: 'text', text: `错误 [${err.code}]: ${err.message}` }],
    };
  }

  logger.error('未知错误:', err);
  const message = err instanceof Error ? err.message : String(err);
  return {
    content: [{ type: 'text', text: `未知错误: ${message}` }],
  };
}
