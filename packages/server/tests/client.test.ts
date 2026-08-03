/**
 * api/client.ts 契约测试
 * mock child_process.spawn,验证与 Python 脚本的参数契约(P0 回归):
 *  - checkCookieStatus 必须传 --json 并解析结构化 stdout
 *  - downloadImages 必须传 --json 并解析真实下载统计
 */
import { EventEmitter } from 'events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

import { spawn } from 'child_process';
import { checkCookieStatus, downloadImages, parseMockplusUrl } from '../src/api/client.js';

const mockSpawn = vi.mocked(spawn);

function makeProc(stdout: string, stderr = '', code = 0) {
  const stdoutEm = new EventEmitter();
  const stderrEm = new EventEmitter();
  const stdin = { write: vi.fn(), end: vi.fn() };
  const proc = {
    stdout: stdoutEm,
    stderr: stderrEm,
    stdin,
    on: vi.fn((evt: string, cb: (...a: unknown[]) => void) => {
      if (evt === 'close') {
        queueMicrotask(() => {
          if (stdout) stdoutEm.emit('data', Buffer.from(stdout));
          if (stderr) stderrEm.emit('data', Buffer.from(stderr));
          cb(code);
        });
      }
      return proc;
    }),
  };
  return proc;
}

describe('parseMockplusUrl', () => {
  it('解析 appId 与 targetId', () => {
    expect(
      parseMockplusUrl('https://app.mockplus.cn/app/yd2hUtESwQ5/develop/design/ltRDYTciO6')
    ).toEqual({ type: 'dt', appId: 'yd2hUtESwQ5', targetId: 'ltRDYTciO6' });
  });

  it('无 target 的 /design 链接不误判', () => {
    expect(parseMockplusUrl('https://app.mockplus.cn/app/yd2hUtESwQ5/design')).toEqual({
      type: 'dt', appId: 'yd2hUtESwQ5', targetId: undefined,
    });
  });

  it('非法 URL 抛错', () => {
    expect(() => parseMockplusUrl('https://example.com/x')).toThrow();
  });
});

describe('checkCookieStatus 契约', () => {
  beforeEach(() => {
    mockSpawn.mockReset();
  });

  it('传 --json 并解析结构化 stdout', async () => {
    mockSpawn.mockReturnValue(makeProc(JSON.stringify({ path: '/tmp/cookie', exists: true, days_left: 10 })) as never);
    const status = await checkCookieStatus('app1');
    expect(mockSpawn).toHaveBeenCalledTimes(1);
    const args = mockSpawn.mock.calls[0][1] as string[];
    expect(args).toContain('cookie');
    expect(args).toContain('--json');
    expect(status).toEqual({ path: '/tmp/cookie', exists: true, days_left: 10 });
  });

  it('stdout 非 JSON 时回退假状态而不抛', async () => {
    mockSpawn.mockReturnValue(makeProc('纯文本输出') as never);
    const status = await checkCookieStatus('app1');
    expect(status.exists).toBe(false);
  });
});

describe('downloadImages 契约', () => {
  beforeEach(() => {
    mockSpawn.mockReset();
  });

  it('传 --json 并解析真实下载统计(替代写死的假统计)', async () => {
    mockSpawn.mockReturnValue(
      makeProc(JSON.stringify({ ok: 3, fail: 1, cached: 2, total: 6 })) as never
    );
    const stats = await downloadImages('https://app.mockplus.cn/app/a1/design', ['h1', 'h2'], '/tmp/out');
    const args = mockSpawn.mock.calls[0][1] as string[];
    expect(args).toContain('download');
    expect(args).toContain('--json');
    expect(stats).toEqual({ ok: 3, fail: 1, cached: 2, total: 6 });
  });

  it('stdout 非 JSON 时回退估算统计不中断', async () => {
    mockSpawn.mockReturnValue(makeProc('') as never);
    const stats = await downloadImages('https://app.mockplus.cn/app/a1/design', ['h1', 'h2'], '/tmp/out');
    expect(stats).toEqual({ ok: 2, fail: 0, cached: 0, total: 2 });
  });
});
