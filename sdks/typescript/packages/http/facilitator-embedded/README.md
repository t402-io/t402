# @t402/facilitator-embedded

Embedded, in-process facilitator for the t402 payment protocol. Run payment verification and settlement inside your HTTP server without a separate facilitator service.

## Installation

```bash
pnpm install @t402/facilitator-embedded
```

## Overview

Use this package when you want:

- Self-contained services that verify and settle payments in-process
- Lower latency (no extra network hop to a hosted facilitator)
- Full control over scheme registration and signer management
- Per-payment lifecycle observability via typed events

Trade-off: your process needs access to settlement signers (facilitator private keys) and on-chain RPCs directly. For multi-tenant or isolated signing, use a hosted `HTTPFacilitatorClient` instead.

## Quick Start

```typescript
import { EmbeddedFacilitator, createEmbeddedPaymentMiddleware } from "@t402/facilitator-embedded";
import { ExactEvmFacilitator, toFacilitatorEvmSigner } from "@t402/evm";

const facilitator = new EmbeddedFacilitator();

// Register a scheme handler
facilitator.register("eip155:8453", new ExactEvmFacilitator({
  signer: toFacilitatorEvmSigner(myWallet),
}));

// Attach as middleware
app.use(createEmbeddedPaymentMiddleware(facilitator, {
  requirements: [
    { network: "eip155:8453", recipient: "0x...", amount: "1.00", asset: "USDC" },
  ],
}));
```

## Lifecycle Events

Subscribe to payment lifecycle events for logging, metrics, or webhooks:

```typescript
facilitator.lifecycle.on("payment:received", (e) => {
  console.log("Received", e.requirements);
});

facilitator.lifecycle.on("payment:settled", (e) => {
  console.log("Settled", e.transaction);
});
```

Event types: `received`, `verifying`, `verified`, `settling`, `settled`, `failed`.

## API

### `EmbeddedFacilitator`

- `.register(network, scheme)` — register a scheme handler
- `.verify(payload, requirements)` — verify a payment payload
- `.settle(payload, requirements)` — settle a verified payment
- `.lifecycle` — `PaymentLifecycleEmitter` for subscribing to events

### `createEmbeddedPaymentMiddleware(facilitator, options)`

Returns Express/Connect-compatible middleware that handles 402 responses, verification, and settlement automatically.

## Development

```bash
pnpm build
pnpm test
```

## License

Apache-2.0
