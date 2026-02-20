# Extension: `eip2612GasSponsoring`

## Summary

Enables gasless ERC-20 payments using the EIP-2612 permit standard. The client signs an off-chain EIP-2612 permit instead of submitting an on-chain approval transaction; the facilitator then submits the `permit()` call on the token contract followed by settlement via Permit2, paying gas on behalf of the client.

This allows users to make t402 payments without holding native tokens (ETH, etc.) for gas fees.

## Extension Key

```
eip2612GasSponsoring
```

## Flow

1. **Server** declares the `eip2612GasSponsoring` extension in the `PaymentRequired` response, including which networks support gas sponsoring and the sponsor (facilitator) address.
2. **Client** receives the 402 response, signs an EIP-2612 permit off-chain (EIP-712 typed data), and includes the permit signature in the payment payload extensions.
3. **Facilitator** extracts the permit from the payment, calls `permit(owner, spender, value, deadline, v, r, s)` on the token contract, then settles the payment via Permit2. The facilitator pays the gas for both transactions.

## Data Format

### Server Declaration

The server includes this extension in the `extensions` field of the `PaymentRequired` response.

**Info Object:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sponsoredNetworks | string[] | Yes | CAIP-2 network identifiers where gas sponsoring is available (e.g., `["eip155:8453", "eip155:42161"]`) |
| maxAmount | string | Yes | Maximum token amount (in base units) the sponsor will cover per permit |
| permitDeadline | number | Yes | Default permit deadline in seconds from now |
| sponsorAddress | string | Yes | Address of the sponsor/facilitator that will call `permit` + `transferFrom` |

**Schema:**

```json
{
  "type": "object",
  "required": ["sponsoredNetworks", "maxAmount", "permitDeadline", "sponsorAddress"],
  "properties": {
    "sponsoredNetworks": {
      "type": "array",
      "items": { "type": "string" }
    },
    "maxAmount": { "type": "string" },
    "permitDeadline": { "type": "number" },
    "sponsorAddress": { "type": "string" }
  }
}
```

**Example Server Declaration:**

```json
{
  "extensions": {
    "eip2612GasSponsoring": {
      "info": {
        "sponsoredNetworks": ["eip155:8453", "eip155:42161"],
        "maxAmount": "1000000000",
        "permitDeadline": 300,
        "sponsorAddress": "0xFacilitator..."
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
| permitSignature | string | Yes | Full hex-encoded EIP-2612 permit signature (65 bytes, `r + s + v`) |
| owner | string | Yes | Token owner address (the client's wallet) |
| spender | string | Yes | Spender address (must match `sponsorAddress`) |
| value | string | Yes | Token amount in base units |
| deadline | number | Yes | Unix timestamp for permit expiry |
| v | number | Yes | Recovery parameter from signature (27 or 28) |
| r | string | Yes | Signature r component (32 bytes hex) |
| s | string | Yes | Signature s component (32 bytes hex) |

**Example Client Payload:**

```json
{
  "eip2612GasSponsoring": {
    "network": "eip155:8453",
    "permitSignature": "0xaabb...1b",
    "owner": "0xClient...",
    "spender": "0xFacilitator...",
    "value": "1000000",
    "deadline": 1700000300,
    "v": 27,
    "r": "0xaabb...",
    "s": "0xccdd..."
  }
}
```

## EIP-2612 Permit Signature

The client signs EIP-712 typed data with the following structure:

**Domain:**
```json
{
  "name": "<token name>",
  "version": "1",
  "chainId": "<numeric chain ID>",
  "verifyingContract": "<token contract address>"
}
```

**Types:**
```json
{
  "Permit": [
    { "name": "owner", "type": "address" },
    { "name": "spender", "type": "address" },
    { "name": "value", "type": "uint256" },
    { "name": "nonce", "type": "uint256" },
    { "name": "deadline", "type": "uint256" }
  ]
}
```

The permit nonce is managed by the token contract itself, preventing replay attacks.

## Validation Rules

- `network` MUST be present in the server's `sponsoredNetworks` list
- `value` MUST NOT exceed the server's `maxAmount`
- `deadline` MUST be in the future
- `deadline` MUST NOT exceed `permitDeadline` seconds from the current time
- `spender` MUST match the server's `sponsorAddress` (case-insensitive)
- `permitSignature` MUST be exactly 130 hex characters (65 bytes) after removing `0x` prefix
- `v` MUST be 27 or 28
- `r` and `s` MUST each be 64 hex characters (32 bytes) after removing `0x` prefix

## Facilitator Flow

1. Extract the `eip2612GasSponsoring` extension from the payment payload
2. Validate the permit payload against the extension info
3. Call `permit(owner, spender, value, deadline, v, r, s)` on the token contract
4. Settle the payment via Permit2 `transferFrom`
5. The facilitator pays gas for both transactions

## Security Considerations

- The sponsor address should be a controlled facilitator wallet with sufficient native token balance for gas
- Servers should enforce rate limits to prevent permit spam
- The `maxAmount` should be set conservatively to limit sponsor exposure
- Permit deadlines should be kept short (minutes, not hours) to minimize replay window
- Facilitators MUST verify the permit signature on-chain before executing `transferFrom`
- The permit nonce is managed by the token contract itself (EIP-2612), preventing replay attacks
- Only ERC-20 tokens that implement EIP-2612 are supported

## SDK Implementations

| SDK | Package/Module | Import Path |
|-----|---------------|-------------|
| TypeScript | @t402/extensions | `@t402/extensions/eip2612-gas-sponsoring` |
| Go | extensions | `github.com/t402-io/t402/sdks/go/extensions/eip2612gassponsor` |

## Examples

### Server-Side

```typescript
import {
  declareEip2612GasSponsorExtension,
  parseEip2612GasSponsorHeader,
  validateEip2612GasSponsorPayload,
} from "@t402/extensions/eip2612-gas-sponsoring";

// Declare extension in 402 response
const extension = declareEip2612GasSponsorExtension({
  sponsoredNetworks: ["eip155:8453", "eip155:42161"],
  maxAmount: "1000000000",
  permitDeadline: 300,
  sponsorAddress: "0xFacilitator...",
});

// Parse and validate client payload
const payload = parseEip2612GasSponsorHeader(request.headers["x-t402-eip2612-gas-sponsoring"]);
const result = validateEip2612GasSponsorPayload(payload, extension.info);
```

### Client-Side

```typescript
import {
  createPermitSignature,
  createEip2612GasSponsorPayload,
  encodeEip2612GasSponsorHeader,
  EIP2612_GAS_SPONSOR_HEADER_NAME,
} from "@t402/extensions/eip2612-gas-sponsoring";

const permit = await createPermitSignature({
  signer,
  tokenAddress: "0xUSDT...",
  tokenName: "Tether USD",
  chainId: 8453,
  spender: extension.info.sponsorAddress,
  value: "1000000",
  deadline: Math.floor(Date.now() / 1000) + extension.info.permitDeadline,
});

const payload = createEip2612GasSponsorPayload(permit, "eip155:8453");
fetch(url, {
  headers: { [EIP2612_GAS_SPONSOR_HEADER_NAME]: encodeEip2612GasSponsorHeader(payload) },
});
```

### Facilitator-Side

```typescript
import {
  extractEip2612GasSponsorPayload,
  validateEip2612GasSponsorPayload,
} from "@t402/extensions/eip2612-gas-sponsoring";

// Extract permit from payment extensions
const permit = extractEip2612GasSponsorPayload(paymentPayload.extensions);
if (permit) {
  const result = validateEip2612GasSponsorPayload(permit, extensionInfo);
  if (result.valid) {
    // Submit permit() tx, then settle via Permit2
  }
}
```
