# Scheme: `exact-direct`

## Summary

The `exact-direct` scheme is designed for blockchain networks that don't support authorization-based transfers (like EIP-3009). Instead, the client executes the transfer directly and provides the transaction hash as proof of payment.

## Supported Networks

| Network | Standard | Status |
|---------|----------|--------|
| Near | NEP-141 | Supported |
| Aptos | Move Coin | Planned |
| Tezos | FA2 | Planned |
| Polkadot | Assets Pallet | Planned |

## Payment Flow

```
┌─────────┐     ┌─────────┐     ┌─────────────┐     ┌─────────────┐
│ Client  │────▶│ Server  │────▶│ Facilitator │────▶│ Blockchain  │
└─────────┘     └─────────┘     └─────────────┘     └─────────────┘
     │               │                 │                   │
     │  1. Request   │                 │                   │
     │──────────────▶│                 │                   │
     │               │                 │                   │
     │  2. 402 + Requirements          │                   │
     │◀──────────────│                 │                   │
     │               │                 │                   │
     │  3. Execute transfer (client signs & broadcasts)    │
     │─────────────────────────────────────────────────────▶
     │               │                 │                   │
     │  4. Submit tx hash              │                   │
     │──────────────▶│                 │                   │
     │               │                 │                   │
     │               │  5. Verify tx   │                   │
     │               │────────────────▶│                   │
     │               │                 │                   │
     │               │                 │  6. Query tx      │
     │               │                 │──────────────────▶│
     │               │                 │                   │
     │               │                 │  7. Tx details    │
     │               │                 │◀──────────────────│
     │               │                 │                   │
     │               │  8. Verified    │                   │
     │               │◀────────────────│                   │
     │               │                 │                   │
     │  9. Resource  │                 │                   │
     │◀──────────────│                 │                   │
```

## PaymentPayload `payload` Field

The `payload` field of the `PaymentPayload` must contain:

- `txHash`: The transaction hash of the completed transfer
- `from`: The sender's address/account ID
- `to`: The recipient's address/account ID (should match `payTo`)
- `amount`: The transfer amount (in smallest unit)

Example `payload`:

```json
{
  "txHash": "5KzRYGsqNhLz8VLBRQfNrxkJgPm5hZWZLc2YqVXKSqKy",
  "from": "alice.near",
  "to": "merchant.near",
  "amount": "1000000"
}
```

Full `PaymentPayload` object:

```json
{
  "t402Version": 2,
  "resource": {
    "url": "https://api.example.com/premium-content",
    "description": "Access to premium content",
    "mimeType": "application/json"
  },
  "accepted": {
    "scheme": "exact-direct",
    "network": "near:mainnet",
    "amount": "1000000",
    "asset": "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
    "payTo": "merchant.near",
    "maxTimeoutSeconds": 300
  },
  "payload": {
    "txHash": "5KzRYGsqNhLz8VLBRQfNrxkJgPm5hZWZLc2YqVXKSqKy",
    "from": "alice.near",
    "to": "merchant.near",
    "amount": "1000000"
  }
}
```

## PaymentRequirements

For the `exact-direct` scheme on Near:

```json
{
  "scheme": "exact-direct",
  "network": "near:mainnet",
  "amount": "1000000",
  "asset": "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
  "payTo": "merchant.near",
  "maxTimeoutSeconds": 300,
  "extra": {
    "assetSymbol": "USDC",
    "assetDecimals": 6
  }
}
```

## Client Flow

1. Parse `PaymentRequirements` from 402 response
2. Connect to wallet (MyNearWallet, Meteor, etc.)
3. Check if client has sufficient token balance
4. Execute `ft_transfer` function call on token contract
5. Wait for transaction confirmation
6. Construct `PaymentPayload` with transaction hash
7. Resubmit request with `X-Payment` header

### Client Code Example (TypeScript)

```typescript
import { connect, keyStores, utils } from 'near-api-js';

async function createDirectPayment(requirements: PaymentRequirements) {
  const { asset, amount, payTo, network } = requirements;

  // Connect to wallet
  const near = await connect({
    networkId: network === 'near:mainnet' ? 'mainnet' : 'testnet',
    keyStore: new keyStores.BrowserLocalStorageKeyStore(),
    nodeUrl: 'https://rpc.mainnet.near.org',
  });

  const account = await near.account('user.near');

  // Execute ft_transfer
  const result = await account.functionCall({
    contractId: asset,
    methodName: 'ft_transfer',
    args: {
      receiver_id: payTo,
      amount: amount,
      memo: 't402 payment',
    },
    attachedDeposit: utils.format.parseNearAmount('0.000000000000000000000001'), // 1 yoctoNEAR
    gas: '30000000000000', // 30 TGas
  });

  return {
    txHash: result.transaction.hash,
    from: account.accountId,
    to: payTo,
    amount,
  };
}
```

## Verification

Steps to verify a payment for the `exact-direct` scheme:

1. **Verify transaction exists**: Query the blockchain for the transaction by hash
2. **Verify transaction succeeded**: Check that the transaction status is successful
3. **Verify recipient**: Confirm the transfer was to `requirements.payTo`
4. **Verify amount**: Confirm the transferred amount >= `requirements.amount`
5. **Verify token**: Confirm the transfer was for the correct token contract
6. **Verify timing**: Confirm the transaction was recent (within `maxTimeoutSeconds`)
7. **Verify uniqueness**: Check that this txHash hasn't been used before (prevent replay)

### Verification Code Example (Go)

```go
func (f *ExactDirectNearScheme) Verify(ctx context.Context, payload PaymentPayload, requirements PaymentRequirements) (*VerifyResponse, error) {
    // Query transaction
    tx, err := f.client.GetTransaction(ctx, payload.TxHash)
    if err != nil {
        return nil, NewVerifyError("transaction_not_found", payload.From, requirements.Network, err)
    }

    // Verify success
    if tx.Status != "SUCCESS" {
        return nil, NewVerifyError("transaction_failed", payload.From, requirements.Network, nil)
    }

    // Verify recipient and amount from transaction receipts
    for _, receipt := range tx.Receipts {
        if receipt.ReceiverId == requirements.Asset {
            // Parse ft_transfer action
            if receipt.Actions[0].FunctionCall.MethodName == "ft_transfer" {
                args := receipt.Actions[0].FunctionCall.Args
                if args.ReceiverId == requirements.PayTo && args.Amount >= requirements.Amount {
                    return &VerifyResponse{IsValid: true, Payer: payload.From}, nil
                }
            }
        }
    }

    return nil, NewVerifyError("invalid_transfer", payload.From, requirements.Network, nil)
}
```

## Settlement

For `exact-direct` scheme, settlement is already complete when the client executes the transfer. The facilitator only needs to verify that the transaction occurred correctly. No additional on-chain action is required.

## Error Codes

| Code | Description |
|------|-------------|
| `DIRECT-001` | Transaction not found |
| `DIRECT-002` | Transaction failed/reverted |
| `DIRECT-003` | Invalid recipient |
| `DIRECT-004` | Insufficient amount |
| `DIRECT-005` | Wrong token contract |
| `DIRECT-006` | Transaction too old |
| `DIRECT-007` | Transaction already used (replay) |

## Security Considerations

### Replay Protection

The facilitator MUST track used transaction hashes to prevent replay attacks. Each txHash can only be used once for payment verification.

### Transaction Finality

Different networks have different finality guarantees:

| Network | Finality | Recommended Wait |
|---------|----------|------------------|
| Near | 1-2 blocks (~1-2s) | 2 blocks |
| Aptos | Instant finality | 1 block |
| Tezos | ~30 blocks (~30 min) | 30 blocks |

### Front-Running

Since the transfer is executed before verification, there's no front-running risk for the payer. However, the server should verify quickly to provide good UX.

## Comparison with Authorization Schemes

| Feature | exact-direct | exact (EIP-3009) |
|---------|--------------|------------------|
| Gas paid by | Client | Facilitator |
| Transfer timing | Before verification | After verification |
| Can be cancelled | No | Yes (before settlement) |
| Replay protection | txHash tracking | Nonce-based |
| Settlement required | No | Yes |
