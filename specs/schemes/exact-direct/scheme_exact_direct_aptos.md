# Scheme: `exact-direct` on `Aptos`

## Summary

The `exact-direct` scheme on Aptos uses the Fungible Asset (FA) standard's `primary_fungible_store::transfer` function to execute direct token transfers. The client signs and broadcasts the transfer, then provides the transaction hash as proof of payment.

## Aptos Token Standard

Aptos uses the Fungible Asset (FA) standard introduced in Aptos Framework v1.7:

- **Module**: `0x1::primary_fungible_store`
- **Function**: `transfer(metadata: Object<Metadata>, from: address, to: address, amount: u64)`
- **Signature**: Ed25519
- **Gas**: Paid in APT (Aptos native token)

## Token Addresses

| Network | Token | Metadata Address |
|---------|-------|------------------|
| Mainnet | USDT | `0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb` |
| Testnet | USDT | `0x43417434fd869edee76cca2a4d2301e528a1551b1d719b75c350c3c97d15b8b9` |
| Devnet | USDT | `0x... (TBD)` |

## PaymentPayload `payload` Field

```json
{
  "txHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "from": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "to": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  "amount": "1000000",
  "metadataAddress": "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
  "version": "123456789"
}
```

### Field Descriptions

- **txHash**: Transaction hash (0x + 64 hex characters)
- **from**: Sender's Aptos address (0x + 64 hex)
- **to**: Recipient's Aptos address (0x + 64 hex)
- **amount**: Transfer amount in smallest units (6 decimals for USDT)
- **metadataAddress**: Fungible Asset metadata object address
- **version**: (Optional) Transaction ledger version for faster lookups

## PaymentRequirements

```json
{
  "scheme": "exact-direct",
  "network": "aptos:1",
  "amount": "1000000",
  "asset": "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
  "payTo": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  "maxTimeoutSeconds": 120,
  "extra": {
    "assetSymbol": "USDT",
    "assetDecimals": 6
  }
}
```

## Client Implementation

### TypeScript (Aptos SDK)

```typescript
import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from '@aptos-labs/ts-sdk';

interface AptosTransferParams {
  metadataAddress: string;
  to: string;
  amount: string;
}

class AptosClient {
  private aptos: Aptos;
  private account: Account;

  constructor(privateKey: string, network: Network = Network.MAINNET) {
    const config = new AptosConfig({ network });
    this.aptos = new Aptos(config);

    const key = new Ed25519PrivateKey(privateKey);
    this.account = Account.fromPrivateKey({ privateKey: key });
  }

  async executeTransfer(params: AptosTransferParams): Promise<string> {
    const transaction = await this.aptos.transaction.build.simple({
      sender: this.account.accountAddress,
      data: {
        function: '0x1::primary_fungible_store::transfer',
        functionArguments: [
          params.metadataAddress, // metadata: Object<Metadata>
          params.to,              // to: address
          params.amount,          // amount: u64
        ],
      },
    });

    const pendingTransaction = await this.aptos.signAndSubmitTransaction({
      signer: this.account,
      transaction,
    });

    // Wait for transaction confirmation
    const committedTx = await this.aptos.waitForTransaction({
      transactionHash: pendingTransaction.hash,
    });

    return committedTx.hash;
  }

  async getBalance(address: string, metadataAddress: string): Promise<string> {
    const resource = await this.aptos.getAccountResource({
      accountAddress: address,
      resourceType: `0x1::fungible_asset::FungibleStore`,
    });

    return resource.balance;
  }
}

// Usage example
async function payWithAptos() {
  const client = new AptosClient('0x...your_private_key...', Network.MAINNET);

  const txHash = await client.executeTransfer({
    metadataAddress: '0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb',
    to: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    amount: '1000000', // 1 USDT (6 decimals)
  });

  console.log('Transaction hash:', txHash);
  return txHash;
}
```

### Python (Aptos SDK)

```python
from aptos_sdk.account import Account
from aptos_sdk.client import RestClient
from aptos_sdk.transactions import EntryFunction, TransactionArgument

class AptosClient:
    def __init__(self, private_key: str, node_url: str = "https://fullnode.mainnet.aptoslabs.com/v1"):
        self.client = RestClient(node_url)
        self.account = Account.load_key(private_key)

    def execute_transfer(self, metadata_address: str, to: str, amount: int) -> str:
        payload = EntryFunction.natural(
            module="0x1::primary_fungible_store",
            function="transfer",
            ty_args=[],
            args=[
                TransactionArgument(metadata_address, "address"),
                TransactionArgument(to, "address"),
                TransactionArgument(amount, "u64"),
            ],
        )

        signed_tx = self.client.create_bcs_signed_transaction(
            self.account, payload
        )
        tx_hash = self.client.submit_bcs_transaction(signed_tx)
        self.client.wait_for_transaction(tx_hash)

        return tx_hash

# Usage
client = AptosClient("0x...your_private_key...")
tx_hash = client.execute_transfer(
    metadata_address="0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
    to="0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    amount=1000000,  # 1 USDT
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

type AptosTransaction struct {
    Version         string `json:"version"`
    Hash            string `json:"hash"`
    Success         bool   `json:"success"`
    VMStatus        string `json:"vm_status"`
    Sender          string `json:"sender"`
    SequenceNumber  string `json:"sequence_number"`
    MaxGasAmount    string `json:"max_gas_amount"`
    GasUnitPrice    string `json:"gas_unit_price"`
    GasUsed         string `json:"gas_used"`
    Payload         struct {
        Type          string   `json:"type"`
        Function      string   `json:"function"`
        TypeArguments []string `json:"type_arguments"`
        Arguments     []any    `json:"arguments"`
    } `json:"payload"`
    Timestamp string `json:"timestamp"`
}

func (f *ExactDirectAptosScheme) verifyTransaction(
    ctx context.Context,
    txHash string,
    expectedSender string,
    expectedRecipient string,
    expectedAmount string,
    metadataAddress string,
) error {
    // Query transaction from Aptos REST API
    tx, err := f.queryTransaction(ctx, txHash)
    if err != nil {
        return fmt.Errorf("failed to query transaction: %w", err)
    }

    // Check transaction succeeded
    if !tx.Success {
        return fmt.Errorf("transaction failed: %s", tx.VMStatus)
    }

    // Verify sender
    if tx.Sender != expectedSender {
        return fmt.Errorf("wrong sender: got %s, expected %s", tx.Sender, expectedSender)
    }

    // Verify payload type
    if tx.Payload.Type != "entry_function_payload" {
        return fmt.Errorf("wrong payload type: %s", tx.Payload.Type)
    }

    // Verify function is primary_fungible_store::transfer
    expectedFunction := "0x1::primary_fungible_store::transfer"
    if tx.Payload.Function != expectedFunction {
        return fmt.Errorf("wrong function: got %s, expected %s", tx.Payload.Function, expectedFunction)
    }

    // Verify arguments
    if len(tx.Payload.Arguments) != 3 {
        return fmt.Errorf("wrong number of arguments: got %d, expected 3", len(tx.Payload.Arguments))
    }

    // Argument 0: metadata address
    argMetadata, ok := tx.Payload.Arguments[0].(string)
    if !ok || argMetadata != metadataAddress {
        return fmt.Errorf("wrong metadata address: got %v, expected %s", tx.Payload.Arguments[0], metadataAddress)
    }

    // Argument 1: recipient address
    argRecipient, ok := tx.Payload.Arguments[1].(string)
    if !ok || argRecipient != expectedRecipient {
        return fmt.Errorf("wrong recipient: got %v, expected %s", tx.Payload.Arguments[1], expectedRecipient)
    }

    // Argument 2: amount (as string)
    argAmount, ok := tx.Payload.Arguments[2].(string)
    if !ok {
        return fmt.Errorf("amount is not a string: %v", tx.Payload.Arguments[2])
    }

    actualAmount, err := strconv.ParseUint(argAmount, 10, 64)
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

    return nil
}

func (f *ExactDirectAptosScheme) queryTransaction(ctx context.Context, txHash string) (*AptosTransaction, error) {
    url := fmt.Sprintf("%s/transactions/by_hash/%s", f.rpcURL, txHash)

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
        return nil, fmt.Errorf("RPC error: status %d", resp.StatusCode)
    }

    var tx AptosTransaction
    if err := json.NewDecoder(resp.Body).Decode(&tx); err != nil {
        return nil, fmt.Errorf("failed to decode response: %w", err)
    }

    return &tx, nil
}

// Alternative: Query by version (faster if version is known)
func (f *ExactDirectAptosScheme) queryTransactionByVersion(ctx context.Context, version string) (*AptosTransaction, error) {
    url := fmt.Sprintf("%s/transactions/by_version/%s", f.rpcURL, version)

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
        return nil, fmt.Errorf("RPC error: status %d", resp.StatusCode)
    }

    var tx AptosTransaction
    if err := json.NewDecoder(resp.Body).Decode(&tx); err != nil {
        return nil, fmt.Errorf("failed to decode response: %w", err)
    }

    return &tx, nil
}
```

## RPC Endpoints

| Network | REST API Endpoint |
|---------|------------------|
| Mainnet | `https://fullnode.mainnet.aptoslabs.com/v1` |
| Testnet | `https://fullnode.testnet.aptoslabs.com/v1` |
| Devnet  | `https://fullnode.devnet.aptoslabs.com/v1` |

### API Methods

**Query Transaction by Hash**:
```
GET /transactions/by_hash/{txHash}
```

**Query Transaction by Version**:
```
GET /transactions/by_version/{version}
```

**Query Account Balance**:
```
GET /accounts/{address}/resources
```

## Error Codes

| Code | Description |
|------|-------------|
| `APTOS-001` | Transaction not found |
| `APTOS-002` | Transaction failed (check vm_status) |
| `APTOS-003` | Wrong sender address |
| `APTOS-004` | Wrong function (not primary_fungible_store::transfer) |
| `APTOS-005` | Wrong metadata address |
| `APTOS-006` | Wrong recipient address |
| `APTOS-007` | Insufficient amount |
| `APTOS-008` | Transaction too old |
| `APTOS-009` | Transaction already used |
| `APTOS-010` | Invalid payload type |

## Gas and Fees

| Operation | Gas Units | ~Cost (APT) |
|-----------|-----------|-------------|
| primary_fungible_store::transfer | ~7-10 | ~0.0001 APT |
| Account creation (first transfer) | ~400-500 | ~0.006 APT |

Notes:
- Gas price: 100 octas per gas unit (1 APT = 10^8 octas)
- Typical transfer: ~700-1000 octas (~$0.0001 at $10/APT)
- Account creation adds ~50,000 octas (~$0.005)

## Finality Considerations

Aptos achieves finality in approximately 1 second (single block confirmation). Once a transaction appears in a committed block, it is final and cannot be reversed.

```go
func (f *ExactDirectAptosScheme) waitForFinality(ctx context.Context, txHash string) error {
    // Aptos REST API waits for finality by default
    // If using the SDK's waitForTransaction, it already ensures finality

    tx, err := f.queryTransaction(ctx, txHash)
    if err != nil {
        return err
    }

    if !tx.Success {
        return fmt.Errorf("transaction failed: %s", tx.VMStatus)
    }

    return nil
}
```

### Best Practices

1. **Immediate Finality**: Aptos uses AptosBFT consensus; no need to wait for multiple confirmations
2. **Success Check**: Always verify `success: true` and `vm_status: "Executed successfully"`
3. **Version vs Hash**: Use version-based queries when available (faster)
4. **Gas Estimation**: Simulate transactions before submission

## Security Considerations

### Replay Protection

Aptos prevents replay attacks through:
- **Sequence Number**: Each account maintains an incrementing sequence number
- **Chain ID**: Transactions are bound to a specific chain (mainnet/testnet)
- **Expiration**: Transactions expire after ~7 seconds if not included

### Front-Running Mitigation

- Aptos uses a deterministic transaction ordering mechanism
- Transactions are ordered by gas price and sequence number
- No mempool front-running possible due to BFT consensus

### Validation Checklist

1. Verify `success == true`
2. Check `vm_status == "Executed successfully"`
3. Verify `payload.function == "0x1::primary_fungible_store::transfer"`
4. Validate sender, recipient, metadata address
5. Ensure amount >= expected amount
6. Check transaction timestamp within acceptable range
7. Verify transaction hasn't been used before (idempotency)

## Common VM Status Codes

| VM Status | Description |
|-----------|-------------|
| `Executed successfully` | Transaction succeeded |
| `Aborted` | Smart contract execution aborted |
| `Out of gas` | Insufficient gas provided |
| `Execution failure` | Generic execution error |
| `MiscellaneousError` | Other errors (check error message) |
