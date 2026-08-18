/**
 * 读取本包版本号
 * 编译后 dist/ 与源码 src/ 都在包目录内，../package.json 均可命中；
 * 读取失败时回退到发布时版本，避免运行时崩溃。
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function getPackageVersion(): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));
    return typeof pkg.version === 'string' && pkg.version ? pkg.version : '0.2.3';
  } catch {
    return '0.2.3';
  }
}
