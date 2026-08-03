/**
 * MCP Server 初始化 & Tool 注册
 * 基于 HTTP API（通过 Python 子进程调用 mockplus-context）
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { formatErrorForMcp } from '../utils/error-handler.js';
import { logger } from '../utils/logger.js';
import {
  parseMockplusUrl,
  fetchPageTreeForMetadata,
  fetchDesignData,
  fetchDesignDataYaml,
  fetchAllAssets,
  downloadImages,
  verifyPythonEnv,
} from '../api/client.js';
import type { DesignNode } from '../api/types.js';
import { buildMetadataXml, buildPageTreeXml, formatDesignData } from '../services/design-context.service.js';
import { getDesignScreenshot, getAssetImages } from '../services/screenshot.service.js';
import { extractVariables, generateDesignSystemRules } from '../services/variable-extract.service.js';
import * as os from 'os';
import * as path from 'path';

/** 创建 MCP Server 实例 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'moke-mcp',
    version: '0.2.0',
  });

  // ─── Tool: get_metadata ─────────────────────────────────
  server.tool(
    'get_metadata',
    '获取摹客设计文件的元数据（XML 格式的页面/节点层级树）。输入摹客 DT URL，返回页面和分组的层级结构。',
    {
      url: z.string().describe('摹客设计稿 URL，格式: https://app.mockplus.cn/app/{APP_ID}/develop/design/{PAGE_ID}'),
    },
    async ({ url }) => {
      try {
        const { appId } = parseMockplusUrl(url);
        const tree = await fetchPageTreeForMetadata(url);

        // 构建 XML
        let xml = '<DOCUMENT>\n';
        xml += `  <APP id="${appId}" name="${appId}">\n`;
        xml += buildPageTreeXml(tree, 2);
        xml += `  </APP>\n`;
        xml += '</DOCUMENT>\n';

        return {
          content: [{ type: 'text', text: xml }],
        };
      } catch (err) {
        return formatErrorForMcp(err);
      }
    }
  );

  // ─── Tool: get_design_context ────────────────────────────
  server.tool(
    'get_design_context',
    '获取摹客设计文件的完整设计上下文（布局、样式、颜色、排版、节点树等）。返回结构化 YAML 数据，可直接用于代码生成。',
    {
      url: z.string().describe('摹客设计稿 URL'),
      format: z.enum(['json', 'yaml']).optional().default('yaml').describe('输出格式，yaml 格式更适合 AI 消费'),
    },
    async ({ url, format }) => {
      try {
        parseMockplusUrl(url);

        let output: string;

        if (format === 'yaml') {
          output = await fetchDesignDataYaml(url);
        } else {
          const data = await fetchDesignData(url, { format: 'json' });
          output = JSON.stringify(data, null, 2);
        }

        return {
          content: [{ type: 'text', text: output }],
        };
      } catch (err) {
        return formatErrorForMcp(err);
      }
    }
  );

  // ─── Tool: get_screenshot ────────────────────────────────
  server.tool(
    'get_screenshot',
    '获取摹客设计文件中指定页面的整页截图（@2x PNG），返回 base64 编码的图片数据。',
    {
      url: z.string().describe('摹客设计稿 URL'),
    },
    async ({ url }) => {
      try {
        parseMockplusUrl(url);

        const tmpDir = path.join(os.tmpdir(), `moke-screenshot-${Date.now()}`);
        await fetchAllAssets(url, tmpDir);

        const screenshot = getDesignScreenshot(tmpDir);
        if (!screenshot) {
          return {
            content: [{ type: 'text', text: '该页面没有整页截图（可能未生成或格式不支持）' }],
          };
        }

        return {
          content: [
            {
              type: 'image',
              data: screenshot.data,
              mimeType: screenshot.mimeType,
            },
          ],
        };
      } catch (err) {
        return formatErrorForMcp(err);
      }
    }
  );

  // ─── Tool: get_variable_defs ─────────────────────────────
  server.tool(
    'get_variable_defs',
    '获取摹客设计文件中的所有 Design Token 变量定义（颜色、字体、间距等）。从设计数据的 globalVars 中提取。',
    {
      url: z.string().describe('摹客设计稿 URL'),
    },
    async ({ url }) => {
      try {
        parseMockplusUrl(url);
        const data = await fetchDesignData(url, { format: 'json' });
        const variables = extractVariables(data);

        if (variables.length === 0) {
          return {
            content: [{ type: 'text', text: '未找到 Design Token 变量。该设计文件可能没有定义共享样式。' }],
          };
        }

        const output = variables.map((v) => {
          const valueStr = typeof v.value === 'string'
            ? v.value
            : JSON.stringify(v.value);
          return `${v.name} [${v.type}]: ${valueStr}`;
        }).join('\n');

        return {
          content: [{ type: 'text', text: `# Design Tokens (${variables.length} 个)\n\n${output}` }],
        };
      } catch (err) {
        return formatErrorForMcp(err);
      }
    }
  );

  // ─── Tool: download_design_images ────────────────────────
  server.tool(
    'download_design_images',
    '下载摹客设计文件中的切图资源，保存为 PNG/SVG 文件到本地目录。',
    {
      url: z.string().describe('摹客设计稿 URL'),
      imageRefs: z.array(z.string()).describe('要下载的切图 imageRef 列表（从设计数据的 globalVars.styles 中找到 type: IMAGE 的 imageRef）'),
      outputDir: z.string().optional().describe('输出目录，默认为 ./mockplus-assets'),
    },
    async ({ url, imageRefs, outputDir }) => {
      try {
        parseMockplusUrl(url);
        const outDir = outputDir || path.join(process.cwd(), 'mockplus-assets');

        const result = await downloadImages(url, imageRefs, outDir);

        return {
          content: [
            {
              type: 'text',
              text: `切图下载完成:\n` +
                `  目录: ${outDir}\n` +
                `  成功: ${result.ok}\n` +
                `  失败: ${result.fail}\n` +
                `  总数: ${result.total}`,
            },
          ],
        };
      } catch (err) {
        return formatErrorForMcp(err);
      }
    }
  );

  // ─── Tool: get_design_data ───────────────────────────────
  server.tool(
    'get_design_data',
    '获取摹客设计文件的完整设计数据（get_design_context 的别名，兼容 Figma MCP 命名习惯）。',
    {
      url: z.string().describe('摹客设计稿 URL'),
      format: z.enum(['json', 'yaml']).optional().default('yaml').describe('输出格式'),
    },
    async ({ url, format }) => {
      try {
        parseMockplusUrl(url);

        let output: string;

        if (format === 'yaml') {
          output = await fetchDesignDataYaml(url);
        } else {
          const data = await fetchDesignData(url, { format: 'json' });
          output = JSON.stringify(data, null, 2);
        }

        return {
          content: [{ type: 'text', text: output }],
        };
      } catch (err) {
        return formatErrorForMcp(err);
      }
    }
  );

  // ─── Tool: create_design_system_rules ────────────────────
  server.tool(
    'create_design_system_rules',
    '基于设计文件中的 Design Token 和组件，生成框架特定的设计系统规范文档（Markdown 格式）。',
    {
      url: z.string().describe('摹客设计稿 URL'),
      framework: z.enum(['react', 'vue']).optional().default('react').describe('目标框架'),
      styleLibrary: z.enum(['tailwind', 'css-modules', 'styled-components']).optional().default('tailwind').describe('样式方案'),
    },
    async ({ url, framework, styleLibrary }) => {
      try {
        parseMockplusUrl(url);
        const data = await fetchDesignData(url, { format: 'json' });
        const variables = extractVariables(data);
        const rules = generateDesignSystemRules(variables, framework, styleLibrary);

        return { content: [{ type: 'text', text: rules }] };
      } catch (err) {
        return formatErrorForMcp(err);
      }
    }
  );

  return server;
}

// ── 辅助函数 ────────────────────────────────────────────────

/** XML 转义 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
