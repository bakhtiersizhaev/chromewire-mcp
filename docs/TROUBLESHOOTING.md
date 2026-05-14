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

On macOS, the Codex Chrome native host must also be registered in:

```text
~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.openai.codexextension.json
```

If `npm run doctor` reports that the native host manifest is missing, run:

```bash
npm run install:codex-native-host
```

The installer uses the native host bundled with the local Codex app and keeps the browser bridge on localhost.

If `npm run doctor` reports local sockets but `npm run smoke` fails with `pipe closed`, the Codex app may be rejecting the direct socket peer. In that case the native host is installed and socket discovery works, but ChromeWire still needs a compatible Codex-side peer path for full browser control.

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


## Official extension link

https://chromewebstore.google.com/detail/hehggadaopoacecdllhhajmbjkdcmajg

If the Chrome Web Store page is unavailable in your region, a USA VPN/proxy or USA IP may be required to install the official extension. Use only lawful and policy-compliant access methods.
