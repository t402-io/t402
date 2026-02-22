# @t402/erc8004

ERC-8004 Trustless Agents integration for the t402 payment protocol.

Enables AI agent identity resolution, reputation scoring, and validation registry integration for T402 payments.

## Installation

```bash
npm install @t402/erc8004 @t402/core
# or
pnpm add @t402/erc8004 @t402/core
```

Optional peer dependency for on-chain interactions:

```bash
npm install viem
```

## Overview

[ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) defines a standard for trustless AI agent identity on Ethereum. This package integrates ERC-8004 with the T402 payment protocol, enabling:

- **Identity Resolution** — resolve agent addresses to on-chain identities via the Identity Registry
- **Reputation Scoring** — query and submit feedback for agents via the Reputation Registry
- **Validation Registry** — submit and check validation requests for agent transactions
- **Payment Extensions** — declare and verify ERC-8004 identity in T402 payment flows
- **Server/Client Hooks** — pre-built hooks for identity checks, reputation gating, and feedback submission

## Quick Start

```typescript
import { resolveAgent, getReputationSummary } from '@t402/erc8004'

// Resolve an agent's on-chain identity
const agent = await resolveAgent(client, '0x1234...abcd')
console.log(agent.identity.name, agent.reputation.score)

// Check reputation before accepting payment
const reputation = await getReputationSummary(client, '0x1234...abcd')
if (reputation.score < 50) {
  throw new Error('Agent reputation too low')
}
```

## Identity Resolution

```typescript
import {
  getAgentIdentity,
  fetchRegistrationFile,
  resolveAgent,
  verifyPayToMatchesAgent,
  parseAgentRegistry,
} from '@t402/erc8004'

// Get on-chain identity from the Identity Registry
const identity = await getAgentIdentity(client, agentAddress)

// Fetch off-chain registration file (linked from on-chain record)
const registration = await fetchRegistrationFile(identity.registrationUrl)

// Full resolution: identity + registration + reputation
const resolved = await resolveAgent(client, agentAddress)

// Verify that a payTo address belongs to a registered agent
const isValid = await verifyPayToMatchesAgent(client, payToAddress, agentAddress)
```

## Reputation

```typescript
import {
  getReputationSummary,
  buildFeedbackFile,
  submitFeedback,
} from '@t402/erc8004'

// Query agent reputation
const summary = await getReputationSummary(client, agentAddress)
// summary.score, summary.totalFeedback, summary.positiveRatio

// Submit feedback after a payment
const feedbackFile = buildFeedbackFile({
  agent: agentAddress,
  tag: 'positive',
  comment: 'Fast and reliable service',
  proofOfPayment: { txHash, network, amount },
})
await submitFeedback(client, feedbackFile)
```

## Validation

```typescript
import {
  submitValidationRequest,
  getValidationStatus,
  getValidationSummary,
} from '@t402/erc8004'

// Submit a validation request for an agent transaction
await submitValidationRequest(client, {
  agent: agentAddress,
  txHash: '0xabc...',
  network: 'eip155:8453',
})

// Check validation status
const status = await getValidationStatus(client, requestId)

// Get full validation summary for an agent
const summary = await getValidationSummary(client, agentAddress)
```

## Extension Integration

Use ERC-8004 as a T402 payment extension to declare and verify agent identity in payment flows:

```typescript
import {
  declareERC8004Extension,
  getERC8004Extension,
  createERC8004PayloadExtension,
  verifyAgentIdentity,
  erc8004ResourceServerExtension,
} from '@t402/erc8004'

// Server: declare ERC-8004 support in PaymentRequirements
const requirements = declareERC8004Extension(baseRequirements, {
  identityRegistry: '0x...',
  reputationRegistry: '0x...',
  requiredScore: 50,
})

// Client: extract extension from requirements
const ext = getERC8004Extension(requirements)

// Client: create payload extension with identity proof
const payloadExt = await createERC8004PayloadExtension(client, agentAddress)

// Server: verify agent identity from payment payload
const verified = await verifyAgentIdentity(client, payload)

// Express/Hono: resource server extension (auto-verify on each request)
app.use(erc8004ResourceServerExtension(client, { requiredScore: 50 }))
```

## Hooks

Pre-built hooks for common patterns:

```typescript
import {
  erc8004IdentityCheck,
  erc8004ReputationCheck,
  erc8004ServerIdentityCheck,
  erc8004SubmitFeedback,
  verifyAgentIdentityFromTask,
} from '@t402/erc8004'

// Client hook: verify server identity before paying
const identityCheck = erc8004IdentityCheck(client, {
  minScore: 50,
  allowUnregistered: false,
})

// Server hook: verify client agent identity on each payment
const serverCheck = erc8004ServerIdentityCheck(client)

// Server hook: check reputation before accepting payment
const reputationCheck = erc8004ReputationCheck(client, { minScore: 50 })

// Server hook: submit feedback after successful payment
const feedback = erc8004SubmitFeedback(client, { autoPositive: true })

// MCP/A2A: verify agent from task context
const verified = await verifyAgentIdentityFromTask(client, taskContext)
```

## Constants

```typescript
import {
  ERC8004_EXTENSION_KEY,     // 'erc8004' — extension key in PaymentRequirements
  IDENTITY_REGISTRIES,       // Default identity registry addresses per network
  REPUTATION_REGISTRIES,     // Default reputation registry addresses per network
  VALIDATION_REGISTRIES,     // Default validation registry addresses per network
  FEEDBACK_TAGS,             // Standard feedback tags: 'positive', 'negative', 'neutral'
  IDENTITY_REGISTRY_DOMAIN,  // EIP-712 domain for identity registry
  SET_AGENT_WALLET_TYPES,    // EIP-712 types for setAgentWallet
} from '@t402/erc8004'
```

## ABIs

```typescript
import {
  identityRegistryAbi,   // Identity Registry contract ABI
  reputationRegistryAbi,  // Reputation Registry contract ABI
  validationRegistryAbi,  // Validation Registry contract ABI
} from '@t402/erc8004'
```

## License

Apache-2.0
