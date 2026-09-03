/**
 * 输出缩放系数解析
 * 优先级: 显式参数(如 CLI --scale) > env MOKE_SCALE > 项目 .moke-mcp.json 的 output.scale > 默认 1
 */
import * as fs from 'fs';
import * as path from 'path';

const DEFAULT_SCALE = 1;

/** 解析合法正 scale，非法返回 undefined */
function parseScale(v: unknown): number | undefined {
  if (typeof v === 'number') return v > 0 ? v : undefined;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }
  return undefined;
}

/** 从项目 .moke-mcp.json 读取 output.scale */
function readConfigScale(cwd: string): number | undefined {
  try {
    const fp = path.join(cwd, '.moke-mcp.json');
    if (!fs.existsSync(fp)) return undefined;
    const raw = JSON.parse(fs.readFileSync(fp, 'utf-8'));
    return parseScale(raw?.output?.scale);
  } catch {
    return undefined;
  }
}

/**
 * 解析最终缩放系数
 * @param options.env 环境变量对象（测试可注入）
 * @param options.cwd  项目目录（默认 process.cwd()）
 * @param options.explicit 显式传入值（CLI --scale 等，优先级最高）
 */
export function resolveScale(options: {
  env?: Record<string, string | undefined>;
  cwd?: string;
  explicit?: number | string;
} = {}): number {
  const { env = process.env, cwd = process.cwd(), explicit } = options;
  return (
    parseScale(explicit)
    ?? parseScale(env.MOKE_SCALE)
    ?? readConfigScale(cwd)
    ?? DEFAULT_SCALE
  );
}
