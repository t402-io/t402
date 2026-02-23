# Permit2 Proxy Scheme

## Overview

The `permit2-proxy` scheme extends the plain `permit2` scheme with **witness-based facilitator binding** via a dedicated proxy contract. Instead of the facilitator calling the Permit2 contract directly (where `spender = facilitator` and the facilitator controls the transfer destination), the payer's EIP-712 signature binds a `Witness` struct that cryptographically commits to the recipient (`to`), the authorized facilitator (`facilitator`), and a time window (`validAfter`). Settlement is routed through a T402 proxy contract that enforces these constraints on-chain.

This architecture eliminates frontrunning and destination manipulation by the facilitator, achieves interoperability with the [x402](https://github.com/coinbase/x402) protocol, and optionally supports fully gasless flows via EIP-2612 token approval.

## Scheme Identifier

```
scheme: "permit2-proxy"
```

## How It Works

1. **Token Owner** approves the Permit2 contract (`0x000000000022D473030F116dDEE9F6B43aC78BA3`) to spend their tokens (one-time `approve` call, or gasless via EIP-2612 at settlement time).
2. **Client** signs an EIP-712 `PermitWitnessTransferFrom` message that includes a `Witness` struct binding `{to, facilitator, validAfter}` into the signature.
3. **Facilitator** calls the T402 Permit2 Proxy contract, which verifies the witness constraints and forwards the call to Permit2's `permitWitnessTransferFrom`.

## Witness Struct

```solidity
struct Witness {
    address to;          // Destination address for the token transfer
    address facilitator; // Address authorized to call settle (must match msg.sender)
    uint256 validAfter;  // Earliest timestamp when settlement is permitted
}
```

| Field | Purpose |
|-------|---------|
| `to` | Locks the transfer destination into the payer's signature. The proxy contract uses this as the `SignatureTransferDetails.to` field, preventing the facilitator from redirecting funds. |
| `facilitator` | Binds a specific facilitator address. The proxy contract requires `msg.sender == witness.facilitator`, preventing unauthorized parties from submitting the signature. |
| `validAfter` | Lower bound on settlement time. Combined with the Permit2 `deadline` (upper bound), this creates a precise settlement window. Useful for coordinating time-locked payments. |

## Comparison with Plain `permit2`

| Property | `permit2` | `permit2-proxy` |
|----------|-----------|-----------------|
| Transfer destination | Controlled by facilitator at settlement time | Bound in payer's signature via witness |
| Facilitator binding | None — any address with the signature can settle | Cryptographically bound to specific facilitator |
| Frontrun protection | Facilitator can redirect funds | Destination locked by payer signature |
| Time window | Upper bound only (deadline) | Upper bound (deadline) + lower bound (validAfter) |
| Settlement contract | Permit2 directly | T402 Proxy -> Permit2 |
| Gasless flow | Requires prior ERC-20 approval | Optional EIP-2612 permit at settlement time |
| x402 compatibility | No | Yes (witness type matches x402 architecture) |

## Interoperability with x402

The `permit2-proxy` witness structure is designed for interoperability with the [x402 protocol](https://github.com/coinbase/x402). Both protocols use Permit2's `permitWitnessTransferFrom` with compatible witness types, allowing:

- Shared facilitator infrastructure between t402 and x402
- Clients that produce signatures consumable by either protocol
- Common on-chain verification logic

## When to Use Each Scheme

| Use Case | Recommended Scheme |
|----------|-------------------|
| EIP-3009 tokens (USDC, USDT0) with exact amounts | `exact` |
| Any ERC-20 token, simple facilitator trust model | `permit2` |
| Any ERC-20 token, facilitator binding + frontrun protection | `permit2-proxy` |
| Usage-based billing with facilitator binding | `permit2-proxy` (upto variant) |
| Gasless token approval at settlement time | `permit2-proxy` (with EIP-2612 settleWithPermit) |
| Interop with x402 | `permit2-proxy` |

## Prerequisites

The token owner must have approved the Permit2 contract to spend their tokens:

```solidity
IERC20(token).approve(PERMIT2_ADDRESS, type(uint256).max);
```

This is a one-time operation per token. Many DeFi applications already request Permit2 approval, so users may already have the necessary approval in place.

Alternatively, for tokens that support EIP-2612 (e.g., USDC), the facilitator can include an EIP-2612 permit in the settlement transaction via `settleWithPermit`, making the entire flow gasless for the payer.

## Security Properties

### Facilitator Binding

The payer's signature commits to a specific facilitator address. Only that facilitator (as `msg.sender`) can execute settlement. This prevents:

- Stolen signatures from being used by unauthorized parties
- MEV bots from extracting value by frontrunning settlement

### Destination Locking

The `to` field in the witness is part of the signed data. The proxy contract enforces that `SignatureTransferDetails.to = witness.to`, making it impossible for the facilitator to redirect funds to a different address.

### Time Windows

The combination of `validAfter` (lower bound) and Permit2's `deadline` (upper bound) creates a precise settlement window. This allows:

- Coordinated settlement timing between parties
- Prevention of premature settlement
- Bounded exposure duration

### Nonce Replay Protection

Permit2's bitmap-based nonce system ensures each signature can only be consumed once. The client generates a random 256-bit nonce for each payment.

## Settlement Variants

The scheme supports two settlement modes via separate proxy contracts:

| Variant | Contract | Behavior |
|---------|----------|----------|
| Exact | `T402ExactPermit2Proxy` | Transfers the full `permitted.amount` |
| Up-to | `T402UptoPermit2Proxy` | Transfers a facilitator-specified amount <= `permitted.amount` |

Both variants support an optional `settleWithPermit` function that combines EIP-2612 token approval with Permit2 settlement in a single transaction.

## Network Support

See [scheme_permit2_proxy_evm.md](./scheme_permit2_proxy_evm.md) for EVM-specific implementation details including contract addresses, EIP-712 types, and wire formats.
