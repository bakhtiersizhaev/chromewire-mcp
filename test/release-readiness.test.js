import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bs = String.fromCharCode(92);
const nl = String.fromCharCode(10);
const textFiles = [
  'package.json',
  'README.md',
  'src/config.js',
  'src/codexChromePipe.js',
  'src/server.js',
].map((file) => path.join(root, file));

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

test('public files do not contain personal profile data or machine-local paths', () => {
  const combined = textFiles.map(read).join(nl);
  const forbidden = [
    'hustlekage',
    'bahti',
    'Rekted',
    'D:/',
    'D:' + bs,
    'C:/Users/',
    'C:' + bs + 'Users' + bs,
    'file:///',
  ];

  for (const needle of forbidden) {
    assert.equal(combined.includes(needle), false, `forbidden text leaked: ${needle}`);
  }
});

test('profile preference is treated as local state, not source code', () => {
  const gitignore = read(path.join(root, '.gitignore'));
  assert.equal(gitignore.split(nl).includes('profile-preference.json'), true);
  assert.equal(gitignore.split(nl).includes('.codex-chrome-mcp/'), true);
});

test('package metadata is publishable and uses registry dependencies', () => {
  const pkg = JSON.parse(read(path.join(root, 'package.json')));
  assert.notEqual(pkg.private, true);
  assert.equal(pkg.license, 'Apache-2.0');
  assert.equal(pkg.name, 'chromewire-mcp');
  assert.ok(pkg.bin?.['chromewire-mcp']);
  assert.ok(pkg.bin?.['codex-chrome-mcp-bridge']);
  assert.ok(pkg.scripts.doctor);
  assert.ok(pkg.scripts['install:agent']);
  assert.ok(pkg.scripts['install:codex-native-host']);
  assert.equal(pkg.dependencies['@modelcontextprotocol/sdk'].startsWith('file:'), false);
  assert.ok(pkg.dependencies['classic-level']);
  assert.ok(pkg.scripts.test);
});

test('release documentation and attribution files exist', () => {
  for (const file of ['LICENSE', 'NOTICE', 'docs/SECURITY.md', 'docs/ARCHITECTURE.md', 'docs/README.ru.md', 'docs/README.zh.md', 'docs/DESCRIPTIONS.md', 'docs/TROUBLESHOOTING.md', 'examples/gsd.mcp.json', 'examples/claude-code.mcp.json', 'examples/cursor.mcp.json', 'examples/windsurf.mcp.json', 'examples/codex-cli.md', 'docs/index.html', 'scripts/doctor.js', 'scripts/install.js', 'scripts/install-codex-native-host.js', 'src/nativeHostManifest.js', '.github/workflows/ci.yml']) {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} should exist`);
  }
});


test('docs promote the official extension link, region caveat, and search discovery terms', () => {
  const requiredDocs = ['README.md', 'docs/index.html', 'skills/install-codex-chrome-mcp/SKILL.md', 'skills/debug-codex-chrome-mcp/SKILL.md'];
  for (const file of requiredDocs) {
    const body = read(path.join(root, file));
    assert.equal(body.includes('https://chromewebstore.google.com/detail/hehggadaopoacecdllhhajmbjkdcmajg'), true, `${file} should link official extension`);
    assert.equal(body.toLowerCase().includes('usa'), true, `${file} should mention USA IP/VPN/proxy caveat`);
  }
  const landing = read(path.join(root, 'docs/index.html'));
  assert.equal(landing.includes('Codex Chrome Extension MCP'), true);
  assert.equal(landing.includes('Claude Code Chrome MCP'), true);
  assert.equal(landing.includes('Cursor MCP Chrome'), true);
});


test('README and Pages lead with AI-agent install prompts in three languages', () => {
  for (const file of ['README.md', 'docs/index.html']) {
    const body = read(path.join(root, file));
    assert.equal(body.includes('Easy install via your AI agent'), true, `${file} should lead with agent install`);
    assert.equal(body.includes('Look into this repository: https://github.com/bakhtiersizhaev/chromewire-mcp'), true, `${file} should include English agent prompt`);
    assert.equal(body.includes('Посмотри этот репозиторий: https://github.com/bakhtiersizhaev/chromewire-mcp'), true, `${file} should include Russian agent prompt`);
    assert.equal(body.includes('请查看这个仓库：https://github.com/bakhtiersizhaev/chromewire-mcp'), true, `${file} should include Chinese agent prompt`);
    assert.equal(body.includes('skills/install-codex-chrome-mcp/SKILL.md'), true, `${file} should point agents to install skill`);
  }
});


test('README and Pages are polished for GitHub discovery', () => {
  const readme = read(path.join(root, 'README.md'));
  const landing = read(path.join(root, 'docs/index.html'));
  assert.equal(readme.includes('![MCP Server]'), true, 'README should include visual badges');
  assert.equal(readme.includes('## 🏷 Repository category and tags'), true, 'README should include category/tags');
  assert.equal(readme.includes('developer tools · AI browser automation · MCP server · local-first automation'), true);
  assert.equal(landing.includes('Category and tags'), true, 'Pages should include category/tags');
  assert.equal(landing.includes('tag-cloud'), true, 'Pages should include styled tag cloud');
});

test('agent install prompts avoid over-specific browser wording while requirements stay explicit', () => {
  const readme = read(path.join(root, 'README.md'));
  const promptBlock = readme.slice(readme.indexOf('## 🚀 Easy install via your AI agent'), readme.indexOf('## ✨ Why this exists'));
  assert.equal(promptBlock.includes('Google Chrome'), false, 'README copy/paste prompts should not mention Google Chrome');
  assert.equal(promptBlock.includes('required local prerequisites'), true);
  assert.equal(readme.includes('- Google Chrome'), true, 'Requirements should still name the real dependency');

  const landing = read(path.join(root, 'docs/index.html'));
  const landingPromptBlock = landing.slice(landing.indexOf('Easy install via your AI agent'), landing.indexOf('🧭 How it works'));
  assert.equal(landingPromptBlock.includes('Google Chrome'), false, 'Pages copy/paste prompts should not mention Google Chrome');
});
