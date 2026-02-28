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
import type { A2AExtension, A2ADataPart, A2AArtifact, A2AMessage } from "./a2a";
import {
  A2A_EXTENSIONS_HEADER,
  X402_A2A_EXTENSION_URI,
  createT402Extension,
  createX402Extension,
} from "./a2a";

// ============================================================================
// AP2 Constants
// ============================================================================

/** AP2 extension URI for agent card declarations */
export const AP2_EXTENSION_URI = "https://github.com/google-agentic-commerce/ap2/tree/v0.1";

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

export type AP2Role = "merchant" | "shopper" | "credentials-provider" | "payment-processor";

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
 *
 * @param cartContents - The base cart contents to embed requirements into
 * @param requirements - The x402 payment requirements to embed
 * @param merchantAuthorization - Optional merchant authorization token
 * @returns A CartMandate with x402 requirements in PaymentMethodData
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
          m => m.supported_methods !== X402_PAYMENT_METHOD,
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
 *
 * @param cartMandate - The CartMandate to extract requirements from
 * @returns The extracted x402 PaymentRequirements, or undefined if not found
 */
export function extractX402Requirements(
  cartMandate: CartMandate,
): PaymentRequirements[] | undefined {
  const methodData = cartMandate.contents.payment_request.method_data.find(
    m => m.supported_methods === X402_PAYMENT_METHOD,
  );
  if (!methodData?.data?.requirements) return undefined;
  return methodData.data.requirements as PaymentRequirements[];
}

/**
 * Create a PaymentMandate with x402 PaymentPayload embedded in
 * the PaymentResponse.details for method "https://www.x402.org/".
 *
 * @param mandateContents - The base payment mandate contents
 * @param payload - The x402 payment payload to embed
 * @param userAuthorization - Optional user authorization token
 * @returns A PaymentMandate with x402 payload in PaymentResponse details
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
 *
 * @param mandate - The PaymentMandate to extract the payload from
 * @returns The extracted x402 PaymentPayload, or undefined if not found
 */
export function extractX402Payload(mandate: PaymentMandate): PaymentPayload | undefined {
  const response = mandate.payment_mandate_contents.payment_response;
  if (response.method_name !== X402_PAYMENT_METHOD) return undefined;
  return response.details as unknown as PaymentPayload | undefined;
}

// ============================================================================
// Extension Helper
// ============================================================================

/**
 * Create an AP2 extension declaration for agent cards.
 *
 * @param roles - The AP2 roles this agent supports
 * @param required - Whether the extension is required
 * @returns An A2A extension declaration for AP2
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
// AgentCard & Header Helpers
// ============================================================================

/**
 * Create a complete payment extensions array for an AgentCard.
 * Returns [t402, x402, ap2?] extensions ready for capabilities.extensions.
 *
 * @param options - Configuration for extension declarations
 * @param options.ap2Roles - AP2 roles to advertise (omit to exclude AP2 extension)
 * @param options.t402Required - Whether the t402 extension is required
 * @param options.x402Required - Whether the x402 extension is required
 * @param options.ap2Required - Whether the AP2 extension is required
 * @returns Array of A2A extension declarations
 */
export function createPaymentExtensions(
  options: {
    ap2Roles?: AP2Role[];
    t402Required?: boolean;
    x402Required?: boolean;
    ap2Required?: boolean;
  } = {},
): A2AExtension[] {
  const extensions: A2AExtension[] = [
    createT402Extension(options.t402Required ?? false),
    createX402Extension(options.x402Required ?? false),
  ];
  if (options.ap2Roles) {
    extensions.push(createAP2Extension(options.ap2Roles, options.ap2Required ?? false));
  }
  return extensions;
}

/**
 * Get HTTP headers for A2A payment extension activation.
 * Returns the X-A2A-Extensions header with the x402 v0.2 URI.
 *
 * @param includeAP2 - Whether to include the AP2 extension URI
 * @returns Header name/value map
 */
export function getPaymentExtensionHeaders(includeAP2: boolean = false): Record<string, string> {
  const uris = [X402_A2A_EXTENSION_URI];
  if (includeAP2) {
    uris.push(AP2_EXTENSION_URI);
  }
  return { [A2A_EXTENSIONS_HEADER]: uris.join(", ") };
}

// ============================================================================
// DataPart Envelope Helpers
// ============================================================================

/**
 * Create a DataPart containing a CartMandate.
 *
 * @param cartMandate - The CartMandate to wrap
 * @returns An A2ADataPart containing the CartMandate
 */
export function createCartMandateDataPart(cartMandate: CartMandate): A2ADataPart {
  return {
    kind: "data",
    data: { [AP2_DATA_KEYS.CART_MANDATE]: cartMandate as unknown as Record<string, unknown> },
  };
}

/**
 * Create a DataPart containing a PaymentMandate.
 *
 * @param paymentMandate - The PaymentMandate to wrap
 * @returns An A2ADataPart containing the PaymentMandate
 */
export function createPaymentMandateDataPart(paymentMandate: PaymentMandate): A2ADataPart {
  return {
    kind: "data",
    data: { [AP2_DATA_KEYS.PAYMENT_MANDATE]: paymentMandate as unknown as Record<string, unknown> },
  };
}

/**
 * Create a DataPart containing an IntentMandate.
 *
 * @param intentMandate - The IntentMandate to wrap
 * @returns An A2ADataPart containing the IntentMandate
 */
export function createIntentMandateDataPart(intentMandate: IntentMandate): A2ADataPart {
  return {
    kind: "data",
    data: { [AP2_DATA_KEYS.INTENT_MANDATE]: intentMandate as unknown as Record<string, unknown> },
  };
}

/**
 * Create a DataPart containing a PaymentReceipt.
 *
 * @param receipt - The PaymentReceipt to wrap
 * @returns An A2ADataPart containing the PaymentReceipt
 */
export function createPaymentReceiptDataPart(receipt: PaymentReceipt): A2ADataPart {
  return {
    kind: "data",
    data: { [AP2_DATA_KEYS.PAYMENT_RECEIPT]: receipt as unknown as Record<string, unknown> },
  };
}

/**
 * Extract a CartMandate from an Artifact's parts.
 *
 * @param artifact - The A2A artifact to search for a CartMandate
 * @returns The extracted CartMandate, or undefined if not found
 */
export function extractCartMandateFromArtifact(artifact: A2AArtifact): CartMandate | undefined {
  if (!artifact.parts) return undefined;
  for (const part of artifact.parts) {
    if (part.kind === "data" && (part as A2ADataPart).data?.[AP2_DATA_KEYS.CART_MANDATE]) {
      return (part as A2ADataPart).data[AP2_DATA_KEYS.CART_MANDATE] as unknown as CartMandate;
    }
  }
  return undefined;
}

/**
 * Extract a PaymentMandate from a Message's parts.
 *
 * @param message - The A2A message to search for a PaymentMandate
 * @returns The extracted PaymentMandate, or undefined if not found
 */
export function extractPaymentMandateFromMessage(message: A2AMessage): PaymentMandate | undefined {
  for (const part of message.parts) {
    if (part.kind === "data" && (part as A2ADataPart).data?.[AP2_DATA_KEYS.PAYMENT_MANDATE]) {
      return (part as A2ADataPart).data[AP2_DATA_KEYS.PAYMENT_MANDATE] as unknown as PaymentMandate;
    }
  }
  return undefined;
}
