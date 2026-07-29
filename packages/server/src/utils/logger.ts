/**
 * 日志工具
 * 使用 stderr 输出，避免干扰 MCP stdio 的 JSON-RPC 通信
 */

export const logger = {
  info(...args: unknown[]): void {
    console.error(`[INFO]  ${new Date().toISOString()}`, ...args);
  },

  warn(...args: unknown[]): void {
    console.error(`[WARN]  ${new Date().toISOString()}`, ...args);
  },

  error(...args: unknown[]): void {
    console.error(`[ERROR] ${new Date().toISOString()}`, ...args);
  },

  debug(...args: unknown[]): void {
    if (process.env.MOKE_MCP_DEBUG) {
      console.error(`[DEBUG] ${new Date().toISOString()}`, ...args);
    }
  },
};
