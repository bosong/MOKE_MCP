/**
 * Mockplus API 客户端
 * 通过 child_process 调用 Python 脚本（复用 mockplus-context 实现）
 * Python 脚本位于: <project>/scripts/mockplus/
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';
import { MockplusError } from '../utils/error-handler.js';
import type { PythonResult, PageMeta, GroupInfo, DesignData, CookieStatus, PageTreeNode } from './types.js';
import { MockplusExitCode } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 定位 scripts/mockplus 目录
 *
 * 查找优先级:
 *   1. 打包后的同包路径: dist/ → ../scripts/mockplus  (npm 发布后的常态)
 *   2. monorepo 编译后:   packages/server/dist → ../../../scripts/mockplus
 *   3. monorepo 源码:     packages/server/src/api → ../../../../scripts/mockplus
 */
function resolveScriptsDir(): string {
  const candidates = [
    path.resolve(__dirname, '../scripts/mockplus'),
    path.resolve(__dirname, '../../../scripts/mockplus'),
    path.resolve(__dirname, '../../../../scripts/mockplus'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'mockplus.py'))) {
      return dir;
    }
  }
  // 都找不到时退回发布包位置，让后续 spawn 报清晰错误
  return candidates[0];
}

const SCRIPTS_DIR = resolveScriptsDir();

/** 解析摹客 URL */
export interface ParsedUrl {
  type: 'dt';
  appId: string;
  targetId?: string;
}

export function parseMockplusUrl(url: string): ParsedUrl {
  const m = url.match(/app\.mockplus\.cn\/app\/([^/?#]+)/);
  if (!m) {
    throw new MockplusError(
      '无效的摹客 URL。请提供 app.mockplus.cn 开头的设计稿链接',
      'INVALID_URL'
    );
  }
  const appId = m[1];
  const tail = url.replace(/[?#].*$/, '').split('/').pop() || '';
  // URL 固定路径段(design/develop)与过短段不是 target id:
  // 摹客 id 为 ≥8 位 base62/UUID,`/app/{APP}/design` 这类无 target 链接
  // 尾段是路径的一部分,误判会让后续页面定位失败(与 Python 侧一致)。
  const isPathSegment = tail === appId || tail === 'design' || tail === 'develop' || tail.length < 8;
  const targetId = isPathSegment ? undefined : tail;
  return { type: 'dt', appId, targetId };
}

/**
 * 执行 Python 子进程
 */
function runPython(args: string[], stdin?: string): Promise<PythonResult> {
  const env = { ...process.env };
  // 如果设置了 MOKE_COOKIE 环境变量，映射为 MOCKPLUS_COOKIE（Python 脚本识别的变量）
  if (process.env.MOKE_COOKIE) {
    env.MOCKPLUS_COOKIE = process.env.MOKE_COOKIE;
  }

  const scriptPath = path.join(SCRIPTS_DIR, 'mockplus.py');

  return new Promise((resolve, reject) => {
    const proc = spawn('python3', [scriptPath, ...args], {
      env,
      stdio: stdin ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout!.on('data', (data: Buffer) => {
      stdout += data.toString();
    });
    proc.stderr!.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    if (stdin && proc.stdin) {
      proc.stdin.write(stdin);
      proc.stdin.end();
    }

    proc.on('close', (code) => {
      resolve({ stdout, stderr, code: code ?? 0 });
    });
    proc.on('error', (err) => {
      reject(
        new MockplusError(
          `Python 脚本执行失败: ${err.message}。请确保已安装 Python 3`,
          'PYTHON_ERROR'
        )
      );
    });
  });
}

/**
 * 处理 Python 子进程结果，解析错误码
 */
function handleResult(result: PythonResult, context: string): string {
  if (result.code !== 0) {
    const errorMsg = mapExitCodeToMessage(result.code, result.stderr, context);

    // 检查 cookie 相关错误，给出引导提示
    if (result.code === MockplusExitCode.COOKIE_NOT_CONFIGURED) {
      throw new MockplusError(
        `${errorMsg}\n\n请先配置 Cookie：\n` +
          '  方式1: export MOKE_COOKIE="你的cookie"  （推荐）\n' +
          '  方式2: 运行 moke-mcp cookie set 交互式输入\n' +
          '  方式3: 手动写入 ~/.config/mockplus/cookie\n\n' +
          '获取 Cookie: 浏览器登录 app.mockplus.cn → F12 → Application → Cookies → 复制所有 name=value\n',
        'COOKIE_NOT_CONFIGURED'
      );
    }

    if (result.code === MockplusExitCode.COOKIE_REJECTED) {
      throw new MockplusError(
        `${errorMsg}\n\nCookie 已过期或被拒绝，请重新获取并配置 Cookie\n`,
        'COOKIE_REJECTED'
      );
    }

    throw new MockplusError(errorMsg, 'API_ERROR');
  }

  return result.stdout;
}

/**
 * 退出码 → 用户友好消息
 */
function mapExitCodeToMessage(code: number, stderr: string, context: string): string {
  switch (code) {
    case MockplusExitCode.COOKIE_NOT_CONFIGURED:
      return 'Cookie 未配置';
    case MockplusExitCode.COOKIE_EMPTY:
      return 'Cookie 为空';
    case MockplusExitCode.COOKIE_REJECTED:
      return 'Cookie 已过期或被拒绝';
    case MockplusExitCode.HTTP_ERROR:
      return `网络请求失败: ${stderr || '请检查网络连接'}`;
    case MockplusExitCode.API_ERROR:
      return `Mockplus API 返回错误: ${stderr || '请检查项目 ID 是否正确'}`;
    case MockplusExitCode.TARGET_MISMATCH:
      return 'URL 指向的是分组而非页面，请先使用树视图找到正确的页面 ID';
    default:
      return `${context}失败 (退出码: ${code}): ${stderr || '未知错误'}`;
  }
}

// ─── 公开 API ────────────────────────────────────────────────

/**
 * 获取项目页面树
 */
export async function fetchPageTree(appId: string): Promise<{ pages: PageMeta[]; groups: GroupInfo[] }> {
  logger.info(`[API] 获取项目页面树: ${appId}`);

  const result = await runPython(['tree', appId, '--format', 'json']);
  const output = handleResult(result, '获取页面树');

  try {
    const data = JSON.parse(output);
    return {
      pages: data.pages || [],
      groups: data.groups || [],
    };
  } catch {
    throw new MockplusError('解析页面树响应失败', 'PARSE_ERROR');
  }
}

/**
 * 获取设计数据（YAML 格式，经过 transform）
 */
export async function fetchDesignData(
  url: string,
  options: { format?: 'json' | 'yaml'; raw?: boolean; scale?: number } = {}
): Promise<DesignData> {
  const { format = 'json', raw = false, scale } = options;
  logger.info(`[API] 获取设计数据: ${url}`);

  const args = ['data', url, '--format', format];
  if (raw) {
    args.push('--raw');
  }
  if (scale && scale !== 1) {
    args.push('--scale', String(scale));
  }

  const result = await runPython(args);
  const output = handleResult(result, '获取设计数据');

  try {
    return JSON.parse(output) as DesignData;
  } catch {
    throw new MockplusError('解析设计数据响应失败（期望 JSON 格式）', 'PARSE_ERROR');
  }
}

/**
 * 获取设计数据（YAML 原始文本，用于 AI 直接消费）
 * @param options.raw 为 true 时输出未蒸馏原文（v0.6 形态，体积更大）
 * @param options.scale 输出单位缩放系数（默认 1 不缩放）
 */
export async function fetchDesignDataYaml(
  url: string,
  options: { raw?: boolean; scale?: number } = {}
): Promise<string> {
  logger.info(`[API] 获取设计数据 YAML: ${url}`);

  const args = ['data', url, '--format', 'yaml'];
  if (options.raw) {
    args.push('--raw');
  }
  if (options.scale && options.scale !== 1) {
    args.push('--scale', String(options.scale));
  }

  const result = await runPython(args);
  return handleResult(result, '获取设计数据 YAML');
}

/**
 * 一站式获取所有产物：YAML + 切图 + 整页截图
 * 返回产物目录路径
 */
export async function fetchAllAssets(url: string, outDir?: string): Promise<string> {
  const dir = outDir || path.join(os.tmpdir(), `mockplus-${Date.now()}`);
  logger.info(`[API] 一站式获取: ${url} → ${dir}`);

  const args = ['all', url, dir];

  const result = await runPython(args);
  handleResult(result, '获取设计产物');

  return dir;
}

/**
 * 下载切图
 */
export async function downloadImages(
  url: string,
  hashes: string[],
  outDir: string
): Promise<{ ok: number; fail: number; cached: number; total: number }> {
  logger.info(`[API] 下载切图: ${hashes.length} 个 → ${outDir}`);

  const nodesArg = hashes.join(',');
  // --json: Python 侧输出真实下载统计到 stdout(P0:旧实现返回写死的假统计)
  const args = ['download', url, '--nodes', nodesArg, '--out', outDir, '--json'];

  const result = await runPython(args);
  handleResult(result, '下载切图');

  try {
    const stats = JSON.parse(result.stdout) as { ok: number; fail: number; cached: number; total: number };
    return {
      ok: stats.ok ?? 0,
      fail: stats.fail ?? 0,
      cached: stats.cached ?? 0,
      total: stats.total ?? 0,
    };
  } catch {
    // Python 侧契约升级前(无 --json)的兜底:保持旧行为不中断调用方
    logger.warn('[API] download --json 响应解析失败，回退估算统计');
    return { ok: hashes.length, fail: 0, cached: 0, total: hashes.length };
  }
}

/**
 * 获取页面树（用于 get_metadata，输出 XML 格式）
 */
export async function fetchPageTreeForMetadata(url: string): Promise<PageTreeNode[]> {
  const { appId } = parseMockplusUrl(url);
  const { pages, groups } = await fetchPageTree(appId);

  const nodes: PageTreeNode[] = [];

  // 创建分组映射
  const groupMap = new Map<string, GroupInfo>();
  for (const g of groups) {
    groupMap.set(g.id, g);
  }

  // 递归构建树
  function buildTree(
    parentId: string | undefined
  ): PageTreeNode[] {
    const result: PageTreeNode[] = [];

    // 找所有属于此 parent 的分组
    for (const g of groups) {
      if (g.parentID === parentId || (!parentId && !g.parentID)) {
        result.push({
          id: g.id,
          name: g.name,
          type: 'group',
          children: buildTree(g.id),
        });
      }
    }

    // 找所有属于此 parent 的页面
    for (const p of pages) {
      if (p.parentID === parentId || (!parentId && !p.parentID)) {
        result.push({
          id: p.id,
          name: p.name,
          type: 'page',
        });
      }
    }

    return result;
  }

  return buildTree(undefined);
}

/**
 * 检查 Cookie 状态
 */
export async function checkCookieStatus(appId: string): Promise<CookieStatus> {
  logger.info('[API] 检查 Cookie 状态');

  // --json: Python 侧输出结构化状态(P0:旧实现解析纯文本 stdout 必失败)
  const result = await runPython(['cookie', 'status', '--json']);
  handleResult(result, '检查 Cookie');

  try {
    return JSON.parse(result.stdout) as CookieStatus;
  } catch {
    return { path: '~/.config/mockplus/cookie', exists: false };
  }
}

/**
 * Cookie 功能实现（仅供 CLI 使用）
 */
export async function setCookie(content: string): Promise<void> {
  logger.info('[API] 设置 Cookie');

  const result = await runPython(['cookie', 'set'], content);
  handleResult(result, '设置 Cookie');
}

export async function clearCookie(): Promise<void> {
  logger.info('[API] 清除 Cookie');

  const result = await runPython(['cookie', 'clear']);
  if (result.code !== 0) {
    logger.warn('清除 Cookie 警告:', result.stderr);
  }
}

/**
 * 验证 Python 环境是否可用
 */
export async function verifyPythonEnv(): Promise<boolean> {
  try {
    const result = await runPython(['--help']);
    return result.code === 0;
  } catch {
    return false;
  }
}
