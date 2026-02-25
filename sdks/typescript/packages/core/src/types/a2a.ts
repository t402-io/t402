/**
 * A2A (Agent-to-Agent) Transport Types
 *
 * Implements t402 payment flows over the Agent-to-Agent protocol
 * using JSON-RPC messages and task-based state management.
 *
 * Supports dual-namespace metadata: t402.payment.* (canonical) and
 * x402.payment.* (compatibility layer for x402 v0.2 / AP2).
 *
 * @see https://github.com/google-a2a/a2a-t402/v0.1
 * @see https://github.com/google-agentic-commerce/a2a-x402/blob/main/spec/v0.2
 */

import type { PaymentPayload, PaymentRequired, ResourceInfo } from "./payments";
import type { SettleResponse } from "./facilitator";

// ============================================================================
// A2A Payment Status
// ============================================================================

/**
 * Payment status values used in A2A metadata
 */
export type A2APaymentStatus =
  | "payment-required" // Payment requirements sent to client
  | "payment-rejected" // Client rejected payment requirements
  | "payment-submitted" // Payment payload received by server
  | "payment-verified" // Payment payload verified by server
  | "payment-completed" // Payment settled on-chain successfully
  | "payment-failed"; // Payment verification or settlement failed

/**
 * A2A task states that correspond to payment states
 */
export type A2ATaskState =
  | "submitted"
  | "working"
  | "input-required"
  | "completed"
  | "canceled"
  | "failed"
  | "unknown";

// ============================================================================
// A2A Message Types
// ============================================================================

/**
 * A2A message part - text content
 */
export interface A2ATextPart {
  kind: "text";
  text: string;
}

/**
 * A2A message part - file content
 */
export interface A2AFilePart {
  kind: "file";
  file: {
    name?: string;
    mimeType?: string;
    bytes?: string; // base64 encoded
    uri?: string;
  };
}

/**
 * A2A message part - data content
 */
export interface A2ADataPart {
  kind: "data";
  data: Record<string, unknown>;
}

export type A2AMessagePart = A2ATextPart | A2AFilePart | A2ADataPart;

/**
 * A2A payment metadata fields
 */
export interface A2APaymentMetadata {
  /** Current payment status */
  "t402.payment.status"?: A2APaymentStatus;

  /** Payment requirements (when status is payment-required) */
  "t402.payment.required"?: PaymentRequired;

  /** Payment payload (when status is payment-submitted) */
  "t402.payment.payload"?: PaymentPayload;

  /** Settlement receipts (when status is payment-completed or payment-failed) */
  "t402.payment.receipts"?: SettleResponse[];

  /** Error code (when status is payment-failed) */
  "t402.payment.error"?: string;
}

/**
 * A2A message with payment metadata
 */
export interface A2AMessage {
  kind: "message";
  messageId?: string;
  role: "user" | "agent";
  parts: A2AMessagePart[];
  metadata?: A2APaymentMetadata & Record<string, unknown>;
}

// ============================================================================
// A2A Task Types
// ============================================================================

/**
 * A2A artifact (output from completed task)
 */
export interface A2AArtifact {
  kind: string;
  name?: string;
  description?: string;
  parts?: A2AMessagePart[];
  mimeType?: string;
  data?: string; // base64 encoded
  uri?: string;
  metadata?: Record<string, unknown>;
}

/**
 * A2A task status
 */
export interface A2ATaskStatus {
  state: A2ATaskState;
  message?: A2AMessage;
  timestamp?: string;
}

/**
 * A2A task
 */
export interface A2ATask {
  kind: "task";
  id: string;
  sessionId?: string;
  status: A2ATaskStatus;
  artifacts?: A2AArtifact[];
  history?: A2AMessage[];
  metadata?: Record<string, unknown>;
}

// ============================================================================
// A2A JSON-RPC Types
// ============================================================================

/**
 * A2A JSON-RPC request
 */
export interface A2ARequest<T = unknown> {
  jsonrpc: "2.0";
  method: string;
  id: string | number;
  params?: T;
}

/**
 * A2A JSON-RPC response
 */
export interface A2AResponse<T = unknown> {
  jsonrpc: "2.0";
  id: string | number;
  result?: T;
  error?: A2AError;
}

/**
 * A2A JSON-RPC error
 */
export interface A2AError {
  code: number;
  message: string;
  data?: unknown;
}

// ============================================================================
// A2A Extension Types
// ============================================================================

/**
 * A2A extension declaration
 */
export interface A2AExtension {
  uri: string;
  description?: string;
  required?: boolean;
}

/**
 * A2A agent capabilities
 */
export interface A2ACapabilities {
  streaming?: boolean;
  pushNotifications?: boolean;
  stateTransitionHistory?: boolean;
  extensions?: A2AExtension[];
}

/**
 * A2A agent card (service advertisement)
 */
export interface A2AAgentCard {
  name: string;
  description?: string;
  url: string;
  provider?: {
    organization?: string;
    url?: string;
  };
  version?: string;
  documentationUrl?: string;
  capabilities?: A2ACapabilities;
  authentication?: {
    schemes: string[];
    credentials?: string;
  };
  defaultInputModes?: string[];
  defaultOutputModes?: string[];
  skills?: A2ASkill[];
}

/**
 * A2A skill definition
 */
export interface A2ASkill {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  examples?: string[];
  inputModes?: string[];
  outputModes?: string[];
}

// ============================================================================
// T402-A2A Constants
// ============================================================================

/**
 * T402 A2A extension URI
 */
export const T402_A2A_EXTENSION_URI = "https://github.com/google-a2a/a2a-t402/v0.1";

/**
 * x402 v0.2 A2A extension URI (compatibility layer)
 */
export const X402_A2A_EXTENSION_URI =
  "https://github.com/google-agentic-commerce/a2a-x402/blob/main/spec/v0.2";

/**
 * HTTP header for A2A extension activation
 */
export const A2A_EXTENSIONS_HEADER = "X-A2A-Extensions";

// ============================================================================
// x402 Compatibility Constants
// ============================================================================

/** CAIP-2 to flat network name mapping for x402 V1 compat */
export const CAIP2_TO_FLAT_NAME: Record<string, string> = {
  "eip155:1": "ethereum",
  "eip155:8453": "base",
  "eip155:84532": "base-sepolia",
  "eip155:42161": "arbitrum",
  "eip155:10": "optimism",
  "eip155:137": "polygon",
  "eip155:56": "bsc",
  "eip155:43114": "avalanche",
  "eip155:43113": "avalanche-fuji",
  "eip155:250": "fantom",
  "eip155:8217": "klaytn",
  "eip155:42220": "celo",
  "eip155:57073": "ink",
  "eip155:80094": "berachain",
  "eip155:130": "unichain",
  "eip155:5000": "mantle",
  "eip155:9745": "plasma",
  "eip155:1329": "sei",
  "eip155:1030": "conflux",
  "eip155:143": "monad",
  "eip155:14": "flare",
  "eip155:30": "rootstock",
  "eip155:196": "xlayer",
  "eip155:988": "stable",
  "eip155:999": "hyperevm",
  "eip155:4326": "megaeth",
  "eip155:21000000": "corn",
};

/** T402 to x402 v0.2 error code mapping */
const T402_TO_X402_ERROR_MAP: Record<string, string> = {
  "T402-1001": "INVALID_AMOUNT",
  "T402-2001": "INVALID_SIGNATURE",
  "T402-3001": "SETTLEMENT_FAILED",
  "T402-5001": "SETTLEMENT_FAILED",
  "T402-5002": "SETTLEMENT_FAILED",
};

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Read a metadata value with t402/x402 dual-namespace fallback.
 * Checks t402.payment.* first, then x402.payment.* as fallback.
 */
function getMetaValue(
  metadata: Record<string, unknown> | undefined,
  t402Key: string,
  x402Key: string,
): unknown {
  if (!metadata) return undefined;
  const t402Val = metadata[t402Key];
  if (t402Val !== undefined) return t402Val;
  return metadata[x402Key];
}

/**
 * Read the payment status from metadata (dual-namespace).
 */
function getPaymentStatus(
  metadata: Record<string, unknown> | undefined,
): string | undefined {
  return getMetaValue(
    metadata,
    "t402.payment.status",
    "x402.payment.status",
  ) as string | undefined;
}

// ============================================================================
// Helper Functions — Read (dual-namespace: t402 preferred, x402 fallback)
// ============================================================================

/**
 * Check if a task is in a payment-required state
 *
 * @param task - The A2A task to check
 * @returns Whether the task requires payment
 */
export function isPaymentRequired(task: A2ATask): boolean {
  return (
    task.status.state === "input-required" &&
    getPaymentStatus(task.status.message?.metadata) === "payment-required"
  );
}

/**
 * Check if a task has completed payment
 *
 * @param task - The A2A task to check
 * @returns Whether the task has completed payment
 */
export function isPaymentCompleted(task: A2ATask): boolean {
  return (
    task.status.state === "completed" &&
    getPaymentStatus(task.status.message?.metadata) === "payment-completed"
  );
}

/**
 * Check if a task has failed payment
 *
 * @param task - The A2A task to check
 * @returns Whether the task has failed payment
 */
export function isPaymentFailed(task: A2ATask): boolean {
  return (
    task.status.state === "failed" &&
    getPaymentStatus(task.status.message?.metadata) === "payment-failed"
  );
}

/**
 * Extract payment requirements from a task
 *
 * @param task - The A2A task to extract requirements from
 * @returns The payment requirements if the task requires payment
 */
export function getPaymentRequired(task: A2ATask): PaymentRequired | undefined {
  if (isPaymentRequired(task)) {
    return getMetaValue(
      task.status.message?.metadata,
      "t402.payment.required",
      "x402.payment.required",
    ) as PaymentRequired | undefined;
  }
  return undefined;
}

/**
 * Extract payment receipts from a task
 *
 * @param task - The A2A task to extract receipts from
 * @returns The settlement receipts if available
 */
export function getPaymentReceipts(task: A2ATask): SettleResponse[] | undefined {
  return getMetaValue(
    task.status.message?.metadata,
    "t402.payment.receipts",
    "x402.payment.receipts",
  ) as SettleResponse[] | undefined;
}

// ============================================================================
// Helper Functions — Write (dual-namespace: emit both t402 and x402)
// ============================================================================

/**
 * Create a payment-required message
 *
 * @param paymentRequired - The payment requirements
 * @param text - Optional message text
 * @returns An A2A message with payment-required metadata (dual-namespace)
 */
export function createPaymentRequiredMessage(
  paymentRequired: PaymentRequired,
  text: string = "Payment is required to complete this request.",
): A2AMessage {
  const x402Downgraded = downgradeRequirementsToX402(paymentRequired);
  const metadata: Record<string, unknown> = {
    "t402.payment.status": "payment-required",
    "t402.payment.required": paymentRequired,
    "x402.payment.status": "payment-required",
  };
  if (x402Downgraded) {
    metadata["x402.payment.required"] = x402Downgraded;
  }
  return {
    kind: "message",
    role: "agent",
    parts: [{ kind: "text", text }],
    metadata: metadata as A2APaymentMetadata & Record<string, unknown>,
  };
}

/**
 * Create a payment submission message
 *
 * @param paymentPayload - The payment payload to submit
 * @param text - Optional message text
 * @returns An A2A message with payment-submitted metadata (dual-namespace)
 */
export function createPaymentSubmissionMessage(
  paymentPayload: PaymentPayload,
  text: string = "Here is the payment authorization.",
): A2AMessage {
  return {
    kind: "message",
    role: "user",
    parts: [{ kind: "text", text }],
    metadata: {
      "t402.payment.status": "payment-submitted",
      "t402.payment.payload": paymentPayload,
      "x402.payment.status": "payment-submitted",
      "x402.payment.payload": paymentPayload,
    } as A2APaymentMetadata & Record<string, unknown>,
  };
}

/**
 * Create a payment completed message
 *
 * @param receipts - The settlement receipts
 * @param text - Optional message text
 * @returns An A2A message with payment-completed metadata (dual-namespace)
 */
export function createPaymentCompletedMessage(
  receipts: SettleResponse[],
  text: string = "Payment successful.",
): A2AMessage {
  return {
    kind: "message",
    role: "agent",
    parts: [{ kind: "text", text }],
    metadata: {
      "t402.payment.status": "payment-completed",
      "t402.payment.receipts": receipts,
      "x402.payment.status": "payment-completed",
      "x402.payment.receipts": receipts,
    } as A2APaymentMetadata & Record<string, unknown>,
  };
}

/**
 * Create a payment failed message
 *
 * @param receipts - The settlement receipts
 * @param errorCode - The error code
 * @param text - Optional message text
 * @returns An A2A message with payment-failed metadata (dual-namespace)
 */
export function createPaymentFailedMessage(
  receipts: SettleResponse[],
  errorCode: string,
  text: string = "Payment failed.",
): A2AMessage {
  return {
    kind: "message",
    role: "agent",
    parts: [{ kind: "text", text }],
    metadata: {
      "t402.payment.status": "payment-failed",
      "t402.payment.error": errorCode,
      "t402.payment.receipts": receipts,
      "x402.payment.status": "payment-failed",
      "x402.payment.error": mapT402ErrorToX402(errorCode),
      "x402.payment.receipts": receipts,
    } as A2APaymentMetadata & Record<string, unknown>,
  };
}

// ============================================================================
// Extension Helpers
// ============================================================================

/**
 * Create a T402 extension declaration for agent cards
 *
 * @param required - Whether the extension is required
 * @returns An A2A extension declaration
 */
export function createT402Extension(required: boolean = false): A2AExtension {
  return {
    uri: T402_A2A_EXTENSION_URI,
    description: "T402 multi-chain payment protocol (12 mechanisms, 44 networks).",
    required,
  };
}

/**
 * Create an x402 compatibility extension declaration for agent cards
 *
 * @param required - Whether the extension is required
 * @returns An A2A extension declaration for x402 v0.2
 */
export function createX402Extension(required: boolean = false): A2AExtension {
  return {
    uri: X402_A2A_EXTENSION_URI,
    description: "x402 compatibility layer for EVM payments.",
    required,
  };
}

// ============================================================================
// x402 Compatibility Functions
// ============================================================================

/**
 * Map a T402 error code to x402 v0.2 error code
 *
 * @param code - T402 error code (e.g., "T402-3001")
 * @returns x402 v0.2 error code (e.g., "SETTLEMENT_FAILED")
 */
export function mapT402ErrorToX402(code: string): string {
  return T402_TO_X402_ERROR_MAP[code] ?? "SETTLEMENT_FAILED";
}

/**
 * Downgrade T402 V2 PaymentRequired to x402 V1 format.
 * Filters to EVM + exact scheme only, converts CAIP-2 to flat names.
 *
 * @param requirements - T402 V2 payment requirements
 * @returns x402 V1 format requirements, or undefined if no EVM+exact options
 */
export function downgradeRequirementsToX402(
  requirements: PaymentRequired,
): Record<string, unknown> | undefined {
  if (!requirements.accepts || requirements.accepts.length === 0) {
    return undefined;
  }

  // Filter to EVM + exact scheme only
  const evmExactAccepts = requirements.accepts.filter(
    (a) => a.network.startsWith("eip155:") && a.scheme === "exact",
  );

  if (evmExactAccepts.length === 0) {
    return undefined;
  }

  const resource =
    typeof requirements.resource === "object"
      ? (requirements.resource as ResourceInfo).url
      : requirements.resource;

  return {
    x402Version: 1,
    accepts: evmExactAccepts.map((a) => ({
      ...a,
      network: CAIP2_TO_FLAT_NAME[a.network] ?? a.network,
      maxAmountRequired: a.amount,
      resource: resource ?? "",
    })),
  };
}

// ============================================================================
// Flow Detection (x402 v0.2 spec)
// ============================================================================

/**
 * Check if a task uses the x402 standalone flow.
 * Per x402 v0.2: standalone = x402.payment.status present AND x402.payment.required present.
 *
 * @param task - The A2A task to check
 * @returns Whether the task uses standalone flow
 */
export function isStandaloneFlow(task: A2ATask): boolean {
  const metadata = task.status.message?.metadata;
  if (!metadata) return false;
  return (
    metadata["x402.payment.status"] === "payment-required" &&
    metadata["x402.payment.required"] !== undefined
  );
}

/**
 * Check if a task uses the AP2 embedded flow.
 * Per x402 v0.2: embedded = x402.payment.status present but NO x402.payment.required
 * (requirements are in CartMandate artifacts).
 *
 * @param task - The A2A task to check
 * @returns Whether the task uses embedded flow
 */
export function isEmbeddedFlow(task: A2ATask): boolean {
  const metadata = task.status.message?.metadata;
  if (!metadata) return false;
  return (
    metadata["x402.payment.status"] === "payment-required" &&
    metadata["x402.payment.required"] === undefined
  );
}
