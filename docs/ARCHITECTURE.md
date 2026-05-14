# Architecture

```mermaid
flowchart TD
    Chrome[Google Chrome profile] --> Ext[Official Codex Chrome Extension]
    Ext --> Native[Local native host / browser pipe]
    Native --> Bridge[codex-chrome MCP bridge]
    Bridge --> MCP[Local MCP HTTP endpoint]
    MCP --> GSD[GSD / Pi]
    MCP --> Codex[Codex CLI]
    MCP --> Claude[Claude Code]
    MCP --> Other[Cursor / Windsurf / other MCP clients]
```

## Components

- `src/server.js` registers the HTTP MCP server and tool schemas.
- `src/config.js` owns portable paths, host, port, and dependency config.
- `src/codexChromePipe.js` speaks the extension/native-host JSON-RPC protocol over local browser pipes.
- `scripts/smoke.js` checks health, ping, and extension metadata.

## Platform adapters

```mermaid
flowchart LR
    Core[MCP server core] --> Adapter{Platform adapter}
    Adapter --> Win[Windows named pipe adapter]
    Adapter --> Mac[macOS adapter planned]
    Adapter --> Linux[Linux adapter planned]
```

Windows is the current working transport. macOS and Linux require validation against the official extension native-host transport on those platforms.
