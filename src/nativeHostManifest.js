import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
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

function nativeHostRelativePath({ platform = process.platform, arch = process.arch } = {}) {
  const mappedPlatform = platformName({ platform });
  if (!mappedPlatform || !['arm64', 'x64'].includes(arch)) return null;
  return path.join(
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

function compact(values) {
  return [...new Set(values.filter(Boolean))];
}

export function getDefaultNativeHostManifestPath({ platform = process.platform, homeDir = os.homedir() } = {}) {
  const filename = `${EXPECTED_NATIVE_HOST_NAME}.json`;
  if (platform === 'darwin') return path.join(homeDir, 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts', filename);
  if (platform === 'linux') return path.join(homeDir, '.config', 'google-chrome', 'NativeMessagingHosts', filename);
  if (platform === 'win32') return path.join(homeDir, 'AppData', 'Local', 'OpenAI', 'extension', filename);
  return null;
}

export function getWindowsNativeHostRegistryKey({ hostName = EXPECTED_NATIVE_HOST_NAME } = {}) {
  return `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${hostName}`;
}

export function readWindowsNativeHostRegistry({
  platform = process.platform,
  hostName = EXPECTED_NATIVE_HOST_NAME,
} = {}) {
  if (platform !== 'win32') return { supported: false, ok: true, registryKey: null, manifestPath: null };
  const registryKey = getWindowsNativeHostRegistryKey({ hostName });
  const result = spawnSync('reg', ['query', registryKey, '/ve'], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) {
    return {
      supported: true,
      ok: false,
      registryKey,
      manifestPath: null,
      problem: `Windows native messaging registry key is missing: ${registryKey}`,
    };
  }

  const combined = `${result.stdout || ''}\n${result.stderr || ''}`;
  const match = combined.match(/REG_\w+\s+(.+?)\r?\n/m);
  const manifestPath = match?.[1]?.trim() || null;
  return {
    supported: true,
    ok: Boolean(manifestPath),
    registryKey,
    manifestPath,
    problem: manifestPath ? null : `Could not parse Windows native messaging registry value: ${registryKey}`,
  };
}

export function getCodexResourcePathCandidates({
  codexAppPath = process.env.CODEX_APP_PATH || '/Applications/Codex.app',
  platform = process.platform,
  homeDir = os.homedir(),
  env = process.env,
} = {}) {
  if (env.CODEX_APP_RESOURCES_PATH) return [env.CODEX_APP_RESOURCES_PATH];
  if (platform === 'darwin') return [path.join(codexAppPath, 'Contents', 'Resources')];
  if (platform === 'win32') {
    return compact([
      env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Programs', 'Codex', 'resources'),
      env.PROGRAMFILES && path.join(env.PROGRAMFILES, 'Codex', 'resources'),
      env['PROGRAMFILES(X86)'] && path.join(env['PROGRAMFILES(X86)'], 'Codex', 'resources'),
      path.join(homeDir, 'AppData', 'Local', 'Programs', 'Codex', 'resources'),
    ]);
  }
  if (platform === 'linux') {
    return compact([
      env.APPDIR && path.join(env.APPDIR, 'resources'),
      '/opt/Codex/resources',
      '/opt/codex/resources',
      '/usr/lib/codex/resources',
      '/usr/share/codex/resources',
    ]);
  }
  return [];
}

export function getCodexAppNativeHostCandidates(options = {}) {
  const relative = nativeHostRelativePath(options);
  if (!relative) return [];
  return getCodexResourcePathCandidates(options).map((resourcesPath) => path.join(resourcesPath, relative));
}

export function getCodexAppNativeHostPath(options = {}) {
  const env = options.env || process.env;
  if (env.CODEX_CHROME_NATIVE_HOST_PATH) return env.CODEX_CHROME_NATIVE_HOST_PATH;
  const candidates = getCodexAppNativeHostCandidates(options);
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0] || null;
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
  platform = process.platform,
} = {}) {
  const expectedOrigin = `chrome-extension://${extensionId}/`;
  const registry = readWindowsNativeHostRegistry({ platform, hostName });
  if (platform === 'win32' && registry.manifestPath && !process.env.CODEX_CHROME_NATIVE_HOST_MANIFEST_PATH) {
    manifestPath = registry.manifestPath;
  }
  if (!manifestPath) {
    return { ok: false, supported: false, manifestPath: null, hostName, expectedOrigin, registry, problem: `Unsupported platform: ${process.platform}` };
  }
  if (!fs.existsSync(manifestPath)) {
    return { ok: false, supported: true, manifestPath, hostName, expectedOrigin, registry, exists: false, problem: `Native host manifest does not exist: ${manifestPath}` };
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const allowedOrigins = Array.isArray(manifest.allowed_origins) ? manifest.allowed_origins : [];
    const nameMatches = manifest.name === hostName;
    const hasExpectedOrigin = allowedOrigins.includes(expectedOrigin);
    const hostPathExists = typeof manifest.path === 'string' && fs.existsSync(manifest.path);
    const registryOk = platform !== 'win32' || registry.ok;
    const ok = nameMatches && hasExpectedOrigin && hostPathExists && registryOk;
    const problems = [];
    if (!nameMatches) problems.push(`manifest name does not match ${hostName}`);
    if (!hasExpectedOrigin) problems.push(`allowed_origins does not include ${expectedOrigin}`);
    if (!hostPathExists) problems.push(`native host binary does not exist: ${manifest.path || '(missing path)'}`);
    if (!registryOk) problems.push(registry.problem || 'Windows native messaging registry key is not configured');
    return {
      ok,
      supported: true,
      manifestPath,
      hostName,
      expectedOrigin,
      registry,
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
      registry,
      exists: true,
      problem: `Could not read native host manifest: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export function checkMacosCodexRuntime({ execPath = process.execPath, platform = process.platform } = {}) {
  if (platform !== 'darwin') return { ok: true, required: false, execPath };
  const normalizedExecPath = execPath.replaceAll('\\', '/');
  const expectedSuffix = 'Codex.app/Contents/Resources/node';
  const ok = normalizedExecPath.endsWith(expectedSuffix);
  return {
    ok,
    required: true,
    execPath,
    expected: `/Applications/${expectedSuffix}`,
    problem: ok ? null : 'macOS Codex browser sockets require running ChromeWire with the Node.js binary bundled in Codex.app and launched from a Codex-owned process.',
  };
}

export async function installCodexNativeHostManifest({
  manifestPath = process.env.CODEX_CHROME_NATIVE_HOST_MANIFEST_PATH || getDefaultNativeHostManifestPath(),
  hostPath = process.env.CODEX_CHROME_NATIVE_HOST_PATH || getCodexAppNativeHostPath(),
  platform = process.platform,
  hostName = EXPECTED_NATIVE_HOST_NAME,
} = {}) {
  if (!manifestPath) throw new Error(`Unsupported platform: ${process.platform}`);
  if (!hostPath || !fs.existsSync(hostPath)) throw new Error(`Codex native host binary not found: ${hostPath || '(unknown)'}`);

  const manifest = buildNativeHostManifest({ hostPath, hostName });
  await fsp.mkdir(path.dirname(manifestPath), { recursive: true });
  await fsp.writeFile(manifestPath, JSON.stringify(manifest), 'utf8');
  if (platform === 'win32') {
    const registryKey = getWindowsNativeHostRegistryKey({ hostName });
    const result = spawnSync('reg', ['add', registryKey, '/ve', '/t', 'REG_SZ', '/d', manifestPath, '/f'], { encoding: 'utf8', windowsHide: true });
    if (result.status !== 0) {
      throw new Error(`Failed to register Windows native messaging host: ${result.stderr || result.stdout || `exit ${result.status}`}`);
    }
  }
  return { ok: true, manifestPath, nativeHostPath: hostPath };
}
