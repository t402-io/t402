# Scheme: `upto` on `EVM`

> **DRAFT**: This specification is a work in progress. Implementation details may change.
> Contributions and feedback welcome.

## Summary

The `upto` scheme on EVM chains uses `EIP-2612` (Permit) combined with a router contract to authorize transfers of **up to** a specified maximum amount. This enables usage-based billing while maintaining trust-minimized settlement through on-chain escrow or direct transfer patterns.

## Architecture

```
┌─────────┐     ┌─────────────┐     ┌──────────────────┐     ┌────────────┐
│ Client  │────▶│ Resource    │────▶│   Facilitator    │────▶│ Blockchain │
│         │     │ Server      │     │                  │     │            │
│ Signs   │     │ Tracks      │     │ Calls Router     │     │ Router     │
│ Permit  │     │ Usage       │     │ Contract         │     │ Contract   │
└─────────┘     └─────────────┘     └──────────────────┘     └────────────┘
```

## Router Contract

A dedicated router contract handles the permit + transfer flow:

```solidity
interface IT402UptoRouter {
    /// @notice Execute a permitted transfer up to the approved amount
    /// @param token The ERC20 token address
    /// @param from The payer address
    /// @param to The recipient address
    /// @param maxAmount Maximum authorized amount (from permit)
    /// @param settleAmount Actual amount to transfer (≤ maxAmount)
    /// @param deadline Permit deadline
    /// @param v Permit signature v
    /// @param r Permit signature r
    /// @param s Permit signature s
    function executeUptoTransfer(
        address token,
        address from,
        address to,
        uint256 maxAmount,
        uint256 settleAmount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}
```

### Contract Addresses

| Chain | Router Address | Status |
|-------|---------------|--------|
| Base Mainnet | TBD | Planned |
| Base Sepolia | TBD | Planned |
| Ethereum Mainnet | TBD | Planned |
| Arbitrum | TBD | Planned |

## PaymentPayload `payload` Field

The `payload` field must contain:

- `signature`: The EIP-2612 permit signature components
- `authorization`: Permit parameters for reconstruction

Example `payload`:

```json
{
  "signature": {
    "v": 28,
    "r": "0x1234567890abcdef...",
    "s": "0xfedcba0987654321..."
  },
  "authorization": {
    "owner": "0x857b06519E91e3A54538791bDbb0E22373e36b66",
    "spender": "0xRouterContractAddress",
    "value": "1000000",
    "deadline": "1740675689",
    "nonce": 5
  }
}
```

Full `PaymentPayload` object:

```json
{
  "t402Version": 2,
  "resource": {
    "url": "https://api.example.com/llm/generate",
    "description": "LLM token generation",
    "mimeType": "text/event-stream"
  },
  "accepted": {
    "scheme": "upto",
    "network": "eip155:8453",
    "maxAmount": "1000000",
    "minAmount": "10000",
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "payTo": "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
    "maxTimeoutSeconds": 300,
    "extra": {
      "name": "USDC",
      "version": "2",
      "routerAddress": "0xRouterContractAddress"
    }
  },
  "payload": {
    "signature": {
      "v": 28,
      "r": "0x1234567890abcdef...",
      "s": "0xfedcba0987654321..."
    },
    "authorization": {
      "owner": "0x857b06519E91e3A54538791bDbb0E22373e36b66",
      "spender": "0xRouterContractAddress",
      "value": "1000000",
      "deadline": "1740675689",
      "nonce": 5
    }
  }
}
```

## Verification

Steps to verify a payment:

1. **Signature Validity**: Verify the EIP-2612 permit signature
2. **Balance Check**: Verify client has sufficient balance for `maxAmount`
3. **Spender Check**: Verify `spender` is the trusted router contract
4. **Time Validity**: Verify `deadline` is in the future
5. **Nonce Check**: Verify nonce matches client's current permit nonce
6. **Amount Bounds**: Verify `value` matches `maxAmount` from requirements
7. **Simulation**: Simulate the router contract call to ensure it would succeed

## Settlement

### Settlement Flow

1. Resource server sends settlement request with `settleAmount`
2. Facilitator verifies `settleAmount` ≤ `maxAmount`
3. Facilitator calls router contract:
   ```solidity
   router.executeUptoTransfer(
       token,
       from,           // client
       to,             // resource server (payTo)
       maxAmount,      // from permit
       settleAmount,   // actual charge
       deadline,
       v, r, s
   );
   ```
4. Router contract:
   - Calls `token.permit(owner, spender, value, deadline, v, r, s)`
   - Calls `token.transferFrom(owner, to, settleAmount)`

### Settlement Response

```json
{
  "success": true,
  "transactionHash": "0x...",
  "settledAmount": "150000",
  "maxAmount": "1000000",
  "blockNumber": 12345678,
  "gasUsed": "85000"
}
```

## Security Considerations

### Router Contract Security

- Router contract MUST be audited
- Router MUST NOT hold any funds
- Router MUST verify facilitator authorization
- Router MUST enforce `settleAmount ≤ maxAmount`

### Permit Security

- Permit signature authorizes router contract only
- Permit can only be used once (nonce consumption)
- Deadline limits exposure window
- Client can revoke allowance if needed

### Facilitator Trust

- Facilitator controls settlement amount within authorized maximum
- Resource server must trust facilitator to settle accurately
- Settlement receipts provide audit trail

## Alternative Implementations

### Escrow Pattern (Higher Trust)

For higher-value transactions, an escrow pattern may be preferred:

1. Client authorizes and funds escrow
2. Resource server provides service
3. Facilitator releases appropriate amount
4. Remaining funds returned to client

This requires additional contract complexity but provides stronger guarantees.

### Direct Permit (Lower Gas)

For simpler cases without the router:

1. Client signs permit with `deadline` before request completes
2. Facilitator must settle before deadline
3. Higher trust in facilitator timing

## Supported Tokens

| Token | Chain | EIP-2612 | Status |
|-------|-------|----------|--------|
| USDC | Base | ✅ | Supported |
| USDC | Ethereum | ✅ | Supported |
| USDC | Arbitrum | ✅ | Supported |
| USDT | * | ❌ | Not supported (no permit) |

<Callout type="warning">
USDT does not support EIP-2612. For USDT `upto` payments, consider USDT0 on supported chains or use `exact` scheme.
</Callout>

## Future Work

1. **Batch Settlement**: Settle multiple `upto` payments in single transaction
2. **Streaming Payments**: Progressive settlement for long-running operations
3. **Escrow Integration**: On-chain escrow for high-value transactions
4. **Cross-chain `upto`**: Authorization on one chain, settlement on another
