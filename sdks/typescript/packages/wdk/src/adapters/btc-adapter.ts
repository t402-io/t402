/**
 * Bitcoin (BTC) On-Chain Signer Adapter for WDK
 *
 * Wraps a Tether WDK Bitcoin account to implement T402's payment signing interface.
 * This allows WDK-managed Bitcoin wallets to be used for T402 payments.
 */

/**
 * WDKBtcAccount interface (matches @tetherto/wdk-wallet-btc)
 */
export interface WDKBtcAccount {
  getAddress(): Promise<string>
  getBalance(): Promise<bigint>
  sendTransaction(params: { to: string; amount: bigint; fee?: bigint }): Promise<string>
  signMessage(message: string): Promise<string>
  signPsbt(psbt: Uint8Array): Promise<Uint8Array>
}

/**
 * WDKBtcSignerAdapter - Adapts a WDK Bitcoin account for T402 payments
 *
 * @example
 * ```typescript
 * const adapter = await createWDKBtcSigner(wdkBtcAccount);
 *
 * // Use with T402 client
 * const client = createT402HTTPClient({
 *   signers: [{ scheme: 'exact', network: 'bip122:000000000019d6689c085ae165831e93', signer: adapter }]
 * });
 * ```
 */
export class WDKBtcSignerAdapter {
  private _account: WDKBtcAccount
  private _address: string | null = null
  private _initialized = false

  constructor(account: WDKBtcAccount) {
    if (!account) {
      throw new Error('WDK Bitcoin account is required')
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
        'Bitcoin signer not initialized. Call initialize() first or use createWDKBtcSigner().',
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
   * Sign a message using the Bitcoin wallet
   * @param message - Message string to sign
   * @returns Signature string
   */
  async signMessage(message: string): Promise<string> {
    return this._account.signMessage(message)
  }

  /**
   * Sign a Partially Signed Bitcoin Transaction (PSBT)
   * @param psbt - PSBT bytes to sign
   * @returns Signed PSBT bytes
   */
  async signPsbt(psbt: Uint8Array): Promise<Uint8Array> {
    return this._account.signPsbt(psbt)
  }

  /**
   * Get the wallet balance in satoshis
   */
  async getBalance(): Promise<bigint> {
    return this._account.getBalance()
  }

  /**
   * Send a Bitcoin transaction
   * @param params - Transaction parameters
   * @returns Transaction hash
   */
  async sendTransaction(params: { to: string; amount: bigint; fee?: bigint }): Promise<string> {
    return this._account.sendTransaction(params)
  }
}

/**
 * Create an initialized WDK Bitcoin signer
 *
 * @param account - WDK Bitcoin account from @tetherto/wdk-wallet-btc
 * @returns Initialized WDKBtcSignerAdapter
 *
 * @example
 * ```typescript
 * import { T402WDK } from '@t402/wdk';
 *
 * const wallet = new T402WDK(seedPhrase, config);
 * const btcSigner = await wallet.getBtcSigner();
 *
 * // Use with T402 client
 * const client = createT402HTTPClient({
 *   signers: [{ scheme: 'exact', network: 'bip122:000000000019d6689c085ae165831e93', signer: btcSigner }]
 * });
 * ```
 */
export async function createWDKBtcSigner(account: WDKBtcAccount): Promise<WDKBtcSignerAdapter> {
  const adapter = new WDKBtcSignerAdapter(account)
  await adapter.initialize()
  return adapter
}
