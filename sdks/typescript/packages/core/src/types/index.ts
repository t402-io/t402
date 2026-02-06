export type {
  VerifyRequest,
  VerifyResponse,
  SettleRequest,
  SettleResponse,
  SupportedResponse,
} from "./facilitator";
export type { PaymentRequirements, PaymentPayload, PaymentRequired } from "./payments";
export type {
  SchemeNetworkClient,
  SchemeNetworkFacilitator,
  SchemeNetworkServer,
  MoneyParser,
} from "./mechanisms";
export type { PaymentRequirementsV1, PaymentRequiredV1, PaymentPayloadV1 } from "./v1";
export type { ResourceServerExtension } from "./extensions";

// A2A Transport types
export type {
  A2APaymentStatus,
  A2ATaskState,
  A2ATextPart,
  A2AFilePart,
  A2ADataPart,
  A2AMessagePart,
  A2APaymentMetadata,
  A2AMessage,
  A2AArtifact,
  A2ATaskStatus,
  A2ATask,
  A2ARequest,
  A2AResponse,
  A2AError,
  A2AExtension,
  A2ACapabilities,
  A2AAgentCard,
  A2ASkill,
} from "./a2a";
export {
  T402_A2A_EXTENSION_URI,
  A2A_EXTENSIONS_HEADER,
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
} from "./a2a";

// Scheme-specific types
export type {
  UptoPaymentRequirements,
  UptoExtra,
  UptoPayloadBase,
  UptoEvmPayload,
  UptoEvmPayloadCompact,
  UptoSettlement,
  UptoUsageDetails,
  UptoSettlementResponse,
  UptoValidationResult,
  UptoUnit,
} from "./schemes";
export { isUptoPaymentRequirements, isUptoEvmPayload, UPTO_SCHEME, UPTO_DEFAULTS } from "./schemes";

// Error codes
export type { ErrorCode, APIError } from "./errors";
export {
  ERR_INVALID_REQUEST, ERR_MISSING_PAYLOAD, ERR_MISSING_REQUIREMENTS,
  ERR_INVALID_PAYLOAD, ERR_INVALID_REQUIREMENTS, ERR_INVALID_SIGNATURE,
  ERR_INVALID_NETWORK, ERR_INVALID_SCHEME, ERR_INVALID_AMOUNT,
  ERR_INVALID_ADDRESS, ERR_EXPIRED_PAYMENT, ERR_INVALID_NONCE,
  ERR_INSUFFICIENT_AMOUNT, ERR_INVALID_IDEMPOTENCY_KEY, ERR_SIGNATURE_EXPIRED,
  ERR_INTERNAL, ERR_DATABASE_UNAVAILABLE, ERR_CACHE_UNAVAILABLE,
  ERR_RPC_UNAVAILABLE, ERR_RATE_LIMITED, ERR_SERVICE_UNAVAILABLE,
  ERR_VERIFICATION_FAILED, ERR_SETTLEMENT_FAILED, ERR_INSUFFICIENT_BALANCE,
  ERR_ALLOWANCE_INSUFFICIENT, ERR_PAYMENT_MISMATCH, ERR_DUPLICATE_PAYMENT,
  ERR_SETTLEMENT_PENDING, ERR_SETTLEMENT_TIMEOUT, ERR_NONCE_REPLAY,
  ERR_IDEMPOTENCY_CONFLICT, ERR_IDEMPOTENCY_UNAVAILABLE,
  ERR_PREVIOUS_REQUEST_FAILED, ERR_REQUEST_IN_PROGRESS,
  ERR_CHAIN_UNAVAILABLE, ERR_TRANSACTION_FAILED, ERR_TRANSACTION_REVERTED,
  ERR_GAS_ESTIMATION_FAILED, ERR_NONCE_CONFLICT, ERR_CHAIN_CONGESTED,
  ERR_CONTRACT_ERROR,
  ERR_BRIDGE_UNAVAILABLE, ERR_BRIDGE_QUOTE_FAILED, ERR_BRIDGE_TRANSFER_FAILED,
  ERR_BRIDGE_TIMEOUT, ERR_UNSUPPORTED_ROUTE,
  ERR_STREAM_NOT_FOUND, ERR_STREAM_ALREADY_CLOSED, ERR_STREAM_ALREADY_PAUSED,
  ERR_STREAM_NOT_PAUSED, ERR_STREAM_AMOUNT_EXCEEDED, ERR_STREAM_EXPIRED,
  ERR_STREAM_INVALID_STATE, ERR_STREAM_RATE_LIMITED,
  ERR_INTENT_NOT_FOUND, ERR_INTENT_ALREADY_EXECUTED, ERR_INTENT_CANCELLED,
  ERR_INTENT_EXPIRED, ERR_NO_ROUTES_AVAILABLE, ERR_ROUTE_EXPIRED,
  ERR_ROUTE_NOT_SELECTED, ERR_INTENT_INVALID_STATE,
  ERR_RESOURCE_NOT_FOUND, ERR_RESOURCE_ALREADY_EXISTS,
  ERR_INVALID_PARAMETERS, ERR_NOT_AUTHORIZED,
  httpStatusForCode, isClientError, isServerError, isFacilitatorError,
  isChainError, isBridgeError,
} from "./errors";

export type Network = `${string}:${string}`;

export type Money = string | number;
export type AssetAmount = {
  asset: string;
  amount: string;
  extra?: Record<string, unknown>;
};
export type Price = Money | AssetAmount;

// Zod schemas for runtime validation
export {
  NetworkSchema,
  ResourceInfoSchema,
  PaymentRequirementsSchema,
  PaymentRequiredSchema,
  PaymentPayloadSchema,
  VerifyResponseSchema,
  SettleResponseSchema,
  PaymentRequirementsV1Schema,
  PaymentPayloadV1Schema,
  parsePaymentPayload,
  parsePaymentRequired,
  parsePaymentRequirements,
  safeParsePaymentPayload,
  safeParsePaymentRequired,
  safeParsePaymentRequirements,
} from "./schemas";
export type {
  ValidatedPaymentPayload,
  ValidatedPaymentRequired,
  ValidatedPaymentRequirements,
  ValidatedVerifyResponse,
  ValidatedSettleResponse,
} from "./schemas";
