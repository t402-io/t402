# Extension: Payment Identifier

## Summary

The Payment Identifier extension attaches unique identifiers to payment transactions for correlation, idempotency, and audit trails. Servers can declare a payment ID in the `PaymentRequired` response, and clients can append a client-side ID for cross-referencing.

## Extension Key

```
paymentId
```

## Data Format

### Server Declaration

The server includes the payment identifier extension in the `extensions` field of the `PaymentRequired` response.

**Info Object:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | Server-generated unique payment identifier (e.g., UUID v4) |
| idempotencyKey | string | No | Key for ensuring idempotent payment processing |
| groupId | string | No | Group identifier for correlating related payments |
| metadata | object | No | Additional metadata (e.g., invoice number, order ID) |

**Schema:** JSON Schema validating the info object:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["id"],
  "properties": {
    "id": {
      "type": "string",
      "description": "Server-generated unique payment identifier"
    },
    "idempotencyKey": {
      "type": "string",
      "description": "Key for idempotent payment processing"
    },
    "groupId": {
      "type": "string",
      "description": "Group identifier for related payments"
    },
    "metadata": {
      "type": "object",
      "description": "Additional metadata"
    }
  }
}
```

**Example Server Declaration:**

```json
{
  "extensions": {
    "paymentId": {
      "info": {
        "id": "pay_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "idempotencyKey": "idem_20260218_user123_premium",
        "groupId": "session_xyz789",
        "metadata": {
          "invoiceNumber": "INV-2026-001",
          "resourceType": "api-call"
        }
      },
      "schema": {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "required": ["id"],
        "properties": {
          "id": { "type": "string" },
          "idempotencyKey": { "type": "string" },
          "groupId": { "type": "string" },
          "metadata": { "type": "object" }
        }
      }
    }
  }
}
```

### Client Payload

The client echoes the `paymentId` extension from the server and may append a client-side identifier.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | Server-generated ID (echoed from server) |
| clientId | string | No | Client-generated ID for cross-referencing |

**Example Client Payload:**

```json
{
  "extensions": {
    "paymentId": {
      "info": {
        "id": "pay_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "clientId": "client_req_98765"
      },
      "schema": {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "required": ["id"],
        "properties": {
          "id": { "type": "string" },
          "clientId": { "type": "string" }
        }
      }
    }
  }
}
```

## Validation Rules

- The `id` field is required and must be a non-empty string.
- The server-generated `id` must be unique within the facilitator's scope.
- If `idempotencyKey` is provided, the facilitator should ensure that duplicate submissions with the same key result in the same outcome (not double-charged).
- The client must preserve the server's `id` when echoing the extension.
- The client may add a `clientId` but must not modify or remove the server's `id`.

## Security Considerations

- **Uniqueness**: The `id` should be generated using a cryptographically secure random source (e.g., UUID v4) to prevent prediction or collision.
- **Replay Prevention**: Combined with EIP-3009 nonces, the `idempotencyKey` provides an additional layer of replay prevention at the application level.
- **Privacy**: The `metadata` field should not contain personally identifiable information (PII) unless the server-client relationship warrants it.
- **Correlation Limits**: The `groupId` enables correlating payments within a session but should not be used to track users across sessions without consent.

## SDK Implementations

| SDK | Package | Import Path |
|-----|---------|-------------|
| TypeScript | @t402/extensions | `@t402/extensions/payment-id` |
| Go | extensions | `github.com/t402-io/t402/sdks/go/extensions` |

## Examples

### Server-Side (TypeScript)

```typescript
import { v4 as uuidv4 } from 'uuid';

const paymentRequired = {
  t402Version: 2,
  resource: { url: "https://api.example.com/data" },
  accepts: [ /* payment requirements */ ],
  extensions: {
    paymentId: {
      info: {
        id: `pay_${uuidv4()}`,
        idempotencyKey: `idem_${Date.now()}_${userId}`,
        groupId: sessionId,
      },
      schema: {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string" },
          idempotencyKey: { type: "string" },
          groupId: { type: "string" },
        }
      }
    }
  }
};
```

### Facilitator-Side

```typescript
// After receiving payment payload
const paymentId = paymentPayload.extensions?.paymentId?.info;
if (paymentId) {
  // Check idempotency
  if (paymentId.idempotencyKey) {
    const existing = await db.findByIdempotencyKey(paymentId.idempotencyKey);
    if (existing) {
      return existing.result; // Return cached result
    }
  }

  // Log for audit trail
  await db.logPayment({
    paymentId: paymentId.id,
    clientId: paymentId.clientId,
    groupId: paymentId.groupId,
    timestamp: new Date(),
  });
}
```
