# Scheme: `exact-direct` on `Polkadot`

## Summary

The `exact-direct` scheme on Polkadot uses the Assets Pallet to execute direct token transfers on the Asset Hub parachain. The client signs and broadcasts the transfer, then provides the extrinsic hash as proof of payment. Verification is performed via the Subscan indexer API.

## Polkadot Token Standard

Polkadot Asset Hub uses the Assets Pallet for fungible token transfers:

- **Module**: `assets`
- **Calls**: `transfer` or `transfer_keep_alive`
- **Signature**: Sr25519 (default), Ed25519, or ECDSA
- **Gas**: Paid in DOT (or WND for Westend)

## Token Addresses

| Network | Token | Asset ID | Decimals |
|---------|-------|----------|----------|
| Asset Hub (Polkadot) | USDT | 1984 | 6 |
| Asset Hub (Westend) | USDT | 1984 | 6 |

## PaymentPayload `payload` Field

```json
{
  "extrinsicHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "blockHash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  "extrinsicIndex": "2",
  "from": "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
  "to": "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
  "amount": "1000000",
  "assetId": "1984"
}
```

### Field Descriptions

- **extrinsicHash**: Extrinsic hash (0x + 64 hex characters)
- **blockHash**: Block hash containing the extrinsic (0x + 64 hex)
- **extrinsicIndex**: Index of extrinsic within the block
- **from**: Sender's SS58 address
- **to**: Recipient's SS58 address
- **amount**: Transfer amount in smallest units (6 decimals for USDT)
- **assetId**: Asset ID in the Assets Pallet

## PaymentRequirements

```json
{
  "scheme": "exact-direct",
  "network": "polkadot:68d56f15f85d3136970ec16946040bc1",
  "amount": "1000000",
  "asset": "1984",
  "payTo": "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
  "maxTimeoutSeconds": 120,
  "extra": {
    "assetSymbol": "USDT",
    "assetDecimals": 6
  }
}
```

## Client Implementation

### TypeScript (Polkadot.js)

```typescript
import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import { cryptoWaitReady } from '@polkadot/util-crypto';

interface PolkadotTransferParams {
  assetId: number;
  to: string;
  amount: string;
}

class PolkadotClient {
  private api: ApiPromise;
  private keyring: Keyring;
  private sender: any;

  constructor(wsUrl: string, mnemonic: string) {
    this.keyring = new Keyring({ type: 'sr25519' });
  }

  async initialize(wsUrl: string, mnemonic: string) {
    await cryptoWaitReady();

    const provider = new WsProvider(wsUrl);
    this.api = await ApiPromise.create({ provider });

    this.sender = this.keyring.addFromMnemonic(mnemonic);
  }

  async executeTransfer(params: PolkadotTransferParams): Promise<{
    extrinsicHash: string;
    blockHash: string;
    extrinsicIndex: number;
  }> {
    return new Promise(async (resolve, reject) => {
      try {
        // Create transfer extrinsic
        const transfer = this.api.tx.assets.transfer(
          params.assetId,
          params.to,
          params.amount
        );

        // Sign and send
        const unsub = await transfer.signAndSend(
          this.sender,
          ({ status, txHash, events }) => {
            if (status.isInBlock) {
              const blockHash = status.asInBlock.toString();

              // Find extrinsic index
              this.api.rpc.chain.getBlock(blockHash).then((block) => {
                const extrinsicIndex = block.block.extrinsics.findIndex(
                  (ext) => ext.hash.toString() === txHash.toString()
                );

                unsub();

                resolve({
                  extrinsicHash: txHash.toString(),
                  blockHash,
                  extrinsicIndex,
                });
              });
            } else if (status.isFinalized) {
              // Already resolved in isInBlock
            }
          }
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  async getBalance(assetId: number, address: string): Promise<string> {
    const account = await this.api.query.assets.account(assetId, address);

    if (account.isSome) {
      const balance = account.unwrap().balance;
      return balance.toString();
    }

    return '0';
  }

  async disconnect() {
    await this.api.disconnect();
  }
}

// Usage example
async function payWithPolkadot() {
  const client = new PolkadotClient(
    'wss://polkadot-asset-hub-rpc.polkadot.io',
    'your twelve word mnemonic phrase here...'
  );

  await client.initialize(
    'wss://polkadot-asset-hub-rpc.polkadot.io',
    'your twelve word mnemonic phrase here...'
  );

  const result = await client.executeTransfer({
    assetId: 1984,
    to: '14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3',
    amount: '1000000', // 1 USDT (6 decimals)
  });

  console.log('Extrinsic hash:', result.extrinsicHash);
  console.log('Block hash:', result.blockHash);
  console.log('Extrinsic index:', result.extrinsicIndex);

  await client.disconnect();

  return result;
}
```

### Python (substrate-interface)

```python
from substrateinterface import SubstrateInterface, Keypair

class PolkadotClient:
    def __init__(self, ws_url: str, mnemonic: str):
        self.substrate = SubstrateInterface(url=ws_url)
        self.keypair = Keypair.create_from_mnemonic(mnemonic)

    def execute_transfer(self, asset_id: int, to: str, amount: int) -> dict:
        call = self.substrate.compose_call(
            call_module='Assets',
            call_function='transfer',
            call_params={
                'id': asset_id,
                'target': to,
                'amount': amount,
            }
        )

        extrinsic = self.substrate.create_signed_extrinsic(
            call=call,
            keypair=self.keypair
        )

        receipt = self.substrate.submit_extrinsic(
            extrinsic,
            wait_for_inclusion=True
        )

        return {
            'extrinsic_hash': receipt.extrinsic_hash,
            'block_hash': receipt.block_hash,
            'extrinsic_index': receipt.extrinsic_idx,
        }

    def get_balance(self, asset_id: int, address: str) -> int:
        result = self.substrate.query(
            module='Assets',
            storage_function='Account',
            params=[asset_id, address]
        )

        if result.value:
            return result.value['balance']

        return 0

# Usage
client = PolkadotClient(
    ws_url="wss://polkadot-asset-hub-rpc.polkadot.io",
    mnemonic="your twelve word mnemonic phrase here..."
)

result = client.execute_transfer(
    asset_id=1984,
    to="14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
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

type SubscanExtrinsic struct {
    Data struct {
        ExtrinsicIndex string `json:"extrinsic_index"`
        BlockNum       int    `json:"block_num"`
        BlockHash      string `json:"block_hash"`
        Success        bool   `json:"success"`
        Hash           string `json:"hash"`
        Call           struct {
            CallModule   string `json:"call_module"`
            CallFunction string `json:"call_function"`
        } `json:"call"`
        AccountDisplay struct {
            Address string `json:"address"`
        } `json:"account_display"`
        Params []struct {
            Name  string `json:"name"`
            Type  string `json:"type"`
            Value any    `json:"value"`
        } `json:"params"`
    } `json:"data"`
}

func (f *ExactDirectPolkadotScheme) verifyTransaction(
    ctx context.Context,
    extrinsicHash string,
    expectedSender string,
    expectedRecipient string,
    expectedAmount string,
    assetId string,
) error {
    // Query extrinsic from Subscan
    ext, err := f.queryExtrinsic(ctx, extrinsicHash)
    if err != nil {
        return fmt.Errorf("failed to query extrinsic: %w", err)
    }

    // Check extrinsic succeeded
    if !ext.Data.Success {
        return fmt.Errorf("extrinsic failed")
    }

    // Verify sender
    if ext.Data.AccountDisplay.Address != expectedSender {
        return fmt.Errorf("wrong sender: got %s, expected %s", ext.Data.AccountDisplay.Address, expectedSender)
    }

    // Verify module and function
    if ext.Data.Call.CallModule != "Assets" {
        return fmt.Errorf("wrong module: got %s, expected Assets", ext.Data.Call.CallModule)
    }

    allowedFunctions := []string{"transfer", "transfer_keep_alive"}
    if ext.Data.Call.CallFunction != "transfer" && ext.Data.Call.CallFunction != "transfer_keep_alive" {
        return fmt.Errorf("wrong function: got %s, expected transfer or transfer_keep_alive", ext.Data.Call.CallFunction)
    }

    // Parse and verify parameters
    var foundAssetId, foundTarget, foundAmount bool
    var actualAmount uint64

    for _, param := range ext.Data.Params {
        switch param.Name {
        case "id":
            // Asset ID can be a number or string
            var paramAssetId string
            switch v := param.Value.(type) {
            case string:
                paramAssetId = v
            case float64:
                paramAssetId = strconv.FormatInt(int64(v), 10)
            default:
                paramAssetId = fmt.Sprintf("%v", v)
            }

            if paramAssetId != assetId {
                return fmt.Errorf("wrong asset ID: got %s, expected %s", paramAssetId, assetId)
            }
            foundAssetId = true

        case "target":
            var targetAddr string
            switch v := param.Value.(type) {
            case string:
                targetAddr = v
            case map[string]interface{}:
                if id, ok := v["Id"].(string); ok {
                    targetAddr = id
                }
            }

            if targetAddr != expectedRecipient {
                return fmt.Errorf("wrong recipient: got %s, expected %s", targetAddr, expectedRecipient)
            }
            foundTarget = true

        case "amount":
            var err error
            switch v := param.Value.(type) {
            case string:
                actualAmount, err = strconv.ParseUint(v, 10, 64)
            case float64:
                actualAmount = uint64(v)
            default:
                err = fmt.Errorf("unknown amount type: %T", v)
            }

            if err != nil {
                return fmt.Errorf("failed to parse amount: %w", err)
            }
            foundAmount = true
        }
    }

    if !foundAssetId {
        return fmt.Errorf("asset ID not found in parameters")
    }
    if !foundTarget {
        return fmt.Errorf("target not found in parameters")
    }
    if !foundAmount {
        return fmt.Errorf("amount not found in parameters")
    }

    // Verify amount
    expectedAmountInt, err := strconv.ParseUint(expectedAmount, 10, 64)
    if err != nil {
        return fmt.Errorf("failed to parse expected amount: %w", err)
    }

    if actualAmount < expectedAmountInt {
        return fmt.Errorf("insufficient amount: got %d, expected %d", actualAmount, expectedAmountInt)
    }

    return nil
}

func (f *ExactDirectPolkadotScheme) queryExtrinsic(ctx context.Context, extrinsicHash string) (*SubscanExtrinsic, error) {
    url := fmt.Sprintf("%s/api/v2/scan/extrinsic", f.indexerURL)

    payload := map[string]interface{}{
        "hash": extrinsicHash,
    }

    body, _ := json.Marshal(payload)
    req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
    if err != nil {
        return nil, err
    }

    req.Header.Set("Content-Type", "application/json")

    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("indexer error: status %d", resp.StatusCode)
    }

    var result SubscanExtrinsic
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, fmt.Errorf("failed to decode response: %w", err)
    }

    return &result, nil
}
```

## RPC/Indexer Endpoints

| Network | Subscan Indexer |
|---------|-----------------|
| Asset Hub (Polkadot) | `https://assethub-polkadot.api.subscan.io` |
| Asset Hub (Westend) | `https://assethub-westend.api.subscan.io` |

| Network | WebSocket RPC |
|---------|---------------|
| Asset Hub (Polkadot) | `wss://polkadot-asset-hub-rpc.polkadot.io` |
| Asset Hub (Westend) | `wss://westend-asset-hub-rpc.polkadot.io` |

### Indexer Methods

**Query Extrinsic**:
```
POST /api/v2/scan/extrinsic
Body: { "hash": "0x..." }
```

**Query Account Balance**:
```
POST /api/scan/account/tokens
Body: { "address": "...", "asset_id": 1984 }
```

## Error Codes

| Code | Description |
|------|-------------|
| `POLKADOT-001` | Extrinsic not found |
| `POLKADOT-002` | Extrinsic failed |
| `POLKADOT-003` | Wrong sender address |
| `POLKADOT-004` | Wrong module (not Assets) |
| `POLKADOT-005` | Wrong function (not transfer) |
| `POLKADOT-006` | Wrong asset ID |
| `POLKADOT-007` | Wrong recipient address |
| `POLKADOT-008` | Insufficient amount |
| `POLKADOT-009` | Extrinsic too old |
| `POLKADOT-010` | Extrinsic already used |

## Gas and Fees

| Operation | Weight | ~Cost (DOT) |
|-----------|--------|-------------|
| assets::transfer | ~100M | ~0.01 DOT |
| assets::transfer_keep_alive | ~100M | ~0.01 DOT |

Notes:
- Weight is converted to fees based on current fee multiplier
- Asset Hub has lower fees than Polkadot Relay Chain
- Typical transfer: ~0.01 DOT (~$0.06 at $6/DOT)

## Finality Considerations

Polkadot uses GRANDPA finality gadget for deterministic finality:

- **Block time**: ~12 seconds
- **Finality**: ~2-3 blocks (~24-36 seconds)
- **Irreversible**: Once finalized, blocks cannot be reverted

```go
func (f *ExactDirectPolkadotScheme) waitForFinality(ctx context.Context, extrinsicHash string) error {
    // Wait for finalization (typically 2-3 blocks)
    for i := 0; i < 30; i++ { // 30 * 2s = 1 minute timeout
        ext, err := f.queryExtrinsic(ctx, extrinsicHash)
        if err == nil && ext.Data.Success {
            // Check if block is finalized
            // In practice, if Subscan returns the extrinsic, it's already finalized
            return nil
        }

        time.Sleep(2 * time.Second)
    }

    return fmt.Errorf("extrinsic not finalized within timeout")
}
```

### Best Practices

1. **Finality Check**: Wait for 2-3 block confirmations
2. **Success Verification**: Always check `success: true`
3. **Transfer Type**: Use `transfer_keep_alive` to ensure sender keeps min balance
4. **Existential Deposit**: Recipient must have at least 0.1 DOT to receive assets

## Security Considerations

### Replay Protection

Polkadot prevents replay attacks through:
- **Nonce**: Each account maintains an incrementing nonce
- **Era**: Extrinsics expire after a specified number of blocks (mortality period)
- **Genesis Hash**: Extrinsics are bound to a specific chain

### Front-Running Mitigation

- Polkadot has no public mempool; transactions are sent to validators
- Validators include extrinsics based on priority (fee/weight ratio)
- Limited front-running risk due to private mempool

### Validation Checklist

1. Verify `success == true`
2. Check `call_module == "Assets"`
3. Verify `call_function` is "transfer" or "transfer_keep_alive"
4. Validate sender address
5. Check asset ID matches expected asset
6. Verify recipient address (may be in `Id` field)
7. Ensure amount >= expected amount
8. Verify extrinsic timestamp within acceptable range
9. Check extrinsic hasn't been used before (idempotency)

## Common Errors

| Error | Description |
|-------|-------------|
| `BalanceLow` | Sender has insufficient balance |
| `NoAccount` | Recipient account doesn't exist |
| `Frozen` | Asset is frozen |
| `Unknown` | Asset ID doesn't exist |
| `WouldDie` | Transfer would kill sender account (use transfer_keep_alive) |

## SS58 Address Format

Polkadot uses SS58 address encoding with different prefixes:

| Network | Prefix | Address Example |
|---------|--------|-----------------|
| Polkadot | 0 | `1...` or `12...` or `13...` or `14...` or `15...` |
| Westend | 42 | `5...` |

Ensure addresses use the correct network prefix.

## Parameter Structure

Assets pallet parameters:

```json
{
  "params": [
    {
      "name": "id",
      "value": "1984"
    },
    {
      "name": "target",
      "value": {
        "Id": "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3"
      }
    },
    {
      "name": "amount",
      "value": "1000000"
    }
  ]
}
```

Note: Target may be a string or an object with an `Id` field. Handle both cases.
