/**
 * @t402/a2a - A2A (Agent-to-Agent) transport for t402 payment protocol
 *
 * This package provides tools for implementing t402 payments over the
 * A2A (Agent-to-Agent) protocol, enabling AI agents to monetize their
 * services through on-chain cryptocurrency payments.
 *
 * @example
 * ```typescript
 * import { A2APaymentClient, A2APaymentServer } from '@t402/a2a';
 *
 * // Client-side: Handle payment requirements
 * const client = new A2APaymentClient({ signer });
 * const task = await client.handlePaymentRequired(task, mechanism);
 *
 * // Server-side: Protect agent endpoints
 * const server = new A2APaymentServer({ facilitator, requirements });
 * const result = await server.processPayment(message);
 * ```
 *
 * @packageDocumentation
 */

// Re-export all A2A types from core
export {
  // Types
  type A2APaymentStatus,
  type A2ATaskState,
  type A2ATextPart,
  type A2AFilePart,
  type A2ADataPart,
  type A2AMessagePart,
  type A2APaymentMetadata,
  type A2AMessage,
  type A2AArtifact,
  type A2ATaskStatus,
  type A2ATask,
  type A2ARequest,
  type A2AResponse,
  type A2AError,
  type A2AExtension,
  type A2ACapabilities,
  type A2AAgentCard,
  type A2ASkill,
  // Constants
  T402_A2A_EXTENSION_URI,
  A2A_EXTENSIONS_HEADER,
  // Helper functions
  isPaymentRequired,
  isPaymentCompleted,
  isPaymentFailed,
  getPaymentRequired,
  getPaymentReceipts,
  createPaymentRequiredMessage,
  createPaymentSubmissionMessage,
  createPaymentCompletedMessage,
  createPaymentFailedMessage,
  createT402Extension,
} from "@t402/core/types";

// Export client and server
export { A2APaymentClient, type A2APaymentClientOptions } from "./client";
export {
  A2APaymentServer,
  type A2APaymentServerOptions,
  type A2APaymentHandler,
  type A2APaymentResult,
} from "./server";
