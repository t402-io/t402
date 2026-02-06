# Cross-SDK Consistency Check

You are performing a cross-SDK consistency audit for the T402 project. Compare core types, constants, and interfaces across all 4 SDKs (TypeScript, Go, Python, Java) and report any inconsistencies.

## File Locations

### Core Response Types

| SDK | VerifyResponse | SettleResponse |
|-----|---------------|----------------|
| **TypeScript** | `sdks/typescript/packages/core/src/types/facilitator.ts` | Same file |
| **Go** | `sdks/go/types.go` | Same file |
| **Python** | `sdks/python/t402/src/t402/types.py` | Same file |
| **Java** | `sdks/java/t402/src/main/java/io/t402/client/VerificationResponse.java` | `sdks/java/t402/src/main/java/io/t402/client/SettlementResponse.java` |

### Payment Types

| SDK | PaymentRequirements | PaymentPayload |
|-----|-------------------|----------------|
| **TypeScript** | `sdks/typescript/packages/core/src/types/payments.ts` | Same file |
| **Go** | `sdks/go/types/v2.go` (V2), `sdks/go/types/v1.go` (V1) | Same files |
| **Python** | `sdks/python/t402/src/t402/types.py` | Same file |
| **Java** | `sdks/java/t402/src/main/java/io/t402/model/PaymentRequirements.java` | `sdks/java/t402/src/main/java/io/t402/model/PaymentPayload.java` |

### Interfaces

| SDK | Client/Server/Facilitator Interfaces |
|-----|-------------------------------------|
| **TypeScript** | `sdks/typescript/packages/core/src/types/mechanisms.ts` |
| **Go** | `sdks/go/interfaces.go` |
| **Python** | `sdks/python/t402/src/t402/types.py` (Protocol classes) |
| **Java** | `sdks/java/t402/src/main/java/io/t402/client/T402Client.java` |

### HTTP Header Constants

| SDK | Location |
|-----|----------|
| **TypeScript** | Hardcoded in middleware packages (`express/`, `hono/`, `fastify/`, `next/`) |
| **Go** | Hardcoded in `sdks/go/http/client.go` and `sdks/go/http/middleware.go` |
| **Python** | Hardcoded in `sdks/python/t402/src/t402/flask/middleware.py`, `fastapi/middleware.py` |
| **Java** | `sdks/java/t402/src/main/java/io/t402/util/HttpConstants.java` (centralized) |

### Network Constants

| SDK | Location |
|-----|----------|
| **TypeScript** | Per-mechanism `constants.ts` files under `sdks/typescript/packages/mechanisms/*/src/` |
| **Go** | Per-mechanism `constants.go` files under `sdks/go/mechanisms/*/` |
| **Python** | `sdks/python/t402/src/t402/networks.py` + per-scheme files |
| **Java** | Per-mechanism `*Constants.java` under `sdks/java/t402/src/main/java/io/t402/mechanisms/` |

## Checks to Perform

### 1. SettleResponse Field Consistency

Read the SettleResponse type from all 4 SDKs. Verify these fields exist (with language-appropriate casing):

| Field (JSON wire format) | TypeScript | Go | Python | Java |
|--------------------------|-----------|-----|--------|------|
| `success` | `success` | `Success` | `success` | `success` |
| `errorReason` | `errorReason` | `ErrorReason` | `error_reason` | `errorReason` |
| `payer` | `payer` | `Payer` | `payer` | `payer` |
| `transaction` | `transaction` | `Transaction` | `transaction` | `transaction` |
| `network` | `network` | `Network` | `network` | `network` |

**Known past issues:**
- Java previously used `error` instead of `errorReason`
- Java previously used `txHash` instead of `transaction`
- Java previously used `networkId` instead of `network`
- Java previously was missing `payer` field

### 2. VerifyResponse Field Consistency

| Field (JSON wire format) | TypeScript | Go | Python | Java |
|--------------------------|-----------|-----|--------|------|
| `isValid` | `isValid` | `IsValid` | `is_valid` | `isValid` |
| `invalidReason` | `invalidReason` | `InvalidReason` | `invalid_reason` | `invalidReason` |
| `payer` | `payer` | `Payer` | `payer` | `payer` |

### 3. PaymentRequirements (V2) Field Consistency

| Field (JSON wire format) | TypeScript | Go | Python | Java |
|--------------------------|-----------|-----|--------|------|
| `scheme` | `scheme` | `Scheme` | `scheme` | `scheme` |
| `network` | `network` | `Network` | `network` | `network` |
| `asset` | `asset` | `Asset` | `asset` | `asset` |
| `amount` | `amount` | `Amount` | `amount` | `amount` |
| `payTo` | `payTo` | `PayTo` | `pay_to` | `payTo` |
| `maxTimeoutSeconds` | `maxTimeoutSeconds` | `MaxTimeoutSeconds` | `max_timeout_seconds` | `maxTimeoutSeconds` |
| `extra` | `extra` | `Extra` | `extra` | `extra` |

### 4. HTTP Header Values

Verify these exact string values are used consistently:

**V2 Headers:**
- `PAYMENT-SIGNATURE` (client → server request header)
- `PAYMENT-REQUIRED` (server → client 402 response header)
- `PAYMENT-RESPONSE` (server → client settlement response header)

**V1 Fallback Headers:**
- `X-PAYMENT` (client → server request header)
- `X-PAYMENT-RESPONSE` (server → client settlement response header)

### 5. Network Identifier Consistency

Verify these CAIP-2 network identifiers match across SDKs for each chain:

| Chain | Expected CAIP-2 |
|-------|----------------|
| Ethereum | `eip155:1` |
| Base | `eip155:8453` |
| Arbitrum | `eip155:42161` |
| Optimism | `eip155:10` |
| Berachain | `eip155:80094` |
| Solana | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` |
| TON Mainnet | `ton:mainnet` |
| TON Testnet | `ton:testnet` |
| TRON Mainnet | `tron:mainnet` |
| NEAR Mainnet | `near:mainnet` |
| Aptos Mainnet | `aptos:1` |
| Tezos Mainnet | `tezos:NetXdQprcVkpaWU` |
| Polkadot Asset Hub | `polkadot:68d56f15f85d3136970ec16946040bc1` |
| Stacks Mainnet | `stacks:1` |

### 6. Scheme Name Consistency

Verify scheme names are identical strings across SDKs:
- `"exact"` — standard EIP-3009 / SPL / Jetton transfers
- `"exact-legacy"` — EVM approve+transferFrom (legacy USDT)
- `"upto"` — maximum amount authorization
- `"exact-direct"` — Cosmos direct send

### 7. Token Address Consistency

Spot-check that USDT/USDT0 contract addresses match across SDKs for major networks (Ethereum, Arbitrum, Base, TON, TRON, Solana).

## Output Format

Report findings as a table:

```
## Cross-SDK Consistency Report

### Status: [PASS | ISSUES FOUND]

| # | Check | Status | Details |
|---|-------|--------|---------|
| 1 | SettleResponse fields | PASS/FAIL | ... |
| 2 | VerifyResponse fields | PASS/FAIL | ... |
| 3 | PaymentRequirements fields | PASS/FAIL | ... |
| 4 | HTTP headers | PASS/FAIL | ... |
| 5 | Network identifiers | PASS/FAIL | ... |
| 6 | Scheme names | PASS/FAIL | ... |
| 7 | Token addresses | PASS/FAIL | ... |

### Issues (if any)
- [ ] SDK: file:line — description of mismatch
```

If issues are found, ask the user whether to fix them automatically.
