/**
 * 代码生成服务
 * 将设计数据转换为前端代码（React/Vue + Tailwind/CSS）
 *
 * 修复说明(P0):
 *  - 旧实现依赖不存在的 node.pos —— transform 输出只含 layout token 引用,
 *    几何/样式必须经 geometry.ts 从 globalVars.styles 解析。
 *  - TAG_MAP 补齐 SLICE/MASK;IMAGE 无可用 URL,按容器输出背景图占位。
 */

import type { DesignData, DesignNode, GlobalStyles } from '../api/types.js';
import {
  resolveAbsolutePosition,
  resolveBorder,
  resolveBoxShadow,
  resolveFill,
  resolveTextStyle,
} from '../utils/geometry.js';

/** 代码生成选项 */
export interface CodeGenOptions {
  framework: 'react' | 'vue' | 'swift';
  styleLibrary: 'tailwind' | 'css-modules' | 'styled-components';
  typescript: boolean;
}

/** 生成的代码块 */
export interface GeneratedCode {
  markup: string;
  styles: string;
  imports: string;
}

/** 节点类型 → HTML 标签映射(transform v5 大写类型) */
const TAG_MAP: Record<string, string> = {
  DOCUMENT: 'div',
  PAGE: 'div',
  FRAME: 'div',
  GROUP: 'div',
  TEXT: 'span',
  RECTANGLE: 'div',
  ELLIPSE: 'div',
  LINE: 'div',
  VECTOR: 'div',
  SLICE: 'div',
  MASK: 'div',
  INSTANCE: 'div',
  SYMBOL_MASTER: 'div',
  SYMBOL_INSTANCE: 'div',
};

/** 根据 textStyle 推断标题级别 */
function inferHeadingLevel(node: DesignNode, styles: GlobalStyles): string | null {
  if (node.type !== 'TEXT') return null;
  const ts = resolveTextStyle(node.textStyle, styles);
  const size = typeof ts?.fontSize === 'number' ? ts.fontSize : 0;
  if (size >= 28) return 'h1';
  if (size >= 22) return 'h2';
  if (size >= 18) return 'h3';
  return null;
}

/**
 * 生成 React + Tailwind 代码
 */
function generateReactTailwind(
  nodes: DesignNode[],
  styles: GlobalStyles,
  coordinateSpace: string | undefined,
  parents: DesignNode[],
  indent: number = 2
): string {
  let code = '';
  const tab = ' '.repeat(indent);

  for (const node of nodes) {
    const tag = inferHeadingLevel(node, styles) || TAG_MAP[node.type] || 'div';
    const classes = buildTailwindClasses(node, styles);
    const styleStr = buildInlineStyle(node, styles, coordinateSpace, parents);

    const hasChildren = node.children && node.children.length > 0;

    if (!hasChildren) {
      const content = node.text ? `{${JSON.stringify(node.text)}}` : '';
      code += `${tab}<${tag} className="${classes}" style={${styleStr}}>${content}</${tag}>\n`;
    } else {
      code += `${tab}<${tag} className="${classes}" style={${styleStr}}>\n`;
      code += generateReactTailwind(node.children!, styles, coordinateSpace, [...parents, node], indent + 2);
      code += `${tab}</${tag}>\n`;
    }
  }

  return code;
}

/**
 * 生成 Vue + Tailwind 代码
 */
function generateVueTailwind(
  nodes: DesignNode[],
  styles: GlobalStyles,
  coordinateSpace: string | undefined,
  parents: DesignNode[],
  indent: number = 2
): string {
  let code = '';
  const tab = ' '.repeat(indent);

  for (const node of nodes) {
    const tag = inferHeadingLevel(node, styles) || TAG_MAP[node.type] || 'div';
    const classes = buildTailwindClasses(node, styles);
    const styleStr = buildInlineStyle(node, styles, coordinateSpace, parents);

    const hasChildren = node.children && node.children.length > 0;

    if (!hasChildren) {
      const content = node.text || '';
      code += `${tab}<${tag} class="${classes}" :style="${styleStr}">${content}</${tag}>\n`;
    } else {
      code += `${tab}<${tag} class="${classes}" :style="${styleStr}">\n`;
      code += generateVueTailwind(node.children!, styles, coordinateSpace, [...parents, node], indent + 2);
      code += `${tab}</${tag}>\n`;
    }
  }

  return code;
}

/**
 * 根据节点属性构建 Tailwind 类名
 */
function buildTailwindClasses(node: DesignNode, styles: GlobalStyles): string {
  const classes: string[] = [];

  if (node.type === 'FRAME' || node.type === 'GROUP') {
    classes.push('flex', 'flex-col');
  }

  // 文本样式
  if (node.type === 'TEXT') {
    const ts = resolveTextStyle(node.textStyle, styles);
    const align = ts?.textAlignHorizontal;
    if (align === 'CENTER') classes.push('text-center');
    if (align === 'RIGHT') classes.push('text-right');
    if (typeof ts?.fontWeight === 'number' && ts.fontWeight >= 600) classes.push('font-semibold');
  }

  return classes.join(' ');
}

/**
 * 构建内联样式(绝对定位 + 从 token 表解析的视觉样式)
 */
function buildInlineStyle(
  node: DesignNode,
  styles: GlobalStyles,
  coordinateSpace: string | undefined,
  parents: DesignNode[]
): string {
  const css: string[] = [];

  const geo = resolveAbsolutePosition(node, styles, parents, coordinateSpace);
  if (geo) {
    css.push(`position: 'absolute'`);
    css.push(`left: ${geo.x}px`);
    css.push(`top: ${geo.y}px`);
    css.push(`width: ${geo.w}px`);
    css.push(`height: ${geo.h}px`);
  }

  const fill = resolveFill(node.fills as string | string[] | undefined, styles);
  if (fill) {
    css.push(`background: '${fill}'`);
  } else if (node.type === 'IMAGE') {
    css.push(`background: '#E5E7EB'`); // 图片无 URL,灰底占位
  }

  if (node.borderRadius) {
    css.push(`borderRadius: '${node.borderRadius}'`);
  }

  const border = resolveBorder(node.strokes as string | string[] | undefined, styles);
  if (border) {
    css.push(`border: '${border}'`);
  }

  const shadow = resolveBoxShadow(node.effects as string | string[] | undefined, styles);
  if (shadow) {
    css.push(`boxShadow: '${shadow}'`);
  }

  if (typeof node.opacity === 'number' && node.opacity < 1) {
    css.push(`opacity: ${node.opacity}`);
  }

  if (node.type === 'TEXT') {
    const ts = resolveTextStyle(node.textStyle, styles);
    if (ts) {
      if (typeof ts.fontSize === 'number') css.push(`fontSize: ${ts.fontSize}px`);
      if (typeof ts.fontFamily === 'string' && ts.fontFamily) css.push(`fontFamily: '${ts.fontFamily}'`);
      if (typeof ts.fontWeight === 'number') css.push(`fontWeight: ${ts.fontWeight}`);
      if (ts.fontStyle === 'italic') css.push(`fontStyle: 'italic'`);
      if (typeof ts.color === 'string') css.push(`color: '${ts.color}'`);
      if (typeof ts.lineHeight === 'number') css.push(`lineHeight: ${ts.lineHeight}px`);
      if (typeof ts.letterSpacing === 'number' && ts.letterSpacing !== 0) {
        css.push(`letterSpacing: ${ts.letterSpacing}px`);
      }
      if (ts.textAlignHorizontal === 'CENTER') css.push(`textAlign: 'center'`);
      if (ts.textAlignHorizontal === 'RIGHT') css.push(`textAlign: 'right'`);
    }
  }

  if (css.length === 0) return '{}';

  return `{ ${css.join(', ')} }`;
}

/**
 * ─────────────────────────────────────────────────────────────
 * Swift + SnapKit 生成 (framework: 'swift')
 * 布局: UIView 层级 + SnapKit 约束,绝对定位等价还原设计稿
 * ─────────────────────────────────────────────────────────────
 */

/** CSS 颜色 → UIColor 构造表达式;渐变等复杂值返回 null(不支持) */
function swiftColor(css: string | null): string | null {
  if (!css) return null;
  let m = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(css.trim());
  if (m) {
    const r = parseInt(m[1].slice(0, 2), 16);
    const g = parseInt(m[1].slice(2, 4), 16);
    const b = parseInt(m[1].slice(4, 6), 16);
    const a = m[2] ? Math.round((parseInt(m[2], 16) / 255) * 1000) / 1000 : 1;
    return `UIColor(red: ${r}/255, green: ${g}/255, blue: ${b}/255, alpha: ${a})`;
  }
  m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(css.trim());
  if (m) {
    const a = m[4] ? parseFloat(m[4]) : 1;
    return `UIColor(red: ${m[1]}/255, green: ${m[2]}/255, blue: ${m[3]}/255, alpha: ${a})`;
  }
  return null;
}

/** 颜色 alpha 提取(阴影透明度用) */
function colorAlpha(css: string | null): number {
  if (!css) return 1;
  let m = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(css.trim());
  if (m && m[2]) return Math.round((parseInt(m[2], 16) / 255) * 100) / 100;
  m = /^rgba?\(\d+,\s*\d+,\s*\d+(?:,\s*([\d.]+))?\)$/.exec(css.trim());
  if (m && m[1]) return parseFloat(m[1]);
  return 1;
}

/** 字重 → Swift UIFont.Weight */
function swiftWeight(w: number): string {
  if (w >= 700) return '.bold';
  if (w >= 600) return '.semibold';
  if (w >= 500) return '.medium';
  return '.regular';
}

/** 解析 "1px solid #333" → 边框参数 */
function parseCssBorder(border: string | null): { width: number; color: string } | null {
  if (!border) return null;
  const m = /^([\d.]+)px\s+solid\s+(.+)$/.exec(border.trim());
  if (!m) return null;
  return { width: parseFloat(m[1]), color: m[2].trim() };
}

/** 解析 "ox oy blur spread color" → 阴影参数(inset 不支持) */
function parseBoxShadow(shadow: string | null): {
  ox: number; oy: number; blur: number; color: string;
} | null {
  if (!shadow) return null;
  const m = /^(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(.*)$/.exec(shadow.trim());
  if (!m) return null;
  return { ox: parseFloat(m[1]), oy: parseFloat(m[2]), blur: parseFloat(m[3]), color: m[5]?.trim() ?? '' };
}

/** Swift 字符串字面量转义 */
function swiftString(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
}

/** 数值格式化(保留 2 位小数,去掉多余 0) */
function fmt(v: number): string {
  return String(Math.round(v * 100) / 100);
}

/** 节点 → Swift 控件类型 */
function swiftClassOf(node: DesignNode): string {
  if (node.type === 'TEXT') return 'UILabel';
  if (node.type === 'IMAGE') return 'UIImageView';
  return 'UIView';
}

/** 收集 Swift 视图: 属性定义 / setupUI / 约束 */
interface SwiftCollector {
  properties: string[];
  setupUI: string[];
  constraints: string[];
}

function collectSwift(
  nodes: DesignNode[],
  styles: GlobalStyles,
  coordinateSpace: string | undefined,
  parents: DesignNode[],
  parentAbs: { x: number; y: number } | null,
  scale: number,
  out: SwiftCollector
): void {
  for (const node of nodes) {
    const geo = resolveAbsolutePosition(node, styles, parents, coordinateSpace);
    if (!geo) continue;

    const name = node.id ? `v${node.id}` : `v${out.properties.length}`;
    const w = geo.w / scale;
    const h = geo.h / scale;
    const relX = (geo.x - (parentAbs ? parentAbs.x : 0)) / scale;
    const relY = (geo.y - (parentAbs ? parentAbs.y : 0)) / scale;

    // ── 属性定义(闭包内配置视觉样式) ──────────────────────────
    const lines: string[] = [];
    const label = (node.name || 'unnamed').replace(/\n/g, ' ').slice(0, 60);
    lines.push(`    // ${label} [${node.type}]`);
    lines.push(`    private let ${name}: ${swiftClassOf(node)} = {`);
    lines.push(`        let view = ${swiftClassOf(node)}()`);

    if (node.type === 'TEXT') {
      const ts = resolveTextStyle(node.textStyle, styles);
      if (node.text !== undefined) lines.push(`        view.text = "${swiftString(node.text)}"`);
      if (ts) {
        if (typeof ts.fontSize === 'number') {
          const size = fmt(ts.fontSize / scale);
          const weight = typeof ts.fontWeight === 'number' ? swiftWeight(ts.fontWeight) : '.regular';
          lines.push(`        view.font = ${ts.fontStyle === 'italic' ? '.italicSystemFont' : '.systemFont'}(ofSize: ${size}, weight: ${weight})`);
        }
        const color = swiftColor(typeof ts.color === 'string' ? ts.color : null);
        if (color) lines.push(`        view.textColor = ${color}`);
        if (ts.textAlignHorizontal === 'CENTER') lines.push('        view.textAlignment = .center');
        if (ts.textAlignHorizontal === 'RIGHT') lines.push('        view.textAlignment = .right');
        if (typeof ts.lineHeight === 'number' && ts.lineHeight / scale > 0) {
          lines.push(`        // lineHeight: ${fmt(ts.lineHeight / scale)} (UILabel 需 attributedText 才生效)`);
        }
      }
      lines.push('        view.numberOfLines = 0');
    } else {
      const fill = resolveFill(node.fills as string | string[] | undefined, styles);
      const bgColor = swiftColor(fill);
      if (bgColor) {
        lines.push(`        view.backgroundColor = ${bgColor}`);
      } else if (node.type === 'IMAGE') {
        lines.push('        view.backgroundColor = UIColor(red: 229/255, green: 231/255, blue: 235/255, alpha: 1) // 图片无 URL,灰底占位');
      }
      if (fill && !bgColor) {
        lines.push('        // 渐变填充: CAGradientLayer 需手动实现,此处省略');
      }

      // 圆角 / 圆形
      if (node.borderRadius) {
        const r = parseFloat(String(node.borderRadius).replace('px', '')) / scale;
        if (!Number.isNaN(r)) lines.push(`        view.layer.cornerRadius = ${fmt(r)}`);
      } else if (node.type === 'ELLIPSE') {
        lines.push(`        view.layer.cornerRadius = ${fmt(Math.min(w, h) / 2)}`);
      }

      // 边框
      const border = parseCssBorder(resolveBorder(node.strokes as string | string[] | undefined, styles));
      if (border) {
        const bc = swiftColor(border.color);
        lines.push(`        view.layer.borderWidth = ${fmt(border.width / scale)}`);
        if (bc) lines.push(`        view.layer.borderColor = ${bc}.cgColor`);
      } else if (node.type === 'LINE') {
        // 直线: 用描边色填充
        const stroke = resolveBorder(node.strokes as string | string[] | undefined, styles);
        const sc = swiftColor(parseCssBorder(stroke)?.color ?? null);
        if (sc) lines.push(`        view.backgroundColor = ${sc}`);
      }

      // 阴影
      const shadow = parseBoxShadow(resolveBoxShadow(node.effects as string | string[] | undefined, styles));
      if (shadow) {
        const sc = swiftColor(shadow.color);
        if (sc) {
          lines.push(`        view.layer.shadowColor = ${sc}.cgColor`);
          lines.push(`        view.layer.shadowOpacity = ${colorAlpha(shadow.color)}`);
          lines.push(`        view.layer.shadowOffset = CGSize(width: ${fmt(shadow.ox / scale)}, height: ${fmt(shadow.oy / scale)})`);
          lines.push(`        view.layer.shadowRadius = ${fmt(shadow.blur / scale)}`);
        }
      }
    }

    if (typeof node.opacity === 'number' && node.opacity < 1) {
      lines.push(`        view.alpha = ${node.opacity}`);
    }
    lines.push('        return view');
    lines.push('    }()');

    out.properties.push(lines.join('\n'));

    // ── setupUI: 挂到父容器 ─────────────────────────────────
    if (parentAbs) {
      const pid = parents[parents.length - 1]?.id;
      const pname = pid ? `v${pid}` : 'rootView';
      out.setupUI.push(`        ${pname}.addSubview(${name})`);
    } else {
      out.setupUI.push(`        addSubview(${name})`);
    }

    // ── 约束(SnapKit 绝对定位) ──────────────────────────────
    const c: string[] = [];
    c.push(`        ${name}.snp.makeConstraints { make in`);
    c.push(`            make.left.equalToSuperview().offset(${fmt(relX)})`);
    c.push(`            make.top.equalToSuperview().offset(${fmt(relY)})`);
    c.push(`            make.width.equalTo(${fmt(w)})`);
    c.push(`            make.height.equalTo(${fmt(h)})`);
    c.push('        }');
    out.constraints.push(c.join('\n'));

    // ── 递归子节点 ──────────────────────────────────────────
    if (node.children && node.children.length > 0) {
      collectSwift(node.children, styles, coordinateSpace, [...parents, node], { x: geo.x, y: geo.y }, scale, out);
    }
  }
}

/**
 * 生成 Swift + SnapKit 代码
 * @param data 设计数据
 * @param scale 逻辑坐标缩放(ios2x 设计稿为 750x1666 → 375x833)
 */
function generateSwiftSnapKit(data: DesignData, scale: number): string {
  const nodes = data.nodes || [];
  const styles = data.globalVars?.styles || {};
  const coordinateSpace = data._meta?.coordinateSpace;
  const { width = 375, height = 812 } = data.metadata?.size || {};
  const bg = swiftColor(data.metadata?.backgroundColor ?? null);

  const out: SwiftCollector = { properties: [], setupUI: [], constraints: [] };
  collectSwift(nodes, styles, coordinateSpace, [], null, scale, out);

  const header = `import UIKit
import SnapKit

// 由 Moke MCP code-gen 生成 (framework: swift, SnapKit 布局)
// 设计稿: ${data.metadata?.name ?? ''} (${width}x${height}, ${data.metadata?.device ?? ''}) → 逻辑坐标已 /${scale}

final class DesignView: UIView {

    // MARK: - Subviews
`;

  const body = out.properties.join('\n\n');

  const uiSection = `
    // MARK: - Init

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = ${bg ?? '.white'}
        setupUI()
        setupConstraints()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    // MARK: - UI Setup

    private func setupUI() {
${out.setupUI.join('\n')}
    }

    // MARK: - Constraints

    private func setupConstraints() {
${out.constraints.join('\n\n')}
    }
}
`;

  return header + body + uiSection;
}

/**
 * 主入口：根据设计数据生成代码
 */
export function generateCode(data: DesignData, options: CodeGenOptions): GeneratedCode {
  const nodes = data.nodes || [];
  const styles = data.globalVars?.styles || {};
  const coordinateSpace = data._meta?.coordinateSpace;
  const framework = options.framework;
  const { width = 375, height = 812 } = data.metadata?.size || {};

  let markup = '';
  let imports = '';

  if (framework === 'react') {
    imports = "import React from 'react';\n\n";
    imports += 'export default function Component() {\n';
    imports += '  return (\n';
    markup = `    <div className="relative overflow-hidden" style={{width: ${width}, height: ${height}}}>\n`;
    markup += generateReactTailwind(nodes, styles, coordinateSpace, [], 6);
    markup += '    </div>\n';
    imports += markup;
    imports += '  );\n}\n';
  } else if (framework === 'vue') {
    imports = '<template>\n';
    markup = `  <div class="relative overflow-hidden" style="width: ${width}px; height: ${height}px">\n`;
    markup += generateVueTailwind(nodes, styles, coordinateSpace, [], 4);
    markup += '  </div>\n';
    imports += markup;
    imports += '</template>\n\n';
    imports += '<script setup>\n';
    imports += '// 从摹客设计稿生成\n';
    imports += '</script>\n';
  } else {
    // swift: ios2x 设计稿(750x1666 等)逻辑坐标除以 2
    const device = data.metadata?.device || '';
    const scale = /2x|@2x/i.test(device) ? 2 : 1;
    const swift = generateSwiftSnapKit(data, scale);
    return {
      markup: swift,
      styles: '// SnapKit 约束已内联在生成的 Swift 文件中',
      imports: swift,
    };
  }

  return {
    markup,
    styles: '/* 内联样式已包含在组件中 */',
    imports,
  };
}
