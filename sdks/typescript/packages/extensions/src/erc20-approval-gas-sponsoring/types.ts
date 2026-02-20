/**
 * ERC-20 Approval Gas Sponsoring Extension Type Definitions
 *
 * ERC-20 approve()-based gas sponsoring for the t402 payment protocol.
 * For tokens WITHOUT EIP-2612 permit support, the client signs an offline
 * approve() transaction and the facilitator broadcasts it on their behalf.
 */

/**
 * Information provided by server about ERC-20 approval gas sponsoring availability.
 */
export interface ERC20ApprovalGasSponsorExtensionInfo {
  /** CAIP-2 network identifiers where gas sponsoring is available */
  sponsoredNetworks: string[];

  /** Maximum token amount (in base units) the sponsor will cover per approval */
  maxAmount: string;

  /** Address of the sponsor/facilitator that will submit transactions */
  sponsorAddress: string;

  /** Optional Permit2 proxy address for advanced settlement flows */
  permit2Address?: string;

  /** Whether atomic batch execution is required (e.g., via Multicall3) */
  requiresAtomicBatch: boolean;
}

/**
 * ERC-20 approval gas sponsor extension declaration for server responses.
 */
export interface ERC20ApprovalGasSponsorExtension {
  /** Extension information */
  info: ERC20ApprovalGasSponsorExtensionInfo;

  /** JSON Schema for validation */
  schema: object;
}

/**
 * Complete ERC-20 approval gas sponsor payload from client.
 */
export interface ERC20ApprovalGasSponsorPayload {
  /** CAIP-2 network identifier (must be in sponsoredNetworks) */
  network: string;

  /** Client wallet address that signed the transaction */
  from: string;

  /** ERC-20 token contract address */
  asset: string;

  /** Approval amount in base units */
  amount: string;

  /** Raw signed approve() transaction (hex-encoded with 0x prefix) */
  signedApprovalTx: string;

  /** Chain ID for replay protection */
  chainId: number;

  /** Client's account nonce (if known) */
  nonce?: number;
}

/**
 * Options for declaring ERC-20 approval gas sponsor extension on server.
 */
export interface DeclareERC20ApprovalGasSponsorOptions {
  /** CAIP-2 network identifiers where gas sponsoring is available */
  sponsoredNetworks: string[];

  /** Maximum token amount (in base units) the sponsor will cover per approval */
  maxAmount: string;

  /** Address of the sponsor/facilitator */
  sponsorAddress: string;

  /** Optional Permit2 proxy address */
  permit2Address?: string;

  /** Whether atomic batch execution is required (defaults to false) */
  requiresAtomicBatch?: boolean;
}

/**
 * Options for validating ERC-20 approval gas sponsor payloads.
 */
export interface ValidateERC20ApprovalGasSponsorOptions {
  /** Expected chain IDs per CAIP-2 network (e.g., { "eip155:8453": 8453 }) */
  expectedChainIds?: Record<string, number>;
}

/**
 * Result of ERC-20 approval gas sponsor payload validation.
 */
export interface ERC20ApprovalGasSponsorValidationResult {
  /** Whether the payload is valid */
  valid: boolean;

  /** Error message if invalid */
  error?: string;
}

/**
 * Parameters for creating an ERC-20 approval gas sponsor payload.
 */
export interface CreateERC20ApprovalParams {
  /** CAIP-2 network identifier */
  network: string;

  /** Client wallet address */
  from: string;

  /** ERC-20 token contract address */
  asset: string;

  /** Approval amount in base units */
  amount: string;

  /** Raw signed approve() transaction (hex-encoded) */
  signedApprovalTx: string;

  /** Chain ID for replay protection */
  chainId: number;

  /** Client's account nonce (if known) */
  nonce?: number;
}
