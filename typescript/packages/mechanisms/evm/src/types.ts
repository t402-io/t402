export type ExactEIP3009Payload = {
  signature?: `0x${string}`;
  authorization: {
    from: `0x${string}`;
    to: `0x${string}`;
    value: string;
    validAfter: string;
    validBefore: string;
    nonce: `0x${string}`;
  };
};

export type ExactEvmPayloadV1 = ExactEIP3009Payload;

export type ExactEvmPayloadV2 = ExactEIP3009Payload;

/**
 * Payload for exact-legacy scheme (approve + transferFrom pattern)
 * Used for legacy USDT and other tokens without EIP-3009 support
 */
export type ExactLegacyPayload = {
  signature?: `0x${string}`;
  authorization: {
    /** Payer address */
    from: `0x${string}`;
    /** Recipient address */
    to: `0x${string}`;
    /** Payment amount in token units */
    value: string;
    /** Unix timestamp after which the authorization is valid */
    validAfter: string;
    /** Unix timestamp before which the authorization is valid */
    validBefore: string;
    /** Unique nonce to prevent replay attacks */
    nonce: `0x${string}`;
    /** Facilitator address that will call transferFrom */
    spender: `0x${string}`;
  };
};

// ============================================================================
// Up-To Scheme Types (EIP-2612 Permit)
// ============================================================================

/**
 * EIP-2612 Permit signature components
 */
export type PermitSignature = {
  v: number;
  r: `0x${string}`;
  s: `0x${string}`;
};

/**
 * EIP-2612 Permit authorization parameters
 */
export type PermitAuthorization = {
  /** Token owner address */
  owner: `0x${string}`;
  /** Spender address (router contract or facilitator) */
  spender: `0x${string}`;
  /** Maximum authorized value */
  value: string;
  /** Permit deadline (unix timestamp) */
  deadline: string;
  /** Permit nonce from token contract */
  nonce: number;
};

/**
 * Payload for upto scheme using EIP-2612 Permit
 */
export type UptoEIP2612Payload = {
  /** EIP-2612 permit signature */
  signature: PermitSignature;
  /** Permit authorization parameters */
  authorization: PermitAuthorization;
  /** Unique payment nonce (separate from permit nonce) */
  paymentNonce: `0x${string}`;
};

/**
 * Compact payload with combined signature bytes
 */
export type UptoEIP2612PayloadCompact = {
  /** Combined permit signature (65 bytes) */
  signature: `0x${string}`;
  /** Permit authorization parameters */
  authorization: PermitAuthorization;
  /** Unique payment nonce */
  paymentNonce: `0x${string}`;
};

export type UptoEvmPayloadV2 = UptoEIP2612Payload | UptoEIP2612PayloadCompact;

/**
 * Extra fields for upto scheme requirements on EVM
 */
export type UptoEvmExtra = {
  /** EIP-712 domain name (from token contract) */
  name: string;
  /** EIP-712 domain version */
  version: string;
  /** Router contract address for settlement */
  routerAddress?: `0x${string}`;
  /** Billing unit */
  unit?: string;
  /** Price per unit */
  unitPrice?: string;
};

/**
 * Settlement data for upto scheme
 */
export type UptoEvmSettlement = {
  /** Actual amount to settle (must be <= maxAmount) */
  settleAmount: string;
  /** Usage details for auditing */
  usageDetails?: {
    unitsConsumed?: number;
    unitPrice?: string;
    unitType?: string;
    startTime?: number;
    endTime?: number;
  };
};

/**
 * EIP-712 typed data for EIP-2612 Permit
 */
export const permitTypes = {
  Permit: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

/**
 * Type guard for UptoEIP2612Payload
 */
export function isUptoEIP2612Payload(
  payload: unknown,
): payload is UptoEIP2612Payload {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return (
    "signature" in p &&
    "authorization" in p &&
    "paymentNonce" in p &&
    typeof p.authorization === "object" &&
    p.authorization !== null &&
    "owner" in (p.authorization as Record<string, unknown>) &&
    "spender" in (p.authorization as Record<string, unknown>) &&
    "value" in (p.authorization as Record<string, unknown>) &&
    "deadline" in (p.authorization as Record<string, unknown>) &&
    "nonce" in (p.authorization as Record<string, unknown>)
  );
}
