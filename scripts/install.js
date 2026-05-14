#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import process from 'node:process';

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log('Installing ChromeWire MCP dependencies...');
run('npm', ['install']);
console.log('Installing or verifying Codex Chrome native host manifest...');
run('node', ['scripts/install-codex-native-host.js']);
console.log('Running tests...');
run('npm', ['test']);
console.log('Running syntax checks...');
run('npm', ['run', 'check']);
console.log('Running environment doctor...');
run('npm', ['run', 'doctor']);
console.log('ChromeWire MCP install checks completed. Start with: npm start');
