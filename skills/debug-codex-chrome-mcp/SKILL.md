---
name: debug-codex-chrome-mcp
description: Diagnose connection problems between MCP clients, the bridge, Chrome, and the official Codex Chrome Extension.
---

# Debug codex-chrome MCP bridge

## Checklist

1. Is the bridge running?
2. Does `/health` return JSON?
3. Does MCP discovery list tools?
4. Does `codex_chrome_health` show at least one working pipe?
5. Is Chrome running with the target profile open?
6. Is the official Codex Chrome Extension installed and enabled?
7. Is the selected profile reachable? If not, call `codex_chrome_list_profiles` and `codex_chrome_set_profile`.
8. If port `8962` is busy, use `CODEX_CHROME_MCP_PORT` and update the MCP client config.

Do not inspect cookies, passwords, browser history, storage, or unrelated tabs during debugging.
