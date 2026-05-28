# Scheme: `auth-capture` on `EVM`

## Status

**Spec Draft.** SDK implementation tracked in [PROTOCOL-REFINEMENT-PLAN-2026-05-19](../../README.md) Phase B Weeks 4-5. The wire format is finalized in this document and is **interoperable with x402's auth-capture-evm scheme** (PR #1425, merged 2026-05-13). T402 facilitators implementing this spec MUST be able to settle payloads originally signed for x402, modulo the `t402Version` ↔ `x402Version` field shim documented in [`scheme_auth_capture.md`](./scheme_auth_capture.md).

## Summary

The `auth-capture` scheme on EVM uses the [base/commerce-payments](https://github.com/base/commerce-payments) contract stack:

- **AuthCaptureEscrow**: Singleton contract that locks funds, enforces expiries, and distributes on capture or refund. Universal canonical address (same on every supported chain).
- **Token Collectors**: Universal canonical addresses, one per `assetTransferMethod`:
  - `EIP3009_TOKEN_COLLECTOR_ADDRESS` — collects funds via `receiveWithAuthorization` signatures (USDC, EURC, USDT0, etc.)
  - `PERMIT2_TOKEN_COLLECTOR_ADDRESS` — collects funds via Uniswap Permit2 `permitTransferFrom` (any ERC-20)
- **`captureAuthorizer`**: Address authorized to authorize, capture, void, refund, or charge a payment. The escrow contract gates those operations on `msg.sender` matching this address. In t402's facilitator-submits flow that is either **the facilitator's EOA**, or **any smart contract** that ends up calling the escrow (e.g., an arbiter contract with dispute logic, a multisig, etc.).

The client signs a single signature (EIP-3009 or Permit2). The facilitator calls `AuthCaptureEscrow.authorize()` (two-phase) or `AuthCaptureEscrow.charge()` (single-shot via `autoCapture: true`), either directly or through a smart contract set as the captureAuthorizer.

t402 implementations MUST use the canonical Coinbase-deployed AuthCaptureEscrow + token collectors rather than deploying parallel contracts. Universal canonical addresses are published in the `base/commerce-payments` deployments registry.

## PaymentRequirements

Servers accepting auth-capture payments advertise with scheme `auth-capture`:

```json
{
  "t402Version": 2,
  "accepts": [
    {
      "scheme": "auth-capture",
      "network": "eip155:8453",
      "amount": "1000000",
      "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "payTo": "0xReceiverAddress",
      "maxTimeoutSeconds": 60,
      "extra": {
        "name": "USDC",
        "version": "2",
        "captureAuthorizer": "0xCaptureAuthorizerAddress",
        "captureDeadline": 1740758554,
        "refundDeadline": 1741276954,
        "minFeeBps": 0,
        "maxFeeBps": 1000,
        "feeRecipient": "0xFeeRecipientAddress",
        "autoCapture": false,
        "assetTransferMethod": "eip3009"
      }
    }
  ]
}
```

### `extra` Fields

| Field | Required | Type | Description |
|---|---|---|---|
| `name` | Yes | string | EIP-712 token-domain name (e.g., `"USDC"`). Used for EIP-3009 signing only. |
| `version` | Yes | string | EIP-712 token-domain version (e.g., `"2"`). |
| `captureAuthorizer` | Yes | address | Address authorized to authorize, capture, void, refund, or charge. Committed on-chain as `PaymentInfo.operator`. |
| `captureDeadline` | Yes | uint48 | Absolute Unix seconds — capture MUST occur before this. Encoded as `authorizationExpiry`. |
| `refundDeadline` | Yes | uint48 | Absolute Unix seconds — refunds allowed until this. Encoded as `refundExpiry`. |
| `feeRecipient` | Yes | address | Fee recipient (committed on-chain as `PaymentInfo.feeReceiver`). Set to `address(0)` to let the captureAuthorizer specify any non-zero recipient at capture/charge time. |
| `minFeeBps` | Yes | uint16 | Minimum fee in basis points the captureAuthorizer MUST take. `0` = no minimum. |
| `maxFeeBps` | Yes | uint16 | Maximum fee in basis points the captureAuthorizer MAY take. |
| `autoCapture` | No | bool | `true` → facilitator calls `charge()` (atomic). `false` → `authorize()` (two-phase). Default: `false`. |
| `assetTransferMethod` | No | `"eip3009"` \| `"permit2"` | Which token collector to use. Default: `"eip3009"`. A server MAY list multiple `accepts[]` entries with different `assetTransferMethod` values so clients can pick the method matching their token approvals. |

### Spec → on-chain field mapping

The wire-format `extra` uses spec-level field names. The on-chain `PaymentInfo` struct keeps canonical Solidity names so the EIP-712 typehash matches the AuthCaptureEscrow contract byte-for-byte.

| Wire (`extra`) | On-chain (`PaymentInfo`) |
|---|---|
| `captureAuthorizer` | `operator` |
| `captureDeadline` | `authorizationExpiry` |
| `refundDeadline` | `refundExpiry` |
| `feeRecipient` | `feeReceiver` |
| (derived: `now + maxTimeoutSeconds`) | `preApprovalExpiry` |

## PaymentPayload

The payload carries the signature and the client-generated `salt`. The facilitator reconstructs the full `PaymentInfo` from `extra` + `salt` + payer + top-level requirements (`payTo`, `asset`, `amount`).

### EIP-3009 (default)

```json
{
  "t402Version": 2,
  "resource": { "url": "https://api.example.com/resource", "method": "GET" },
  "accepted": { "scheme": "auth-capture", "...": "..." },
  "payload": {
    "authorization": {
      "from": "0xPayerAddress",
      "to": "0xEIP3009TokenCollectorAddress",
      "value": "1000000",
      "validAfter": "0",
      "validBefore": "1740675754",
      "nonce": "0xf374...3480"
    },
    "signature": "0x2d6a...571c",
    "salt": "0x0000000000000000000000000000000000000000000000000000000000000abc"
  }
}
```

**Field derivation (EIP-3009):**

| Payload field | Derived from |
|---|---|
| `authorization.from` | Client's own address |
| `authorization.to` | `EIP3009_TOKEN_COLLECTOR_ADDRESS` (universal canonical address) |
| `authorization.value` | `requirements.amount` |
| `authorization.validAfter` | `0` (the token collector hardcodes the lower bound) |
| `authorization.validBefore` | `now + requirements.maxTimeoutSeconds` (also used as `preApprovalExpiry` when reconstructing `PaymentInfo`) |
| `authorization.nonce` | Payer-agnostic `PaymentInfo` hash (see [Nonce Derivation](#nonce-derivation-both-methods)) |
| `salt` | Fresh `bytes32` generated client-side per signing call |
| EIP-712 domain | `{ name, version }` from `extra`; `chainId` from `network`; `verifyingContract = requirements.asset` |

### Permit2

```json
{
  "t402Version": 2,
  "resource": { "url": "https://api.example.com/resource", "method": "GET" },
  "accepted": { "scheme": "auth-capture", "...": "..." },
  "payload": {
    "permit2Authorization": {
      "from": "0xPayerAddress",
      "permitted": {
        "token": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "amount": "1000000"
      },
      "spender": "0xPermit2TokenCollectorAddress",
      "nonce": "110210486920734568342928534950928740912034856789012345678901234567890123456789",
      "deadline": "1740675754"
    },
    "signature": "0x2d6a...571c",
    "salt": "0x0000000000000000000000000000000000000000000000000000000000000abc"
  }
}
```

**Field derivation (Permit2):**

| Payload field | Derived from |
|---|---|
| `permit2Authorization.from` | Client's own address |
| `permit2Authorization.permitted.token` | `requirements.asset` |
| `permit2Authorization.permitted.amount` | `requirements.amount` |
| `permit2Authorization.spender` | `PERMIT2_TOKEN_COLLECTOR_ADDRESS` (universal canonical address) |
| `permit2Authorization.nonce` | `uint256(payerAgnosticPaymentInfoHash)` (see [Nonce Derivation](#nonce-derivation-both-methods)) |
| `permit2Authorization.deadline` | `now + requirements.maxTimeoutSeconds` (also used as `preApprovalExpiry` when reconstructing `PaymentInfo`) |
| `salt` | Fresh `bytes32` generated client-side per signing call |
| EIP-712 domain | Canonical Permit2 contract; `chainId` from `network` |

**No witness** — the merchant address is bound through the deterministic nonce, not a separate witness struct.

### Nonce Derivation (both methods)

The signature nonce is the payer-agnostic `PaymentInfo` hash. Payer is zeroed; everything else is the values that will appear on-chain.

```
paymentInfoHash = keccak256(abi.encode(PAYMENT_INFO_TYPEHASH, paymentInfoWithZeroPayer))
nonce           = keccak256(abi.encode(chainId, AUTH_CAPTURE_ESCROW_ADDRESS, paymentInfoHash))
```

Freshness is enforced by `salt`: each signing call generates a fresh `bytes32` salt, so two payers signing concurrently produce distinct nonces with no collision risk.

## Verification Logic

The facilitator performs these checks in order:

1. **Type guard**: Verify payload matches one of `Eip3009Payload` or `Permit2Payload` (MUST include `signature` and `salt`).
2. **Scheme match**: `requirements.scheme === "auth-capture"` and `payload.accepted.scheme === "auth-capture"`.
3. **Network match**: `payload.accepted.network === requirements.network` and format is `eip155:<chainId>`.
4. **Extra validation**: `requirements.extra` contains all required fields (`captureAuthorizer`, `captureDeadline`, `refundDeadline`, `feeRecipient`, `minFeeBps`, `maxFeeBps`, `name`, `version`).
5. **Method routing**: `extra.assetTransferMethod` (default `"eip3009"`) matches the payload shape.
6. **Deadline ordering**: `refundDeadline >= captureDeadline`, `captureDeadline > now + 6s`, and `payload.validBefore` (EIP-3009) / `payload.deadline` (Permit2) `<= captureDeadline`.
7. **Time window**: `payload.deadline / validBefore > now + 6s` (not expired) and `validAfter <= now` (active, EIP-3009 only).
8. **Spender / collector match**: `payload.to === EIP3009_TOKEN_COLLECTOR_ADDRESS` (EIP-3009) or `payload.spender === PERMIT2_TOKEN_COLLECTOR_ADDRESS` (Permit2).
9. **Token match**: `payload.permitted.token === requirements.asset` (Permit2 only — EIP-3009 binds via signing domain).
10. **Signature verify**: Recover signer from EIP-712 (`ReceiveWithAuthorization` or `PermitTransferFrom`); MUST match `payer`.
11. **Amount**: `authorization.value` (EIP-3009) or `permit2Authorization.permitted.amount` (Permit2) matches `requirements.amount`.
12. **Nonce match**: Reconstruct `PaymentInfo` from extra + payload.salt + payer + requirements; recompute payer-agnostic hash; assert it matches the wire nonce. This transitively enforces equality on every field encoded in `PaymentInfo` (receiver, token, deadlines, fee bounds, feeRecipient), so individual field-by-field checks for those values are unnecessary.
13. **Simulate** `AUTH_CAPTURE_ESCROW.authorize(...)` or `.charge(...)` to ensure success.

### ERC-6492 Support

For smart wallet clients, the signature MAY be ERC-6492 wrapped (containing deployment bytecode). The facilitator MUST extract the inner ECDSA signature for verification. The on-chain `ERC6492SignatureHandler` in the token collector handles wallet deployment during settlement. See [`scheme_exact_evm_erc4337.md`](../exact/scheme_exact_evm_erc4337.md) for the counterfactual smart-wallet payment flow.

## Settlement Logic

1. **Re-verify** the payload (catches expired or invalid payloads before spending gas).
2. **Determine function**: `extra.autoCapture === true ? "charge" : "authorize"`.
3. **Resolve collector**: `EIP3009_TOKEN_COLLECTOR_ADDRESS` or `PERMIT2_TOKEN_COLLECTOR_ADDRESS` (per `assetTransferMethod`).
4. **Encode `collectorData`**: raw EIP-3009 signature, or ABI-encoded Permit2 signature.
5. **Call escrow**: `AUTH_CAPTURE_ESCROW.<functionName>(paymentInfo, amount, tokenCollector, collectorData)`.
6. **Wait for receipt**: 60s timeout.
7. **Return result**: transaction hash, network, payer.

### Capture (two-phase only)

After successful `authorize()`, the captureAuthorizer can finalize funds to the receiver:

```solidity
AUTH_CAPTURE_ESCROW.capture(paymentInfo, captureAmount, feeBps, feeReceiver)
```

The captureAuthorizer MUST satisfy:

- `captureAmount <= authorizedAmount`
- `now <= captureDeadline`
- `minFeeBps <= feeBps <= maxFeeBps`
- `feeReceiver == feeRecipient` OR `feeRecipient == address(0)` (in which case the captureAuthorizer specifies any non-zero feeReceiver)

### Void (two-phase only)

The captureAuthorizer can release escrowed funds back to the client:

```solidity
AUTH_CAPTURE_ESCROW.void(paymentInfo)
```

`now <= captureDeadline` MUST hold.

### Refund (both paths, post-capture / post-charge)

The captureAuthorizer can refund captured or charged payments within the refund window:

```solidity
AUTH_CAPTURE_ESCROW.refund(paymentInfo, refundAmount)
```

- `refundAmount <= capturedAmount` (two-phase) or `<= chargedAmount` (single-shot)
- `now <= refundDeadline`
- The refund returns funds from the receiver (two-phase) or from the captureAuthorizer's pre-funded refund pool (single-shot — see contract documentation)

### Reclaim (two-phase only)

After `captureDeadline` elapses without capture or void, the client can reclaim escrowed funds directly:

```solidity
AUTH_CAPTURE_ESCROW.reclaim(paymentInfo)
```

`now > captureDeadline` MUST hold. No captureAuthorizer permission required.

## Error Codes

The auth-capture scheme uses the standard t402 error codes plus these scheme-specific codes (T402-43xx range):

### Verification Errors

| Error Code | Description |
|---|---|
| T402-4300 (`invalid_payload_format`) | Payload doesn't match `Eip3009Payload` or `Permit2Payload`. |
| T402-4301 (`unsupported_scheme`) | Scheme is not `auth-capture`. |
| T402-4302 (`network_mismatch`) | Payload network doesn't match requirements. |
| T402-4303 (`invalid_network`) | Network format is not `eip155:<chainId>`. |
| T402-4304 (`invalid_auth_capture_extra`) | Extra is missing required fields. |
| T402-4305 (`unsupported_asset_transfer_method`) | `assetTransferMethod` is not `"eip3009"` or `"permit2"`. |
| T402-4306 (`payload_method_mismatch`) | Payload shape doesn't match `assetTransferMethod`. |
| T402-4307 (`capture_deadline_expired`) | `captureDeadline <= now + 6s`. |
| T402-4308 (`invalid_deadline_ordering`) | Deadlines violate `now + maxTimeoutSeconds <= captureDeadline <= refundDeadline`. |
| T402-4309 (`authorization_expired`) | EIP-3009 `validBefore` (or Permit2 `deadline`) `<= now + 6s`. |
| T402-4310 (`authorization_not_yet_valid`) | EIP-3009 `validAfter > now`. |
| T402-4311 (`invalid_auth_capture_signature`) | Signature verification failed. |
| T402-4312 (`amount_mismatch`) | Authorization value doesn't match `requirements.amount`. |
| T402-4313 (`token_collector_mismatch`) | `to` / `spender` doesn't match the canonical collector for the method. |
| T402-4314 (`token_mismatch`) | Permit2 `permitted.token` doesn't match `requirements.asset`. |
| T402-4315 (`nonce_mismatch`) | Wire nonce doesn't match the recomputed payer-agnostic PaymentInfo hash. |
| T402-4316 (`insufficient_balance`) | Payer balance is less than required amount. |
| T402-4317 (`simulation_failed`) | Settlement simulation reverted with an unmapped error. |

### Typed simulation reverts

If the simulate call reverts with an `AuthCaptureEscrow` custom error declared in the call's ABI, the facilitator MUST decode it (via `BaseError.walk()` + `ContractFunctionRevertedError` in viem-style tooling) and surface a stable reason instead of the opaque `simulation_failed` fallback:

| Custom error | `invalidReason` |
|---|---|
| `AfterPreApprovalExpiry` | `authorization_expired` |
| `InvalidExpiries` | `invalid_deadline_ordering` |
| `ExceedsMaxAmount` | `amount_mismatch` |
| `PaymentAlreadyCollected` | `payment_already_collected` |
| `TokenCollectionFailed` | `token_collection_failed` |
| `InvalidCollectorForOperation` | `invalid_collector` |
| `InvalidSender` | `invalid_capture_authorizer` |
| `ZeroAmount` / `AmountOverflow` | `amount_mismatch` / `amount_overflow` |
| `FeeBpsOverflow` | `invalid_fee_bps` |
| `InvalidFeeBpsRange` | `invalid_fee_bps_range` |
| `FeeBpsOutOfRange` | `fee_bps_out_of_range` |
| `ZeroFeeReceiver` | `zero_fee_receiver` |
| `InvalidFeeReceiver` | `invalid_fee_receiver` |
| `AfterAuthorizationExpiry` | `capture_deadline_expired` |
| `InsufficientAuthorization` | `insufficient_authorization` |
| `ZeroAuthorization` | `zero_authorization` |

### Settlement Errors

| Error Code | Description |
|---|---|
| T402-4380 (`verification_failed`) | Re-verification before settlement failed. |
| T402-4381 (`transaction_reverted`) | On-chain transaction reverted after confirmation. |
| T402-4382 (`bundler_rejected`) | Bundler rejected the underlying UserOp (applicable when the captureAuthorizer routes via ERC-4337). |

## Facilitator REST Surface (Recommended Additions)

To expose capture / void / refund / reclaim semantics, facilitators implementing `auth-capture` SHOULD add the following endpoints alongside the core `/verify`, `/settle`:

| Endpoint | Method | Purpose |
|---|---|---|
| `/v2/auth-capture/capture` | POST | Finalize a previously-authorized payment (two-phase only) |
| `/v2/auth-capture/void` | POST | Release escrowed funds back to client (two-phase only) |
| `/v2/auth-capture/refund` | POST | Refund a captured or charged payment within the refund window |
| `/v2/auth-capture/reclaim` | POST | Client-initiated reclaim after capture deadline (two-phase only) |
| `/v2/auth-capture/status/{paymentId}` | GET | Current lifecycle state of a payment |

Detailed schemas for these endpoints are out of scope for this document and will be added to the facilitator OpenAPI surface (`services/facilitator/facilitator/api/openapi.yaml`) as part of Phase B Week 4-5 implementation.

## Appendix

### Reference contracts (universal canonical addresses)

The `base/commerce-payments` deployment publishes universal canonical addresses for `AuthCaptureEscrow`, `EIP3009_TOKEN_COLLECTOR_ADDRESS`, and `PERMIT2_TOKEN_COLLECTOR_ADDRESS`. T402 implementations MUST use these exact addresses; deploying parallel contracts breaks interop with x402 and fragments liquidity.

Current addresses (as of 2026-05-28) are published at <https://github.com/base/commerce-payments/blob/main/DEPLOYMENTS.md>. SDKs SHOULD load these from a versioned constant rather than hardcoding.

### Why t402 mirrors x402's escrow contracts

t402 deliberately does not fork or re-deploy the AuthCaptureEscrow contracts. The reasons:

1. **Liquidity preservation** — a single canonical escrow keeps all auth-capture funds in one pool, simplifying integrator due diligence and dispute discovery.
2. **Audit reuse** — the Coinbase-deployed contracts have undergone formal audit; a t402 fork would require parallel audit.
3. **Cross-protocol settlement** — a payment signed for one protocol can be settled by either protocol's facilitator, increasing the available facilitator pool for any given user.

### Related specifications

- [Abstract `auth-capture` scheme](./scheme_auth_capture.md)
- [Base `exact_evm` scheme](../exact/scheme_exact_evm.md)
- [ERC-4337 smart-wallet variant](../exact/scheme_exact_evm_erc4337.md) — payer can be a smart account
- Forthcoming [dispute extension](../../extensions/dispute.md) — composes with `auth-capture`'s refund window
- Upstream x402 reference: <https://github.com/x402-foundation/x402/blob/main/specs/schemes/auth-capture/scheme_auth_capture_evm.md>

### Changelog

| Date | Version | Change |
|---|---|---|
| 2026-05-28 | 1 | Initial t402 draft, structurally identical to x402's auth-capture-evm spec (PR #1425, merged 2026-05-13). Wire format and contract surface unchanged; SDK implementation tracked in PROTOCOL-REFINEMENT-PLAN Phase B Weeks 4-5. Error codes adapted to T402-43xx range. |
