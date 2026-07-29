/**
 * 设计上下文服务
 * 处理设计数据的格式化输出（JSON / YAML / XML）
 */

import type { DesignData, DesignNode } from '../api/types.js';

/** 将设计节点树递归构建为 XML 元数据（对标 Figma MCP get_metadata） */
export function buildMetadataXml(nodes: DesignNode[], depth: number = 0): string {
  const indent = '  '.repeat(depth);
  let xml = '';

  for (const node of nodes) {
    const type = node.type || 'UNKNOWN';
    const name = escapeXml(node.name || 'unnamed');
    const id = node.id || '';
    const pos = node.pos;
    const ap = node.absolutePosition;

    const boundsStr = pos
      ? `x="${pos.x}" y="${pos.y}" width="${pos.w}" height="${pos.h}"`
      : '';

    if (!node.children || node.children.length === 0) {
      xml += `${indent}<${type} id="${id}" name="${name}" ${boundsStr}/>\n`;
    } else {
      xml += `${indent}<${type} id="${id}" name="${name}" ${boundsStr}>\n`;
      xml += buildMetadataXml(node.children, depth + 1);
      xml += `${indent}</${type}>\n`;
    }
  }

  return xml;
}

/** 简单 JSON 到 YAML 转换 */
export function jsonToYaml(obj: unknown, indent: number = 0): string {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj !== 'object') return String(obj);

  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    return '\n' + obj.map((item) => {
      if (typeof item === 'object' && item !== null) {
        const lines = jsonToYaml(item, indent).split('\n');
        return lines.map((l, i) =>
          i === 0 ? `${'  '.repeat(indent)}- ${l.trimStart()}` : `  ${l}`
        ).join('\n');
      }
      return `${'  '.repeat(indent)}- ${item}`;
    }).join('\n');
  }

  const entries = Object.entries(obj as Record<string, unknown>);
  if (entries.length === 0) return '{}';

  return '\n' + entries.map(([key, value]) => {
    const val = jsonToYaml(value, indent + 1);
    if (val.startsWith('\n')) {
      return `${'  '.repeat(indent)}${key}:${val}`;
    }
    return `${'  '.repeat(indent)}${key}: ${val}`;
  }).join('\n');
}

/** 格式化设计数据为 JSON 或 YAML */
export function formatDesignData(data: DesignData, format: 'json' | 'yaml'): string {
  if (format === 'json') {
    return JSON.stringify(data, null, 2);
  }
  return jsonToYaml(data);
}

/** 页面树节点类型 */
interface PageTreeEntry {
  id: string;
  name: string;
  type: 'page' | 'group';
  children?: PageTreeEntry[];
}

/** 构建页面树 XML 元数据 */
export function buildPageTreeXml(
  nodes: PageTreeEntry[],
  depth: number = 0
): string {
  const indent = '  '.repeat(depth);
  let xml = '';

  for (const node of nodes) {
    const tag = node.type === 'group' ? 'GROUP' : 'PAGE';
    if (!node.children || node.children.length === 0) {
      xml += `${indent}<${tag} id="${node.id}" name="${escapeXml(node.name)}"/>\n`;
    } else {
      xml += `${indent}<${tag} id="${node.id}" name="${escapeXml(node.name)}">\n`;
      xml += buildPageTreeXml(node.children as PageTreeEntry[], depth + 1);
      xml += `${indent}</${tag}>\n`;
    }
  }

  return xml;
}

/** XML 转义 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
