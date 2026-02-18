/**
 * WDK TON Wallet
 *
 * Server-side TON wallet management wrapping @ton/walletkit.
 * Provides a high-level API for wallet operations including
 * balance queries, signing, and Jetton transfers.
 */

import type {
  T402TonWalletConfig,
  T402TonWalletInfo,
  TonSendTransactionParams,
  TonTransferJettonParams,
  TonStorageAdapter,
} from './types.js'
import { getDefaultEndpoint, TON_USDT0_JETTON_MASTER } from './constants.js'
import { InMemoryStorage } from './storage.js'

/**
 * T402 TON Wallet
 *
 * Wraps @ton/walletkit for server-side TON wallet management.
 * Supports wallet v5r1 and v4r2, Jetton transfers, and signing.
 */
export class T402TonWallet {
  private readonly walletKit: unknown
  private readonly config: Required<
    Pick<T402TonWalletConfig, 'walletVersion' | 'network'>
  > &
    T402TonWalletConfig
  private address: string | null = null

  private constructor(
    walletKit: unknown,
    config: T402TonWalletConfig,
    _storage: TonStorageAdapter,
  ) {
    this.walletKit = walletKit
    this.config = {
      ...config,
      walletVersion: config.walletVersion ?? 'v5r1',
      network: config.network ?? 'mainnet',
    }
  }

  /**
   * Create a wallet from a mnemonic phrase
   *
   * @param mnemonic - BIP-39 compatible mnemonic (24 words)
   * @param config - Wallet configuration
   * @returns T402TonWallet instance
   */
  static async fromMnemonic(
    mnemonic: string,
    config?: T402TonWalletConfig,
  ): Promise<T402TonWallet> {
    const words = mnemonic.trim().split(/\s+/)
    if (words.length < 12) {
      throw new Error('Invalid mnemonic: must contain at least 12 words')
    }

    const storage = config?.storage ?? new InMemoryStorage()
    const endpoint =
      config?.endpoint ?? getDefaultEndpoint(config?.network ?? 'mainnet')

    // Attempt to initialize @ton/walletkit
    let walletKit: unknown
    try {
      const tonWalletKit = await import('@ton/walletkit')
      const walletVersion = config?.walletVersion ?? 'v5r1'

      // Create wallet kit instance
      const WalletKit =
        (tonWalletKit as Record<string, unknown>).WalletKit ??
        (tonWalletKit as Record<string, unknown>).default
      if (typeof WalletKit === 'function') {
        walletKit = new (WalletKit as new (opts: unknown) => unknown)({
          mnemonic: words,
          endpoint,
          walletVersion,
          apiKey: config?.apiKey,
        })
      } else {
        // Fallback: create a minimal walletkit-compatible wrapper
        walletKit = createMinimalWallet(words, endpoint, walletVersion, config?.apiKey)
      }
    } catch {
      // @ton/walletkit not installed — create a minimal wrapper
      walletKit = createMinimalWallet(
        words,
        endpoint,
        config?.walletVersion ?? 'v5r1',
        config?.apiKey,
      )
    }

    return new T402TonWallet(walletKit, config ?? {}, storage)
  }

  /**
   * Get the wallet address in friendly format
   */
  async getAddress(): Promise<string> {
    if (this.address) {
      return this.address
    }

    const kit = this.walletKit as Record<string, unknown>

    if (typeof kit.getAddress === 'function') {
      this.address = await (kit as { getAddress: () => Promise<string> }).getAddress()
      return this.address
    }

    if (typeof kit.address === 'string') {
      this.address = kit.address as string
      return this.address
    }

    throw new Error('Unable to get address from wallet kit')
  }

  /**
   * Get the wallet's TON balance in nanoTON
   */
  async getBalance(): Promise<bigint> {
    const kit = this.walletKit as Record<string, unknown>

    if (typeof kit.getBalance === 'function') {
      return (kit as { getBalance: () => Promise<bigint> }).getBalance()
    }

    throw new Error('Wallet kit does not support getBalance')
  }

  /**
   * Get Jetton balance for a specific Jetton master contract
   *
   * @param jettonMaster - Jetton master contract address (defaults to USDT0)
   */
  async getJettonBalance(jettonMaster: string = TON_USDT0_JETTON_MASTER): Promise<bigint> {
    const kit = this.walletKit as Record<string, unknown>

    if (typeof kit.getJettonBalance === 'function') {
      return (
        kit as { getJettonBalance: (master: string) => Promise<bigint> }
      ).getJettonBalance(jettonMaster)
    }

    throw new Error('Wallet kit does not support getJettonBalance')
  }

  /**
   * Sign a raw message with the wallet's private key
   *
   * @param message - Message bytes to sign
   * @returns Signature bytes
   */
  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    const kit = this.walletKit as Record<string, unknown>

    if (typeof kit.signMessage === 'function') {
      return (
        kit as { signMessage: (msg: Uint8Array) => Promise<Uint8Array> }
      ).signMessage(message)
    }

    if (typeof kit.sign === 'function') {
      return (kit as { sign: (msg: Uint8Array) => Promise<Uint8Array> }).sign(message)
    }

    throw new Error('Wallet kit does not support message signing')
  }

  /**
   * Send a TON transaction
   *
   * @param params - Transaction parameters
   * @returns Transaction hash
   */
  async sendTransaction(params: TonSendTransactionParams): Promise<string> {
    if (!params.to) {
      throw new Error('Recipient address is required')
    }

    if (params.value < 0n) {
      throw new Error('Transaction value must be non-negative')
    }

    const kit = this.walletKit as Record<string, unknown>

    if (typeof kit.sendTransaction === 'function') {
      return (
        kit as {
          sendTransaction: (params: TonSendTransactionParams) => Promise<string>
        }
      ).sendTransaction(params)
    }

    if (typeof kit.send === 'function') {
      return (
        kit as {
          send: (params: TonSendTransactionParams) => Promise<string>
        }
      ).send(params)
    }

    throw new Error('Wallet kit does not support sendTransaction')
  }

  /**
   * Get the current sequence number of the wallet contract
   */
  async getSeqno(): Promise<number> {
    const kit = this.walletKit as Record<string, unknown>

    if (typeof kit.getSeqno === 'function') {
      return (kit as { getSeqno: () => Promise<number> }).getSeqno()
    }

    // Wallet may not be deployed yet
    return 0
  }

  /**
   * Transfer Jettons (e.g., USDT0) to a recipient
   *
   * @param params - Jetton transfer parameters
   * @returns Transaction hash
   */
  async transferJetton(params: TonTransferJettonParams): Promise<string> {
    if (!params.to) {
      throw new Error('Recipient address is required')
    }

    if (params.amount <= 0n) {
      throw new Error('Transfer amount must be greater than zero')
    }

    const kit = this.walletKit as Record<string, unknown>

    if (typeof kit.transferJetton === 'function') {
      return (
        kit as {
          transferJetton: (params: TonTransferJettonParams) => Promise<string>
        }
      ).transferJetton(params)
    }

    if (typeof kit.sendJetton === 'function') {
      return (
        kit as {
          sendJetton: (params: TonTransferJettonParams) => Promise<string>
        }
      ).sendJetton(params)
    }

    throw new Error(
      'Wallet kit does not support Jetton transfers. ' +
        'Ensure @ton/walletkit is properly installed.',
    )
  }

  /**
   * Get comprehensive wallet information
   */
  async getInfo(): Promise<T402TonWalletInfo> {
    const address = await this.getAddress()
    let balance = 0n
    let isDeployed = false

    try {
      balance = await this.getBalance()
      // If we can get a balance, the wallet is likely deployed
      // (or at least queryable on-chain)
      isDeployed = true
    } catch {
      // Wallet may not be deployed yet
    }

    // Check deployment via seqno (deployed wallets have seqno >= 0 queryable)
    try {
      const seqno = await this.getSeqno()
      isDeployed = seqno >= 0
    } catch {
      // Not deployed
    }

    return {
      address,
      balance,
      isDeployed,
      walletVersion: this.config.walletVersion,
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    const kit = this.walletKit as Record<string, unknown>

    if (typeof kit.dispose === 'function') {
      ;(kit as { dispose: () => void }).dispose()
    }

    if (typeof kit.close === 'function') {
      ;(kit as { close: () => void }).close()
    }

    this.address = null
  }
}

/**
 * Create a minimal wallet wrapper when @ton/walletkit is not available
 */
function createMinimalWallet(
  _words: string[],
  _endpoint: string,
  _walletVersion: string,
  _apiKey?: string,
): Record<string, unknown> {
  return {
    getAddress: async () => {
      throw new Error(
        '@ton/walletkit is required for wallet operations. ' +
          'Install it with: npm install @ton/walletkit @ton/core @ton/crypto',
      )
    },
    getBalance: async () => {
      throw new Error('@ton/walletkit is required for balance queries')
    },
    getJettonBalance: async () => {
      throw new Error('@ton/walletkit is required for Jetton balance queries')
    },
    signMessage: async () => {
      throw new Error('@ton/walletkit is required for message signing')
    },
    sendTransaction: async () => {
      throw new Error('@ton/walletkit is required for transactions')
    },
    getSeqno: async () => {
      throw new Error('@ton/walletkit is required for seqno queries')
    },
    transferJetton: async () => {
      throw new Error('@ton/walletkit is required for Jetton transfers')
    },
  }
}

/**
 * Create a T402TonWallet from a mnemonic
 *
 * @example
 * ```typescript
 * import { createT402TonWallet } from '@t402/wdk-ton';
 *
 * const wallet = await createT402TonWallet(
 *   'word1 word2 word3 ... word24',
 *   { walletVersion: 'v5r1' },
 * );
 *
 * const address = await wallet.getAddress();
 * const balance = await wallet.getBalance();
 * ```
 */
export async function createT402TonWallet(
  mnemonic: string,
  config?: T402TonWalletConfig,
): Promise<T402TonWallet> {
  return T402TonWallet.fromMnemonic(mnemonic, config)
}
