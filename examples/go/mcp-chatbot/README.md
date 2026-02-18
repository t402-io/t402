# t402 MCP Chatbot Example (Go)

Interactive CLI chatbot that demonstrates the t402 MCP server in demo mode. Type commands to interact with the payment tools.

## Setup

```bash
cd examples/go/mcp-chatbot
go run main.go
```

## What It Demonstrates

- Creating an `mcp.Server` in demo mode
- Sending JSON-RPC tool call requests programmatically
- Interactive command loop with parsed user input
- Formatting and displaying tool results

## Example Commands

```
> balance 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 ethereum
> pay 10 USDC to 0x1234...5678 on base
> fee arbitrum to ethereum 100
> tools
> help
> quit
```

## Claude Desktop Integration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "t402-go": {
      "command": "t402-mcp",
      "env": {
        "T402_DEMO_MODE": "true"
      }
    }
  }
}
```

Build the binary first:

```bash
cd sdks/go/cmd/t402-mcp
go build -o t402-mcp .
```

See [claude-desktop-config.json](./claude-desktop-config.json) for the full configuration snippet.
