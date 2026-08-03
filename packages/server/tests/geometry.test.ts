/**
 * geometry.ts 单元测试
 * 验证 layout/fill/effect/textStyle token 引用解析(修复 node.pos 依赖的 P0)。
 */
import { describe, expect, it } from 'vitest';
import type { DesignNode, GlobalStyles } from '../src/api/types.js';
import {
  resolveAbsolutePosition,
  resolveBorder,
  resolveBoxShadow,
  resolveFill,
  resolveGeometry,
  resolveTextStyle,
} from '../src/utils/geometry.js';

const styles: GlobalStyles = {
  layout_000001: {
    mode: 'none',
    sizing: { horizontal: 'fixed', vertical: 'fixed' },
    locationRelativeToParent: { x: 100, y: 200 },
    dimensions: { width: 300, height: 400 },
  },
  layout_000002: {
    locationRelativeToParent: { x: 10, y: 20 },
    dimensions: { width: 50, height: 60 },
  },
  fill_red: ['#FF0000'],
  fill_grad: [{ type: 'GRADIENT_LINEAR', gradient: 'linear-gradient(45deg, #000 0%, #FFF 100%)' }],
  fill_img: [{ type: 'IMAGE', imageRef: 'abc123', scaleMode: 'FILL' }],
  effect_shadow: { type: 'outside', offsetX: 0, offsetY: 4, blur: 8, spread: 0, color: '#00000040' },
  effect_inset: { type: 'inside', offsetX: 0, offsetY: 2, blur: 4, spread: 0, color: '#000' },
  stroke_1: { width: 2, color: '#333', position: 'center' },
  text_1: {
    fontSize: 16,
    fontFamily: 'PingFang SC',
    fontWeight: 600,
    color: '#111',
    lineHeight: 22,
    letterSpacing: 0.5,
    textAlignHorizontal: 'CENTER',
  },
};

function node(partial: Partial<DesignNode>): DesignNode {
  return { id: 'n1', name: 'n', type: 'RECTANGLE', ...partial };
}

describe('resolveGeometry', () => {
  it('从 layout token 解析相对父几何', () => {
    expect(resolveGeometry(node({ layout: 'layout_000001' }), styles)).toEqual({
      x: 100, y: 200, w: 300, h: 400,
    });
  });

  it('无 layout 或 spec 不完整返回 null', () => {
    expect(resolveGeometry(node({}), styles)).toBeNull();
    expect(resolveGeometry(node({ layout: 'layout_missing' }), styles)).toBeNull();
  });
});

describe('resolveAbsolutePosition', () => {
  it('parent-relative 时沿父链累加', () => {
    const parent = node({ layout: 'layout_000001' });
    const child = node({ layout: 'layout_000002' });
    expect(resolveAbsolutePosition(child, styles, [parent], 'parent-relative')).toEqual({
      x: 110, y: 220, w: 50, h: 60,
    });
  });

  it('v0.5 历史数据(非 parent-relative)直接用 rel 坐标', () => {
    const child = node({ layout: 'layout_000002' });
    expect(resolveAbsolutePosition(child, styles, [node({ layout: 'layout_000001' })])).toEqual({
      x: 10, y: 20, w: 50, h: 60,
    });
  });
});

describe('resolveFill', () => {
  it('solid hex', () => {
    expect(resolveFill('fill_red', styles)).toBe('#FF0000');
  });

  it('linear gradient', () => {
    expect(resolveFill('fill_grad', styles)).toBe('linear-gradient(45deg, #000 0%, #FFF 100%)');
  });

  it('IMAGE fill 跳过(无 URL),返回 null', () => {
    expect(resolveFill('fill_img', styles)).toBeNull();
  });

  it('数组引用逐项解析', () => {
    expect(resolveFill(['fill_img', 'fill_red'], styles)).toBe('#FF0000');
  });

  it('undefined 返回 null', () => {
    expect(resolveFill(undefined, styles)).toBeNull();
  });
});

describe('resolveBoxShadow', () => {
  it('outside → 无 inset', () => {
    expect(resolveBoxShadow('effect_shadow', styles)).toBe('0px 4px 8px 0px #00000040');
  });

  it('inside → inset 前缀', () => {
    expect(resolveBoxShadow('effect_inset', styles)).toBe('0px 2px 4px 0px #000 inset');
  });

  it('多效果合并', () => {
    expect(resolveBoxShadow(['effect_shadow', 'effect_inset'], styles)).toBe(
      '0px 4px 8px 0px #00000040, 0px 2px 4px 0px #000 inset'
    );
  });
});

describe('resolveBorder / resolveTextStyle', () => {
  it('stroke → CSS border', () => {
    expect(resolveBorder('stroke_1', styles)).toBe('2px solid #333');
  });

  it('textStyle 解析', () => {
    expect(resolveTextStyle('text_1', styles)).toMatchObject({ fontSize: 16, fontWeight: 600 });
  });
});
