import fs from 'node:fs';
import fsp from 'node:fs/promises';
import net from 'node:net';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { EXPECTED_EXTENSION_ID, getClassicLevelModuleSpecifier, getDefaultPreferencePath, getDefaultUserDataDir } from './config.js';

const PREFIX = 'codex-browser-use';
const TIMEOUT = 2500;
const DEFAULT_UNIX_SOCKET_DIR = process.platform === 'darwin' ? path.join('/tmp', PREFIX) : path.join(os.tmpdir(), PREFIX);
const USER_DATA_DIR = getDefaultUserDataDir();
const PREFERENCE_PATH = getDefaultPreferencePath();
const DEFAULT_PROFILE_SELECTOR = process.env.CODEX_CHROME_DEFAULT_PROFILE || 'Default';
const CLASSIC_LEVEL_MODULE = getClassicLevelModuleSpecifier();

function pipeRoot() {
  const b = String.fromCharCode(92);
  return b + b + '.' + b + 'pipe' + b;
}

export function listPipes() {
  if (process.platform !== 'win32') return listUnixSockets();
  const r = pipeRoot();
  try {
    return fs.readdirSync(r).filter((n) => n.startsWith(PREFIX)).map((n) => ({ name: n, path: r + n }));
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return [];
    throw error;
  }
}

export function listUnixSockets({ socketDir = process.env.CODEX_CHROME_SOCKET_DIR || DEFAULT_UNIX_SOCKET_DIR } = {}) {
  try {
    return fs.readdirSync(socketDir)
      .filter((name) => name.endsWith('.sock'))
      .map((name) => ({ name, path: path.join(socketDir, name) }))
      .filter((socket) => {
        try {
          return fs.statSync(socket.path).isSocket();
        } catch {
          return false;
        }
      });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

function frame(obj) {
  const body = Buffer.from(JSON.stringify(obj), 'utf8');
  const out = Buffer.alloc(4 + body.length);
  out.writeUInt32LE(body.length, 0);
  body.copy(out, 4);
  return out;
}

class Client {
  constructor(pipePath, timeout = TIMEOUT) {
    this.pipePath = pipePath;
    this.timeout = timeout;
    this.nextId = 1;
    this.pending = new Map();
    this.buf = Buffer.alloc(0);
    this.sock = null;
  }

  connect() {
    if (this.sock) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = net.createConnection(this.pipePath);
      this.sock = s;
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        s.destroy();
        reject(new Error(`connect timeout: ${this.pipePath}`));
      }, this.timeout);
      s.on('connect', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      });
      s.on('data', (chunk) => this.onData(chunk));
      s.on('error', (error) => {
        clearTimeout(timer);
        this.rejectAll(error);
        if (!settled) {
          settled = true;
          reject(error);
        }
      });
      s.on('close', () => {
        this.rejectAll(new Error('pipe closed'));
        this.sock = null;
      });
    });
  }

  onData(chunk) {
    this.buf = Buffer.concat([this.buf, chunk]);
    while (this.buf.length >= 4) {
      const len = this.buf.readUInt32LE(0);
      if (this.buf.length < 4 + len) return;
      const msg = JSON.parse(this.buf.subarray(4, 4 + len).toString('utf8'));
      this.buf = this.buf.subarray(4 + len);
      if (msg.id == null) continue;
      const p = this.pending.get(msg.id);
      if (!p) continue;
      this.pending.delete(msg.id);
      clearTimeout(p.timer);
      if (msg.error) p.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
      else p.resolve(msg.result);
    }
  }

  async request(method, params = {}) {
    await this.connect();
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`request timeout: ${method}`));
      }, this.timeout);
      this.pending.set(id, { resolve, reject, timer });
      this.sock.write(frame({ jsonrpc: '2.0', id, method, params }));
    });
  }

  rejectAll(error) {
    for (const [id, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(error);
      this.pending.delete(id);
    }
  }

  close() {
    this.sock?.destroy();
    this.sock = null;
  }
}

function sid() { return `gsd-${crypto.randomUUID()}`; }
function tid() { return `turn-${crypto.randomUUID()}`; }
function session(params, s, t) { return { ...params, session_id: s, turn_id: t }; }
function summarizeError(e) { return e instanceof Error ? `${e.name}: ${e.message}` : String(e); }
function normalize(value) { return String(value || '').trim().toLowerCase(); }

let pipeQueue = Promise.resolve();

async function withPipeLock(fn) {
  const previous = pipeQueue;
  let release;
  pipeQueue = new Promise((resolve) => { release = resolve; });
  await previous.catch(() => {});
  try {
    return await fn();
  } finally {
    release();
  }
}

function readPreferredRaw() {
  try {
    if (!fs.existsSync(PREFERENCE_PATH)) return null;
    return JSON.parse(fs.readFileSync(PREFERENCE_PATH, 'utf8'));
  } catch {
    return null;
  }
}

async function readExtensionInstanceId(profileDir) {
  const source = path.join(USER_DATA_DIR, profileDir, 'Local Extension Settings', EXPECTED_EXTENSION_ID);
  if (!fs.existsSync(source)) return null;
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'codex-ext-settings-'));
  try {
    await fsp.cp(source, tempDir, { recursive: true });
    await fsp.rm(path.join(tempDir, 'LOCK'), { force: true });
    const { ClassicLevel } = await import(CLASSIC_LEVEL_MODULE);
    const db = new ClassicLevel(tempDir, { createIfMissing: false, keyEncoding: 'utf8', valueEncoding: 'utf8' });
    try {
      await db.open();
      const raw = await db.get('extensionInstanceId').catch(() => null);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return typeof parsed === 'string' ? parsed : null;
    } finally {
      await db.close().catch(() => {});
    }
  } catch {
    return null;
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function probe(pipe, timeout = 1200) {
  const c = new Client(pipe.path, timeout);
  try {
    const ping = await c.request('ping', {});
    const info = await c.request('getInfo', session({}, 'gsd-probe', tid()));
    return { ok: info?.type === 'extension' && info?.metadata?.extensionId === EXPECTED_EXTENSION_ID, pipe, ping, info };
  } catch (e) {
    return { ok: false, pipe, error: summarizeError(e) };
  } finally {
    c.close();
  }
}

async function probeAllPipes(timeout = 1200) {
  const results = [];
  for (const pipe of listPipes()) results.push(await probe(pipe, timeout));
  return results;
}

export async function listProfiles() {
  const localStatePath = path.join(USER_DATA_DIR, 'Local State');
  const localState = JSON.parse(fs.readFileSync(localStatePath, 'utf8'));
  const order = localState.profile?.profiles_order || [];
  const infoCache = localState.profile?.info_cache || {};
  const lastUsed = localState.profile?.last_used || null;
  const pref = readPreferredRaw();
  const probes = await probeAllPipes(900);
  const countByInstance = new Map();
  for (const probeResult of probes) {
    const id = probeResult.info?.metadata?.extensionInstanceId;
    if (probeResult.ok && id) countByInstance.set(id, (countByInstance.get(id) || 0) + 1);
  }
  const profiles = [];
  for (const profileDir of order) {
    const prefsPath = path.join(USER_DATA_DIR, profileDir, 'Preferences');
    if (!fs.existsSync(prefsPath)) continue;
    const info = infoCache[profileDir] || {};
    const extensionInstanceId = await readExtensionInstanceId(profileDir);
    profiles.push({
      profileDir,
      name: info.name || profileDir,
      shortcutName: info.shortcut_name || null,
      gaiaName: info.gaia_name || null,
      userName: info.user_name || null,
      isLastUsed: profileDir === lastUsed,
      extensionInstanceId,
      workingPipeCount: extensionInstanceId ? (countByInstance.get(extensionInstanceId) || 0) : 0,
      isPreferred: Boolean(extensionInstanceId && pref?.extensionInstanceId === extensionInstanceId),
    });
  }
  return profiles;
}

function findProfileBySelector(profiles, selector) {
  const wanted = normalize(selector);
  if (!wanted) return null;
  const fields = (profile) => [profile.profileDir, profile.name, profile.shortcutName, profile.gaiaName, profile.userName, profile.extensionInstanceId].filter(Boolean);
  return profiles.find((p) => fields(p).some((v) => normalize(v) === wanted))
    || profiles.find((p) => fields(p).some((v) => normalize(v).includes(wanted)));
}

export async function getPreferredProfile() {
  const profiles = await listProfiles();
  const pref = readPreferredRaw();
  let selected = null;
  if (pref?.extensionInstanceId) selected = profiles.find((p) => p.extensionInstanceId === pref.extensionInstanceId) || null;
  if (!selected && pref?.profileDir) selected = profiles.find((p) => p.profileDir === pref.profileDir) || null;
  if (!selected) selected = findProfileBySelector(profiles, DEFAULT_PROFILE_SELECTOR) || profiles.find((p) => p.isLastUsed) || profiles.find((p) => p.extensionInstanceId) || null;
  return { preferencePath: PREFERENCE_PATH, configured: pref, selected };
}

export async function setPreferredProfile(selector) {
  const profiles = await listProfiles();
  const selected = findProfileBySelector(profiles, selector);
  if (!selected) return { ok: false, selector, error: 'profile not found', profiles };
  if (!selected.extensionInstanceId) return { ok: false, selector, selected, error: 'profile has no Codex Chrome extensionInstanceId; open this profile and ensure the extension is installed/enabled' };
  const pref = {
    profileDir: selected.profileDir,
    name: selected.name,
    shortcutName: selected.shortcutName,
    gaiaName: selected.gaiaName,
    userName: selected.userName,
    extensionInstanceId: selected.extensionInstanceId,
    updatedAt: new Date().toISOString(),
  };
  await fsp.mkdir(path.dirname(PREFERENCE_PATH), { recursive: true });
  await fsp.writeFile(PREFERENCE_PATH, JSON.stringify(pref, null, 2), 'utf8');
  return { ok: true, preferencePath: PREFERENCE_PATH, selected: pref };
}

export async function findPipe(timeout = 1200) {
  const preferred = await getPreferredProfile();
  const probes = await probeAllPipes(timeout);
  const working = probes.filter((p) => p.ok);
  const targetInstanceId = preferred.selected?.extensionInstanceId || null;
  if (targetInstanceId) {
    const matched = working.find((p) => p.info?.metadata?.extensionInstanceId === targetInstanceId);
    if (matched) return { pipe: matched.pipe, probe: matched, failures: probes.filter((p) => !p.ok), preferredProfile: preferred.selected };
    throw new Error(`Preferred Chrome profile is not reachable: ${preferred.selected.profileDir} / ${preferred.selected.name} / ${targetInstanceId}. Working instances: ${working.map((p) => p.info?.metadata?.extensionInstanceId).filter(Boolean).join(', ') || 'none'}`);
  }
  if (working[0]) return { pipe: working[0].pipe, probe: working[0], failures: probes.filter((p) => !p.ok), preferredProfile: null };
  throw new Error(`No working Codex Chrome pipe among ${probes.length}: ${probes.slice(0, 6).map((f) => `${f.pipe.name}=${f.error || 'wrong extension'}`).join('; ')}`);
}

async function usingClient(fn, timeout = TIMEOUT) {
  return await withPipeLock(async () => {
    const { pipe, preferredProfile } = await findPipe(Math.min(timeout, 1500));
    const c = new Client(pipe.path, timeout);
    try { return { pipe, preferredProfile, result: await fn(c, pipe) }; }
    finally { c.close(); }
  });
}

export async function health() {
  const pipes = listPipes();
  const preferred = await getPreferredProfile();
  try {
    const work = await findPipe(1200);
    return { ok: true, pipeCount: pipes.length, workingPipe: work.pipe.name, preferredProfile: preferred.selected, info: work.probe.info, samplePipes: pipes.slice(0, 20).map((p) => p.name) };
  } catch (e) {
    const failures = [];
    for (const pipe of pipes.slice(0, 6)) failures.push(await probe(pipe, 600));
    return {
      ok: false,
      pipeCount: pipes.length,
      preferredProfile: preferred.selected,
      error: summarizeError(e),
      samplePipes: pipes.slice(0, 20).map((p) => p.name),
      sampleFailures: failures.map((failure) => ({ pipe: failure.pipe?.name, error: failure.error || (failure.ok ? null : 'wrong extension') })),
    };
  }
}

export async function ping() {
  return await usingClient(async (c) => await c.request('ping', {}));
}

export async function getInfo() {
  return await usingClient(async (c) => await c.request('getInfo', session({}, sid(), tid())));
}

export async function listUserTabs() {
  const s = sid(), t = tid();
  return await usingClient(async (c) => await c.request('getUserTabs', session({}, s, t)), 4000);
}

export async function openUrl(url, name = '🔎 GSD Codex Chrome') {
  const s = sid(), t = tid();
  return await usingClient(async (c) => {
    await c.request('nameSession', session({ name }, s, t));
    const tab = await c.request('createTab', session({}, s, t));
    const tabId = Number(tab?.id ?? tab?.tabId);
    if (!Number.isInteger(tabId)) throw new Error(`createTab did not return numeric id: ${JSON.stringify(tab)}`);
    await c.request('attach', session({ tabId }, s, t));
    let navigation;
    try {
      navigation = await c.request('executeCdp', session({ target: { tabId }, method: 'Page.navigate', commandParams: { url }, timeoutMs: 8000 }, s, t));
    } finally {
      await c.request('detach', session({ tabId }, s, t)).catch(() => {});
    }
    return { tab, tabId, sessionId: s, navigation };
  }, 10000);
}

export async function executeCdpCommand(tabId, method, commandParams = {}, existingSessionId = null, timeoutMs = 8000) {
  const s = existingSessionId || sid();
  const t = tid();
  return await usingClient(async (c) => {
    if (!existingSessionId) await c.request('claimUserTab', session({ tabId }, s, t));
    await c.request('attach', session({ tabId }, s, t));
    try {
      return await c.request('executeCdp', session({ target: { tabId }, method, commandParams, timeoutMs }, s, t));
    } finally {
      await c.request('detach', session({ tabId }, s, t)).catch(() => {});
    }
  }, Math.max(timeoutMs + 2000, 8000));
}

export async function evaluateExpression(tabId, expression, existingSessionId = null) {
  return await executeCdpCommand(tabId, 'Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, existingSessionId, 8000);
}

export async function readTitle(tabId, existingSessionId = null) {
  return await evaluateExpression(tabId, 'document.title', existingSessionId);
}

export async function clickSelector(tabId, selector, existingSessionId = null) {
  const expression = `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return { ok:false, error:'selector not found' }; el.click(); return { ok:true, tagName: el.tagName, text: (el.innerText || el.value || '').slice(0,120) }; })()`;
  return await evaluateExpression(tabId, expression, existingSessionId);
}

export async function typeSelector(tabId, selector, text, existingSessionId = null) {
  const expression = `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return { ok:false, error:'selector not found' }; el.focus(); const value = ${JSON.stringify(text)}; const proto = Object.getPrototypeOf(el); const desc = Object.getOwnPropertyDescriptor(proto, 'value'); if (desc && desc.set) desc.set.call(el, value); else el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return { ok:true, tagName: el.tagName, length: value.length }; })()`;
  return await evaluateExpression(tabId, expression, existingSessionId);
}

export async function visibleText(tabId, selector = 'body', existingSessionId = null, maxChars = 4000) {
  const expression = `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return { ok:false, error:'selector not found' }; return { ok:true, text: (el.innerText || el.textContent || '').slice(0, ${Number(maxChars) || 4000}) }; })()`;
  return await evaluateExpression(tabId, expression, existingSessionId);
}

export async function moveMouse(tabId, x, y, existingSessionId = null, waitForArrival = false) {
  const s = existingSessionId || sid();
  const t = tid();
  return await usingClient(async (c) => {
    if (!existingSessionId) await c.request('claimUserTab', session({ tabId }, s, t));
    return await c.request('moveMouse', session({ tabId, x, y, waitForArrival }, s, t));
  }, waitForArrival ? 6000 : 3000);
}

export async function captureScreenshot(tabId, existingSessionId = null, maxChars = 1200) {
  const response = await executeCdpCommand(tabId, 'Page.captureScreenshot', { format: 'jpeg', quality: 70, captureBeyondViewport: false }, existingSessionId, 10000);
  const data = response?.result?.data || response?.data || null;
  return { ...response, result: { hasData: Boolean(data), mimeType: 'image/jpeg', base64Prefix: data ? data.slice(0, maxChars) : null, base64Length: data ? data.length : 0 } };
}

export async function dispatchKey(tabId, key, existingSessionId = null) {
  const code = key.length === 1 ? `Key${key.toUpperCase()}` : key;
  await executeCdpCommand(tabId, 'Input.dispatchKeyEvent', { type: 'keyDown', key, code }, existingSessionId, 5000);
  return await executeCdpCommand(tabId, 'Input.dispatchKeyEvent', { type: 'keyUp', key, code }, existingSessionId, 5000);
}

export async function scrollBy(tabId, deltaY = 600, existingSessionId = null) {
  return await evaluateExpression(tabId, `window.scrollBy(0, ${Number(deltaY) || 0}); ({ x: window.scrollX, y: window.scrollY })`, existingSessionId);
}

const persistentSessions = new Map();

function publicSession(record) {
  if (!record) return null;
  const { client, queue, ...safe } = record;
  return safe;
}

async function withSessionLock(record, fn) {
  const previous = record.queue || Promise.resolve();
  let release;
  record.queue = new Promise((resolve) => { release = resolve; });
  await previous.catch(() => {});
  try {
    return await fn();
  } finally {
    release();
  }
}

async function openPersistentClient(timeout = 30000) {
  const { pipe, preferredProfile } = await findPipe(1500);
  const client = new Client(pipe.path, timeout);
  await client.connect();
  return { client, pipe, preferredProfile };
}

export async function startPersistentSession({ url = null, tabId = null, name = '🖱️ GSD persistent Chrome' } = {}) {
  return await withPipeLock(async () => {
    const { client, pipe, preferredProfile } = await openPersistentClient(30000);
    const s = sid();
    const t = tid();
    try {
      await client.request('nameSession', session({ name }, s, t));
      let tab = null;
      let targetTabId = tabId == null ? null : Number(tabId);
      if (url) {
        tab = await client.request('createTab', session({}, s, t));
        targetTabId = Number(tab?.id ?? tab?.tabId);
        if (!Number.isInteger(targetTabId)) throw new Error(`createTab did not return numeric id: ${JSON.stringify(tab)}`);
      } else if (Number.isInteger(targetTabId)) {
        await client.request('claimUserTab', session({ tabId: targetTabId }, s, t));
      } else {
        tab = await client.request('createTab', session({}, s, t));
        targetTabId = Number(tab?.id ?? tab?.tabId);
        if (!Number.isInteger(targetTabId)) throw new Error(`createTab did not return numeric id: ${JSON.stringify(tab)}`);
      }
      await client.request('attach', session({ tabId: targetTabId }, s, t));
      let navigation = null;
      if (url) {
        navigation = await client.request('executeCdp', session({ target: { tabId: targetTabId }, method: 'Page.navigate', commandParams: { url }, timeoutMs: 10000 }, s, t));
      }
      const record = {
        sessionId: s,
        tabId: targetTabId,
        name,
        url,
        createdAt: new Date().toISOString(),
        pipe: pipe.name,
        preferredProfile,
        attached: true,
        client,
        queue: Promise.resolve(),
      };
      persistentSessions.set(s, record);
      return { ...publicSession(record), tab, navigation };
    } catch (error) {
      client.close();
      throw error;
    }
  });
}

export function listPersistentSessions() {
  return [...persistentSessions.values()].map(publicSession);
}

function getPersistentRecord(sessionId) {
  const record = persistentSessions.get(sessionId);
  if (!record) throw new Error(`persistent session not found: ${sessionId}`);
  return record;
}

async function ensurePersistentAttached(record) {
  // The official extension may scope debugger attachment to a native-host turn.
  // Re-issuing attach is idempotent enough for the extension, and importantly we
  // do not detach between actions, so the DevTools banner does not churn.
  await record.client.request('attach', session({ tabId: record.tabId }, record.sessionId, tid()));
  record.attached = true;
  record.reattachedAt = new Date().toISOString();
}

export async function endPersistentSession(sessionId) {
  const record = persistentSessions.get(sessionId);
  if (!record) return { ok: false, error: 'persistent session not found', sessions: listPersistentSessions() };
  return await withSessionLock(record, async () => {
    const t = tid();
    const detach = await record.client.request('detach', session({ tabId: record.tabId }, sessionId, t)).catch((error) => ({ error: summarizeError(error) }));
    const turnEnded = await record.client.request('turnEnded', session({}, sessionId, t)).catch((error) => ({ error: summarizeError(error) }));
    record.client.close();
    persistentSessions.delete(sessionId);
    return { ok: true, session: publicSession(record), detach, turnEnded };
  });
}

export async function persistentCdp(sessionId, method, commandParams = {}, timeoutMs = 8000) {
  const record = getPersistentRecord(sessionId);
  return await withSessionLock(record, async () => {
    const run = async () => {
      const turn = tid();
      await record.client.request('attach', session({ tabId: record.tabId }, sessionId, turn));
      record.attached = true;
      record.reattachedAt = new Date().toISOString();
      const params = session({ target: { tabId: record.tabId }, method, commandParams, timeoutMs }, sessionId, turn);
      return await record.client.request('executeCdp', params);
    };
    try {
      return await run();
    } catch (error) {
      if (String(error?.message || error).toLowerCase().includes('debugger is not attached')) {
        record.attached = false;
        const resetTurn = tid();
        await record.client.request('detach', session({ tabId: record.tabId }, sessionId, resetTurn)).catch(() => {});
        return await run();
      }
      throw error;
    }
  });
}

export async function persistentEvaluate(sessionId, expression) {
  return await persistentCdp(sessionId, 'Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, 8000);
}

export async function persistentVisibleText(sessionId, selector = 'body', maxChars = 4000) {
  const expression = `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return { ok:false, error:'selector not found' }; return { ok:true, text: (el.innerText || el.textContent || '').slice(0, ${Number(maxChars) || 4000}) }; })()`;
  return await persistentEvaluate(sessionId, expression);
}

export async function persistentClickSelector(sessionId, selector) {
  const expression = `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return { ok:false, error:'selector not found' }; el.click(); return { ok:true, tagName: el.tagName, text: (el.innerText || el.value || '').slice(0,120) }; })()`;
  return await persistentEvaluate(sessionId, expression);
}

export async function persistentTypeSelector(sessionId, selector, text) {
  const expression = `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return { ok:false, error:'selector not found' }; el.focus(); const value = ${JSON.stringify(text)}; const proto = Object.getPrototypeOf(el); const desc = Object.getOwnPropertyDescriptor(proto, 'value'); if (desc && desc.set) desc.set.call(el, value); else el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return { ok:true, tagName: el.tagName, length: value.length }; })()`;
  return await persistentEvaluate(sessionId, expression);
}

export async function persistentScreenshot(sessionId, maxChars = 1200) {
  const response = await persistentCdp(sessionId, 'Page.captureScreenshot', { format: 'jpeg', quality: 70, captureBeyondViewport: false }, 12000);
  const data = response?.data || response?.result?.data || null;
  return { hasData: Boolean(data), mimeType: 'image/jpeg', base64Prefix: data ? data.slice(0, maxChars) : null, base64Length: data ? data.length : 0 };
}

export async function persistentScroll(sessionId, deltaY = 600) {
  return await persistentEvaluate(sessionId, `window.scrollBy(0, ${Number(deltaY) || 0}); ({ x: window.scrollX, y: window.scrollY })`);
}

export async function persistentMoveMouse(sessionId, x, y, waitForArrival = false) {
  const record = getPersistentRecord(sessionId);
  return await withSessionLock(record, async () => {
    const result = await record.client.request('moveMouse', session({ tabId: record.tabId, x, y, waitForArrival }, sessionId, tid()));
    return result === undefined ? { ok: true, sessionId, tabId: record.tabId, x, y } : result;
  });
}

export async function persistentClickXY(sessionId, x, y, button = 'left') {
  await persistentMoveMouse(sessionId, x, y, false);
  await persistentCdp(sessionId, 'Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none' }, 5000);
  await persistentCdp(sessionId, 'Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button, clickCount: 1 }, 5000);
  return await persistentCdp(sessionId, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button, clickCount: 1 }, 5000);
}

export async function persistentKey(sessionId, key) {
  const code = key.length === 1 ? `Key${key.toUpperCase()}` : key;
  await persistentCdp(sessionId, 'Input.dispatchKeyEvent', { type: 'keyDown', key, code }, 5000);
  return await persistentCdp(sessionId, 'Input.dispatchKeyEvent', { type: 'keyUp', key, code }, 5000);
}

export async function persistentTypeText(sessionId, text) {
  return await persistentCdp(sessionId, 'Input.insertText', { text }, 5000);
}


export async function persistentNavigate(sessionId, url, timeoutMs = 12000) {
  const nav = await persistentCdp(sessionId, 'Page.navigate', { url }, timeoutMs);
  return { ok: true, url, navigation: nav };
}

export async function persistentNetworkSummary(sessionId, maxEntries = 40) {
  const expression = `(() => {
    const entries = performance.getEntriesByType('resource').slice(-${Number(maxEntries) || 40}).map((entry) => ({
      name: entry.name,
      initiatorType: entry.initiatorType,
      duration: Math.round(entry.duration),
      transferSize: entry.transferSize || 0,
      encodedBodySize: entry.encodedBodySize || 0,
      decodedBodySize: entry.decodedBodySize || 0,
    }));
    const totals = entries.reduce((acc, entry) => {
      acc.count += 1;
      acc.transferSize += entry.transferSize || 0;
      acc.encodedBodySize += entry.encodedBodySize || 0;
      acc.decodedBodySize += entry.decodedBodySize || 0;
      acc.byType[entry.initiatorType || 'other'] = (acc.byType[entry.initiatorType || 'other'] || 0) + 1;
      return acc;
    }, { count: 0, transferSize: 0, encodedBodySize: 0, decodedBodySize: 0, byType: {} });
    return { ok: true, url: location.href, title: document.title, totals, entries };
  })()`;
  return await persistentEvaluate(sessionId, expression);
}
