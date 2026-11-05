/**
 * Python 解释器解析
 * 优先级: env MOKE_PYTHON(仅用它，不 fallback) > 平台默认候选列表
 *   - Windows: python → py -3 → python3
 *   - 其他:    python3 → python
 */

export interface PythonCommand {
  cmd: string;
  args: string[];
}

/** 按优先级返回候选解释器 */
export function getPythonCandidates(): PythonCommand[] {
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

/**
 * 判断是否为"解释器不存在"：
 *   - spawn 报 ENOENT
 *   - Windows 下退出码 9009(命令不存在 / 应用商店 python 占位程序)
 */
export function isPythonNotFound(errOrCode: NodeJS.ErrnoException | number | null): boolean {
  if (typeof errOrCode === 'number') {
    return process.platform === 'win32' && errOrCode === 9009;
  }
  return errOrCode?.code === 'ENOENT';
}

/** 强制子进程 Python 使用 UTF-8 读写 stdio/文件(Windows 默认是本地代码页如 GBK) */
export function withPythonUtf8Env(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return { ...env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' };
}
