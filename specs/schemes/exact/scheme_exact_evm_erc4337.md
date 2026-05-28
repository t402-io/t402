# Scheme: `exact` on EVM — ERC-4337 Account Abstraction Variant

## Status

**Production.** Implemented across all four t402 reference SDKs (TypeScript, Go, Python, Java). EntryPoint version 0.7 is the supported baseline.

## Summary

This document specifies how the `exact` scheme on EVM chains is settled when the payer is an **ERC-4337 smart contract account** rather than an EOA. The wire format is identical to the [base `exact_evm` scheme](./scheme_exact_evm.md) — the `scheme` field remains `"exact"` — but the authorization material and the facilitator settlement path differ.

Two sub-flows are supported:

1. **Direct ERC-20 transfer via UserOperation** — the smart account executes `IERC20.transfer(payTo, amount)` from its own balance. The facilitator is not strictly required; a third-party bundler relays the UserOp. The "facilitator" role becomes the gas sponsor (paymaster).
2. **EIP-3009 forwarding via UserOperation** — the smart account's UserOperation calls `token.transferWithAuthorization(...)` using an off-chain EIP-3009 signature produced by an EOA controlled by the smart account owner. This preserves the gasless property of plain EIP-3009 while routing through a smart account for policy reasons (session keys, multi-sig, social recovery).

Both sub-flows can be paymaster-sponsored, achieving full gas-abstraction for the payer.

## Prerequisites

- ERC-4337 EntryPoint contract deployed on the target chain at the canonical address (`ENTRYPOINT_V07_ADDRESS = 0x0576a174D229E3cFA37253523E645A78A0C91B57` for v0.7).
- Smart account factory deployed (reference implementation supports Safe via `SafeSmartAccount`).
- Bundler service for the target chain (e.g. Pimlico, Alchemy).
- Optional paymaster service for gas sponsorship (e.g. Pimlico, Biconomy, Stackup).

## PaymentRequirements

The `accepted` field of `PaymentRequirements` MUST set `scheme: "exact"` and MAY include the following ERC-4337-specific hints in `accepted.extra`:

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes (EIP-3009 mode) | EIP-712 domain name for the underlying ERC-20 |
| `version` | string | Yes (EIP-3009 mode) | EIP-712 domain version |
| `accountAbstraction` | object | No | Hints for ERC-4337 clients (see below) |
| `accountAbstraction.entryPoint` | address | No | Override default EntryPoint (defaults to v0.7) |
| `accountAbstraction.paymaster` | address | No | Server-suggested paymaster |
| `accountAbstraction.paymasterPolicy` | string | No | Server-suggested paymaster policy ID |
| `accountAbstraction.acceptsCounterfactual` | boolean | No | If `true`, the server accepts payment from undeployed smart accounts (requires ERC-6492 signature unwrap support) |

If `accountAbstraction` is absent, clients MAY still pay with a smart account using their own infrastructure choices.

## PaymentPayload

The `payload` field MUST conform to one of the two sub-flow shapes below.

### Sub-flow A — Direct transfer via UserOperation

The smart account directly executes `IERC20.transfer(payTo, amount)`. The on-chain trail is a single transaction submitted by the bundler.

```json
{
  "userOperation": {
    "sender": "0x4337...",
    "nonce": "12",
    "initCode": "0x",
    "callData": "0xb61d27f6...",
    "accountGasLimits": "0x...000000000000000000000000000186a0",
    "preVerificationGas": "50000",
    "gasFees": "0x...0000000000000000000000000ee6b2800",
    "paymasterAndData": "0x...",
    "signature": "0x..."
  },
  "userOpHash": "0xd0c5...",
  "submittedBundlerTxHash": null
}
```

The `userOperation` SHOULD be the **packed** form (`PackedUserOperation` per ERC-4337 v0.7). Numeric fields are encoded as decimal strings; bytes/hex fields as `0x`-prefixed hex.

`callData` MUST decode to the smart account's `execute(target, value, data)` selector (or equivalent batch selector) where `target = asset` (the ERC-20 token address from `PaymentRequirements`), `value = 0`, and `data` is the ABI-encoded `IERC20.transfer(payTo, amount)` call.

### Sub-flow B — EIP-3009 forwarding via UserOperation

The smart account's UserOperation calls `transferWithAuthorization` on an EIP-3009-compatible token. The off-chain authorization is signed by an EOA controlled by the smart account owner (typically the same `signer` used to sign UserOps).

```json
{
  "userOperation": {
    "sender": "0x4337...",
    "nonce": "12",
    "initCode": "0x",
    "callData": "0xb61d27f6...",
    "accountGasLimits": "0x...000000000000000000000000000186a0",
    "preVerificationGas": "50000",
    "gasFees": "0x...0000000000000000000000000ee6b2800",
    "paymasterAndData": "0x...",
    "signature": "0x..."
  },
  "userOpHash": "0xd0c5...",
  "submittedBundlerTxHash": null,
  "authorization": {
    "from": "0x857b06519E91e3A54538791bDbb0E22373e36b66",
    "to": "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
    "value": "10000",
    "validAfter": "1740672089",
    "validBefore": "1740672154",
    "nonce": "0xf3746613c2d920b5fdabc0856f2aeb2d4f88ee6037b8cc5d04a71a4462f13480"
  },
  "authorizationSignature": "0x2d6a7588d6acca505cbf0d9a4a227e0c52c6c34008c8e8986a1283259764173608a2ce6496642e377d6da8dbbf5836e9bd15092f9ecab05ded3d6293af148b571c"
}
```

The `callData` in Sub-flow B decodes to `execute(asset, 0, transferWithAuthorization(...))` where the inner call data carries the full EIP-3009 transfer payload split into discrete v/r/s components.

Note: In Sub-flow B, `authorization.from` is the EOA signer of the EIP-3009 authorization. The smart account's `sender` field is the entity submitting the UserOp; these MAY differ (e.g. owner EOA signs EIP-3009, smart account submits via UserOp).

## Counterfactual Smart Accounts (ERC-6492)

A smart account that has not yet been deployed on-chain ("counterfactual") MAY pay via t402 using the ERC-6492 signature wrapping standard. The `userOperation.initCode` field is populated with the factory deployment data; the EntryPoint will deploy the account during settlement.

The facilitator MUST recognize and unwrap ERC-6492-wrapped signatures during verification. Reference unwrap logic is provided by the `ox` library (`Ox.Signature.fromErc6492`).

Servers that accept counterfactual payments SHOULD declare `accountAbstraction.acceptsCounterfactual: true` in `PaymentRequirements.extra`.

## Verification

For both sub-flows, the facilitator MUST:

1. **Parse the UserOperation** — validate field shape, decimal/hex encoding, and that `userOpHash` matches the recomputed hash over the EntryPoint v0.7 schema.
2. **Verify the UserOperation signature** — validate `signature` against the smart account's signing rules. For Safe accounts, this calls `isValidSignature(userOpHash, signature)` on the deployed account or simulates the validation when counterfactual. For ERC-6492-wrapped signatures, unwrap before validation.
3. **Verify the call data semantics**:
   - Sub-flow A: decode `callData` and assert it calls the smart account's `execute` function with `(target=asset, value=0, data=transfer(payTo, amount))`.
   - Sub-flow B: decode `callData` and assert it calls `execute(target=asset, value=0, data=transferWithAuthorization(...))` AND validate the inner `authorization` matches steps 1–6 of the base `exact_evm` verification (signature validity, ERC-20 contract match, value sufficient, time range valid, nonce unused).
4. **Verify gas limits are within bundler quotes** — the facilitator MAY refuse if estimated gas exceeds a configured ceiling.
5. **If paymaster is used**, verify the paymaster signature matches the configured paymaster policy.
6. **Simulate the UserOperation** via the bundler's `eth_estimateUserOperationGas` to ensure the transaction would succeed.

## Settlement

Settlement is performed by the facilitator (or any party with bundler access — settlement is permissionless in ERC-4337) submitting the UserOperation via `eth_sendUserOperation` to a bundler endpoint.

The facilitator MUST:

1. **Submit the UserOperation** to a bundler via `eth_sendUserOperation(packedUserOp, entryPoint)`.
2. **Poll for inclusion** via `eth_getUserOperationReceipt(userOpHash)` until the operation is bundled and mined.
3. **Verify success** by reading the `success` field of the UserOperationReceipt.
4. **Record the underlying transaction hash** (`receipt.transactionHash`) as the settlement evidence in the t402 response.

The user-facing settlement latency is bundler-dependent (typically 5–30 seconds for major providers).

## Paymaster Selection

Three paymaster modes are supported, mapped from the `PaymasterConfig.type` field:

| Mode | Description | Use |
|---|---|---|
| `verifying` | Verifying Paymaster — facilitator signs off-chain proofs that the paymaster pays gas | t402 facilitator-side gas sponsorship |
| `token` | Token Paymaster — paymaster accepts ERC-20 from payer as gas payment | Self-funded gasless via the payment token itself |
| `sponsoring` | Sponsoring Paymaster — third-party (Pimlico, Biconomy, Stackup) sponsors gas under a policy | Production paymaster-as-a-service |

Reference SDK provider integrations:

- **Pimlico**: `PimlicoPaymaster` + `PimlicoBundlerClient` — supports `verifying`, `sponsoring`, and ERC-20 token paymaster.
- **Alchemy**: `AlchemyBundlerClient` — bundler only; pair with their gas policy.
- **Biconomy**: `BiconomyPaymaster` — sponsoring with policy + spending limits.
- **Stackup**: `StackupPaymaster` — sponsoring with context.

The choice of provider is integrator-side and is NOT part of the wire format. A facilitator MAY refuse to settle UserOps that use unsupported paymaster addresses.

## Batch Payments

A single UserOperation MAY contain multiple t402 payments via the smart account's `executeBatch` selector. The `callData` field encodes a batch of calls, each of which is a t402 payment to a possibly distinct (asset, payTo, amount) triple.

Batch verification requires the facilitator to validate every inner call against an associated `PaymentRequirements`. The wire shape for batch payments is one `PaymentPayload` per call, conveyed via the [`batch-settlement` scheme](../batch-settlement/scheme_batch_settlement_evm.md) once that scheme is finalized; for the single-UserOp-multiple-transfers case prior to that scheme landing, see the reference SDK's `executeBatchPayments()` method.

## Error Codes

In addition to the base `exact_evm` error codes, ERC-4337 settlement MAY return:

| Code | Meaning |
|---|---|
| T402-4100 | UserOperation signature invalid |
| T402-4101 | Smart account validation failed (`isValidSignature` returned false) |
| T402-4102 | UserOperation simulation reverted |
| T402-4103 | Bundler rejected UserOp (gas estimation failed or below market) |
| T402-4104 | Paymaster signature invalid or policy rejected |
| T402-4105 | Counterfactual smart account but server did not declare `acceptsCounterfactual` |
| T402-4106 | EntryPoint mismatch — server expects v0.7, payload references v0.6 |

## Appendix

### Why ERC-4337 in t402

Smart accounts unlock four payer-side capabilities the base `exact_evm` scheme cannot offer:

1. **Gasless via paymaster** — payer signs only; paymaster funds gas. No native token holding required.
2. **Session keys** — payer can delegate scoped payment authority to a session key (e.g. spend ≤ $50/day on this resource server). When combined with ERC-7710 (see [the delegation variant](./scheme_exact_evm_erc7710.md)), this becomes the dominant scheme for agent-mediated payments.
3. **Social / multi-sig recovery** — payer can use a smart account with social recovery; lost signing key does not lose funds.
4. **Account abstraction policy** — the smart account can enforce arbitrary policy (e.g. "never pay > X without 2-factor auth") via the account's `validateUserOp` hook.

t402's ERC-4337 integration is forward-compatible with the broader Account Abstraction roadmap (EIP-7702 EOA-with-code, ERC-7579 modular account interface, ERC-6492 counterfactual sigs).

### Reference Implementation

- TypeScript SDK: `sdks/typescript/packages/mechanisms/evm/src/erc4337/`
  - `t402.ts` — `GaslessT402Client` + `executePayment` / `executeBatchPayments`
  - `builder.ts` — UserOp construction and signing
  - `bundlers/{pimlico,alchemy}.ts` — bundler provider integrations
  - `paymasters/{pimlico,biconomy,stackup}.ts` — paymaster provider integrations
  - `accounts/safe.ts` — Safe smart account reference
- Go SDK: `sdks/go/mechanisms/evm/erc4337/`
- Python SDK: `sdks/python/t402/src/t402/erc4337/`
- Java SDK: `sdks/java/src/main/java/io/t402/erc4337/`

### Related specifications

- [Base `exact_evm` scheme](./scheme_exact_evm.md)
- [ERC-7710 delegation variant](./scheme_exact_evm_erc7710.md)
- [USDT Token Coverage](../../usdt-tokens.md)
- Upstream: [ERC-4337 Account Abstraction](https://eips.ethereum.org/EIPS/eip-4337)
- Upstream: [ERC-6492 Counterfactual Signature Verification](https://eips.ethereum.org/EIPS/eip-6492)

### Changelog

| Date | Version | Change |
|---|---|---|
| 2026-05-28 | 1 | Initial draft. Documents EntryPoint v0.7 integration, two sub-flows, paymaster providers, ERC-6492 unwrap. Mirrors implementation in `mechanisms/evm/src/erc4337/`. |
