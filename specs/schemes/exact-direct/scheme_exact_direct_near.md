# Scheme: `exact-direct` on `NEAR`

## Summary

The `exact-direct` scheme on NEAR uses the NEP-141 fungible token standard's `ft_transfer` function to execute direct token transfers. The client signs and broadcasts the transfer, then provides the transaction hash as proof of payment.

## NEAR Token Standard

NEAR uses NEP-141 (Fungible Token Standard) which is similar to ERC-20 but with some differences:

- **Method**: `ft_transfer(receiver_id, amount, memo)`
- **Deposit**: Requires 1 yoctoNEAR attached deposit for storage
- **Gas**: ~30 TGas for typical transfers

## Token Addresses

| Network | Token | Contract Address |
|---------|-------|------------------|
| Mainnet | USDC | `17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1` |
| Mainnet | USDT | `usdt.tether-token.near` |
| Testnet | USDC | `usdc.fakes.testnet` |

## PaymentPayload `payload` Field

```json
{
  "txHash": "5KzRYGsqNhLz8VLBRQfNrxkJgPm5hZWZLc2YqVXKSqKy",
  "from": "alice.near",
  "to": "merchant.near",
  "amount": "1000000"
}
```

## PaymentRequirements

```json
{
  "scheme": "exact-direct",
  "network": "near:mainnet",
  "amount": "1000000",
  "asset": "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
  "payTo": "merchant.near",
  "maxTimeoutSeconds": 120,
  "extra": {
    "assetSymbol": "USDC",
    "assetDecimals": 6
  }
}
```

## Client Implementation

### JavaScript/TypeScript

```typescript
import { connect, keyStores, utils } from 'near-api-js';

interface NearTransferParams {
  receiverId: string;
  amount: string;
  memo?: string;
}

class NearClient {
  private account: any;
  private tokenContract: string;

  constructor(account: any, tokenContract: string) {
    this.account = account;
    this.tokenContract = tokenContract;
  }

  async executeTransfer(params: NearTransferParams): Promise<string> {
    const result = await this.account.functionCall({
      contractId: this.tokenContract,
      methodName: 'ft_transfer',
      args: {
        receiver_id: params.receiverId,
        amount: params.amount,
        memo: params.memo || null,
      },
      // 1 yoctoNEAR required for storage
      attachedDeposit: '1',
      // 30 TGas for ft_transfer
      gas: '30000000000000',
    });

    return result.transaction.hash;
  }

  async getBalance(accountId: string): Promise<string> {
    const result = await this.account.viewFunction({
      contractId: this.tokenContract,
      methodName: 'ft_balance_of',
      args: { account_id: accountId },
    });
    return result;
  }
}
```

### Browser Wallet Integration

```typescript
// MyNearWallet
async function transferWithMyNearWallet(
  tokenContract: string,
  receiverId: string,
  amount: string,
): Promise<string> {
  if (!window.near) {
    throw new Error('MyNearWallet not installed');
  }

  const result = await window.near.signAndSendTransaction({
    receiverId: tokenContract,
    actions: [
      {
        type: 'FunctionCall',
        params: {
          methodName: 'ft_transfer',
          args: {
            receiver_id: receiverId,
            amount: amount,
          },
          gas: '30000000000000',
          deposit: '1',
        },
      },
    ],
  });

  return result.transaction.hash;
}
```

## Facilitator Implementation

### Transaction Verification (Go)

```go
package facilitator

import (
    "context"
    "encoding/json"
    "fmt"
    "net/http"
)

type NearTransactionResult struct {
    Status struct {
        SuccessValue string `json:"SuccessValue"`
        Failure      any    `json:"Failure"`
    } `json:"status"`
    Transaction struct {
        Hash       string `json:"hash"`
        SignerId   string `json:"signer_id"`
        ReceiverId string `json:"receiver_id"`
        Actions    []struct {
            FunctionCall struct {
                MethodName string          `json:"method_name"`
                Args       json.RawMessage `json:"args"`
                Gas        uint64          `json:"gas"`
                Deposit    string          `json:"deposit"`
            } `json:"FunctionCall"`
        } `json:"actions"`
    } `json:"transaction"`
    TransactionOutcome struct {
        BlockHash string `json:"block_hash"`
    } `json:"transaction_outcome"`
}

func (f *ExactDirectNearScheme) verifyTransaction(
    ctx context.Context,
    txHash string,
    expectedReceiver string,
    expectedAmount string,
    tokenContract string,
) error {
    // Query transaction from NEAR RPC
    tx, err := f.queryTransaction(ctx, txHash)
    if err != nil {
        return fmt.Errorf("failed to query transaction: %w", err)
    }

    // Check transaction succeeded
    if tx.Status.Failure != nil {
        return fmt.Errorf("transaction failed")
    }

    // Verify it was a call to the token contract
    if tx.Transaction.ReceiverId != tokenContract {
        return fmt.Errorf("wrong contract called")
    }

    // Verify ft_transfer method
    if len(tx.Transaction.Actions) == 0 {
        return fmt.Errorf("no actions in transaction")
    }

    action := tx.Transaction.Actions[0]
    if action.FunctionCall.MethodName != "ft_transfer" {
        return fmt.Errorf("wrong method called: %s", action.FunctionCall.MethodName)
    }

    // Parse and verify args
    var args struct {
        ReceiverId string `json:"receiver_id"`
        Amount     string `json:"amount"`
    }
    if err := json.Unmarshal(action.FunctionCall.Args, &args); err != nil {
        return fmt.Errorf("failed to parse args: %w", err)
    }

    if args.ReceiverId != expectedReceiver {
        return fmt.Errorf("wrong receiver: got %s, expected %s", args.ReceiverId, expectedReceiver)
    }

    // Compare amounts (string comparison for big numbers)
    if args.Amount < expectedAmount {
        return fmt.Errorf("insufficient amount: got %s, expected %s", args.Amount, expectedAmount)
    }

    return nil
}

func (f *ExactDirectNearScheme) queryTransaction(ctx context.Context, txHash string) (*NearTransactionResult, error) {
    // NEAR RPC request
    reqBody := map[string]interface{}{
        "jsonrpc": "2.0",
        "id":      "t402",
        "method":  "tx",
        "params": []interface{}{
            txHash,
            "dontcare", // Sender account (not needed for querying)
        },
    }

    body, _ := json.Marshal(reqBody)
    resp, err := http.Post(f.rpcURL, "application/json", bytes.NewReader(body))
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result struct {
        Result NearTransactionResult `json:"result"`
        Error  *struct {
            Message string `json:"message"`
        } `json:"error"`
    }

    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, err
    }

    if result.Error != nil {
        return nil, fmt.Errorf("RPC error: %s", result.Error.Message)
    }

    return &result.Result, nil
}
```

## RPC Endpoints

| Network | Endpoint |
|---------|----------|
| Mainnet | `https://rpc.mainnet.near.org` |
| Testnet | `https://rpc.testnet.near.org` |

### RPC Methods

**Query Transaction**:
```json
{
  "jsonrpc": "2.0",
  "id": "t402",
  "method": "tx",
  "params": ["<tx_hash>", "<sender_account_id>"]
}
```

**Query Token Balance**:
```json
{
  "jsonrpc": "2.0",
  "id": "t402",
  "method": "query",
  "params": {
    "request_type": "call_function",
    "finality": "final",
    "account_id": "<token_contract>",
    "method_name": "ft_balance_of",
    "args_base64": "<base64_encoded_args>"
  }
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `NEAR-001` | Transaction not found |
| `NEAR-002` | Transaction failed |
| `NEAR-003` | Wrong token contract |
| `NEAR-004` | Wrong method (not ft_transfer) |
| `NEAR-005` | Wrong receiver |
| `NEAR-006` | Insufficient amount |
| `NEAR-007` | Transaction too old |
| `NEAR-008` | Transaction already used |

## Gas and Fees

| Operation | Gas | ~Cost (NEAR) |
|-----------|-----|--------------|
| ft_transfer | 30 TGas | ~0.003 NEAR |
| ft_balance_of (view) | 0 | Free |

Note: NEAR gas prices are deterministic (100 Ggas = 0.0001 NEAR).

## Storage Deposit

NEP-141 tokens require storage registration for new recipients. Before transferring to a new account, ensure they have storage:

```typescript
// Check storage balance
const storage = await account.viewFunction({
  contractId: tokenContract,
  methodName: 'storage_balance_of',
  args: { account_id: receiverId },
});

// Register if needed (typically 0.00125 NEAR for USDC)
if (!storage) {
  await account.functionCall({
    contractId: tokenContract,
    methodName: 'storage_deposit',
    args: { account_id: receiverId },
    attachedDeposit: utils.format.parseNearAmount('0.00125'),
  });
}
```

## Finality Considerations

NEAR achieves finality in ~1-2 seconds (1-2 blocks). For most use cases, waiting for 1 block confirmation is sufficient:

```go
func (f *ExactDirectNearScheme) waitForFinality(ctx context.Context, txHash string) error {
    // NEAR transactions are typically finalized within 2 blocks
    // Query with "final" finality to ensure transaction is confirmed
    for i := 0; i < 10; i++ {
        tx, err := f.queryTransaction(ctx, txHash)
        if err == nil && tx.Status.Failure == nil {
            return nil
        }
        time.Sleep(500 * time.Millisecond)
    }
    return fmt.Errorf("transaction not finalized within timeout")
}
```
