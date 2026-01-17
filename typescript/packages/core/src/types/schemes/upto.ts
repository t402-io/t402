/**
 * Up-To Scheme Types
 *
 * The `upto` scheme authorizes transfer of up to a maximum amount,
 * enabling usage-based billing where the final settlement amount
 * is determined by actual usage.
 *
 * @example
 * ```typescript
 * // Client authorizes up to $1.00
 * const requirements: UptoPaymentRequirements = {
 *   scheme: 'upto',
 *   network: 'eip155:8453',
 *   maxAmount: '1000000',  // $1.00 in USDC
 *   minAmount: '10000',    // $0.01 minimum
 *   asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
 *   payTo: '0x...',
 *   maxTimeoutSeconds: 300,
 *   extra: {
 *     unit: 'token',
 *     unitPrice: '100',
 *   },
 * };
 *
 * // Server settles for actual usage ($0.15)
 * const settlement: UptoSettlement = {
 *   settleAmount: '150000',
 *   usageDetails: {
 *     tokensGenerated: 1500,
 *     unitPrice: '100',
 *   },
 * };
 * ```
 */

import type { Network, PaymentRequirements } from "../";

/**
 * Extended payment requirements for the upto scheme.
 */
export interface UptoPaymentRequirements extends Omit<PaymentRequirements, "scheme" | "amount"> {
  /** Scheme identifier - always 'upto' */
  scheme: "upto";

  /** Network identifier (CAIP-2 format) */
  network: Network;

  /** Maximum amount the client authorizes (in smallest denomination) */
  maxAmount: string;

  /** Minimum settlement amount (prevents dust payments) */
  minAmount?: string;

  /** Asset contract address or identifier */
  asset: string;

  /** Recipient address */
  payTo: string;

  /** Maximum time in seconds before payment expires */
  maxTimeoutSeconds: number;

  /** Additional scheme-specific data */
  extra: UptoExtra;
}

/**
 * Extra fields specific to the upto scheme.
 */
export interface UptoExtra extends Record<string, unknown> {
  /** Billing unit (e.g., 'token', 'request', 'second', 'byte') */
  unit?: string;

  /** Price per unit in smallest denomination */
  unitPrice?: string;

  /** EIP-712 domain name (for EVM) */
  name?: string;

  /** EIP-712 domain version (for EVM) */
  version?: string;

  /** Router contract address (for EVM) */
  routerAddress?: string;
}

/**
 * Base payload structure for upto scheme.
 */
export interface UptoPayloadBase {
  /** Unique nonce to prevent replay attacks */
  nonce: string;
}

/**
 * EVM-specific upto payload using EIP-2612 Permit.
 */
export interface UptoEvmPayload extends UptoPayloadBase {
  /** EIP-2612 permit signature components */
  signature: {
    v: number;
    r: `0x${string}`;
    s: `0x${string}`;
  };

  /** Permit authorization parameters */
  authorization: {
    /** Token owner address */
    owner: `0x${string}`;

    /** Spender address (router contract) */
    spender: `0x${string}`;

    /** Maximum authorized value */
    value: string;

    /** Permit deadline (unix timestamp) */
    deadline: string;

    /** Permit nonce (from token contract) */
    nonce: number;
  };
}

/**
 * Alternative EVM payload with combined signature.
 */
export interface UptoEvmPayloadCompact extends UptoPayloadBase {
  /** Combined EIP-2612 permit signature */
  signature: `0x${string}`;

  /** Permit authorization parameters */
  authorization: {
    owner: `0x${string}`;
    spender: `0x${string}`;
    value: string;
    deadline: string;
    nonce: number;
  };
}

/**
 * Settlement request for upto scheme.
 */
export interface UptoSettlement {
  /** Actual amount to settle (must be <= maxAmount) */
  settleAmount: string;

  /** Optional usage details for auditing */
  usageDetails?: UptoUsageDetails;
}

/**
 * Usage details for settlement auditing.
 */
export interface UptoUsageDetails {
  /** Number of units consumed */
  unitsConsumed?: number;

  /** Price per unit used */
  unitPrice?: string;

  /** Type of unit */
  unitType?: string;

  /** Start timestamp of usage period */
  startTime?: number;

  /** End timestamp of usage period */
  endTime?: number;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Settlement response for upto scheme.
 */
export interface UptoSettlementResponse {
  /** Whether settlement was successful */
  success: boolean;

  /** Transaction hash (if on-chain) */
  transactionHash?: string;

  /** Actual amount settled */
  settledAmount: string;

  /** Maximum amount that was authorized */
  maxAmount: string;

  /** Block number (if on-chain) */
  blockNumber?: number;

  /** Gas used (if on-chain) */
  gasUsed?: string;

  /** Error message if failed */
  error?: string;
}

/**
 * Validation result for upto payment.
 */
export interface UptoValidationResult {
  /** Whether the payment is valid */
  isValid: boolean;

  /** Reason if invalid */
  invalidReason?: string;

  /** Validated maximum amount */
  validatedMaxAmount?: string;

  /** Payer address */
  payer?: string;

  /** Expiration timestamp */
  expiresAt?: number;
}

/**
 * Type guard for UptoPaymentRequirements.
 */
export function isUptoPaymentRequirements(
  requirements: unknown,
): requirements is UptoPaymentRequirements {
  if (typeof requirements !== "object" || requirements === null) return false;
  const req = requirements as Record<string, unknown>;
  return req.scheme === "upto" && "maxAmount" in req;
}

/**
 * Type guard for UptoEvmPayload.
 */
export function isUptoEvmPayload(
  payload: unknown,
): payload is UptoEvmPayload {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return (
    "signature" in p &&
    "authorization" in p &&
    typeof p.authorization === "object" &&
    p.authorization !== null &&
    "owner" in (p.authorization as Record<string, unknown>) &&
    "spender" in (p.authorization as Record<string, unknown>) &&
    "value" in (p.authorization as Record<string, unknown>) &&
    "deadline" in (p.authorization as Record<string, unknown>)
  );
}

/**
 * Constants for upto scheme.
 */
export const UPTO_SCHEME = "upto" as const;

export const UPTO_DEFAULTS = {
  /** Default minimum settlement amount (prevents dust) */
  MIN_AMOUNT: "1000",

  /** Default maximum timeout in seconds (5 minutes) */
  MAX_TIMEOUT_SECONDS: 300,

  /** Supported billing units */
  UNITS: ["token", "request", "second", "minute", "byte", "kb", "mb"] as const,
} as const;

export type UptoUnit = (typeof UPTO_DEFAULTS.UNITS)[number];
