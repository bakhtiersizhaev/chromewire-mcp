---
name: install-codex-chrome-mcp
description: Install and verify the codex-chrome MCP bridge for an MCP-compatible AI CLI.
---

# Install codex-chrome MCP bridge

Use this when a user wants an agent to install the bridge on a local machine.

## Steps

1. Verify Node.js 20+ is installed.
2. Verify Google Chrome is installed.
3. Install dependencies with `npm install`.
4. Run `npm test` and `npm run check`.
5. Start the bridge with `npm start`.
6. Configure the MCP client with `http://127.0.0.1:8962/mcp`.
7. Run `npm run smoke`.
8. Use `codex_chrome_health` to verify the extension pipe is reachable.

If health fails, ask the user to confirm the official Codex Chrome Extension is installed and enabled. Never expose the endpoint outside localhost unless the user explicitly accepts the security risk.
