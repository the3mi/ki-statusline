// ─── Configuration ─────────────────────────────────────────────────────────
import fs from 'fs';
import path from 'path';
import os from 'os';

export const DEFAULT_CONFIG = {
  theme: 'catppuccin',
  powerline: true,
  burnHistorySize: 48,
  showAgentCount: true,
  showUptime: true,
  showLastEvent: true,
};

export function loadConfig() {
  const home = os.homedir();
  const configPath = path.join(home, '.kiro', 'ki-statusline-config.json');
  let userConfig = {};
  try { userConfig = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch (_) {}
  const envConfig = {};
  if (process.env.KI_STATUSLINE_THEME) envConfig.theme = process.env.KI_STATUSLINE_THEME;
  if (process.env.KI_STATUSLINE_POWERLINE === 'false') envConfig.powerline = false;
  if (process.env.KI_STATUSLINE_POWERLINE === 'true') envConfig.powerline = true;
  return { ...DEFAULT_CONFIG, ...userConfig, ...envConfig };
}
