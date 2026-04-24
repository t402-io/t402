# @t402/policy

Client-side payment policy engine for t402. Enforce guardrails on AI-agent and automated spending: per-transaction caps, hourly/daily budgets, recipient allowlists, network restrictions, and custom rules.

## Installation

```bash
pnpm install @t402/policy
```

## Quick Start

```typescript
import { t402Client } from "@t402/core/client";
import { withPolicy, PolicyViolationError } from "@t402/policy";
import { ExactEvmScheme } from "@t402/evm";

const baseClient = new t402Client()
  .register("eip155:8453", new ExactEvmScheme(signer));

const client = withPolicy(baseClient, {
  maxAmountPerPayment: "10.00",
  maxAmountPerHour: "50.00",
  maxAmountPerDay: "200.00",
  allowedNetworks: ["eip155:8453"],
  allowedRecipients: ["0x..."],
});

try {
  await client.createPaymentPayload(requirements);
} catch (err) {
  if (err instanceof PolicyViolationError) {
    console.error("blocked by policy:", err.rule);
  }
}
```

## Policy Rules

Built-in rules covered by `PaymentPolicy`:

- `maxAmountPerPayment` — single-payment cap
- `maxAmountPerHour` / `maxAmountPerDay` — rolling-window budgets
- `allowedNetworks` — CAIP-2 allowlist
- `allowedRecipients` / `deniedRecipients` — recipient address lists
- `allowedAssets` — token-ticker allowlist
- `customRules` — array of `PolicyRule` with a `.evaluate(context)` predicate

## API

### `PaymentPolicyEngine`

Standalone engine for evaluating policies without wrapping a client:

```typescript
import { PaymentPolicyEngine } from "@t402/policy";

const engine = new PaymentPolicyEngine(policy);
const decision: PolicyDecision = engine.evaluate(context);
// → { allowed: boolean, violatedRule?: string, reason?: string }
```

### `withPolicy(client, policy)`

Returns a `PolicyWrappedClient` that enforces the policy on every `createPaymentPayload` call. Throws `PolicyViolationError` on violation.

### Session stats

```typescript
const stats: SessionStats = client.policy.stats();
// → { spentTotal, spentLastHour, spentLastDay, paymentCount }
```

## Use Cases

- AI agents with hard spending limits
- Multi-tenant platforms enforcing per-user budgets
- Developer sandboxes with testnet-only network allowlists

## Development

```bash
pnpm build
pnpm test
```

## License

Apache-2.0
