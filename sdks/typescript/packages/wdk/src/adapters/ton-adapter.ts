/**
 * TON Signer Adapter for WDK
 *
 * Wraps a Tether WDK TON account to implement T402's ClientTonSigner interface.
 * This allows WDK-managed TON wallets to be used for T402 payments.
 */

import type { WDKTonAccount } from '../types.js'

/**
 * TON Address type (compatible with @ton/core Address)
 * We define our own interface to avoid direct import
 */
export interface TonAddress {
  toString(): string
  toRawString(): string
}

/**
 * TON Cell type (compatible with @ton/core Cell)
 * We define our own interface to avoid direct import
 */
export interface TonCell {
  hash(): Uint8Array
  toBoc(): Uint8Array
}

/**
 * SignMessageParams type matching T402's @t402/ton interface
 */
export interface SignMessageParams {
  /** Destination address */
  to: TonAddress
  /** Amount of TON to attach (for gas) in nanoTON */
  value: bigint
  /** Message body (Jetton transfer cell) */
  body: TonCell
  /** Send mode flags (from @ton/core SendMode) */
  sendMode?: number
  /** Bounce flag */
  bounce?: boolean
  /** Message validity timeout in seconds */
  timeout?: number
}

/**
 * ClientTonSigner interface matching T402's @t402/ton
 */
export interface ClientTonSigner {
  readonly address: TonAddress
  signMessage(params: SignMessageParams): Promise<TonCell>
  getSeqno(): Promise<number>
}

/**
 * Simple TonAddress implementation for WDK
 */
class WDKTonAddress implements TonAddress {
  constructor(private _address: string) {}

  toString(): string {
    return this._address
  }

  toRawString(): string {
    return this._address
  }
}

/**
 * WDKTonSignerAdapter - Adapts a WDK TON account to T402's ClientTonSigner
 *
 * This adapter wraps a Tether WDK TON account and provides T402-compatible
 * signing functionality. The actual message building and signing is delegated
 * to the WDK account, which handles TON-specific details internally.
 *
 * @example
 * ```typescript
 * const adapter = await createWDKTonSigner(wdkTonAccount);
 * const signed = await adapter.signMessage({
 *   to: jettonWalletAddress,
 *   value: toNano('0.05'),
 *   body: jettonTransferBody,
 * });
 * ```
 */
export class WDKTonSignerAdapter implements ClientTonSigner {
  private _account: WDKTonAccount
  private _address: TonAddress | null = null
  private _initialized = false

  constructor(account: WDKTonAccount) {
    if (!account) {
      throw new Error('WDK TON account is required')
    }
    this._account = account
  }

  /**
   * Get the wallet address
   * @throws Error if not initialized
   */
  get address(): TonAddress {
    if (!this._address) {
      throw new Error(
        'TON signer not initialized. Call initialize() first or use createWDKTonSigner().',
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
    this._address = new WDKTonAddress(addressStr)
    this._initialized = true
  }

  /**
   * Sign an internal message for Jetton transfer
   *
   * Attempts to build a proper signed Cell using @ton/core if available.
   * Falls back to a simplified wrapper that embeds the raw signature.
   *
   * @param params - Message parameters
   * @returns Signed external message as Cell (BOC)
   */
  async signMessage(params: SignMessageParams): Promise<TonCell> {
    const msgHash = params.body.hash()
    const signature = await this._account.signMessage(msgHash)

    // Try to use @ton/core for proper Cell construction
    try {
      const tonCore = await import('@ton/core')
      const sigBuffer = Buffer.from(signature.buffer, signature.byteOffset, signature.byteLength)
      const bodyBoc = params.body.toBoc()
      const bocBuffer = Buffer.from(bodyBoc.buffer, bodyBoc.byteOffset, bodyBoc.byteLength)
      const signedCell = tonCore
        .beginCell()
        .storeBuffer(sigBuffer)
        .storeSlice(tonCore.Cell.fromBoc(bocBuffer)[0]!.beginParse())
        .endCell()
      return signedCell as unknown as TonCell
    } catch {
      // @ton/core not available — return simplified wrapper.
      // The signature is accessible via toBoc() and the original
      // message hash via hash(), which is sufficient for T402
      // facilitator verification.
      return {
        hash: () => msgHash,
        toBoc: () => signature,
      }
    }
  }

  /**
   * Get current seqno for the wallet
   * Used for replay protection
   */
  async getSeqno(): Promise<number> {
    return this._account.getSeqno()
  }

  /**
   * Get TON balance in nanoTON
   */
  async getBalance(): Promise<bigint> {
    return this._account.getBalance()
  }

  /**
   * Get Jetton balance
   * @param jettonMaster - Jetton master contract address
   */
  async getJettonBalance(jettonMaster: string): Promise<bigint> {
    return this._account.getJettonBalance(jettonMaster)
  }

  /**
   * Get the underlying WDK account
   * Useful for advanced operations not covered by this adapter
   */
  getWDKAccount(): WDKTonAccount {
    return this._account
  }
}

/**
 * Create an initialized WDK TON signer
 *
 * @param account - WDK TON account from @tetherto/wdk-wallet-ton
 * @returns Initialized ClientTonSigner
 *
 * @example
 * ```typescript
 * import { T402WDK } from '@t402/wdk';
 *
 * const wallet = new T402WDK(seedPhrase, config);
 * const tonSigner = await wallet.getTonSigner();
 *
 * // Use with T402 client
 * const client = createT402HTTPClient({
 *   signers: [{ scheme: 'exact', network: 'ton:mainnet', signer: tonSigner }]
 * });
 * ```
 */
export async function createWDKTonSigner(account: WDKTonAccount): Promise<WDKTonSignerAdapter> {
  const adapter = new WDKTonSignerAdapter(account)
  await adapter.initialize()
  return adapter
}
