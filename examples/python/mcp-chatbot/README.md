# t402 MCP Chatbot Example (Python)

Interactive CLI chatbot that demonstrates the t402 MCP server in demo mode. Type commands to check balances, make payments, and bridge tokens.

## Setup

```bash
cd examples/python/mcp-chatbot

# Using uv (recommended)
uv sync
uv run python chatbot.py

# Or using pip
pip install t402
python chatbot.py
```

## What It Demonstrates

- Creating a `T402McpServer` instance in demo mode
- Sending JSON-RPC requests to the MCP server programmatically
- Handling tool call responses
- Interactive command loop

## Example Commands

```
> balance 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 ethereum
> all-balances 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
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
    "t402-python": {
      "command": "python",
      "args": ["-m", "t402.mcp"],
      "env": {
        "T402_DEMO_MODE": "true"
      }
    }
  }
}
```

See [claude-desktop-config.json](./claude-desktop-config.json) for the full configuration snippet.
