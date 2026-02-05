/**
 * Solana (SVM) Signer Adapter for WDK
 *
 * Wraps a Tether WDK Solana account to implement T402's ClientSvmSigner interface.
 * ClientSvmSigner is just TransactionSigner from @solana/kit.
 */

import type { WDKSolanaAccount } from '../types.js'

/**
 * Address type from @solana/kit (base58 string)
 * We use a branded type for compatibility
 */
export type SolanaAddress = string & { readonly __brand?: unique symbol }

/**
 * TransactionSigner interface matching @solana/kit
 * This is what T402's ClientSvmSigner expects
 */
export interface TransactionSigner {
  readonly address: SolanaAddress
  signTransactions<T extends { messageBytes: Uint8Array; signatures: Record<string, unknown> }>(
    transactions: readonly T[],
  ): Promise<readonly Record<string, Uint8Array>[]>
}

/**
 * WDKSvmSignerAdapter - Adapts a WDK Solana account to T402's ClientSvmSigner
 *
 * ClientSvmSigner is TransactionSigner from @solana/kit which requires:
 * - address: The public key as Address type
 * - signTransactions: Sign multiple transactions, returning signature dictionaries
 *
 * @example
 * ```typescript
 * const adapter = await createWDKSvmSigner(wdkSolanaAccount);
 *
 * // Use with T402 client
 * const client = createT402HTTPClient({
 *   signers: [{ scheme: 'exact', network: 'solana:mainnet', signer: adapter }]
 * });
 * ```
 */
export class WDKSvmSignerAdapter implements TransactionSigner {
  private _account: WDKSolanaAccount
  private _address: SolanaAddress | null = null
  private _initialized = false

  constructor(account: WDKSolanaAccount) {
    if (!account) {
      throw new Error('WDK Solana account is required')
    }
    this._account = account
  }

  /**
   * Get the wallet address (base58)
   * @throws Error if not initialized
   */
  get address(): SolanaAddress {
    if (!this._address) {
      throw new Error(
        'Solana signer not initialized. Call initialize() first or use createWDKSvmSigner().',
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

    const addressStr = await this._account.getAddress()
    this._address = addressStr as SolanaAddress
    this._initialized = true
  }

  /**
   * Sign transactions with this signer
   *
   * This method signs the message bytes of each transaction and returns
   * signature dictionaries mapping address to signature.
   *
   * @param transactions - Array of transactions to sign
   * @returns Array of signature dictionaries
   */
  async signTransactions<
    T extends { messageBytes: Uint8Array; signatures: Record<string, unknown> },
  >(transactions: readonly T[]): Promise<readonly Record<string, Uint8Array>[]> {
    if (!transactions || transactions.length === 0) {
      return []
    }

    const results: Record<string, Uint8Array>[] = []

    for (const tx of transactions) {
      if (!tx.messageBytes || tx.messageBytes.length === 0) {
        throw new Error('Transaction messageBytes must not be empty')
      }

      // Sign the message bytes using WDK account
      const signature = await this._account.sign(tx.messageBytes)

      // Return as a dictionary mapping our address to the signature
      results.push({
        [this._address as string]: signature,
      })
    }

    return results
  }

  /**
   * Sign a single message (utility method)
   * @param message - Message bytes to sign
   * @returns Signature bytes
   */
  async sign(message: Uint8Array): Promise<Uint8Array> {
    return this._account.sign(message)
  }

  /**
   * Get SOL balance in lamports
   */
  async getBalance(): Promise<bigint> {
    return this._account.getBalance()
  }

  /**
   * Get SPL token balance
   * @param mint - Token mint address
   */
  async getTokenBalance(mint: string): Promise<bigint> {
    return this._account.getTokenBalance(mint)
  }

  /**
   * Transfer SPL tokens
   * @param params - Transfer parameters
   * @returns Transaction signature
   */
  async transfer(params: {
    token: string
    recipient: string
    amount: bigint
  }): Promise<string> {
    return this._account.transfer(params)
  }
}

/**
 * Create an initialized WDK Solana signer
 *
 * @param account - WDK Solana account from @tetherto/wdk-wallet-solana
 * @returns Initialized TransactionSigner (ClientSvmSigner)
 *
 * @example
 * ```typescript
 * import { T402WDK } from '@t402/wdk';
 *
 * const wallet = new T402WDK(seedPhrase, config);
 * const svmSigner = await wallet.getSvmSigner();
 *
 * // Use with T402 client
 * const client = createT402HTTPClient({
 *   signers: [{ scheme: 'exact', network: 'solana:mainnet', signer: svmSigner }]
 * });
 * ```
 */
export async function createWDKSvmSigner(
  account: WDKSolanaAccount,
): Promise<WDKSvmSignerAdapter> {
  const adapter = new WDKSvmSignerAdapter(account)
  await adapter.initialize()
  return adapter
}
