/**
 * TRON Signer Interfaces
 *
 * Defines the signer interfaces for t402 client and facilitator operations.
 * These interfaces abstract away the specific wallet implementation,
 * allowing integration with various TRON wallets and signing mechanisms.
 */

import type { VerifyMessageResult, TransactionConfirmation } from "./types.js";

/**
 * Parameters for signing a TRC20 transfer transaction
 */
export type SignTransactionParams = {
  /** TRC20 contract address */
  contractAddress: string;

  /** Recipient address (T-prefix base58check) */
  to: string;

  /** Amount to transfer (in smallest units) */
  amount: string;

  /** Fee limit in SUN (optional, defaults to 100 TRX) */
  feeLimit?: number;

  /** Transaction expiration time in milliseconds (optional) */
  expiration?: number;
};

/**
 * Parameters for verifying a signed transaction
 */
export type VerifyTransactionParams = {
  /** Hex-encoded signed transaction */
  signedTransaction: string;

  /** Expected sender address */
  expectedFrom: string;

  /** Expected transfer details */
  expectedTransfer: {
    /** Expected recipient address */
    to: string;

    /** Expected contract address */
    contractAddress: string;

    /** Expected amount */
    amount: string;
  };

  /** Network identifier */
  network: string;
};

/**
 * Parameters for waiting on transaction confirmation
 */
export type WaitForTransactionParams = {
  /** Transaction ID to monitor */
  txId: string;

  /** Network identifier */
  network: string;

  /** Timeout in milliseconds (optional) */
  timeout?: number;
};

/**
 * Parameters for getting TRC20 balance
 */
export type GetBalanceParams = {
  /** Owner address */
  ownerAddress: string;

  /** TRC20 contract address */
  contractAddress: string;

  /** Network identifier */
  network: string;
};

/**
 * ClientTronSigner - Used by t402 clients to sign TRC20 transfer transactions
 *
 * This interface represents a TRON wallet that can:
 * - Sign TRC20 transfer transactions
 * - Query its own address
 *
 * Implementations may include:
 * - TronWeb with private key
 * - TronLink wallet adapter
 * - Hardware wallet integration
 */
export type ClientTronSigner = {
  /** The wallet address (T-prefix base58check) */
  readonly address: string;

  /**
   * Sign a TRC20 transfer transaction
   * Returns the hex-encoded signed transaction ready for broadcast
   *
   * @param params - Transaction parameters
   * @returns Hex-encoded signed transaction
   */
  signTransaction(params: SignTransactionParams): Promise<string>;

  /**
   * Get the current reference block info for transaction building
   * Returns block bytes and hash for replay protection
   *
   * @returns Reference block info
   */
  getBlockInfo(): Promise<{
    refBlockBytes: string;
    refBlockHash: string;
    expiration: number;
  }>;
};

/**
 * FacilitatorTronSigner - Used by t402 facilitators to verify and settle payments
 *
 * This interface combines RPC capabilities with verification abilities:
 * - Query TRC20 balances
 * - Verify signed transactions
 * - Broadcast transactions
 * - Wait for confirmations
 */
export type FacilitatorTronSigner = {
  /**
   * Get all addresses this facilitator can use
   * Enables dynamic address selection for load balancing
   */
  getAddresses(): readonly string[];

  /**
   * Query TRC20 balance for an owner
   *
   * @param params - Balance query parameters
   * @returns Balance in smallest units
   */
  getBalance(params: GetBalanceParams): Promise<string>;

  /**
   * Verify a signed transaction matches expected parameters
   * Validates the transaction structure and transfer details
   *
   * @param params - Verification parameters
   * @returns Verification result
   */
  verifyTransaction(params: VerifyTransactionParams): Promise<VerifyMessageResult>;

  /**
   * Broadcast a signed transaction to the network
   *
   * @param signedTransaction - Hex-encoded signed transaction
   * @param network - Network identifier
   * @returns Transaction ID
   */
  broadcastTransaction(signedTransaction: string, network: string): Promise<string>;

  /**
   * Wait for transaction confirmation
   *
   * @param params - Transaction monitoring parameters
   * @returns Confirmation result
   */
  waitForTransaction(params: WaitForTransactionParams): Promise<TransactionConfirmation>;

  /**
   * Check if an account is activated (has any transaction history)
   *
   * @param address - Address to check
   * @param network - Network identifier
   * @returns true if activated
   */
  isActivated(address: string, network: string): Promise<boolean>;
};

/**
 * Converts a TRON wallet to a ClientTronSigner
 * Identity function for type compatibility
 *
 * @param signer - The signer to convert
 * @returns The same signer with ClientTronSigner type
 */
export function toClientTronSigner(signer: ClientTronSigner): ClientTronSigner {
  return signer;
}

/**
 * Creates a FacilitatorTronSigner from a single-address facilitator
 * Wraps the single address in a getAddresses() function for compatibility
 *
 * @param client - Facilitator client with single address
 * @returns FacilitatorTronSigner with getAddresses() support
 */
export function toFacilitatorTronSigner(
  client: Omit<FacilitatorTronSigner, "getAddresses"> & { address: string },
): FacilitatorTronSigner {
  return {
    ...client,
    getAddresses: () => [client.address],
  };
}
