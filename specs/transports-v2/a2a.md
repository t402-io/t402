# Transport: A2A (Agent-to-Agent Protocol)

## Summary

The A2A transport implements t402 payment flows over the Agent-to-Agent protocol using JSON-RPC messages and task-based state management. This enables AI agents to monetize their services through on-chain cryptocurrency payments within the A2A framework, leveraging the protocol's task lifecycle and metadata system for payment coordination.

## Payment Required Signaling

The server agent indicates payment is required using A2A's task state `input-required` with payment metadata.

**Mechanism**: Task with `state: "input-required"` and `t402.payment.status: "payment-required"` in message metadata  
**Data Format**: `PaymentRequired` schema in `t402.payment.required` metadata field

**Example:**

```json
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "result": {
    "kind": "task",
    "id": "task-123",
    "status": {
      "state": "input-required",
      "message": {
        "kind": "message",
        "role": "agent",
        "parts": [
          {
            "kind": "text",
            "text": "Payment is required to generate the image."
          }
        ],
        "metadata": {
          "t402.payment.status": "payment-required",
          "t402.payment.required": {
            "t402Version": 2,
            "error": "Payment required to access this resource",
            "resource": {
              "url": "https://api.example.com/generate-image",
              "description": "Generate an image",
              "mimeType": "image/png"
            },
            "accepts": [
              {
                "scheme": "exact",
                "network": "eip155:8453",
                "amount": "48240000",
                "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bda02913",
                "payTo": "0xServerWalletAddressHere",
                "maxTimeoutSeconds": 600,
                "extra": {
                  "name": "USD Coin",
                  "version": "2"
                }
              }
            ]
          }
        }
      }
    }
  }
}
```

## Payment Payload Transmission

Clients send payment data using the A2A message metadata with task correlation.

**Mechanism**: Message with `t402.payment.payload` metadata field and `taskId` for correlation  
**Data Format**: `PaymentPayload` schema in `t402.payment.payload` metadata field

**Example:**

```json
{
  "jsonrpc": "2.0",
  "method": "message/send",
  "id": "req-003",
  "params": {
    "message": {
      "taskId": "task-123",
      "role": "user",
      "parts": [
        { "kind": "text", "text": "Here is the payment authorization." }
      ],
      "metadata": {
        "t402.payment.status": "payment-submitted",
        "t402.payment.payload": {
          "t402Version": 2,
          "resource": {
            "url": "https://api.example.com/generate-image",
            "description": "Generate an image",
            "mimeType": "image/png"
          },
          "accepted": {
          "scheme": "exact",
            "network": "eip155:8453",
            "amount": "48240000",
            "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bda02913",
            "payTo": "0xServerWalletAddressHere",
            "maxTimeoutSeconds": 600,
            "extra": {
              "name": "USD Coin",
              "version": "2"
            }
          },
          "payload": {
            "signature": "0x2d6a7588d6acca505cbf0d9a4a227e0c52c6c34008c8e8986a1283259764173608a2ce6496642e377d6da8dbbf5836e9bd15092f9ecab05ded3d6293af148b571c",
            "authorization": {
              "from": "0x857b06519E91e3A54538791bDbb0E22373e36b66",
              "to": "0xServerWalletAddressHere",
              "value": "48240000",
              "validAfter": "1740672089",
              "validBefore": "1740672154",
              "nonce": "0xf3746613c2d920b5fdabc0856f2aeb2d4f88ee6037b8cc5d04a71a4462f13480"
            }
          }
        }
      }
    }
  }
}
```

## Settlement Response Delivery

Servers communicate payment settlement results using task status updates with settlement metadata.

**Mechanism**: Task status update with `t402.payment.receipts` metadata field  
**Data Format**: Array of `SettlementResponse` schemas in `t402.payment.receipts` metadata field

**Example (Successful Settlement):**

```json
{
  "jsonrpc": "2.0",
  "id": "req-003",
  "result": {
    "kind": "task",
    "id": "task-123",
    "status": {
      "state": "completed",
      "message": {
        "kind": "message",
        "role": "agent",
        "parts": [
          { "kind": "text", "text": "Payment successful. Your image is ready." }
        ],
        "metadata": {
          "t402.payment.status": "payment-completed",
          "t402.payment.receipts": [
            {
              "success": true,
              "transaction": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
              "network": "eip155:8453",
              "payer": "0x857b06519E91e3A54538791bDbb0E22373e36b66"
            }
          ]
        }
      }
    },
    "artifacts": [
      {
        "kind": "image",
        "name": "generated-image.png",
        "mimeType": "image/png",
        "data": "base64-encoded-image-data"
      }
    ]
  }
}
```

**Example (Payment Failure):**

```json
{
  "jsonrpc": "2.0",
  "id": "req-003",
  "result": {
    "kind": "task",
    "id": "task-123",
    "status": {
      "state": "failed",
      "message": {
        "kind": "message",
        "role": "agent",
        "parts": [
          {
            "kind": "text",
            "text": "Payment verification failed: The signature has expired."
          }
        ],
        "metadata": {
          "t402.payment.status": "payment-failed",
          "t402.payment.error": "EXPIRED_PAYMENT",
          "t402.payment.receipts": [
            {
              "success": false,
              "errorReason": "Payment authorization was submitted after its 'validBefore' timestamp.",
              "network": "eip155:8453",
              "transaction": ""
            }
          ]
        }
      }
    }
  }
}
```

## Payment Status Lifecycle

The A2A transport uses a detailed payment status progression tracked in the `t402.payment.status` metadata field:

| Status              | Description                               | Task State                   |
| ------------------- | ----------------------------------------- | ---------------------------- |
| `payment-required`  | Payment requirements sent to client       | `input-required`             |
| `payment-rejected`  | Client rejected payment requirements      | `failed` or `input-required` |
| `payment-submitted` | Payment payload received by server        | `input-required` → `working` |
| `payment-verified`  | Payment payload verified by server        | `working`                    |
| `payment-completed` | Payment settled on-chain successfully     | `working` → `completed`      |
| `payment-failed`    | Payment verification or settlement failed | `failed`                     |

## Error Handling

A2A transport maps t402 errors to task states and metadata:

| t402 Error       | Task State       | Payment Status      | Description                                     |
| ---------------- | ---------------- | ------------------- | ----------------------------------------------- |
| Payment Required | `input-required` | `payment-required`  | Payment needed to access resource               |
| Payment Rejected | `failed`         | `payment-rejected`  | Client declined payment requirements            |
| Invalid Payment  | `failed`         | `payment-failed`    | Malformed payment payload or requirements       |
| Payment Failed   | `failed`         | `payment-failed`    | Payment verification or settlement failed       |
| Server Error     | `failed`         | `payment-failed`    | Internal server error during payment processing |
| Success          | `completed`      | `payment-completed` | Payment verified and settled successfully       |

**Error Response Format:**

Task state transitions to `failed` with detailed error information in metadata:

```json
{
  "kind": "task",
  "id": "task-123",
  "status": {
    "state": "failed",
    "message": {
      "kind": "message",
      "role": "agent",
      "parts": [
        {
          "kind": "text",
          "text": "Payment verification failed: insufficient funds"
        }
      ],
      "metadata": {
        "t402.payment.status": "payment-failed",
        "t402.payment.error": "INSUFFICIENT_FUNDS",
        "t402.payment.receipts": [
          {
            "success": false,
            "errorReason": "The client's wallet has insufficient funds to cover the payment.",
            "network": "eip155:8453",
            "transaction": ""
          }
        ]
      }
    }
  }
}
```

## Extension Declaration and Activation

Agents supporting t402 payments must declare the extension in their AgentCard:

```json
{
  "capabilities": {
    "extensions": [
      {
        "uri": "https://github.com/google-a2a/a2a-t402/v0.1",
        "description": "Supports payments using the t402 protocol for on-chain settlement.",
        "required": true
      }
    ]
  }
}
```

Clients must activate the extension using the `X-A2A-Extensions` HTTP header:

```http
X-A2A-Extensions: https://github.com/google-a2a/a2a-t402/v0.1
```

## x402 Compatibility Layer

All t402 metadata keys have x402 equivalents for backward compatibility with the x402 v0.2 specification.

### Dual-Namespace Metadata

| t402 Key (canonical) | x402 Key (compatibility) |
| -------------------- | ------------------------ |
| `t402.payment.status` | `x402.payment.status` |
| `t402.payment.required` | `x402.payment.required` |
| `t402.payment.payload` | `x402.payment.payload` |
| `t402.payment.receipts` | `x402.payment.receipts` |
| `t402.payment.error` | `x402.payment.error` |

**Read Behavior:** Implementations MUST check the t402 key first, falling back to x402 if not found.

**Write Behavior:** Implementations SHOULD write both namespaces for maximum compatibility.

### Extension URIs

| URI | Description |
| --- | ----------- |
| `https://github.com/google-a2a/a2a-t402/v0.1` | Canonical t402 extension |
| `https://github.com/google-agentic-commerce/a2a-x402/blob/main/spec/v0.2` | x402 v0.2 compatibility |

Agents MAY advertise both extensions in their AgentCard. Clients activate with the `X-A2A-Extensions` header.

### Error Code Mapping

When emitting x402-namespace errors, implementations map t402 error codes:

| t402 Error Code | x402 Error Code |
| --------------- | --------------- |
| T402-1001 | INVALID_AMOUNT |
| T402-2001 | VERIFICATION_FAILED |
| T402-3001 | SETTLEMENT_FAILED |
| T402-5001 | INTERNAL_ERROR |
| T402-5002 | INTERNAL_ERROR |

### CAIP-2 to Flat Name Downgrade

For V1-compatible x402 payloads, CAIP-2 network identifiers are downgraded to flat names (e.g., `eip155:8453` -> `base`).

### Flow Detection

- **Standalone flow**: `t402.payment.required` (or `x402.payment.required`) is present in task status message metadata
- **Embedded flow**: `t402.payment.status` is `payment-required` but NO `t402.payment.required` key — requirements are in CartMandate artifacts instead

## AP2 Embedded Flow

### Overview

The Agent Payments Protocol (AP2) defines a W3C Payment Request-based embedded flow where x402 payment requirements are wrapped inside AP2 CartMandate artifacts rather than message metadata. This enables richer payment experiences including shopping carts, multi-item purchases, and mandate-based authorization.

### Mandate Lifecycle

1. **IntentMandate** — User declares purchase intent
2. **CartMandate** — Server presents cart with x402 requirements in `PaymentMethodData`
3. **PaymentMandate** — Client signs payment, wraps in mandate with user authorization
4. **PaymentReceipt** — Server confirms settlement

### CartMandate with x402 Requirements

The server embeds x402 requirements in the CartMandate's `PaymentMethodData`:

```json
{
  "kind": "task",
  "id": "task-456",
  "status": {
    "state": "input-required",
    "message": {
      "kind": "message",
      "role": "agent",
      "parts": [{ "kind": "text", "text": "Payment is required." }],
      "metadata": {
        "t402.payment.status": "payment-required",
        "x402.payment.status": "payment-required"
      }
    }
  },
  "artifacts": [{
    "kind": "ap2.cart",
    "name": "Cart Mandate",
    "parts": [{
      "kind": "data",
      "data": {
        "ap2.mandates.CartMandate": {
          "contents": {
            "id": "cart-001",
            "user_cart_confirmation_required": true,
            "payment_request": {
              "method_data": [{
                "supported_methods": "https://www.x402.org/",
                "data": {
                  "requirements": [{
                    "scheme": "exact",
                    "network": "eip155:8453",
                    "amount": "1000000",
                    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bda02913",
                    "payTo": "0xServerWallet...",
                    "maxTimeoutSeconds": 600
                  }]
                }
              }],
              "details": {
                "id": "details-001",
                "display_items": [{ "label": "Weather API", "amount": { "currency": "USD", "value": 1 } }],
                "total": { "label": "Total", "amount": { "currency": "USD", "value": 1 } }
              }
            },
            "cart_expiry": "2026-03-01T00:00:00Z",
            "merchant_name": "Weather Agent"
          }
        }
      }
    }]
  }]
}
```

Note the key differences from standalone flow:
- `metadata` has `t402.payment.status` but NO `t402.payment.required` (signals embedded flow)
- Requirements live in `artifacts[].parts[].data["ap2.mandates.CartMandate"]`

### PaymentMandate with x402 Payload

The client wraps the signed x402 payload in a PaymentMandate DataPart:

```json
{
  "kind": "message",
  "role": "user",
  "parts": [
    { "kind": "text", "text": "Here is the payment mandate." },
    {
      "kind": "data",
      "data": {
        "ap2.mandates.PaymentMandate": {
          "payment_mandate_contents": {
            "payment_mandate_id": "mandate-001",
            "payment_details_id": "details-001",
            "payment_details_total": { "label": "Total", "amount": { "currency": "USD", "value": 1 } },
            "payment_response": {
              "request_id": "details-001",
              "method_name": "https://www.x402.org/",
              "details": {
                "t402Version": 2,
                "resource": { "url": "a2a://agent/weather" },
                "accepted": { "scheme": "exact", "network": "eip155:8453", "amount": "1000000" },
                "payload": { "signature": "0xabc...", "authorization": { "..." } }
              }
            },
            "merchant_agent": "weather-agent",
            "timestamp": "2026-02-25T12:00:00Z"
          }
        }
      }
    }
  ],
  "metadata": {
    "t402.payment.status": "payment-submitted",
    "x402.payment.status": "payment-submitted"
  }
}
```

### DataPart Canonical Keys

| Key | Description |
| --- | ----------- |
| `ap2.mandates.IntentMandate` | User purchase intent |
| `ap2.mandates.CartMandate` | Shopping cart with payment methods |
| `ap2.mandates.PaymentMandate` | Signed payment authorization |
| `ap2.PaymentReceipt` | Settlement confirmation |

### AP2 Extension Declaration

Agents supporting AP2 advertise it alongside t402/x402:

```json
{
  "capabilities": {
    "extensions": [
      { "uri": "https://github.com/google-a2a/a2a-t402/v0.1", "required": false },
      { "uri": "https://github.com/google-agentic-commerce/a2a-x402/blob/main/spec/v0.2", "required": false },
      { "uri": "https://github.com/google-agentic-commerce/ap2/tree/v0.1", "description": "AP2 payment agent (roles: merchant).", "required": false }
    ]
  }
}
```

## References

- [Core t402 Specification](../t402-specification-v2.md)
- [A2A Protocol Specification](https://a2a-protocol.org/latest/specification)
- [A2A Extensions Documentation](https://github.com/a2aproject/A2A/blob/main/docs/topics/extensions.md)
- [A2A t402 Extension Specification](https://github.com/google-agentic-commerce/a2a-t402/blob/main/spec/v0.1/spec.md)
- [AP2 Specification](https://github.com/google-agentic-commerce/ap2/tree/v0.1)
- [A2A x402 Extension Specification](https://github.com/google-agentic-commerce/a2a-x402/blob/main/spec/v0.2)
