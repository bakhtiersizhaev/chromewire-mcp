---
name: debug-codex-chrome-mcp
description: Diagnose ChromeWire MCP connection problems between MCP clients, the bridge, Chrome, and the official Codex Chrome Extension.
---

# Debug ChromeWire MCP

Use this when ChromeWire MCP cannot connect, MCP discovery fails, or browser actions do not work.

## First checks

1. Run `npm run doctor`.
2. Confirm the bridge is running on `http://127.0.0.1:8962/mcp`.
3. Confirm the MCP client config points to the same host and port.
4. Run `npm run smoke`.
5. Call `codex_chrome_health` from the MCP client.

## Official extension check

The official Codex Chrome Extension must be installed and enabled:

```text
https://chromewebstore.google.com/detail/hehggadaopoacecdllhhajmbjkdcmajg
```

If the webstore listing is unavailable, the user's region may not have access. A USA IP via VPN/proxy may be required. Use only legal, policy-compliant access methods and never install unofficial mirrors.

## Common fixes

- `fetch failed`: start the bridge or fix the MCP URL.
- `No working Codex Chrome pipe`: open Chrome, enable the official extension, and open the target Chrome profile.
- Wrong profile: call `codex_chrome_list_profiles`, then `codex_chrome_set_profile`.
- Port busy: set `CODEX_CHROME_MCP_PORT=8970` and update MCP config.
- macOS/Linux: current working browser transport is Windows named pipes; platform adapters are planned.

## Do not do this while debugging

- Do not inspect cookies, passwords, browser history, storage, auth headers, or unrelated tabs.
- Do not expose the local MCP endpoint publicly.
- Do not paste unredacted smoke/doctor output into public issues.
