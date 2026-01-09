/**
 * TRON Payment Types
 *
 * Type definitions for TRON TRC20 payment payloads.
 */

/**
 * Authorization metadata for a TRON TRC20 transfer
 *
 * Contains all information needed to verify and track a payment
 * without parsing the signed transaction.
 */
export type TronAuthorization = {
  /** Sender wallet address (T-prefix base58check) */
  from: string;

  /** Recipient wallet address (T-prefix base58check) */
  to: string;

  /** TRC20 contract address (e.g., USDT contract) */
  contractAddress: string;

  /** Transfer amount in smallest units (as string for large numbers) */
  amount: string;

  /** Transaction expiration timestamp (milliseconds since epoch) */
  expiration: number;

  /** Reference block bytes (hex string) */
  refBlockBytes: string;

  /** Reference block hash (hex string) */
  refBlockHash: string;

  /** Transaction timestamp (milliseconds since epoch) */
  timestamp: number;
};

/**
 * V2 TRON payment payload
 *
 * Contains the signed transaction ready for broadcast
 * along with authorization metadata for verification.
 */
export type ExactTronPayloadV2 = {
  /** Hex-encoded signed transaction */
  signedTransaction: string;

  /** Transaction authorization metadata */
  authorization: TronAuthorization;
};

/**
 * Current version alias
 */
export type ExactTronPayload = ExactTronPayloadV2;

/**
 * Result of verifying a signed TRON transaction
 */
export type VerifyMessageResult = {
  /** Whether the message is valid */
  valid: boolean;

  /** Reason for invalidity (if not valid) */
  reason?: string;

  /** Parsed transfer details (if valid) */
  transfer?: {
    /** Sender address */
    from: string;

    /** Recipient address */
    to: string;

    /** Contract address */
    contractAddress: string;

    /** Transfer amount */
    amount: string;

    /** Transaction ID */
    txId: string;
  };
};

/**
 * Transaction confirmation result
 */
export type TransactionConfirmation = {
  /** Whether the transaction was confirmed */
  success: boolean;

  /** Transaction ID/hash */
  txId?: string;

  /** Block number containing the transaction */
  blockNumber?: number;

  /** Error message if failed */
  error?: string;
};

/**
 * TRC20 token configuration
 */
export type TRC20Config = {
  /** Contract address (T-prefix) */
  contractAddress: string;

  /** Token symbol (e.g., "USDT") */
  symbol: string;

  /** Token name (e.g., "Tether USD") */
  name: string;

  /** Token decimals */
  decimals: number;
};

/**
 * Network-specific token registry
 */
export type NetworkTRC20Registry = {
  /** Network CAIP-2 identifier */
  network: string;

  /** Default token for this network */
  defaultToken: TRC20Config;

  /** All supported tokens on this network */
  tokens: Record<string, TRC20Config>;
};
