/**
 * Standardized T402 error codes returned by the facilitator API.
 * Error codes follow the format T402-XYYY where X is the category (1-8)
 * and YYY is the specific error within that category.
 */

// Client Errors (T402-1xxx): Invalid input, malformed requests
export const ERR_INVALID_REQUEST = "T402-1001" as const;
export const ERR_MISSING_PAYLOAD = "T402-1002" as const;
export const ERR_MISSING_REQUIREMENTS = "T402-1003" as const;
export const ERR_INVALID_PAYLOAD = "T402-1004" as const;
export const ERR_INVALID_REQUIREMENTS = "T402-1005" as const;
export const ERR_INVALID_SIGNATURE = "T402-1006" as const;
export const ERR_INVALID_NETWORK = "T402-1007" as const;
export const ERR_INVALID_SCHEME = "T402-1008" as const;
export const ERR_INVALID_AMOUNT = "T402-1009" as const;
export const ERR_INVALID_ADDRESS = "T402-1010" as const;
export const ERR_EXPIRED_PAYMENT = "T402-1011" as const;
export const ERR_INVALID_NONCE = "T402-1012" as const;
export const ERR_INSUFFICIENT_AMOUNT = "T402-1013" as const;
export const ERR_INVALID_IDEMPOTENCY_KEY = "T402-1014" as const;
export const ERR_SIGNATURE_EXPIRED = "T402-1015" as const;

// Server Errors (T402-2xxx): Internal failures, dependency issues
export const ERR_INTERNAL = "T402-2001" as const;
export const ERR_DATABASE_UNAVAILABLE = "T402-2002" as const;
export const ERR_CACHE_UNAVAILABLE = "T402-2003" as const;
export const ERR_RPC_UNAVAILABLE = "T402-2004" as const;
export const ERR_RATE_LIMITED = "T402-2005" as const;
export const ERR_SERVICE_UNAVAILABLE = "T402-2006" as const;

// Facilitator Errors (T402-3xxx): Verification and settlement failures
export const ERR_VERIFICATION_FAILED = "T402-3001" as const;
export const ERR_SETTLEMENT_FAILED = "T402-3002" as const;
export const ERR_INSUFFICIENT_BALANCE = "T402-3003" as const;
export const ERR_ALLOWANCE_INSUFFICIENT = "T402-3004" as const;
export const ERR_PAYMENT_MISMATCH = "T402-3005" as const;
export const ERR_DUPLICATE_PAYMENT = "T402-3006" as const;
export const ERR_SETTLEMENT_PENDING = "T402-3007" as const;
export const ERR_SETTLEMENT_TIMEOUT = "T402-3008" as const;
export const ERR_NONCE_REPLAY = "T402-3009" as const;
export const ERR_IDEMPOTENCY_CONFLICT = "T402-3010" as const;
export const ERR_IDEMPOTENCY_UNAVAILABLE = "T402-3011" as const;
export const ERR_PREVIOUS_REQUEST_FAILED = "T402-3012" as const;
export const ERR_REQUEST_IN_PROGRESS = "T402-3013" as const;

// Chain-Specific Errors (T402-4xxx): Network and transaction issues
export const ERR_CHAIN_UNAVAILABLE = "T402-4001" as const;
export const ERR_TRANSACTION_FAILED = "T402-4002" as const;
export const ERR_TRANSACTION_REVERTED = "T402-4003" as const;
export const ERR_GAS_ESTIMATION_FAILED = "T402-4004" as const;
export const ERR_NONCE_CONFLICT = "T402-4005" as const;
export const ERR_CHAIN_CONGESTED = "T402-4006" as const;
export const ERR_CONTRACT_ERROR = "T402-4007" as const;

// Bridge Errors (T402-5xxx): Cross-chain operation failures
export const ERR_BRIDGE_UNAVAILABLE = "T402-5001" as const;
export const ERR_BRIDGE_QUOTE_FAILED = "T402-5002" as const;
export const ERR_BRIDGE_TRANSFER_FAILED = "T402-5003" as const;
export const ERR_BRIDGE_TIMEOUT = "T402-5004" as const;
export const ERR_UNSUPPORTED_ROUTE = "T402-5005" as const;

// Streaming Errors (T402-6xxx): Payment stream issues
export const ERR_STREAM_NOT_FOUND = "T402-6001" as const;
export const ERR_STREAM_ALREADY_CLOSED = "T402-6002" as const;
export const ERR_STREAM_ALREADY_PAUSED = "T402-6003" as const;
export const ERR_STREAM_NOT_PAUSED = "T402-6004" as const;
export const ERR_STREAM_AMOUNT_EXCEEDED = "T402-6005" as const;
export const ERR_STREAM_EXPIRED = "T402-6006" as const;
export const ERR_STREAM_INVALID_STATE = "T402-6007" as const;
export const ERR_STREAM_RATE_LIMITED = "T402-6008" as const;

// Intent Errors (T402-7xxx): Payment intent issues
export const ERR_INTENT_NOT_FOUND = "T402-7001" as const;
export const ERR_INTENT_ALREADY_EXECUTED = "T402-7002" as const;
export const ERR_INTENT_CANCELLED = "T402-7003" as const;
export const ERR_INTENT_EXPIRED = "T402-7004" as const;
export const ERR_NO_ROUTES_AVAILABLE = "T402-7005" as const;
export const ERR_ROUTE_EXPIRED = "T402-7006" as const;
export const ERR_ROUTE_NOT_SELECTED = "T402-7007" as const;
export const ERR_INTENT_INVALID_STATE = "T402-7008" as const;

// Discovery Errors (T402-8xxx): Resource marketplace issues
export const ERR_RESOURCE_NOT_FOUND = "T402-8001" as const;
export const ERR_RESOURCE_ALREADY_EXISTS = "T402-8002" as const;
export const ERR_INVALID_PARAMETERS = "T402-8003" as const;
export const ERR_NOT_AUTHORIZED = "T402-8004" as const;

/** Union type of all T402 error codes */
export type ErrorCode =
  | typeof ERR_INVALID_REQUEST
  | typeof ERR_MISSING_PAYLOAD
  | typeof ERR_MISSING_REQUIREMENTS
  | typeof ERR_INVALID_PAYLOAD
  | typeof ERR_INVALID_REQUIREMENTS
  | typeof ERR_INVALID_SIGNATURE
  | typeof ERR_INVALID_NETWORK
  | typeof ERR_INVALID_SCHEME
  | typeof ERR_INVALID_AMOUNT
  | typeof ERR_INVALID_ADDRESS
  | typeof ERR_EXPIRED_PAYMENT
  | typeof ERR_INVALID_NONCE
  | typeof ERR_INSUFFICIENT_AMOUNT
  | typeof ERR_INVALID_IDEMPOTENCY_KEY
  | typeof ERR_SIGNATURE_EXPIRED
  | typeof ERR_INTERNAL
  | typeof ERR_DATABASE_UNAVAILABLE
  | typeof ERR_CACHE_UNAVAILABLE
  | typeof ERR_RPC_UNAVAILABLE
  | typeof ERR_RATE_LIMITED
  | typeof ERR_SERVICE_UNAVAILABLE
  | typeof ERR_VERIFICATION_FAILED
  | typeof ERR_SETTLEMENT_FAILED
  | typeof ERR_INSUFFICIENT_BALANCE
  | typeof ERR_ALLOWANCE_INSUFFICIENT
  | typeof ERR_PAYMENT_MISMATCH
  | typeof ERR_DUPLICATE_PAYMENT
  | typeof ERR_SETTLEMENT_PENDING
  | typeof ERR_SETTLEMENT_TIMEOUT
  | typeof ERR_NONCE_REPLAY
  | typeof ERR_IDEMPOTENCY_CONFLICT
  | typeof ERR_IDEMPOTENCY_UNAVAILABLE
  | typeof ERR_PREVIOUS_REQUEST_FAILED
  | typeof ERR_REQUEST_IN_PROGRESS
  | typeof ERR_CHAIN_UNAVAILABLE
  | typeof ERR_TRANSACTION_FAILED
  | typeof ERR_TRANSACTION_REVERTED
  | typeof ERR_GAS_ESTIMATION_FAILED
  | typeof ERR_NONCE_CONFLICT
  | typeof ERR_CHAIN_CONGESTED
  | typeof ERR_CONTRACT_ERROR
  | typeof ERR_BRIDGE_UNAVAILABLE
  | typeof ERR_BRIDGE_QUOTE_FAILED
  | typeof ERR_BRIDGE_TRANSFER_FAILED
  | typeof ERR_BRIDGE_TIMEOUT
  | typeof ERR_UNSUPPORTED_ROUTE
  | typeof ERR_STREAM_NOT_FOUND
  | typeof ERR_STREAM_ALREADY_CLOSED
  | typeof ERR_STREAM_ALREADY_PAUSED
  | typeof ERR_STREAM_NOT_PAUSED
  | typeof ERR_STREAM_AMOUNT_EXCEEDED
  | typeof ERR_STREAM_EXPIRED
  | typeof ERR_STREAM_INVALID_STATE
  | typeof ERR_STREAM_RATE_LIMITED
  | typeof ERR_INTENT_NOT_FOUND
  | typeof ERR_INTENT_ALREADY_EXECUTED
  | typeof ERR_INTENT_CANCELLED
  | typeof ERR_INTENT_EXPIRED
  | typeof ERR_NO_ROUTES_AVAILABLE
  | typeof ERR_ROUTE_EXPIRED
  | typeof ERR_ROUTE_NOT_SELECTED
  | typeof ERR_INTENT_INVALID_STATE
  | typeof ERR_RESOURCE_NOT_FOUND
  | typeof ERR_RESOURCE_ALREADY_EXISTS
  | typeof ERR_INVALID_PARAMETERS
  | typeof ERR_NOT_AUTHORIZED;

/** Structured error response from the facilitator API */
export interface APIError {
  code: ErrorCode;
  message: string;
  details?: string;
  retry?: boolean;
}

/**
 * Returns the HTTP status code for a given error code
 *
 * @param code - The T402 error code
 * @returns The corresponding HTTP status code
 */
export function httpStatusForCode(code: ErrorCode): number {
  const category = code.charAt(5);
  switch (category) {
    case "1":
      return 400;
    case "2":
      if (code === ERR_RATE_LIMITED) return 429;
      return 500;
    case "3":
      if (code === ERR_VERIFICATION_FAILED || code === ERR_PAYMENT_MISMATCH) return 422;
      return 500;
    case "4":
      return 502;
    case "5":
      return 502;
    case "6":
      if (code === ERR_STREAM_NOT_FOUND) return 404;
      return 400;
    case "7":
      if (code === ERR_INTENT_NOT_FOUND) return 404;
      return 400;
    case "8":
      if (code === ERR_RESOURCE_NOT_FOUND) return 404;
      if (code === ERR_RESOURCE_ALREADY_EXISTS) return 409;
      if (code === ERR_NOT_AUTHORIZED) return 403;
      return 400;
    default:
      return 500;
  }
}

/**
 * Returns true if the error code is a client error (T402-1xxx)
 *
 * @param code - The T402 error code
 * @returns Whether the error is a client error
 */
export function isClientError(code: ErrorCode): boolean {
  return code.charAt(5) === "1";
}

/**
 * Returns true if the error code is a server error (T402-2xxx)
 *
 * @param code - The T402 error code
 * @returns Whether the error is a server error
 */
export function isServerError(code: ErrorCode): boolean {
  return code.charAt(5) === "2";
}

/**
 * Returns true if the error code is a facilitator error (T402-3xxx)
 *
 * @param code - The T402 error code
 * @returns Whether the error is a facilitator error
 */
export function isFacilitatorError(code: ErrorCode): boolean {
  return code.charAt(5) === "3";
}

/**
 * Returns true if the error code is a chain error (T402-4xxx)
 *
 * @param code - The T402 error code
 * @returns Whether the error is a chain error
 */
export function isChainError(code: ErrorCode): boolean {
  return code.charAt(5) === "4";
}

/**
 * Returns true if the error code is a bridge error (T402-5xxx)
 *
 * @param code - The T402 error code
 * @returns Whether the error is a bridge error
 */
export function isBridgeError(code: ErrorCode): boolean {
  return code.charAt(5) === "5";
}
