# @t402/mcp

MCP (Model Context Protocol) Server for AI Agent Payments using the t402 Payment Protocol.

Enable AI agents like Claude to make stablecoin payments across multiple blockchain networks.

## Features

- **Multi-Chain Balance Checking** - Check balances on Ethereum, Base, Arbitrum, Optimism, Polygon, Avalanche, and more
- **Stablecoin Payments** - Send USDC, USDT, and USDT0 payments
- **Gasless Transactions** - Execute payments without ETH using ERC-4337
- **Cross-Chain Bridging** - Bridge USDT0 between chains using LayerZero

## Available Tools

| Tool | Description |
|------|-------------|
| `t402/getBalance` | Get token balances for a wallet on a specific network |
| `t402/getAllBalances` | Get balances across all supported networks |
| `t402/pay` | Execute a stablecoin payment |
| `t402/payGasless` | Execute a gasless payment using ERC-4337 |
| `t402/getBridgeFee` | Get fee quote for bridging USDT0 |
| `t402/bridge` | Bridge USDT0 between chains |

## Claude Desktop Integration

### Quick Start

1. Install the package globally:
```bash
npm install -g @t402/mcp
```

2. Configure Claude Desktop by editing `~/Library/Application Support/Claude/claude_desktop_config.json`:

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

3. Restart Claude Desktop

### Demo Mode

For testing without real transactions, enable demo mode:

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

Demo mode simulates transactions and returns mock results without executing on-chain.

### Production Configuration

For real payments, configure with a private key:

```json
{
  "mcpServers": {
    "t402": {
      "command": "npx",
      "args": ["@t402/mcp"],
      "env": {
        "T402_PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

**Warning:** Keep your private key secure. Consider using a dedicated wallet with limited funds for AI agent payments.

### ERC-4337 Gasless Transactions

For gasless payments, configure bundler and paymaster:

```json
{
  "mcpServers": {
    "t402": {
      "command": "npx",
      "args": ["@t402/mcp"],
      "env": {
        "T402_PRIVATE_KEY": "0x...",
        "T402_BUNDLER_URL": "https://api.pimlico.io/v1/...",
        "T402_PAYMASTER_URL": "https://api.pimlico.io/v2/..."
      }
    }
  }
}
```

### Custom RPC URLs

Configure custom RPC endpoints for better reliability:

```json
{
  "mcpServers": {
    "t402": {
      "command": "npx",
      "args": ["@t402/mcp"],
      "env": {
        "T402_PRIVATE_KEY": "0x...",
        "T402_RPC_ETHEREUM": "https://eth-mainnet.g.alchemy.com/v2/...",
        "T402_RPC_BASE": "https://base-mainnet.g.alchemy.com/v2/...",
        "T402_RPC_ARBITRUM": "https://arb-mainnet.g.alchemy.com/v2/..."
      }
    }
  }
}
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `T402_PRIVATE_KEY` | Wallet private key (hex with 0x prefix) |
| `T402_DEMO_MODE` | Set to "true" for simulated transactions |
| `T402_BUNDLER_URL` | ERC-4337 bundler URL for gasless transactions |
| `T402_PAYMASTER_URL` | Paymaster URL for sponsored gas |
| `T402_RPC_ETHEREUM` | Custom RPC URL for Ethereum |
| `T402_RPC_BASE` | Custom RPC URL for Base |
| `T402_RPC_ARBITRUM` | Custom RPC URL for Arbitrum |
| `T402_RPC_OPTIMISM` | Custom RPC URL for Optimism |
| `T402_RPC_POLYGON` | Custom RPC URL for Polygon |
| `T402_RPC_AVALANCHE` | Custom RPC URL for Avalanche |
| `T402_RPC_INK` | Custom RPC URL for Ink |
| `T402_RPC_BERACHAIN` | Custom RPC URL for Berachain |
| `T402_RPC_UNICHAIN` | Custom RPC URL for Unichain |

## Supported Networks

| Network | Chain ID | Tokens |
|---------|----------|--------|
| Ethereum | 1 | USDC, USDT, USDT0 |
| Base | 8453 | USDC |
| Arbitrum | 42161 | USDC, USDT, USDT0 |
| Optimism | 10 | USDC, USDT |
| Polygon | 137 | USDC, USDT |
| Avalanche | 43114 | USDC, USDT |
| Ink | 57073 | USDT0 |
| Berachain | 80094 | USDT0 |
| Unichain | 130 | USDT0 |

## Cross-Chain Bridging

USDT0 can be bridged between these chains using LayerZero:
- Ethereum
- Arbitrum
- Ink
- Berachain
- Unichain

## Example Prompts

Once configured, you can ask Claude to:

- "Check my USDC balance on Base"
- "Show my balances across all chains"
- "Send 10 USDC to 0x... on Arbitrum"
- "How much does it cost to bridge 100 USDT0 from Arbitrum to Ethereum?"
- "Bridge 50 USDT0 from Arbitrum to Ink"

## Programmatic Usage

```typescript
import { createT402McpServer, loadConfigFromEnv } from '@t402/mcp';

const config = loadConfigFromEnv();
const server = createT402McpServer(config);
await server.run();
```

## Using Individual Tools

```typescript
import { executeGetBalance, executePay } from '@t402/mcp/tools';

// Check balance
const balance = await executeGetBalance({
  network: 'base',
  address: '0x...',
});

// Execute payment
const result = await executePay(
  {
    to: '0x...',
    amount: '10.00',
    token: 'USDC',
    network: 'base',
  },
  {
    privateKey: '0x...',
  }
);
```

## Security Considerations

1. **Use a dedicated wallet** - Create a new wallet specifically for AI agent payments
2. **Set spending limits** - Only fund the wallet with amounts you're comfortable with the AI spending
3. **Monitor transactions** - Regularly check transaction history
4. **Start with demo mode** - Test with demo mode before enabling real transactions

## License

Apache-2.0
