/**
 * moke-mcp cookie 命令
 * Cookie 管理：设置、查看状态、清除、显示配置指南
 */

import { spawn } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as readline from 'readline';
import * as fs from 'fs';
import * as os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 定位 mockplus.py:
 *   1. npm 发布后: cli/scripts/mockplus (通过 cli 的 files 字段打包)
 *   2. monorepo 编译后: cli/dist/ → ../scripts/mockplus
 *   3. monorepo 源码: cli/src/commands/ → ../../../scripts/mockplus
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
  return candidates[0];
}

const SCRIPTS_DIR = resolveScriptsDir();

/** 获取 Python 脚本路径 */
function getPythonScript(): string {
  return path.join(SCRIPTS_DIR, 'mockplus.py');
}

interface PythonCommand {
  cmd: string;
  args: string[];
}

/**
 * Python 解释器候选(与 @moke-mcp/server 的 utils/python.ts 保持一致)
 * 优先级: env MOKE_PYTHON(仅用它) > Windows: python → py -3 → python3 / 其他: python3 → python
 */
function getPythonCandidates(): PythonCommand[] {
  const override = process.env.MOKE_PYTHON;
  if (override) {
    return [{ cmd: override, args: [] }];
  }
  if (process.platform === 'win32') {
    return [
      { cmd: 'python', args: [] },
      { cmd: 'py', args: ['-3'] },
      { cmd: 'python3', args: [] },
    ];
  }
  return [
    { cmd: 'python3', args: [] },
    { cmd: 'python', args: [] },
  ];
}

type CmdResult = { stdout: string; stderr: string; code: number };

/** 已验证可用的解释器(首次成功后缓存) */
let resolvedPython: PythonCommand | null = null;

/** 用指定解释器执行一次；解释器不存在(ENOENT / Windows 9009)时 resolve null */
function spawnCookieCmd(
  python: PythonCommand,
  args: string[],
  env: NodeJS.ProcessEnv,
  stdin?: string
): Promise<CmdResult | null> {
  return new Promise((resolve, reject) => {
    const proc = spawn(python.cmd, [...python.args, getPythonScript(), ...args], {
      env,
      stdio: stdin ? ['pipe', 'pipe', 'pipe'] : ['inherit', 'pipe', 'pipe'],
    });

    // 按 Buffer 收集，close 时统一解码，避免多字节字符跨 chunk 被截断
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let settled = false;

    proc.stdout!.on('data', (data: Buffer) => {
      stdoutChunks.push(data);
    });
    proc.stderr!.on('data', (data: Buffer) => {
      stderrChunks.push(data);
    });

    if (stdin && proc.stdin) {
      proc.stdin.on('error', () => { /* 解释器不存在时 stdin 写入会 EPIPE，交给 error/close 处理 */ });
      proc.stdin.write(stdin);
      proc.stdin.end();
    }

    proc.on('close', (code) => {
      if (settled) return;
      settled = true;
      if (process.platform === 'win32' && code === 9009) {
        resolve(null);
        return;
      }
      resolve({
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
        code: code ?? 0,
      });
    });
    proc.on('error', (err: NodeJS.ErrnoException) => {
      if (settled) return;
      settled = true;
      if (err.code === 'ENOENT') {
        resolve(null);
        return;
      }
      reject(new Error(`Python 脚本执行失败: ${err.message}。请确保已安装 Python 3`));
    });
  });
}

/** 执行 Python cookie 子命令 */
async function runCookieCmd(args: string[], stdin?: string): Promise<CmdResult> {
  // 强制 Python 使用 UTF-8 读写 stdio/文件(Windows 默认是本地代码页如 GBK)
  const env: NodeJS.ProcessEnv = { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' };
  if (process.env.MOKE_COOKIE) {
    env.MOCKPLUS_COOKIE = process.env.MOKE_COOKIE;
  }

  const candidates = resolvedPython ? [resolvedPython] : getPythonCandidates();
  for (const python of candidates) {
    const result = await spawnCookieCmd(python, args, env, stdin);
    if (result) {
      resolvedPython = python;
      return result;
    }
  }

  const tried = candidates.map((c) => [c.cmd, ...c.args].join(' ')).join(', ');
  throw new Error(
    `Python 脚本执行失败: 未找到可用的 Python 3 解释器(已尝试: ${tried})。` +
      '请确保已安装 Python 3，或通过环境变量 MOKE_PYTHON 指定解释器路径'
  );
}

/** cookie set：交互式设置 Cookie */
export async function cookieSetCommand(): Promise<void> {
  printCookieGuide();

  // 检查是否已有 Cookie
  const status = await runCookieCmd(['cookie', 'status']);
  if (status.code === 0) {
    try {
      const info = JSON.parse(status.stdout);
      if (info.exists && info.days_left !== undefined) {
        console.log(`\n📌 当前已有 Cookie 配置 (位置: ${info.path})`);
        if (info.days_left > 0) {
          console.log(`   剩余约 ${info.days_left} 天有效\n`);
        } else {
          console.log(`   已过期，需要重新设置\n`);
        }
      }
    } catch {
      // 忽略解析失败
    }
  }

  // 交互式读取
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('请粘贴完整的 Cookie 字符串（从浏览器复制，粘贴后按回车，Ctrl+D 结束）:');
  console.log('');

  let cookieContent = '';
  let lines = 0;

  rl.on('line', (line) => {
    if (line.trim() === '') {
      rl.close();
      return;
    }
    cookieContent += (cookieContent ? ' ' : '') + line.trim();
    lines++;
  });

  rl.on('close', () => {
    if (!cookieContent.trim()) {
      console.log('\n❌ Cookie 内容为空，操作取消');
      process.exit(1);
    }

    console.log(`\n正在保存 Cookie (${cookieContent.length} 字符)...`);

    runCookieCmd(['cookie', 'set'], cookieContent.trim())
      .then((result) => {
        if (result.code === 0) {
          console.log('✅ Cookie 已保存到 ~/.config/mockplus/cookie');
          console.log('   权限已设置为 600（仅当前用户可读）');
          console.log('   有效期约 30 天');
        } else {
          console.error(`❌ Cookie 设置失败: ${result.stderr || '未知错误'}`);
          process.exit(1);
        }
      })
      .catch((err) => {
        console.error(`❌ 执行失败: ${err.message}`);
        process.exit(1);
      });
  });
}

/** cookie status：查看 Cookie 状态 */
export async function cookieStatusCommand(): Promise<void> {
  console.log('🔍 检查 Cookie 状态...\n');

  // 检查环境变量
  const envCookie = process.env.MOKE_COOKIE;
  if (envCookie) {
    console.log('✅ 环境变量 MOKE_COOKIE 已设置');
    console.log(`   长度: ${envCookie.length} 字符`);
    console.log('   来源: Agent/Shell 环境变量（最高优先级）\n');
  }

  // 检查文件 Cookie
  try {
    const result = await runCookieCmd(['cookie', 'status']);
    if (result.code === 0) {
      try {
        const info = JSON.parse(result.stdout);
        if (info.exists) {
          console.log(`📁 文件 Cookie: ${info.path}`);
          console.log(`   权限: ${info.mode || '未知'}`);
          if (info.days_left !== undefined) {
            if (info.days_left > 0) {
              console.log(`   ✅ 有效: 剩余约 ${info.days_left} 天`);
            } else {
              console.log(`   ⚠️ 已过期: 请在浏览器重新获取 Cookie`);
            }
          }
        } else {
          console.log('📁 文件 Cookie: 未配置');
        }
      } catch {
        console.log(result.stdout);
      }
    } else {
      console.log('📁 文件 Cookie: 检查失败');
    }
  } catch (err) {
    console.log(`📁 文件 Cookie: 检查失败 (${(err as Error).message})`);
  }

  // 配置指南
  printCookieGuide();
}

/** cookie clear：清除 Cookie */
export async function cookieClearCommand(): Promise<void> {
  console.log('🗑️ 清除 Cookie...\n');

  try {
    const result = await runCookieCmd(['cookie', 'clear']);
    if (result.code === 0) {
      console.log('✅ Cookie 已清除');

      // 也检查 ~/.config/mockplus/cookie 文件
      const cookiePath = path.join(os.homedir(), '.config', 'mockplus', 'cookie');
      if (fs.existsSync(cookiePath)) {
        console.log('   注意: ~/.config/mockplus/cookie 仍需手动删除（如需要）');
      }
    } else {
      console.log('⚠️ Cookie 清除完成（或无需清除）');
    }
  } catch (err) {
    console.log(`❌ 清除失败: ${(err as Error).message}`);
  }

  if (process.env.MOKE_COOKIE) {
    console.log('\n💡 环境变量 MOKE_COOKIE 仍然存在，如需完全清除请运行:');
    console.log('   unset MOKE_COOKIE');
  }
}

/** cookie show-path：显示 Cookie 配置完整指南 */
export function cookieShowPathCommand(): void {
  console.log('📋 Cookie 配置完整指南');
  console.log('═══════════════════════════════════════');
  console.log('');

  printCookieGuide();
}

/** 打印 Cookie 获取和配置指南 */
function printCookieGuide(): void {
  console.log('\n📋 Cookie 配置方式（任选一种，按优先级排序）:');
  console.log('');
  console.log('  方式1（推荐 - Agent 中直接设置）: 环境变量');
  console.log('    export MOKE_COOKIE="你的完整cookie字符串"');
  console.log('');
  console.log('  方式2: 交互式命令');
  console.log('    moke-mcp cookie set');
  console.log('');
  console.log('  方式3: 手动文件');
  console.log('    将 cookie 写入 ~/.config/mockplus/cookie');
  console.log('    （与 mockplus-context 共用同一文件）');
  console.log('');
  console.log('─────────────────────────');
  console.log('🔑 如何获取 Cookie:');
  console.log('');
  console.log('  1. 浏览器打开 https://app.mockplus.cn 并登录');
  console.log('  2. 按 F12 打开开发者工具');
  console.log('  3. 进入 Application (应用程序) 标签');
  console.log('  4. 左侧 Storage → Cookies → app.mockplus.cn');
  console.log('  5. 复制所有 cookie，格式为 name=value，用 ; 连接');
  console.log('');
  console.log('  示例格式:');
  console.log('  token=xxxxx; JSESSIONID=yyyyy; _ga=zzzzz; ...');
  console.log('');
  console.log('  Cookie 有效期约 30 天，过期后需重新获取');
  console.log('');
}
