# Permit2 Proxy Scheme - EVM Implementation

> Smart contract audit pending before mainnet deployment.

## Summary

The `permit2-proxy` scheme on EVM chains uses Uniswap Permit2's `permitWitnessTransferFrom` with a witness struct to bind the transfer destination and facilitator into the payer's EIP-712 signature. Settlement is executed through T402 Permit2 Proxy contracts that enforce witness constraints on-chain.

## Architecture

```
┌─────────┐     ┌─────────────┐     ┌──────────────────┐     ┌───────────────┐     ┌────────────┐
│ Client  │────▶│ Resource    │────▶│   Facilitator    │────▶│ T402 Permit2  │────▶│  Permit2   │
│         │     │ Server      │     │                  │     │ Proxy         │     │  Contract  │
│ Signs   │     │ Returns 402 │     │ Calls Proxy      │     │ Enforces      │     │  Transfers │
│ Witness │     │ + Requires  │     │ settle()         │     │ Witness       │     │  Tokens    │
└─────────┘     └─────────────┘     └──────────────────┘     └───────────────┘     └────────────┘
```

## Contract Architecture

```
T402BasePermit2Proxy (abstract)
├── Witness struct + WITNESS_TYPEHASH
├── _settle() — core witness validation + Permit2 call
├── _executePermit() — optional EIP-2612 approval
│
├── T402ExactPermit2Proxy
│   ├── settle()           — exact amount settlement
│   └── settleWithPermit() — gasless exact settlement
│
└── T402UptoPermit2Proxy
    ├── settle()           — up-to amount settlement
    └── settleWithPermit() — gasless up-to settlement
```

### Contract Addresses

Contracts will be deployed via CREATE2 for deterministic addresses across all EVM chains.

| Chain | ExactPermit2Proxy | UptoPermit2Proxy | Status |
|-------|-------------------|------------------|--------|
| Base Mainnet | TBD | TBD | Pending Deployment |
| Base Sepolia | TBD | TBD | Pending Deployment |
| Ethereum Mainnet | TBD | TBD | Pending Deployment |
| Arbitrum | TBD | TBD | Pending Deployment |

### Permit2 Contract

The canonical Permit2 contract address on all EVM chains:

```
0x000000000022D473030F116dDEE9F6B43aC78BA3
```

## EIP-712 Domain

The domain is the **Permit2** contract's domain (not the proxy's):

```json
{
  "name": "Permit2",
  "chainId": "<chain_id>",
  "verifyingContract": "0x000000000022D473030F116dDEE9F6B43aC78BA3"
}
```

Note: No `version` field in the domain (matches the Permit2 contract's domain separator).

## EIP-712 Types

The payer signs a `PermitWitnessTransferFrom` message that includes the witness:

```solidity
struct TokenPermissions {
    address token;
    uint256 amount;
}

struct PermitWitnessTransferFrom {
    TokenPermissions permitted;
    address spender;       // T402 Permit2 Proxy contract address
    uint256 nonce;
    uint256 deadline;
}

struct Witness {
    address to;            // Transfer destination (resource server / payTo)
    address facilitator;   // Authorized facilitator address
    uint256 validAfter;    // Earliest settlement timestamp
}
```

The full EIP-712 type string used by Permit2:

```
PermitWitnessTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline,Witness witness)TokenPermissions(address token,uint256 amount)Witness(address to,address facilitator,uint256 validAfter)
```

The witness type string passed to `permitWitnessTransferFrom`:

```
Witness witness)TokenPermissions(address token,uint256 amount)Witness(address to,address facilitator,uint256 validAfter)
```

The witness typehash:

```solidity
bytes32 constant WITNESS_TYPEHASH = keccak256(
    "Witness(address to,address facilitator,uint256 validAfter)"
);
```

## Payload Structure

### Base Payload Fields

```typescript
interface Permit2ProxyPayloadV2 {
  permit: {
    permitted: {
      token: string;    // ERC20 token address
      amount: string;   // Maximum permitted amount
    };
    nonce: string;      // Unique nonce (random, non-sequential)
    deadline: string;   // Unix timestamp upper bound
  };
  witness: {
    to: string;              // Transfer destination
    facilitator: string;     // Authorized facilitator address
    validAfter: string;      // Unix timestamp lower bound
  };
  signature: string;  // EIP-712 signature (hex)
  owner: string;      // Token owner address
}
```

### Optional Gasless Fields

When using `settleWithPermit`, the payload includes an additional EIP-2612 permit:

```typescript
interface Permit2ProxyGaslessPayloadV2 extends Permit2ProxyPayloadV2 {
  eip2612Permit: {
    value: string;     // Approval amount (must match permitted.amount)
    deadline: string;  // EIP-2612 permit deadline
    v: number;         // Signature recovery byte
    r: string;         // Signature r component
    s: string;         // Signature s component
  };
}
```

### Example Payload (Exact)

```json
{
  "signature": "0x2d6a7588d6acca505cbf0d9a4a227e0c52c6c34008c8e8986a1283259764173608a2ce6496642e377d6da8dbbf5836e9bd15092f9ecab05ded3d6293af148b571c",
  "permit": {
    "permitted": {
      "token": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "amount": "10000"
    },
    "nonce": "0xf3746613c2d920b5fdabc0856f2aeb2d4f88ee6037b8cc5d04a71a4462f13480",
    "deadline": "1740672154"
  },
  "witness": {
    "to": "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
    "facilitator": "0xFacilitatorAddress",
    "validAfter": "1740672089"
  },
  "owner": "0x857b06519E91e3A54538791bDbb0E22373e36b66"
}
```

### Full PaymentPayload Object (Exact)

```json
{
  "t402Version": 2,
  "resource": {
    "url": "https://api.example.com/premium-data",
    "description": "Access to premium market data",
    "mimeType": "application/json"
  },
  "accepted": {
    "scheme": "permit2-proxy",
    "network": "eip155:8453",
    "amount": "10000",
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "payTo": "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
    "maxTimeoutSeconds": 60,
    "extra": {
      "permit2Address": "0x000000000022D473030F116dDEE9F6B43aC78BA3",
      "proxyAddress": "0xExactPermit2ProxyAddress"
    }
  },
  "payload": {
    "signature": "0x2d6a7588...",
    "permit": {
      "permitted": {
        "token": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "amount": "10000"
      },
      "nonce": "0xf3746613c2d920b5fdabc0856f2aeb2d4f88ee6037b8cc5d04a71a4462f13480",
      "deadline": "1740672154"
    },
    "witness": {
      "to": "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
      "facilitator": "0xFacilitatorAddress",
      "validAfter": "1740672089"
    },
    "owner": "0x857b06519E91e3A54538791bDbb0E22373e36b66"
  }
}
```

## Payment Requirements Extra Fields

The server adds `permit2Address` and `proxyAddress` to the `extra` field:

```json
{
  "extra": {
    "permit2Address": "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    "proxyAddress": "0xExactPermit2ProxyAddress"
  }
}
```

## Client Flow

1. Receive `PaymentRequirements` with `scheme: "permit2-proxy"`
2. Read `proxyAddress` and `permit2Address` from `requirements.extra`
3. Read the facilitator's settlement address from the facilitator endpoint
4. Build the `Witness` struct:
   - `to` = `requirements.payTo`
   - `facilitator` = facilitator's settlement address
   - `validAfter` = `0` (or a future timestamp for time-locked payments)
5. Build the `PermitWitnessTransferFrom` message:
   - `permitted.token` = `requirements.asset`
   - `permitted.amount` = `requirements.amount` (exact) or `requirements.maxAmount` (upto)
   - `spender` = `proxyAddress` (the T402 proxy contract)
   - `nonce` = random 256-bit value
   - `deadline` = `now + maxTimeoutSeconds`
6. Sign the EIP-712 typed data with the **Permit2 domain**
7. Submit the payload with permit, witness, signature, and owner

### Gasless Client Flow (EIP-2612)

If the token supports EIP-2612 and the payer has not yet approved Permit2:

1. Follow steps 1-6 above
2. Additionally sign an EIP-2612 permit:
   - `owner` = payer address
   - `spender` = `permit2Address`
   - `value` = `permitted.amount`
   - `deadline` = appropriate expiry
3. Include `eip2612Permit` in the payload

## Facilitator Flow

### Verify

1. Validate payload structure (permit, witness, signature, owner)
2. Check `scheme` is `permit2-proxy` and `network` matches requirements
3. Verify `permit.permitted.token` matches `requirements.asset`
4. Verify `witness.to` matches `requirements.payTo`
5. Verify `witness.facilitator` matches the facilitator's own settlement address
6. Verify `permit.deadline` is in the future
7. Verify `permit.permitted.amount` >= required amount
8. Check owner's token balance >= required amount
9. Check owner has approved the Permit2 contract (or `eip2612Permit` is provided)
10. Recover the signer from the EIP-712 signature and verify it matches `owner`

### Settle (Exact)

1. Re-verify the payment
2. Call `T402ExactPermit2Proxy.settle()`:

```solidity
function settle(
    IPermit2.PermitTransferFrom calldata permit,
    address owner,
    Witness calldata witness,
    bytes calldata signature
) external nonReentrant;
```

3. The proxy contract:
   - Validates `settlementAmount > 0`, `owner != address(0)`, `witness.to != address(0)`
   - Verifies `msg.sender == witness.facilitator`
   - Verifies `block.timestamp >= witness.validAfter`
   - Computes the witness hash and calls `PERMIT2.permitWitnessTransferFrom()`
   - Emits `Settled(token, from, to, amount, facilitator)`
4. Wait for transaction confirmation

### Settle (Up-to)

1. Re-verify the payment
2. Determine the `settleAmount` (<= `permitted.amount`)
3. Call `T402UptoPermit2Proxy.settle()`:

```solidity
function settle(
    IPermit2.PermitTransferFrom calldata permit,
    uint256 amount,
    address owner,
    Witness calldata witness,
    bytes calldata signature
) external nonReentrant;
```

4. The proxy contract:
   - Verifies `amount <= permit.permitted.amount` (reverts with `AmountExceedsPermitted` otherwise)
   - Proceeds with the same witness validation as exact settlement
5. Wait for transaction confirmation

### Gasless Settlement (settleWithPermit)

For both exact and up-to variants, the facilitator can use `settleWithPermit` to combine EIP-2612 token approval with Permit2 settlement in a single transaction:

```solidity
// Exact variant
function settleWithPermit(
    EIP2612Permit calldata permit2612,
    IPermit2.PermitTransferFrom calldata permit,
    address owner,
    Witness calldata witness,
    bytes calldata signature
) external nonReentrant;

// Up-to variant
function settleWithPermit(
    EIP2612Permit calldata permit2612,
    IPermit2.PermitTransferFrom calldata permit,
    uint256 amount,
    address owner,
    Witness calldata witness,
    bytes calldata signature
) external nonReentrant;
```

The EIP-2612 permit parameters:

```solidity
struct EIP2612Permit {
    uint256 value;     // Must match permitted.amount
    uint256 deadline;  // Permit expiry
    uint8 v;           // Signature component
    bytes32 r;         // Signature component
    bytes32 s;         // Signature component
}
```

The EIP-2612 permit approves the Permit2 contract as spender. If the permit call fails (e.g., approval already exists), the failure is non-fatal — the contract emits `EIP2612PermitFailed` and continues with settlement.

## Nonce Management

Permit2 uses a bitmap-based nonce system that supports non-sequential nonces. Each nonce can only be used once. The client generates a random 256-bit nonce for each payment, avoiding the need for sequential nonce tracking.

## Contract Events

```solidity
/// @notice Emitted on successful settlement
event Settled(
    address indexed token,
    address indexed from,
    address indexed to,
    uint256 amount,
    address facilitator
);

/// @notice Emitted when an optional EIP-2612 permit call fails (non-fatal)
event EIP2612PermitFailed(
    address indexed token,
    address indexed owner,
    bytes reason
);
```

## Contract Errors

| Error | Condition |
|-------|-----------|
| `InvalidPermit2Address()` | Permit2 address is zero (constructor) |
| `InvalidAmount()` | Settlement amount is zero |
| `InvalidOwner()` | Owner address is zero |
| `InvalidDestination()` | Witness `to` address is zero |
| `UnauthorizedFacilitator()` | `msg.sender != witness.facilitator` |
| `PaymentTooEarly()` | `block.timestamp < witness.validAfter` |
| `Permit2612AmountMismatch()` | `permit2612.value != permitted.amount` |
| `AmountExceedsPermitted()` | Settlement amount > permitted amount (up-to only) |

## Security Considerations

### Witness Binding

The witness struct is hashed and included in Permit2's EIP-712 signature verification. This means:

- The payer's signature commits to the exact `to`, `facilitator`, and `validAfter` values
- Modifying any witness field invalidates the signature
- The proxy contract cannot be tricked into using different witness values

### Proxy Contract Security

- Proxy contracts are stateless (hold no funds, no mutable state)
- `nonReentrant` modifier on all external settlement functions
- Immutable reference to the Permit2 contract
- No admin functions, no upgradeability, no pause mechanism

### EIP-2612 Permit Handling

- The `_executePermit` call is wrapped in a try/catch — failure does not block settlement
- Amount mismatch between EIP-2612 `value` and Permit2 `permitted.amount` causes a hard revert (`Permit2612AmountMismatch`)
- The EIP-2612 permit approves the Permit2 contract (not the proxy) as spender

### Facilitator Trust Model

Compared to the plain `permit2` scheme:

| Attack Vector | `permit2` | `permit2-proxy` |
|---------------|-----------|-----------------|
| Facilitator redirects funds | Possible | Prevented (witness `to`) |
| Unauthorized settlement | Any holder of signature | Only bound facilitator |
| Premature settlement | No protection | `validAfter` check |
| Replay attack | Permit2 nonce | Permit2 nonce |

### Supported Tokens

Any ERC-20 token that has been approved to the Permit2 contract. For gasless flows, the token must additionally support EIP-2612.

| Token | Chain | Permit2 | EIP-2612 (gasless) |
|-------|-------|---------|-------------------|
| USDC | Base, Ethereum, Arbitrum | Yes | Yes |
| USDT0 | Base, Ethereum, Arbitrum | Yes | No |
| USDT | Ethereum | Yes | No |

## Reference Implementation

| Contract | Source |
|----------|--------|
| `T402BasePermit2Proxy` | [`/contracts/src/T402BasePermit2Proxy.sol`](/contracts/src/T402BasePermit2Proxy.sol) |
| `T402ExactPermit2Proxy` | [`/contracts/src/T402ExactPermit2Proxy.sol`](/contracts/src/T402ExactPermit2Proxy.sol) |
| `T402UptoPermit2Proxy` | [`/contracts/src/T402UptoPermit2Proxy.sol`](/contracts/src/T402UptoPermit2Proxy.sol) |
