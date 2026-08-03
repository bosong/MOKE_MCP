/**
 * variable-extract.service.ts 单元测试
 * 覆盖 P0 回归:Mockplus 小写格式阴影(type: outside/inside)必须分类为 EFFECT。
 */
import { describe, expect, it } from 'vitest';
import type { DesignData } from '../src/api/types.js';
import { extractVariables } from '../src/services/variable-extract.service.js';

function mkData(styles: Record<string, unknown>): DesignData {
  return {
    metadata: { name: 't', pageId: 'p', device: 'ios1x', size: { width: 375, height: 812 }, backgroundColor: '' },
    nodes: [],
    globalVars: { styles },
    _meta: { coordinateSpace: 'parent-relative', unhandledFields: [] },
  };
}

describe('extractVariables', () => {
  it('Mockplus 小写格式阴影(单个对象)分类为 EFFECT', () => {
    const vars = extractVariables(mkData({
      effect_1: { type: 'outside', offsetX: 0, offsetY: 4, blur: 8, spread: 0, color: '#000' },
    }));
    expect(vars).toHaveLength(1);
    expect(vars[0].type).toBe('EFFECT');
  });

  it('Mockplus 阴影数组(多个 shadow)分类为 EFFECT', () => {
    const vars = extractVariables(mkData({
      effect_2: [
        { type: 'outside', offsetX: 0, offsetY: 2, blur: 4, color: '#000' },
        { type: 'inside', offsetX: 0, offsetY: 0, blur: 2, color: '#fff' },
      ],
    }));
    expect(vars).toHaveLength(1);
    expect(vars[0].type).toBe('EFFECT');
  });

  it('Sketch 语义仍兼容(DROP_SHADOW/INNER_SHADOW)', () => {
    const vars = extractVariables(mkData({
      effect_3: { type: 'DROP_SHADOW', offset: { x: 0, y: 4 }, blurRadius: 8, color: '#000' },
    }));
    expect(vars[0].type).toBe('EFFECT');
  });

  it('普通对象不做 EFFECT', () => {
    const vars = extractVariables(mkData({
      other_1: { foo: 'bar' },
    }));
    expect(vars[0].type).toBe('OTHER');
  });

  it('颜色/字体/间距分类不受影响', () => {
    const vars = extractVariables(mkData({
      color_1: '#FF0000',
      font_1: { fontFamily: 'Arial', fontSize: 16, fontWeight: 600 },
      spacing_1: 8,
    }));
    const byType = Object.fromEntries(vars.map((v) => [v.type, v]));
    expect(byType.COLOR).toBeDefined();
    expect(byType.FONT).toBeDefined();
    expect(byType.SPACING).toBeDefined();
  });
});
