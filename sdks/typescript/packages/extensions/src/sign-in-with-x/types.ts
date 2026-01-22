/**
 * Sign-In-With-X (SIWx) Type Definitions
 *
 * CAIP-122 compliant wallet-based identity assertions for t402 protocol.
 */

/**
 * Supported signature schemes for SIWx.
 */
export type SignatureScheme =
  | "eip191" // Personal sign
  | "eip712" // Typed data sign
  | "eip1271" // Smart contract signature
  | "eip6492" // Universal signature with deployment
  | "siws" // Sign-In With Solana
  | "sep10"; // Stellar SEP-10

/**
 * Information provided by server about SIWx requirements.
 */
export interface SIWxExtensionInfo {
  /** Domain derived from resourceUri (without protocol) */
  domain: string;

  /** Full resource URI */
  uri: string;

  /** Optional statement explaining what the signature is for */
  statement?: string;

  /** SIWx version (default: "1") */
  version: string;

  /** Chain ID in CAIP-2 format (e.g., "eip155:8453") */
  chainId: string;

  /** Cryptographically secure nonce */
  nonce: string;

  /** ISO 8601 timestamp when message was issued */
  issuedAt: string;

  /** ISO 8601 timestamp when signature expires */
  expirationTime?: string;

  /** ISO 8601 timestamp before which signature is not valid */
  notBefore?: string;

  /** Optional request ID for session correlation */
  requestId?: string;

  /** Resources being authenticated for */
  resources: string[];

  /** Preferred signature scheme */
  signatureScheme?: SignatureScheme;
}

/**
 * SIWx extension declaration for server responses.
 */
export interface SIWxExtension {
  /** Extension information */
  info: SIWxExtensionInfo;

  /** JSON Schema for validation */
  schema: object;
}

/**
 * Complete SIWx payload including signature.
 */
export interface SIWxPayload {
  /** Domain from the server */
  domain: string;

  /** Wallet address making the assertion */
  address: string;

  /** Optional statement */
  statement?: string;

  /** Resource URI */
  uri: string;

  /** SIWx version */
  version: string;

  /** Chain ID in CAIP-2 format */
  chainId: string;

  /** Nonce from server */
  nonce: string;

  /** ISO 8601 timestamp when message was issued */
  issuedAt: string;

  /** ISO 8601 timestamp when signature expires */
  expirationTime?: string;

  /** ISO 8601 timestamp before which signature is not valid */
  notBefore?: string;

  /** Optional request ID */
  requestId?: string;

  /** Resources array */
  resources?: string[];

  /** Cryptographic signature */
  signature: string;
}

/**
 * Options for declaring SIWx extension on server.
 */
export interface DeclareSIWxOptions {
  /** Full URI of the resource (domain derived from this) */
  resourceUri: string;

  /** Optional statement explaining the sign-in purpose */
  statement?: string;

  /** SIWx version (defaults to "1") */
  version?: string;

  /** Network in CAIP-2 format (e.g., "eip155:8453") */
  network: `${string}:${string}`;

  /** Expiration time (auto-set to +5 minutes if not provided) */
  expirationTime?: string;

  /** Preferred signature scheme */
  signatureScheme?: SignatureScheme;
}

/**
 * Options for validating SIWx messages.
 */
export interface ValidateSIWxOptions {
  /** Maximum age of issuedAt in milliseconds (default: 5 minutes) */
  maxAge?: number;

  /** Custom nonce validation function */
  checkNonce?: (nonce: string) => boolean;
}

/**
 * Options for verifying SIWx signatures.
 */
export interface VerifySIWxOptions {
  /** Web3 provider for on-chain verification */
  provider?: unknown;

  /** Enable EIP-1271/6492 smart wallet verification */
  checkSmartWallet?: boolean;
}

/**
 * Result of SIWx message validation.
 */
export interface SIWxValidationResult {
  /** Whether the message is valid */
  valid: boolean;

  /** Error message if invalid */
  error?: string;
}

/**
 * Result of SIWx signature verification.
 */
export interface SIWxVerificationResult {
  /** Whether the signature is valid */
  valid: boolean;

  /** Recovered/verified address */
  address?: string;

  /** Error message if invalid */
  error?: string;
}

/**
 * Signer interface for client-side signing.
 */
export interface SIWxSigner {
  /** Wallet address */
  address: string;

  /** Sign a message using personal_sign (EIP-191) */
  signMessage?(message: string): Promise<string>;

  /** Sign typed data (EIP-712) */
  signTypedData?(data: unknown): Promise<string>;
}
