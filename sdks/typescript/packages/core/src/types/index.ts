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
