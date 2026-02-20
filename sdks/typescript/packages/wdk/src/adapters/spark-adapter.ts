/**
 * Spark (Bitcoin L2) Signer Adapter for WDK
 *
 * Wraps a Spark wallet account to implement T402's payment signing interface.
 * Spark is a Bitcoin L2 built on the Spark SDK (@buildonspark/spark-sdk).
 */

/**
 * SparkWalletAccount interface (matches @buildonspark/spark-sdk)
 */
export interface SparkWalletAccount {
  getAddress(): Promise<string>
  getBalance(): Promise<bigint>
  sendTransaction(params: { to: string; amount: bigint }): Promise<{ hash: string }>
  signMessage(message: string | Uint8Array): Promise<string>
}

/**
 * WDKSparkSignerAdapter - Adapts a Spark wallet account for T402 payments
 *
 * @example
 * ```typescript
 * const adapter = await createWDKSparkSigner(sparkAccount);
 *
 * // Use with T402 client
 * const client = createT402HTTPClient({
 *   signers: [{ scheme: 'exact', network: 'spark:mainnet', signer: adapter }]
 * });
 * ```
 */
export class WDKSparkSignerAdapter {
  private _account: SparkWalletAccount
  private _address: string | null = null
  private _initialized = false

  constructor(account: SparkWalletAccount) {
    if (!account) {
      throw new Error('Spark wallet account is required')
    }
    this._account = account
  }

  /**
   * Get the wallet address
   * @throws Error if not initialized
   */
  get address(): string {
    if (!this._address) {
      throw new Error(
        'Spark signer not initialized. Call initialize() first or use createWDKSparkSigner().',
      )
    }
    return this._address
  }

  /**
   * Check if the adapter is initialized
   */
  get isInitialized(): boolean {
    return this._initialized
  }

  /**
   * Initialize the adapter by fetching the address
   * Must be called before using the signer
   */
  async initialize(): Promise<void> {
    if (this._initialized) {
      return
    }

    this._address = await this._account.getAddress()
    this._initialized = true
  }

  /**
   * Sign a message using the Spark wallet
   * @param message - Message to sign (string or bytes)
   * @returns Signature string
   */
  async signMessage(message: string | Uint8Array): Promise<string> {
    return this._account.signMessage(message)
  }

  /**
   * Get the wallet balance in satoshis
   */
  async getBalance(): Promise<bigint> {
    return this._account.getBalance()
  }

  /**
   * Send a transaction via the Spark network
   * @param params - Transaction parameters
   * @returns Transaction result with hash
   */
  async sendTransaction(params: { to: string; amount: bigint }): Promise<{ hash: string }> {
    return this._account.sendTransaction(params)
  }
}

/**
 * Create an initialized WDK Spark signer
 *
 * @param account - Spark wallet account from @buildonspark/spark-sdk
 * @returns Initialized WDKSparkSignerAdapter
 *
 * @example
 * ```typescript
 * import { T402WDK } from '@t402/wdk';
 *
 * const wallet = new T402WDK(seedPhrase, config);
 * const sparkSigner = await wallet.getSparkSigner();
 *
 * // Use with T402 client
 * const client = createT402HTTPClient({
 *   signers: [{ scheme: 'exact', network: 'spark:mainnet', signer: sparkSigner }]
 * });
 * ```
 */
export async function createWDKSparkSigner(
  account: SparkWalletAccount,
): Promise<WDKSparkSignerAdapter> {
  const adapter = new WDKSparkSignerAdapter(account)
  await adapter.initialize()
  return adapter
}
