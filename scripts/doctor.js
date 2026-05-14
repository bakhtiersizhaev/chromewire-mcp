#!/usr/bin/env node
import fs from 'node:fs';
import net from 'node:net';
import process from 'node:process';

import { DEFAULT_HOST, DEFAULT_PORT, getDefaultPreferencePath, getDefaultUserDataDir } from '../src/config.js';
import { health } from '../src/codexChromePipe.js';
import { checkMacosCodexRuntime, checkNativeHostManifest } from '../src/nativeHostManifest.js';
import { redactForLogs } from '../src/redact.js';

function pass(name, details = '') { return { status: 'pass', name, details }; }
function warn(name, details = '') { return { status: 'warn', name, details }; }
function fail(name, details = '') { return { status: 'fail', name, details }; }

async function isPortOpen(host, port) {
  return await new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
    socket.setTimeout(1200, () => { socket.destroy(); resolve(false); });
  });
}

const checks = [];
const major = Number(process.versions.node.split('.')[0]);
checks.push(major >= 20 ? pass('Node.js version', process.version) : fail('Node.js version', `${process.version}; Node.js 20+ required`));

const userDataDir = getDefaultUserDataDir();
checks.push(fs.existsSync(userDataDir) ? pass('Chrome user data directory', userDataDir) : warn('Chrome user data directory', `Not found: ${userDataDir}`));
checks.push(pass('Profile preference path', getDefaultPreferencePath()));

const nativeHost = checkNativeHostManifest();
checks.push(nativeHost.ok ? pass('Codex Chrome native host manifest', nativeHost.manifestPath) : warn('Codex Chrome native host manifest', nativeHost.problem || 'not configured'));

const codexRuntime = checkMacosCodexRuntime();
if (codexRuntime.required) {
  checks.push(codexRuntime.ok ? pass('macOS Codex-signed Node runtime', codexRuntime.execPath) : warn('macOS Codex-signed Node runtime', codexRuntime.problem));
}

const portOpen = await isPortOpen(DEFAULT_HOST, DEFAULT_PORT);
checks.push(portOpen ? warn('MCP port availability', `${DEFAULT_HOST}:${DEFAULT_PORT} is already in use`) : pass('MCP port availability', `${DEFAULT_HOST}:${DEFAULT_PORT} is free`));

const browserHealth = await health();
checks.push(browserHealth.ok ? pass('Codex Chrome Extension pipe', 'reachable') : warn('Codex Chrome Extension pipe', browserHealth.error || 'not reachable'));

const report = { ok: checks.every((check) => check.status !== 'fail'), platform: process.platform, endpoint: `http://${DEFAULT_HOST}:${DEFAULT_PORT}/mcp`, checks, nativeHost: redactForLogs(nativeHost), codexRuntime: redactForLogs(codexRuntime), health: redactForLogs(browserHealth) };
const safeReport = redactForLogs(report);
console.log(JSON.stringify(safeReport, null, 2));
process.exit(report.ok ? 0 : 1);
