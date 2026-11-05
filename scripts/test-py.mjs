/**
 * test-py.mjs
 * 运行 scripts/mockplus 的 Python 单测 + golden 回归(跨平台选择解释器)
 *
 * 解释器优先级(与 packages/server/src/utils/python.ts 保持一致):
 *   env MOKE_PYTHON(仅用它) > Windows: python → py -3 → python3 / 其他: python3 → python
 *
 * 用法: node scripts/test-py.mjs
 */
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CWD = resolve(__dirname, 'mockplus');
const ENV = { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' };

function getPythonCandidates() {
  if (process.env.MOKE_PYTHON) return [[process.env.MOKE_PYTHON]];
  if (process.platform === 'win32') return [['python'], ['py', '-3'], ['python3']];
  return [['python3'], ['python']];
}

/** 解释器不存在: ENOENT 或 Windows 9009(应用商店 python 占位程序) */
function isNotFound(r) {
  return r.error?.code === 'ENOENT' || (process.platform === 'win32' && r.status === 9009);
}

function resolvePython() {
  for (const [cmd, ...args] of getPythonCandidates()) {
    const r = spawnSync(cmd, [...args, '--version'], { env: ENV, stdio: 'ignore' });
    if (!isNotFound(r) && r.status === 0) return [cmd, args];
  }
  console.error('未找到可用的 Python 3 解释器，请安装 Python 3 或设置环境变量 MOKE_PYTHON');
  process.exit(1);
}

const [cmd, baseArgs] = resolvePython();

for (const args of [['-m', 'unittest', 'discover', '-s', 'tests'], ['tests/run_golden.py']]) {
  const r = spawnSync(cmd, [...baseArgs, ...args], { cwd: CWD, env: ENV, stdio: 'inherit' });
  if (r.error) {
    console.error(r.error.message);
    process.exit(1);
  }
  if (r.status !== 0) process.exit(r.status ?? 1);
}
