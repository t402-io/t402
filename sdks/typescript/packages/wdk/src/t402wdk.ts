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
  WDKSparkAccount,
  WDKBtcAccount,
  T402WDKCreateConfig,
  SignerEntry,
  GetAllSignersOptions,
  FromWDKOptions,
  SwapQuote,
  SwapResult,
  SwapParams,
  BorrowParams,
  BorrowResult,
  WDKAutoDiscoveryResult,
  FiatOnRampProvider,
  FiatOnRampQuote,
  FiatOnRampParams,
  FiatOnRampResult,
} from './types.js'
import { encryptSeed, decryptSeed, type EncryptedSeed } from './secret.js'
import { T402EventEmitter, type T402Events } from './events.js'
import { InMemoryReceiptStore, type PaymentReceiptStore } from './receipts.js'
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
import { WDKSparkSignerAdapter, createWDKSparkSigner } from './adapters/spark-adapter.js'
import { WDKBtcSignerAdapter, createWDKBtcSigner } from './adapters/btc-adapter.js'
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
  withRetry,
  type RetryConfig,
} from './errors.js'
import {
  registerPricingProvider,
  isPricingProviderRegistered,
  type PricingProvider,
} from './pricing.js'
import { FailoverProvider, type FailoverConfig, type ProviderStatus } from './failover.js'

/**
 * Supported WDK semver range
 */
export const SUPPORTED_WDK_RANGE = '>=1.0.0-beta.5 <2.0.0'

/**
 * Parse a semver version string into components.
 * Handles pre-release tags like "1.0.0-beta.5".
 */
export function parseSemver(
  version: string,
): { major: number; minor: number; patch: number; prerelease: string } | null {
  const match = version.match(/^v?(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/)
  if (!match) return null
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] ?? '',
  }
}

/**
 * Compare two pre-release strings.
 * Empty prerelease (stable) is greater than any prerelease.
 */
function comparePrereleases(a: string, b: string): number {
  if (a === b) return 0
  if (a === '' && b !== '') return 1 // stable > prerelease
  if (a !== '' && b === '') return -1

  const aParts = a.split('.')
  const bParts = b.split('.')
  const len = Math.max(aParts.length, bParts.length)

  for (let i = 0; i < len; i++) {
    const ap = aParts[i] ?? ''
    const bp = bParts[i] ?? ''
    const aNum = /^\d+$/.test(ap)
    const bNum = /^\d+$/.test(bp)

    if (aNum && bNum) {
      const diff = parseInt(ap, 10) - parseInt(bp, 10)
      if (diff !== 0) return diff
    } else if (aNum !== bNum) {
      return aNum ? -1 : 1 // numeric < string
    } else {
      if (ap < bp) return -1
      if (ap > bp) return 1
    }
  }
  return 0
}

/**
 * Compare two semver versions. Returns -1, 0, or 1.
 */
export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a)
  const pb = parseSemver(b)
  if (!pa || !pb) return 0

  if (pa.major !== pb.major) return pa.major - pb.major > 0 ? 1 : -1
  if (pa.minor !== pb.minor) return pa.minor - pb.minor > 0 ? 1 : -1
  if (pa.patch !== pb.patch) return pa.patch - pb.patch > 0 ? 1 : -1
  return comparePrereleases(pa.prerelease, pb.prerelease)
}

/**
 * Check if a version satisfies a simple range like ">=1.0.0-beta.5 <2.0.0".
 * Supports: >=, >, <=, <, = comparators (space-separated AND).
 */
export function satisfiesSemverRange(version: string, range: string): boolean {
  const parsed = parseSemver(version)
  if (!parsed) return false

  const constraints = range.trim().split(/\s+/)
  for (const constraint of constraints) {
    const match = constraint.match(/^(>=|<=|>|<|=)(.+)$/)
    if (!match) continue
    const [, op, target] = match
    const cmp = compareSemver(version, target)

    switch (op) {
      case '>=':
        if (cmp < 0) return false
        break
      case '>':
        if (cmp <= 0) return false
        break
      case '<=':
        if (cmp > 0) return false
        break
      case '<':
        if (cmp >= 0) return false
        break
      case '=':
        if (cmp !== 0) return false
        break
    }
  }
  return true
}

/**
 * Payment cost estimate for a chain
 */
export interface PaymentCostEstimate {
  paymentAmount: string
  estimatedGasCost: bigint
  nativeBalance: bigint
  canAffordGas: boolean
  chain: string
  network: string
}

/** Middleware function type for chain account hooks */
export type MiddlewareFunction = (account: unknown) => Promise<void>

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
  private _events = new T402EventEmitter()
  private _receiptStore: PaymentReceiptStore = new InMemoryReceiptStore()
  private _disposed = false

  // Instance-level module references (#204 multi-instance)
  private _wdkConstructor: WDKConstructor | null = null
  private _walletManagerEvm: unknown = null
  private _bridgeUsdt0Evm: unknown = null
  private _walletModules: WDKWalletModules = {}
  private _protocolModules: WDKProtocolModules = {}
  private _fiatOnRampProvider: FiatOnRampProvider | null = null
  private _middlewares = new Map<string, Array<(account: unknown) => Promise<void>>>()

  // Retry config (#202 network resilience)
  private _retryConfig: Partial<RetryConfig> | undefined

  // Failover providers (#195)
  private _failoverProviders: Map<string, FailoverProvider> = new Map()

  // Static defaults for backward compatibility (#204)
  private static _defaultModules: {
    wdk?: WDKConstructor
    walletManagerEvm?: unknown
    bridgeUsdt0Evm?: unknown
    wallets?: WDKWalletModules
    protocols?: WDKProtocolModules
    fiatOnRampProvider?: FiatOnRampProvider
    middlewares?: Map<string, Array<(account: unknown) => Promise<void>>>
  } = {}

  // Legacy static accessors for tests that access _WDK, _WalletManagerEvm, etc.
  static get _WDK(): WDKConstructor | null {
    return T402WDK._defaultModules.wdk ?? null
  }
  static set _WDK(val: WDKConstructor | null) {
    if (val === null) {
      delete T402WDK._defaultModules.wdk
    } else {
      T402WDK._defaultModules.wdk = val
    }
  }
  static get _WalletManagerEvm(): unknown {
    return T402WDK._defaultModules.walletManagerEvm ?? null
  }
  static set _WalletManagerEvm(val: unknown) {
    if (val === null) {
      delete T402WDK._defaultModules.walletManagerEvm
      if (T402WDK._defaultModules.wallets) {
        delete T402WDK._defaultModules.wallets.evm
      }
    } else {
      T402WDK._defaultModules.walletManagerEvm = val
      if (!T402WDK._defaultModules.wallets) {
        T402WDK._defaultModules.wallets = {}
      }
      T402WDK._defaultModules.wallets.evm = val
    }
  }
  static get _BridgeUsdt0Evm(): unknown {
    return T402WDK._defaultModules.bridgeUsdt0Evm ?? null
  }
  static set _BridgeUsdt0Evm(val: unknown) {
    if (val === null) {
      delete T402WDK._defaultModules.bridgeUsdt0Evm
      // Also sync protocols
      if (T402WDK._defaultModules.protocols) {
        delete T402WDK._defaultModules.protocols.bridgeUsdt0Evm
      }
    } else {
      T402WDK._defaultModules.bridgeUsdt0Evm = val
      if (!T402WDK._defaultModules.protocols) {
        T402WDK._defaultModules.protocols = {}
      }
      T402WDK._defaultModules.protocols.bridgeUsdt0Evm = val
    }
  }
  static get _WalletModules(): WDKWalletModules {
    return T402WDK._defaultModules.wallets ?? {}
  }
  static set _WalletModules(val: WDKWalletModules) {
    T402WDK._defaultModules.wallets = val
  }
  static get _ProtocolModules(): WDKProtocolModules {
    return T402WDK._defaultModules.protocols ?? {}
  }
  static set _ProtocolModules(val: WDKProtocolModules) {
    T402WDK._defaultModules.protocols = val
  }
  static get _fiatOnRampProvider(): FiatOnRampProvider | null {
    return T402WDK._defaultModules.fiatOnRampProvider ?? null
  }
  static set _fiatOnRampProvider(val: FiatOnRampProvider | null) {
    if (val === null) {
      delete T402WDK._defaultModules.fiatOnRampProvider
    } else {
      T402WDK._defaultModules.fiatOnRampProvider = val
    }
  }
  static get _middlewares(): Map<string, Array<(account: unknown) => Promise<void>>> {
    if (!T402WDK._defaultModules.middlewares) {
      T402WDK._defaultModules.middlewares = new Map()
    }
    return T402WDK._defaultModules.middlewares
  }
  static set _middlewares(val: Map<string, Array<(account: unknown) => Promise<void>>>) {
    T402WDK._defaultModules.middlewares = val
  }

  // HD path-derived signer cache
  private _pathSignerCache = new Map<string, WDKSigner>()

  // Multi-chain signer caches
  private _tonSignerCache: Map<number, WDKTonSignerAdapter> = new Map()
  private _svmSignerCache: Map<number, WDKSvmSignerAdapter> = new Map()
  private _tronSignerCache: Map<number, WDKTronSignerAdapter> = new Map()
  private _sparkSignerCache: Map<number, WDKSparkSignerAdapter> = new Map()
  private _btcSignerCache: Map<number, WDKBtcSignerAdapter> = new Map()

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

    // #205: Runtime version check
    const wdkVersion = (WDK as unknown as Record<string, unknown>).version as string | undefined
    if (wdkVersion && typeof wdkVersion === 'string') {
      if (!satisfiesSemverRange(wdkVersion, SUPPORTED_WDK_RANGE)) {
        throw new WDKInitializationError(
          `WDK version ${wdkVersion} is not supported. Required: ${SUPPORTED_WDK_RANGE}`,
        )
      }
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
   * Check if Spark wallet manager is registered
   */
  static isSparkRegistered(): boolean {
    return T402WDK._WalletModules.spark !== undefined
  }

  /**
   * Check if Bitcoin wallet manager is registered
   */
  static isBtcRegistered(): boolean {
    return T402WDK._WalletModules.btc !== undefined
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
   * Register a fiat on-ramp provider
   *
   * @param provider - A FiatOnRampProvider implementation (e.g., MoonpayOnRampProvider)
   *
   * @example
   * ```typescript
   * import { T402WDK, MoonpayOnRampProvider } from '@t402/wdk';
   *
   * T402WDK.registerFiatOnRamp(new MoonpayOnRampProvider({ apiKey: 'pk_test_...' }));
   * ```
   */
  static registerFiatOnRamp(provider: FiatOnRampProvider): void {
    if (!provider || typeof provider.getQuote !== 'function') {
      throw new WDKInitializationError('A valid FiatOnRampProvider is required')
    }
    T402WDK._fiatOnRampProvider = provider
  }

  /**
   * Check if a fiat on-ramp provider is registered
   */
  static isFiatOnRampRegistered(): boolean {
    return T402WDK._fiatOnRampProvider !== null
  }

  /**
   * Register a pricing provider for fiat-to-crypto rate conversion
   */
  static registerPricingProvider(provider: PricingProvider): void {
    registerPricingProvider(provider)
  }

  /**
   * Check if a pricing provider is registered
   */
  static isPricingProviderRegistered(): boolean {
    return isPricingProviderRegistered()
  }

  /**
   * Register a middleware for a chain
   */
  static registerMiddleware(chain: string, fn: (account: unknown) => Promise<void>): void {
    const existing = T402WDK._middlewares.get(chain) ?? []
    existing.push(fn)
    T402WDK._middlewares.set(chain, existing)
  }

  /**
   * Get registered middlewares for a chain
   */
  static getMiddlewares(chain: string): Array<(account: unknown) => Promise<void>> {
    return T402WDK._middlewares.get(chain) ?? []
  }

  /**
   * Clear all middlewares
   */
  static clearMiddlewares(): void {
    T402WDK._middlewares.clear()
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
   * Auto-discover installed WDK packages using dynamic imports.
   *
   * Probes known `@tetherto/wdk-*` packages and returns the ones that
   * are installed and importable.
   *
   * @returns Discovery result with available/unavailable packages and ready-to-use modules config
   *
   * @example
   * ```typescript
   * const result = await T402WDK.autoDiscover();
   * console.log('Found:', result.available);
   * console.log('Missing:', result.unavailable);
   * ```
   */
  static async autoDiscover(): Promise<WDKAutoDiscoveryResult> {
    const walletPackages: Record<keyof WDKWalletModules, string> = {
      evm: '@tetherto/wdk-wallet-evm',
      solana: '@tetherto/wdk-wallet-solana',
      ton: '@tetherto/wdk-wallet-ton',
      tron: '@tetherto/wdk-wallet-tron',
      btc: '@tetherto/wdk-wallet-btc',
      spark: '@buildonspark/spark-sdk',
      evmErc4337: '@tetherto/wdk-wallet-evm-erc-4337',
      tonGasless: '@tetherto/wdk-wallet-ton-gasless',
      tronGasfree: '@tetherto/wdk-wallet-tron-gasfree',
    }

    const protocolPackages: Record<keyof WDKProtocolModules, string> = {
      bridgeUsdt0Evm: '@tetherto/wdk-protocol-bridge-usdt0-evm',
      bridgeUsdt0Ton: '@tetherto/wdk-protocol-bridge-usdt0-ton',
      swapVeloraEvm: '@tetherto/wdk-protocol-swap-velora-evm',
      lendingAaveEvm: '@tetherto/wdk-protocol-lending-aave-evm',
    }

    const available: string[] = []
    const unavailable: string[] = []
    const wallets: WDKWalletModules = {}
    const protocols: WDKProtocolModules = {}

    // Probe wallet packages
    const walletEntries = Object.entries(walletPackages) as [keyof WDKWalletModules, string][]
    const walletResults = await Promise.allSettled(
      walletEntries.map(async ([key, pkg]) => {
        const mod = await import(/* @vite-ignore */ pkg)
        return { key, pkg, mod: mod.default ?? mod }
      }),
    )

    for (let i = 0; i < walletResults.length; i++) {
      const result = walletResults[i]
      if (result.status === 'fulfilled') {
        const { key, pkg, mod } = result.value
        wallets[key] = mod
        available.push(pkg)
      } else {
        unavailable.push(walletEntries[i][1])
      }
    }

    // Probe protocol packages
    const protocolEntries = Object.entries(protocolPackages) as [keyof WDKProtocolModules, string][]
    const protocolResults = await Promise.allSettled(
      protocolEntries.map(async ([key, pkg]) => {
        const mod = await import(/* @vite-ignore */ pkg)
        return { key, pkg, mod: mod.default ?? mod }
      }),
    )

    for (let i = 0; i < protocolResults.length; i++) {
      const result = protocolResults[i]
      if (result.status === 'fulfilled') {
        const { key, pkg, mod } = result.value
        protocols[key] = mod
        available.push(pkg)
      } else {
        unavailable.push(protocolEntries[i][1])
      }
    }

    return {
      discovered: { wallets, protocols },
      available,
      unavailable,
    }
  }

  /**
   * Auto-discover installed WDK modules, then create a fully configured T402WDK.
   *
   * Combines `autoDiscover()` + `create()` in one call. Any explicit
   * modules you pass in `config.modules` take precedence over discovered ones.
   *
   * @param config - Same as `T402WDKCreateConfig` but `modules` is optional/partial
   * @returns A ready-to-use T402WDK instance
   *
   * @example
   * ```typescript
   * const wdk = await T402WDK.autoCreate({
   *   seedPhrase: 'your twelve word seed phrase ...',
   *   chains: { arbitrum: 'https://arb1.arbitrum.io/rpc' },
   * });
   * ```
   */
  static async autoCreate(
    config: Omit<T402WDKCreateConfig, 'modules'> & { modules?: Partial<WDKModulesConfig> },
  ): Promise<T402WDK> {
    // Discover installed modules
    const { discovered } = await T402WDK.autoDiscover()

    // Merge: explicit modules override discovered ones
    const mergedModules: WDKModulesConfig = {
      wallets: { ...discovered.wallets, ...config.modules?.wallets },
      protocols: { ...discovered.protocols, ...config.modules?.protocols },
    }

    // Auto-discover the WDK constructor itself
    let WDKRef: WDKConstructor
    try {
      const wdkMod = await import(/* @vite-ignore */ '@tetherto/wdk')
      WDKRef = (wdkMod.default ?? wdkMod) as unknown as WDKConstructor
    } catch {
      throw new WDKInitializationError(
        '@tetherto/wdk package not found. Install it with: npm install @tetherto/wdk',
      )
    }

    return T402WDK.create(WDKRef, {
      seedPhrase: config.seedPhrase,
      chains: config.chains,
      modules: mergedModules,
      options: config.options,
    })
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
   * Create a T402WDK instance from an encrypted seed.
   *
   * @example
   * ```typescript
   * const encrypted = JSON.parse(fs.readFileSync('seed.enc.json', 'utf8'))
   * const wdk = await T402WDK.fromEncryptedSeed(encrypted, 'my-password', {
   *   arbitrum: 'https://arb1.arbitrum.io/rpc',
   * })
   * ```
   */
  static async fromEncryptedSeed(
    encrypted: EncryptedSeed,
    password: string,
    config?: T402WDKConfig,
    options?: T402WDKOptions,
  ): Promise<T402WDK> {
    const seedPhrase = await decryptSeed(encrypted, password)
    return new T402WDK(seedPhrase, config, options)
  }

  /**
   * Encrypt the current seed phrase for secure storage.
   *
   * @param password - Password to encrypt with
   * @returns Encrypted seed data suitable for JSON serialization
   */
  async encryptSeed(password: string): Promise<EncryptedSeed> {
    this.assertNotDisposed()
    return encryptSeed(this._seedPhrase, password)
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
    this.assertNotDisposed()
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
    if (this._walletModules.ton !== undefined) {
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
    if (this._walletModules.solana !== undefined) {
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
    if (this._walletModules.tron !== undefined) {
      try {
        const signer = await this.getTronSigner(accountIndex)
        for (const scheme of schemes) {
          entries.push({ scheme, network: 'tron:mainnet', signer, family: 'tron' })
        }
      } catch {
        // Skip if TRON signer fails
      }
    }

    // Spark signer
    if (this._walletModules.spark !== undefined) {
      try {
        const signer = await this.getSparkSigner(accountIndex)
        for (const scheme of schemes) {
          entries.push({ scheme, network: 'spark:mainnet', signer, family: 'spark' })
        }
      } catch {
        // Skip if Spark signer fails
      }
    }

    // Bitcoin signer
    if (this._walletModules.btc !== undefined) {
      try {
        const signer = await this.getBtcSigner(accountIndex)
        for (const scheme of schemes) {
          entries.push({
            scheme,
            network: 'bip122:000000000019d6689c085ae165831e93',
            signer,
            family: 'btc',
          })
        }
      } catch {
        // Skip if Bitcoin signer fails
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

    // #204: Instance-level modules, falling back to static defaults
    this._wdkConstructor = options.wdk ?? T402WDK._defaultModules.wdk ?? null
    this._walletModules = options.wallets ?? T402WDK._defaultModules.wallets ?? {}
    this._protocolModules = options.protocols ?? T402WDK._defaultModules.protocols ?? {}
    this._walletManagerEvm =
      this._walletModules.evm ?? T402WDK._defaultModules.walletManagerEvm ?? null
    this._bridgeUsdt0Evm =
      this._protocolModules.bridgeUsdt0Evm ?? T402WDK._defaultModules.bridgeUsdt0Evm ?? null
    this._fiatOnRampProvider =
      options.fiatOnRampProvider ?? T402WDK._defaultModules.fiatOnRampProvider ?? null
    if (options.middlewares) {
      this._middlewares = new Map(options.middlewares)
    } else if (T402WDK._defaultModules.middlewares) {
      // Copy static middlewares so instance doesn't mutate shared state
      this._middlewares = new Map(T402WDK._defaultModules.middlewares)
    }

    // #202: Store retry config
    this._retryConfig = options.retry

    // Normalize chain configurations (#195: handle array providers)
    for (const [chain, chainConfig] of Object.entries(config)) {
      if (chainConfig) {
        try {
          // Handle EvmChainConfig with provider arrays
          if (
            typeof chainConfig === 'object' &&
            'provider' in chainConfig &&
            Array.isArray(chainConfig.provider)
          ) {
            const urls = chainConfig.provider as string[]
            if (urls.length === 0) {
              throw new Error('Provider array must contain at least one URL')
            }
            // Create FailoverProvider
            const failoverConfig: FailoverConfig = {
              urls,
              ...(chainConfig.failover ?? {}),
            }
            const failoverProvider = new FailoverProvider(failoverConfig)
            this._failoverProviders.set(chain, failoverProvider)
            // Normalize using the current URL from failover
            const normalized = normalizeChainConfig(chain, failoverProvider.getCurrentUrl())
            if (chainConfig.chainId !== undefined) normalized.chainId = chainConfig.chainId
            if (chainConfig.network !== undefined) normalized.network = chainConfig.network
            this._normalizedChains.set(chain, normalized)
          } else {
            this._normalizedChains.set(
              chain,
              normalizeChainConfig(
                chain,
                chainConfig as string | { provider: string; chainId: number; network: string },
              ),
            )
          }
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
    if (!isFromWDK && this._wdkConstructor) {
      this._initializeWDK()
    }
  }

  /**
   * Guard: throw if this instance has been disposed (#194)
   */
  private assertNotDisposed(): void {
    if (this._disposed) {
      throw new WDKError(WDKErrorCode.WDK_NOT_INITIALIZED, 'T402WDK has been disposed')
    }
  }

  /**
   * Whether this instance has been disposed
   */
  get isDisposed(): boolean {
    return this._disposed
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
    if (!this._wdkConstructor) {
      this._initializationError = new WDKInitializationError('WDK not registered')
      return
    }

    if (!this._walletManagerEvm) {
      this._initializationError = new WDKInitializationError(
        'WalletManagerEvm not registered. Call T402WDK.registerWDK(WDK, WalletManagerEvm) to enable wallet functionality.',
      )
      return
    }

    try {
      let wdk = new this._wdkConstructor(this._seedPhrase)

      // Register EVM wallets for each configured chain
      for (const [chain, config] of this._normalizedChains) {
        try {
          // #195: Use failover provider's current URL if available
          const failover = this._failoverProviders.get(chain)
          const providerUrl = failover ? failover.getCurrentUrl() : config.provider
          wdk = wdk.registerWallet(chain, this._walletManagerEvm, {
            provider: providerUrl,
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
      if (this._bridgeUsdt0Evm) {
        try {
          wdk = wdk.registerProtocol('bridge-usdt0', this._bridgeUsdt0Evm)
        } catch (error) {
          // Bridge registration failure is non-fatal, just log it
          console.warn(
            `Failed to register USDT0 bridge protocol: ${error instanceof Error ? error.message : String(error)}`,
          )
        }
      }

      // Register Velora swap protocol if available
      if (this._protocolModules.swapVeloraEvm) {
        try {
          wdk = wdk.registerProtocol('swap-velora', this._protocolModules.swapVeloraEvm)
        } catch (error) {
          console.warn(
            `Failed to register Velora swap protocol: ${error instanceof Error ? error.message : String(error)}`,
          )
        }
      }

      // Register Aave lending protocol if available
      if (this._protocolModules.lendingAaveEvm) {
        try {
          wdk = wdk.registerProtocol('lending-aave', this._protocolModules.lendingAaveEvm)
        } catch (error) {
          console.warn(
            `Failed to register Aave lending protocol: ${error instanceof Error ? error.message : String(error)}`,
          )
        }
      }

      // Wire middlewares into WDK
      if (typeof (wdk as any).registerMiddleware === 'function') {
        for (const [chain, fns] of this._middlewares) {
          for (const fn of fns) {
            try {
              ;(wdk as any).registerMiddleware(chain, fn)
            } catch {
              /* non-fatal */
            }
          }
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

  // ========== Event Emitter ==========

  /**
   * Subscribe to a T402 event
   */
  on<K extends keyof T402Events>(event: K, handler: (data: T402Events[K]) => void): this {
    this._events.on(event, handler)
    return this
  }

  /**
   * Unsubscribe from a T402 event
   */
  off<K extends keyof T402Events>(event: K, handler: (data: T402Events[K]) => void): this {
    this._events.off(event, handler)
    return this
  }

  /**
   * Subscribe to a T402 event (fires once then auto-unsubscribes)
   */
  once<K extends keyof T402Events>(event: K, handler: (data: T402Events[K]) => void): this {
    this._events.once(event, handler)
    return this
  }

  /**
   * Emit a T402 event
   */
  emit<K extends keyof T402Events>(event: K, data: T402Events[K]): boolean {
    return this._events.emit(event, data)
  }

  // ========== Receipt Store ==========

  /**
   * Get the payment receipt store
   */
  getReceiptStore(): PaymentReceiptStore {
    return this._receiptStore
  }

  /**
   * Set a custom payment receipt store backend
   */
  setReceiptStore(store: PaymentReceiptStore): void {
    this._receiptStore = store
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
    this.assertNotDisposed()
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
      this._events.emit('signer:initialized', {
        chain,
        address: signer.address,
        family: 'evm',
      })
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
    this._pathSignerCache.clear()
    this._tonSignerCache.clear()
    this._svmSignerCache.clear()
    this._tronSignerCache.clear()
    this._sparkSignerCache.clear()
    this._btcSignerCache.clear()
  }

  // ========== Fee Rates & Cost Estimation ==========

  /**
   * Get current fee rates for a chain
   */
  async getFeeRates(chain: string): Promise<Record<string, bigint>> {
    if (this._wdk && typeof (this._wdk as any).getFeeRates === 'function') {
      return (this._wdk as any).getFeeRates(chain)
    }
    // Return default estimates
    return { low: 1000000000n, medium: 2000000000n, high: 5000000000n }
  }

  /**
   * Estimate total cost of a payment on a chain
   */
  async estimatePaymentCost(chain: string, amount: string): Promise<PaymentCostEstimate> {
    const signer = await this.getSigner(chain)
    const nativeBalance = await signer.getBalance()

    let estimatedGasCost = 100000n * 2000000000n // default: 100k gas * 2 gwei
    try {
      const feeRates = await this.getFeeRates(chain)
      const mediumRate = feeRates.medium ?? 2000000000n
      estimatedGasCost = 100000n * mediumRate
    } catch {
      /* use default */
    }

    const config = this.getChainConfig(chain)
    return {
      paymentAmount: amount,
      estimatedGasCost,
      nativeBalance,
      canAffordGas: nativeBalance >= estimatedGasCost,
      chain,
      network: config?.network ?? '',
    }
  }

  // ========== HD Derivation Paths ==========

  /**
   * Get a signer using a custom BIP-44 derivation path
   */
  async getSignerByPath(chain: string, path: string): Promise<WDKSigner> {
    const cacheKey = `${chain}:path:${path}`
    const cached = this._pathSignerCache.get(cacheKey)
    if (cached) return cached

    if (!this._wdk) {
      throw new WDKInitializationError('WDK not initialized')
    }

    if (typeof (this._wdk as any).getAccountByPath !== 'function') {
      throw new Error(
        'getAccountByPath not available. Upgrade @tetherto/wdk to support custom derivation paths.',
      )
    }

    const account = await (this._wdk as any).getAccountByPath(chain, path)
    const address = await account.getAddress()

    const signer = new WDKSigner(this._wdk, chain, 0)
    ;(signer as any)._account = account
    ;(signer as any)._address = address

    this._pathSignerCache.set(cacheKey, signer)
    return signer
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
    this.assertNotDisposed()
    // Check cache first
    const cached = this._tonSignerCache.get(accountIndex)
    if (cached) {
      return cached
    }

    // Validate TON wallet manager is registered
    if (!this._walletModules.ton) {
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
      this._events.emit('signer:initialized', {
        chain: 'ton',
        address: signer.address.toString(),
        family: 'ton',
      })
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
    this.assertNotDisposed()
    // Check cache first
    const cached = this._svmSignerCache.get(accountIndex)
    if (cached) {
      return cached
    }

    // Validate Solana wallet manager is registered
    if (!this._walletModules.solana) {
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
      this._events.emit('signer:initialized', {
        chain: 'solana',
        address: signer.address.toString(),
        family: 'svm',
      })
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
    this.assertNotDisposed()
    // Check cache first (only if no custom RPC)
    if (!rpcUrl) {
      const cached = this._tronSignerCache.get(accountIndex)
      if (cached) {
        return cached
      }
    }

    // Validate TRON wallet manager is registered
    if (!this._walletModules.tron) {
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

      this._events.emit('signer:initialized', {
        chain: 'tron',
        address: signer.address,
        family: 'tron',
      })
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
   * Get a Spark (Bitcoin L2) signer for T402 payments
   *
   * @param accountIndex - HD wallet account index (default: 0)
   * @throws {ChainError} If Spark wallet manager is not registered
   * @returns An initialized WDKSparkSignerAdapter
   *
   * @example
   * ```typescript
   * const sparkSigner = await wallet.getSparkSigner();
   *
   * const client = createT402HTTPClient({
   *   signers: [{ scheme: 'exact', network: 'spark:mainnet', signer: sparkSigner }]
   * });
   * ```
   */
  async getSparkSigner(accountIndex = 0): Promise<WDKSparkSignerAdapter> {
    this.assertNotDisposed()
    // Check cache first
    const cached = this._sparkSignerCache.get(accountIndex)
    if (cached) {
      return cached
    }

    // Validate Spark wallet manager is registered
    if (!this._walletModules.spark) {
      throw new ChainError(
        WDKErrorCode.CHAIN_NOT_SUPPORTED,
        'Spark wallet manager not registered. Call T402WDK.registerWDK(WDK, { wallets: { spark: SparkWalletManager } }).',
        { chain: 'spark' },
      )
    }

    try {
      // Get Spark account from WDK
      const account = (await this.wdk.getAccount(
        'spark',
        accountIndex,
      )) as unknown as WDKSparkAccount

      // Create and cache the signer adapter
      const signer = await createWDKSparkSigner(account)
      this._sparkSignerCache.set(accountIndex, signer)
      this._events.emit('signer:initialized', {
        chain: 'spark',
        address: signer.address,
        family: 'spark',
      })
      return signer
    } catch (error) {
      if (isWDKError(error)) {
        throw error
      }

      throw wrapError(error, WDKErrorCode.SIGNER_NOT_INITIALIZED, 'Failed to create Spark signer', {
        chain: 'spark',
        accountIndex,
      })
    }
  }

  /**
   * Get a Bitcoin (BTC) on-chain signer for T402 payments
   *
   * @param accountIndex - HD wallet account index (default: 0)
   * @throws {ChainError} If Bitcoin wallet manager is not registered
   * @returns An initialized WDKBtcSignerAdapter
   *
   * @example
   * ```typescript
   * const btcSigner = await wallet.getBtcSigner();
   *
   * const client = createT402HTTPClient({
   *   signers: [{ scheme: 'exact', network: 'bip122:000000000019d6689c085ae165831e93', signer: btcSigner }]
   * });
   * ```
   */
  async getBtcSigner(accountIndex = 0): Promise<WDKBtcSignerAdapter> {
    this.assertNotDisposed()
    // Check cache first
    const cached = this._btcSignerCache.get(accountIndex)
    if (cached) {
      return cached
    }

    // Validate BTC wallet manager is registered
    if (!this._walletModules.btc) {
      throw new ChainError(
        WDKErrorCode.CHAIN_NOT_SUPPORTED,
        'Bitcoin wallet manager not registered. Call T402WDK.registerWDK(WDK, { wallets: { btc: WalletManagerBtc } }).',
        { chain: 'btc' },
      )
    }

    try {
      // Get Bitcoin account from WDK
      const account = (await this.wdk.getAccount('btc', accountIndex)) as unknown as WDKBtcAccount

      // Create and cache the signer adapter
      const signer = await createWDKBtcSigner(account)
      this._btcSignerCache.set(accountIndex, signer)
      this._events.emit('signer:initialized', {
        chain: 'btc',
        address: signer.address,
        family: 'btc',
      })
      return signer
    } catch (error) {
      if (isWDKError(error)) {
        throw error
      }

      throw wrapError(
        error,
        WDKErrorCode.SIGNER_NOT_INITIALIZED,
        'Failed to create Bitcoin signer',
        { chain: 'btc', accountIndex },
      )
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
  ): Promise<
    | WDKSigner
    | ClientTonSigner
    | ClientSvmSigner
    | ClientTronSigner
    | WDKSparkSignerAdapter
    | WDKBtcSignerAdapter
  > {
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

      case 'spark':
        return this.getSparkSigner(typeof chainOrIndex === 'number' ? chainOrIndex : accountIndex)

      case 'btc':
        return this.getBtcSigner(typeof chainOrIndex === 'number' ? chainOrIndex : accountIndex)

      default:
        throw new ChainError(
          WDKErrorCode.CHAIN_NOT_SUPPORTED,
          `Chain family "${family}" is not supported. Available: evm, ton, svm, tron, spark, btc`,
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
    this.assertNotDisposed()
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
    this.assertNotDisposed()
    const usdt0Address = USDT0_ADDRESSES[chain]
    if (!usdt0Address) {
      return 0n
    }

    try {
      const signer = await this.getSigner(chain, accountIndex)
      const address = signer.address

      return await this._balanceCache.getOrFetchTokenBalance(chain, usdt0Address, address, () =>
        this._withRetry(() => signer.getTokenBalance(usdt0Address)),
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
    this.assertNotDisposed()
    const usdcAddress = USDC_ADDRESSES[chain]
    if (!usdcAddress) {
      return 0n
    }

    try {
      const signer = await this.getSigner(chain, accountIndex)
      const address = signer.address

      return await this._balanceCache.getOrFetchTokenBalance(chain, usdcAddress, address, () =>
        this._withRetry(() => signer.getTokenBalance(usdcAddress)),
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
    this.assertNotDisposed()
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
            () => this._withRetry(() => signer.getTokenBalance(token.address)),
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
        nativeBalance = await this._balanceCache.getOrFetchNativeBalance(chain, address, () =>
          this._withRetry(() => signer.getBalance()),
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
            // Verify gas affordability
            try {
              const costEstimate = await this.estimatePaymentCost(
                chainBalance.chain,
                amount.toString(),
              )
              if (!costEstimate.canAffordGas) {
                continue // Skip chains where user can't afford gas
              }
            } catch {
              /* continue anyway if estimation fails */
            }
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
    this.assertNotDisposed()
    // Validate bridge availability
    if (!this._bridgeUsdt0Evm) {
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

      this._events.emit('bridge:start', {
        fromChain: params.fromChain,
        toChain: params.toChain,
        amount: params.amount,
      })

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

      this._events.emit('bridge:confirmed', {
        txHash: result.txHash,
        fromChain: params.fromChain,
        toChain: params.toChain,
      })

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
    return this._protocolModules.swapVeloraEvm !== undefined
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

  // ========== Lending Protocol ==========

  /**
   * Check if the Aave lending protocol is registered and available
   */
  canBorrow(): boolean {
    return this._protocolModules.lendingAaveEvm !== undefined
  }

  /**
   * Borrow USDT0 against collateral and pay
   *
   * Uses the Aave protocol to deposit collateral, borrow USDT0, then the
   * borrowed USDT0 is available for T402 payments.
   *
   * @param params - Borrow parameters
   * @throws {WDKError} If lending protocol is not registered or borrow fails
   *
   * @example
   * ```typescript
   * // Borrow 100 USDT0 against 0.05 WETH on Arbitrum
   * const result = await wallet.borrowAndPay({
   *   chain: 'arbitrum',
   *   collateralToken: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH
   *   collateralAmount: 50000000000000000n, // 0.05 WETH
   *   borrowAmount: 100000000n, // 100 USDT0
   * });
   * ```
   */
  async borrowAndPay(params: BorrowParams): Promise<BorrowResult> {
    if (!this.canBorrow()) {
      throw new WDKError(
        WDKErrorCode.PROTOCOL_NOT_REGISTERED,
        'Aave lending protocol not registered. Call T402WDK.registerWDK(WDK, { protocols: { lendingAaveEvm: LendingAaveEvm } }).',
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

    if (params.collateralAmount <= 0n) {
      throw new WDKError(WDKErrorCode.INVALID_PARAMETER, 'collateralAmount must be greater than 0')
    }

    if (params.borrowAmount <= 0n) {
      throw new WDKError(WDKErrorCode.INVALID_PARAMETER, 'borrowAmount must be greater than 0')
    }

    try {
      const result = await this.wdk.executeProtocol('lending-aave', {
        action: 'borrow',
        chain: params.chain,
        collateralToken: params.collateralToken,
        collateralAmount: params.collateralAmount.toString(),
        borrowToken: usdt0Address,
        borrowAmount: params.borrowAmount.toString(),
        interestRateMode: params.interestRateMode ?? 2,
      })

      // Invalidate balance cache for this chain after borrow
      this._balanceCache.invalidateChain(params.chain)

      const r = result as unknown as Record<string, unknown>
      return {
        supplyTxHash: r.supplyTxHash as string,
        borrowTxHash: r.borrowTxHash as string,
        borrowedAmount: BigInt(r.borrowedAmount as string),
      }
    } catch (error) {
      throw wrapError(
        error,
        WDKErrorCode.PROTOCOL_EXECUTION_FAILED,
        `Failed to execute borrow on ${params.chain}`,
        {
          chain: params.chain,
          collateralToken: params.collateralToken,
          borrowAmount: params.borrowAmount.toString(),
        },
      )
    }
  }

  // ========== Fiat On-Ramp ==========

  /**
   * Get a fiat on-ramp quote
   *
   * @param params - Quote parameters (fiatAmount, fiatCurrency, network)
   * @throws {WDKError} If no fiat on-ramp provider is registered
   */
  async getFiatOnRampQuote(
    params: Pick<FiatOnRampParams, 'fiatAmount' | 'fiatCurrency' | 'network'>,
  ): Promise<FiatOnRampQuote> {
    this.assertNotDisposed()
    if (!this._fiatOnRampProvider) {
      throw new WDKError(
        WDKErrorCode.PROTOCOL_NOT_REGISTERED,
        'No fiat on-ramp provider registered. Call T402WDK.registerFiatOnRamp() first.',
      )
    }
    return this._fiatOnRampProvider.getQuote(params)
  }

  /**
   * Generate a fiat on-ramp widget URL for the user
   *
   * Returns a widget URL that the application should open in a browser
   * or webview so the user can complete the fiat purchase.
   *
   * @param params - On-ramp parameters
   * @throws {WDKError} If no fiat on-ramp provider is registered
   *
   * @example
   * ```typescript
   * const result = await wallet.onRampAndPay({
   *   fiatAmount: 100,
   *   fiatCurrency: 'USD',
   *   walletAddress: '0x...',
   *   network: 'eip155:42161',
   * });
   * // Open result.widgetUrl in browser/webview
   * ```
   */
  onRampAndPay(params: FiatOnRampParams): FiatOnRampResult {
    this.assertNotDisposed()
    if (!this._fiatOnRampProvider) {
      throw new WDKError(
        WDKErrorCode.PROTOCOL_NOT_REGISTERED,
        'No fiat on-ramp provider registered. Call T402WDK.registerFiatOnRamp() first.',
      )
    }
    return this._fiatOnRampProvider.createWidget(params)
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
    for (const chain of this.getConfiguredChains()) {
      this._events.emit('balance:changed', {
        chain,
        token: '*',
        previousBalance: 0n,
        newBalance: 0n,
      })
    }
  }

  /**
   * Invalidate cached balances for a specific chain
   *
   * @param chain - Chain name to invalidate
   * @returns Number of cache entries invalidated
   */
  invalidateChainCache(chain: string): number {
    const count = this._balanceCache.invalidateChain(chain)
    if (count > 0) {
      this._events.emit('balance:changed', {
        chain,
        token: '*',
        previousBalance: 0n,
        newBalance: 0n,
      })
    }
    return count
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
   * Dispose of all resources held by this instance (#194).
   *
   * After disposal, any public method call will throw.
   * Safe to call multiple times.
   */
  dispose(): void {
    if (this._disposed) return
    this._disposed = true

    // Dispose underlying WDK if it supports it
    if (this._wdk && typeof (this._wdk as any).dispose === 'function') {
      try {
        ;(this._wdk as any).dispose()
      } catch {
        /* best-effort */
      }
    }
    this._wdk = null

    // Clear ALL signer caches
    this._signerCache.clear()
    this._pathSignerCache.clear()
    this._tonSignerCache.clear()
    this._svmSignerCache.clear()
    this._tronSignerCache.clear()
    this._sparkSignerCache.clear()
    this._btcSignerCache.clear()

    // Wipe seed phrase
    this._seedPhrase = ''

    // Stop balance cache timers
    this._balanceCache.dispose()

    // Dispose all FailoverProvider instances (#195)
    for (const provider of this._failoverProviders.values()) {
      provider.dispose()
    }
    this._failoverProviders.clear()
  }

  /**
   * Symbol.dispose support for `using` declarations (TC39 Explicit Resource Management)
   */
  [Symbol.dispose](): void {
    this.dispose()
  }

  // ========== Failover Provider Status (#195) ==========

  /**
   * Get the FailoverProvider status for a chain, if one exists.
   *
   * @param chain - Chain name
   * @returns Array of provider statuses, or null if no failover is configured for the chain
   */
  getProviderStatus(chain: string): ProviderStatus[] | null {
    const provider = this._failoverProviders.get(chain)
    if (!provider) return null
    return provider.getStatus()
  }

  // ========== Network Resilience (#202) ==========

  /**
   * Simple online connectivity check.
   * Returns true if at least one configured chain's RPC responds.
   */
  get isOnline(): Promise<boolean> {
    return this._checkOnline()
  }

  private async _checkOnline(): Promise<boolean> {
    const chains = this.getConfiguredChains()
    if (chains.length === 0) return false

    for (const chain of chains) {
      const config = this._normalizedChains.get(chain)
      if (!config) continue
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 3000)
        const response = await fetch(config.provider, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 }),
          signal: controller.signal,
        })
        clearTimeout(timeout)
        if (response.ok) return true
      } catch {
        // try next
      }
    }
    return false
  }

  /**
   * Wrap an async operation with the instance retry config (#202)
   */
  private async _withRetry<T>(fn: () => Promise<T>): Promise<T> {
    if (this._retryConfig) {
      return withRetry(fn, this._retryConfig)
    }
    return fn()
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
