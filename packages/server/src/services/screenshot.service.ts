/**
 * 截图服务
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger.js';

/**
 * 读取产物目录中的整页截图，返回 base64
 */
export function getDesignScreenshot(assetsDir: string): { data: string; mimeType: string } | null {
  const pngPath = path.join(assetsDir, 'design.png');
  if (fs.existsSync(pngPath)) {
    const buffer = fs.readFileSync(pngPath);
    return {
      data: buffer.toString('base64'),
      mimeType: 'image/png',
    };
  }
  return null;
}

/**
 * 读取产物目录中的所有切图，返回 base64 数组
 */
export function getAssetImages(
  assetsDir: string
): Array<{ name: string; data: string; mimeType: string }> {
  const images: Array<{ name: string; data: string; mimeType: string }> = [];
  const assetsPath = path.join(assetsDir, 'assets');

  if (!fs.existsSync(assetsPath)) {
    return images;
  }

  const files = fs.readdirSync(assetsPath);
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (ext === '.png' || ext === '.svg') {
      const filePath = path.join(assetsPath, file);
      try {
        const buffer = fs.readFileSync(filePath);
        images.push({
          name: file,
          data: buffer.toString('base64'),
          mimeType: ext === '.png' ? 'image/png' : 'image/svg+xml',
        });
      } catch (err) {
        logger.warn(`读取切图失败: ${file}`, err);
      }
    }
  }

  return images;
}

/**
 * 读取文件内容为 base64
 */
export function readFileAsBase64(filePath: string): { data: string; mimeType: string } | null {
  if (!fs.existsSync(filePath)) return null;

  const ext = path.extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
  };

  try {
    const buffer = fs.readFileSync(filePath);
    return {
      data: buffer.toString('base64'),
      mimeType: mimeMap[ext] || 'application/octet-stream',
    };
  } catch {
    return null;
  }
}
