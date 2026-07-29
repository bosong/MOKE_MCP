/**
 * 代码生成服务
 * 将设计数据转换为前端代码（React/Vue + Tailwind/CSS）
 */

import type { DesignNode } from '../api/types.js';

/** 代码生成选项 */
export interface CodeGenOptions {
  framework: 'react' | 'vue';
  styleLibrary: 'tailwind' | 'css-modules' | 'styled-components';
  typescript: boolean;
}

/** 生成的代码块 */
export interface GeneratedCode {
  markup: string;
  styles: string;
  imports: string;
}

/** 节点类型 → HTML 标签映射 */
const TAG_MAP: Record<string, string> = {
  DOCUMENT: 'div',
  PAGE: 'div',
  FRAME: 'div',
  GROUP: 'div',
  TEXT: 'span',
  RECTANGLE: 'div',
  ELLIPSE: 'div',
  IMAGE: 'img',
  LINE: 'hr',
  VECTOR: 'div',
  SYMBOL_MASTER: 'div',
  SYMBOL_INSTANCE: 'div',
};

/** 根据 fontSize 推断标题级别 */
function inferHeadingLevel(node: DesignNode): string | null {
  if (node.type !== 'TEXT') return null;
  // 简单启发式：依赖 textStyle 名称推断
  const style = (node.textStyle || node.name || '').toLowerCase();
  if (style.includes('h1') || style.includes('标题1') || style.includes('heading1')) return 'h1';
  if (style.includes('h2') || style.includes('标题2') || style.includes('heading2')) return 'h2';
  if (style.includes('h3') || style.includes('标题3') || style.includes('heading3')) return 'h3';
  return null;
}

/**
 * 生成 React + Tailwind 代码
 */
function generateReactTailwind(nodes: DesignNode[], options: CodeGenOptions, indent: number = 2): string {
  let code = '';
  const tab = ' '.repeat(indent);

  for (const node of nodes) {
    const tag = inferHeadingLevel(node) || TAG_MAP[node.type] || 'div';
    const classes = buildTailwindClasses(node);
    const styleStr = buildInlineStyle(node);

    const hasChildren = node.children && node.children.length > 0;

    if (tag === 'img') {
      code += `${tab}<img className="${classes}" style={${styleStr}} alt="${escapeHtml(node.name)}" />\n`;
    } else if (!hasChildren) {
      const content = node.text ? `{${JSON.stringify(node.text)}}` : '';
      code += `${tab}<${tag} className="${classes}" style={${styleStr}}>${content}</${tag}>\n`;
    } else {
      code += `${tab}<${tag} className="${classes}" style={${styleStr}}>\n`;
      code += generateReactTailwind(node.children!, options, indent + 2);
      code += `${tab}</${tag}>\n`;
    }
  }

  return code;
}

/**
 * 根据节点属性构建 Tailwind 类名
 */
function buildTailwindClasses(node: DesignNode): string {
  const classes: string[] = [];

  if (node.pos) {
    // 根据设计数据中的布局信息推断
    if (node.type === 'FRAME' || node.type === 'GROUP') {
      classes.push('flex', 'flex-col');
    }
  }

  // 文本样式
  if (node.textStyle) {
    const style = node.textStyle;
    if (style.includes('Bold') || style.includes('Semibold') || style.includes('Medium')) {
      classes.push('font-semibold');
    }
    if (style.includes('Center')) {
      classes.push('text-center');
    }
  }

  if (node.type === 'TEXT') {
    classes.push('text-sm');
  }

  return classes.join(' ');
}

/**
 * 构建内联样式
 */
function buildInlineStyle(node: DesignNode): string {
  const styles: string[] = [];

  if (node.pos) {
    styles.push(`position: 'absolute'`);
    styles.push(`left: ${node.pos.x}px`);
    styles.push(`top: ${node.pos.y}px`);
    styles.push(`width: ${node.pos.w}px`);
    styles.push(`height: ${node.pos.h}px`);
  }

  if (styles.length === 0) return '{}';

  return `{ ${styles.join(', ')} }`;
}

/**
 * 生成 Vue + Tailwind 代码
 */
function generateVueTailwind(nodes: DesignNode[], options: CodeGenOptions, indent: number = 2): string {
  let code = '';
  const tab = ' '.repeat(indent);

  for (const node of nodes) {
    const tag = inferHeadingLevel(node) || TAG_MAP[node.type] || 'div';
    const classes = buildTailwindClasses(node);
    const styleStr = buildInlineStyle(node);

    const hasChildren = node.children && node.children.length > 0;

    if (tag === 'img') {
      code += `${tab}<img class="${classes}" :style="${styleStr}" alt="${escapeHtml(node.name)}" />\n`;
    } else if (!hasChildren) {
      const content = node.text || '';
      code += `${tab}<${tag} class="${classes}" :style="${styleStr}">${content}</${tag}>\n`;
    } else {
      code += `${tab}<${tag} class="${classes}" :style="${styleStr}">\n`;
      code += generateVueTailwind(node.children!, options, indent + 2);
      code += `${tab}</${tag}>\n`;
    }
  }

  return code;
}

/**
 * 主入口：根据选项生成代码
 */
export function generateCode(nodes: DesignNode[], options: CodeGenOptions): GeneratedCode {
  const framework = options.framework;
  const styleLibrary = options.styleLibrary;

  let markup = '';
  let imports = '';

  if (framework === 'react') {
    imports = "import React from 'react';\n\n";
    imports += 'export default function Component() {\n';
    imports += '  return (\n';
    markup = '    <div className="relative w-full h-full">\n';
    markup += generateReactTailwind(nodes, options, 6);
    markup += '    </div>\n';
    imports += markup;
    imports += '  );\n}\n';
  } else {
    imports = '<template>\n';
    markup = '  <div class="relative w-full h-full">\n';
    markup += generateVueTailwind(nodes, options, 4);
    markup += '  </div>\n';
    imports += markup;
    imports += '</template>\n\n';
    imports += '<script setup>\n';
    imports += '// 从摹客设计稿生成\n';
    imports += '</script>\n';
  }

  return {
    markup,
    styles: '/* 内联样式已包含在组件中 */',
    imports,
  };
}

/** HTML 转义 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
