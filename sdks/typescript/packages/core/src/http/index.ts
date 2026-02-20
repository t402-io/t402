import { SettleResponse } from "../types";
import { PaymentPayload, PaymentRequired, PaymentRequirements } from "../types/payments";
import {
  PaymentPayloadSchema,
  PaymentRequiredSchema,
  SettleResponseSchema,
} from "../types/schemas";
import { Base64EncodedRegex, safeBase64Decode, safeBase64Encode } from "../utils";

// HTTP Methods that typically use query parameters
export type QueryParamMethods = "GET" | "HEAD" | "DELETE";

// HTTP Methods that typically use request body
export type BodyMethods = "POST" | "PUT" | "PATCH";

/**
 * Encodes a payment payload as a base64 header value.
 *
 * @param paymentPayload - The payment payload to encode
 * @returns Base64 encoded string representation of the payment payload
 */
export function encodePaymentSignatureHeader(paymentPayload: PaymentPayload): string {
  return safeBase64Encode(JSON.stringify(paymentPayload));
}

/**
 * Decodes a base64 payment signature header into a payment payload.
 * Validates the payload structure using Zod schema.
 *
 * @param paymentSignatureHeader - The base64 encoded payment signature header
 * @returns The decoded and validated payment payload
 * @throws Error if the header is invalid or fails schema validation
 */
export function decodePaymentSignatureHeader(paymentSignatureHeader: string): PaymentPayload {
  if (!Base64EncodedRegex.test(paymentSignatureHeader)) {
    throw new Error("Invalid payment signature header");
  }
  const parsed = JSON.parse(safeBase64Decode(paymentSignatureHeader));
  // Validate structure with Zod, then cast to TypeScript type
  // (Zod validates the structure; TypeScript types add template literal constraints)
  PaymentPayloadSchema.parse(parsed);
  return parsed as PaymentPayload;
}

/**
 * Encodes a payment required object as a base64 header value.
 *
 * @param paymentRequired - The payment required object to encode
 * @returns Base64 encoded string representation of the payment required object
 */
export function encodePaymentRequiredHeader(paymentRequired: PaymentRequired): string {
  return safeBase64Encode(JSON.stringify(paymentRequired));
}

/**
 * Decodes a base64 payment required header into a payment required object.
 * Validates the structure using Zod schema.
 *
 * @param paymentRequiredHeader - The base64 encoded payment required header
 * @returns The decoded and validated payment required object
 * @throws Error if the header is invalid or fails schema validation
 */
export function decodePaymentRequiredHeader(paymentRequiredHeader: string): PaymentRequired {
  if (!Base64EncodedRegex.test(paymentRequiredHeader)) {
    throw new Error("Invalid payment required header");
  }
  const parsed = JSON.parse(safeBase64Decode(paymentRequiredHeader));
  // Validate structure with Zod, then cast to TypeScript type
  PaymentRequiredSchema.parse(parsed);
  return parsed as PaymentRequired;
}

/**
 * Encodes a payment response as a base64 header value.
 *
 * @param paymentResponse - The payment response to encode
 * @returns Base64 encoded string representation of the payment response
 */
export function encodePaymentResponseHeader(
  paymentResponse: SettleResponse & { requirements: PaymentRequirements },
): string {
  return safeBase64Encode(JSON.stringify(paymentResponse));
}

/**
 * Decodes a base64 payment response header into a settle response.
 * Validates the structure using Zod schema.
 *
 * @param paymentResponseHeader - The base64 encoded payment response header
 * @returns The decoded and validated settle response
 * @throws Error if the header is invalid or fails schema validation
 */
export function decodePaymentResponseHeader(paymentResponseHeader: string): SettleResponse {
  if (!Base64EncodedRegex.test(paymentResponseHeader)) {
    throw new Error("Invalid payment response header");
  }
  const parsed = JSON.parse(safeBase64Decode(paymentResponseHeader));
  // Validate structure with Zod, then cast to TypeScript type
  SettleResponseSchema.parse(parsed);
  return parsed as SettleResponse;
}

// Export HTTP service classes (values)
export { t402HTTPResourceServer, RouteConfigurationError } from "./t402HTTPResourceServer";
export { HTTPFacilitatorClient } from "./httpFacilitatorClient";
export { t402HTTPClient } from "./t402HTTPClient";
export { StreamingClient } from "./streamingClient";
export { IntentClient } from "./intentClient";

// Export HTTP types (type-only exports for isolatedModules compatibility)
export type {
  HTTPAdapter,
  HTTPRequestContext,
  HTTPResponseInstructions,
  HTTPProcessResult,
  PaywallConfig,
  PaywallProvider,
  PaymentOption,
  RouteConfig,
  RoutesConfig,
  CompiledRoute,
  DynamicPayTo,
  DynamicPrice,
  UnpaidResponseBody,
  UnpaidResponseResult,
  ProcessSettleResultResponse,
  ProcessSettleSuccessResponse,
  ProcessSettleFailureResponse,
  RouteValidationError,
} from "./t402HTTPResourceServer";
export type { FacilitatorClient, FacilitatorConfig, SettleOptions } from "./httpFacilitatorClient";

// Streaming types
export type {
  StreamStatus,
  StreamMetadata,
  Stream,
  StreamUpdate,
  StreamStats,
  OpenStreamRequest,
  UpdateStreamRequest,
  CloseStreamRequest,
  ListStreamsParams,
  OpenStreamResponse,
  UpdateStreamResponse,
  CloseStreamResponse,
  GetStreamResponse,
  ListStreamsResponse,
  PauseResumeResponse,
  StreamingClientConfig,
} from "./streamingClient";

// Intent types
export type {
  IntentStatus,
  IntentPriority,
  RouteStepType,
  RouteStep,
  Route,
  Intent,
  CreateIntentRequest,
  SelectRouteRequest,
  ExecuteIntentRequest,
  CancelIntentRequest,
  ListIntentsParams,
  CreateIntentResponse,
  SelectRouteResponse,
  ExecuteIntentResponse,
  GetIntentResponse,
  ListIntentsResponse,
  CancelIntentResponse,
  RefreshRoutesResponse,
  IntentStats,
  IntentClientConfig,
} from "./intentClient";
