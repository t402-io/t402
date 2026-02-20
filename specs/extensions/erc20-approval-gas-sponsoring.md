# Extension: `erc20ApprovalGasSponsoring`

## Summary

Enables gasless ERC-20 payments for tokens that do NOT support EIP-2612 permits. The client constructs and signs an ERC-20 `approve(spender, amount)` transaction offline (without broadcasting), then sends the raw signed transaction to the server. The facilitator validates the signed transaction, optionally funds the client with gas, broadcasts the approval, and then settles the payment atomically.

This allows users to make t402 payments with non-permit tokens (e.g., legacy USDT on some chains) without holding native tokens for gas fees.

## Extension Key

```
erc20ApprovalGasSponsoring
```

## Flow

1. **Server** declares the `erc20ApprovalGasSponsoring` extension in the `PaymentRequired` response, including which networks support gas sponsoring, the sponsor address, and whether atomic batching is required.
2. **Client** constructs an ERC-20 `approve(spender, amount)` transaction, signs it offline (NOT submitted to the network), and includes the raw signed transaction in the payment payload extensions.
3. **Facilitator** extracts the signed approval transaction, validates the `approve()` function selector and parameters, optionally funds the client with native gas tokens, broadcasts the approval transaction, and settles the payment. The facilitator pays the gas for all transactions.

## Data Format

### Server Declaration

The server includes this extension in the `extensions` field of the `PaymentRequired` response.

**Info Object:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sponsoredNetworks | string[] | Yes | CAIP-2 network identifiers where gas sponsoring is available (e.g., `["eip155:8453", "eip155:42161"]`) |
| maxAmount | string | Yes | Maximum token amount (in base units) the sponsor will cover per approval |
| sponsorAddress | string | Yes | Address of the sponsor/facilitator that will submit transactions |
| permit2Address | string | No | Optional Permit2 proxy address for advanced settlement flows |
| requiresAtomicBatch | boolean | Yes | Whether atomic batch execution is required (e.g., via Multicall3) |

**Schema:**

```json
{
  "type": "object",
  "required": ["sponsoredNetworks", "maxAmount", "sponsorAddress", "requiresAtomicBatch"],
  "properties": {
    "sponsoredNetworks": {
      "type": "array",
      "items": { "type": "string" }
    },
    "maxAmount": { "type": "string" },
    "sponsorAddress": { "type": "string" },
    "permit2Address": { "type": "string" },
    "requiresAtomicBatch": { "type": "boolean" }
  }
}
```

**Example Server Declaration:**

```json
{
  "extensions": {
    "erc20ApprovalGasSponsoring": {
      "info": {
        "sponsoredNetworks": ["eip155:8453", "eip155:42161"],
        "maxAmount": "1000000000",
        "sponsorAddress": "0xFacilitator...",
        "requiresAtomicBatch": true
      },
      "schema": { "..." }
    }
  }
}
```

### Client Payload

The client echoes the extension in the `extensions` field of the `PaymentPayload`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| network | string | Yes | CAIP-2 network identifier (must be in `sponsoredNetworks`) |
| from | string | Yes | Client wallet address that signed the transaction |
| asset | string | Yes | ERC-20 token contract address |
| amount | string | Yes | Approval amount in base units |
| signedApprovalTx | string | Yes | Raw signed `approve()` transaction (hex-encoded with `0x` prefix) |
| chainId | number | Yes | Chain ID for replay protection |
| nonce | number | No | Client's account nonce (if known) |

**Example Client Payload:**

```json
{
  "erc20ApprovalGasSponsoring": {
    "network": "eip155:8453",
    "from": "0xClient...",
    "asset": "0xUSDT...",
    "amount": "1000000",
    "signedApprovalTx": "0xf8a9...",
    "chainId": 8453
  }
}
```

## ERC-20 Approve Transaction

The client constructs a standard ERC-20 `approve(address spender, uint256 amount)` call:

**Function Selector:** `0x095ea7b3`

**ABI Encoding:**
```
0x095ea7b3
+ <spender address padded to 32 bytes>
+ <amount padded to 32 bytes>
```

The client signs this transaction using their private key, producing a raw signed transaction that can be broadcast to the network. The transaction is NOT submitted; only the raw signed bytes are sent to the facilitator.

## Validation Rules

- `network` MUST be present in the server's `sponsoredNetworks` list
- `amount` MUST NOT exceed the server's `maxAmount`
- `chainId` MUST match the expected chain ID for the declared `network`
- `signedApprovalTx` MUST be a valid hex-encoded raw transaction
- The transaction data MUST start with the `approve()` function selector (`0x095ea7b3`)
- `from` MUST be a valid address
- `asset` MUST be a valid ERC-20 token contract address

## Facilitator Flow

1. Extract the `erc20ApprovalGasSponsoring` extension from the payment payload
2. Validate the payload against the extension info
3. Decode the signed transaction and verify the `approve()` function selector
4. Verify the approval amount and spender match expectations
5. Optionally fund the client address with native gas tokens
6. Broadcast the signed approval transaction
7. Settle the payment via `transferFrom` (or Permit2 if configured)
8. The facilitator pays gas for all transactions

## Security Considerations

- The sponsor address should be a controlled facilitator wallet with sufficient native token balance for gas
- Servers should enforce rate limits to prevent approval spam
- The `maxAmount` should be set conservatively to limit sponsor exposure
- Facilitators MUST verify the `approve()` calldata before broadcasting to prevent malicious transactions
- The signed transaction should be validated for the correct chain ID to prevent cross-chain replay
- Only the `approve()` function selector (`0x095ea7b3`) should be accepted; reject any other function calls
- If `requiresAtomicBatch` is true, the approval and settlement should be bundled atomically
- Unlike EIP-2612, the approval transaction will be on-chain and visible; facilitators should monitor for front-running

## SDK Implementations

| SDK | Package/Module | Import Path |
|-----|---------------|-------------|
| TypeScript | @t402/extensions | `@t402/extensions/erc20-approval-gas-sponsoring` |
| Go | extensions | `github.com/t402-io/t402/sdks/go/extensions/erc20approvalgassponsor` |

## Examples

### Server-Side

```typescript
import {
  declareERC20ApprovalGasSponsorExtension,
  parseERC20ApprovalGasSponsorHeader,
  validateERC20ApprovalGasSponsorPayload,
} from "@t402/extensions/erc20-approval-gas-sponsoring";

// Declare extension in 402 response
const extension = declareERC20ApprovalGasSponsorExtension({
  sponsoredNetworks: ["eip155:8453", "eip155:42161"],
  maxAmount: "1000000000",
  sponsorAddress: "0xFacilitator...",
  requiresAtomicBatch: true,
});

// Parse and validate client payload
const payload = parseERC20ApprovalGasSponsorHeader(
  request.headers["x-t402-erc20-approval-gas-sponsoring"]
);
const result = validateERC20ApprovalGasSponsorPayload(payload, extension.info);
```

### Client-Side

```typescript
import {
  encodeApproveCalldata,
  createERC20ApprovalGasSponsorPayload,
  encodeERC20ApprovalGasSponsorHeader,
  ERC20_APPROVAL_GAS_SPONSOR_HEADER_NAME,
} from "@t402/extensions/erc20-approval-gas-sponsoring";

// Build the approve calldata
const calldata = encodeApproveCalldata(
  extension.info.sponsorAddress,
  "1000000"
);

// Sign the transaction offline (using your web3 library)
const signedTx = await wallet.signTransaction({
  to: tokenAddress,
  data: calldata,
  chainId: 8453,
});

// Create and encode the payload
const payload = createERC20ApprovalGasSponsorPayload(extension.info, {
  network: "eip155:8453",
  from: wallet.address,
  asset: tokenAddress,
  amount: "1000000",
  signedApprovalTx: signedTx,
  chainId: 8453,
});

fetch(url, {
  headers: {
    [ERC20_APPROVAL_GAS_SPONSOR_HEADER_NAME]:
      encodeERC20ApprovalGasSponsorHeader(payload),
  },
});
```

### Facilitator-Side

```typescript
import {
  extractERC20ApprovalGasSponsorPayload,
  processERC20ApprovalPayload,
} from "@t402/extensions/erc20-approval-gas-sponsoring";

// Extract approval from payment extensions
const approval = extractERC20ApprovalGasSponsorPayload(
  paymentPayload.extensions
);
if (approval) {
  const result = processERC20ApprovalPayload(approval, extensionInfo);
  if (result.valid) {
    // Fund client with gas if needed, broadcast approval tx, then settle
  }
}
```
