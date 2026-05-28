# Scheme: `batch-settlement` on `EVM`

## Status

**Spec Draft.** SDK implementation tracked in [PROTOCOL-REFINEMENT-PLAN-2026-05-19](../../README.md) Phase B Week 6. The wire format is finalized in this document and is **interoperable with x402's batch-settlement-evm scheme** (PR #1145 merged 2026-04-15, plus contract commit `84ffb641` 2026-05-15). T402 facilitators MUST be able to settle payloads originally signed for x402, modulo the `t402Version` ↔ `x402Version` field shim documented in [`scheme_batch_settlement.md`](./scheme_batch_settlement.md).

## Summary

The `batch-settlement` scheme on EVM is a **capital-backed** network binding using stateless unidirectional payment channels for high-throughput, low-cost payments. Clients deposit funds into on-chain channels once and sign off-chain **cumulative vouchers** per request. Servers verify vouchers with fast signature checks and claim them on-chain periodically in batches, reducing both latency and gas costs drastically. A single claim transaction can cover many channels at once and only updates on-chain accounting; claimed funds are later transferred to the receiver via a separate settle operation that sweeps many claims into one token transfer.

The scheme supports **dynamic pricing**: the client authorizes a maximum per-request, and the server charges the actual cost within that ceiling.

t402 implementations MUST use the canonical `x402BatchSettlement` contract deployed by the x402 Foundation. Forking or re-deploying the contract breaks cross-protocol liquidity and is explicitly disallowed.

## Channel Lifecycle

### Channel creation and deposits

A channel is created implicitly on the first deposit. The client deposits funds from the `payer` address into the on-chain escrow via one of two asset transfer methods: `eip3009` for tokens that support `receiveWithAuthorization` (e.g. USDC, USDT0) or `permit2` as a universal fallback for any ERC-20. Deposits are sponsored by the facilitator (gasless for the client).

Channel identity is derived from an immutable config struct:

```solidity
struct ChannelConfig {
    address payer;              // Client wallet (EOA or smart wallet)
    address payerAuthorizer;    // EOA for voucher signing, or address(0) for EIP-1271 via payer
    address receiver;           // Server's payment destination (EOA or routing contract)
    address receiverAuthorizer; // Authorizes claims and refunds via EIP-712 signatures
    address token;              // ERC-20 payment token
    uint40  withdrawDelay;      // Seconds before timed withdrawal completes (15 min – 30 days)
    bytes32 salt;               // Differentiates channels with identical parameters
}
```

with `channelId = EIP712Hash(ChannelConfig)` under the `x402 Batch Settlement` EIP-712 domain. The hash binds the immutable config to the EVM `chainId` and the deployed `x402BatchSettlement` contract address, so the same config produces different IDs across chains or deployments.

### Requests and vouchers

The channel tracks two values on-chain:

- `balance` — total deposited minus withdrawals and refunds
- `totalClaimed` — cumulative amount claimed by the server

Each voucher the client signs carries a cumulative ceiling (`maxClaimableAmount`). The server can claim up to that ceiling. Because vouchers are monotonically increasing, old vouchers with lower ceilings are naturally superseded.

The server tracks a running total of actual charges per channel (`chargedCumulativeAmount`). For each subsequent request, the client sets the voucher's `maxClaimableAmount` to `chargedCumulativeAmount + amount`, where `amount` is the per-request maximum from `PaymentRequirements`.

### Claim and settle

The server claims the latest voucher per channel on-chain at its discretion. `claimWithSignature(claims, signature)` allows aggregating claims from multiple channels in one call. Claiming updates `totalClaimed` per channel; no token transfer occurs.

`settle(receiver, token)` sweeps all claimed-but-unsettled funds to the `receiver` in one transfer.

### Refund and withdrawal

**Cooperative refund.** The receiver side can return up to `balance - totalClaimed` to the payer via two paths:

- `refund(config, amount)` — direct call by `receiver` or `receiverAuthorizer`; no signature required.
- `refundWithSignature(config, amount, nonce, sig)` — relay-friendly; anyone submits an EIP-712 `Refund` signature from `receiverAuthorizer`.

Both paths share the same internal execution: `refundNonce` is incremented **first** (before the amount cap is applied and before any token transfer), so a no-op refund (`amount > 0` but no unclaimed escrow available) still advances the nonce without emitting `Refunded` or moving tokens. A direct `refund` call therefore invalidates any pre-signed `refundWithSignature` digest for the previous nonce. If a timed withdrawal is pending, a cooperative refund **reduces** its recorded amount proportionally; it is only cancelled entirely when the refund amount meets or exceeds the pending withdrawal amount.

**Timed withdrawal (escape hatch).** The `payer` or `payerAuthorizer` calls `initiateWithdraw(config, amount)` to start a grace period. The requested `amount` MUST NOT exceed `balance - totalClaimed` at initiation time; the call reverts otherwise. During the grace period the server can claim outstanding vouchers. After the withdrawal delay elapses, `finalizeWithdraw` (also callable by `payerAuthorizer`) completes the withdrawal, capping the transferred amount to whatever unclaimed escrow remains at that point.

### Authorizer roles

**Payer authorizer** (`payerAuthorizer`): if set to a non-zero address (an EOA), vouchers are verified via ECDSA recovery against that committed key — fast, no RPC required. If set to zero, vouchers are verified against the payer address, supporting EIP-1271 smart wallets at the cost of an RPC call.

**Receiver authorizer** (`receiverAuthorizer`): authorizes claim and refund operations via EIP-712 signatures. The server chooses this address: a server-owned EOA or smart contract (e.g. for key rotation), or a facilitator-provided address when the server delegates authorization. MUST NOT be zero. Anyone can relay a `claimWithSignature` or `refundWithSignature` transaction with a valid authorization signature from the `receiverAuthorizer`.

### Channel lifecycle events

The contract emits `ChannelCreated(channelId, config)` on the first deposit into a channel (when `balance` transitions from zero with `totalClaimed == 0`). It emits `ChannelClosed(channelId, config)` when unclaimed escrow returns to zero with `totalClaimed == 0` — triggered by either a full cooperative refund or a timed withdrawal that drains all escrow. Indexers MUST handle `ChannelCreated` firing more than once on the same `channelId` if the channel is re-funded after being fully drained.

### Channel reuse and parameter changes

Channels are long-lived. After a refund, the client can top up and reuse the same channel. However, the channel config is immutable. If any parameter needs to change, a new channel is required. If delegating `receiverAuthorizer` to a facilitator, the server SHOULD claim all outstanding vouchers and refund remaining balances on old channels before switching to another facilitator.

## 402 Response (PaymentRequirements)

The 402 response contains pricing terms and the server's channel parameters. The client maps:

- `payTo` → `ChannelConfig.receiver`
- `extra.receiverAuthorizer` → `ChannelConfig.receiverAuthorizer`
- `asset` → `ChannelConfig.token`
- `extra.withdrawDelay` → `ChannelConfig.withdrawDelay`

Then fills in its own `payer`, `payerAuthorizer`, and `salt` to construct the full config.

```json
{
  "scheme": "batch-settlement",
  "network": "eip155:8453",
  "amount": "100000",
  "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "payTo": "0xServerReceiverAddress",
  "maxTimeoutSeconds": 3600,
  "extra": {
    "receiverAuthorizer": "0xReceiverAuthorizerAddress",
    "withdrawDelay": 900,
    "name": "USDC",
    "version": "2"
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `extra.receiverAuthorizer` | string | yes | Address that will authorize claims and refunds |
| `extra.withdrawDelay` | number | yes | Withdrawal delay in seconds (15 min – 30 days) |
| `extra.assetTransferMethod` | string | optional | `"eip3009"` (default) or `"permit2"` |
| `extra.name` | string | yes | EIP-712 domain name of the token contract |
| `extra.version` | string | yes | EIP-712 domain version of the token contract |
| `extra.channelState` | object | optional | Corrective-only server channel snapshot for cumulative-amount resynchronization |
| `extra.voucherState` | object | optional | Corrective-only signed voucher proof for cumulative-amount resynchronization |

## Client: Payment Construction

The client constructs a payment payload whose type depends on channel state:

- `deposit` — no channel exists or balance is exhausted; client signs a token authorization and an initial voucher
- `voucher` — channel has sufficient balance; client signs a new cumulative voucher
- `refund` — client requests a cooperative refund; client signs a zero-charge voucher and optionally includes a refund amount

### Deposit Payload

The `deposit.authorization` field contains the token transfer authorization — exactly one of `erc3009Authorization` or `permit2Authorization` MUST be present.

```json
{
  "t402Version": 2,
  "accepted": {
    "scheme": "batch-settlement",
    "network": "eip155:8453",
    "amount": "1000",
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "payTo": "0xServerReceiverAddress",
    "maxTimeoutSeconds": 3600,
    "extra": {
      "receiverAuthorizer": "0xReceiverAuthorizerAddress",
      "withdrawDelay": 900,
      "name": "USDC",
      "version": "2"
    }
  },
  "payload": {
    "type": "deposit",
    "channelConfig": {
      "payer": "0xClientAddress",
      "payerAuthorizer": "0xClientPayerAuthorizerEOA",
      "receiver": "0xServerReceiverAddress",
      "receiverAuthorizer": "0xReceiverAuthorizerAddress",
      "token": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "withdrawDelay": 900,
      "salt": "0x0000000000000000000000000000000000000000000000000000000000000000"
    },
    "voucher": {
      "channelId": "0xabc123...channelId",
      "maxClaimableAmount": "1000",
      "signature": "0x...EIP-712 voucher signature"
    },
    "deposit": {
      "amount": "100000",
      "authorization": {
        "erc3009Authorization": {
          "validAfter": "0",
          "validBefore": "1770000000",
          "salt": "0x...authorization salt",
          "signature": "0x...EIP-3009 signature"
        }
      }
    }
  }
}
```

### Voucher Payload

```json
{
  "t402Version": 2,
  "accepted": { "...": "..." },
  "payload": {
    "type": "voucher",
    "channelConfig": { "...": "..." },
    "voucher": {
      "channelId": "0xabc123...channelId",
      "maxClaimableAmount": "5000",
      "signature": "0x...EIP-712 voucher signature"
    }
  }
}
```

### Refund Payload

The optional `amount` requests a partial refund; omit it for a full refund. The voucher is zero-charge: `voucher.maxClaimableAmount` MUST equal the channel's current `chargedCumulativeAmount`. Before settlement, the server completes the payload with the refund nonce, claim data, and any receiver-authorizer signatures it is responsible for.

```json
{
  "t402Version": 2,
  "accepted": { "...": "..." },
  "payload": {
    "type": "refund",
    "channelConfig": { "...": "..." },
    "voucher": {
      "channelId": "0xabc123...channelId",
      "maxClaimableAmount": "3200",
      "signature": "0x...EIP-712 zero-charge voucher signature"
    },
    "amount": "1500"
  }
}
```

## Server: State and Forwarding

The server is the sole owner of per-channel state.

### Per-channel state

The server MUST maintain per-channel state, keyed by channel ID:

| State Field | Type | Description |
|---|---|---|
| `channelConfig` | `ChannelConfig` | Full channel configuration object |
| `chargedCumulativeAmount` | uint128 | Actual accumulated cost for this channel |
| `signedMaxClaimable` | uint128 | `maxClaimableAmount` from the latest client-signed voucher |
| `signature` | bytes | Client's voucher signature for the latest `signedMaxClaimable` |
| `balance` | uint128 | Current channel balance (mirrored from on-chain) |
| `totalClaimed` | uint128 | Total claimed on-chain (mirrored from on-chain) |
| `withdrawRequestedAt` | uint64 | Unix timestamp when timed withdrawal was initiated, or 0 if none (mirrored from on-chain) |
| `refundNonce` | uint256 | Next nonce required for `refundWithSignature` (mirrored from on-chain) |
| `onchainSyncedAt` | uint64 | Local timestamp when mirrored on-chain fields were refreshed |
| `lastRequestTimestamp` | uint64 | Timestamp of the last paid request |

### Request processing

The server MUST serialize request processing per channel and MUST NOT update voucher state until the resource handler has succeeded.

1. **Verify**:
   - For `voucher` and `deposit` payloads, check that `payload.voucher.maxClaimableAmount == chargedCumulativeAmount + paymentRequirements.amount`. If this fails, reject with `invalid_batch_settlement_evm_cumulative_amount_mismatch` and return a corrective 402 carrying the server's authoritative `channelState`.
   - For refund payloads, check that `payload.voucher.maxClaimableAmount == chargedCumulativeAmount` and skip the resource handler after facilitator verification.
   - Always call facilitator `/verify` for `deposit` and `refund` payloads, as well as `voucher` payloads with EIP-1271 vouchers.
   - A plain EOA-authorized `voucher` MAY be verified locally when the server's mirrored on-chain state is fresh.
2. **Execute** the resource handler.
3. **On success — commit state**:
   - `chargedCumulativeAmount += actualPrice` (where `actualPrice <= PaymentRequirements.amount`)
   - Mirror `balance`, `totalClaimed`, `withdrawRequestedAt`, and `refundNonce` from the facilitator response.
4. **On failure**: state unchanged, client can retry the same voucher.

### Payment response contract

Successful paid responses distinguish on-chain transfers from off-chain charges:

- **Voucher-only response**: `transaction` is `""`, top-level `amount` is `""`, `extra.chargedAmount` is the request charge, and `extra.channelState` carries the channel snapshot.
- **Deposit response**: `transaction` is the deposit transaction hash, top-level `amount` is the deposited amount, `extra.chargedAmount` is the request charge, and `extra.channelState` carries the channel snapshot.
- **Refund response**: `transaction` is the refund transaction hash, top-level `amount` is the refunded amount, `extra.channelState` carries the post-refund channel snapshot and `extra.chargedAmount` is omitted.

```json
{
  "success": true,
  "transaction": "",
  "network": "eip155:8453",
  "payer": "0xClientAddress",
  "amount": "",
  "extra": {
    "chargedAmount": "700",
    "channelState": {
      "channelId": "0xabc123...channelId",
      "balance": "100000",
      "totalClaimed": "3200",
      "withdrawRequestedAt": 0,
      "refundNonce": "1",
      "chargedCumulativeAmount": "3900"
    }
  }
}
```

### Cooperative refund flow

When the server receives a `type: "refund"` payload:

1. **Verify (zero-charge)**: enforce `payload.voucher.maxClaimableAmount == chargedCumulativeAmount` (no increment from `paymentRequirements.amount`). If local state is stale, emit a corrective 402 so the client can recover and retry.
2. **Bypass the protected resource.** Refund payloads are payment operations, not paid requests; the application route is not invoked.
3. **Complete the settlement payload**: resolve omitted `amount` to a full refund, validate any partial `amount`, add `refundNonce`, build `claims`, and add receiver-authorizer signatures when the server owns that key.
4. **Submit on-chain**: `claimWithSignature(claims, claimSig)` (no-op when `maxClaimableAmount == totalClaimed`) followed by `refundWithSignature(config, amount, nonce, refundSig)`. The contract increments `refundNonce` before applying the amount cap; even if no tokens move (zero available escrow), the nonce advances.
5. **Update channel state**:
   - Full refund (refunded amount equals the remainder): delete the channel record.
   - Partial refund: keep the channel record, mirror the returned `balance`, `totalClaimed`, `withdrawRequestedAt`, and `refundNonce`. If a timed withdrawal was pending, its recorded amount is reduced proportionally (or cancelled if the refund covers it entirely).
6. Return the settle response in the standard `PAYMENT-RESPONSE` header.

After the server completes the refund payload, the facilitator receives:

```json
{
  "type": "refund",
  "channelConfig": { "...": "..." },
  "voucher": {
    "channelId": "0xabc123...channelId",
    "maxClaimableAmount": "3200",
    "signature": "0x...EIP-712 zero-charge voucher signature"
  },
  "amount": "1500",
  "refundNonce": "1",
  "claims": [
    {
      "voucher": {
        "channel": { "...": "..." },
        "maxClaimableAmount": "3200"
      },
      "signature": "0x...EIP-712 zero-charge voucher signature",
      "totalClaimed": "3200"
    }
  ],
  "refundAuthorizerSignature": "0x...refund authorization",
  "claimAuthorizerSignature": "0x...claim authorization"
}
```

`refundAuthorizerSignature` and `claimAuthorizerSignature` are included when the server owns the receiver-authorizer key. If the channel delegates receiver authorization to the facilitator, the server omits them and the facilitator signs before submitting the transaction.

## Facilitator Interface

Uses the standard t402 facilitator interface (`/verify`, `/settle`, `/supported`).

### POST /verify

Verifies a deposit, voucher, or refund payment payload. Returns the on-chain channel snapshot:

```json
{
  "isValid": true,
  "payer": "0xPayerAddress",
  "extra": {
    "channelId": "0xabc123...",
    "balance": "1000000",
    "totalClaimed": "500000",
    "withdrawRequestedAt": 0,
    "refundNonce": "0"
  }
}
```

### POST /settle

The settle payload `type` discriminator drives behavior:

| `payload.type` | When Used | On-chain Effect |
|---|---|---|
| `"deposit"` | First request or top-up | Deposit via the canonical EIP-3009 or Permit2 collector |
| `"claim"` | Server batches voucher claims | Validate vouchers, update accounting (no transfer) |
| `"settle"` | Server transfers earned funds | Transfer unsettled amount to receiver |
| `"refund"` | Cooperative refund | Return specified amount to payer, increment refund nonce |

Server-authored claim and settle payloads use the same `type` discriminator:

```json
{
  "type": "claim",
  "claims": [
    {
      "voucher": {
        "channel": { "...": "..." },
        "maxClaimableAmount": "5000"
      },
      "signature": "0x...voucher signature",
      "totalClaimed": "5000"
    }
  ],
  "claimAuthorizerSignature": "0x...claim authorization"
}
```

`claimAuthorizerSignature` is included when the server owns the receiver-authorizer key. If receiver authorization is delegated to the facilitator, the server omits it and the facilitator signs before submitting the transaction.

```json
{
  "type": "settle",
  "receiver": "0xServerReceiverAddress",
  "token": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
}
```

Example facilitator response for a claim:

```json
{
  "success": true,
  "transaction": "0x...transactionHash",
  "network": "eip155:8453",
  "amount": ""
}
```

`amount` is empty because claim only updates accounting; no funds move.

## Error Codes

The batch-settlement scheme uses the standard t402 error codes plus these scheme-specific codes (T402-44xx range):

### Verification errors

| Error Code | Description |
|---|---|
| T402-4400 (`invalid_batch_settlement_evm_payload_format`) | Payload doesn't match `deposit`, `voucher`, `claim`, `settle`, or `refund` shape |
| T402-4401 (`invalid_batch_settlement_evm_cumulative_amount_mismatch`) | `voucher.maxClaimableAmount` doesn't match `chargedCumulativeAmount + paymentRequirements.amount` |
| T402-4402 (`invalid_batch_settlement_evm_channel_id`) | `voucher.channelId` doesn't match the EIP-712 hash of `channelConfig` |
| T402-4403 (`invalid_batch_settlement_evm_payer_authorizer`) | Voucher signature doesn't recover to `payerAuthorizer` (or fails EIP-1271 when `payerAuthorizer == 0x00`) |
| T402-4404 (`invalid_batch_settlement_evm_receiver_authorizer`) | Claim or refund signature doesn't recover to `receiverAuthorizer` |
| T402-4405 (`invalid_batch_settlement_evm_zero_receiver_authorizer`) | `channelConfig.receiverAuthorizer` is zero (not permitted) |
| T402-4406 (`invalid_batch_settlement_evm_withdraw_delay`) | `withdrawDelay` outside permitted range (15 min – 30 days) |
| T402-4407 (`invalid_batch_settlement_evm_deposit_insufficient`) | Deposit amount less than first voucher's `maxClaimableAmount` |
| T402-4408 (`invalid_batch_settlement_evm_voucher_below_total_claimed`) | New voucher's `maxClaimableAmount` is less than channel's `totalClaimed` |
| T402-4409 (`invalid_batch_settlement_evm_refund_amount_exceeds_unclaimed`) | Refund amount exceeds `balance - totalClaimed` |
| T402-4410 (`invalid_batch_settlement_evm_refund_nonce_mismatch`) | `refundWithSignature` nonce doesn't match on-chain `refundNonce` |
| T402-4411 (`invalid_batch_settlement_evm_token_mismatch`) | `channelConfig.token` doesn't match `paymentRequirements.asset` |
| T402-4412 (`invalid_batch_settlement_evm_receiver_mismatch`) | `channelConfig.receiver` doesn't match `paymentRequirements.payTo` |

### Corrective 402

When a verification error indicates a state synchronization gap (e.g. cumulative-amount mismatch), the server MUST emit a corrective 402 that carries the authoritative server state so the client can recover:

```json
{
  "t402Version": 2,
  "error": "invalid_batch_settlement_evm_cumulative_amount_mismatch",
  "accepts": [
    {
      "scheme": "batch-settlement",
      "network": "eip155:8453",
      "amount": "1000",
      "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "payTo": "0xServerReceiverAddress",
      "maxTimeoutSeconds": 3600,
      "extra": {
        "receiverAuthorizer": "0xReceiverAuthorizerAddress",
        "withdrawDelay": 900,
        "name": "USDC",
        "version": "2",
        "channelState": {
          "channelId": "0xabc123...",
          "balance": "100000",
          "totalClaimed": "3200",
          "withdrawRequestedAt": 0,
          "refundNonce": "1",
          "chargedCumulativeAmount": "5500"
        },
        "voucherState": {
          "maxClaimableAmount": "5500",
          "signature": "0x..."
        }
      }
    }
  ]
}
```

The client recomputes the next voucher using `chargedCumulativeAmount` from `channelState` rather than its local view.

### Settlement errors

| Error Code | Description |
|---|---|
| T402-4480 (`verification_failed`) | Re-verification before settlement failed |
| T402-4481 (`transaction_reverted`) | On-chain transaction reverted after confirmation |
| T402-4482 (`claim_already_redeemed`) | `claim` raced with another claim of the same voucher (idempotent — no-op) |
| T402-4483 (`withdraw_in_progress`) | Channel has a pending timed withdrawal that blocks deposit |

## Reference contract

`x402BatchSettlement` is deployed at canonical addresses on each supported chain by the x402 Foundation. The address is the same on every supported chain. T402 SDKs SHOULD load it from a versioned constant rather than hardcoding.

Current addresses (as of 2026-05-28): see [base/commerce-payments deployments](https://github.com/base/commerce-payments/blob/main/DEPLOYMENTS.md) for the canonical list. The x402 reference contract (commit `84ffb641`) is byte-identical to what t402 settles against.

## Performance Properties

The motivating performance properties of `batch-settlement` on EVM:

| Property | `exact` | `batch-settlement` |
|---|---|---|
| Per-request HTTP latency | ~5-30s (on-chain) | Sub-second (off-chain voucher) |
| Per-request gas | Full EIP-3009 cost (~50K gas) | Zero (no on-chain ops) |
| Settlement gas | (n/a — settled per-request) | Amortized over N requests |
| Theoretical throughput | RPC-limited (~10 TPS per facilitator) | Voucher-signing-limited (~10,000 TPS per channel) |
| Per-request cost @ 10 gwei + 1000 req/claim | ~$0.04 | ~$0.00004 |

The gas-cost-reduction target for the t402 implementation is **>80% per claim batch versus per-request settlement** (matching the PROTOCOL-REFINEMENT-PLAN Phase B Week 6 metric).

## Appendix

### Composability with other schemes

`batch-settlement` composes with:

- [`auth-capture`](../auth-capture/scheme_auth_capture.md) — the captureAuthorizer for an `auth-capture` payment can be a smart contract that batches multiple captures via batch-settlement vouchers, achieving "reversible micropayments".
- [ERC-7710 delegation](../exact/scheme_exact_evm_erc7710.md) — the `payerAuthorizer` MAY be a delegate, enabling agent-mediated batch payments under an on-chain budget cap.
- [`offer-and-receipt` extension](../../extensions/offer-and-receipt.md) — server can issue receipts per request that reference the same channel.

### Related specifications

- [Abstract `batch-settlement` scheme](./scheme_batch_settlement.md)
- [Base `exact_evm` scheme](../exact/scheme_exact_evm.md)
- [`auth-capture_evm` scheme](../auth-capture/scheme_auth_capture_evm.md)
- [ERC-7710 delegation variant](../exact/scheme_exact_evm_erc7710.md)
- Forthcoming [dispute extension](../../extensions/dispute.md)
- Upstream x402 reference: <https://github.com/x402-foundation/x402/blob/main/specs/schemes/batch-settlement/scheme_batch_settlement_evm.md>
- Reference contract: <https://github.com/base/commerce-payments> (x402 commit `84ffb641`)

### Changelog

| Date | Version | Change |
|---|---|---|
| 2026-05-28 | 1 | Initial t402 draft, structurally identical to x402's batch-settlement-evm spec (PR #1145, merged 2026-04-15; contract commit `84ffb641`, 2026-05-15). Wire format and contract surface unchanged; SDK implementation tracked in PROTOCOL-REFINEMENT-PLAN-2026-05-19 Phase B Week 6. Error codes adapted to T402-44xx range. |
