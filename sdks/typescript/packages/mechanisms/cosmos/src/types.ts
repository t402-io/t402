/**
 * Cosmos Payment Types
 *
 * Defines the payload structure for Cosmos (Noble USDC) payments using the exact-direct scheme.
 * The exact-direct scheme has the client execute the transfer directly, then provide
 * the transaction hash as proof of payment.
 */

/**
 * Cosmos payment payload for the exact-direct scheme
 * Contains transaction hash and metadata for verification
 */
export type ExactDirectCosmosPayload = {
  /**
   * Transaction hash of the completed MsgSend
   */
  txHash: string;

  /**
   * Sender bech32 address (e.g., "noble1...")
   */
  from: string;

  /**
   * Recipient bech32 address (e.g., "noble1...")
   */
  to: string;

  /**
   * Transfer amount in smallest units (e.g., "1000000" for 1 USDC)
   */
  amount: string;

  /**
   * Token denomination (e.g., "uusdc")
   */
  denom?: string;
};

/**
 * Token configuration
 */
export interface TokenConfig {
  /** Token denomination */
  denom: string;
  /** Token symbol */
  symbol: string;
  /** Token name */
  name: string;
  /** Decimal places */
  decimals: number;
  /** Priority for selection (lower = higher priority) */
  priority: number;
}

/**
 * Network configuration
 */
export interface NetworkConfig {
  /** CAIP-2 network identifier */
  network: string;
  /** Bech32 address prefix */
  bech32Prefix: string;
  /** RPC endpoint */
  rpcEndpoint: string;
  /** REST endpoint */
  restEndpoint: string;
}

/**
 * Cosmos transaction result
 */
export interface TransactionResult {
  /** Transaction hash */
  txHash: string;
  /** Block height */
  height: string;
  /** Result code (0 = success) */
  code: number;
  /** Raw log */
  rawLog: string;
  /** Gas wanted */
  gasWanted: string;
  /** Gas used */
  gasUsed: string;
  /** Transaction timestamp */
  timestamp: string;
  /** Transaction body */
  tx: TxWrapper;
}

/**
 * Transaction wrapper
 */
export interface TxWrapper {
  body: TxBody;
}

/**
 * Transaction body
 */
export interface TxBody {
  messages: MsgSend[];
  memo: string;
}

/**
 * Cosmos MsgSend
 */
export interface MsgSend {
  "@type"?: string;
  fromAddress: string;
  toAddress: string;
  amount: Coin[];
}

/**
 * Cosmos Coin
 */
export interface Coin {
  denom: string;
  amount: string;
}

/**
 * Cosmos signer interface for client operations
 */
export interface ClientCosmosSigner {
  /**
   * Get the bech32 address
   */
  readonly address: string;

  /**
   * Send tokens to a recipient
   * @param network - CAIP-2 network identifier
   * @param to - Recipient bech32 address
   * @param amount - Amount in smallest units
   * @param denom - Token denomination
   * @returns Transaction hash
   */
  sendTokens(network: string, to: string, amount: string, denom: string): Promise<string>;
}

/**
 * Cosmos signer interface for facilitator operations
 */
export interface FacilitatorCosmosSigner {
  /**
   * Get the facilitator's addresses for a network
   * @param network - CAIP-2 network identifier
   */
  getAddresses(network: string): string[];

  /**
   * Query a transaction by hash
   * @param network - CAIP-2 network identifier
   * @param txHash - Transaction hash
   * @returns Transaction result
   */
  queryTransaction(network: string, txHash: string): Promise<TransactionResult>;

  /**
   * Get token balance for an address
   * @param network - CAIP-2 network identifier
   * @param address - Bech32 address
   * @param denom - Token denomination
   */
  getBalance(network: string, address: string, denom: string): Promise<bigint>;
}
