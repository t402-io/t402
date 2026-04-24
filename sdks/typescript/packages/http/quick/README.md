# @t402/quick

Zero-config t402 payment middleware. Accept USDT payments in three lines of code.

## Installation

```bash
pnpm install @t402/quick
```

Install your framework alongside (at least one):

```bash
pnpm install express   # or fastify, or hono
```

## Quick Start

### Express

```typescript
import express from "express";
import { t402 } from "@t402/quick/express";

const app = express();
app.use("/api/premium", t402({ price: "1.00" }));

app.get("/api/premium/data", (req, res) => {
  res.json({ secret: "paid content" });
});
```

### Fastify

```typescript
import Fastify from "fastify";
import { t402 } from "@t402/quick/fastify";

const app = Fastify();
await app.register(t402, { price: "1.00", prefix: "/api/premium" });
```

### Hono

```typescript
import { Hono } from "hono";
import { t402 } from "@t402/quick/hono";

const app = new Hono();
app.use("/api/premium/*", t402({ price: "1.00" }));
```

## Configuration

`QuickConfig` accepts:

- `price` — required, e.g. `"1.00"` (USDT units)
- `network` — CAIP-2 id, defaults to `DEFAULT_NETWORK`
- `recipient` — payment recipient address (required in production)
- `facilitatorUrl` — facilitator endpoint, defaults to `DEFAULT_FACILITATOR_URL`
- `asset` — token ticker, defaults to USDT on the chosen network

```typescript
import { resolveQuickConfig } from "@t402/quick";

const resolved = resolveQuickConfig({
  price: "0.50",
  network: "eip155:8453",
  recipient: "0xYourWalletAddress",
});
```

## How It Works

`@t402/quick` wires up `@t402/core`, `@t402/evm`, and your HTTP framework with sensible defaults: EVM scheme registration, hosted facilitator (`facilitator.t402.io`), and standard header encoding. If you need custom scheme registrations or multiple networks, use the framework-specific adapter packages (`@t402/express`, `@t402/fastify`, `@t402/hono`) directly.

## Development

```bash
pnpm build
pnpm test
```

## License

Apache-2.0
