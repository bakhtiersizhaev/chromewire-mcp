import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import {
  getConfigDir,
  getDefaultPreferencePath,
  getDefaultUserDataDir,
  getClassicLevelModuleSpecifier,
} from '../src/config.js';

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
