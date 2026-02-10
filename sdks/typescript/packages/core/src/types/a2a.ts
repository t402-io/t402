/**
 * A2A (Agent-to-Agent) Transport Types
 *
 * Implements t402 payment flows over the Agent-to-Agent protocol
 * using JSON-RPC messages and task-based state management.
 *
 * @see https://github.com/google-a2a/a2a-t402/v0.1
 */

import type { PaymentPayload, PaymentRequired } from "./payments";
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
 * HTTP header for A2A extension activation
 */
export const A2A_EXTENSIONS_HEADER = "X-A2A-Extensions";

// ============================================================================
// Helper Functions
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
    task.status.message?.metadata?.["t402.payment.status"] === "payment-required"
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
    task.status.message?.metadata?.["t402.payment.status"] === "payment-completed"
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
    task.status.message?.metadata?.["t402.payment.status"] === "payment-failed"
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
    return task.status.message?.metadata?.["t402.payment.required"];
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
  return task.status.message?.metadata?.["t402.payment.receipts"];
}

/**
 * Create a payment-required message
 *
 * @param paymentRequired - The payment requirements
 * @param text - Optional message text
 * @returns An A2A message with payment-required metadata
 */
export function createPaymentRequiredMessage(
  paymentRequired: PaymentRequired,
  text: string = "Payment is required to complete this request.",
): A2AMessage {
  return {
    kind: "message",
    role: "agent",
    parts: [{ kind: "text", text }],
    metadata: {
      "t402.payment.status": "payment-required",
      "t402.payment.required": paymentRequired,
    },
  };
}

/**
 * Create a payment submission message
 *
 * @param paymentPayload - The payment payload to submit
 * @param text - Optional message text
 * @returns An A2A message with payment-submitted metadata
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
    },
  };
}

/**
 * Create a payment completed message
 *
 * @param receipts - The settlement receipts
 * @param text - Optional message text
 * @returns An A2A message with payment-completed metadata
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
    },
  };
}

/**
 * Create a payment failed message
 *
 * @param receipts - The settlement receipts
 * @param errorCode - The error code
 * @param text - Optional message text
 * @returns An A2A message with payment-failed metadata
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
    },
  };
}

/**
 * Create a T402 extension declaration for agent cards
 *
 * @param required - Whether the extension is required
 * @returns An A2A extension declaration
 */
export function createT402Extension(required: boolean = false): A2AExtension {
  return {
    uri: T402_A2A_EXTENSION_URI,
    description: "Supports payments using the t402 protocol for on-chain settlement.",
    required,
  };
}
