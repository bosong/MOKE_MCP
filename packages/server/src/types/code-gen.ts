/**
 * 代码生成选项类型
 */

/** 支持的框架 */
export type Framework = 'react' | 'vue';

/** 支持的样式方案 */
export type StyleLibrary = 'tailwind' | 'css-modules' | 'styled-components';

/** 代码生成配置 */
export interface CodeGenOptions {
  framework: Framework;
  styleLibrary: StyleLibrary;
  typescript: boolean;
}

/** 代码生成输出 */
export interface CodeGenOutput {
  /** 组件代码 */
  component: string;
  /** 样式代码 */
  styles: string;
  /** 导入语句 */
  imports: string[];
  /** 组件描述 */
  description: string;
}

/** 节点到 HTML 元素的映射 */
export type ElementMapping = Record<string, string>;

/** 默认映射 */
export const DEFAULT_ELEMENT_MAPPING: ElementMapping = {
  FRAME: 'div',
  GROUP: 'div',
  RECTANGLE: 'div',
  TEXT: 'span',
  IMAGE: 'img',
  ELLIPSE: 'div',
  LINE: 'hr',
};
