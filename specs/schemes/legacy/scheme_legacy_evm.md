# Scheme: `legacy` on `EVM`

## Summary

The `legacy` scheme on EVM chains uses the standard ERC-20 `approve` + `transferFrom` pattern to transfer tokens from the payer to the resource server. This scheme supports tokens that do not implement EIP-3009, such as USDT on BNB Chain and Avalanche.

## PaymentPayload `payload` Field

The `payload` field of the `PaymentPayload` must contain the following fields:

- `approvalTxHash`: The transaction hash of the client's approval transaction.
- `from`: The address that approved the tokens.
- `amount`: The approved amount (must be >= required amount).
- `validUntil`: Unix timestamp until which this payment is valid.

Example `payload`:

```json
{
  "approvalTxHash": "0x8a7b3c4d5e6f7890123456789abcdef0123456789abcdef0123456789abcdef0",
  "from": "0x857b06519E91e3A54538791bDbb0E22373e36b66",
  "amount": "10000000",
  "validUntil": 1740672154
}
```

Full `PaymentPayload` object:

```json
{
  "t402Version": 2,
  "resource": {
    "url": "https://api.example.com/premium-data",
    "description": "Access to premium market data",
    "mimeType": "application/json"
  },
  "accepted": {
    "scheme": "legacy",
    "network": "eip155:56",
    "amount": "10000000",
    "asset": "eip155:56/erc20:0x55d398326f99059fF775485246999027B3197955",
    "payTo": "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
    "maxTimeoutSeconds": 300
  },
  "payload": {
    "approvalTxHash": "0x8a7b3c4d5e6f7890123456789abcdef0123456789abcdef0123456789abcdef0",
    "from": "0x857b06519E91e3A54538791bDbb0E22373e36b66",
    "amount": "10000000",
    "validUntil": 1740672154
  }
}
```

## PaymentRequirements

For the `legacy` scheme, the server MUST include additional information in `extra`:

```json
{
  "scheme": "legacy",
  "network": "eip155:56",
  "amount": "10000000",
  "asset": "eip155:56/erc20:0x55d398326f99059fF775485246999027B3197955",
  "payTo": "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
  "maxTimeoutSeconds": 300,
  "extra": {
    "facilitatorAddress": "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    "tokenSymbol": "USDT",
    "tokenDecimals": 18
  }
}
```

The `facilitatorAddress` is critical - clients MUST approve this address to spend their tokens.

## Client Flow

1. Parse `PaymentRequirements` from 402 response
2. Check if client has sufficient token balance
3. Check current allowance for facilitator address
4. If allowance < required amount:
   - Submit `approve(facilitatorAddress, amount)` transaction
   - Wait for confirmation
5. Construct `PaymentPayload` with approval transaction hash
6. Resubmit request with `X-Payment` header

### Client Code Example (TypeScript)

```typescript
import { createWalletClient, http, parseUnits } from 'viem';
import { bsc } from 'viem/chains';

async function createLegacyPayment(requirements: PaymentRequirements) {
  const { asset, amount, extra } = requirements;
  const facilitatorAddress = extra.facilitatorAddress;

  // Check current allowance
  const currentAllowance = await tokenContract.read.allowance([
    walletAddress,
    facilitatorAddress
  ]);

  // Approve if needed
  let approvalTxHash: string;
  if (currentAllowance < BigInt(amount)) {
    const hash = await walletClient.writeContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [facilitatorAddress, BigInt(amount)]
    });
    await publicClient.waitForTransactionReceipt({ hash });
    approvalTxHash = hash;
  }

  // Create payload
  return {
    approvalTxHash,
    from: walletAddress,
    amount,
    validUntil: Math.floor(Date.now() / 1000) + 300
  };
}
```

## Verification

Steps to verify a payment for the `legacy` scheme:

1. **Verify approval transaction exists**: Query the blockchain to confirm the `approvalTxHash` is a valid, confirmed transaction.

2. **Verify approval target**: Confirm the approval was for the facilitator address.

3. **Verify allowance**: Call `allowance(from, facilitator)` on the token contract to confirm sufficient allowance exists.

4. **Verify balance**: Call `balanceOf(from)` to confirm the client has sufficient tokens.

5. **Verify timing**: Confirm `validUntil` has not passed.

6. **Verify amount**: Confirm the allowance and balance are >= `PaymentRequirements.amount`.

7. **Simulate transfer**: Optionally simulate `transferFrom` to ensure it would succeed.

## Settlement

Settlement is performed by the facilitator calling `transferFrom` on the ERC-20 token contract:

```solidity
function transferFrom(
    address from,    // payload.from
    address to,      // requirements.payTo
    uint256 amount   // requirements.amount
) external returns (bool);
```

### Settlement Code Example (Go)

```go
func (f *LegacyFacilitator) Settle(ctx context.Context, req SettleRequest) (*SettleResponse, error) {
    // Build transferFrom transaction
    data, err := erc20ABI.Pack("transferFrom",
        common.HexToAddress(req.Payload.From),
        common.HexToAddress(req.Requirements.PayTo),
        req.Requirements.Amount,
    )
    if err != nil {
        return nil, err
    }

    // Send transaction
    tx, err := f.client.SendTransaction(ctx, &types.Transaction{
        To:   &tokenAddress,
        Data: data,
    })
    if err != nil {
        return nil, err
    }

    return &SettleResponse{
        TxHash: tx.Hash().Hex(),
        Status: "pending",
    }, nil
}
```

## Supported Networks

| Network | Chain ID | USDT Address | Decimals |
|---------|----------|--------------|----------|
| BNB Chain | 56 | `0x55d398326f99059fF775485246999027B3197955` | 18 |
| Avalanche | 43114 | `0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7` | 6 |
| Fantom | 250 | `0x049d68029688eabf473097a2fc38ef61633a3c7a` | 6 |
| Celo | 42220 | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` | 18 |
| Kaia | 8217 | `0xcee8faf64bb97a73bb51e115aa89c17ffa8dd167` | 6 |

## Error Codes

| Code | Description |
|------|-------------|
| `LEGACY-001` | Approval transaction not found |
| `LEGACY-002` | Insufficient allowance |
| `LEGACY-003` | Insufficient balance |
| `LEGACY-004` | Payment expired (validUntil passed) |
| `LEGACY-005` | Approval not for facilitator address |
| `LEGACY-006` | Transfer simulation failed |

## Appendix

### Gas Considerations

The `legacy` scheme requires clients to pay gas for the approval transaction. Typical gas costs:

| Network | Approval Gas | Estimated Cost (USD) |
|---------|--------------|---------------------|
| BNB Chain | ~46,000 | ~$0.02 |
| Avalanche | ~46,000 | ~$0.05 |
| Fantom | ~46,000 | ~$0.01 |

### Allowance Best Practices

1. **Exact Amounts**: Clients should approve only the exact amount needed, not unlimited (`type(uint256).max`).

2. **Revocation**: After payment, clients may optionally revoke unused allowance by calling `approve(facilitator, 0)`.

3. **Reuse**: If a client has existing allowance from a previous payment, they can skip the approval step.

### Comparison with EIP-3009

| Feature | Legacy | EIP-3009 |
|---------|--------|----------|
| Requires gas from client | Yes (approval) | No |
| Single-use authorization | No (allowance persists) | Yes (nonce-based) |
| Time-bounded | By `validUntil` | By `validBefore` |
| Supported tokens | All ERC-20 | Only EIP-3009 tokens |
