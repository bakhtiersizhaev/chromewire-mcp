import test from 'node:test';
import assert from 'node:assert/strict';

import { redactForLogs } from '../src/redact.js';

test('redacts profile identity and extension instance identifiers from diagnostic logs', () => {
  const value = {
    preferredProfile: {
      profileDir: 'Default',
      name: 'person@example.com',
      shortcutName: 'Personal (person@example.com)',
      gaiaName: 'Real Person',
      userName: 'person@example.com',
      extensionInstanceId: 'abc-123',
    },
    info: {
      metadata: {
        extensionId: 'public-extension-id',
        extensionInstanceId: 'abc-123',
      },
    },
    samplePipes: ['codex-browser-use\abc-123'],
    details: 'C:' + String.fromCharCode(92) + 'Users' + String.fromCharCode(92) + 'person' + String.fromCharCode(92) + 'AppData',
  };

  const redacted = redactForLogs(value);
  const text = JSON.stringify(redacted);

  assert.equal(text.includes('person@example.com'), false);
  assert.equal(text.includes('Real Person'), false);
  assert.equal(text.includes('abc-123'), false);
  assert.equal(text.includes('person@example.com'), false);
  assert.equal(text.includes('C:' + String.fromCharCode(92) + 'Users'), false);
  assert.equal(redacted.info.metadata.extensionId, 'public-extension-id');
});
