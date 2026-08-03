/**
 * code-gen.service.ts 单元测试
 * 验证从 token 表解析几何/样式并生成 React/Vue 代码(P0:旧实现依赖 node.pos)。
 */
import { describe, expect, it } from 'vitest';
import type { DesignData } from '../src/api/types.js';
import { generateCode } from '../src/services/code-gen.service.js';

const data: DesignData = {
  metadata: { name: '首页', pageId: 'p1', device: 'ios1x', size: { width: 375, height: 812 }, backgroundColor: '#FFFFFF' },
  nodes: [
    {
      id: 'root',
      name: '容器',
      type: 'FRAME',
      layout: 'layout_000001',
      children: [
        {
          id: 'title',
          name: '标题',
          type: 'TEXT',
          text: 'Hello',
          layout: 'layout_000002',
          textStyle: 'text_1',
        },
        {
          id: 'card',
          name: '卡片',
          type: 'RECTANGLE',
          layout: 'layout_000003',
          fills: 'fill_1',
          effects: 'effect_1',
          strokes: 'stroke_1',
          borderRadius: '8px',
        },
      ],
    },
  ],
  globalVars: {
    styles: {
      layout_000001: {
        locationRelativeToParent: { x: 0, y: 0 },
        dimensions: { width: 375, height: 812 },
      },
      layout_000002: {
        locationRelativeToParent: { x: 16, y: 24 },
        dimensions: { width: 200, height: 40 },
      },
      layout_000003: {
        locationRelativeToParent: { x: 16, y: 80 },
        dimensions: { width: 200, height: 100 },
      },
      fill_1: ['#F5F5F5'],
      stroke_1: { width: 1, color: '#CCC', position: 'center' },
      effect_1: { type: 'outside', offsetX: 0, offsetY: 4, blur: 8, spread: 0, color: '#0000001A' },
      text_1: {
        fontSize: 18,
        fontFamily: 'PingFang SC',
        fontWeight: 600,
        color: '#111111',
        lineHeight: 40,
        letterSpacing: 0,
        textAlignHorizontal: 'LEFT',
      },
    },
  },
  _meta: { coordinateSpace: 'parent-relative', unhandledFields: [] },
};

describe('generateCode (react)', () => {
  const code = generateCode(data, { framework: 'react', styleLibrary: 'tailwind', typescript: false });

  it('输出 React 组件外壳', () => {
    expect(code.imports).toContain("import React from 'react'");
    expect(code.imports).toContain('export default function Component()');
  });

  it('根画布尺寸来自 metadata.size', () => {
    expect(code.markup).toContain('width: 375');
    expect(code.markup).toContain('height: 812');
  });

  it('子节点解析为绝对定位(沿父链累加)', () => {
    // 卡片在根容器(0,0)内,坐标为自身相对值
    expect(code.markup).toContain(`left: 16px`);
    expect(code.markup).toContain(`top: 80px`);
    expect(code.markup).toContain(`width: 200px`);
    expect(code.markup).toContain(`height: 100px`);
  });

  it('视觉样式从 token 表解析', () => {
    expect(code.markup).toContain(`background: '#F5F5F5'`);
    expect(code.markup).toContain(`borderRadius: '8px'`);
    expect(code.markup).toContain(`border: '1px solid #CCC'`);
    expect(code.markup).toContain(`boxShadow: '0px 4px 8px 0px #0000001A'`);
  });

  it('文本节点带字号/字重/颜色', () => {
    expect(code.markup).toContain('fontSize: 18px');
    expect(code.markup).toContain('fontWeight: 600');
    expect(code.markup).toContain(`color: '#111111'`);
    // fontSize 18 → 推断为 h3;文本经 JSON.stringify 包裹
    expect(code.markup).toContain('>{"Hello"}</h3>');
  });
});

describe('generateCode (vue)', () => {
  const code = generateCode(data, { framework: 'vue', styleLibrary: 'tailwind', typescript: false });

  it('输出 Vue 模板', () => {
    expect(code.imports).toContain('<template>');
    expect(code.imports).toContain('<script setup>');
  });

  it('同样解析几何与样式', () => {
    expect(code.markup).toContain('left: 16px');
    expect(code.markup).toContain('background');
  });
});

describe('generateCode 容错', () => {
  it('空设计数据不崩溃', () => {
    const empty: DesignData = {
      metadata: { name: '', pageId: '', device: '', size: { width: 0, height: 0 }, backgroundColor: '' },
      nodes: [],
      globalVars: { styles: {} },
      _meta: { coordinateSpace: 'parent-relative', unhandledFields: [] },
    };
    const code = generateCode(empty, { framework: 'react', styleLibrary: 'tailwind', typescript: false });
    expect(code.imports).toContain('Component');
  });
});

describe('generateCode (swift)', () => {
  const code = generateCode(data, { framework: 'swift', styleLibrary: 'tailwind', typescript: false });

  it('输出 Swift + SnapKit 文件外壳', () => {
    expect(code.imports).toContain('import UIKit');
    expect(code.imports).toContain('import SnapKit');
    expect(code.imports).toContain('final class DesignView: UIView');
    expect(code.imports).toContain('override init(frame: CGRect)');
  });

  it('文本节点生成 UILabel 及字号/字重/颜色', () => {
    expect(code.imports).toContain('private let vtitle: UILabel');
    expect(code.imports).toContain('view.text = "Hello"');
    expect(code.imports).toContain('ofSize: 18, weight: .semibold');
    expect(code.imports).toContain('UIColor(red: 17/255, green: 17/255, blue: 17/255, alpha: 1)');
  });

  it('矩形节点生成背景/圆角/边框/阴影', () => {
    expect(code.imports).toContain('view.backgroundColor = UIColor(red: 245/255, green: 245/255, blue: 245/255, alpha: 1)');
    expect(code.imports).toContain('view.layer.cornerRadius = 8');
    expect(code.imports).toContain('view.layer.borderWidth = 1');
    expect(code.imports).toContain('view.layer.shadowOffset = CGSize(width: 0, height: 4)');
    expect(code.imports).toContain('view.layer.shadowRadius = 8');
  });

  it('SnapKit 约束为相对父容器偏移', () => {
    // 卡片相对根容器 (0,0): left=16 top=80 w=200 h=100
    expect(code.imports).toContain('make.left.equalToSuperview().offset(16)');
    expect(code.imports).toContain('make.top.equalToSuperview().offset(80)');
    expect(code.imports).toContain('make.width.equalTo(200)');
    expect(code.imports).toContain('make.height.equalTo(100)');
  });

  it('子视图挂载到父视图(addSubview)', () => {
    expect(code.imports).toContain('addSubview(vtitle)');
    expect(code.imports).toContain('vroot.addSubview(vtitle)');
    expect(code.imports).toContain('vroot.addSubview(vcard)');
  });

  it('ios2x 设计稿逻辑坐标除以 2', () => {
    const data2x: DesignData = {
      ...data,
      metadata: { ...data.metadata, device: 'ios2x', size: { width: 750, height: 1666 } },
    };
    const c2 = generateCode(data2x, { framework: 'swift', styleLibrary: 'tailwind', typescript: false });
    // 卡片 16/2=8, 80/2=40, 200/2=100, 100/2=50
    expect(c2.imports).toContain('make.left.equalToSuperview().offset(8)');
    expect(c2.imports).toContain('make.top.equalToSuperview().offset(40)');
    expect(c2.imports).toContain('make.width.equalTo(100)');
    expect(c2.imports).toContain('make.height.equalTo(50)');
    expect(c2.imports).toContain('ofSize: 9, weight: .semibold');
  });
});
