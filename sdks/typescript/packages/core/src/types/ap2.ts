/**
 * AP2 (Agent Payments Protocol) Types
 *
 * W3C Payment Request API subset + AP2 mandate types for the
 * embedded payment flow where x402 requirements/payloads are
 * wrapped inside AP2 mandates.
 *
 * @see https://github.com/google-agentic-commerce/ap2/tree/v0.1
 * @see https://github.com/google-agentic-commerce/a2a-x402/blob/main/spec/v0.2
 */

import type { PaymentRequirements, PaymentPayload } from "./payments";
import type {
  A2AExtension,
  A2ADataPart,
  A2AArtifact,
  A2AMessage,
} from "./a2a";

// ============================================================================
// AP2 Constants
// ============================================================================

/** AP2 extension URI for agent card declarations */
export const AP2_EXTENSION_URI =
  "https://github.com/google-agentic-commerce/ap2/tree/v0.1";

/** x402 payment method identifier for AP2 PaymentMethodData */
export const X402_PAYMENT_METHOD = "https://www.x402.org/";

/** DataPart canonical keys for AP2 mandate types */
export const AP2_DATA_KEYS = {
  INTENT_MANDATE: "ap2.mandates.IntentMandate",
  CART_MANDATE: "ap2.mandates.CartMandate",
  PAYMENT_MANDATE: "ap2.mandates.PaymentMandate",
  PAYMENT_RECEIPT: "ap2.PaymentReceipt",
} as const;

// ============================================================================
// AP2 Role
// ============================================================================

export type AP2Role =
  | "merchant"
  | "shopper"
  | "credentials-provider"
  | "payment-processor";

// ============================================================================
// W3C Payment Request API (subset)
// ============================================================================

export interface PaymentCurrencyAmount {
  currency: string;
  value: number;
}

export interface PaymentItem {
  label: string;
  amount: PaymentCurrencyAmount;
  pending?: boolean;
}

export interface PaymentMethodData {
  supported_methods: string;
  data?: Record<string, unknown>;
}

export interface PaymentDetailsInit {
  id: string;
  display_items: PaymentItem[];
  total: PaymentItem;
}

export interface AP2PaymentRequest {
  method_data: PaymentMethodData[];
  details: PaymentDetailsInit;
}

export interface AP2PaymentResponse {
  request_id: string;
  method_name: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// AP2 Mandate Types
// ============================================================================

export interface IntentMandate {
  natural_language_description: string;
  user_cart_confirmation_required: boolean;
  merchants?: string[];
  skus?: string[];
  requires_refundability?: boolean;
  intent_expiry: string; // ISO 8601
}

export interface CartContents {
  id: string;
  user_cart_confirmation_required: boolean;
  payment_request: AP2PaymentRequest;
  cart_expiry: string; // ISO 8601
  merchant_name: string;
}

export interface CartMandate {
  contents: CartContents;
  merchant_authorization?: string;
}

export interface PaymentMandateContents {
  payment_mandate_id: string;
  payment_details_id: string;
  payment_details_total: PaymentItem;
  payment_response: AP2PaymentResponse;
  merchant_agent: string;
  timestamp: string; // ISO 8601
}

export interface PaymentMandate {
  payment_mandate_contents: PaymentMandateContents;
  user_authorization?: string;
}

export interface PaymentReceipt {
  payment_mandate_id: string;
  timestamp: string; // ISO 8601
  payment_id: string;
  amount: PaymentCurrencyAmount;
  payment_status:
    | { merchant_confirmation_id: string }
    | { error_message: string }
    | { failure_message: string };
}

// ============================================================================
// Bridge Functions — x402 ↔ AP2
// ============================================================================

/**
 * Create a CartMandate with x402 PaymentRequirements embedded in
 * the PaymentMethodData for method "https://www.x402.org/".
 */
export function createCartMandateWithX402(
  cartContents: CartContents,
  requirements: PaymentRequirements[],
  merchantAuthorization?: string,
): CartMandate {
  const x402MethodData: PaymentMethodData = {
    supported_methods: X402_PAYMENT_METHOD,
    data: { requirements },
  };

  const updatedContents: CartContents = {
    ...cartContents,
    payment_request: {
      ...cartContents.payment_request,
      method_data: [
        ...cartContents.payment_request.method_data.filter(
          (m) => m.supported_methods !== X402_PAYMENT_METHOD,
        ),
        x402MethodData,
      ],
    },
  };

  return {
    contents: updatedContents,
    merchant_authorization: merchantAuthorization,
  };
}

/**
 * Extract x402 PaymentRequirements from a CartMandate.
 */
export function extractX402Requirements(
  cartMandate: CartMandate,
): PaymentRequirements[] | undefined {
  const methodData = cartMandate.contents.payment_request.method_data.find(
    (m) => m.supported_methods === X402_PAYMENT_METHOD,
  );
  if (!methodData?.data?.requirements) return undefined;
  return methodData.data.requirements as PaymentRequirements[];
}

/**
 * Create a PaymentMandate with x402 PaymentPayload embedded in
 * the PaymentResponse.details for method "https://www.x402.org/".
 */
export function createPaymentMandateWithX402(
  mandateContents: PaymentMandateContents,
  payload: PaymentPayload,
  userAuthorization?: string,
): PaymentMandate {
  const updatedContents: PaymentMandateContents = {
    ...mandateContents,
    payment_response: {
      ...mandateContents.payment_response,
      method_name: X402_PAYMENT_METHOD,
      details: payload as unknown as Record<string, unknown>,
    },
  };

  return {
    payment_mandate_contents: updatedContents,
    user_authorization: userAuthorization,
  };
}

/**
 * Extract x402 PaymentPayload from a PaymentMandate.
 */
export function extractX402Payload(
  mandate: PaymentMandate,
): PaymentPayload | undefined {
  const response = mandate.payment_mandate_contents.payment_response;
  if (response.method_name !== X402_PAYMENT_METHOD) return undefined;
  return response.details as unknown as PaymentPayload | undefined;
}

// ============================================================================
// Extension Helper
// ============================================================================

/**
 * Create an AP2 extension declaration for agent cards.
 */
export function createAP2Extension(
  roles: AP2Role[] = ["merchant"],
  required: boolean = false,
): A2AExtension {
  return {
    uri: AP2_EXTENSION_URI,
    description: `AP2 payment agent (roles: ${roles.join(", ")}).`,
    required,
  };
}

// ============================================================================
// DataPart Envelope Helpers
// ============================================================================

/**
 * Create a DataPart containing a CartMandate.
 */
export function createCartMandateDataPart(
  cartMandate: CartMandate,
): A2ADataPart {
  return {
    kind: "data",
    data: { [AP2_DATA_KEYS.CART_MANDATE]: cartMandate as unknown as Record<string, unknown> },
  };
}

/**
 * Create a DataPart containing a PaymentMandate.
 */
export function createPaymentMandateDataPart(
  paymentMandate: PaymentMandate,
): A2ADataPart {
  return {
    kind: "data",
    data: { [AP2_DATA_KEYS.PAYMENT_MANDATE]: paymentMandate as unknown as Record<string, unknown> },
  };
}

/**
 * Create a DataPart containing an IntentMandate.
 */
export function createIntentMandateDataPart(
  intentMandate: IntentMandate,
): A2ADataPart {
  return {
    kind: "data",
    data: { [AP2_DATA_KEYS.INTENT_MANDATE]: intentMandate as unknown as Record<string, unknown> },
  };
}

/**
 * Create a DataPart containing a PaymentReceipt.
 */
export function createPaymentReceiptDataPart(
  receipt: PaymentReceipt,
): A2ADataPart {
  return {
    kind: "data",
    data: { [AP2_DATA_KEYS.PAYMENT_RECEIPT]: receipt as unknown as Record<string, unknown> },
  };
}

/**
 * Extract a CartMandate from an Artifact's parts.
 */
export function extractCartMandateFromArtifact(
  artifact: A2AArtifact,
): CartMandate | undefined {
  if (!artifact.parts) return undefined;
  for (const part of artifact.parts) {
    if (
      part.kind === "data" &&
      (part as A2ADataPart).data?.[AP2_DATA_KEYS.CART_MANDATE]
    ) {
      return (part as A2ADataPart).data[
        AP2_DATA_KEYS.CART_MANDATE
      ] as unknown as CartMandate;
    }
  }
  return undefined;
}

/**
 * Extract a PaymentMandate from a Message's parts.
 */
export function extractPaymentMandateFromMessage(
  message: A2AMessage,
): PaymentMandate | undefined {
  for (const part of message.parts) {
    if (
      part.kind === "data" &&
      (part as A2ADataPart).data?.[AP2_DATA_KEYS.PAYMENT_MANDATE]
    ) {
      return (part as A2ADataPart).data[
        AP2_DATA_KEYS.PAYMENT_MANDATE
      ] as unknown as PaymentMandate;
    }
  }
  return undefined;
}
