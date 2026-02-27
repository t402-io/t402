/**
 * EIP-2612 Gas Sponsoring Extension Type Definitions
 *
 * EIP-2612 permit-based gas sponsoring for the t402 payment protocol.
 * Allows facilitators to sponsor gas fees by having clients sign off-chain
 * permits instead of submitting on-chain approval transactions.
 */

/**
 * Information provided by server about gas sponsoring availability.
 */
export interface Eip2612GasSponsorExtensionInfo {
  /** CAIP-2 network identifiers where gas sponsoring is available */
  sponsoredNetworks: string[];

  /** Maximum token amount (in base units) the sponsor will cover per permit */
  maxAmount: string;

  /** Default permit deadline in seconds from now */
  permitDeadline: number;

  /** Address of the sponsor/facilitator that will call permit + transferFrom */
  sponsorAddress: string;
}

/**
 * Gas sponsor extension declaration for server responses.
 */
export interface Eip2612GasSponsorExtension {
  /** Extension information */
  info: Eip2612GasSponsorExtensionInfo;

  /** JSON Schema for validation */
  schema: object;
}

/**
 * Complete gas sponsor payload from client including permit signature.
 */
export interface Eip2612GasSponsorPayload {
  /** CAIP-2 network identifier (must be in sponsoredNetworks) */
  network: string;

  /** Full hex-encoded EIP-2612 permit signature (65 bytes, r + s + v) */
  permitSignature: string;

  /** Token owner address (the client's wallet) */
  owner: string;

  /** Spender address (must match sponsorAddress) */
  spender: string;

  /** Token amount in base units */
  value: string;

  /** Unix timestamp for permit expiry */
  deadline: number;

  /** Recovery parameter from signature */
  v: number;

  /** Signature r component (32 bytes hex) */
  r: string;

  /** Signature s component (32 bytes hex) */
  s: string;
}

/**
 * Options for declaring gas sponsor extension on server.
 */
export interface DeclareEip2612GasSponsorOptions {
  /** CAIP-2 network identifiers where gas sponsoring is available */
  sponsoredNetworks: string[];

  /** Maximum token amount (in base units) the sponsor will cover per permit */
  maxAmount: string;

  /** Default permit deadline in seconds from now (defaults to 300 = 5 minutes) */
  permitDeadline?: number;

  /** Address of the sponsor/facilitator */
  sponsorAddress: string;
}

/**
 * Options for validating gas sponsor payloads.
 */
export interface ValidateEip2612GasSponsorOptions {
  /** Custom time function for testing (defaults to Date.now) */
  now?: () => number;
}

/**
 * Result of gas sponsor payload validation.
 */
export interface Eip2612GasSponsorValidationResult {
  /** Whether the payload is valid */
  valid: boolean;

  /** Error message if invalid */
  error?: string;
}

/**
 * Parameters for creating an EIP-2612 permit signature.
 */
export interface CreatePermitParams {
  /** EIP-712 signer interface */
  signer: PermitSigner;

  /** ERC-20 token contract address */
  tokenAddress: string;

  /** Token name (used in EIP-712 domain) */
  tokenName: string;

  /** Chain ID (numeric, e.g. 8453 for Base) */
  chainId: number;

  /** Spender address (the facilitator/sponsor) */
  spender: string;

  /** Token amount in base units */
  value: string;

  /** Unix timestamp for permit expiry */
  deadline: number;

  /** Current permit nonce for the owner (defaults to 0) */
  nonce?: number;
}

/**
 * Signer interface for EIP-2612 permit signing.
 */
export interface PermitSigner {
  /** Wallet address */
  address: string;

  /**
   * Sign EIP-712 typed data and return hex-encoded signature.
   *
   * @param data - EIP-712 typed data to sign
   * @param data.domain - EIP-712 domain separator fields
   * @param data.types - EIP-712 type definitions
   * @param data.primaryType - Primary type name for signing
   * @param data.message - Message values to sign
   * @returns Hex-encoded signature
   */
  signTypedData(data: {
    domain: Record<string, unknown>;
    types: Record<string, Array<{ name: string; type: string }>>;
    primaryType: string;
    message: Record<string, unknown>;
  }): Promise<string>;
}
