---
name: install-codex-chrome-mcp
description: Install and verify ChromeWire MCP, the local bridge between the official Codex Chrome Extension and MCP-compatible AI CLI tools.
---

# Install ChromeWire MCP

Use this when a user wants an agent to install ChromeWire MCP on a local machine for GSD/Pi, Codex CLI, Claude Code, Cursor, Windsurf, or another MCP-compatible client.

## Official extension first

The user must have the official Codex Chrome Extension installed and enabled:

```text
https://chromewebstore.google.com/detail/hehggadaopoacecdllhhajmbjkdcmajg
```

If the Chrome Web Store listing is unavailable in the user's region, tell them that a USA IP via VPN/proxy may be required to install the official extension. Use only legal, policy-compliant access methods. Do not install random third-party mirrors.

## Agent install steps

1. Verify Node.js 20+ is installed.
2. Verify Google Chrome is installed.
3. Verify or ask the user to install the official Codex Chrome Extension from the link above.
4. Run `npm install`.
5. Run `npm test` and `npm run check`.
6. Run `npm run doctor`.
7. Start the bridge with `npm start` or `npx chromewire-mcp` after npm publication.
8. Configure the MCP client with `http://127.0.0.1:8962/mcp`.
9. Run `npm run smoke`.
10. Use `codex_chrome_health` to verify the extension pipe is reachable.
11. If multiple Chrome profiles exist, use `codex_chrome_list_profiles` and `codex_chrome_set_profile`.

## MCP config

```json
{
  "mcpServers": {
    "chromewire": {
      "type": "http",
      "url": "http://127.0.0.1:8962/mcp"
    }
  }
}
```

## Security rules for agents

- Keep the server bound to `127.0.0.1`.
- Never expose the endpoint through a public tunnel.
- Do not read cookies, passwords, browser history, localStorage, sessionStorage, auth headers, or unrelated tabs.
- Do not take destructive browser actions unless the user explicitly asks.
- Do not commit local files such as `profile-preference.json`, `.env`, logs, or user profile dumps.
