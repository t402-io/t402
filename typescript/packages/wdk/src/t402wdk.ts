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
   * Generate a new random seed phrase
   *
   * @returns A new BIP-39 mnemonic seed phrase
   */
  static generateSeedPhrase(): string {
    if (!T402WDK._WDK) {
      throw new Error(
        "WDK not registered. Call T402WDK.registerWDK() first, or use a mock seed phrase for testing.",
      );
    }
    return T402WDK._WDK.getRandomSeedPhrase();
  }

  /**
   * Create a new T402WDK instance
   *
   * @param seedPhrase - BIP-39 mnemonic seed phrase
   * @param config - Chain configuration (RPC endpoints)
   */
  constructor(seedPhrase: string, config: T402WDKConfig = {}) {
    this._seedPhrase = seedPhrase;
    this._config = config;

    // Normalize chain configurations
    for (const [chain, chainConfig] of Object.entries(config)) {
      if (chainConfig) {
        this._normalizedChains.set(chain, normalizeChainConfig(chain, chainConfig));
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
    if (!T402WDK._WDK || !T402WDK._WalletManagerEvm) {
      return;
    }

    let wdk = new T402WDK._WDK(this._seedPhrase);

    // Register EVM wallets for each configured chain
    for (const [chain, config] of this._normalizedChains) {
      wdk = wdk.registerWallet(chain, T402WDK._WalletManagerEvm, {
        provider: config.provider,
        chainId: config.chainId,
      });
    }

    // Register USDT0 bridge protocol if available
    if (T402WDK._BridgeUsdt0Evm) {
      wdk = wdk.registerProtocol("bridge-usdt0", T402WDK._BridgeUsdt0Evm);
    }

    this._wdk = wdk;
  }

  /**
   * Get the underlying WDK instance
   *
   * @throws If WDK is not registered
   */
  get wdk(): WDKInstance {
    if (!this._wdk) {
      throw new Error(
        "WDK not initialized. Call T402WDK.registerWDK() before creating instances.",
      );
    }
    return this._wdk;
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
   * Get a T402-compatible signer for a chain
   *
   * @param chain - Chain name (e.g., "arbitrum", "ethereum")
   * @param accountIndex - HD wallet account index (default: 0)
   * @returns An initialized WDKSigner
   */
  async getSigner(chain: string, accountIndex = 0): Promise<WDKSigner> {
    const cacheKey = `${chain}:${accountIndex}`;

    // Return cached signer if available
    const cached = this._signerCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Validate chain is configured
    if (!this._normalizedChains.has(chain)) {
      throw new Error(
        `Chain "${chain}" not configured. Available chains: ${this.getConfiguredChains().join(", ")}`,
      );
    }

    const signer = await createWDKSigner(this.wdk, chain, accountIndex);
    this._signerCache.set(cacheKey, signer);

    return signer;
  }

  /**
   * Get wallet address for a chain
   *
   * @param chain - Chain name
   * @param accountIndex - HD wallet account index (default: 0)
   */
  async getAddress(chain: string, accountIndex = 0): Promise<Address> {
    const signer = await this.getSigner(chain, accountIndex);
    return signer.address;
  }

  /**
   * Get USDT0 balance for a chain
   */
  async getUsdt0Balance(chain: string, accountIndex = 0): Promise<bigint> {
    const usdt0Address = USDT0_ADDRESSES[chain];
    if (!usdt0Address) {
      return 0n;
    }

    const signer = await this.getSigner(chain, accountIndex);
    return signer.getTokenBalance(usdt0Address);
  }

  /**
   * Get USDC balance for a chain
   */
  async getUsdcBalance(chain: string, accountIndex = 0): Promise<bigint> {
    const usdcAddress = USDC_ADDRESSES[chain];
    if (!usdcAddress) {
      return 0n;
    }

    const signer = await this.getSigner(chain, accountIndex);
    return signer.getTokenBalance(usdcAddress);
  }

  /**
   * Get all token balances for a chain
   */
  async getChainBalances(chain: string, accountIndex = 0): Promise<ChainBalance> {
    const config = this._normalizedChains.get(chain);
    if (!config) {
      throw new Error(`Chain "${chain}" not configured`);
    }

    const signer = await this.getSigner(chain, accountIndex);
    const tokens = CHAIN_TOKENS[chain] || [];

    const tokenBalances: TokenBalance[] = await Promise.all(
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

    return {
      chain,
      network: config.network,
      native: await signer.getBalance(),
      tokens: tokenBalances,
    };
  }

  /**
   * Get aggregated balances across all configured chains
   */
  async getAggregatedBalances(accountIndex = 0): Promise<AggregatedBalance> {
    const chains = this.getConfiguredChains();

    const chainBalances = await Promise.all(
      chains.map((chain) => this.getChainBalances(chain, accountIndex)),
    );

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
   */
  async findBestChainForPayment(
    amount: bigint,
    preferredToken: "USDT0" | "USDC" = "USDT0",
  ): Promise<{ chain: string; token: string; balance: bigint } | null> {
    const balances = await this.getAggregatedBalances();

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
  }

  /**
   * Bridge USDT0 between chains
   *
   * Uses LayerZero OFT for cross-chain transfers.
   *
   * @param params - Bridge parameters
   * @returns Bridge result with transaction hash
   */
  async bridgeUsdt0(params: BridgeParams): Promise<BridgeResult> {
    if (!T402WDK._BridgeUsdt0Evm) {
      throw new Error(
        "USDT0 bridge not available. Register BridgeUsdt0Evm with T402WDK.registerWDK().",
      );
    }

    const recipient = params.recipient ?? (await this.getAddress(params.toChain));

    const result = await this.wdk.executeProtocol("bridge-usdt0", {
      fromChain: params.fromChain,
      toChain: params.toChain,
      amount: params.amount,
      recipient,
    });

    return {
      txHash: result.txHash,
      estimatedTime: 300, // ~5 minutes typical for LayerZero
    };
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
