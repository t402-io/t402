# Extension: AP2 (Agent Payments Protocol) Integration

## Summary

The AP2 integration extends t402's A2A transport with Google's Agent Payments Protocol (AP2), wrapping x402 payment requirements inside W3C Payment Request-based mandate structures. This enables structured shopping cart experiences, mandate-based authorization flows, and receipt tracking for agent-to-agent commerce.

## Extension Key

```
ap2
```

## 1. AP2 Protocol Overview

### 1.1 W3C Payment Request Subset

AP2 uses a subset of the W3C Payment Request API for payment method selection:

- `PaymentCurrencyAmount` — `{ currency: string, value: number }`
- `PaymentItem` — `{ label: string, amount: PaymentCurrencyAmount, pending?: boolean }`
- `PaymentMethodData` — `{ supported_methods: string, data?: object }`
- `PaymentDetailsInit` — `{ id: string, display_items: PaymentItem[], total: PaymentItem }`

### 1.2 AP2 Roles

Agents declare their AP2 role in the extension description:

| Role | Description |
| ---- | ----------- |
| `merchant` | Provides goods/services, creates CartMandates |
| `shopper` | Purchases goods/services, creates PaymentMandates |
| `credentials-provider` | Issues Verifiable Credentials for authorization |
| `payment-processor` | Settles payments (analogous to facilitator) |

### 1.3 Mandate Lifecycle

```
IntentMandate → CartMandate → PaymentMandate → PaymentReceipt
  (intent)       (cart)        (signed auth)    (settlement proof)
```

## 2. Data Format

### 2.1 Mandate Types

**IntentMandate:**
```json
{
  "natural_language_description": "Buy weather data for Tokyo",
  "user_cart_confirmation_required": true,
  "merchants": ["weather-agent"],
  "intent_expiry": "2026-03-01T00:00:00Z"
}
```

**CartContents:**
```json
{
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
```

**CartMandate** = `{ contents: CartContents, merchant_authorization?: string }`

**PaymentMandateContents:**
```json
{
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
      "payload": { "signature": "0xabc...", "authorization": {} }
    }
  },
  "merchant_agent": "weather-agent",
  "timestamp": "2026-02-25T12:00:00Z"
}
```

**PaymentMandate** = `{ payment_mandate_contents: PaymentMandateContents, user_authorization?: string }`

**PaymentReceipt:**
```json
{
  "payment_mandate_id": "mandate-001",
  "timestamp": "2026-02-25T12:00:01Z",
  "payment_id": "tx-001",
  "amount": { "currency": "USD", "value": 1 },
  "payment_status": { "merchant_confirmation_id": "0x1234abcd..." }
}
```

### 2.2 x402 Embedding

x402 requirements are embedded in `PaymentMethodData`:
```json
{
  "supported_methods": "https://www.x402.org/",
  "data": {
    "requirements": [
      {
        "scheme": "exact",
        "network": "eip155:8453",
        "amount": "1000000",
        "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bda02913",
        "payTo": "0xServerWallet...",
        "maxTimeoutSeconds": 600
      }
    ]
  }
}
```

x402 payloads are embedded in `PaymentResponse.details`:
```json
{
  "request_id": "details-001",
  "method_name": "https://www.x402.org/",
  "details": {
    "t402Version": 2,
    "resource": { "url": "a2a://agent/weather" },
    "accepted": { "scheme": "exact", "network": "eip155:8453", "amount": "1000000" },
    "payload": { "signature": "0xabc...", "authorization": {} }
  }
}
```

### 2.3 DataPart Canonical Keys

| Key | Carried In | Description |
| --- | ---------- | ----------- |
| `ap2.mandates.IntentMandate` | Message DataPart | User purchase intent |
| `ap2.mandates.CartMandate` | Artifact DataPart | Shopping cart with payment methods |
| `ap2.mandates.PaymentMandate` | Message DataPart | Signed payment authorization |
| `ap2.PaymentReceipt` | Message/Artifact DataPart | Settlement confirmation |

## 3. Constants

| Constant | Value |
| -------- | ----- |
| `AP2_EXTENSION_URI` | `https://github.com/google-agentic-commerce/ap2/tree/v0.1` |
| `X402_PAYMENT_METHOD` | `https://www.x402.org/` |

## 4. Bridge Functions

| Function | Input | Output |
| -------- | ----- | ------ |
| `createCartMandateWithX402` | CartContents + PaymentRequirements[] | CartMandate with x402 in method_data |
| `extractX402Requirements` | CartMandate | PaymentRequirements[] or undefined |
| `createPaymentMandateWithX402` | PaymentMandateContents + PaymentPayload | PaymentMandate with x402 in details |
| `extractX402Payload` | PaymentMandate | PaymentPayload or undefined |
| `createAP2Extension` | AP2Role[] | A2AExtension for AgentCard |
| `createPaymentExtensions` | options | [t402, x402, ap2?] extension array |
| `getPaymentExtensionHeaders` | includeAP2? | X-A2A-Extensions header map |

## 5. SDK Implementations

| SDK | Package | Import Path |
| --- | ------- | ----------- |
| TypeScript | `@t402/a2a` | `import { createCartMandateWithX402, ... } from '@t402/a2a'` |
| Go | `a2a` | `import "github.com/t402-io/t402/sdks/go/a2a"` |
| Python | `t402` | `from t402.a2a import create_cart_mandate_with_x402, ...` |
| Java | `io.t402` | `import io.t402.a2a.AP2Helpers` |

## 6. References

- [AP2 Specification](https://github.com/google-agentic-commerce/ap2/tree/v0.1)
- [A2A x402 Extension Specification](https://github.com/google-agentic-commerce/a2a-x402/blob/main/spec/v0.2)
- [W3C Payment Request API](https://www.w3.org/TR/payment-request/)
- [A2A Transport Spec](../transports-v2/a2a.md)
- [Core t402 Specification](../t402-specification-v2.md)
