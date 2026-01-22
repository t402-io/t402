/**
 * NEAR Payment Types
 *
 * Defines the payload structure for NEAR NEP-141 payments using the exact-direct scheme.
 * The exact-direct scheme has the client execute the transfer directly, then provide
 * the transaction hash as proof of payment.
 */

/**
 * NEAR payment payload for the exact-direct scheme
 * Contains transaction hash and metadata for verification
 */
export type ExactDirectNearPayload = {
  /**
   * Transaction hash of the completed ft_transfer
   * This is the base58 encoded transaction hash from NEAR
   */
  txHash: string;

  /**
   * Sender account ID (e.g., "alice.near")
   */
  from: string;

  /**
   * Recipient account ID (e.g., "merchant.near")
   */
  to: string;

  /**
   * Transfer amount in smallest units (e.g., "1000000" for 1 USDC)
   */
  amount: string;
};

/**
 * Result of transaction verification
 */
export interface VerifyTransactionResult {
  /** Whether the transaction is valid */
  valid: boolean;
  /** Reason for invalidity (if applicable) */
  reason?: string;
  /** Extracted transfer parameters */
  transfer?: {
    from: string;
    to: string;
    amount: bigint;
    tokenContract: string;
    blockHash: string;
  };
}

/**
 * NEAR transaction status
 */
export interface TransactionStatus {
  SuccessValue?: string;
  Failure?: unknown;
}

/**
 * NEAR transaction outcome
 */
export interface TransactionOutcome {
  block_hash: string;
  id: string;
}

/**
 * NEAR function call action
 */
export interface FunctionCallAction {
  FunctionCall: {
    method_name: string;
    args: string; // base64 encoded
    gas: number;
    deposit: string;
  };
}

/**
 * NEAR transaction
 */
export interface NearTransaction {
  hash: string;
  signer_id: string;
  receiver_id: string;
  actions: FunctionCallAction[];
}

/**
 * NEAR transaction result from RPC query
 */
export interface TransactionResult {
  status: TransactionStatus;
  transaction: NearTransaction;
  transaction_outcome: TransactionOutcome;
  receipts_outcome: Array<{
    id: string;
    outcome: {
      status: TransactionStatus;
      gas_burnt: number;
      tokens_burnt: string;
    };
  }>;
}

/**
 * NEAR RPC request
 */
export interface NearRpcRequest {
  jsonrpc: "2.0";
  id: string;
  method: string;
  params: unknown[] | Record<string, unknown>;
}

/**
 * NEAR RPC response
 */
export interface NearRpcResponse<T = unknown> {
  jsonrpc: "2.0";
  id: string;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: string;
  };
}

/**
 * ft_transfer arguments
 */
export interface FtTransferArgs {
  receiver_id: string;
  amount: string;
  memo?: string | null;
}

/**
 * NEAR signer interface for client operations
 */
export interface ClientNearSigner {
  /** Get the account ID */
  readonly accountId: string;

  /**
   * Sign and send a transaction
   * @param receiverId - Contract to call
   * @param methodName - Method to call
   * @param args - Method arguments
   * @param gas - Gas to attach
   * @param deposit - yoctoNEAR to attach
   * @returns Transaction hash
   */
  signAndSendTransaction(
    receiverId: string,
    methodName: string,
    args: Record<string, unknown>,
    gas: string,
    deposit: string,
  ): Promise<string>;
}

/**
 * NEAR signer interface for facilitator operations
 */
export interface FacilitatorNearSigner {
  /**
   * Get the facilitator's account IDs for a network
   * @param network - CAIP-2 network identifier
   */
  getAddresses(network: string): string[];

  /**
   * Query a transaction by hash
   * @param txHash - Transaction hash
   * @param senderAccountId - Sender account ID (required for NEAR tx query)
   * @returns Transaction result
   */
  queryTransaction(txHash: string, senderAccountId: string): Promise<TransactionResult>;

  /**
   * Get token balance for an account
   * @param accountId - Account ID
   * @param tokenContract - Token contract address
   */
  getBalance(accountId: string, tokenContract: string): Promise<bigint>;
}
