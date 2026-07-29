/**
 * moke-mcp config 命令
 * 管理配置文件
 */

import { readConfig, writeConfig, setConfigField } from '../utils/config-file.js';

export function configShowCommand(): void {
  const config = readConfig();
  console.log(JSON.stringify(config, null, 2));
}

export function configSetCommand(key: string, value: string): void {
  const config = readConfig();
  const updated = setConfigField(config, key, value);
  writeConfig(updated);
  console.log(`✅ 已设置 ${key} = ${value}`);
}
