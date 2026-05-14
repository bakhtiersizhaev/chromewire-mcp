# Architecture

```mermaid
flowchart TD
    Chrome[Google Chrome profile] --> Ext[Official Codex Chrome Extension]
    Ext --> Native[Local native host / browser pipe]
    Native --> Bridge[codex-chrome MCP bridge]
    Bridge --> MCP[Local MCP stdio or HTTP endpoint]
    MCP --> GSD[GSD / Pi]
    MCP --> Codex[Codex CLI]
    MCP --> Claude[Claude Code]
    MCP --> Other[Cursor / Windsurf / other MCP clients]
```

## Components

- `src/server.js` registers the MCP tool schemas and exposes the Streamable HTTP server.
- `src/stdio.js` exposes the same MCP tools over stdio for clients that launch local MCP subprocesses.
- `src/config.js` owns portable paths, host, port, and dependency config.
- `src/codexChromePipe.js` speaks the extension/native-host JSON-RPC protocol over local browser pipes.
- `src/nativeHostManifest.js` checks and installs native-host manifests; on Windows it also handles the Chrome native messaging registry key.
- `scripts/smoke.js` checks health, ping, and extension metadata.

## Platform adapters

```mermaid
flowchart LR
    Core[MCP server core] --> Adapter{Platform adapter}
    Adapter --> Win[Windows named pipe adapter]
    Adapter --> Mac[macOS Unix socket adapter]
    Adapter --> Linux[Linux Unix socket adapter]
```

Windows uses `codex-browser-use*` named pipes. macOS and Linux use Unix sockets, normally under `/tmp/codex-browser-use` unless `CODEX_CHROME_SOCKET_DIR` overrides it.

On macOS, Codex may reject socket peers that are not launched by Codex. For Codex CLI, use the stdio entrypoint with the Node.js runtime bundled in Codex.app.
