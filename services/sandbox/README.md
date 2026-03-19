# T402 Sandbox Facilitator

Public testnet facilitator for developer testing. No real funds needed.

## Supported Networks

| Network | CAIP-2 | Token |
|---------|--------|-------|
| Base Sepolia | eip155:84532 | USDC |
| Sepolia | eip155:11155111 | USDC |
| Solana Devnet | solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1 | USDC |

## Usage

Point your facilitator client to the sandbox:

```typescript
const client = new HTTPFacilitatorClient({
  url: "https://sandbox.t402.io"
});
```

## Rate Limits

- 100 requests/minute per IP
- Testnet tokens only
- Not for production use

## Getting Test Tokens

- Base Sepolia USDC: [Coinbase Faucet](https://portal.cdp.coinbase.com/products/faucet)
- Sepolia ETH: [Google Cloud Faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia)
