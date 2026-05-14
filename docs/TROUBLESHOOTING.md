# Troubleshooting

## MCP discovery returns `fetch failed`

The HTTP bridge is not running or the client points at the wrong port. If your MCP client supports stdio, prefer `node src/stdio.js` and skip the HTTP daemon entirely.

```bash
npm start
```

Default endpoint:

```text
http://127.0.0.1:8962/mcp
```

## Health says no working pipe

Check that Chrome is running, the official Codex Chrome Extension is installed and enabled, the target profile is open, and the native host is working.

On macOS, the Codex Chrome native host must also be registered in:

```text
~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.openai.codexextension.json
```

If `npm run doctor` reports that the native host manifest is missing, run:

```bash
npm run install:codex-native-host
```

The installer uses the native host bundled with the local Codex app and keeps the browser bridge on localhost.

If `npm run doctor` reports local sockets but `npm run smoke` fails with `pipe closed`, the Codex app is rejecting the direct socket peer. In that case the native host is installed and socket discovery works, but the MCP server must be launched by Codex.

Use stdio MCP config on macOS:

```toml
[mcp_servers.chromewire]
command = "/Applications/Codex.app/Contents/Resources/node"
args = ["/absolute/path/to/chromewire-mcp/src/stdio.js"]
startup_timeout_sec = 20.0
tool_timeout_sec = 180.0
```

Do not run the macOS bridge from `launchd` or Homebrew Node.js when you need extension access. The Codex socket authorizes the connecting peer by code signature and parent process ancestry.

## Windows native messaging host is missing

Windows Chrome native messaging requires a registry key, not just a manifest file. Run:

```bash
npm run install:codex-native-host
```

The installer writes the manifest and registers:

```text
HKCU\Software\Google\Chrome\NativeMessagingHosts\com.openai.codexextension
```

If the bundled Codex native host is in a non-standard location, set:

```bash
CODEX_CHROME_NATIVE_HOST_PATH="C:\path\to\extension-host.exe" npm run install:codex-native-host
```

## Ubuntu/Linux native host is missing

Chrome reads user native messaging manifests from:

```text
~/.config/google-chrome/NativeMessagingHosts/com.openai.codexextension.json
```

If Codex is installed in a non-standard location, set either:

```bash
CODEX_CHROME_NATIVE_HOST_PATH=/path/to/extension-host npm run install:codex-native-host
```

or:

```bash
CODEX_APP_RESOURCES_PATH=/path/to/Codex/resources npm run install:codex-native-host
```

Then run:

```bash
npm run smoke
```

On macOS, `npm run smoke` may report `macos_peer_authorization` because npm itself changes the process ancestry. That diagnostic is expected when the final MCP config uses Codex-launched stdio. For a direct live smoke from a Codex-launched shell, run:

```bash
/Applications/Codex.app/Contents/Resources/node scripts/smoke.js
```

To force smoke failures to exit non-zero in CI or local debugging:

```bash
CHROMEWIRE_STRICT_SMOKE=1 npm run smoke
```

## Wrong Chrome profile

Use `codex_chrome_list_profiles`, then `codex_chrome_set_profile` with a profile directory, visible profile name, email shown by Chrome, or extension instance id.

## Port is busy

```bash
CODEX_CHROME_MCP_PORT=8970 npm start
```

Update your MCP client config URL to match.


## Official extension link

https://chromewebstore.google.com/detail/hehggadaopoacecdllhhajmbjkdcmajg

If the Chrome Web Store page is unavailable in your region, a USA VPN/proxy or USA IP may be required to install the official extension. Use only lawful and policy-compliant access methods.
