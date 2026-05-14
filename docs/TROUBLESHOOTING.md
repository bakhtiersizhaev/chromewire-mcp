# Troubleshooting

## MCP discovery returns `fetch failed`

The bridge is not running or the client points at the wrong port.

```bash
npm start
```

Default endpoint:

```text
http://127.0.0.1:8962/mcp
```

## Health says no working pipe

Check that Chrome is running, the official Codex Chrome Extension is installed and enabled, the target profile is open, and the native host is working.

Then run:

```bash
npm run smoke
```

## Wrong Chrome profile

Use `codex_chrome_list_profiles`, then `codex_chrome_set_profile` with a profile directory, visible profile name, email shown by Chrome, or extension instance id.

## Port is busy

```bash
CODEX_CHROME_MCP_PORT=8970 npm start
```

Update your MCP client config URL to match.
