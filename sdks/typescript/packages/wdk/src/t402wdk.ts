/**
 * T402WDK - Main class for T402 integration with Tether WDK
 *
 * Provides a high-level API for:
 * - Multi-chain wallet management
 * - T402-compatible signers
 * - Balance aggregation
 * - Cross-chain bridging (USDT0)
 */

import type { Address } from 'viem'
import type {
  T402WDKConfig,
  NormalizedChainConfig,
  WDKInstance,
  WDKConstructor,
  ChainBalance,
  AggregatedBalance,
  TokenBalance,
  BridgeParams,
  BridgeResult,
  T402WDKOptions,
  ChainFamily,
  WDKWalletModules,
  WDKProtocolModules,
  WDKModulesConfig,
  WDKTonAccount,
  WDKSolanaAccount,
  WDKTronAccount,
  T402WDKCreateConfig,
  SignerEntry,
  GetAllSignersOptions,
  FromWDKOptions,
  SwapQuote,
  SwapResult,
  SwapParams,
} from './types.js'
import {
  WDKTonSignerAdapter,
  createWDKTonSigner,
  type ClientTonSigner,
} from './adapters/ton-adapter.js'
import {
  WDKSvmSignerAdapter,
  createWDKSvmSigner,
  type TransactionSigner as ClientSvmSigner,
} from './adapters/svm-adapter.js'
import {
  WDKTronSignerAdapter,
  createWDKTronSigner,
  type ClientTronSigner,
} from './adapters/tron-adapter.js'
import { BalanceCache, type BalanceCacheConfig, type BalanceCacheStats } from './cache.js'
import {
  normalizeChainConfig,
  CHAIN_TOKENS,
  USDT0_ADDRESSES,
  USDC_ADDRESSES,
  DEFAULT_RPC_ENDPOINTS,
} from './chains.js'
import { WDKSigner, createWDKSigner } from './signer.js'
import { supportsBridging, getBridgeableChains } from '@t402/evm'
import {
  WDKError,
  WDKInitializationError,
  ChainError,
  BridgeError,
  BalanceError,
  WDKErrorCode,
  wrapError,
  isWDKError,
} from './errors.js'

/**
 * T402WDK - Tether WDK integration for T402 payments
 *
 * @example
 * ```typescript
 * import { T402WDK } from '@t402/wdk';
 *
 * // Initialize with seed phrase
 * const seedPhrase = T402WDK.generateSeedPhrase();
 * const wdk = new T402WDK(seedPhrase, {
 *   arbitrum: 'https://arb1.arbitrum.io/rpc',
 *   base: 'https://mainnet.base.org'
 * });
 *
 * // Get signer for T402 payments
 * const signer = await wdk.getSigner('arbitrum');
 *
 * // Use with T402 client
 * const client = createT402HTTPClient({
 *   signers: [{ scheme: 'exact', signer }]
 * });
 * ```
 */
export class T402WDK {
  private _wdk: WDKInstance | null = null
  private _normalizedChains: Map<string, NormalizedChainConfig> = new Map()
  private _seedPhrase: string
  private _signerCache: Map<string, WDKSigner> = new Map()
  private _balanceCache: BalanceCache
  private _initializationError: Error | null = null

  // WDK module references (set via registerWDK)
  private static _WDK: WDKConstructor | null = null
  private static _WalletManagerEvm: unknown = null
  private static _BridgeUsdt0Evm: unknown = null

  // Multi-chain wallet module storage
  private static _WalletModules: WDKWalletModules = {}
  private static _ProtocolModules: WDKProtocolModules = {}

  // Multi-chain signer caches
  private _tonSignerCache: Map<number, WDKTonSignerAdapter> = new Map()
  private _svmSignerCache: Map<number, WDKSvmSignerAdapter> = new Map()
  private _tronSignerCache: Map<number, WDKTronSignerAdapter> = new Map()

  /**
   * Register the Tether WDK modules
   *
   * This must be called before creating T402WDK instances if you want
   * to use the actual WDK. Otherwise, a mock implementation is used.
   *
   * Supports two registration patterns:
   *
   * 1. Legacy (EVM-only):
   *    ```typescript
   *    T402WDK.registerWDK(WDK, WalletManagerEvm, BridgeUsdt0Evm);
   *    ```
   *
   * 2. Unified (multi-chain):
   *    ```typescript
   *    T402WDK.registerWDK(WDK, {
   *      wallets: {
   *        evm: WalletManagerEvm,
   *        ton: WalletManagerTon,
   *        solana: WalletManagerSolana,
   *        tron: WalletManagerTron,
   *      },
   *      protocols: {
   *        bridgeUsdt0Evm: BridgeUsdt0Evm,
   *        bridgeUsdt0Ton: BridgeUsdt0Ton,
   *      }
   *    });
   *    ```
   *
   * @throws {WDKInitializationError} If registration fails
   */
  static registerWDK(
    WDK: WDKConstructor,
    modulesOrWalletManager?: WDKModulesConfig | unknown,
    BridgeUsdt0Evm?: unknown,
  ): void {
    if (!WDK) {
      throw new WDKInitializationError('WDK constructor is required')
    }

    if (typeof WDK !== 'function') {
      throw new WDKInitializationError('WDK must be a constructor function')
    }

    T402WDK._WDK = WDK

    // Check if using new unified registration pattern
    if (
      modulesOrWalletManager &&
      typeof modulesOrWalletManager === 'object' &&
      ('wallets' in modulesOrWalletManager || 'protocols' in modulesOrWalletManager)
    ) {
      const modules = modulesOrWalletManager as WDKModulesConfig
      T402WDK._WalletModules = modules.wallets ?? {}
      T402WDK._ProtocolModules = modules.protocols ?? {}
      // Backward compatibility: set legacy fields
      T402WDK._WalletManagerEvm = modules.wallets?.evm ?? null
      T402WDK._BridgeUsdt0Evm = modules.protocols?.bridgeUsdt0Evm ?? null
    } else {
      // Legacy registration pattern
      T402WDK._WalletManagerEvm = modulesOrWalletManager ?? null
      T402WDK._BridgeUsdt0Evm = BridgeUsdt0Evm ?? null
      T402WDK._WalletModules = { evm: modulesOrWalletManager as unknown }
      T402WDK._ProtocolModules = { bridgeUsdt0Evm: BridgeUsdt0Evm as unknown }
    }
  }

  /**
   * Check if WDK is registered
   */
  static isWDKRegistered(): boolean {
    return T402WDK._WDK !== null
  }

  /**
   * Check if wallet manager is registered
   */
  static isWalletManagerRegistered(): boolean {
    return T402WDK._WalletManagerEvm !== null
  }

  /**
   * Check if bridge protocol is registered
   */
  static isBridgeRegistered(): boolean {
    return T402WDK._BridgeUsdt0Evm !== null
  }

  /**
   * Check if TON wallet manager is registered
   */
  static isTonRegistered(): boolean {
    return T402WDK._WalletModules.ton !== undefined
  }

  /**
   * Check if Solana wallet manager is registered
   */
  static isSolanaRegistered(): boolean {
    return T402WDK._WalletModules.solana !== undefined
  }

  /**
   * Check if TRON wallet manager is registered
   */
  static isTronRegistered(): boolean {
    return T402WDK._WalletModules.tron !== undefined
  }

  /**
   * Get all registered wallet modules
   */
  static getRegisteredWalletModules(): (keyof WDKWalletModules)[] {
    return Object.keys(T402WDK._WalletModules).filter(
      (key) => T402WDK._WalletModules[key as keyof WDKWalletModules] !== undefined,
    ) as (keyof WDKWalletModules)[]
  }

  /**
   * Get all registered protocol modules
   */
  static getRegisteredProtocolModules(): (keyof WDKProtocolModules)[] {
    return Object.keys(T402WDK._ProtocolModules).filter(
      (key) => T402WDK._ProtocolModules[key as keyof WDKProtocolModules] !== undefined,
    ) as (keyof WDKProtocolModules)[]
  }

  /**
   * Generate a new random seed phrase
   *
   * @throws {WDKInitializationError} If WDK is not registered
   * @returns A new BIP-39 mnemonic seed phrase
   */
  static generateSeedPhrase(): string {
    if (!T402WDK._WDK) {
      throw new WDKInitializationError(
        'WDK not registered. Call T402WDK.registerWDK() first, or use a mock seed phrase for testing.',
      )
    }

    try {
      return T402WDK._WDK.getRandomSeedPhrase()
    } catch (error) {
      throw new WDKInitializationError(
        `Failed to generate seed phrase: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error instanceof Error ? error : undefined },
      )
    }
  }

  /**
   * Quick setup: seed phrase + chains + modules → ready-to-use T402WDK.
   *
   * Registers all provided wallet/protocol modules and creates a fully
   * configured instance in a single call.
   *
   * @example
   * ```typescript
   * import WDK from '@tetherto/wdk';
   * import WalletManagerEvm from '@tetherto/wdk-wallet-evm';
   * import BridgeUsdt0Evm from '@tetherto/wdk-protocol-bridge-usdt0-evm';
   *
   * const wallet = T402WDK.create({
   *   seedPhrase: 'your twelve word seed phrase ...',
   *   chains: {
   *     arbitrum: 'https://arb1.arbitrum.io/rpc',
   *     base: 'https://mainnet.base.org',
   *   },
   *   modules: {
   *     wallets: { evm: WalletManagerEvm },
   *     protocols: { bridgeUsdt0Evm: BridgeUsdt0Evm },
   *   },
   * });
   * ```
   */
  static create(WDK: WDKConstructor, config: T402WDKCreateConfig): T402WDK {
    // Register modules
    T402WDK.registerWDK(WDK, config.modules)

    // Create and return configured instance
    return new T402WDK(config.seedPhrase, config.chains, config.options)
  }

  /**
   * Create a T402WDK from a pre-configured @tetherto/wdk instance.
   *
   * Wraps an existing WDK instance (already has wallets/protocols registered)
   * into a T402WDK without re-registering modules.
   *
   * @param wdkInstance - A pre-configured WDK instance
   * @param config - EVM chain configuration (RPC endpoints)
   * @param options - Additional options
   */
  static fromWDK(
    wdkInstance: WDKInstance,
    config: T402WDKConfig = {},
    options?: FromWDKOptions & T402WDKOptions,
  ): T402WDK {
    if (!wdkInstance) {
      throw new WDKInitializationError('WDK instance is required')
    }

    // Create a T402WDK that uses the provided instance directly
    // We use a dummy seed phrase since the WDK is already initialized
    const instance = new T402WDK('__from_wdk__', config, options)

    // Override the internal WDK with the provided instance
    instance._wdk = wdkInstance
    instance._initializationError = null

    return instance
  }

  /**
   * Get all signers as an array ready for T402 HTTP clients.
   *
   * Returns signer entries for all configured EVM chains, plus any
   * registered non-EVM chains (TON, Solana, TRON).
   *
   * @example
   * ```typescript
   * const signers = await wallet.getAllSigners();
   * const client = createT402HTTPClient({ signers });
   * ```
   */
  async getAllSigners(options?: GetAllSignersOptions): Promise<SignerEntry[]> {
    const accountIndex = options?.accountIndex ?? 0
    const schemes = options?.schemes ?? ['exact']
    const includeNonEvm = options?.includeNonEvm ?? true
    const entries: SignerEntry[] = []

    // Collect EVM signers for all configured chains
    for (const chain of this.getConfiguredChains()) {
      const config = this._normalizedChains.get(chain)
      if (!config) continue

      try {
        const signer = await this.getSigner(chain, accountIndex)
        for (const scheme of schemes) {
          entries.push({
            scheme,
            network: config.network,
            signer,
            family: 'evm',
          })
        }
      } catch {
        // Skip chains that fail to create signers
      }
    }

    if (!includeNonEvm) {
      return entries
    }

    // TON signer
    if (T402WDK.isTonRegistered()) {
      try {
        const signer = await this.getTonSigner(accountIndex)
        for (const scheme of schemes) {
          entries.push({ scheme, network: 'ton:mainnet', signer, family: 'ton' })
        }
      } catch {
        // Skip if TON signer fails
      }
    }

    // Solana signer
    if (T402WDK.isSolanaRegistered()) {
      try {
        const signer = await this.getSvmSigner(accountIndex)
        for (const scheme of schemes) {
          entries.push({
            scheme,
            network: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
            signer,
            family: 'svm',
          })
        }
      } catch {
        // Skip if Solana signer fails
      }
    }

    // TRON signer
    if (T402WDK.isTronRegistered()) {
      try {
        const signer = await this.getTronSigner(accountIndex)
        for (const scheme of schemes) {
          entries.push({ scheme, network: 'tron:mainnet', signer, family: 'tron' })
        }
      } catch {
        // Skip if TRON signer fails
      }
    }

    return entries
  }

  /**
   * Create a new T402WDK instance
   *
   * @param seedPhrase - BIP-39 mnemonic seed phrase
   * @param config - Chain configuration (RPC endpoints)
   * @param options - Additional options (cache configuration, etc.)
   * @throws {WDKInitializationError} If seed phrase is invalid
   */
  constructor(seedPhrase: string, config: T402WDKConfig = {}, options: T402WDKOptions = {}) {
    // Validate seed phrase (skip for fromWDK internal usage)
    const isFromWDK = seedPhrase === '__from_wdk__'

    if (!isFromWDK) {
      if (!seedPhrase || typeof seedPhrase !== 'string') {
        throw new WDKInitializationError('Seed phrase is required and must be a string')
      }

      // Basic seed phrase validation (BIP-39 has 12, 15, 18, 21, or 24 words)
      const words = seedPhrase.trim().split(/\s+/)
      const validWordCounts = [12, 15, 18, 21, 24]
      if (!validWordCounts.includes(words.length)) {
        throw new WDKInitializationError(
          `Invalid seed phrase: expected 12, 15, 18, 21, or 24 words, got ${words.length}`,
          { context: { wordCount: words.length } },
        )
      }
    }

    this._seedPhrase = seedPhrase

    // Initialize balance cache
    this._balanceCache = new BalanceCache(options.cache)

    // Normalize chain configurations
    for (const [chain, chainConfig] of Object.entries(config)) {
      if (chainConfig) {
        try {
          this._normalizedChains.set(chain, normalizeChainConfig(chain, chainConfig))
        } catch (error) {
          throw new ChainError(
            WDKErrorCode.INVALID_CHAIN_CONFIG,
            `Invalid configuration for chain "${chain}": ${error instanceof Error ? error.message : String(error)}`,
            { chain, cause: error instanceof Error ? error : undefined },
          )
        }
      }
    }

    // Add default chains if not configured
    this._addDefaultChainsIfNeeded()

    // Initialize WDK if registered (skip for fromWDK — it sets _wdk directly)
    if (!isFromWDK && T402WDK._WDK) {
      this._initializeWDK()
    }
  }

  /**
   * Add default chain configurations for common chains
   */
  private _addDefaultChainsIfNeeded(): void {
    // Add Arbitrum as default if no chains configured (USDT0 hub)
    if (this._normalizedChains.size === 0) {
      const defaultEndpoint = DEFAULT_RPC_ENDPOINTS.arbitrum
      if (defaultEndpoint) {
        this._normalizedChains.set('arbitrum', normalizeChainConfig('arbitrum', defaultEndpoint))
      }
    }
  }

  /**
   * Initialize the underlying WDK instance
   */
  private _initializeWDK(): void {
    if (!T402WDK._WDK) {
      this._initializationError = new WDKInitializationError('WDK not registered')
      return
    }

    if (!T402WDK._WalletManagerEvm) {
      this._initializationError = new WDKInitializationError(
        'WalletManagerEvm not registered. Call T402WDK.registerWDK(WDK, WalletManagerEvm) to enable wallet functionality.',
      )
      return
    }

    try {
      let wdk = new T402WDK._WDK(this._seedPhrase)

      // Register EVM wallets for each configured chain
      for (const [chain, config] of this._normalizedChains) {
        try {
          wdk = wdk.registerWallet(chain, T402WDK._WalletManagerEvm, {
            provider: config.provider,
            chainId: config.chainId,
          })
        } catch (error) {
          throw new ChainError(
            WDKErrorCode.CHAIN_NOT_SUPPORTED,
            `Failed to register wallet for chain "${chain}": ${error instanceof Error ? error.message : String(error)}`,
            { chain, cause: error instanceof Error ? error : undefined },
          )
        }
      }

      // Register USDT0 bridge protocol if available
      if (T402WDK._BridgeUsdt0Evm) {
        try {
          wdk = wdk.registerProtocol('bridge-usdt0', T402WDK._BridgeUsdt0Evm)
        } catch (error) {
          // Bridge registration failure is non-fatal, just log it
          console.warn(
            `Failed to register USDT0 bridge protocol: ${error instanceof Error ? error.message : String(error)}`,
          )
        }
      }

      this._wdk = wdk
      this._initializationError = null
    } catch (error) {
      this._initializationError = error instanceof Error ? error : new Error(String(error))
      this._wdk = null
    }
  }

  /**
   * Get the underlying WDK instance
   *
   * @throws {WDKInitializationError} If WDK is not initialized
   */
  get wdk(): WDKInstance {
    if (this._initializationError) {
      throw this._initializationError instanceof WDKError
        ? this._initializationError
        : new WDKInitializationError(
            `WDK initialization failed: ${this._initializationError.message}`,
            { cause: this._initializationError },
          )
    }

    if (!this._wdk) {
      throw new WDKInitializationError(
        'WDK not initialized. Call T402WDK.registerWDK() before creating instances.',
      )
    }
    return this._wdk
  }

  /**
   * Check if WDK is properly initialized
   */
  get isInitialized(): boolean {
    return this._wdk !== null && this._initializationError === null
  }

  /**
   * Get initialization error if any
   */
  get initializationError(): Error | null {
    return this._initializationError
  }

  /**
   * Get all configured chains
   */
  getConfiguredChains(): string[] {
    return Array.from(this._normalizedChains.keys())
  }

  /**
   * Get chain configuration
   */
  getChainConfig(chain: string): NormalizedChainConfig | undefined {
    return this._normalizedChains.get(chain)
  }

  /**
   * Check if a chain is configured
   */
  isChainConfigured(chain: string): boolean {
    return this._normalizedChains.has(chain)
  }

  /**
   * Get a T402-compatible signer for a chain
   *
   * @param chain - Chain name (e.g., "arbitrum", "ethereum")
   * @param accountIndex - HD wallet account index (default: 0)
   * @throws {ChainError} If chain is not configured
   * @throws {SignerError} If signer creation fails
   * @returns An initialized WDKSigner
   */
  async getSigner(chain: string, accountIndex = 0): Promise<WDKSigner> {
    // Validate chain parameter
    if (!chain || typeof chain !== 'string') {
      throw new ChainError(
        WDKErrorCode.CHAIN_NOT_CONFIGURED,
        'Chain name is required and must be a string',
        { chain },
      )
    }

    const cacheKey = `${chain}:${accountIndex}`

    // Return cached signer if available
    const cached = this._signerCache.get(cacheKey)
    if (cached) {
      return cached
    }

    // Validate chain is configured
    if (!this._normalizedChains.has(chain)) {
      const availableChains = this.getConfiguredChains()
      throw new ChainError(
        WDKErrorCode.CHAIN_NOT_CONFIGURED,
        `Chain "${chain}" not configured. Available chains: ${availableChains.length > 0 ? availableChains.join(', ') : '(none)'}`,
        { chain, context: { availableChains } },
      )
    }

    try {
      const signer = await createWDKSigner(this.wdk, chain, accountIndex)
      this._signerCache.set(cacheKey, signer)
      return signer
    } catch (error) {
      // Re-throw WDK errors as-is
      if (isWDKError(error)) {
        throw error
      }

      throw wrapError(
        error,
        WDKErrorCode.SIGNER_NOT_INITIALIZED,
        `Failed to create signer for chain "${chain}"`,
        { chain, accountIndex },
      )
    }
  }

  /**
   * Clear the signer cache
   * Useful for forcing re-initialization of signers
   */
  clearSignerCache(): void {
    this._signerCache.clear()
    this._tonSignerCache.clear()
    this._svmSignerCache.clear()
    this._tronSignerCache.clear()
  }

  // ========== Multi-Chain Signers ==========

  /**
   * Get a TON signer for T402 payments
   *
   * @param accountIndex - HD wallet account index (default: 0)
   * @throws {ChainError} If TON wallet manager is not registered
   * @returns An initialized ClientTonSigner
   *
   * @example
   * ```typescript
   * const tonSigner = await wallet.getTonSigner();
   *
   * const client = createT402HTTPClient({
   *   signers: [{ scheme: 'exact', network: 'ton:mainnet', signer: tonSigner }]
   * });
   * ```
   */
  async getTonSigner(accountIndex = 0): Promise<ClientTonSigner> {
    // Check cache first
    const cached = this._tonSignerCache.get(accountIndex)
    if (cached) {
      return cached
    }

    // Validate TON wallet manager is registered
    if (!T402WDK._WalletModules.ton) {
      throw new ChainError(
        WDKErrorCode.CHAIN_NOT_SUPPORTED,
        'TON wallet manager not registered. Call T402WDK.registerWDK(WDK, { wallets: { ton: WalletManagerTon } }).',
        { chain: 'ton' },
      )
    }

    try {
      // Get TON account from WDK
      const account = (await this.wdk.getAccount('ton', accountIndex)) as unknown as WDKTonAccount

      // Create and cache the signer adapter
      const signer = await createWDKTonSigner(account)
      this._tonSignerCache.set(accountIndex, signer)
      return signer
    } catch (error) {
      if (isWDKError(error)) {
        throw error
      }

      throw wrapError(error, WDKErrorCode.SIGNER_NOT_INITIALIZED, 'Failed to create TON signer', {
        chain: 'ton',
        accountIndex,
      })
    }
  }

  /**
   * Get a Solana (SVM) signer for T402 payments
   *
   * @param accountIndex - HD wallet account index (default: 0)
   * @throws {ChainError} If Solana wallet manager is not registered
   * @returns An initialized TransactionSigner (ClientSvmSigner)
   *
   * @example
   * ```typescript
   * const svmSigner = await wallet.getSvmSigner();
   *
   * const client = createT402HTTPClient({
   *   signers: [{ scheme: 'exact', network: 'solana:mainnet', signer: svmSigner }]
   * });
   * ```
   */
  async getSvmSigner(accountIndex = 0): Promise<ClientSvmSigner> {
    // Check cache first
    const cached = this._svmSignerCache.get(accountIndex)
    if (cached) {
      return cached
    }

    // Validate Solana wallet manager is registered
    if (!T402WDK._WalletModules.solana) {
      throw new ChainError(
        WDKErrorCode.CHAIN_NOT_SUPPORTED,
        'Solana wallet manager not registered. Call T402WDK.registerWDK(WDK, { wallets: { solana: WalletManagerSolana } }).',
        { chain: 'solana' },
      )
    }

    try {
      // Get Solana account from WDK
      const account = (await this.wdk.getAccount(
        'solana',
        accountIndex,
      )) as unknown as WDKSolanaAccount

      // Create and cache the signer adapter
      const signer = await createWDKSvmSigner(account)
      this._svmSignerCache.set(accountIndex, signer)
      return signer
    } catch (error) {
      if (isWDKError(error)) {
        throw error
      }

      throw wrapError(
        error,
        WDKErrorCode.SIGNER_NOT_INITIALIZED,
        'Failed to create Solana signer',
        { chain: 'solana', accountIndex },
      )
    }
  }

  /**
   * Get a TRON signer for T402 payments
   *
   * @param accountIndex - HD wallet account index (default: 0)
   * @param rpcUrl - Optional custom RPC URL (default: https://api.trongrid.io)
   * @throws {ChainError} If TRON wallet manager is not registered
   * @returns An initialized ClientTronSigner
   *
   * @example
   * ```typescript
   * const tronSigner = await wallet.getTronSigner();
   *
   * const client = createT402HTTPClient({
   *   signers: [{ scheme: 'exact', network: 'tron:mainnet', signer: tronSigner }]
   * });
   * ```
   */
  async getTronSigner(accountIndex = 0, rpcUrl?: string): Promise<ClientTronSigner> {
    // Check cache first (only if no custom RPC)
    if (!rpcUrl) {
      const cached = this._tronSignerCache.get(accountIndex)
      if (cached) {
        return cached
      }
    }

    // Validate TRON wallet manager is registered
    if (!T402WDK._WalletModules.tron) {
      throw new ChainError(
        WDKErrorCode.CHAIN_NOT_SUPPORTED,
        'TRON wallet manager not registered. Call T402WDK.registerWDK(WDK, { wallets: { tron: WalletManagerTron } }).',
        { chain: 'tron' },
      )
    }

    try {
      // Get TRON account from WDK
      const account = (await this.wdk.getAccount('tron', accountIndex)) as unknown as WDKTronAccount

      // Create the signer adapter
      const signer = await createWDKTronSigner(account, rpcUrl)

      // Cache only if using default RPC
      if (!rpcUrl) {
        this._tronSignerCache.set(accountIndex, signer)
      }

      return signer
    } catch (error) {
      if (isWDKError(error)) {
        throw error
      }

      throw wrapError(error, WDKErrorCode.SIGNER_NOT_INITIALIZED, 'Failed to create TRON signer', {
        chain: 'tron',
        accountIndex,
      })
    }
  }

  /**
   * Get a signer for a specific chain family
   *
   * @param family - Chain family (evm, svm, ton, tron)
   * @param chainOrIndex - Chain name for EVM, or account index for others
   * @param accountIndex - Account index (only used for EVM)
   * @throws {ChainError} If chain family is not supported or not configured
   * @returns An appropriate signer for the chain family
   *
   * @example
   * ```typescript
   * // Get EVM signer for Arbitrum
   * const evmSigner = await wallet.getSignerByFamily('evm', 'arbitrum');
   *
   * // Get TON signer
   * const tonSigner = await wallet.getSignerByFamily('ton');
   *
   * // Get Solana signer with account index 1
   * const svmSigner = await wallet.getSignerByFamily('svm', 1);
   * ```
   */
  async getSignerByFamily(
    family: ChainFamily,
    chainOrIndex?: string | number,
    accountIndex = 0,
  ): Promise<WDKSigner | ClientTonSigner | ClientSvmSigner | ClientTronSigner> {
    switch (family) {
      case 'evm':
        if (typeof chainOrIndex !== 'string') {
          throw new ChainError(
            WDKErrorCode.INVALID_CHAIN_CONFIG,
            'EVM signers require a chain name (e.g., "arbitrum", "ethereum")',
            { chain: family },
          )
        }
        return this.getSigner(chainOrIndex, accountIndex)

      case 'ton':
        return this.getTonSigner(typeof chainOrIndex === 'number' ? chainOrIndex : accountIndex)

      case 'svm':
        return this.getSvmSigner(typeof chainOrIndex === 'number' ? chainOrIndex : accountIndex)

      case 'tron':
        return this.getTronSigner(typeof chainOrIndex === 'number' ? chainOrIndex : accountIndex)

      default:
        throw new ChainError(
          WDKErrorCode.CHAIN_NOT_SUPPORTED,
          `Chain family "${family}" is not supported. Available: evm, ton, svm, tron`,
          { chain: family },
        )
    }
  }

  /**
   * Get wallet address for a chain
   *
   * @param chain - Chain name
   * @param accountIndex - HD wallet account index (default: 0)
   * @throws {ChainError} If chain is not configured
   * @throws {SignerError} If address fetch fails
   */
  async getAddress(chain: string, accountIndex = 0): Promise<Address> {
    const signer = await this.getSigner(chain, accountIndex)
    return signer.address
  }

  /**
   * Get USDT0 balance for a chain
   *
   * Uses cache if enabled to reduce RPC calls.
   *
   * @throws {BalanceError} If balance fetch fails
   */
  async getUsdt0Balance(chain: string, accountIndex = 0): Promise<bigint> {
    const usdt0Address = USDT0_ADDRESSES[chain]
    if (!usdt0Address) {
      return 0n
    }

    try {
      const signer = await this.getSigner(chain, accountIndex)
      const address = signer.address

      return await this._balanceCache.getOrFetchTokenBalance(
        chain,
        usdt0Address,
        address,
        async () => signer.getTokenBalance(usdt0Address),
      )
    } catch (error) {
      // Return 0 for balance errors (chain might not support USDT0)
      if (isWDKError(error) && error.code === WDKErrorCode.TOKEN_BALANCE_FETCH_FAILED) {
        return 0n
      }
      throw error
    }
  }

  /**
   * Get USDC balance for a chain
   *
   * Uses cache if enabled to reduce RPC calls.
   *
   * @throws {BalanceError} If balance fetch fails
   */
  async getUsdcBalance(chain: string, accountIndex = 0): Promise<bigint> {
    const usdcAddress = USDC_ADDRESSES[chain]
    if (!usdcAddress) {
      return 0n
    }

    try {
      const signer = await this.getSigner(chain, accountIndex)
      const address = signer.address

      return await this._balanceCache.getOrFetchTokenBalance(
        chain,
        usdcAddress,
        address,
        async () => signer.getTokenBalance(usdcAddress),
      )
    } catch (error) {
      // Return 0 for balance errors (chain might not support USDC)
      if (isWDKError(error) && error.code === WDKErrorCode.TOKEN_BALANCE_FETCH_FAILED) {
        return 0n
      }
      throw error
    }
  }

  /**
   * Get all token balances for a chain
   *
   * Uses cache if enabled to reduce RPC calls.
   *
   * @throws {ChainError} If chain is not configured
   * @throws {BalanceError} If balance fetch fails
   */
  async getChainBalances(chain: string, accountIndex = 0): Promise<ChainBalance> {
    const config = this._normalizedChains.get(chain)
    if (!config) {
      throw new ChainError(WDKErrorCode.CHAIN_NOT_CONFIGURED, `Chain "${chain}" not configured`, {
        chain,
      })
    }

    try {
      const signer = await this.getSigner(chain, accountIndex)
      const address = signer.address
      const tokens = CHAIN_TOKENS[chain] || []

      // Fetch all token balances in parallel with caching and error handling
      const tokenBalanceResults = await Promise.allSettled(
        tokens.map(async (token) => {
          const balance = await this._balanceCache.getOrFetchTokenBalance(
            chain,
            token.address,
            address,
            async () => signer.getTokenBalance(token.address),
          )
          return {
            token: token.address,
            symbol: token.symbol,
            balance,
            formatted: formatTokenAmount(balance, token.decimals),
            decimals: token.decimals,
          }
        }),
      )

      // Extract successful results, use 0 for failed ones
      const tokenBalances: TokenBalance[] = tokenBalanceResults.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value
        }
        // Return zero balance for failed fetches
        const token = tokens[index]
        return {
          token: token.address,
          symbol: token.symbol,
          balance: 0n,
          formatted: '0',
          decimals: token.decimals,
        }
      })

      // Get native balance with caching
      let nativeBalance: bigint
      try {
        nativeBalance = await this._balanceCache.getOrFetchNativeBalance(chain, address, async () =>
          signer.getBalance(),
        )
      } catch {
        nativeBalance = 0n
      }

      return {
        chain,
        network: config.network,
        native: nativeBalance,
        tokens: tokenBalances,
      }
    } catch (error) {
      if (isWDKError(error)) {
        throw error
      }

      throw new BalanceError(
        WDKErrorCode.BALANCE_FETCH_FAILED,
        `Failed to get balances for chain "${chain}": ${error instanceof Error ? error.message : String(error)}`,
        { chain, cause: error instanceof Error ? error : undefined },
      )
    }
  }

  /**
   * Get aggregated balances across all configured chains
   *
   * @param accountIndex - HD wallet account index (default: 0)
   * @param options - Options for balance aggregation
   */
  async getAggregatedBalances(
    accountIndex = 0,
    options: { continueOnError?: boolean } = {},
  ): Promise<AggregatedBalance> {
    const { continueOnError = true } = options
    const chains = this.getConfiguredChains()

    // Fetch all chain balances in parallel
    const results = await Promise.allSettled(
      chains.map((chain) => this.getChainBalances(chain, accountIndex)),
    )

    const chainBalances: ChainBalance[] = []
    const errors: Error[] = []

    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      if (result.status === 'fulfilled') {
        chainBalances.push(result.value)
      } else {
        errors.push(result.reason)
        if (!continueOnError) {
          throw result.reason
        }
        // Add empty balance for failed chain
        const config = this._normalizedChains.get(chains[i])
        if (config) {
          chainBalances.push({
            chain: chains[i],
            network: config.network,
            native: 0n,
            tokens: [],
          })
        }
      }
    }

    // Calculate totals
    let totalUsdt0 = 0n
    let totalUsdc = 0n

    for (const chainBalance of chainBalances) {
      for (const token of chainBalance.tokens) {
        if (token.symbol === 'USDT0') {
          totalUsdt0 += token.balance
        } else if (token.symbol === 'USDC') {
          totalUsdc += token.balance
        }
      }
    }

    return {
      totalUsdt0,
      totalUsdc,
      chains: chainBalances,
    }
  }

  /**
   * Find the best chain for a payment
   *
   * Looks for the chain with sufficient balance, prioritizing USDT0.
   *
   * @param amount - Required amount in smallest units
   * @param preferredToken - Preferred token ("USDT0" | "USDC")
   * @throws {BalanceError} If balance aggregation fails
   */
  async findBestChainForPayment(
    amount: bigint,
    preferredToken: 'USDT0' | 'USDC' = 'USDT0',
  ): Promise<{ chain: string; token: string; balance: bigint } | null> {
    // Validate amount
    if (amount <= 0n) {
      return null
    }

    try {
      const balances = await this.getAggregatedBalances(0, { continueOnError: true })

      // Priority order based on preferred token
      const tokenPriority = preferredToken === 'USDT0' ? ['USDT0', 'USDC'] : ['USDC', 'USDT0']

      for (const tokenSymbol of tokenPriority) {
        for (const chainBalance of balances.chains) {
          const tokenBalance = chainBalance.tokens.find((t) => t.symbol === tokenSymbol)
          if (tokenBalance && tokenBalance.balance >= amount) {
            return {
              chain: chainBalance.chain,
              token: tokenSymbol,
              balance: tokenBalance.balance,
            }
          }
        }
      }

      return null
    } catch (error) {
      if (isWDKError(error)) {
        throw error
      }

      throw new BalanceError(
        WDKErrorCode.BALANCE_FETCH_FAILED,
        `Failed to find best chain for payment: ${error instanceof Error ? error.message : String(error)}`,
        {
          cause: error instanceof Error ? error : undefined,
          context: { amount: amount.toString() },
        },
      )
    }
  }

  /**
   * Bridge USDT0 between chains
   *
   * Uses LayerZero OFT for cross-chain transfers.
   *
   * @param params - Bridge parameters
   * @throws {BridgeError} If bridge is not available or fails
   * @returns Bridge result with transaction hash
   */
  async bridgeUsdt0(params: BridgeParams): Promise<BridgeResult> {
    // Validate bridge availability
    if (!T402WDK._BridgeUsdt0Evm) {
      throw new BridgeError(
        WDKErrorCode.BRIDGE_NOT_AVAILABLE,
        'USDT0 bridge not available. Register BridgeUsdt0Evm with T402WDK.registerWDK().',
        { fromChain: params.fromChain, toChain: params.toChain },
      )
    }

    // Validate parameters
    if (!params.fromChain || !params.toChain) {
      throw new BridgeError(WDKErrorCode.BRIDGE_FAILED, 'Both fromChain and toChain are required', {
        fromChain: params.fromChain,
        toChain: params.toChain,
      })
    }

    if (params.fromChain === params.toChain) {
      throw new BridgeError(WDKErrorCode.BRIDGE_NOT_SUPPORTED, 'Cannot bridge to the same chain', {
        fromChain: params.fromChain,
        toChain: params.toChain,
      })
    }

    if (!params.amount || params.amount <= 0n) {
      throw new BridgeError(WDKErrorCode.BRIDGE_FAILED, 'Amount must be greater than 0', {
        fromChain: params.fromChain,
        toChain: params.toChain,
        context: { amount: params.amount?.toString() },
      })
    }

    // Check if bridging is supported
    if (!this.canBridge(params.fromChain, params.toChain)) {
      throw new BridgeError(
        WDKErrorCode.BRIDGE_NOT_SUPPORTED,
        `Bridging from "${params.fromChain}" to "${params.toChain}" is not supported`,
        { fromChain: params.fromChain, toChain: params.toChain },
      )
    }

    try {
      const recipient = params.recipient ?? (await this.getAddress(params.toChain))

      const result = await this.wdk.executeProtocol('bridge-usdt0', {
        fromChain: params.fromChain,
        toChain: params.toChain,
        amount: params.amount,
        recipient,
      })

      if (!result || !result.txHash) {
        throw new BridgeError(
          WDKErrorCode.BRIDGE_FAILED,
          'Bridge transaction did not return a transaction hash',
          { fromChain: params.fromChain, toChain: params.toChain },
        )
      }

      return {
        txHash: result.txHash,
        estimatedTime: 300, // ~5 minutes typical for LayerZero
      }
    } catch (error) {
      if (error instanceof BridgeError) {
        throw error
      }

      throw new BridgeError(
        WDKErrorCode.BRIDGE_FAILED,
        `Bridge operation failed: ${error instanceof Error ? error.message : String(error)}`,
        {
          fromChain: params.fromChain,
          toChain: params.toChain,
          cause: error instanceof Error ? error : undefined,
          context: { amount: params.amount.toString() },
        },
      )
    }
  }

  /**
   * Get chains that support USDT0
   */
  getUsdt0Chains(): string[] {
    return this.getConfiguredChains().filter((chain) => USDT0_ADDRESSES[chain])
  }

  /**
   * Get chains that support USDT0 bridging
   *
   * Returns configured chains that have LayerZero OFT bridge support.
   */
  getBridgeableChains(): string[] {
    return this.getConfiguredChains().filter((chain) => supportsBridging(chain))
  }

  /**
   * Check if bridging is supported between two chains
   */
  canBridge(fromChain: string, toChain: string): boolean {
    return (
      fromChain !== toChain &&
      supportsBridging(fromChain) &&
      supportsBridging(toChain) &&
      this._normalizedChains.has(fromChain)
    )
  }

  /**
   * Get all possible bridge destinations from a chain
   */
  getBridgeDestinations(fromChain: string): string[] {
    if (!supportsBridging(fromChain)) {
      return []
    }
    return getBridgeableChains().filter((chain) => chain !== fromChain)
  }

  // ========== Swap Protocol ==========

  /**
   * Check if the Velora swap protocol is registered and available
   */
  canSwap(): boolean {
    return T402WDK._ProtocolModules.swapVeloraEvm !== undefined
  }

  /**
   * Get a swap quote for converting a token to USDT0
   *
   * @param chain - Chain name (e.g., "ethereum", "arbitrum")
   * @param fromToken - Input token address
   * @param amount - Amount to swap in smallest units
   * @throws {WDKError} If swap protocol is not registered or quote fails
   */
  async getSwapQuote(chain: string, fromToken: string, amount: bigint): Promise<SwapQuote> {
    if (!this.canSwap()) {
      throw new WDKError(
        WDKErrorCode.PROTOCOL_NOT_REGISTERED,
        'Velora swap protocol not registered. Call T402WDK.registerWDK(WDK, { protocols: { swapVeloraEvm: SwapVeloraEvm } }).',
      )
    }

    const usdt0Address = USDT0_ADDRESSES[chain]
    if (!usdt0Address) {
      throw new ChainError(
        WDKErrorCode.CHAIN_NOT_SUPPORTED,
        `Chain "${chain}" does not have a known USDT0 address`,
        { chain },
      )
    }

    try {
      const result = await this.wdk.executeProtocol('swap-velora', {
        action: 'quote',
        chain,
        fromToken,
        toToken: usdt0Address,
        amount: amount.toString(),
      })
      return result as unknown as SwapQuote
    } catch (error) {
      throw wrapError(
        error,
        WDKErrorCode.PROTOCOL_EXECUTION_FAILED,
        `Failed to get swap quote on ${chain}`,
        { chain, fromToken, amount: amount.toString() },
      )
    }
  }

  /**
   * Swap any token to USDT0 for payment
   *
   * Uses the Velora protocol to execute a token swap on the specified chain.
   *
   * @param params - Swap parameters
   * @throws {WDKError} If swap protocol is not registered or swap fails
   *
   * @example
   * ```typescript
   * // Swap 0.1 WETH to USDT0 on Arbitrum
   * const result = await wallet.swapAndPay({
   *   chain: 'arbitrum',
   *   fromToken: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH
   *   amount: 100000000000000000n, // 0.1 WETH
   *   maxSlippage: 0.005,
   * });
   * ```
   */
  async swapAndPay(params: SwapParams): Promise<SwapResult> {
    if (!this.canSwap()) {
      throw new WDKError(
        WDKErrorCode.PROTOCOL_NOT_REGISTERED,
        'Velora swap protocol not registered. Call T402WDK.registerWDK(WDK, { protocols: { swapVeloraEvm: SwapVeloraEvm } }).',
      )
    }

    const usdt0Address = USDT0_ADDRESSES[params.chain]
    if (!usdt0Address) {
      throw new ChainError(
        WDKErrorCode.CHAIN_NOT_SUPPORTED,
        `Chain "${params.chain}" does not have a known USDT0 address`,
        { chain: params.chain },
      )
    }

    if (params.maxSlippage !== undefined && (params.maxSlippage < 0 || params.maxSlippage > 0.5)) {
      throw new WDKError(
        WDKErrorCode.INVALID_PARAMETER,
        'maxSlippage must be between 0 and 0.5 (0% to 50%)',
      )
    }

    try {
      const result = await this.wdk.executeProtocol('swap-velora', {
        action: 'swap',
        chain: params.chain,
        fromToken: params.fromToken,
        toToken: usdt0Address,
        amount: params.amount.toString(),
        maxSlippage: params.maxSlippage ?? 0.005,
      })

      // Invalidate balance cache for this chain after swap
      this._balanceCache.invalidateChain(params.chain)

      return result as unknown as SwapResult
    } catch (error) {
      throw wrapError(
        error,
        WDKErrorCode.PROTOCOL_EXECUTION_FAILED,
        `Failed to execute swap on ${params.chain}`,
        {
          chain: params.chain,
          fromToken: params.fromToken,
          amount: params.amount.toString(),
        },
      )
    }
  }

  // ========== Cache Management ==========

  /**
   * Check if balance caching is enabled
   */
  get isCacheEnabled(): boolean {
    return this._balanceCache.enabled
  }

  /**
   * Get cache configuration
   */
  getCacheConfig(): BalanceCacheConfig {
    return this._balanceCache.config
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): BalanceCacheStats {
    return this._balanceCache.getStats()
  }

  /**
   * Invalidate all cached balances
   *
   * Call this after sending transactions to ensure fresh balance data.
   */
  invalidateBalanceCache(): void {
    this._balanceCache.clear()
  }

  /**
   * Invalidate cached balances for a specific chain
   *
   * @param chain - Chain name to invalidate
   * @returns Number of cache entries invalidated
   */
  invalidateChainCache(chain: string): number {
    return this._balanceCache.invalidateChain(chain)
  }

  /**
   * Invalidate cached balances for a specific address
   *
   * @param address - Address to invalidate (case-insensitive)
   * @returns Number of cache entries invalidated
   */
  invalidateAddressCache(address: string): number {
    return this._balanceCache.invalidateAddress(address)
  }

  /**
   * Dispose of cache resources
   *
   * Call this when the T402WDK instance is no longer needed.
   */
  dispose(): void {
    this._balanceCache.dispose()
    this._signerCache.clear()
    this._tonSignerCache.clear()
    this._svmSignerCache.clear()
    this._tronSignerCache.clear()
  }
}

/**
 * Format token amount for display
 */
function formatTokenAmount(amount: bigint, decimals: number): string {
  if (amount === 0n) {
    return '0'
  }

  const divisor = BigInt(10 ** decimals)
  const whole = amount / divisor
  const fraction = amount % divisor

  if (fraction === 0n) {
    return whole.toString()
  }

  const fractionStr = fraction.toString().padStart(decimals, '0')
  // Trim trailing zeros
  const trimmed = fractionStr.replace(/0+$/, '')
  return `${whole}.${trimmed}`
}
