# @t402/spark

Spark (Bitcoin L2) implementation of the t402 payment protocol. Provides the **exact** payment scheme for stablecoin payments over the Spark network.

## Installation

```bash
pnpm install @t402/spark
```

## Overview

This package provides three components for handling t402 payments on Spark:

- **Client** — signs Spark payment payloads (wallet side)
- **Facilitator** — verifies and settles Spark payments (payment processor side)
- **Types** — shared payload and scheme definitions

## Exports

### Main Package (`@t402/spark`)

- `SparkClientScheme` — V2 client scheme for building and signing payments
- `SparkFacilitatorScheme` — V2 facilitator scheme for verification and settlement
- `SparkClientConfig` — client configuration type

## Quick Start

### Client

```typescript
import { t402Client } from "@t402/core/client";
import { SparkClientScheme } from "@t402/spark";

const client = new t402Client()
  .register("bitcoin:mainnet", new SparkClientScheme({
    wallet: mySparkWallet,
  }));
```

### Facilitator

```typescript
import { SparkFacilitatorScheme } from "@t402/spark";

const scheme = new SparkFacilitatorScheme({
  wallet: facilitatorWallet,
});

// Verify a payment payload
const verifyResult = await scheme.verify(paymentPayload, requirements);

// Settle on-chain
const settleResult = await scheme.settle(paymentPayload, requirements);
```

## Development

```bash
pnpm build
pnpm test
```

## License

Apache-2.0
