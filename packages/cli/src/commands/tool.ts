/**
 * moke-mcp tool —— 本地直接调用 MCP Tools
 * 无需 MCP 客户端，等价于 MCP 协议暴露的 7 个工具：
 * get_metadata / get_design_context / get_screenshot / get_variable_defs /
 * download_design_images / get_design_data / create_design_system_rules
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { Command } from 'commander';
import {
  parseMockplusUrl,
  fetchDesignData,
  fetchDesignDataYaml,
  fetchPageTreeForMetadata,
  fetchAllAssets,
  downloadImages,
  extractVariables,
  generateDesignSystemRules,
  getDesignScreenshot,
  buildPageTreeXml,
} from '@moke-mcp/server';

/** 注册 tool 子命令 */
export function registerToolCommand(program: Command): void {
  const tool = program
    .command('tool')
    .description('在本地直接调用 MCP Tools（7 个工具，无需 MCP 客户端）');

  // ─── get_metadata ────────────────────────────────────────
  tool
    .command('get_metadata')
    .description('获取页面/分组 XML 层级树')
    .argument('<url>', '摹客设计稿 URL，格式: https://app.mockplus.cn/app/{APP_ID}/develop/design/{PAGE_ID}')
    .action(async (url: string) => {
      try {
        const { appId } = parseMockplusUrl(url);
        const tree = await fetchPageTreeForMetadata(url);

        let xml = '<DOCUMENT>\n';
        xml += `  <APP id="${appId}" name="${appId}">\n`;
        xml += buildPageTreeXml(tree, 2);
        xml += `  </APP>\n`;
        xml += '</DOCUMENT>\n';
        console.log(xml);
      } catch (err) {
        handleError('get_metadata', err);
      }
    });

  // ─── get_design_context ──────────────────────────────────
  tool
    .command('get_design_context')
    .description('获取完整设计上下文（YAML/JSON），可直接用于代码生成')
    .argument('<url>', '摹客设计稿 URL')
    .option('-f, --format <fmt>', '输出格式: yaml|json', 'yaml')
    .option('--raw', '输出未蒸馏原文（默认是蒸馏压缩后的数据）')
    .option('-o, --out <path>', '导出为文本文件（默认输出到终端）')
    .action(async (url: string, opts: { format: string; raw?: boolean; out?: string }) => {
      try {
        parseMockplusUrl(url);
        await outputDesignData(url, opts);
      } catch (err) {
        handleError('get_design_context', err);
      }
    });

  // ─── get_screenshot ──────────────────────────────────────
  tool
    .command('get_screenshot')
    .description('获取整页 @2x 截图（默认保存 PNG 文件，--base64 输出原始数据）')
    .argument('<url>', '摹客设计稿 URL')
    .option('-o, --output <path>', 'PNG 保存路径（默认 ./moke-screenshot-{timestamp}.png）')
    .option('--base64', '输出 base64 到 stdout 而非保存文件')
    .action(async (url: string, opts: { output?: string; base64?: boolean }) => {
      try {
        parseMockplusUrl(url);

        const tmpDir = path.join(os.tmpdir(), `moke-screenshot-${Date.now()}`);
        await fetchAllAssets(url, tmpDir);

        const screenshot = getDesignScreenshot(tmpDir);
        if (!screenshot) {
          throw new Error('该页面没有整页截图（可能未生成或格式不支持）');
        }

        if (opts.base64) {
          console.log(screenshot.data);
          return;
        }

        const outPath = opts.output || path.join(process.cwd(), `moke-screenshot-${Date.now()}.png`);
        fs.writeFileSync(outPath, Buffer.from(screenshot.data, 'base64'));
        console.log(`截图已保存: ${outPath} (${screenshot.mimeType})`);
      } catch (err) {
        handleError('get_screenshot', err);
      }
    });

  // ─── get_variable_defs ───────────────────────────────────
  tool
    .command('get_variable_defs')
    .description('获取 Design Token 变量定义（颜色/字体/间距/效果）')
    .argument('<url>', '摹客设计稿 URL')
    .action(async (url: string) => {
      try {
        parseMockplusUrl(url);
        const data = await fetchDesignData(url, { format: 'json' });
        const variables = extractVariables(data);

        if (variables.length === 0) {
          console.log('未找到 Design Token 变量。该设计文件可能没有定义共享样式。');
          return;
        }

        const output = variables.map((v) => {
          const valueStr = typeof v.value === 'string'
            ? v.value
            : JSON.stringify(v.value);
          return `${v.name} [${v.type}]: ${valueStr}`;
        }).join('\n');
        console.log(`# Design Tokens (${variables.length} 个)\n\n${output}`);
      } catch (err) {
        handleError('get_variable_defs', err);
      }
    });

  // ─── download_design_images ──────────────────────────────
  tool
    .command('download_design_images')
    .description('下载切图资源（PNG/SVG）到本地目录')
    .argument('<url>', '摹客设计稿 URL')
    .requiredOption('--refs <refs>', 'imageRef 列表，逗号分隔（来自 globalVars.styles 中 type: IMAGE 的 imageRef）')
    .option('-o, --output <dir>', '输出目录', path.join(process.cwd(), 'mockplus-assets'))
    .action(async (url: string, opts: { refs: string; output: string }) => {
      try {
        parseMockplusUrl(url);
        const refs = opts.refs.split(',').map((s) => s.trim()).filter(Boolean);
        if (refs.length === 0) throw new Error('--refs 不能为空');

        const result = await downloadImages(url, refs, opts.output);
        console.log('切图下载完成:');
        console.log(`  目录: ${opts.output}`);
        console.log(`  成功: ${result.ok}`);
        console.log(`  失败: ${result.fail}`);
        console.log(`  总数: ${result.total}`);
      } catch (err) {
        handleError('download_design_images', err);
      }
    });

  // ─── get_design_data ─────────────────────────────────────
  tool
    .command('get_design_data')
    .description('获取完整设计数据（get_design_context 的别名）')
    .argument('<url>', '摹客设计稿 URL')
    .option('-f, --format <fmt>', '输出格式: yaml|json', 'yaml')
    .option('--raw', '输出未蒸馏原文（默认是蒸馏压缩后的数据）')
    .option('-o, --out <path>', '导出为文本文件（默认输出到终端）')
    .action(async (url: string, opts: { format: string; raw?: boolean; out?: string }) => {
      try {
        parseMockplusUrl(url);
        await outputDesignData(url, opts);
      } catch (err) {
        handleError('get_design_data', err);
      }
    });

  // ─── create_design_system_rules ──────────────────────────
  tool
    .command('create_design_system_rules')
    .description('基于 Design Token 生成框架特定的设计系统规范文档（Markdown）')
    .argument('<url>', '摹客设计稿 URL')
    .option('--framework <fw>', '目标框架: react|vue', 'react')
    .option('--style <style>', '样式方案: tailwind|css-modules|styled-components', 'tailwind')
    .action(async (url: string, opts: { framework: string; style: string }) => {
      try {
        parseMockplusUrl(url);
        const data = await fetchDesignData(url, { format: 'json' });
        const variables = extractVariables(data);
        const rules = generateDesignSystemRules(variables, opts.framework, opts.style);
        console.log(rules);
      } catch (err) {
        handleError('create_design_system_rules', err);
      }
    });
}

/** get_design_context / get_design_data 共用：拉取并输出（或导出文件） */
async function outputDesignData(
  url: string,
  opts: { format: string; raw?: boolean; out?: string }
): Promise<void> {
  let output: string;
  if (opts.format === 'json') {
    const data = await fetchDesignData(url, { format: 'json', raw: !!opts.raw });
    output = JSON.stringify(data, null, 2);
  } else {
    output = await fetchDesignDataYaml(url, { raw: !!opts.raw });
  }

  if (opts.out) {
    fs.writeFileSync(opts.out, output);
    console.log(`已导出 ${opts.format}${opts.raw ? ' (raw)' : ''} 数据: ${opts.out}`);
  } else {
    console.log(output);
  }
}

/** 统一错误输出（stderr + 非零退出码） */
function handleError(toolName: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`❌ ${toolName} 执行失败: ${msg}`);
  process.exitCode = 1;
}
