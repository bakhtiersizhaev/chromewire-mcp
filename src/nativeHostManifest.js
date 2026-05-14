import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { EXPECTED_EXTENSION_ID } from './config.js';

export const EXPECTED_NATIVE_HOST_NAME = process.env.CODEX_CHROME_NATIVE_HOST_NAME || 'com.openai.codexextension';

function platformName({ platform = process.platform } = {}) {
  if (platform === 'darwin') return 'macos';
  if (platform === 'win32') return 'windows';
  if (platform === 'linux') return 'linux';
  return null;
}

function extensionHostBinaryName({ platform = process.platform } = {}) {
  return platform === 'win32' ? 'extension-host.exe' : 'extension-host';
}

export function getDefaultNativeHostManifestPath({ platform = process.platform, homeDir = os.homedir() } = {}) {
  const filename = `${EXPECTED_NATIVE_HOST_NAME}.json`;
  if (platform === 'darwin') return path.join(homeDir, 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts', filename);
  if (platform === 'linux') return path.join(homeDir, '.config', 'google-chrome', 'NativeMessagingHosts', filename);
  if (platform === 'win32') return path.join(homeDir, 'AppData', 'Local', 'OpenAI', 'extension', filename);
  return null;
}

export function getCodexAppNativeHostPath({
  codexAppPath = process.env.CODEX_APP_PATH || '/Applications/Codex.app',
  platform = process.platform,
  arch = process.arch,
} = {}) {
  const mappedPlatform = platformName({ platform });
  if (!mappedPlatform || !['arm64', 'x64'].includes(arch)) return null;
  return path.join(
    codexAppPath,
    'Contents',
    'Resources',
    'plugins',
    'openai-bundled',
    'plugins',
    'chrome',
    'extension-host',
    mappedPlatform,
    arch,
    extensionHostBinaryName({ platform }),
  );
}

export function buildNativeHostManifest({ hostPath, extensionId = EXPECTED_EXTENSION_ID, hostName = EXPECTED_NATIVE_HOST_NAME } = {}) {
  return {
    name: hostName,
    description: 'Codex chrome native messaging host',
    type: 'stdio',
    path: hostPath,
    allowed_origins: [`chrome-extension://${extensionId}/`],
  };
}

export function checkNativeHostManifest({
  manifestPath = process.env.CODEX_CHROME_NATIVE_HOST_MANIFEST_PATH || getDefaultNativeHostManifestPath(),
  extensionId = EXPECTED_EXTENSION_ID,
  hostName = EXPECTED_NATIVE_HOST_NAME,
} = {}) {
  const expectedOrigin = `chrome-extension://${extensionId}/`;
  if (!manifestPath) {
    return { ok: false, supported: false, manifestPath: null, hostName, expectedOrigin, problem: `Unsupported platform: ${process.platform}` };
  }
  if (!fs.existsSync(manifestPath)) {
    return { ok: false, supported: true, manifestPath, hostName, expectedOrigin, exists: false, problem: `Native host manifest does not exist: ${manifestPath}` };
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const allowedOrigins = Array.isArray(manifest.allowed_origins) ? manifest.allowed_origins : [];
    const nameMatches = manifest.name === hostName;
    const hasExpectedOrigin = allowedOrigins.includes(expectedOrigin);
    const hostPathExists = typeof manifest.path === 'string' && fs.existsSync(manifest.path);
    const ok = nameMatches && hasExpectedOrigin && hostPathExists;
    const problems = [];
    if (!nameMatches) problems.push(`manifest name does not match ${hostName}`);
    if (!hasExpectedOrigin) problems.push(`allowed_origins does not include ${expectedOrigin}`);
    if (!hostPathExists) problems.push(`native host binary does not exist: ${manifest.path || '(missing path)'}`);
    return {
      ok,
      supported: true,
      manifestPath,
      hostName,
      expectedOrigin,
      exists: true,
      nativeHostPath: manifest.path || null,
      allowedOrigins,
      problem: problems.join('; ') || null,
    };
  } catch (error) {
    return {
      ok: false,
      supported: true,
      manifestPath,
      hostName,
      expectedOrigin,
      exists: true,
      problem: `Could not read native host manifest: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function installCodexNativeHostManifest({
  manifestPath = process.env.CODEX_CHROME_NATIVE_HOST_MANIFEST_PATH || getDefaultNativeHostManifestPath(),
  hostPath = process.env.CODEX_CHROME_NATIVE_HOST_PATH || getCodexAppNativeHostPath(),
} = {}) {
  if (!manifestPath) throw new Error(`Unsupported platform: ${process.platform}`);
  if (!hostPath || !fs.existsSync(hostPath)) throw new Error(`Codex native host binary not found: ${hostPath || '(unknown)'}`);

  const manifest = buildNativeHostManifest({ hostPath });
  await fsp.mkdir(path.dirname(manifestPath), { recursive: true });
  await fsp.writeFile(manifestPath, JSON.stringify(manifest), 'utf8');
  return { ok: true, manifestPath, nativeHostPath: hostPath };
}
