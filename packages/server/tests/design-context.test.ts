/**
 * design-context.service.ts 单元测试
 */
import { describe, expect, it } from 'vitest';
import type { DesignNode, PageTreeNode } from '../src/api/types.js';
import {
  buildMetadataXml,
  buildPageTreeXml,
  jsonToYaml,
} from '../src/services/design-context.service.js';

describe('buildMetadataXml', () => {
  it('输出层级 XML 且转义属性', () => {
    const nodes: DesignNode[] = [
      {
        id: 'a',
        name: 'A&B',
        type: 'FRAME',
        pos: { x: 0, y: 0, w: 100, h: 100 },
        children: [
          { id: 'b', name: '子', type: 'TEXT', pos: { x: 10, y: 10, w: 20, h: 20 } },
        ],
      },
    ];
    const xml = buildMetadataXml(nodes);
    expect(xml).toContain('<FRAME id="a" name="A&amp;B" x="0" y="0" width="100" height="100">');
    expect(xml).toContain('<TEXT id="b"');
    expect(xml).toContain('</FRAME>');
  });
});

describe('buildPageTreeXml', () => {
  it('区分 PAGE/GROUP 标签', () => {
    const tree: PageTreeNode[] = [
      { id: 'g1', name: '组', type: 'group', children: [{ id: 'p1', name: '页', type: 'page' }] },
    ];
    const xml = buildPageTreeXml(tree);
    expect(xml).toContain('<GROUP id="g1"');
    expect(xml).toContain('<PAGE id="p1"');
    expect(xml).toContain('</GROUP>');
  });
});

describe('jsonToYaml', () => {
  it('简单对象转 YAML', () => {
    expect(jsonToYaml({ a: 1, b: 'x' })).toContain('a: 1');
    expect(jsonToYaml({ a: 1, b: 'x' })).toContain('b: x');
  });

  it('嵌套对象与数组', () => {
    const yaml = jsonToYaml({ list: [{ x: 1 }, { x: 2 }], nested: { y: 3 } });
    expect(yaml).toContain('list:');
    expect(yaml).toContain('x: 1');
    expect(yaml).toContain('x: 2');
    expect(yaml).toContain('nested:');
    expect(yaml).toContain('y: 3');
  });

  it('null/undefined 处理', () => {
    expect(jsonToYaml(null)).toBe('null');
  });
});
