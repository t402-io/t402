# Scheme: `exact-direct` on `Cosmos`

## Summary

The `exact-direct` scheme on Cosmos uses the Bank Module's `MsgSend` message to execute direct token transfers. The client signs and broadcasts the transfer, then provides the transaction hash as proof of payment. Noble is a purpose-built Cosmos chain for native USDC issuance.

## Cosmos Token Standard

Cosmos uses the Bank Module for native token transfers:

- **Module**: `cosmos.bank.v1beta1`
- **Message**: `MsgSend`
- **Signature**: secp256k1
- **Gas**: Paid in the chain's native token (USDC on Noble)

## Token Addresses

| Network | Token | Denomination | Decimals |
|---------|-------|--------------|----------|
| Noble Mainnet | USDC | `uusdc` | 6 |
| Noble Testnet (Grand) | USDC | `uusdc` | 6 |

Note: "uusdc" means micro-USDC (1 USDC = 1,000,000 uusdc).

## PaymentPayload `payload` Field

```json
{
  "txHash": "A1B2C3D4E5F67890A1B2C3D4E5F67890A1B2C3D4E5F67890A1B2C3D4E5F67890",
  "from": "noble1abc123def456ghi789jkl012mno345pqr678st",
  "to": "noble1xyz789abc456def123ghi890jkl567mno234pq",
  "amount": "1000000",
  "denom": "uusdc"
}
```

### Field Descriptions

- **txHash**: Transaction hash (64 hex characters, uppercase, no 0x prefix)
- **from**: Sender's Bech32 address (noble1... prefix)
- **to**: Recipient's Bech32 address (noble1... prefix)
- **amount**: Transfer amount in smallest units (micro-USDC)
- **denom**: Token denomination (default: "uusdc")

## PaymentRequirements

```json
{
  "scheme": "exact-direct",
  "network": "cosmos:noble-1",
  "amount": "1000000",
  "asset": "uusdc",
  "payTo": "noble1xyz789abc456def123ghi890jkl567mno234pq",
  "maxTimeoutSeconds": 60,
  "extra": {
    "assetSymbol": "USDC",
    "assetDecimals": 6
  }
}
```

## Client Implementation

### TypeScript (CosmJS)

```typescript
import { SigningStargateClient, GasPrice } from '@cosmjs/stargate';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';

interface CosmosTransferParams {
  to: string;
  amount: string;
  denom: string;
}

class CosmosClient {
  private client: SigningStargateClient | null = null;
  private wallet: DirectSecp256k1HdWallet;
  private senderAddress: string = '';

  constructor(mnemonic: string, prefix: string = 'noble') {
    this.prefix = prefix;
    this.mnemonic = mnemonic;
  }

  async initialize(rpcUrl: string) {
    // Create wallet from mnemonic
    this.wallet = await DirectSecp256k1HdWallet.fromMnemonic(
      this.mnemonic,
      { prefix: this.prefix }
    );

    // Get sender address
    const [account] = await this.wallet.getAccounts();
    this.senderAddress = account.address;

    // Connect to chain
    this.client = await SigningStargateClient.connectWithSigner(
      rpcUrl,
      this.wallet,
      {
        gasPrice: GasPrice.fromString('0.025uusdc'),
      }
    );
  }

  async executeTransfer(params: CosmosTransferParams): Promise<string> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const amount = {
      denom: params.denom,
      amount: params.amount,
    };

    const result = await this.client.sendTokens(
      this.senderAddress,
      params.to,
      [amount],
      'auto',
      '' // memo
    );

    if (result.code !== 0) {
      throw new Error(`Transaction failed: ${result.rawLog}`);
    }

    return result.transactionHash;
  }

  async getBalance(address: string, denom: string): Promise<string> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const balance = await this.client.getBalance(address, denom);
    return balance.amount;
  }

  getSenderAddress(): string {
    return this.senderAddress;
  }
}

// Usage example
async function payWithCosmos() {
  const client = new CosmosClient(
    'your twelve word mnemonic phrase here...',
    'noble'
  );

  await client.initialize('https://noble-api.polkachu.com:443');

  const txHash = await client.executeTransfer({
    to: 'noble1xyz789abc456def123ghi890jkl567mno234pq',
    amount: '1000000', // 1 USDC (6 decimals)
    denom: 'uusdc',
  });

  console.log('Transaction hash:', txHash);
  return txHash;
}
```

### Python (cosmpy)

```python
from cosmpy.aerial.client import LedgerClient
from cosmpy.aerial.wallet import LocalWallet
from cosmpy.crypto.keypairs import PrivateKey

class CosmosClient:
    def __init__(self, mnemonic: str, chain_id: str = "noble-1", prefix: str = "noble"):
        self.wallet = LocalWallet.from_mnemonic(mnemonic, prefix=prefix)
        self.client = None
        self.chain_id = chain_id

    def initialize(self, grpc_url: str):
        self.client = LedgerClient(grpc_url)

    def execute_transfer(self, to: str, amount: int, denom: str = "uusdc") -> str:
        tx = self.client.send_tokens(
            destination=to,
            amount=amount,
            denom=denom,
            sender=self.wallet
        )

        if tx.code != 0:
            raise Exception(f"Transaction failed: {tx.raw_log}")

        return tx.tx_hash

    def get_balance(self, address: str, denom: str = "uusdc") -> int:
        balance = self.client.query_bank_balance(address, denom)
        return balance

    def get_sender_address(self) -> str:
        return str(self.wallet.address())

# Usage
client = CosmosClient(
    mnemonic="your twelve word mnemonic phrase here...",
    chain_id="noble-1",
    prefix="noble"
)

client.initialize(grpc_url="noble-api.polkachu.com:443")

tx_hash = client.execute_transfer(
    to="noble1xyz789abc456def123ghi890jkl567mno234pq",
    amount=1000000,  # 1 USDC
    denom="uusdc",
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

type CosmosTxResponse struct {
    TxResponse struct {
        Height    string `json:"height"`
        TxHash    string `json:"txhash"`
        Code      int    `json:"code"`
        RawLog    string `json:"raw_log"`
        Logs      []struct {
            Events []struct {
                Type       string `json:"type"`
                Attributes []struct {
                    Key   string `json:"key"`
                    Value string `json:"value"`
                } `json:"attributes"`
            } `json:"events"`
        } `json:"logs"`
        GasWanted string `json:"gas_wanted"`
        GasUsed   string `json:"gas_used"`
        Tx        struct {
            Body struct {
                Messages []struct {
                    Type        string `json:"@type"`
                    FromAddress string `json:"from_address"`
                    ToAddress   string `json:"to_address"`
                    Amount      []struct {
                        Denom  string `json:"denom"`
                        Amount string `json:"amount"`
                    } `json:"amount"`
                } `json:"messages"`
            } `json:"body"`
        } `json:"tx"`
    } `json:"tx_response"`
}

func (f *ExactDirectCosmosScheme) verifyTransaction(
    ctx context.Context,
    txHash string,
    expectedSender string,
    expectedRecipient string,
    expectedAmount string,
    denom string,
) error {
    // Query transaction from REST API
    tx, err := f.queryTransaction(ctx, txHash)
    if err != nil {
        return fmt.Errorf("failed to query transaction: %w", err)
    }

    // Check transaction succeeded
    if tx.TxResponse.Code != 0 {
        return fmt.Errorf("transaction failed with code %d: %s", tx.TxResponse.Code, tx.TxResponse.RawLog)
    }

    // Find MsgSend message
    var foundMessage bool
    for _, msg := range tx.TxResponse.Tx.Body.Messages {
        if msg.Type != "/cosmos.bank.v1beta1.MsgSend" {
            continue
        }

        // Verify sender
        if msg.FromAddress != expectedSender {
            return fmt.Errorf("wrong sender: got %s, expected %s", msg.FromAddress, expectedSender)
        }

        // Verify recipient
        if msg.ToAddress != expectedRecipient {
            return fmt.Errorf("wrong recipient: got %s, expected %s", msg.ToAddress, expectedRecipient)
        }

        // Find amount with correct denom
        var foundAmount bool
        for _, coin := range msg.Amount {
            if coin.Denom != denom {
                continue
            }

            actualAmount, err := strconv.ParseUint(coin.Amount, 10, 64)
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

            foundAmount = true
            break
        }

        if !foundAmount {
            return fmt.Errorf("amount with denom %s not found", denom)
        }

        foundMessage = true
        break
    }

    if !foundMessage {
        return fmt.Errorf("no MsgSend message found in transaction")
    }

    return nil
}

func (f *ExactDirectCosmosScheme) queryTransaction(ctx context.Context, txHash string) (*CosmosTxResponse, error) {
    url := fmt.Sprintf("%s/cosmos/tx/v1beta1/txs/%s", f.restURL, txHash)

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
        return nil, fmt.Errorf("REST API error: status %d", resp.StatusCode)
    }

    var result CosmosTxResponse
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, fmt.Errorf("failed to decode response: %w", err)
    }

    return &result, nil
}

// Alternative: verify via transfer events
func (f *ExactDirectCosmosScheme) verifyTransferEvent(
    ctx context.Context,
    tx *CosmosTxResponse,
    expectedRecipient string,
    expectedAmount string,
    denom string,
) error {
    for _, log := range tx.TxResponse.Logs {
        for _, event := range log.Events {
            if event.Type != "transfer" {
                continue
            }

            var recipient, amount string
            for _, attr := range event.Attributes {
                switch attr.Key {
                case "recipient":
                    recipient = attr.Value
                case "amount":
                    amount = attr.Value
                }
            }

            if recipient == expectedRecipient {
                // Amount format: "1000000uusdc"
                // Parse amount and denom
                var amountStr string
                for i, ch := range amount {
                    if ch < '0' || ch > '9' {
                        amountStr = amount[:i]
                        break
                    }
                }

                actualAmount, err := strconv.ParseUint(amountStr, 10, 64)
                if err != nil {
                    continue
                }

                expectedAmountInt, _ := strconv.ParseUint(expectedAmount, 10, 64)
                if actualAmount >= expectedAmountInt {
                    return nil
                }
            }
        }
    }

    return fmt.Errorf("no matching transfer event found")
}
```

## RPC Endpoints

| Network | REST API | gRPC |
|---------|----------|------|
| Noble Mainnet | `https://noble-api.polkachu.com` | `noble-api.polkachu.com:443` |
| Noble Testnet (Grand) | `https://grand-api.polkachu.com` | `grand-api.polkachu.com:443` |

### REST API Methods

**Query Transaction**:
```
GET /cosmos/tx/v1beta1/txs/{txHash}
```

**Query Account Balance**:
```
GET /cosmos/bank/v1beta1/balances/{address}
```

**Query Specific Denom Balance**:
```
GET /cosmos/bank/v1beta1/balances/{address}/by_denom?denom={denom}
```

## Error Codes

| Code | Description |
|------|-------------|
| `COSMOS-001` | Transaction not found |
| `COSMOS-002` | Transaction failed (code != 0) |
| `COSMOS-003` | No MsgSend message found |
| `COSMOS-004` | Wrong sender address |
| `COSMOS-005` | Wrong recipient address |
| `COSMOS-006` | Wrong denomination |
| `COSMOS-007` | Insufficient amount |
| `COSMOS-008` | Transaction too old |
| `COSMOS-009` | Transaction already used |

## Gas and Fees

| Operation | Gas | ~Cost (USDC) |
|-----------|-----|--------------|
| MsgSend | ~100,000 | ~0.0025 USDC |
| Multi-send | ~150,000 | ~0.00375 USDC |

Notes:
- Gas price on Noble: 0.025 uusdc per gas unit
- Typical transfer: ~100k gas = 2,500 uusdc = 0.0025 USDC
- Noble uses USDC as the gas token (unique among Cosmos chains)

## Finality Considerations

Cosmos chains use Tendermint/CometBFT consensus with instant finality:

- **Block time**: ~5-7 seconds
- **Finality**: Instant (deterministic)
- **Confirmations**: 1 block is sufficient

```go
func (f *ExactDirectCosmosScheme) waitForFinality(ctx context.Context, txHash string) error {
    // Cosmos has instant finality with Tendermint consensus
    // Once a transaction is in a block, it's final

    for i := 0; i < 20; i++ { // 20 * 1s = 20 second timeout
        tx, err := f.queryTransaction(ctx, txHash)
        if err == nil && tx.TxResponse.Code == 0 {
            return nil
        }

        time.Sleep(1 * time.Second)
    }

    return fmt.Errorf("transaction not finalized within timeout")
}
```

### Best Practices

1. **Single Confirmation**: 1 block confirmation is sufficient
2. **Code Check**: Always verify `code == 0` (success)
3. **Event Verification**: Use transfer events as additional validation
4. **Memo Support**: Optionally include memo for transaction tracking

## Security Considerations

### Replay Protection

Cosmos prevents replay attacks through:
- **Account Sequence**: Each account maintains an incrementing sequence number
- **Chain ID**: Transactions are bound to a specific chain
- **Timeout Height**: Transactions can specify a timeout height

### Front-Running Mitigation

- Cosmos chains typically have no public mempool
- Validators receive transactions directly via RPC
- Minimal front-running risk

### Validation Checklist

1. Verify `tx_response.code == 0`
2. Check transaction has at least one message
3. Find message with type `/cosmos.bank.v1beta1.MsgSend`
4. Verify `from_address` matches expected sender
5. Check `to_address` matches expected recipient
6. Validate amount array contains correct denom
7. Ensure amount >= expected amount
8. Check transaction timestamp within acceptable range
9. Verify transaction hasn't been used before (idempotency)
10. Optionally verify transfer events

## Common Error Codes

| Code | Description |
|------|-------------|
| 0 | Success |
| 2 | Insufficient funds |
| 3 | Invalid sequence |
| 4 | Unauthorized |
| 5 | Invalid coins |
| 11 | Out of gas |
| 12 | Memo too large |
| 13 | Insufficient fee |

## Message Structure

`MsgSend` structure in the transaction:

```json
{
  "@type": "/cosmos.bank.v1beta1.MsgSend",
  "from_address": "noble1abc123...",
  "to_address": "noble1xyz789...",
  "amount": [
    {
      "denom": "uusdc",
      "amount": "1000000"
    }
  ]
}
```

Note: The `amount` field is an array and can contain multiple coins. Verify the correct denomination.

## Transfer Events

Successful transfers emit events that can be used for verification:

```json
{
  "type": "transfer",
  "attributes": [
    {
      "key": "recipient",
      "value": "noble1xyz789..."
    },
    {
      "key": "sender",
      "value": "noble1abc123..."
    },
    {
      "key": "amount",
      "value": "1000000uusdc"
    }
  ]
}
```

## Noble-Specific Features

Noble is unique among Cosmos chains:

1. **Native USDC**: First native USDC issuance outside Ethereum
2. **USDC as Gas**: Pay transaction fees in USDC (not a separate token)
3. **Circle Integration**: Direct integration with Circle's USDC infrastructure
4. **Interchain Transfers**: IBC-enabled for cross-chain USDC transfers

## IBC Transfers (Optional)

For cross-chain transfers via IBC (Inter-Blockchain Communication):

```typescript
const ibcTransfer = await client.sendIbcTokens(
  senderAddress,
  recipientAddress,
  { denom: 'uusdc', amount: '1000000' },
  'transfer', // source port
  'channel-0', // source channel
  undefined, // timeout height
  Math.floor(Date.now() / 1000) + 600, // timeout timestamp (10 min)
  'auto'
);
```

IBC transfers require additional verification of packet acknowledgments.
