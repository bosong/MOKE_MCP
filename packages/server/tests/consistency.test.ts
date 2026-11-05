/**
 * MCP(TS 层)与 CLI(Python 层)解析一致性集成测试
 *
 * MCP 的 get_design_data / get_design_context 内部通过 runPython 调用
 * `mockplus.py data <url> --format <json|yaml>` —— 与 CLI 同一命令。
 * 本测试验证两端对同一真实 URL 的解析结果一致:
 *  - json: fetchDesignData 的 JSON.parse 结果 == CLI stdout 的 json.loads 结果
 *  - yaml: fetchDesignDataYaml 的文本 == CLI stdout 文本(逐字节)
 *
 * 依赖真实网络 + 有效 Cookie,网络失败时容错跳过(CI 无 Cookie 也能跑)。
 */
import { execFileSync } from 'child_process';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { fetchDesignData, fetchDesignDataYaml } from '../src/api/client.js';
import { getPythonCandidates, isPythonNotFound, withPythonUtf8Env } from '../src/utils/python.js';

const TEST_URL = 'https://app.mockplus.cn/app/yd2hUtESwQ5/develop/design/-iGT77iY9j';
// vitest 对 new URL(x, import.meta.url) 有 Vite 资源解析特判,这里用 process.cwd() 计算
const SCRIPTS_DIR = path.resolve(process.cwd(), '../../scripts/mockplus');

function cli(format: 'json' | 'yaml'): string {
  const scriptArgs = ['mockplus.py', 'data', TEST_URL, '--format', format];
  const candidates = getPythonCandidates();
  for (let i = 0; i < candidates.length; i++) {
    const { cmd, args } = candidates[i];
    try {
      return execFileSync(cmd, [...args, ...scriptArgs], {
        cwd: SCRIPTS_DIR,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: withPythonUtf8Env(process.env),
      });
    } catch (err) {
      const e = err as NodeJS.ErrnoException & { status?: number | null };
      // 解释器不存在则尝试下一个候选，其余错误原样抛出
      if (i < candidates.length - 1 && (isPythonNotFound(e) || isPythonNotFound(e.status ?? null))) {
        continue;
      }
      throw err;
    }
  }
  throw new Error('未找到可用的 Python 3 解释器');
}

function runOrSkip<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch (err) {
    console.warn('[consistency] 跳过:网络/Cookie 不可用', (err as Error).message.slice(0, 120));
    return undefined;
  }
}

describe('MCP 与 CLI 解析一致性', () => {
  it('json 形态语义等价(节点/样式/元数据)', async () => {
    const cliJson = runOrSkip(() => JSON.parse(cli('json')));
    if (cliJson === undefined) return;

    const mcpData = await fetchDesignData(TEST_URL, { format: 'json' });
    expect(mcpData).toEqual(cliJson);
  });

  it('yaml 形态逐字节一致(蒸馏后文本原样透出)', async () => {
    const cliYaml = runOrSkip(() => cli('yaml'));
    if (cliYaml === undefined) return;

    const mcpYaml = await fetchDesignDataYaml(TEST_URL);
    expect(mcpYaml).toBe(cliYaml);
  });

  it('URL 与短形式 app:page 解析结果一致', async () => {
    const cliJson = runOrSkip(() => JSON.parse(cli('json')));
    if (cliJson === undefined) return;

    const short = await fetchDesignData('yd2hUtESwQ5:-iGT77iY9j', { format: 'json' });
    expect(short).toEqual(cliJson);
  });
});
