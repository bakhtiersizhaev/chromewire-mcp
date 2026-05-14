#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { z } from 'zod/v4';
import { DEFAULT_HOST, DEFAULT_PORT, getDefaultPreferencePath } from './config.js';
import { captureScreenshot, clickSelector, dispatchKey, endPersistentSession, evaluateExpression, executeCdpCommand, getInfo, getPreferredProfile, health, listPersistentSessions, listPipes, listProfiles, listUserTabs, moveMouse, openUrl, persistentClickSelector, persistentClickXY, persistentEvaluate, persistentKey, persistentMoveMouse, persistentNavigate, persistentNetworkSummary, persistentScreenshot, persistentScroll, persistentTypeSelector, persistentTypeText, persistentVisibleText, ping, readTitle, scrollBy, setPreferredProfile, startPersistentSession, typeSelector, visibleText } from './codexChromePipe.js';

const PORT = DEFAULT_PORT;
const HOST = DEFAULT_HOST;

function json(value) {
  const normalized = value === undefined ? { ok: true, result: null } : value;
  return { content: [{ type: 'text', text: JSON.stringify(normalized, null, 2) }] };
}

function makeServer() {
  const server = new McpServer({ name: 'codex-chrome', version: '0.1.0' }, { capabilities: { logging: {} } });



  server.registerTool('codex_chrome_list_profiles', {
    description: 'List Chrome profiles known to the official Codex Chrome Extension bridge, including which profiles currently have a reachable extension pipe. Use when the user wants to choose which real Chrome profile GSD controls. Does not read page content, cookies, history, or storage.',
    inputSchema: {},
  }, async () => json({ preferred: await getPreferredProfile(), profiles: await listProfiles() }));

  server.registerTool('codex_chrome_set_profile', {
    description: 'Set the preferred real Chrome profile for subsequent codex-chrome tools. Selector can be profileDir like Default/Profile 1, visible profile name, email, shortcutName, gaiaName, or extensionInstanceId. Persists to the user-local preference file returned by the bridge health/profile tools.',
    inputSchema: {
      selector: z.string().describe('Profile selector, e.g. Default, Profile 1, a visible profile name, an email shown by Chrome, or an extensionInstanceId.'),
    },
  }, async ({ selector }) => json(await setPreferredProfile(selector)));

  server.registerTool('codex_chrome_health', {
    description: 'Read-only health check for the official Codex Chrome Extension native-host pipe. Use first before any Chrome-control action. Does not inspect tabs, page content, cookies, history, or storage.',
    inputSchema: {},
  }, async () => json(await health()));

  server.registerTool('codex_chrome_list_pipes', {
    description: 'List local Windows named pipes matching codex-browser-use*. Diagnostic only; does not connect to Chrome or read browser data.',
    inputSchema: {},
  }, async () => json({ pipes: listPipes().map((p) => p.name) }));

  server.registerTool('codex_chrome_ping', {
    description: 'Send ping over the official Codex Chrome Extension native-host pipe. Low-risk protocol smoke test; does not read browser data.',
    inputSchema: {},
  }, async () => json(await ping()));

  server.registerTool('codex_chrome_get_info', {
    description: 'Read extension identity/version from the official Codex Chrome backend. Safe diagnostic metadata only; no tabs, cookies, history, page content, or storage.',
    inputSchema: {},
  }, async () => json(await getInfo()));

  server.registerTool('codex_chrome_list_user_tabs', {
    description: 'List currently open Chrome tabs via the official Codex Chrome Extension. Privacy-sensitive because titles and URLs may reveal personal data; use only when the user explicitly asks to work with their real Chrome tabs.',
    inputSchema: {},
  }, async () => json(await listUserTabs()));

  server.registerTool('codex_chrome_open_url', {
    description: 'Open a new real Chrome tab through the official Codex Chrome Extension and navigate to an http(s) URL. Best for localhost/test URLs. Mutates browser state by opening a tab.',
    inputSchema: {
      url: z.string().url().describe('Complete http:// or https:// URL to open.'),
      sessionName: z.string().default('🔎 GSD Codex Chrome').describe('Label for the Codex-controlled Chrome session/tab group.'),
    },
  }, async ({ url, sessionName }) => json(await openUrl(url, sessionName)));

  server.registerTool('codex_chrome_read_title', {
    description: 'Read document.title from a specific Chrome tab id via the official Codex Chrome Extension. Does not read cookies, storage, history, or full DOM.',
    inputSchema: {
      tabId: z.number().int().positive().describe('Chrome tab id to inspect.'),
      sessionId: z.string().optional().describe('Optional session id returned by codex_chrome_open_url. If omitted, the bridge claims the tab first.'),
    },
  }, async ({ tabId, sessionId }) => json(await readTitle(tabId, sessionId ?? null)));


  server.registerTool('codex_chrome_evaluate', {
    description: 'Evaluate a JavaScript expression in a specific Chrome tab via the official Codex Chrome Extension. Use for targeted page checks on an explicitly chosen tab. Do not use to read cookies, localStorage/sessionStorage, secrets, or hidden sensitive data unless the user explicitly requests that.',
    inputSchema: {
      tabId: z.number().int().positive().describe('Chrome tab id to evaluate in.'),
      expression: z.string().describe('JavaScript expression to evaluate. Prefer short read-only expressions such as document.title or a specific selector text.'),
      sessionId: z.string().optional().describe('Optional session id returned by codex_chrome_open_url.'),
    },
  }, async ({ tabId, expression, sessionId }) => json(await evaluateExpression(tabId, expression, sessionId ?? null)));

  server.registerTool('codex_chrome_visible_text', {
    description: 'Read visible text from a selector in a specific Chrome tab. This is safer than dumping full HTML but still page-content access; use only for the tab/domain the user asked to inspect.',
    inputSchema: {
      tabId: z.number().int().positive().describe('Chrome tab id to inspect.'),
      selector: z.string().default('body').describe('CSS selector to read visible text from.'),
      maxChars: z.number().int().positive().max(12000).default(4000).describe('Maximum visible text characters to return.'),
      sessionId: z.string().optional().describe('Optional session id returned by codex_chrome_open_url.'),
    },
  }, async ({ tabId, selector, maxChars, sessionId }) => json(await visibleText(tabId, selector, sessionId ?? null, maxChars)));

  server.registerTool('codex_chrome_click', {
    description: 'Click an element matching a CSS selector in a specific Chrome tab. Mutates page/browser state. Use only on an explicitly chosen tab and avoid destructive buttons unless the user asked for that action.',
    inputSchema: {
      tabId: z.number().int().positive().describe('Chrome tab id to interact with.'),
      selector: z.string().describe('CSS selector for the element to click.'),
      sessionId: z.string().optional().describe('Optional session id returned by codex_chrome_open_url.'),
    },
  }, async ({ tabId, selector, sessionId }) => json(await clickSelector(tabId, selector, sessionId ?? null)));

  server.registerTool('codex_chrome_type', {
    description: 'Set the value of an input/textarea/content field matching a CSS selector in a specific Chrome tab and dispatch input/change events. Mutates page state; do not enter secrets unless the user explicitly provides and authorizes them.',
    inputSchema: {
      tabId: z.number().int().positive().describe('Chrome tab id to interact with.'),
      selector: z.string().describe('CSS selector for the input element.'),
      text: z.string().describe('Text to put into the field.'),
      sessionId: z.string().optional().describe('Optional session id returned by codex_chrome_open_url.'),
    },
  }, async ({ tabId, selector, text, sessionId }) => json(await typeSelector(tabId, selector, text, sessionId ?? null)));

  server.registerTool('codex_chrome_execute_cdp', {
    description: 'Advanced: execute a Chrome DevTools Protocol command on a specific tab through the official Codex Chrome Extension. Use only when safer high-level tools are insufficient. Do not use for cookies, storage, auth headers, network secrets, or browser history unless explicitly authorized.',
    inputSchema: {
      tabId: z.number().int().positive().describe('Chrome tab id to target.'),
      method: z.string().describe('CDP method, e.g. Runtime.evaluate or Page.navigate.'),
      commandParams: z.record(z.string(), z.any()).default({}).describe('CDP command parameters.'),
      timeoutMs: z.number().int().positive().max(30000).default(8000).describe('CDP timeout in milliseconds.'),
      sessionId: z.string().optional().describe('Optional session id returned by codex_chrome_open_url.'),
    },
  }, async ({ tabId, method, commandParams, timeoutMs, sessionId }) => json(await executeCdpCommand(tabId, method, commandParams, sessionId ?? null, timeoutMs)));


  server.registerTool('codex_chrome_move_mouse', {
    description: 'Move the visible Codex cursor overlay in a specific Chrome tab through the official extension. This is part of computer-use style interaction. Use with an explicitly selected tab only.',
    inputSchema: {
      tabId: z.number().int().positive().describe('Chrome tab id to target.'),
      x: z.number().describe('Viewport x coordinate.'),
      y: z.number().describe('Viewport y coordinate.'),
      waitForArrival: z.boolean().default(false).describe('Whether to wait for the content-script cursor arrival acknowledgement.'),
      sessionId: z.string().optional().describe('Optional session id returned by codex_chrome_open_url.'),
    },
  }, async ({ tabId, x, y, waitForArrival, sessionId }) => json(await moveMouse(tabId, x, y, sessionId ?? null, waitForArrival)));

  server.registerTool('codex_chrome_screenshot', {
    description: 'Capture a JPEG screenshot of a specific Chrome tab through CDP. Returns only a base64 prefix and byte length to avoid huge tool output; use for proof/diagnostics, not sensitive pages unless explicitly authorized.',
    inputSchema: {
      tabId: z.number().int().positive().describe('Chrome tab id to capture.'),
      maxChars: z.number().int().positive().max(8000).default(1200).describe('Maximum base64 prefix characters to return.'),
      sessionId: z.string().optional().describe('Optional session id returned by codex_chrome_open_url.'),
    },
  }, async ({ tabId, maxChars, sessionId }) => json(await captureScreenshot(tabId, sessionId ?? null, maxChars)));

  server.registerTool('codex_chrome_key', {
    description: 'Dispatch a keyboard key event to a specific Chrome tab through CDP. Mutates page state; use only on an explicitly selected tab.',
    inputSchema: {
      tabId: z.number().int().positive().describe('Chrome tab id to target.'),
      key: z.string().describe('Key value such as Enter, Escape, Tab, ArrowDown, or a single character.'),
      sessionId: z.string().optional().describe('Optional session id returned by codex_chrome_open_url.'),
    },
  }, async ({ tabId, key, sessionId }) => json(await dispatchKey(tabId, key, sessionId ?? null)));

  server.registerTool('codex_chrome_scroll', {
    description: 'Scroll a specific Chrome tab vertically by deltaY pixels. Mutates viewport only. Use on an explicitly selected tab.',
    inputSchema: {
      tabId: z.number().int().positive().describe('Chrome tab id to scroll.'),
      deltaY: z.number().default(600).describe('Vertical scroll delta in pixels; positive scrolls down.'),
      sessionId: z.string().optional().describe('Optional session id returned by codex_chrome_open_url.'),
    },
  }, async ({ tabId, deltaY, sessionId }) => json(await scrollBy(tabId, deltaY, sessionId ?? null)));


  server.registerTool('codex_chrome_agent_start', {
    description: 'Start a persistent agent-owned Chrome session/tab via the official Codex Chrome Extension. Use this when the user wants to keep working in their own tabs while GSD works in separate agent tabs. Attaches debugger once and reuses the session to avoid repeated DevTools attach/detach flicker.',
    inputSchema: {
      url: z.string().url().optional().describe('Optional http(s) URL to open in a new agent tab.'),
      tabId: z.number().int().positive().optional().describe('Optional existing tab id to claim instead of creating a new tab.'),
      name: z.string().default('🖱️ GSD persistent Chrome').describe('Session/tab group label.'),
    },
  }, async ({ url, tabId, name }) => json(await startPersistentSession({ url: url ?? null, tabId: tabId ?? null, name })));

  server.registerTool('codex_chrome_agent_list', {
    description: 'List currently active persistent agent-owned Chrome sessions tracked by this bridge. Does not inspect page content.',
    inputSchema: {},
  }, async () => json({ sessions: listPersistentSessions() }));

  server.registerTool('codex_chrome_agent_end', {
    description: 'End a persistent agent-owned Chrome session and detach debugger from its tab. Use when GSD is done with its own tab so the Chrome DevTools banner goes away.',
    inputSchema: {
      sessionId: z.string().describe('Persistent session id returned by codex_chrome_agent_start.'),
    },
  }, async ({ sessionId }) => json(await endPersistentSession(sessionId)));

  server.registerTool('codex_chrome_agent_evaluate', {
    description: 'Evaluate a JavaScript expression inside a persistent agent-owned tab. Reuses the existing debugger attachment instead of attaching/detaching each time. Do not use to read cookies/storage/secrets unless explicitly authorized.',
    inputSchema: {
      sessionId: z.string().describe('Persistent session id returned by codex_chrome_agent_start.'),
      expression: z.string().describe('JavaScript expression to evaluate.'),
    },
  }, async ({ sessionId, expression }) => json(await persistentEvaluate(sessionId, expression)));

  server.registerTool('codex_chrome_agent_visible_text', {
    description: 'Read visible text from a selector inside a persistent agent-owned tab. Safer than full DOM; still page-content access.',
    inputSchema: {
      sessionId: z.string().describe('Persistent session id returned by codex_chrome_agent_start.'),
      selector: z.string().default('body').describe('CSS selector to read visible text from.'),
      maxChars: z.number().int().positive().max(12000).default(4000).describe('Maximum characters to return.'),
    },
  }, async ({ sessionId, selector, maxChars }) => json(await persistentVisibleText(sessionId, selector, maxChars)));


  server.registerTool('codex_chrome_agent_navigate', {
    description: 'Navigate an existing persistent agent-owned tab to a new URL without opening a new Chrome tab/group. Use this for real-site testing when the agent should keep working in the same tab while the user works elsewhere.',
    inputSchema: {
      sessionId: z.string().describe('Persistent session id returned by codex_chrome_agent_start.'),
      url: z.string().url().describe('Complete http:// or https:// URL to navigate the existing agent tab to.'),
      timeoutMs: z.number().int().positive().max(30000).default(12000).describe('Navigation timeout in milliseconds.'),
    },
  }, async ({ sessionId, url, timeoutMs }) => json(await persistentNavigate(sessionId, url, timeoutMs)));

  server.registerTool('codex_chrome_agent_network_summary', {
    description: 'Summarize Resource Timing entries from the current page in a persistent agent-owned tab. This is a safe network/performance analysis surface: it does not dump cookies, auth headers, request bodies, or browser history.',
    inputSchema: {
      sessionId: z.string().describe('Persistent session id returned by codex_chrome_agent_start.'),
      maxEntries: z.number().int().positive().max(200).default(40).describe('Maximum recent resource timing entries to include.'),
    },
  }, async ({ sessionId, maxEntries }) => json(await persistentNetworkSummary(sessionId, maxEntries)));

  server.registerTool('codex_chrome_agent_screenshot', {
    description: 'Capture a screenshot of a persistent agent-owned tab. Returns only base64 prefix and length to keep output small.',
    inputSchema: {
      sessionId: z.string().describe('Persistent session id returned by codex_chrome_agent_start.'),
      maxChars: z.number().int().positive().max(8000).default(1200).describe('Maximum base64 prefix characters to return.'),
    },
  }, async ({ sessionId, maxChars }) => json(await persistentScreenshot(sessionId, maxChars)));

  server.registerTool('codex_chrome_agent_scroll', {
    description: 'Scroll a persistent agent-owned tab by deltaY pixels. This does not affect the user\'s unrelated tabs.',
    inputSchema: {
      sessionId: z.string().describe('Persistent session id returned by codex_chrome_agent_start.'),
      deltaY: z.number().default(600).describe('Vertical scroll delta in pixels.'),
    },
  }, async ({ sessionId, deltaY }) => json(await persistentScroll(sessionId, deltaY)));


  server.registerTool('codex_chrome_agent_move_mouse', {
    description: 'Move the visible Codex cursor overlay inside a persistent agent-owned tab. This preserves the original Codex-in-Chrome style cursor/computer-use behavior while keeping the user\'s other tabs untouched.',
    inputSchema: {
      sessionId: z.string().describe('Persistent session id returned by codex_chrome_agent_start.'),
      x: z.number().describe('Viewport x coordinate.'),
      y: z.number().describe('Viewport y coordinate.'),
      waitForArrival: z.boolean().default(false).describe('Whether to wait for the cursor arrival acknowledgement.'),
    },
  }, async ({ sessionId, x, y, waitForArrival }) => json(await persistentMoveMouse(sessionId, x, y, waitForArrival)));

  server.registerTool('codex_chrome_agent_click_xy', {
    description: 'Move the Codex cursor and click viewport coordinates inside a persistent agent-owned tab. Use when selector clicks are insufficient and visual computer-use behavior is needed.',
    inputSchema: {
      sessionId: z.string().describe('Persistent session id returned by codex_chrome_agent_start.'),
      x: z.number().describe('Viewport x coordinate.'),
      y: z.number().describe('Viewport y coordinate.'),
      button: z.enum(['left', 'right', 'middle']).default('left').describe('Mouse button.'),
    },
  }, async ({ sessionId, x, y, button }) => json(await persistentClickXY(sessionId, x, y, button)));

  server.registerTool('codex_chrome_agent_click', {
    description: 'Click an element by CSS selector inside a persistent agent-owned tab. This does not affect the user\'s unrelated tabs.',
    inputSchema: {
      sessionId: z.string().describe('Persistent session id returned by codex_chrome_agent_start.'),
      selector: z.string().describe('CSS selector for the element to click.'),
    },
  }, async ({ sessionId, selector }) => json(await persistentClickSelector(sessionId, selector)));

  server.registerTool('codex_chrome_agent_type', {
    description: 'Set text into an input/textarea by selector inside a persistent agent-owned tab. Do not enter secrets unless the user explicitly authorizes it.',
    inputSchema: {
      sessionId: z.string().describe('Persistent session id returned by codex_chrome_agent_start.'),
      selector: z.string().describe('CSS selector for the input element.'),
      text: z.string().describe('Text to put into the field.'),
    },
  }, async ({ sessionId, selector, text }) => json(await persistentTypeSelector(sessionId, selector, text)));

  server.registerTool('codex_chrome_agent_key', {
    description: 'Dispatch a keyboard key event inside a persistent agent-owned tab. Use for Enter/Escape/Tab/arrows or simple key presses.',
    inputSchema: {
      sessionId: z.string().describe('Persistent session id returned by codex_chrome_agent_start.'),
      key: z.string().describe('Key value such as Enter, Escape, Tab, ArrowDown, or a single character.'),
    },
  }, async ({ sessionId, key }) => json(await persistentKey(sessionId, key)));

  server.registerTool('codex_chrome_agent_insert_text', {
    description: 'Insert raw text at the current focused element inside a persistent agent-owned tab using CDP Input.insertText.',
    inputSchema: {
      sessionId: z.string().describe('Persistent session id returned by codex_chrome_agent_start.'),
      text: z.string().describe('Text to insert at current focus.'),
    },
  }, async ({ sessionId, text }) => json(await persistentTypeText(sessionId, text)));

  return server;
}

const app = createMcpExpressApp();

app.get('/health', async (_req, res) => {
  try { res.json(await health()); }
  catch (error) { res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) }); }
});

app.post('/mcp', async (req, res) => {
  const server = makeServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on('close', () => { transport.close(); server.close(); });
  } catch (error) {
    console.error('codex-chrome MCP request failed:', error);
    if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
  }
});

app.get('/mcp', (_req, res) => res.writeHead(405).end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null })));
app.delete('/mcp', (_req, res) => res.writeHead(405).end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null })));

app.listen(PORT, HOST, (error) => {
  if (error) { console.error('Failed to start codex-chrome MCP bridge:', error); process.exit(1); }
  console.error(`codex-chrome MCP bridge listening on http://${HOST}:${PORT}/mcp`);
});
