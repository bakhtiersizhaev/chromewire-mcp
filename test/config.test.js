import test from 'node:test';
import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

import {
  getConfigDir,
  getDefaultPreferencePath,
  getDefaultUserDataDir,
  getClassicLevelModuleSpecifier,
} from '../src/config.js';
import { listPipes, listUnixSockets } from '../src/codexChromePipe.js';
import {
  buildNativeHostManifest,
  checkMacosCodexRuntime,
  checkNativeHostManifest,
  getCodexAppNativeHostPath,
  getDefaultNativeHostManifestPath,
} from '../src/nativeHostManifest.js';

test('stores user-specific preferences outside the repository by default', () => {
  const homeDir = path.join(path.sep, 'Users', 'alice');

  assert.equal(getConfigDir({ homeDir }), path.join(homeDir, '.codex-chrome-mcp'));
  assert.equal(
    getDefaultPreferencePath({ homeDir }),
    path.join(homeDir, '.codex-chrome-mcp', 'profile-preference.json'),
  );
});

test('detects Chrome user data directory per supported platform', () => {
  const homeDir = path.join(path.sep, 'Users', 'alice');

  assert.equal(
    getDefaultUserDataDir({ platform: 'win32', homeDir }),
    path.join(homeDir, 'AppData', 'Local', 'Google', 'Chrome', 'User Data'),
  );
  assert.equal(
    getDefaultUserDataDir({ platform: 'darwin', homeDir }),
    path.join(homeDir, 'Library', 'Application Support', 'Google', 'Chrome'),
  );
  assert.equal(
    getDefaultUserDataDir({ platform: 'linux', homeDir }),
    path.join(homeDir, '.config', 'google-chrome'),
  );
});

test('uses package dependency for classic-level instead of a machine-local absolute path', () => {
  assert.equal(getClassicLevelModuleSpecifier(), 'classic-level');
});

test('discovers Codex browser-use unix sockets on macOS/Linux transports', async () => {
  if (process.platform === 'win32') return;

  const socketDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'chromewire-sockets-'));
  const socketPath = path.join(socketDir, 'browser.sock');
  const server = net.createServer();

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(socketPath, resolve);
  });

  try {
    assert.deepEqual(listUnixSockets({ socketDir }), [{ name: 'browser.sock', path: socketPath }]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await fsp.rm(socketDir, { recursive: true, force: true });
  }
});

test('default pipe discovery sees Codex sockets on the current platform', () => {
  const pipes = listPipes();
  assert.equal(Array.isArray(pipes), true);
});

test('checks Codex Chrome native host manifest shape', async () => {
  const homeDir = path.join(path.sep, 'Users', 'alice');
  const manifestPath = getDefaultNativeHostManifestPath({ platform: 'darwin', homeDir });
  assert.equal(
    manifestPath,
    path.join(homeDir, 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts', 'com.openai.codexextension.json'),
  );

  const hostPath = path.join(os.tmpdir(), 'extension-host');
  const manifest = buildNativeHostManifest({ hostPath });
  assert.equal(manifest.name, 'com.openai.codexextension');
  assert.equal(manifest.allowed_origins.includes('chrome-extension://hehggadaopoacecdllhhajmbjkdcmajg/'), true);

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'chromewire-native-host-'));
  const tempHostPath = path.join(tempDir, 'extension-host');
  const tempManifestPath = path.join(tempDir, 'com.openai.codexextension.json');
  await fsp.writeFile(tempHostPath, '', 'utf8');
  await fsp.writeFile(tempManifestPath, JSON.stringify(buildNativeHostManifest({ hostPath: tempHostPath })), 'utf8');

  try {
    assert.equal(checkNativeHostManifest({ manifestPath: tempManifestPath }).ok, true);
    assert.equal(checkNativeHostManifest({ manifestPath: path.join(tempDir, 'missing.json') }).ok, false);
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
});

test('resolves bundled Codex native host path for supported platforms', () => {
  assert.equal(
    getCodexAppNativeHostPath({ codexAppPath: '/Applications/Codex.app', platform: 'darwin', arch: 'arm64' }),
    path.join('/Applications/Codex.app', 'Contents', 'Resources', 'plugins', 'openai-bundled', 'plugins', 'chrome', 'extension-host', 'macos', 'arm64', 'extension-host'),
  );
  assert.equal(getCodexAppNativeHostPath({ platform: 'darwin', arch: 'ppc' }), null);
});

test('detects whether macOS is using Codex bundled Node.js', () => {
  assert.equal(
    checkMacosCodexRuntime({ platform: 'darwin', execPath: '/Applications/Codex.app/Contents/Resources/node' }).ok,
    true,
  );
  assert.equal(
    checkMacosCodexRuntime({ platform: 'darwin', execPath: '/opt/homebrew/bin/node' }).ok,
    false,
  );
  assert.equal(
    checkMacosCodexRuntime({ platform: 'linux', execPath: '/usr/bin/node' }).required,
    false,
  );
});
