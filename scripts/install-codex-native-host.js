#!/usr/bin/env node
import process from 'node:process';

import { checkNativeHostManifest, installCodexNativeHostManifest } from '../src/nativeHostManifest.js';
import { redactForLogs } from '../src/redact.js';

const before = checkNativeHostManifest();
if (before.ok) {
  console.log(JSON.stringify(redactForLogs({ ok: true, alreadyInstalled: true, nativeHost: before }), null, 2));
  process.exit(0);
}

try {
  const installed = await installCodexNativeHostManifest();
  const after = checkNativeHostManifest();
  console.log(JSON.stringify(redactForLogs({ ok: after.ok, installed, nativeHost: after }), null, 2));
  process.exit(after.ok ? 0 : 1);
} catch (error) {
  console.log(JSON.stringify(redactForLogs({
    ok: false,
    before,
    error: error instanceof Error ? error.message : String(error),
  }), null, 2));
  process.exit(1);
}
