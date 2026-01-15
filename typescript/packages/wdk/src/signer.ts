/**
 * WDK Signer implementation for T402 payments
 *
 * This signer wraps the Tether WDK account to provide a T402-compatible
 * signing interface for EVM chains.
 */

import type { Address } from "viem";
import type { ClientEvmSigner } from "@t402/evm";
import type { WDKAccount, WDKInstance } from "./types.js";
import { getChainId } from "./chains.js";
import {
  SignerError,
  SigningError,
  BalanceError,
  TransactionError,
  WDKErrorCode,
  wrapError,
  withRetry,
  withTimeout,
  type RetryConfig,
} from "./errors.js";

/**
 * Default timeout for signer operations (30 seconds)
 */
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Default retry config for balance operations
 */
const DEFAULT_BALANCE_RETRY: Partial<RetryConfig> = {
  maxRetries: 2,
  baseDelay: 500,
};

/**
 * WDK Signer for T402 EVM payments
 *
 * Implements the ClientEvmSigner interface from @t402/evm,
 * wrapping a Tether WDK account for signing operations.
 *
 * @example
 * ```typescript
 * import { T402WDK } from '@t402/wdk';
 *
 * const wdk = new T402WDK(seedPhrase, { arbitrum: 'https://arb1.arbitrum.io/rpc' });
 * const signer = await wdk.getSigner('arbitrum');
 *
 * // Use with T402 client
 * const client = createT402HTTPClient({
 *   signers: [{ scheme: 'exact', signer }]
 * });
 * ```
 */
export class WDKSigner implements ClientEvmSigner {
  private _wdk: WDKInstance;
  private _chain: string;
  private _accountIndex: number;
  private _account: WDKAccount | null = null;
  private _address: Address | null = null;
  private _timeoutMs: number;

  /**
   * Create a new WDK signer
   *
   * @param wdk - The WDK instance
   * @param chain - Chain name (e.g., "arbitrum", "ethereum")
   * @param accountIndex - HD wallet account index (default: 0)
   * @param timeoutMs - Timeout for operations in milliseconds (default: 30000)
   */
  constructor(wdk: WDKInstance, chain: string, accountIndex = 0, timeoutMs = DEFAULT_TIMEOUT_MS) {
    if (!wdk) {
      throw new SignerError(
        WDKErrorCode.WDK_NOT_INITIALIZED,
        "WDK instance is required",
        { chain },
      );
    }

    if (!chain || typeof chain !== "string") {
      throw new SignerError(
        WDKErrorCode.CHAIN_NOT_CONFIGURED,
        "Chain name is required and must be a string",
        { chain },
      );
    }

    if (accountIndex < 0 || !Number.isInteger(accountIndex)) {
      throw new SignerError(
        WDKErrorCode.SIGNER_NOT_INITIALIZED,
        "Account index must be a non-negative integer",
        { chain, context: { accountIndex } },
      );
    }

    this._wdk = wdk;
    this._chain = chain;
    this._accountIndex = accountIndex;
    this._timeoutMs = timeoutMs;
  }

  /**
   * Get the wallet address
   * Throws if signer is not initialized
   */
  get address(): Address {
    if (!this._address) {
      throw new SignerError(
        WDKErrorCode.SIGNER_NOT_INITIALIZED,
        `Signer not initialized for chain "${this._chain}". Call initialize() first or use createWDKSigner() async factory.`,
        { chain: this._chain },
      );
    }
    return this._address;
  }

  /**
   * Check if the signer is initialized
   */
  get isInitialized(): boolean {
    return this._account !== null && this._address !== null;
  }

  /**
   * Initialize the signer by fetching the account
   * Must be called before using the signer
   *
   * @throws {SignerError} If account fetch fails
   */
  async initialize(): Promise<void> {
    if (this._account) return;

    try {
      const accountPromise = this._wdk.getAccount(this._chain, this._accountIndex);
      this._account = await withTimeout(
        accountPromise,
        this._timeoutMs,
        `Fetching account for ${this._chain}`,
      );

      const addressPromise = this._account.getAddress();
      const addressString = await withTimeout(
        addressPromise,
        this._timeoutMs,
        `Fetching address for ${this._chain}`,
      );

      // Validate address format
      if (!addressString || !addressString.startsWith("0x")) {
        throw new SignerError(
          WDKErrorCode.ADDRESS_FETCH_FAILED,
          `Invalid address format received: ${addressString}`,
          { chain: this._chain },
        );
      }

      this._address = addressString as Address;
    } catch (error) {
      // Reset state on failure
      this._account = null;
      this._address = null;

      // Re-throw if already a typed error
      if (error instanceof SignerError) {
        throw error;
      }

      throw new SignerError(
        WDKErrorCode.ACCOUNT_FETCH_FAILED,
        `Failed to initialize signer for chain "${this._chain}": ${error instanceof Error ? error.message : String(error)}`,
        {
          chain: this._chain,
          cause: error instanceof Error ? error : undefined,
          context: { accountIndex: this._accountIndex },
        },
      );
    }
  }

  /**
   * Get the underlying WDK account
   * Initializes if not already done
   *
   * @throws {SignerError} If initialization fails
   */
  private async getAccount(): Promise<WDKAccount> {
    if (!this._account) {
      await this.initialize();
    }
    return this._account!;
  }

  /**
   * Sign EIP-712 typed data for T402 payments
   *
   * This is the primary signing method used by T402 for EIP-3009
   * transferWithAuthorization payments.
   *
   * @throws {SigningError} If signing fails
   */
  async signTypedData(message: {
    domain: Record<string, unknown>;
    types: Record<string, unknown>;
    primaryType: string;
    message: Record<string, unknown>;
  }): Promise<`0x${string}`> {
    // Validate input
    if (!message || typeof message !== "object") {
      throw new SigningError(
        WDKErrorCode.INVALID_TYPED_DATA,
        "Invalid typed data: message object is required",
        { operation: "signTypedData", context: { chain: this._chain } },
      );
    }

    if (!message.domain || !message.types || !message.primaryType || !message.message) {
      throw new SigningError(
        WDKErrorCode.INVALID_TYPED_DATA,
        "Invalid typed data: domain, types, primaryType, and message are required",
        {
          operation: "signTypedData",
          context: {
            chain: this._chain,
            hasFields: {
              domain: !!message.domain,
              types: !!message.types,
              primaryType: !!message.primaryType,
              message: !!message.message,
            },
          },
        },
      );
    }

    try {
      const account = await this.getAccount();

      const signPromise = account.signTypedData({
        domain: message.domain,
        types: message.types,
        primaryType: message.primaryType,
        message: message.message,
      });

      const signature = await withTimeout(
        signPromise,
        this._timeoutMs,
        "Signing typed data",
      );

      // Validate signature format
      if (!signature || !signature.startsWith("0x")) {
        throw new SigningError(
          WDKErrorCode.SIGN_TYPED_DATA_FAILED,
          `Invalid signature format received: ${signature?.substring(0, 10)}...`,
          { operation: "signTypedData", context: { chain: this._chain } },
        );
      }

      return signature as `0x${string}`;
    } catch (error) {
      if (error instanceof SigningError) {
        throw error;
      }

      const wrapped = wrapError(error, WDKErrorCode.SIGN_TYPED_DATA_FAILED, "Failed to sign typed data", {
        chain: this._chain,
        primaryType: message.primaryType,
      });

      throw new SigningError(
        wrapped.code as WDKErrorCode,
        wrapped.message,
        {
          operation: "signTypedData",
          cause: wrapped.cause,
          context: wrapped.context,
        },
      );
    }
  }

  /**
   * Sign a personal message
   *
   * @throws {SigningError} If signing fails
   */
  async signMessage(message: string | Uint8Array): Promise<`0x${string}`> {
    // Validate input
    if (message === undefined || message === null) {
      throw new SigningError(
        WDKErrorCode.INVALID_MESSAGE,
        "Message is required for signing",
        { operation: "signMessage", context: { chain: this._chain } },
      );
    }

    if (typeof message !== "string" && !(message instanceof Uint8Array)) {
      throw new SigningError(
        WDKErrorCode.INVALID_MESSAGE,
        "Message must be a string or Uint8Array",
        { operation: "signMessage", context: { chain: this._chain, type: typeof message } },
      );
    }

    try {
      const account = await this.getAccount();

      const messageStr = typeof message === "string"
        ? message
        : Buffer.from(message).toString("utf-8");

      const signPromise = account.signMessage(messageStr);
      const signature = await withTimeout(
        signPromise,
        this._timeoutMs,
        "Signing message",
      );

      // Validate signature format
      if (!signature || !signature.startsWith("0x")) {
        throw new SigningError(
          WDKErrorCode.SIGN_MESSAGE_FAILED,
          `Invalid signature format received: ${signature?.substring(0, 10)}...`,
          { operation: "signMessage", context: { chain: this._chain } },
        );
      }

      return signature as `0x${string}`;
    } catch (error) {
      if (error instanceof SigningError) {
        throw error;
      }

      const wrapped = wrapError(error, WDKErrorCode.SIGN_MESSAGE_FAILED, "Failed to sign message", {
        chain: this._chain,
      });

      throw new SigningError(
        wrapped.code as WDKErrorCode,
        wrapped.message,
        {
          operation: "signMessage",
          cause: wrapped.cause,
          context: wrapped.context,
        },
      );
    }
  }

  /**
   * Get the chain name
   */
  getChain(): string {
    return this._chain;
  }

  /**
   * Get the chain ID
   */
  getChainId(): number {
    return getChainId(this._chain);
  }

  /**
   * Get the account index
   */
  getAccountIndex(): number {
    return this._accountIndex;
  }

  /**
   * Get native token balance (ETH, etc.)
   *
   * @throws {BalanceError} If balance fetch fails
   */
  async getBalance(): Promise<bigint> {
    try {
      const account = await this.getAccount();

      return await withRetry(
        async () => {
          const balancePromise = account.getBalance();
          return withTimeout(balancePromise, this._timeoutMs, "Fetching native balance");
        },
        DEFAULT_BALANCE_RETRY,
      );
    } catch (error) {
      if (error instanceof BalanceError) {
        throw error;
      }

      throw new BalanceError(
        WDKErrorCode.BALANCE_FETCH_FAILED,
        `Failed to get native balance for ${this._chain}: ${error instanceof Error ? error.message : String(error)}`,
        {
          chain: this._chain,
          cause: error instanceof Error ? error : undefined,
        },
      );
    }
  }

  /**
   * Get ERC20 token balance
   *
   * @throws {BalanceError} If balance fetch fails
   */
  async getTokenBalance(tokenAddress: Address): Promise<bigint> {
    // Validate token address
    if (!tokenAddress || !tokenAddress.startsWith("0x")) {
      throw new BalanceError(
        WDKErrorCode.INVALID_TOKEN_ADDRESS,
        `Invalid token address: ${tokenAddress}`,
        { chain: this._chain, token: tokenAddress },
      );
    }

    try {
      const account = await this.getAccount();

      return await withRetry(
        async () => {
          const balancePromise = account.getTokenBalance(tokenAddress);
          return withTimeout(balancePromise, this._timeoutMs, "Fetching token balance");
        },
        DEFAULT_BALANCE_RETRY,
      );
    } catch (error) {
      if (error instanceof BalanceError) {
        throw error;
      }

      throw new BalanceError(
        WDKErrorCode.TOKEN_BALANCE_FETCH_FAILED,
        `Failed to get token balance for ${tokenAddress} on ${this._chain}: ${error instanceof Error ? error.message : String(error)}`,
        {
          chain: this._chain,
          token: tokenAddress,
          cause: error instanceof Error ? error : undefined,
        },
      );
    }
  }

  /**
   * Estimate gas for a transaction
   *
   * @throws {TransactionError} If gas estimation fails
   */
  async estimateGas(params: { to: Address; value?: bigint; data?: string }): Promise<bigint> {
    // Validate params
    if (!params.to || !params.to.startsWith("0x")) {
      throw new TransactionError(
        WDKErrorCode.GAS_ESTIMATION_FAILED,
        `Invalid 'to' address: ${params.to}`,
        { chain: this._chain, context: params },
      );
    }

    try {
      const account = await this.getAccount();

      return await withRetry(
        async () => {
          const estimatePromise = account.estimateGas({
            to: params.to,
            value: params.value,
            data: params.data,
          });
          return withTimeout(estimatePromise, this._timeoutMs, "Estimating gas");
        },
        DEFAULT_BALANCE_RETRY,
      );
    } catch (error) {
      if (error instanceof TransactionError) {
        throw error;
      }

      throw new TransactionError(
        WDKErrorCode.GAS_ESTIMATION_FAILED,
        `Failed to estimate gas on ${this._chain}: ${error instanceof Error ? error.message : String(error)}`,
        {
          chain: this._chain,
          cause: error instanceof Error ? error : undefined,
          context: { to: params.to, value: params.value?.toString() },
        },
      );
    }
  }

  /**
   * Send a transaction (for advanced use cases)
   *
   * @throws {TransactionError} If transaction fails
   */
  async sendTransaction(params: {
    to: Address;
    value?: bigint;
    data?: string;
  }): Promise<{ hash: `0x${string}` }> {
    // Validate params
    if (!params.to || !params.to.startsWith("0x")) {
      throw new TransactionError(
        WDKErrorCode.TRANSACTION_FAILED,
        `Invalid 'to' address: ${params.to}`,
        { chain: this._chain, context: params },
      );
    }

    try {
      const account = await this.getAccount();

      const sendPromise = account.sendTransaction({
        to: params.to,
        value: params.value,
        data: params.data,
      });

      const hash = await withTimeout(
        sendPromise,
        this._timeoutMs * 2, // Double timeout for transaction submission
        "Sending transaction",
      );

      // Validate hash format
      if (!hash || !hash.startsWith("0x")) {
        throw new TransactionError(
          WDKErrorCode.TRANSACTION_FAILED,
          `Invalid transaction hash received: ${hash?.substring(0, 10)}...`,
          { chain: this._chain },
        );
      }

      return { hash: hash as `0x${string}` };
    } catch (error) {
      if (error instanceof TransactionError) {
        throw error;
      }

      const wrapped = wrapError(error, WDKErrorCode.TRANSACTION_FAILED, "Transaction failed", {
        chain: this._chain,
        to: params.to,
      });

      throw new TransactionError(
        wrapped.code as WDKErrorCode,
        wrapped.message,
        {
          chain: this._chain,
          cause: wrapped.cause,
          context: wrapped.context,
        },
      );
    }
  }
}

/**
 * Create an initialized WDK signer
 *
 * This async factory function creates and initializes a WDK signer,
 * ensuring the address is available immediately.
 *
 * @throws {SignerError} If initialization fails
 *
 * @example
 * ```typescript
 * const signer = await createWDKSigner(wdkInstance, 'arbitrum');
 * console.log('Address:', signer.address); // Works immediately
 * ```
 */
export async function createWDKSigner(
  wdk: WDKInstance,
  chain: string,
  accountIndex = 0,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<WDKSigner> {
  const signer = new WDKSigner(wdk, chain, accountIndex, timeoutMs);
  await signer.initialize();
  return signer;
}

/**
 * Mock WDK signer for testing purposes
 *
 * Implements the same interface but uses a fixed private key
 * for deterministic testing.
 */
export class MockWDKSigner implements ClientEvmSigner {
  readonly address: Address;

  constructor(address: Address, _privateKey: `0x${string}`) {
    this.address = address;
    // Note: privateKey available for future signing implementation
  }

  async signTypedData(_message: {
    domain: Record<string, unknown>;
    types: Record<string, unknown>;
    primaryType: string;
    message: Record<string, unknown>;
  }): Promise<`0x${string}`> {
    // Mock signature - in real tests, use viem's signTypedData
    return "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
  }

  async signMessage(_message: string | Uint8Array): Promise<`0x${string}`> {
    return "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
  }
}
