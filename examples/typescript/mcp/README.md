# t402 MCP Examples

Examples demonstrating how to use the `@t402/mcp` package for AI agent payments.

## Standalone Usage

The `standalone.ts` example shows how to use the MCP tools programmatically without running a full MCP server.

```bash
# From this directory
pnpm install
pnpm start
```

## Claude Desktop Configuration

See the main [@t402/mcp README](../../../typescript/packages/mcp/README.md) for Claude Desktop integration instructions.

### Quick Configuration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

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

## Example Prompts for Claude

Once configured, try these prompts:

### Balance Checking
- "What's my USDC balance on Base?"
- "Show me all my crypto balances"
- "Check the balance of 0x... on Ethereum"

### Payments
- "Send 10 USDC to 0x... on Base"
- "Pay 50 USDT to 0x... on Arbitrum"
- "Make a gasless payment of 25 USDC on Optimism"

### Cross-Chain Bridging
- "How much does it cost to bridge 100 USDT0 from Arbitrum to Ethereum?"
- "Bridge 50 USDT0 from Ethereum to Ink"
- "What chains can I bridge USDT0 to?"

## Security Notes

1. **Demo Mode First**: Always test with `T402_DEMO_MODE=true` before using real funds
2. **Dedicated Wallet**: Use a separate wallet for AI payments
3. **Limited Funds**: Only fund the wallet with amounts you're comfortable spending
4. **Monitor Activity**: Regularly check transaction history

## Available Tools

| Tool | Description |
|------|-------------|
| `t402/getBalance` | Check wallet balance on a specific network |
| `t402/getAllBalances` | Check balances across all networks |
| `t402/pay` | Send a stablecoin payment |
| `t402/payGasless` | Send a gasless payment (ERC-4337) |
| `t402/getBridgeFee` | Get bridge fee quote |
| `t402/bridge` | Bridge USDT0 between chains |
