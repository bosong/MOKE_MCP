/**
 * Mockplus API 数据类型定义
 * 基于 mockplus-context (https://github.com/MySwallow/mockplus-context) 的 API 响应结构
 */

/** 页面元信息（来自 index API） */
export interface PageMeta {
  id: string;
  name: string;
  path: string;
  parentID: string;
  device: string;
  size: { width: number; height: number };
  backgroundColor: string;
  dataURL: string;
  imageURL: string;
  slicesCount: number;
  updatedAt: string;
}

/** 分组信息 */
export interface GroupInfo {
  id: string;
  name: string;
  path: string;
  parentID: string;
  childIds: string[];
}

/** Index API 响应 */
export interface IndexResponse {
  code: number;
  message?: string;
  payload: {
    pages: Array<{
      _id: string;
      name: string;
      children?: unknown[];
      isGroup?: boolean;
      dataURL?: string;
      imageURL?: string;
      device?: string;
      size?: { width: number; height: number };
      backgroundColor?: string;
      slicesCount?: number;
      updatedAt?: string;
      parentID?: string;
    }>;
  };
}

/** 页面树节点（用于 get_metadata） */
export interface PageTreeNode {
  id: string;
  name: string;
  type: 'page' | 'group';
  children?: PageTreeNode[];
}

/** 设计数据节点（来自 Sketch JSON） */
export interface DesignNode {
  id: string;
  name: string;
  type: string;
  children?: DesignNode[];
  pos?: { x: number; y: number; w: number; h: number };
  absolutePosition?: { x: number; y: number };
  fills?: string;
  text?: string;
  textStyle?: string;
  adoptedBy?: string;
}

/** 全局样式表 */
export interface GlobalStyles {
  [key: string]: unknown;
}

/** 元信息 */
export interface DesignMeta {
  coordinateSpace: string;
  relayout?: {
    reparented: number;
    zFilter?: string;
  };
  unhandledFields: string[];
  distilled?: boolean;
  distillWarnings?: string[];
}

/** 完整设计数据 */
export interface DesignData {
  metadata: {
    name: string;
    pageId: string;
    device: string;
    size: { width: number; height: number };
    backgroundColor: string;
    components?: Record<string, unknown>;
  };
  nodes: DesignNode[];
  globalVars: {
    styles: GlobalStyles;
  };
  _meta: DesignMeta;
}

/** 切图信息 */
export interface SliceInfo {
  hash: string;
  name: string;
  sourceID: string;
  bitmapURL: string;
  svgURL: string;
  width: number;
  height: number;
}

/** cookie 状态 */
export interface CookieStatus {
  path: string;
  exists: boolean;
  mode?: string;
  set_at?: number;
  expires_at?: number;
  days_left?: number;
}

/** Python 子进程执行结果 */
export interface PythonResult {
  stdout: string;
  stderr: string;
  code: number;
}

/** 错误码（对应 mockplus-context 退出码） */
export enum MockplusExitCode {
  SUCCESS = 0,
  CLI_ERROR = 2,
  COOKIE_NOT_CONFIGURED = 10,
  FILE_NOT_FOUND = 11,
  COOKIE_EMPTY = 12,
  HTTP_ERROR = 14,
  COOKIE_REJECTED = 15,
  API_ERROR = 21,
  TARGET_MISMATCH = 22,
}
