# @t402/wdk-fiat

Fiat on/off-ramp protocol abstractions for the t402 WDK ecosystem. Defines provider-neutral types (`FiatProvider`, `FiatOperation`, `FiatQuote`, `FiatResult`) and MCP tool schemas for integrating ramps like MoonPay and Transak.

## Installation

```bash
pnpm install @t402/wdk-fiat
```

## Overview

This is an abstraction layer, not a runtime implementation. It provides:

- **Types** — uniform shapes that any fiat-ramp provider can implement
- **MCP tool definitions** (`FIAT_TOOL_DEFINITIONS`) — tool schemas exposed by `@t402/mcp` for AI agents to discover and call fiat ramp operations

Concrete provider implementations (MoonPay, Transak, etc.) live in separate packages and implement the `FiatProvider` interface.

## Quick Start

### Implementing a provider

```typescript
import type { FiatProvider, FiatQuote, FiatResult } from "@t402/wdk-fiat";

export class MoonPayProvider implements FiatProvider {
  async quote(op: FiatOperation): Promise<FiatQuote> { /* ... */ }
  async execute(op: FiatOperation): Promise<FiatResult> { /* ... */ }
}
```

### Exposing via MCP

```typescript
import { FIAT_TOOL_DEFINITIONS } from "@t402/wdk-fiat";

// Register tools with your MCP server so agents can call:
// - fiat.quote
// - fiat.execute
// - fiat.listProviders
server.registerTools(FIAT_TOOL_DEFINITIONS);
```

## Types

- `FiatOperation` — `{ direction: "on" | "off", asset, currency, amount, ... }`
- `FiatQuote` — price quote with fees and expiry
- `FiatResult` — execution result with reference IDs
- `SupportedAsset` / `SupportedCurrency` — enumerations
- `FiatConfig` — provider-level configuration
- `FiatProvider` — interface every provider must satisfy

## Related Packages

- `@t402/mcp` — consumes `FIAT_TOOL_DEFINITIONS` to expose fiat tools to AI agents
- `@t402/wdk` — wallet orchestration that composes fiat ramps with on-chain operations

## Development

```bash
pnpm build
pnpm test
```

## License

Apache-2.0
