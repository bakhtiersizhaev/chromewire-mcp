# Codex CLI example

If your Codex CLI build supports HTTP MCP servers, point it at:

```text
http://127.0.0.1:8962/mcp
```

Use the same server name in prompts or tool routing:

```text
chromewire
```

If your build only supports stdio MCP, run ChromeWire MCP behind a stdio-to-http MCP proxy.
