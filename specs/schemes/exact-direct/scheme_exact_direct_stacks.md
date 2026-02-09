# Scheme: `exact-direct` on `Stacks`

## Summary

The `exact-direct` scheme on Stacks uses the SIP-010 fungible token standard's `transfer` function to execute direct token transfers. The client signs and broadcasts the transfer, then provides the transaction ID as proof of payment. Stacks is a Bitcoin Layer 2 that settles on Bitcoin for security.

## Stacks Token Standard

Stacks uses SIP-010 (Standard Trait for Fungible Tokens):

- **Function**: `(transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))`
- **Language**: Clarity smart contracts
- **Signature**: secp256k1 (Bitcoin-style)
- **Gas**: Paid in STX (Stacks native token)

## Token Addresses

| Network | Token | Contract Address |
|---------|-------|------------------|
| Mainnet | sBTC | `SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc` |
| Testnet | sBTC | `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.token-susdc` |

Note: Using sBTC/sUSDC as examples. Actual stablecoin contracts on Stacks mainnet TBD.

## PaymentPayload `payload` Field

```json
{
  "txId": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "from": "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
  "to": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
  "amount": "1000000",
  "contractAddress": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc"
}
```

### Field Descriptions

- **txId**: Transaction ID (0x + 64 hex characters)
- **from**: Sender's Stacks address (SP... for mainnet, ST... for testnet)
- **to**: Recipient's Stacks address
- **amount**: Transfer amount in smallest units (typically 6 decimals)
- **contractAddress**: SIP-010 contract address (principal.contract-name)

## PaymentRequirements

```json
{
  "scheme": "exact-direct",
  "network": "stacks:1",
  "amount": "1000000",
  "asset": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
  "payTo": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
  "maxTimeoutSeconds": 600,
  "extra": {
    "assetSymbol": "sUSDC",
    "assetDecimals": 6
  }
}
```

Note: Stacks block time is ~10 minutes (Bitcoin anchor time), so timeout should be longer.

## Client Implementation

### TypeScript (Stacks.js)

```typescript
import {
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  makeStandardSTXPostCondition,
  FungibleConditionCode,
  createAssetInfo,
} from '@stacks/transactions';
import { StacksTestnet, StacksMainnet } from '@stacks/network';

interface StacksTransferParams {
  contractAddress: string;
  contractName: string;
  to: string;
  amount: string;
}

class StacksClient {
  private network: StacksTestnet | StacksMainnet;
  private senderKey: string;

  constructor(privateKey: string, isMainnet: boolean = true) {
    this.senderKey = privateKey;
    this.network = isMainnet ? new StacksMainnet() : new StacksTestnet();
  }

  async executeTransfer(params: StacksTransferParams): Promise<string> {
    const [contractAddr, contractName] = params.contractAddress.split('.');

    const txOptions = {
      contractAddress: contractAddr,
      contractName: contractName,
      functionName: 'transfer',
      functionArgs: [
        uintCV(params.amount),
        standardPrincipalCV(this.getSenderAddress()),
        standardPrincipalCV(params.to),
        noneCV(), // memo
      ],
      senderKey: this.senderKey,
      validateWithAbi: true,
      network: this.network,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Deny,
    };

    const transaction = await makeContractCall(txOptions);
    const broadcastResponse = await broadcastTransaction(transaction, this.network);

    if (broadcastResponse.error) {
      throw new Error(`Transaction failed: ${broadcastResponse.error}`);
    }

    return broadcastResponse.txid;
  }

  getSenderAddress(): string {
    const { address } = getAddressFromPrivateKey(this.senderKey, this.network.version);
    return address;
  }

  async getBalance(contractAddress: string, owner: string): Promise<string> {
    const [contractAddr, contractName] = contractAddress.split('.');

    const url = `${this.network.coreApiUrl}/v2/contracts/call-read/${contractAddr}/${contractName}/get-balance`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: owner,
        arguments: [cvToHex(standardPrincipalCV(owner))],
      }),
    });

    const data = await response.json();
    return data.result; // Returns Clarity repr, parse as needed
  }
}

// Usage example
async function payWithStacks() {
  const client = new StacksClient(
    '0x...your_private_key...', // secp256k1 private key
    true // mainnet
  );

  const txId = await client.executeTransfer({
    contractAddress: 'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc',
    contractName: 'token-susdc',
    to: 'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7',
    amount: '1000000', // 1 sUSDC (6 decimals)
  });

  console.log('Transaction ID:', txId);
  return txId;
}
```

### Python (stacks.py)

```python
from stacks import Client, ClarityValue
from stacks.transactions import make_contract_call, broadcast_transaction

class StacksClient:
    def __init__(self, private_key: str, is_mainnet: bool = True):
        self.private_key = private_key
        self.client = Client(mainnet=is_mainnet)

    def execute_transfer(
        self,
        contract_address: str,
        to: str,
        amount: int
    ) -> str:
        contract_addr, contract_name = contract_address.split('.')

        tx = make_contract_call(
            contract_address=contract_addr,
            contract_name=contract_name,
            function_name='transfer',
            function_args=[
                ClarityValue.uint(amount),
                ClarityValue.principal(self.get_sender_address()),
                ClarityValue.principal(to),
                ClarityValue.none(),
            ],
            sender_key=self.private_key,
            network=self.client.network,
        )

        result = broadcast_transaction(tx, self.client.network)
        return result['txid']

    def get_sender_address(self) -> str:
        # Derive address from private key
        pass

# Usage
client = StacksClient(
    private_key="0x...",
    is_mainnet=True
)

tx_id = client.execute_transfer(
    contract_address="SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
    to="SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
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
    "strings"
)

type StacksTransaction struct {
    TxID       string `json:"tx_id"`
    TxStatus   string `json:"tx_status"`
    TxType     string `json:"tx_type"`
    Sender     string `json:"sender_address"`
    ContractCall struct {
        ContractID   string `json:"contract_id"`
        FunctionName string `json:"function_name"`
        FunctionArgs []struct {
            Hex  string `json:"hex"`
            Repr string `json:"repr"`
            Name string `json:"name"`
            Type string `json:"type"`
        } `json:"function_args"`
    } `json:"contract_call"`
    Events []struct {
        EventType string `json:"event_type"`
        Asset     struct {
            AssetID string `json:"asset_id"`
            Sender  string `json:"sender"`
            Recipient string `json:"recipient"`
            Amount  string `json:"amount"`
        } `json:"asset"`
    } `json:"events"`
}

func (f *ExactDirectStacksScheme) verifyTransaction(
    ctx context.Context,
    txID string,
    expectedSender string,
    expectedRecipient string,
    expectedAmount string,
    contractAddress string,
) error {
    // Query transaction from Hiro API
    tx, err := f.queryTransaction(ctx, txID)
    if err != nil {
        return fmt.Errorf("failed to query transaction: %w", err)
    }

    // Check transaction status
    if tx.TxStatus != "success" {
        return fmt.Errorf("transaction status is %s, expected success", tx.TxStatus)
    }

    // Verify transaction type
    if tx.TxType != "contract_call" {
        return fmt.Errorf("wrong transaction type: %s", tx.TxType)
    }

    // Verify sender
    if tx.Sender != expectedSender {
        return fmt.Errorf("wrong sender: got %s, expected %s", tx.Sender, expectedSender)
    }

    // Verify contract call
    if tx.ContractCall.ContractID != contractAddress {
        return fmt.Errorf("wrong contract: got %s, expected %s", tx.ContractCall.ContractID, contractAddress)
    }

    if tx.ContractCall.FunctionName != "transfer" {
        return fmt.Errorf("wrong function: got %s, expected transfer", tx.ContractCall.FunctionName)
    }

    // Parse function arguments from Clarity repr
    // Args: amount, sender, recipient, memo
    if len(tx.ContractCall.FunctionArgs) < 3 {
        return fmt.Errorf("insufficient function arguments: got %d, expected at least 3", len(tx.ContractCall.FunctionArgs))
    }

    // Argument 0: amount (uint)
    amountRepr := tx.ContractCall.FunctionArgs[0].Repr
    amountStr := strings.TrimPrefix(amountRepr, "u")
    actualAmount, err := strconv.ParseUint(amountStr, 10, 64)
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

    // Argument 1: sender (principal)
    senderRepr := tx.ContractCall.FunctionArgs[1].Repr
    if !strings.Contains(senderRepr, expectedSender) {
        return fmt.Errorf("wrong sender in args: %s", senderRepr)
    }

    // Argument 2: recipient (principal)
    recipientRepr := tx.ContractCall.FunctionArgs[2].Repr
    if !strings.Contains(recipientRepr, expectedRecipient) {
        return fmt.Errorf("wrong recipient in args: %s", recipientRepr)
    }

    // Additional verification via events
    var foundTransferEvent bool
    for _, event := range tx.Events {
        if event.EventType == "ft_transfer_event" || event.EventType == "fungible_token_asset" {
            if event.Asset.Recipient == expectedRecipient {
                eventAmount, err := strconv.ParseUint(event.Asset.Amount, 10, 64)
                if err == nil && eventAmount >= expectedAmountInt {
                    foundTransferEvent = true
                    break
                }
            }
        }
    }

    if !foundTransferEvent {
        // Events are optional verification, log warning but don't fail
        fmt.Printf("Warning: no matching transfer event found\n")
    }

    return nil
}

func (f *ExactDirectStacksScheme) queryTransaction(ctx context.Context, txID string) (*StacksTransaction, error) {
    url := fmt.Sprintf("%s/extended/v1/tx/%s", f.apiURL, txID)

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
        return nil, fmt.Errorf("API error: status %d", resp.StatusCode)
    }

    var tx StacksTransaction
    if err := json.NewDecoder(resp.Body).Decode(&tx); err != nil {
        return nil, fmt.Errorf("failed to decode response: %w", err)
    }

    return &tx, nil
}
```

## RPC Endpoints

| Network | Hiro API |
|---------|----------|
| Mainnet | `https://api.mainnet.hiro.so` |
| Testnet | `https://api.testnet.hiro.so` |

### API Methods

**Query Transaction**:
```
GET /extended/v1/tx/{txId}
```

**Query Address Balance**:
```
GET /extended/v1/address/{address}/balances
```

**Call Read-Only Function**:
```
POST /v2/contracts/call-read/{contract_addr}/{contract_name}/{function_name}
```

## Error Codes

| Code | Description |
|------|-------------|
| `STACKS-001` | Transaction not found |
| `STACKS-002` | Transaction failed (not success) |
| `STACKS-003` | Wrong transaction type (not contract_call) |
| `STACKS-004` | Wrong sender address |
| `STACKS-005` | Wrong contract address |
| `STACKS-006` | Wrong function name (not transfer) |
| `STACKS-007` | Wrong recipient address |
| `STACKS-008` | Insufficient amount |
| `STACKS-009` | Transaction too old |
| `STACKS-010` | Transaction already used |

## Gas and Fees

| Operation | Gas (µSTX) | ~Cost (STX) |
|-----------|-----------|-------------|
| SIP-010 transfer | ~50,000 | ~0.05 STX |
| Contract deployment | ~500,000 | ~0.5 STX |

Notes:
- Gas is measured in microSTX (µSTX), where 1 STX = 1,000,000 µSTX
- Typical transfer: ~0.05 STX (~$0.05 at $1/STX)
- Fees vary based on network congestion

## Finality Considerations

Stacks uses a unique Bitcoin-anchored consensus:

- **Microblock time**: ~1-2 minutes (fast confirmation)
- **Bitcoin anchor**: ~10 minutes (full finality)
- **Confirmations**: 1 Bitcoin block for finality

```go
func (f *ExactDirectStacksScheme) waitForFinality(ctx context.Context, txID string) error {
    // Wait for transaction to be included in a Bitcoin-anchored block
    // This typically takes ~10 minutes

    for i := 0; i < 60; i++ { // 60 * 30s = 30 minute timeout
        tx, err := f.queryTransaction(ctx, txID)
        if err == nil && tx.TxStatus == "success" {
            // Additional check: ensure tx is in an anchored block
            if tx.BlockHeight > 0 && tx.IsUnanchored == false {
                return nil
            }
        }

        time.Sleep(30 * time.Second)
    }

    return fmt.Errorf("transaction not finalized within timeout")
}
```

### Best Practices

1. **Microblock Confirmation**: Accept after 1 microblock for low-value transfers
2. **Bitcoin Anchor**: Wait for Bitcoin anchor for high-value transfers
3. **Status Check**: Verify `tx_status == "success"`
4. **Unanchored Blocks**: Be aware of microblocks vs anchored blocks

## Security Considerations

### Replay Protection

Stacks prevents replay attacks through:
- **Nonce**: Each account maintains an incrementing nonce
- **Chain ID**: Transactions are bound to mainnet or testnet
- **Post Conditions**: Define asset transfer constraints

### Front-Running Mitigation

- Stacks has a public mempool with FIFO ordering per fee tier
- Miners can potentially reorder transactions
- Use post-conditions to protect against unexpected behavior

### Validation Checklist

1. Verify `tx_status == "success"`
2. Check `tx_type == "contract_call"`
3. Verify `sender_address` matches expected sender
4. Check `contract_call.contract_id` matches token contract
5. Verify `contract_call.function_name == "transfer"`
6. Parse Clarity repr arguments (amount, sender, recipient)
7. Ensure amount >= expected amount
8. Validate recipient address
9. Check transaction timestamp within acceptable range
10. Verify transaction hasn't been used before (idempotency)

## Common Transaction Statuses

| Status | Description |
|--------|-------------|
| `success` | Transaction succeeded |
| `abort_by_response` | Contract returned (err ...) |
| `abort_by_post_condition` | Post-condition failed |
| `pending` | Transaction in mempool |

## Clarity Value Representation

Clarity values are represented in a human-readable format:

| Type | Example Repr |
|------|--------------|
| uint | `u1000000` |
| principal | `SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7` |
| none | `none` |
| some | `(some 0x1234)` |
| response | `(ok true)` or `(err u1)` |

Parse these representations carefully when verifying function arguments.

## Post Conditions

Stacks supports post-conditions to prevent unexpected token transfers:

```typescript
import {
  makeStandardFungiblePostCondition,
  FungibleConditionCode
} from '@stacks/transactions';

const postConditions = [
  makeStandardFungiblePostCondition(
    senderAddress,
    FungibleConditionCode.Equal,
    new BN(1000000),
    createAssetInfo(contractAddr, contractName, tokenName)
  ),
];
```

This ensures exactly 1000000 tokens are transferred, preventing malicious contracts from stealing more.
