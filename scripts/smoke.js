#!/usr/bin/env node
import { redactForLogs } from '../src/redact.js';
import { getInfo, health, ping } from '../src/codexChromePipe.js';

function isMacosPeerAuthError(error) {
  return process.platform === 'darwin' && /pipe closed|not reachable|No working Codex Chrome pipe/i.test(String(error?.message || error));
}

function smokeFailure(error) {
  const message = error instanceof Error ? error.message : String(error);
  const result = {
    ok: false,
    error: message,
    strict: process.env.CHROMEWIRE_STRICT_SMOKE === '1',
  };
  if (isMacosPeerAuthError(error)) {
    result.reason = 'macos_peer_authorization';
    result.recommendation = 'For Codex CLI on macOS, configure stdio MCP with command /Applications/Codex.app/Contents/Resources/node and args ["/absolute/path/to/chromewire-mcp/src/stdio.js"]. For a direct live smoke from a Codex-launched shell, run /Applications/Codex.app/Contents/Resources/node scripts/smoke.js instead of npm run smoke.';
  }
  return result;
}

try {
  const result = { ok: true, health: await health(), ping: await ping(), info: await getInfo() };
  console.log(JSON.stringify(redactForLogs(result), null, 2));
} catch (error) {
  const result = smokeFailure(error);
  console.log(JSON.stringify(redactForLogs(result), null, 2));
  process.exit(result.strict ? 1 : 0);
}
