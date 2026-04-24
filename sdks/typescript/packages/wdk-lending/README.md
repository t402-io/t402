# @t402/wdk-lending

DeFi lending protocol abstractions for the t402 WDK ecosystem. Defines provider-neutral types (`LendingProtocol`, `LendingOperation`, `LendingQuote`, `LendingPosition`) and MCP tool schemas for integrating lending markets like Aave V3 and Compound.

## Installation

```bash
pnpm install @t402/wdk-lending
```

## Overview

This is an abstraction layer, not a runtime implementation. It provides:

- **Types** — uniform shapes that any lending protocol can implement
- **MCP tool definitions** (`LENDING_TOOL_DEFINITIONS`) — tool schemas exposed by `@t402/mcp` for AI agents to discover lending operations (supply, borrow, repay, withdraw, positions)

Concrete protocol adapters live in separate packages. For Aave V3 on EVM chains, Tether ships `@tetherto/wdk-protocol-lending-aave-evm`, declared as an optional peer dependency.

## Quick Start

### Implementing a protocol

```typescript
import type { LendingProtocol, LendingQuote, LendingResult } from "@t402/wdk-lending";

export class AaveV3Protocol implements LendingProtocol {
  async quote(op: LendingOperation): Promise<LendingQuote> { /* ... */ }
  async execute(op: LendingOperation): Promise<LendingResult> { /* ... */ }
  async position(user: string): Promise<LendingPosition> { /* ... */ }
}
```

### Exposing via MCP

```typescript
import { LENDING_TOOL_DEFINITIONS } from "@t402/wdk-lending";

// Register tools with your MCP server so agents can call:
// - lending.quote, lending.execute
// - lending.getPosition, lending.listProtocols
server.registerTools(LENDING_TOOL_DEFINITIONS);
```

## Types

- `LendingOperation` — `{ action: "supply" | "borrow" | "repay" | "withdraw", asset, amount, ... }`
- `LendingQuote` — projected APY, fees, health factor impact
- `LendingResult` — execution result with transaction hash
- `LendingPosition` — aggregate account state
- `TokenPosition` — per-token balance and APY
- `LendingConfig` — protocol-level configuration
- `LendingProtocol` — interface every adapter must satisfy

## Peer Dependencies

- `@tetherto/wdk` (optional) — structural compatibility with Tether WDK
- `@tetherto/wdk-protocol-lending-aave-evm` (optional) — official Aave V3 EVM adapter

## Related Packages

- `@t402/mcp` — consumes `LENDING_TOOL_DEFINITIONS` to expose lending tools to agents
- `@t402/wdk` — wallet orchestration that composes lending with payments

## Development

```bash
pnpm build
pnpm test
```

## License

Apache-2.0
