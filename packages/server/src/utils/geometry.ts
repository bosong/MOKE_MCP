/**
 * 几何/样式解析工具
 * 从 transform 输出的 layout/fill/stroke/effect/textStyle token 引用中解析
 * 可消费的 CSS 几何与样式。设计数据使用 token 表(globalVars.styles)去重存储,
 * 节点只持有引用 key —— 消费方必须经此解析,不能直接读 node.pos(P0 修复)。
 */

import type { DesignNode, GlobalStyles } from '../api/types.js';

/** 解析后的几何(相对父偏移 + 尺寸) */
export interface Geometry {
  x: number;
  y: number;
  w: number;
  h: number;
}

type StyleSpec = Record<string, unknown>;

/** 节点 layout token → 相对父几何;拿不到返回 null */
export function resolveGeometry(node: DesignNode, styles: GlobalStyles): Geometry | null {
  if (!node.layout) return null;
  const spec = styles[node.layout];
  if (!spec || typeof spec !== 'object') return null;
  const s = spec as StyleSpec;
  const loc = s.locationRelativeToParent as { x?: number; y?: number } | undefined;
  const dim = s.dimensions as { width?: number; height?: number } | undefined;
  const x = typeof loc?.x === 'number' ? loc.x : undefined;
  const y = typeof loc?.y === 'number' ? loc.y : undefined;
  const w = typeof dim?.width === 'number' ? dim.width : undefined;
  const h = typeof dim?.height === 'number' ? dim.height : undefined;
  if (x === undefined || y === undefined || w === undefined || h === undefined) return null;
  return { x, y, w, h };
}

/**
 * 节点 → 画布绝对几何(用于生成 absolute 定位代码)。
 * relayout 后 locationRelativeToParent 是相对父偏移,沿父链累加;
 * v0.5 历史数据(无 parent-relative 标记)该字段实为绝对坐标,直接使用。
 */
export function resolveAbsolutePosition(
  node: DesignNode,
  styles: GlobalStyles,
  parents: DesignNode[],
  coordinateSpace?: string
): Geometry | null {
  const g = resolveGeometry(node, styles);
  if (!g) return null;
  if (coordinateSpace !== 'parent-relative') {
    return g;
  }
  let x = g.x;
  let y = g.y;
  for (let i = parents.length - 1; i >= 0; i--) {
    const pg = resolveGeometry(parents[i], styles);
    if (pg) {
      x += pg.x;
      y += pg.y;
    }
  }
  return { x, y, w: g.w, h: g.h };
}

/** 取 token spec(节点字段引用或对象直接给出两种形态) */
function specOf(ref: unknown, styles: GlobalStyles): StyleSpec | StyleSpec[] | string | null {
  if (typeof ref === 'string') {
    const s = styles[ref];
    if (typeof s === 'string') return s;
    if (s && typeof s === 'object') return s as StyleSpec | StyleSpec[];
    return null;
  }
  if (typeof ref === 'object' && ref !== null) return ref as StyleSpec | StyleSpec[];
  return null;
}

/** 解析 fills 引用 → CSS background 值;不支持/无值返回 null */
export function resolveFill(fills: string | string[] | undefined, styles: GlobalStyles): string | null {
  if (!fills) return null;
  const refs = Array.isArray(fills) ? fills : [fills];
  for (const ref of refs) {
    const spec = specOf(ref, styles);
    if (!spec) continue;
    const arr = Array.isArray(spec) ? spec : [spec];
    for (const entry of arr) {
      if (typeof entry === 'string') {
        if (entry.startsWith('#') || entry.startsWith('rgb')) return entry;
        continue;
      }
      const e = entry as StyleSpec;
      if (e.type === 'GRADIENT_LINEAR' && typeof e.gradient === 'string') return e.gradient;
      if (e.type === 'GRADIENT_RADIAL' && typeof e.gradient === 'string') return e.gradient;
      if (e.type === 'IMAGE') continue; // imageRef 无 URL,跳过
    }
  }
  return null;
}

/** 解析 textStyle 引用 → 样式对象;无返回 null */
export function resolveTextStyle(
  textStyle: string | undefined,
  styles: GlobalStyles
): StyleSpec | null {
  if (!textStyle) return null;
  const spec = specOf(textStyle, styles);
  if (!spec || Array.isArray(spec) || typeof spec === 'string') return null;
  return spec;
}

/** 解析 effects 引用 → CSS box-shadow 值;无返回 null */
export function resolveBoxShadow(
  effects: string | string[] | undefined,
  styles: GlobalStyles
): string | null {
  if (!effects) return null;
  const refs = Array.isArray(effects) ? effects : [effects];
  const shadows: string[] = [];
  for (const ref of refs) {
    const spec = specOf(ref, styles);
    if (!spec || typeof spec === 'string') continue;
    const arr = Array.isArray(spec) ? spec : [spec];
    for (const entry of arr) {
      const e = entry as StyleSpec;
      if (typeof e !== 'object' || e === null) continue;
      const color = typeof e.color === 'string' ? e.color : '#000';
      const ox = typeof e.offsetX === 'number' ? e.offsetX : 0;
      const oy = typeof e.offsetY === 'number' ? e.offsetY : 0;
      const blur = typeof e.blur === 'number' ? e.blur : 0;
      const spread = typeof e.spread === 'number' ? e.spread : 0;
      const inset = e.type === 'inside' ? ' inset' : '';
      shadows.push(`${ox}px ${oy}px ${blur}px ${spread}px ${color}${inset}`);
    }
  }
  return shadows.length > 0 ? shadows.join(', ') : null;
}

/** 解析 strokes 引用 → CSS border 值(取第一条) */
export function resolveBorder(
  strokes: string | string[] | undefined,
  styles: GlobalStyles
): string | null {
  if (!strokes) return null;
  const refs = Array.isArray(strokes) ? strokes : [strokes];
  const spec = specOf(refs[0], styles);
  if (!spec || Array.isArray(spec) || typeof spec === 'string') return null;
  const s = spec as StyleSpec;
  const width = typeof s.width === 'number' ? s.width : 1;
  const color = typeof s.color === 'string' ? s.color : '#000';
  return `${width}px solid ${color}`;
}
