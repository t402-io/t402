# @t402/cli

Command-line interface for the T402 payment protocol.

## Features

- **Wallet Management**: Create, import, and manage WDK wallets
- **Payments**: Send USDT0/USDC payments with standard or gasless modes
- **Multi-Chain**: Support for EVM, Solana, TON, and TRON networks
- **Configuration**: Manage networks, RPC endpoints, and preferences
- **Request Parsing**: Parse and inspect T402 payment requests

## Installation

```bash
npm install -g @t402/cli
# or
pnpm add -g @t402/cli
```

## Quick Start

```bash
# Create a new wallet
t402 wallet create

# Check balance
t402 wallet balance

# Send payment
t402 pay 0xRecipient... 10.5 --network eip155:8453

# Send gasless payment (ERC-4337)
t402 pay 0xRecipient... 10.5 --gasless
```

## Commands

### Wallet Management

```bash
# Create a new wallet (generates seed phrase)
t402 wallet create

# Import existing wallet
t402 wallet import

# Show wallet info
t402 wallet info

# Check balance
t402 wallet balance
t402 wallet balance --network eip155:42161

# Export seed phrase (requires confirmation)
t402 wallet export
```

### Payments

```bash
# Standard payment
t402 pay <address> <amount> [options]

# Options:
#   -n, --network <network>  Network (e.g., eip155:8453, solana:devnet)
#   -a, --asset <asset>      Asset to send (default: usdt0)
#   -g, --gasless            Use gasless ERC-4337 transaction

# Examples:
t402 pay 0x742d35Cc... 100 --network eip155:8453
t402 pay 0x742d35Cc... 50 --gasless --asset usdc
```

### Configuration

```bash
# View all config
t402 config list

# Get specific config
t402 config get defaultNetwork

# Set config value
t402 config set defaultNetwork eip155:8453
t402 config set testnet true

# Set RPC endpoint
t402 config rpc eip155:8453 https://base.llamarpc.com

# Reset to defaults
t402 config reset
```

### Request Handling

```bash
# Parse a T402 payment request
t402 request parse <base64-encoded-request>

# Show request details
t402 request info <request-id>
```

### Info

```bash
# Show supported networks
t402 info networks

# Show version
t402 --version

# Show help
t402 --help
t402 <command> --help
```

## Configuration

Configuration is stored in `~/.config/t402-cli/config.json`:

| Key | Description | Default |
|-----|-------------|---------|
| `defaultNetwork` | Default network for payments | `eip155:8453` |
| `testnet` | Use testnet networks | `false` |
| `gasless` | Default to gasless payments | `false` |

### Custom RPC Endpoints

```bash
# Set custom RPC for a network
t402 config rpc eip155:1 https://eth.llamarpc.com
t402 config rpc eip155:42161 https://arb1.arbitrum.io/rpc
t402 config rpc solana:mainnet https://api.mainnet-beta.solana.com
```

## Supported Networks

### EVM (eip155)

| Network | Chain ID | Identifier |
|---------|----------|------------|
| Ethereum | 1 | `eip155:1` |
| Arbitrum | 42161 | `eip155:42161` |
| Base | 8453 | `eip155:8453` |
| Optimism | 10 | `eip155:10` |
| Ink | 57073 | `eip155:57073` |
| Base Sepolia | 84532 | `eip155:84532` |

### Solana

| Network | Identifier |
|---------|------------|
| Mainnet | `solana:mainnet` |
| Devnet | `solana:devnet` |

### TON

| Network | Identifier |
|---------|------------|
| Mainnet | `ton:0` |
| Testnet | `ton:-3` |

### TRON

| Network | Identifier |
|---------|------------|
| Mainnet | `tron:mainnet` |
| Nile | `tron:nile` |

## Programmatic Usage

```typescript
import {
  createCli,
  getConfig,
  setConfig,
  formatAmount,
  parseAmount,
} from '@t402/cli';

// Get configuration
const network = getConfig('defaultNetwork');

// Set configuration
setConfig('testnet', true);

// Format/parse amounts
const formatted = formatAmount(1000000n, 6);  // "1.0"
const parsed = parseAmount("1.5", 6);         // 1500000n
```

## Security

- Seed phrases are encrypted at rest using machine-specific keys
- No seed phrases are transmitted over the network
- Configuration files have restricted permissions

## Examples

### Daily Payment Workflow

```bash
# Morning: Check balance
t402 wallet balance

# Send payment to vendor
t402 pay 0xVendor... 1000 --network eip155:8453

# Check transaction
t402 info tx <txHash>
```

### Multi-Network Operations

```bash
# Check balances on multiple chains
t402 wallet balance --network eip155:1
t402 wallet balance --network eip155:42161
t402 wallet balance --network eip155:8453

# Send from cheapest chain
t402 pay 0xRecipient... 100 --network eip155:42161 --gasless
```

### Testnet Development

```bash
# Switch to testnet mode
t402 config set testnet true

# Use testnet RPC
t402 config rpc eip155:84532 https://sepolia.base.org

# Send test payment
t402 pay 0xTest... 10 --network eip155:84532
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `T402_DEFAULT_NETWORK` | Override default network |
| `T402_TESTNET` | Enable testnet mode |
| `T402_CONFIG_PATH` | Custom config directory |

## License

Apache-2.0
