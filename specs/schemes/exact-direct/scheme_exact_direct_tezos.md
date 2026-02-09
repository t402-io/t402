# Scheme: `exact-direct` on `Tezos`

## Summary

The `exact-direct` scheme on Tezos uses the FA2 (TZIP-12) token standard's `transfer` entrypoint to execute direct token transfers. The client signs and broadcasts the transfer, then provides the operation hash as proof of payment. Verification is performed via the TzKT indexer API.

## Tezos Token Standard

Tezos uses FA2 (TZIP-12: Financial Application 2) for fungible and non-fungible tokens:

- **Entrypoint**: `transfer`
- **Parameter**: List of transfer batches `{ from_, txs: [{ to_, token_id, amount }] }`
- **Signature**: Ed25519 (tz1), secp256k1 (tz2), P-256 (tz3)
- **Gas**: Paid in XTZ (mutez)

## Token Addresses

| Network | Token | Contract Address | Token ID |
|---------|-------|------------------|----------|
| Mainnet | USDt | `KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o` | 0 |
| Ghostnet | USDt | `KT1... (TBD)` | 0 |

## PaymentPayload `payload` Field

```json
{
  "opHash": "onZqLKjvYnPNMpFhCtN1fE4Cy7UqgX4W8LjzjQKqn8pYwG9qNuK",
  "from": "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
  "to": "tz1aSkwEot3L2kmUvcoxzjMomb9mvBNuzFK6",
  "amount": "1000000",
  "contractAddress": "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o",
  "tokenId": "0"
}
```

### Field Descriptions

- **opHash**: Operation hash (starts with 'o', 51 characters)
- **from**: Sender's Tezos address (tz1/tz2/tz3)
- **to**: Recipient's Tezos address
- **amount**: Transfer amount in smallest units (6 decimals for USDt)
- **contractAddress**: FA2 contract address (KT1...)
- **tokenId**: Token ID within the FA2 contract (usually "0" for fungible tokens)

## PaymentRequirements

```json
{
  "scheme": "exact-direct",
  "network": "tezos:NetXdQprcVkpaWU",
  "amount": "1000000",
  "asset": "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o:0",
  "payTo": "tz1aSkwEot3L2kmUvcoxzjMomb9mvBNuzFK6",
  "maxTimeoutSeconds": 120,
  "extra": {
    "assetSymbol": "USDt",
    "assetDecimals": 6
  }
}
```

## Client Implementation

### TypeScript (Taquito)

```typescript
import { TezosToolkit } from '@taquito/taquito';
import { InMemorySigner } from '@taquito/signer';

interface TezosTransferParams {
  contractAddress: string;
  tokenId: number;
  to: string;
  amount: number;
}

class TezosClient {
  private tezos: TezosToolkit;

  constructor(rpcUrl: string, privateKey: string) {
    this.tezos = new TezosToolkit(rpcUrl);
    this.tezos.setProvider({
      signer: new InMemorySigner(privateKey),
    });
  }

  async executeTransfer(params: TezosTransferParams): Promise<string> {
    const contract = await this.tezos.contract.at(params.contractAddress);

    // FA2 transfer parameter structure
    const transferParams = [
      {
        from_: await this.tezos.signer.publicKeyHash(),
        txs: [
          {
            to_: params.to,
            token_id: params.tokenId,
            amount: params.amount,
          },
        ],
      },
    ];

    const operation = await contract.methods.transfer(transferParams).send();

    // Wait for 1 confirmation
    await operation.confirmation(1);

    return operation.hash;
  }

  async getBalance(
    contractAddress: string,
    tokenId: number,
    owner: string
  ): Promise<number> {
    const contract = await this.tezos.contract.at(contractAddress);

    const storage: any = await contract.storage();
    const balance = await storage.ledger.get({
      0: owner,
      1: tokenId,
    });

    return balance ? balance.toNumber() : 0;
  }
}

// Usage example
async function payWithTezos() {
  const client = new TezosClient(
    'https://mainnet.api.tez.ie',
    'edsk...' // Your private key
  );

  const opHash = await client.executeTransfer({
    contractAddress: 'KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o',
    tokenId: 0,
    to: 'tz1aSkwEot3L2kmUvcoxzjMomb9mvBNuzFK6',
    amount: 1000000, // 1 USDt (6 decimals)
  });

  console.log('Operation hash:', opHash);
  return opHash;
}
```

### Python (PyTezos)

```python
from pytezos import pytezos

class TezosClient:
    def __init__(self, rpc_url: str, private_key: str):
        self.client = pytezos.using(
            shell=rpc_url,
            key=private_key
        )

    def execute_transfer(
        self,
        contract_address: str,
        token_id: int,
        to: str,
        amount: int
    ) -> str:
        contract = self.client.contract(contract_address)

        # FA2 transfer parameter
        transfer_params = [
            {
                "from_": self.client.key.public_key_hash(),
                "txs": [
                    {
                        "to_": to,
                        "token_id": token_id,
                        "amount": amount,
                    }
                ],
            }
        ]

        operation = contract.transfer(transfer_params).send()
        operation.wait()

        return operation.hash()

    def get_balance(self, contract_address: str, token_id: int, owner: str) -> int:
        contract = self.client.contract(contract_address)
        storage = contract.storage()

        balance = storage["ledger"].get((owner, token_id), 0)
        return balance

# Usage
client = TezosClient(
    rpc_url="https://mainnet.api.tez.ie",
    private_key="edsk..."
)

op_hash = client.execute_transfer(
    contract_address="KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o",
    token_id=0,
    to="tz1aSkwEot3L2kmUvcoxzjMomb9mvBNuzFK6",
    amount=1000000,
)
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
    "strconv"
)

type TzKTOperation struct {
    Hash      string `json:"hash"`
    Level     int    `json:"level"`
    Timestamp string `json:"timestamp"`
    Status    string `json:"status"`
    Sender    struct {
        Address string `json:"address"`
    } `json:"sender"`
    Target struct {
        Address string `json:"address"`
    } `json:"target"`
    Parameter struct {
        Entrypoint string `json:"entrypoint"`
        Value      []struct {
            From string `json:"from_"`
            Txs  []struct {
                To      string `json:"to_"`
                TokenId string `json:"token_id"`
                Amount  string `json:"amount"`
            } `json:"txs"`
        } `json:"value"`
    } `json:"parameter"`
}

func (f *ExactDirectTezosScheme) verifyTransaction(
    ctx context.Context,
    opHash string,
    expectedSender string,
    expectedRecipient string,
    expectedAmount string,
    contractAddress string,
    tokenId string,
) error {
    // Query operation from TzKT indexer
    ops, err := f.queryOperation(ctx, opHash)
    if err != nil {
        return fmt.Errorf("failed to query operation: %w", err)
    }

    if len(ops) == 0 {
        return fmt.Errorf("operation not found")
    }

    // Find the relevant contract call
    var targetOp *TzKTOperation
    for i := range ops {
        if ops[i].Target.Address == contractAddress {
            targetOp = &ops[i]
            break
        }
    }

    if targetOp == nil {
        return fmt.Errorf("no operation found for contract %s", contractAddress)
    }

    // Check operation status
    if targetOp.Status != "applied" {
        return fmt.Errorf("operation status is %s, expected applied", targetOp.Status)
    }

    // Verify sender
    if targetOp.Sender.Address != expectedSender {
        return fmt.Errorf("wrong sender: got %s, expected %s", targetOp.Sender.Address, expectedSender)
    }

    // Verify entrypoint
    if targetOp.Parameter.Entrypoint != "transfer" {
        return fmt.Errorf("wrong entrypoint: got %s, expected transfer", targetOp.Parameter.Entrypoint)
    }

    // Parse FA2 transfer parameter
    if len(targetOp.Parameter.Value) == 0 {
        return fmt.Errorf("empty transfer parameter")
    }

    transfer := targetOp.Parameter.Value[0]

    // Verify sender in parameter
    if transfer.From != expectedSender {
        return fmt.Errorf("wrong from in parameter: got %s, expected %s", transfer.From, expectedSender)
    }

    // Find the relevant transfer in txs array
    var foundTransfer bool
    for _, tx := range transfer.Txs {
        if tx.To == expectedRecipient && tx.TokenId == tokenId {
            // Verify amount
            actualAmount, err := strconv.ParseUint(tx.Amount, 10, 64)
            if err != nil {
                return fmt.Errorf("failed to parse amount: %w", err)
            }

            expectedAmountInt, err := strconv.ParseUint(expectedAmount, 10, 64)
            if err != nil {
                return fmt.Errorf("failed to parse expected amount: %w", err)
            }

            if actualAmount < expectedAmountInt {
                return fmt.Errorf("insufficient amount: got %d, expected %d", actualAmount, expectedAmountInt)
            }

            foundTransfer = true
            break
        }
    }

    if !foundTransfer {
        return fmt.Errorf("no matching transfer found for recipient %s and token %s", expectedRecipient, tokenId)
    }

    return nil
}

func (f *ExactDirectTezosScheme) queryOperation(ctx context.Context, opHash string) ([]TzKTOperation, error) {
    url := fmt.Sprintf("%s/v1/operations/%s", f.indexerURL, opHash)

    req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
    if err != nil {
        return nil, err
    }

    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("indexer error: status %d", resp.StatusCode)
    }

    var ops []TzKTOperation
    if err := json.NewDecoder(resp.Body).Decode(&ops); err != nil {
        return nil, fmt.Errorf("failed to decode response: %w", err)
    }

    return ops, nil
}
```

## RPC/Indexer Endpoints

| Network | TzKT Indexer |
|---------|--------------|
| Mainnet | `https://api.tzkt.io` |
| Ghostnet | `https://api.ghostnet.tzkt.io` |

### Indexer Methods

**Query Operation**:
```
GET /v1/operations/{opHash}
```

**Query Account Operations**:
```
GET /v1/accounts/{address}/operations?type=transaction
```

**Query Contract Storage**:
```
GET /v1/contracts/{address}/storage
```

## Error Codes

| Code | Description |
|------|-------------|
| `TEZOS-001` | Operation not found |
| `TEZOS-002` | Operation failed (not applied) |
| `TEZOS-003` | Wrong sender address |
| `TEZOS-004` | Wrong contract address |
| `TEZOS-005` | Wrong entrypoint (not transfer) |
| `TEZOS-006` | Wrong recipient address |
| `TEZOS-007` | Wrong token ID |
| `TEZOS-008` | Insufficient amount |
| `TEZOS-009` | Operation too old |
| `TEZOS-010` | Operation already used |

## Gas and Fees

| Operation | Gas | Storage | ~Cost (XTZ) |
|-----------|-----|---------|-------------|
| FA2 transfer (existing account) | ~1,500 | 0 | ~0.0003 |
| FA2 transfer (new account) | ~1,500 | ~300 bytes | ~0.08 |

Notes:
- Gas cost: ~0.0001 XTZ per gas unit
- Storage cost: ~0.00025 XTZ per byte
- New accounts require storage allocation (~300 bytes = ~0.075 XTZ)

## Finality Considerations

Tezos uses Tenderbake consensus with deterministic finality:

- **Block time**: ~15 seconds
- **Practical finality**: 2 block confirmations (~30 seconds)
- **Strong finality**: ~30 blocks (~7.5 minutes)

```go
func (f *ExactDirectTezosScheme) waitForFinality(ctx context.Context, opHash string) error {
    // Wait for 2 block confirmations (practical finality)
    const requiredConfirmations = 2

    for i := 0; i < 60; i++ { // 60 * 2s = 2 minute timeout
        ops, err := f.queryOperation(ctx, opHash)
        if err == nil && len(ops) > 0 {
            op := ops[0]

            // Check if enough blocks have passed
            currentLevel, err := f.getCurrentLevel(ctx)
            if err == nil {
                confirmations := currentLevel - op.Level
                if confirmations >= requiredConfirmations {
                    return nil
                }
            }
        }

        time.Sleep(2 * time.Second)
    }

    return fmt.Errorf("operation not finalized within timeout")
}

func (f *ExactDirectTezosScheme) getCurrentLevel(ctx context.Context) (int, error) {
    url := fmt.Sprintf("%s/v1/head", f.indexerURL)

    req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
    if err != nil {
        return 0, err
    }

    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        return 0, err
    }
    defer resp.Body.Close()

    var result struct {
        Level int `json:"level"`
    }

    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return 0, err
    }

    return result.Level, nil
}
```

### Best Practices

1. **Confirmation Strategy**: 2 blocks for payments, 30 blocks for high-value transfers
2. **Status Check**: Always verify `status == "applied"`
3. **Batch Transfers**: FA2 supports batching; verify all transfers in the batch
4. **Indexer Lag**: TzKT may lag 1-2 blocks; wait before querying

## Security Considerations

### Replay Protection

Tezos prevents replay attacks through:
- **Counter**: Each account maintains an incrementing counter
- **Chain ID**: Operations are bound to a specific chain
- **Branch**: Operations reference a recent block hash (expires after ~60 blocks)

### Front-Running Mitigation

- Tezos has no public mempool; operations are sent directly to bakers
- Bakers include operations in order received (FIFO)
- Minimal front-running risk compared to public mempool chains

### Validation Checklist

1. Verify `status == "applied"`
2. Check `target.address` matches token contract
3. Verify `parameter.entrypoint == "transfer"`
4. Validate sender in both operation and parameter
5. Check recipient and token ID in txs array
6. Ensure amount >= expected amount
7. Verify operation timestamp within acceptable range
8. Check operation hasn't been used before (idempotency)

## Common Operation Statuses

| Status | Description |
|--------|-------------|
| `applied` | Operation succeeded |
| `failed` | Operation failed (reverted) |
| `backtracked` | Operation was backtracked (chain reorg) |
| `skipped` | Operation was skipped |

## FA2 Parameter Structure

FA2 transfer parameter is a list of transfers, each containing:

```json
[
  {
    "from_": "tz1...",
    "txs": [
      {
        "to_": "tz1...",
        "token_id": "0",
        "amount": "1000000"
      }
    ]
  }
]
```

Note: A single operation can batch multiple transfers. Verify the correct transfer within the batch.
