/**
 * CLI 配置工具函数
 */

import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

/** 配置文件 Schema */
export const ConfigSchema = z.object({
  cookieContent: z.string().optional().default(''),
  cacheDir: z.string().optional().default(''),
  codeGen: z.object({
    framework: z.enum(['react', 'vue']).default('react'),
    styleLibrary: z.enum(['tailwind', 'css-modules', 'styled-components']).default('tailwind'),
    typescript: z.boolean().default(true),
  }),
  output: z.object({
    imageFormat: z.enum(['png', 'svg']).default('png'),
    imageScale: z.number().default(2),
    scale: z.number().default(1),
  }),
});

export type MokeMCPConfig = z.infer<typeof ConfigSchema>;

/** 默认配置 */
export function getDefaultConfig(): MokeMCPConfig {
  return {
    cookieContent: '',
    cacheDir: '',
    codeGen: {
      framework: 'react',
      styleLibrary: 'tailwind',
      typescript: true,
    },
    output: {
      imageFormat: 'png',
      imageScale: 2,
      scale: 1,
    },
  };
}

/** 读取配置文件 */
export function readConfig(projectDir: string = process.cwd()): MokeMCPConfig {
  const configPath = path.join(projectDir, '.moke-mcp.json');
  if (fs.existsSync(configPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return ConfigSchema.parse(raw);
    } catch {
      console.error('配置文件 .moke-mcp.json 格式有误，使用默认配置');
    }
  }
  return getDefaultConfig();
}

/** 写入配置文件 */
export function writeConfig(config: MokeMCPConfig, projectDir: string = process.cwd()): void {
  const configPath = path.join(projectDir, '.moke-mcp.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  console.log(`✅ 配置文件已写入: ${configPath}`);
}

/** 设置配置字段（支持点号路径） */
export function setConfigField(
  config: MokeMCPConfig,
  path: string,
  value: string
): MokeMCPConfig {
  const parts = path.split('.');
  const newConfig = JSON.parse(JSON.stringify(config));

  let current = newConfig;
  for (let i = 0; i < parts.length - 1; i++) {
    current = current[parts[i]];
  }
  const key = parts[parts.length - 1];

  // 类型转换
  if (typeof current[key] === 'number') {
    current[key] = Number(value);
  } else if (typeof current[key] === 'boolean') {
    current[key] = value === 'true';
  } else {
    current[key] = value;
  }

  return newConfig;
}

/** 生成 MCP 客户端配置片段 */
export function generateMCPClientConfig(): string {
  const configs = [
    {
      name: 'Cursor (.cursor/mcp.json)',
      config: {
        mcpServers: {
          'moke-mcp': {
            command: 'npx',
            args: ['-y', '@moke-mcp/cli', 'serve'],
            env: {
              MOKE_COOKIE: '<在此填入你的Cookie>',
            },
          },
        },
      },
    },
    {
      name: 'Claude Desktop (claude_desktop_config.json)',
      config: {
        mcpServers: {
          'moke-mcp': {
            command: 'npx',
            args: ['-y', '@moke-mcp/cli', 'serve'],
            env: {
              MOKE_COOKIE: '<在此填入你的Cookie>',
            },
          },
        },
      },
    },
    {
      name: 'VS Code Copilot (.vscode/mcp.json)',
      config: {
        servers: {
          'moke-mcp': {
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@moke-mcp/cli', 'serve'],
            env: {
              MOKE_COOKIE: '<在此填入你的Cookie>',
            },
          },
        },
      },
    },
  ];

  return configs.map(c => `# ${c.name}\n\`\`\`json\n${JSON.stringify(c.config, null, 2)}\n\`\`\``).join('\n\n');
}
