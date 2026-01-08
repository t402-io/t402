/**
 * TON Payment Payload Types
 *
 * Defines the payload structure for TON Jetton payments in the t402 protocol.
 * Uses BOC (Bag of Cells) format for message serialization.
 */

/**
 * TON payment payload for the exact scheme (V2)
 * Contains a pre-signed external message for Jetton transfer
 */
export type ExactTonPayloadV2 = {
  /**
   * Base64 encoded signed external message (BOC format)
   * Contains the complete Jetton transfer message ready for broadcast
   * The message is signed by the client's wallet private key
   */
  signedBoc: string;

  /**
   * Transfer authorization metadata
   * Provides human-readable and verifiable parameters
   */
  authorization: {
    /**
     * Sender wallet address (friendly format, bounceable)
     * This is the TON wallet address that will send the Jetton transfer
     */
    from: string;

    /**
     * Recipient wallet address (friendly format)
     * Final destination for the Jetton tokens
     */
    to: string;

    /**
     * Jetton master contract address
     * Identifies which Jetton token is being transferred
     */
    jettonMaster: string;

    /**
     * Jetton amount in smallest units (e.g., 1000000 for 1 USDT with 6 decimals)
     */
    jettonAmount: string;

    /**
     * TON amount attached for gas (in nanoTON)
     * Required to pay for the internal message execution
     */
    tonAmount: string;

    /**
     * Unix timestamp (seconds) after which the authorization expires
     * Message will be rejected by the network after this time
     */
    validUntil: number;

    /**
     * Wallet sequence number at time of signing
     * Prevents replay attacks - each seqno can only be used once
     */
    seqno: number;

    /**
     * Query ID for the Jetton transfer
     * Used for message correlation and deduplication
     */
    queryId: string;
  };
};

/**
 * Alias for the current payload version
 */
export type ExactTonPayload = ExactTonPayloadV2;

/**
 * Result of message verification
 */
export type VerifyMessageResult = {
  /** Whether the message is valid */
  valid: boolean;
  /** Reason for invalidity (if applicable) */
  reason?: string;
  /** Extracted transfer parameters */
  transfer?: {
    from: string;
    to: string;
    jettonAmount: bigint;
    queryId: bigint;
  };
};

/**
 * Transaction confirmation result
 */
export type TransactionConfirmation = {
  /** Whether the transaction was confirmed */
  success: boolean;
  /** Logical time of the transaction */
  lt?: bigint;
  /** Transaction hash */
  hash?: string;
  /** Error message if failed */
  error?: string;
};
