# Extension: Sign-In-With-X (SIWx)

## Summary

The Sign-In-With-X (SIWx) extension provides CAIP-122 compliant wallet-based identity assertions for the t402 protocol. It allows clients to prove ownership of a wallet address, enabling use cases such as authenticated pricing (discounts for verified users), session-based access, and linking payments to identity without requiring separate authentication systems.

## Extension Key

```
siwx
```

## CAIP-122 Compliance

SIWx follows the [CAIP-122](https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-122.md) standard for sign-in messages, providing a chain-agnostic authentication mechanism. The message format is derived from EIP-4361 (Sign-In with Ethereum) and extended to support multiple chain families.

## Supported Signature Schemes

| Scheme | Description | Chain Family |
|--------|-------------|-------------|
| `eip191` | Personal sign (personal_sign) | EVM |
| `eip712` | Typed data signing (EIP-712) | EVM |
| `eip1271` | Smart contract signature verification | EVM (smart wallets) |
| `eip6492` | Universal signature with deployment | EVM (counterfactual wallets) |
| `siws` | Sign-In With Solana | Solana |
| `sep10` | Stellar SEP-10 | Stellar |

## Data Format

### Server Declaration (SIWxExtensionInfo)

The server includes the SIWx extension in the `extensions` field of the `PaymentRequired` response.

**Info Object:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| domain | string | Yes | Domain derived from resourceUri (without protocol) |
| uri | string | Yes | Full resource URI |
| statement | string | No | Human-readable explanation of the sign-in purpose |
| version | string | Yes | SIWx version (default: `"1"`) |
| chainId | string | Yes | Chain ID in CAIP-2 format (e.g., `"eip155:8453"`) |
| nonce | string | Yes | Cryptographically secure nonce (32 bytes hex) |
| issuedAt | string | Yes | ISO 8601 timestamp when message was issued |
| expirationTime | string | No | ISO 8601 timestamp when signature expires |
| notBefore | string | No | ISO 8601 timestamp before which signature is not valid |
| requestId | string | No | Optional request ID for session correlation |
| resources | string[] | Yes | Resources being authenticated for |
| signatureScheme | string | No | Preferred signature scheme (e.g., `"eip191"`) |

**Example Server Declaration:**

```json
{
  "extensions": {
    "siwx": {
      "info": {
        "domain": "api.example.com",
        "uri": "https://api.example.com/premium",
        "statement": "Sign in to access premium content with discounted pricing",
        "version": "1",
        "chainId": "eip155:8453",
        "nonce": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
        "issuedAt": "2026-02-18T12:00:00.000Z",
        "expirationTime": "2026-02-18T12:05:00.000Z",
        "resources": ["https://api.example.com/premium"],
        "signatureScheme": "eip191"
      },
      "schema": {
        "type": "object",
        "required": ["domain", "address", "uri", "version", "chainId", "nonce", "issuedAt", "signature"],
        "properties": {
          "domain": { "type": "string" },
          "address": { "type": "string" },
          "statement": { "type": "string" },
          "uri": { "type": "string" },
          "version": { "type": "string" },
          "chainId": { "type": "string" },
          "nonce": { "type": "string" },
          "issuedAt": { "type": "string", "format": "date-time" },
          "expirationTime": { "type": "string", "format": "date-time" },
          "notBefore": { "type": "string", "format": "date-time" },
          "requestId": { "type": "string" },
          "resources": { "type": "array", "items": { "type": "string" } },
          "signature": { "type": "string" }
        }
      }
    }
  }
}
```

### Client Payload (SIWxPayload)

The client creates a CAIP-122 message, signs it, and includes the result in the `PaymentPayload.extensions` field. Additionally, the signed payload is sent as an HTTP header: `X-T402-SIWx` (base64-encoded JSON).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| domain | string | Yes | Domain from the server |
| address | string | Yes | Wallet address making the assertion |
| statement | string | No | Statement from the server |
| uri | string | Yes | Resource URI |
| version | string | Yes | SIWx version |
| chainId | string | Yes | Chain ID in CAIP-2 format |
| nonce | string | Yes | Nonce from server |
| issuedAt | string | Yes | ISO 8601 timestamp |
| expirationTime | string | No | Expiration time |
| notBefore | string | No | Not-before time |
| requestId | string | No | Request ID |
| resources | string[] | No | Resources array |
| signature | string | Yes | Cryptographic signature |

**Example Client Payload (EVM):**

```json
{
  "domain": "api.example.com",
  "address": "0x857b06519E91e3A54538791bDbb0E22373e36b66",
  "statement": "Sign in to access premium content with discounted pricing",
  "uri": "https://api.example.com/premium",
  "version": "1",
  "chainId": "eip155:8453",
  "nonce": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
  "issuedAt": "2026-02-18T12:00:00.000Z",
  "expirationTime": "2026-02-18T12:05:00.000Z",
  "resources": ["https://api.example.com/premium"],
  "signature": "0x1234abcd..."
}
```

**Example Client Payload (Solana):**

```json
{
  "domain": "api.example.com",
  "address": "CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5",
  "uri": "https://api.example.com/premium",
  "version": "1",
  "chainId": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  "nonce": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
  "issuedAt": "2026-02-18T12:00:00.000Z",
  "resources": ["https://api.example.com/premium"],
  "signature": "5678efgh..."
}
```

## CAIP-122 Message Format

The signed message follows the CAIP-122 format:

```
{domain} wants you to sign in with your {chainId} account:
{address}

{statement}

URI: {uri}
Version: {version}
Chain ID: {chainId}
Nonce: {nonce}
Issued At: {issuedAt}
Expiration Time: {expirationTime}
Not Before: {notBefore}
Request ID: {requestId}
Resources:
- {resource1}
- {resource2}
```

Optional fields are omitted if not present.

## Verification

### EVM Chains (eip155:*)

1. Reconstruct the CAIP-122 message from the payload
2. Apply EIP-191 personal message prefix: `"\x19Ethereum Signed Message:\n" + len(message) + message`
3. Keccak256 hash the prefixed message
4. Recover the signer address using secp256k1 ECDSA recovery
5. Compare recovered address with claimed `address` (case-insensitive)

For smart wallets (EIP-1271/EIP-6492), additionally call `isValidSignature(bytes32, bytes)` on the contract.

### Solana (solana:*)

1. Reconstruct the CAIP-122 message from the payload
2. Verify the Ed25519 signature directly against the message bytes
3. The `address` field is the base58-encoded public key

### Stellar (stellar:*)

1. Reconstruct the CAIP-122 message from the payload
2. Verify the Ed25519 signature against the message bytes
3. The `address` is the hex or base58-encoded public key

## Validation Rules

- `domain` must match the domain extracted from the resource URI
- `uri` must match the expected resource URI
- `version` must be `"1"`
- `issuedAt` must not be older than the `maxAge` threshold (default: 5 minutes)
- `expirationTime`, if present, must be in the future
- `notBefore`, if present, must be in the past
- `nonce` must not have been used before (replay prevention)
- The recovered/verified address must match the claimed `address`

## Security Considerations

- **Nonce Management**: Servers must track used nonces to prevent replay attacks. Use a time-bounded cache or database with TTL matching the `maxAge` setting.
- **Domain Binding**: Always validate that the `domain` field matches the server's actual domain to prevent phishing.
- **Time Validation**: Both `issuedAt` freshness and `expirationTime` must be checked to prevent use of stale or pre-signed messages.
- **Smart Wallet Support**: When `checkSmartWallet` is enabled, the server must have access to an Ethereum provider to call the wallet contract for EIP-1271 verification.
- **HTTP Header Transport**: The `X-T402-SIWx` header carries the base64-encoded payload. Ensure proper header size limits and validate the decoded content.
- **Signature Scheme Selection**: Prefer `eip191` for EOA wallets. Use `eip1271` or `eip6492` only when smart wallet verification is required.

## SDK Implementations

| SDK | Package | Import Path |
|-----|---------|-------------|
| TypeScript | @t402/extensions | `@t402/extensions/sign-in-with-x` |

### Server-Side (TypeScript)

```typescript
import {
  declareSIWxExtension,
  parseSIWxHeader,
  validateSIWxMessage,
  verifySIWxSignature
} from "@t402/extensions/sign-in-with-x";

// 1. Declare extension in 402 response
const extension = declareSIWxExtension({
  resourceUri: "https://api.example.com/premium",
  network: "eip155:8453",
  statement: "Sign in to access premium content",
});

// 2. Parse client header on subsequent request
const payload = parseSIWxHeader(request.headers['x-t402-siwx']);

// 3. Validate message fields
const validation = validateSIWxMessage(
  payload,
  "https://api.example.com/premium",
  { maxAge: 5 * 60 * 1000, checkNonce: (n) => !usedNonces.has(n) }
);

// 4. Verify signature
const verification = await verifySIWxSignature(payload, payload.signature);
if (verification.valid) {
  console.log("Authenticated address:", verification.address);
}
```

### Client-Side (TypeScript)

```typescript
import {
  createSIWxPayload,
  encodeSIWxHeader,
  SIWX_HEADER_NAME
} from "@t402/extensions/sign-in-with-x";

// Get extension from 402 response
const extension = paymentRequired.extensions?.siwx;

// Create signed payload
const payload = await createSIWxPayload(extension, {
  address: wallet.address,
  signMessage: (msg) => wallet.signMessage(msg),
});

// Send with retry
const response = await fetch(url, {
  headers: {
    [SIWX_HEADER_NAME]: encodeSIWxHeader(payload),
    'PAYMENT-SIGNATURE': paymentSignature,
  }
});
```
