import os from 'node:os';
import path from 'node:path';

export const EXPECTED_EXTENSION_ID = process.env.CODEX_CHROME_EXTENSION_ID || 'hehggadaopoacecdllhhajmbjkdcmajg';
export const DEFAULT_HOST = process.env.CODEX_CHROME_MCP_HOST || '127.0.0.1';
export const DEFAULT_PORT = Number(process.env.CODEX_CHROME_MCP_PORT || 8962);

export function getConfigDir({ homeDir = os.homedir() } = {}) {
  return process.env.CODEX_CHROME_CONFIG_DIR || path.join(homeDir, '.codex-chrome-mcp');
}

export function getDefaultPreferencePath(options = {}) {
  return process.env.CODEX_CHROME_PROFILE_PREFERENCE_PATH || path.join(getConfigDir(options), 'profile-preference.json');
}

export function getDefaultUserDataDir({ platform = process.platform, homeDir = os.homedir() } = {}) {
  if (process.env.CODEX_CHROME_USER_DATA_DIR) return process.env.CODEX_CHROME_USER_DATA_DIR;
  if (platform === 'win32') return path.join(homeDir, 'AppData', 'Local', 'Google', 'Chrome', 'User Data');
  if (platform === 'darwin') return path.join(homeDir, 'Library', 'Application Support', 'Google', 'Chrome');
  return path.join(homeDir, '.config', 'google-chrome');
}

export function getClassicLevelModuleSpecifier() {
  return process.env.CODEX_CHROME_CLASSIC_LEVEL_MODULE || 'classic-level';
}
