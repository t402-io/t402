# @t402/wdk-swap-jupiter

Jupiter DEX aggregator swap module for Solana wallets in the t402 WDK ecosystem. Wraps the Jupiter v6 quote and swap APIs with a wallet-friendly interface.

## Installation

```bash
pnpm install @t402/wdk-swap-jupiter
```

## Quick Start

```typescript
import { JupiterClient, TOKEN_MINTS } from "@t402/wdk-swap-jupiter";
import { Keypair } from "@solana/web3.js";

const wallet = Keypair.generate();
const jupiter = new JupiterClient({
  rpcUrl: "https://api.mainnet-beta.solana.com",
  wallet,
});

// Get a quote
const quote = await jupiter.quote({
  inputMint: TOKEN_MINTS.USDC,
  outputMint: TOKEN_MINTS.SOL,
  amount: "1000000", // 1 USDC (6 decimals)
  slippageBps: 50,
});

// Execute swap
const result = await jupiter.swap(quote);
console.log("tx:", result.signature);
```

## API

### `JupiterClient`

- `new JupiterClient(config)` — `{ rpcUrl, wallet, apiUrl? }`
- `.quote(request: QuoteRequest): Promise<QuoteResponse>` — fetch best route
- `.swap(quote: QuoteResponse): Promise<SwapResult>` — sign and submit swap

### Types

- `QuoteRequest` — input/output mints, amount, slippage, optional swap mode
- `QuoteResponse` — route, expected output, price impact, route plan steps
- `SwapResult` — transaction signature + confirmation
- `SwapMode` — `"ExactIn" | "ExactOut"`
- `RoutePlanStep` — individual AMM hop in the aggregator route
- `SolanaWallet` — structural interface (accepts `Keypair`, wallet adapter, or WDK account)

### Token registry

```typescript
import { TOKEN_MINTS } from "@t402/wdk-swap-jupiter";
// TOKEN_MINTS.USDC, TOKEN_MINTS.USDT, TOKEN_MINTS.SOL, ...
```

## Development

```bash
pnpm build
pnpm test
```

## License

Apache-2.0
