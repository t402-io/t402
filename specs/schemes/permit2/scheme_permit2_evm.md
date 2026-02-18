# Permit2 Scheme - EVM Implementation

## Contract

The canonical Permit2 contract address on all EVM chains:

```
0x000000000022D473030F116dDEE9F6B43aC78BA3
```

## EIP-712 Domain

```json
{
  "name": "Permit2",
  "chainId": <chain_id>,
  "verifyingContract": "0x000000000022D473030F116dDEE9F6B43aC78BA3"
}
```

Note: No `version` field in the domain (matches the Permit2 contract's domain separator).

## EIP-712 Types

```solidity
struct TokenPermissions {
    address token;
    uint256 amount;
}

struct PermitTransferFrom {
    TokenPermissions permitted;
    address spender;
    uint256 nonce;
    uint256 deadline;
}
```

## Payload Structure

```typescript
interface Permit2PayloadV2 {
  permit: {
    permitted: {
      token: string;    // ERC20 token address
      amount: string;   // Maximum permitted amount
    };
    nonce: string;      // Unique nonce (random, non-sequential)
    deadline: string;   // Unix timestamp deadline
  };
  transferDetails: {
    to: string;              // Recipient address
    requestedAmount: string; // Amount to transfer
  };
  signature: string;  // EIP-712 signature (hex)
  owner: string;      // Token owner address
}
```

## Payment Requirements Extra Fields

The server adds `permit2Address` to the `extra` field of `PaymentRequirements`:

```json
{
  "extra": {
    "permit2Address": "0x000000000022D473030F116dDEE9F6B43aC78BA3"
  }
}
```

## Client Flow

1. Receive `PaymentRequirements` with `scheme: "permit2"`
2. Build `PermitTransferFrom` message:
   - `permitted.token` = `requirements.asset`
   - `permitted.amount` = `requirements.amount`
   - `spender` = `requirements.payTo` (the facilitator relays to this address)
   - `nonce` = random 256-bit value
   - `deadline` = `now + maxTimeoutSeconds`
3. Sign EIP-712 typed data with the Permit2 domain
4. Submit payload with permit, transferDetails, signature, and owner

## Facilitator Flow

### Verify

1. Validate payload structure (permit, transferDetails, signature, owner)
2. Check scheme and network match requirements
3. Verify token address matches `requirements.asset`
4. Verify recipient matches `requirements.payTo`
5. Verify deadline is in the future
6. Verify permitted amount >= required amount
7. Check owner's token balance >= required amount

### Settle

1. Re-verify the payment
2. Call `permitTransferFrom` on the Permit2 contract:

```solidity
function permitTransferFrom(
    PermitTransferFrom calldata permit,
    SignatureTransferDetails calldata transferDetails,
    address owner,
    bytes calldata signature
) external;
```

3. Wait for transaction confirmation

## Prerequisites

The token owner must have approved the Permit2 contract to spend their tokens:

```solidity
IERC20(token).approve(PERMIT2_ADDRESS, type(uint256).max);
```

This is a one-time operation per token. Many DeFi applications already request Permit2 approval, so users may already have the necessary approval in place.

## Nonce Management

Permit2 uses a bitmap-based nonce system that supports non-sequential nonces. Each nonce can only be used once. The client generates a random 256-bit nonce for each payment, avoiding the need for sequential nonce tracking.

## Security Considerations

- The `spender` in the signed message is the facilitator's settlement address
- The `deadline` prevents indefinite permit validity
- Each nonce can only be consumed once (replay protection)
- The token owner can revoke Permit2 approval at any time
- Amount validation ensures the permit covers the required payment
