# t402 MCP Chatbot Example

Interactive CLI chatbot that demonstrates the t402 MCP payment tools in demo mode. Type natural-language commands to check balances, make payments, and bridge tokens.

## Setup

```bash
cd examples/typescript/mcp/chatbot
pnpm install
pnpm start
```

## What It Demonstrates

- Creating an MCP tool registry from `@t402/mcp` tool definitions
- Mapping user input to tool calls (balance, pay, bridge)
- Executing tools in demo mode (no real transactions)
- Formatting and displaying tool results

## Example Commands

```
> balance 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 ethereum
> pay 10 USDC to 0x1234...5678 on base
> bridge 100 USDT0 from arbitrum to ethereum
> fee arbitrum to ethereum 50
> all-balances 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
> help
> quit
```

## Claude Desktop Integration

To use the t402 MCP tools with Claude Desktop, add this to your config:

```json
{
  "mcpServers": {
    "t402": {
      "command": "npx",
      "args": ["@t402/mcp"],
      "env": {
        "T402_DEMO_MODE": "true"
      }
    }
  }
}
```

See [claude-desktop-config.json](./claude-desktop-config.json) for the full configuration snippet.
