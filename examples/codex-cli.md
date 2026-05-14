# Codex CLI example

Prefer stdio so Codex launches ChromeWire as its own MCP subprocess.

macOS:

```toml
[mcp_servers.chromewire]
command = "/Applications/Codex.app/Contents/Resources/node"
args = ["/absolute/path/to/chromewire-mcp/src/stdio.js"]
startup_timeout_sec = 20.0
tool_timeout_sec = 180.0
```

Windows / Linux / Ubuntu:

```toml
[mcp_servers.chromewire]
command = "node"
args = ["/absolute/path/to/chromewire-mcp/src/stdio.js"]
startup_timeout_sec = 20.0
tool_timeout_sec = 180.0
```

On macOS this is required when the Codex Chrome socket enforces peer authorization. Running ChromeWire as a separate `launchd` service or Homebrew Node.js process can fail with `pipe closed`.

If your Codex CLI build supports Streamable HTTP MCP servers, you may instead start the bridge yourself and point Codex at:

```text
http://127.0.0.1:8962/mcp
```

Use the same server name in prompts or tool routing:

```text
chromewire
```
