/**
 * copy-mockplus.mjs
 * 构建/打包时将仓库根 scripts/mockplus 复制到目标包的 scripts/mockplus
 *
 * 用法: node scripts/copy-mockplus.mjs <server|cli>
 */
import { cpSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const targets = {
  server: resolve(REPO_ROOT, 'packages/server/scripts/mockplus'),
  cli: resolve(REPO_ROOT, 'packages/cli/scripts/mockplus'),
};

const src = resolve(REPO_ROOT, 'scripts/mockplus');
const pkg = process.argv[2];

if (!pkg || !targets[pkg]) {
  console.error('用法: node scripts/copy-mockplus.mjs <server|cli>');
  process.exit(1);
}

const dest = targets[pkg];

// 清理旧副本
rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });

cpSync(src, dest, {
  recursive: true,
  filter: (srcPath, dstPath) => {
    // 跳过 tests/ 目录（仅测试用，不下发给用户）
    if (srcPath.includes('/tests') || srcPath.endsWith('/tests')) {
      return false;
    }
    // 跳过 __pycache__ 目录（Python 版本相关缓存）
    if (srcPath.endsWith('/__pycache__') || srcPath.includes('/__pycache__/')) {
      return false;
    }
    return true;
  },
});

// 清理目标目录中残留的 __pycache__
function cleanPycache(dir) {
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name === '__pycache__') {
        rmSync(join(dir, entry.name), { recursive: true, force: true });
      } else if (entry.isDirectory()) {
        cleanPycache(join(dir, entry.name));
      }
    }
  } catch { /* 目录不存在则跳过 */ }
}
cleanPycache(dest);

console.log(`✅ 已复制 scripts/mockplus → ${dest}`);
