/**
 * T402WDK - Main class for T402 integration with Tether WDK
 *
 * Provides a high-level API for:
 * - Multi-chain wallet management
 * - T402-compatible signers
 * - Balance aggregation
 * - Cross-chain bridging (USDT0)
 */

import type { Address } from "viem";
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
} from "./types.js";
import {
  normalizeChainConfig,
  CHAIN_TOKENS,
  USDT0_ADDRESSES,
  USDC_ADDRESSES,
  DEFAULT_RPC_ENDPOINTS,
} from "./chains.js";
import { WDKSigner, createWDKSigner } from "./signer.js";
import { supportsBridging, getBridgeableChains } from "@t402/evm";
import {
  WDKError,
  WDKInitializationError,
  ChainError,
  BridgeError,
  BalanceError,
  WDKErrorCode,
  wrapError,
  withRetry,
  isWDKError,
} from "./errors.js";

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
  private _wdk: WDKInstance | null = null;
  private _config: T402WDKConfig;
  private _normalizedChains: Map<string, NormalizedChainConfig> = new Map();
  private _seedPhrase: string;
  private _signerCache: Map<string, WDKSigner> = new Map();
  private _initializationError: Error | null = null;

  // WDK module references (set via registerWDK)
  private static _WDK: WDKConstructor | null = null;
  private static _WalletManagerEvm: unknown = null;
  private static _BridgeUsdt0Evm: unknown = null;

  /**
   * Register the Tether WDK modules
   *
   * This must be called before creating T402WDK instances if you want
   * to use the actual WDK. Otherwise, a mock implementation is used.
   *
   * @throws {WDKInitializationError} If registration fails
   *
   * @example
   * ```typescript
   * import WDK from '@tetherto/wdk';
   * import WalletManagerEvm from '@tetherto/wdk-wallet-evm';
   * import BridgeUsdt0Evm from '@tetherto/wdk-protocol-bridge-usdt0-evm';
   *
   * T402WDK.registerWDK(WDK, WalletManagerEvm, BridgeUsdt0Evm);
   * ```
   */
  static registerWDK(
    WDK: WDKConstructor,
    WalletManagerEvm?: unknown,
    BridgeUsdt0Evm?: unknown,
  ): void {
    if (!WDK) {
      throw new WDKInitializationError("WDK constructor is required");
    }

    if (typeof WDK !== "function") {
      throw new WDKInitializationError("WDK must be a constructor function");
    }

    T402WDK._WDK = WDK;
    T402WDK._WalletManagerEvm = WalletManagerEvm ?? null;
    T402WDK._BridgeUsdt0Evm = BridgeUsdt0Evm ?? null;
  }

  /**
   * Check if WDK is registered
   */
  static isWDKRegistered(): boolean {
    return T402WDK._WDK !== null;
  }

  /**
   * Check if wallet manager is registered
   */
  static isWalletManagerRegistered(): boolean {
    return T402WDK._WalletManagerEvm !== null;
  }

  /**
   * Check if bridge protocol is registered
   */
  static isBridgeRegistered(): boolean {
    return T402WDK._BridgeUsdt0Evm !== null;
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
        "WDK not registered. Call T402WDK.registerWDK() first, or use a mock seed phrase for testing.",
      );
    }

    try {
      return T402WDK._WDK.getRandomSeedPhrase();
    } catch (error) {
      throw new WDKInitializationError(
        `Failed to generate seed phrase: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error instanceof Error ? error : undefined },
      );
    }
  }

  /**
   * Create a new T402WDK instance
   *
   * @param seedPhrase - BIP-39 mnemonic seed phrase
   * @param config - Chain configuration (RPC endpoints)
   * @throws {WDKInitializationError} If seed phrase is invalid
   */
  constructor(seedPhrase: string, config: T402WDKConfig = {}) {
    // Validate seed phrase
    if (!seedPhrase || typeof seedPhrase !== "string") {
      throw new WDKInitializationError("Seed phrase is required and must be a string");
    }

    // Basic seed phrase validation (BIP-39 has 12, 15, 18, 21, or 24 words)
    const words = seedPhrase.trim().split(/\s+/);
    const validWordCounts = [12, 15, 18, 21, 24];
    if (!validWordCounts.includes(words.length)) {
      throw new WDKInitializationError(
        `Invalid seed phrase: expected 12, 15, 18, 21, or 24 words, got ${words.length}`,
        { context: { wordCount: words.length } },
      );
    }

    this._seedPhrase = seedPhrase;
    this._config = config;

    // Normalize chain configurations
    for (const [chain, chainConfig] of Object.entries(config)) {
      if (chainConfig) {
        try {
          this._normalizedChains.set(chain, normalizeChainConfig(chain, chainConfig));
        } catch (error) {
          throw new ChainError(
            WDKErrorCode.INVALID_CHAIN_CONFIG,
            `Invalid configuration for chain "${chain}": ${error instanceof Error ? error.message : String(error)}`,
            { chain, cause: error instanceof Error ? error : undefined },
          );
        }
      }
    }

    // Add default chains if not configured
    this._addDefaultChainsIfNeeded();

    // Initialize WDK if registered
    if (T402WDK._WDK) {
      this._initializeWDK();
    }
  }

  /**
   * Add default chain configurations for common chains
   */
  private _addDefaultChainsIfNeeded(): void {
    // Add Arbitrum as default if no chains configured (USDT0 hub)
    if (this._normalizedChains.size === 0) {
      const defaultEndpoint = DEFAULT_RPC_ENDPOINTS.arbitrum;
      if (defaultEndpoint) {
        this._normalizedChains.set(
          "arbitrum",
          normalizeChainConfig("arbitrum", defaultEndpoint),
        );
      }
    }
  }

  /**
   * Initialize the underlying WDK instance
   */
  private _initializeWDK(): void {
    if (!T402WDK._WDK) {
      this._initializationError = new WDKInitializationError("WDK not registered");
      return;
    }

    if (!T402WDK._WalletManagerEvm) {
      this._initializationError = new WDKInitializationError(
        "WalletManagerEvm not registered. Call T402WDK.registerWDK(WDK, WalletManagerEvm) to enable wallet functionality.",
      );
      return;
    }

    try {
      let wdk = new T402WDK._WDK(this._seedPhrase);

      // Register EVM wallets for each configured chain
      for (const [chain, config] of this._normalizedChains) {
        try {
          wdk = wdk.registerWallet(chain, T402WDK._WalletManagerEvm, {
            provider: config.provider,
            chainId: config.chainId,
          });
        } catch (error) {
          throw new ChainError(
            WDKErrorCode.CHAIN_NOT_SUPPORTED,
            `Failed to register wallet for chain "${chain}": ${error instanceof Error ? error.message : String(error)}`,
            { chain, cause: error instanceof Error ? error : undefined },
          );
        }
      }

      // Register USDT0 bridge protocol if available
      if (T402WDK._BridgeUsdt0Evm) {
        try {
          wdk = wdk.registerProtocol("bridge-usdt0", T402WDK._BridgeUsdt0Evm);
        } catch (error) {
          // Bridge registration failure is non-fatal, just log it
          console.warn(
            `Failed to register USDT0 bridge protocol: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      this._wdk = wdk;
      this._initializationError = null;
    } catch (error) {
      this._initializationError = error instanceof Error ? error : new Error(String(error));
      this._wdk = null;
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
          );
    }

    if (!this._wdk) {
      throw new WDKInitializationError(
        "WDK not initialized. Call T402WDK.registerWDK() before creating instances.",
      );
    }
    return this._wdk;
  }

  /**
   * Check if WDK is properly initialized
   */
  get isInitialized(): boolean {
    return this._wdk !== null && this._initializationError === null;
  }

  /**
   * Get initialization error if any
   */
  get initializationError(): Error | null {
    return this._initializationError;
  }

  /**
   * Get all configured chains
   */
  getConfiguredChains(): string[] {
    return Array.from(this._normalizedChains.keys());
  }

  /**
   * Get chain configuration
   */
  getChainConfig(chain: string): NormalizedChainConfig | undefined {
    return this._normalizedChains.get(chain);
  }

  /**
   * Check if a chain is configured
   */
  isChainConfigured(chain: string): boolean {
    return this._normalizedChains.has(chain);
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
    if (!chain || typeof chain !== "string") {
      throw new ChainError(
        WDKErrorCode.CHAIN_NOT_CONFIGURED,
        "Chain name is required and must be a string",
        { chain },
      );
    }

    const cacheKey = `${chain}:${accountIndex}`;

    // Return cached signer if available
    const cached = this._signerCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Validate chain is configured
    if (!this._normalizedChains.has(chain)) {
      const availableChains = this.getConfiguredChains();
      throw new ChainError(
        WDKErrorCode.CHAIN_NOT_CONFIGURED,
        `Chain "${chain}" not configured. Available chains: ${availableChains.length > 0 ? availableChains.join(", ") : "(none)"}`,
        { chain, context: { availableChains } },
      );
    }

    try {
      const signer = await createWDKSigner(this.wdk, chain, accountIndex);
      this._signerCache.set(cacheKey, signer);
      return signer;
    } catch (error) {
      // Re-throw WDK errors as-is
      if (isWDKError(error)) {
        throw error;
      }

      throw wrapError(
        error,
        WDKErrorCode.SIGNER_NOT_INITIALIZED,
        `Failed to create signer for chain "${chain}"`,
        { chain, accountIndex },
      );
    }
  }

  /**
   * Clear the signer cache
   * Useful for forcing re-initialization of signers
   */
  clearSignerCache(): void {
    this._signerCache.clear();
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
    const signer = await this.getSigner(chain, accountIndex);
    return signer.address;
  }

  /**
   * Get USDT0 balance for a chain
   *
   * @throws {BalanceError} If balance fetch fails
   */
  async getUsdt0Balance(chain: string, accountIndex = 0): Promise<bigint> {
    const usdt0Address = USDT0_ADDRESSES[chain];
    if (!usdt0Address) {
      return 0n;
    }

    try {
      const signer = await this.getSigner(chain, accountIndex);
      return await signer.getTokenBalance(usdt0Address);
    } catch (error) {
      // Return 0 for balance errors (chain might not support USDT0)
      if (isWDKError(error) && error.code === WDKErrorCode.TOKEN_BALANCE_FETCH_FAILED) {
        return 0n;
      }
      throw error;
    }
  }

  /**
   * Get USDC balance for a chain
   *
   * @throws {BalanceError} If balance fetch fails
   */
  async getUsdcBalance(chain: string, accountIndex = 0): Promise<bigint> {
    const usdcAddress = USDC_ADDRESSES[chain];
    if (!usdcAddress) {
      return 0n;
    }

    try {
      const signer = await this.getSigner(chain, accountIndex);
      return await signer.getTokenBalance(usdcAddress);
    } catch (error) {
      // Return 0 for balance errors (chain might not support USDC)
      if (isWDKError(error) && error.code === WDKErrorCode.TOKEN_BALANCE_FETCH_FAILED) {
        return 0n;
      }
      throw error;
    }
  }

  /**
   * Get all token balances for a chain
   *
   * @throws {ChainError} If chain is not configured
   * @throws {BalanceError} If balance fetch fails
   */
  async getChainBalances(chain: string, accountIndex = 0): Promise<ChainBalance> {
    const config = this._normalizedChains.get(chain);
    if (!config) {
      throw new ChainError(
        WDKErrorCode.CHAIN_NOT_CONFIGURED,
        `Chain "${chain}" not configured`,
        { chain },
      );
    }

    try {
      const signer = await this.getSigner(chain, accountIndex);
      const tokens = CHAIN_TOKENS[chain] || [];

      // Fetch all token balances in parallel with error handling
      const tokenBalanceResults = await Promise.allSettled(
        tokens.map(async (token) => {
          const balance = await signer.getTokenBalance(token.address);
          return {
            token: token.address,
            symbol: token.symbol,
            balance,
            formatted: formatTokenAmount(balance, token.decimals),
            decimals: token.decimals,
          };
        }),
      );

      // Extract successful results, use 0 for failed ones
      const tokenBalances: TokenBalance[] = tokenBalanceResults.map((result, index) => {
        if (result.status === "fulfilled") {
          return result.value;
        }
        // Return zero balance for failed fetches
        const token = tokens[index];
        return {
          token: token.address,
          symbol: token.symbol,
          balance: 0n,
          formatted: "0",
          decimals: token.decimals,
        };
      });

      // Get native balance
      let nativeBalance: bigint;
      try {
        nativeBalance = await signer.getBalance();
      } catch {
        nativeBalance = 0n;
      }

      return {
        chain,
        network: config.network,
        native: nativeBalance,
        tokens: tokenBalances,
      };
    } catch (error) {
      if (isWDKError(error)) {
        throw error;
      }

      throw new BalanceError(
        WDKErrorCode.BALANCE_FETCH_FAILED,
        `Failed to get balances for chain "${chain}": ${error instanceof Error ? error.message : String(error)}`,
        { chain, cause: error instanceof Error ? error : undefined },
      );
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
    const { continueOnError = true } = options;
    const chains = this.getConfiguredChains();

    // Fetch all chain balances in parallel
    const results = await Promise.allSettled(
      chains.map((chain) => this.getChainBalances(chain, accountIndex)),
    );

    const chainBalances: ChainBalance[] = [];
    const errors: Error[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === "fulfilled") {
        chainBalances.push(result.value);
      } else {
        errors.push(result.reason);
        if (!continueOnError) {
          throw result.reason;
        }
        // Add empty balance for failed chain
        const config = this._normalizedChains.get(chains[i]);
        if (config) {
          chainBalances.push({
            chain: chains[i],
            network: config.network,
            native: 0n,
            tokens: [],
          });
        }
      }
    }

    // Calculate totals
    let totalUsdt0 = 0n;
    let totalUsdc = 0n;

    for (const chainBalance of chainBalances) {
      for (const token of chainBalance.tokens) {
        if (token.symbol === "USDT0") {
          totalUsdt0 += token.balance;
        } else if (token.symbol === "USDC") {
          totalUsdc += token.balance;
        }
      }
    }

    return {
      totalUsdt0,
      totalUsdc,
      chains: chainBalances,
    };
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
    preferredToken: "USDT0" | "USDC" = "USDT0",
  ): Promise<{ chain: string; token: string; balance: bigint } | null> {
    // Validate amount
    if (amount <= 0n) {
      return null;
    }

    try {
      const balances = await this.getAggregatedBalances(0, { continueOnError: true });

      // Priority order based on preferred token
      const tokenPriority = preferredToken === "USDT0" ? ["USDT0", "USDC"] : ["USDC", "USDT0"];

      for (const tokenSymbol of tokenPriority) {
        for (const chainBalance of balances.chains) {
          const tokenBalance = chainBalance.tokens.find((t) => t.symbol === tokenSymbol);
          if (tokenBalance && tokenBalance.balance >= amount) {
            return {
              chain: chainBalance.chain,
              token: tokenSymbol,
              balance: tokenBalance.balance,
            };
          }
        }
      }

      return null;
    } catch (error) {
      if (isWDKError(error)) {
        throw error;
      }

      throw new BalanceError(
        WDKErrorCode.BALANCE_FETCH_FAILED,
        `Failed to find best chain for payment: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error instanceof Error ? error : undefined, context: { amount: amount.toString() } },
      );
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
        "USDT0 bridge not available. Register BridgeUsdt0Evm with T402WDK.registerWDK().",
        { fromChain: params.fromChain, toChain: params.toChain },
      );
    }

    // Validate parameters
    if (!params.fromChain || !params.toChain) {
      throw new BridgeError(
        WDKErrorCode.BRIDGE_FAILED,
        "Both fromChain and toChain are required",
        { fromChain: params.fromChain, toChain: params.toChain },
      );
    }

    if (params.fromChain === params.toChain) {
      throw new BridgeError(
        WDKErrorCode.BRIDGE_NOT_SUPPORTED,
        "Cannot bridge to the same chain",
        { fromChain: params.fromChain, toChain: params.toChain },
      );
    }

    if (!params.amount || params.amount <= 0n) {
      throw new BridgeError(
        WDKErrorCode.BRIDGE_FAILED,
        "Amount must be greater than 0",
        { fromChain: params.fromChain, toChain: params.toChain, context: { amount: params.amount?.toString() } },
      );
    }

    // Check if bridging is supported
    if (!this.canBridge(params.fromChain, params.toChain)) {
      throw new BridgeError(
        WDKErrorCode.BRIDGE_NOT_SUPPORTED,
        `Bridging from "${params.fromChain}" to "${params.toChain}" is not supported`,
        { fromChain: params.fromChain, toChain: params.toChain },
      );
    }

    try {
      const recipient = params.recipient ?? (await this.getAddress(params.toChain));

      const result = await this.wdk.executeProtocol("bridge-usdt0", {
        fromChain: params.fromChain,
        toChain: params.toChain,
        amount: params.amount,
        recipient,
      });

      if (!result || !result.txHash) {
        throw new BridgeError(
          WDKErrorCode.BRIDGE_FAILED,
          "Bridge transaction did not return a transaction hash",
          { fromChain: params.fromChain, toChain: params.toChain },
        );
      }

      return {
        txHash: result.txHash,
        estimatedTime: 300, // ~5 minutes typical for LayerZero
      };
    } catch (error) {
      if (error instanceof BridgeError) {
        throw error;
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
      );
    }
  }

  /**
   * Get chains that support USDT0
   */
  getUsdt0Chains(): string[] {
    return this.getConfiguredChains().filter((chain) => USDT0_ADDRESSES[chain]);
  }

  /**
   * Get chains that support USDT0 bridging
   *
   * Returns configured chains that have LayerZero OFT bridge support.
   */
  getBridgeableChains(): string[] {
    return this.getConfiguredChains().filter((chain) => supportsBridging(chain));
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
    );
  }

  /**
   * Get all possible bridge destinations from a chain
   */
  getBridgeDestinations(fromChain: string): string[] {
    if (!supportsBridging(fromChain)) {
      return [];
    }
    return getBridgeableChains().filter((chain) => chain !== fromChain);
  }
}

/**
 * Format token amount for display
 */
function formatTokenAmount(amount: bigint, decimals: number): string {
  if (amount === 0n) {
    return "0";
  }

  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;

  if (fraction === 0n) {
    return whole.toString();
  }

  const fractionStr = fraction.toString().padStart(decimals, "0");
  // Trim trailing zeros
  const trimmed = fractionStr.replace(/0+$/, "");
  return `${whole}.${trimmed}`;
}
