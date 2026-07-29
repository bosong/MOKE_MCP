/**
 * 设计变量提取服务
 * 从 DesignData 的 globalVars.styles 中提取 Design Token
 */

import type { DesignData, GlobalStyles } from '../api/types.js';

/** Design Token 变量 */
export interface DesignVariable {
  name: string;
  type: 'COLOR' | 'FONT' | 'SPACING' | 'EFFECT' | 'OTHER';
  value: unknown;
}

/**
 * 从设计数据中提取变量定义
 */
export function extractVariables(data: DesignData): DesignVariable[] {
  const variables: DesignVariable[] = [];
  const styles = data.globalVars?.styles || {};

  for (const [key, value] of Object.entries(styles)) {
    // 跳过 fill_* layout_* effect_* 等引用 key，只保留语义化名称
    if (key.match(/^(fill|layout|effect|stroke)_\d{6}$/)) {
      continue;
    }

    const variable = classifyVariable(key, value);
    if (variable) {
      variables.push(variable);
    }
  }

  return variables;
}

/**
 * 分类变量
 */
function classifyVariable(name: string, value: unknown): DesignVariable | null {
  if (typeof value === 'string') {
    // 颜色值
    if (value.startsWith('#') || value.startsWith('rgb')) {
      return { name, type: 'COLOR', value };
    }
    return { name, type: 'OTHER', value };
  }

  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;

    // 字体样式
    if ('fontFamily' in obj || 'fontSize' in obj || 'fontWeight' in obj) {
      return { name, type: 'FONT', value: obj };
    }

    // 效果
    if ('type' in obj && typeof obj.type === 'string') {
      const type = obj.type as string;
      if (['DROP_SHADOW', 'INNER_SHADOW', 'LAYER_BLUR', 'BACKGROUND_BLUR'].includes(type)) {
        return { name, type: 'EFFECT', value: obj };
      }
    }

    // 颜色（对象格式）
    if ('r' in obj && 'g' in obj && 'b' in obj) {
      return { name, type: 'COLOR', value: obj };
    }

    return { name, type: 'OTHER', value: obj };
  }

  if (typeof value === 'number') {
    return { name, type: 'SPACING', value };
  }

  return null;
}

/**
 * 生成设计系统规范文档（Markdown 格式）
 */
export function generateDesignSystemRules(
  variables: DesignVariable[],
  framework: string,
  styleLibrary: string
): string {
  let doc = `# 设计系统规范\n\n`;
  doc += `> 基于摹客设计文件自动生成 | 目标: ${framework} + ${styleLibrary}\n\n`;

  // 颜色
  const colorVars = variables.filter((v) => v.type === 'COLOR');
  doc += `## 颜色调色板\n\n`;
  doc += `| Token | 值 | 用途 |\n`;
  doc += `|-------|----|------|\n`;
  if (colorVars.length > 0) {
    for (const v of colorVars) {
      doc += `| \`${v.name}\` | ${formatValue(v.value)} | - |\n`;
    }
  } else {
    doc += `| (未定义) | - | 暂无颜色变量 |\n`;
  }

  // 字体
  const fontVars = variables.filter((v) => v.type === 'FONT');
  doc += `\n## 字体层级\n\n`;
  doc += `| Token | fontFamily | fontSize | fontWeight | 用途 |\n`;
  doc += `|-------|------------|----------|-----------|------|\n`;
  if (fontVars.length > 0) {
    for (const v of fontVars) {
      const f = v.value as Record<string, unknown>;
      doc += `| \`${v.name}\` | ${f.fontFamily || '-'} | ${f.fontSize || '-'} | ${f.fontWeight || '-'} | - |\n`;
    }
  } else {
    doc += `| (未定义) | - | - | - | 暂无字体变量 |\n`;
  }

  // Tailwind 配置
  if (styleLibrary === 'tailwind') {
    doc += `\n## Tailwind CSS 配置\n\n`;
    doc += '```js\n// tailwind.config.js\n';
    doc += 'module.exports = {\n';
    doc += '  theme: {\n';
    doc += '    extend: {\n';
    doc += '      colors: {\n';
    for (const v of colorVars) {
      doc += `        '${v.name}': 'var(--${v.name})',\n`;
    }
    doc += '      },\n';
    doc += '      fontSize: {\n';
    for (const v of fontVars) {
      const f = v.value as Record<string, unknown>;
      doc += `        '${v.name}': ['${f.fontSize || '16'}px', { fontWeight: '${f.fontWeight || '400'}' }],\n`;
    }
    doc += '      },\n';
    doc += '    },\n';
    doc += '  },\n';
    doc += '};\n```\n';
  }

  doc += `\n---\n*生成时间: ${new Date().toISOString()}*`;
  return doc;
}

/** 格式化变量值 */
function formatValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object' && value !== null) {
    const c = value as { r: number; g: number; b: number; a?: number };
    if ('r' in c) {
      return `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a ?? 1})`;
    }
    return JSON.stringify(value);
  }
  return String(value);
}
