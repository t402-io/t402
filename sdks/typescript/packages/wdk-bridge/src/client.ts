/**
 * WDK Bridge Client
 *
 * Multi-chain USDT0 bridging with automatic source chain selection
 * and fee-optimized routing for Tether WDK accounts.
 *
 * @example
 * ```typescript
 * import { WdkBridgeClient } from '@t402/wdk-bridge';
 *
 * // Create client with WDK accounts for multiple chains
 * const bridge = new WdkBridgeClient({
 *   accounts: {
 *     ethereum: ethereumWdkAccount,
 *     arbitrum: arbitrumWdkAccount,
 *   },
 *   defaultStrategy: 'cheapest',
 * });
 *
 * // Get balances across all chains
 * const summary = await bridge.getBalances();
 *
 * // Auto-bridge from the best source chain
 * const result = await bridge.autoBridge({
 *   toChain: 'ethereum',
 *   amount: 100_000000n, // 100 USDT0
 *   recipient: '0x...',
 * });
 *
 * // Wait for delivery
 * const delivery = await result.waitForDelivery();
 * ```
 */

import type { Address, Hex } from "viem";
import {
  Usdt0Bridge,
  LayerZeroScanClient,
  type BridgeSigner,
} from "@t402/evm";
import { WdkBridgeSigner, createWdkBridgeSigner } from "./signer.js";
import {
  BRIDGE_CHAINS,
  getUsdt0Address,
  getChainId,
  getEstimatedBridgeTime,
  supportsBridging,
  MIN_BRIDGE_AMOUNT,
  DEFAULT_SLIPPAGE,
} from "./constants.js";
import type {
  WdkAccount,
  WdkBridgeClientConfig,
  ChainBalance,
  BalanceSummary,
  BridgeRoute,
  AutoBridgeParams,
  WdkBridgeResult,
  DeliveryResult,
  WaitOptions,
  RouteStrategy,
  BridgeDeliveryStatus,
} from "./types.js";

/**
 * WDK Bridge Client
 *
 * Provides multi-chain USDT0 bridging with automatic source selection.
 */
export class WdkBridgeClient {
  private readonly accounts: Map<string, WdkAccount>;
  private readonly signers: Map<string, WdkBridgeSigner>;
  private readonly bridges: Map<string, Usdt0Bridge>;
  private readonly scanClient: LayerZeroScanClient;
  private readonly defaultStrategy: RouteStrategy;
  private readonly defaultSlippage: number;
  private readonly rpcUrls: Map<string, string>;

  /**
   * Create a new WDK bridge client
   *
   * @param config - Client configuration
   */
  constructor(config: WdkBridgeClientConfig) {
    this.accounts = new Map();
    this.signers = new Map();
    this.bridges = new Map();
    this.rpcUrls = new Map();
    this.scanClient = new LayerZeroScanClient();
    this.defaultStrategy = config.defaultStrategy ?? "cheapest";
    this.defaultSlippage = config.defaultSlippage ?? DEFAULT_SLIPPAGE;

    // Register accounts
    for (const [chain, account] of Object.entries(config.accounts)) {
      const normalizedChain = chain.toLowerCase();
      if (!supportsBridging(normalizedChain)) {
        throw new Error(
          `Chain "${chain}" does not support USDT0 bridging. ` +
            `Supported chains: ${BRIDGE_CHAINS.join(", ")}`,
        );
      }
      this.accounts.set(normalizedChain, account);
    }

    if (this.accounts.size === 0) {
      throw new Error("At least one WDK account must be provided");
    }
  }

  /**
   * Set RPC URL for a chain
   */
  setRpcUrl(chain: string, rpcUrl: string): void {
    this.rpcUrls.set(chain.toLowerCase(), rpcUrl);
  }

  /**
   * Get or create a signer for a chain
   */
  private async getSigner(chain: string): Promise<WdkBridgeSigner> {
    const normalizedChain = chain.toLowerCase();
    let signer = this.signers.get(normalizedChain);

    if (!signer) {
      const account = this.accounts.get(normalizedChain);
      if (!account) {
        throw new Error(`No WDK account configured for chain: ${chain}`);
      }

      const rpcUrl = this.rpcUrls.get(normalizedChain);
      signer = await createWdkBridgeSigner(account, normalizedChain, rpcUrl);
      this.signers.set(normalizedChain, signer);
    }

    return signer;
  }

  /**
   * Get or create a bridge for a chain
   */
  private async getBridge(chain: string): Promise<Usdt0Bridge> {
    const normalizedChain = chain.toLowerCase();
    let bridge = this.bridges.get(normalizedChain);

    if (!bridge) {
      const signer = await this.getSigner(normalizedChain);
      bridge = new Usdt0Bridge(signer as unknown as BridgeSigner, normalizedChain);
      this.bridges.set(normalizedChain, bridge);
    }

    return bridge;
  }

  /**
   * Get balance for a specific chain
   */
  async getChainBalance(chain: string): Promise<ChainBalance> {
    const normalizedChain = chain.toLowerCase();
    const account = this.accounts.get(normalizedChain);

    if (!account) {
      throw new Error(`No WDK account configured for chain: ${chain}`);
    }

    const usdt0Address = getUsdt0Address(normalizedChain);
    if (!usdt0Address) {
      throw new Error(`No USDT0 address for chain: ${chain}`);
    }

    const [usdt0Balance, nativeBalance] = await Promise.all([
      account.getTokenBalance(usdt0Address),
      account.getBalance(),
    ]);

    return {
      chain: normalizedChain,
      chainId: getChainId(normalizedChain)!,
      usdt0Balance,
      nativeBalance,
      canBridge: usdt0Balance >= MIN_BRIDGE_AMOUNT,
    };
  }

  /**
   * Get balances across all configured chains
   */
  async getBalances(): Promise<BalanceSummary> {
    const balancePromises = Array.from(this.accounts.keys()).map((chain) =>
      this.getChainBalance(chain),
    );

    const balances = await Promise.all(balancePromises);

    const totalUsdt0 = balances.reduce((sum, b) => sum + b.usdt0Balance, 0n);
    const chainsWithBalance = balances
      .filter((b) => b.usdt0Balance > 0n)
      .map((b) => b.chain);
    const bridgeableChains = balances
      .filter((b) => b.canBridge)
      .map((b) => b.chain);

    return {
      balances,
      totalUsdt0,
      chainsWithBalance,
      bridgeableChains,
    };
  }

  /**
   * Get available bridge routes for an amount to a destination
   */
  async getRoutes(
    toChain: string,
    amount: bigint,
  ): Promise<BridgeRoute[]> {
    const normalizedTo = toChain.toLowerCase();
    const routes: BridgeRoute[] = [];

    // Get balances for all configured chains except destination
    const sourceChains = Array.from(this.accounts.keys()).filter(
      (chain) => chain !== normalizedTo,
    );

    for (const fromChain of sourceChains) {
      try {
        const [balance, bridge] = await Promise.all([
          this.getChainBalance(fromChain),
          this.getBridge(fromChain),
        ]);

        // Check if chain has sufficient balance
        if (balance.usdt0Balance < amount) {
          routes.push({
            fromChain,
            toChain: normalizedTo,
            nativeFee: 0n,
            amountToSend: amount,
            minAmountToReceive: 0n,
            estimatedTime: getEstimatedBridgeTime(fromChain, normalizedTo),
            available: false,
            unavailableReason: `Insufficient USDT0 balance: ${balance.usdt0Balance} < ${amount}`,
          });
          continue;
        }

        // Get quote from bridge
        const signer = await this.getSigner(fromChain);
        const address = await signer.getAddress();
        const quote = await bridge.quote({
          fromChain,
          toChain: normalizedTo,
          amount,
          recipient: address,
        });

        // Check if has sufficient native for fee
        const hasNativeFee = balance.nativeBalance >= quote.nativeFee;

        routes.push({
          fromChain,
          toChain: normalizedTo,
          nativeFee: quote.nativeFee,
          amountToSend: amount,
          minAmountToReceive: quote.minAmountToReceive,
          estimatedTime: quote.estimatedTime,
          available: hasNativeFee,
          unavailableReason: hasNativeFee
            ? undefined
            : `Insufficient native balance for fee: ${balance.nativeBalance} < ${quote.nativeFee}`,
        });
      } catch (error) {
        routes.push({
          fromChain,
          toChain: normalizedTo,
          nativeFee: 0n,
          amountToSend: amount,
          minAmountToReceive: 0n,
          estimatedTime: getEstimatedBridgeTime(fromChain, normalizedTo),
          available: false,
          unavailableReason: `Failed to get quote: ${(error as Error).message}`,
        });
      }
    }

    return routes;
  }

  /**
   * Select the best route based on strategy
   */
  private selectBestRoute(
    routes: BridgeRoute[],
    strategy: RouteStrategy,
    preferredChain?: string,
  ): BridgeRoute | null {
    const availableRoutes = routes.filter((r) => r.available);

    if (availableRoutes.length === 0) {
      return null;
    }

    switch (strategy) {
      case "preferred":
        if (preferredChain) {
          const preferred = availableRoutes.find(
            (r) => r.fromChain === preferredChain.toLowerCase(),
          );
          if (preferred) return preferred;
        }
        // Fall through to cheapest if preferred not available
        return this.selectBestRoute(availableRoutes, "cheapest");

      case "fastest":
        return availableRoutes.reduce((best, route) =>
          route.estimatedTime < best.estimatedTime ? route : best,
        );

      case "cheapest":
      default:
        return availableRoutes.reduce((best, route) =>
          route.nativeFee < best.nativeFee ? route : best,
        );
    }
  }

  /**
   * Execute an auto-bridge with automatic source chain selection
   */
  async autoBridge(params: AutoBridgeParams): Promise<WdkBridgeResult> {
    const normalizedTo = params.toChain.toLowerCase();

    // Validate destination
    if (!supportsBridging(normalizedTo)) {
      throw new Error(
        `Destination chain "${params.toChain}" does not support USDT0 bridging. ` +
          `Supported chains: ${BRIDGE_CHAINS.join(", ")}`,
      );
    }

    // Validate amount
    if (params.amount < MIN_BRIDGE_AMOUNT) {
      throw new Error(
        `Amount ${params.amount} is below minimum: ${MIN_BRIDGE_AMOUNT}`,
      );
    }

    // Get available routes
    const routes = await this.getRoutes(normalizedTo, params.amount);

    // Select best route
    const strategy = params.preferredSourceChain ? "preferred" : this.defaultStrategy;
    const bestRoute = this.selectBestRoute(
      routes,
      strategy,
      params.preferredSourceChain,
    );

    if (!bestRoute) {
      const reasons = routes.map((r) => `${r.fromChain}: ${r.unavailableReason}`);
      throw new Error(
        `No available route to bridge ${params.amount} USDT0 to ${normalizedTo}.\n` +
          `Reasons:\n${reasons.join("\n")}`,
      );
    }

    // Execute bridge
    return this.bridge({
      fromChain: bestRoute.fromChain,
      toChain: normalizedTo,
      amount: params.amount,
      recipient: params.recipient,
      slippageTolerance: params.slippageTolerance ?? this.defaultSlippage,
    });
  }

  /**
   * Execute a bridge from a specific chain
   */
  async bridge(params: {
    fromChain: string;
    toChain: string;
    amount: bigint;
    recipient: Address;
    slippageTolerance?: number;
  }): Promise<WdkBridgeResult> {
    const normalizedFrom = params.fromChain.toLowerCase();
    const normalizedTo = params.toChain.toLowerCase();

    // Validate chains
    if (!this.accounts.has(normalizedFrom)) {
      throw new Error(`No WDK account configured for source chain: ${params.fromChain}`);
    }

    if (normalizedFrom === normalizedTo) {
      throw new Error("Source and destination chains must be different");
    }

    // Get bridge and execute
    const bridge = await this.getBridge(normalizedFrom);
    const result = await bridge.send({
      fromChain: normalizedFrom,
      toChain: normalizedTo,
      amount: params.amount,
      recipient: params.recipient,
      slippageTolerance: params.slippageTolerance ?? this.defaultSlippage,
    });

    // Create result with waitForDelivery wrapper
    const scanClient = this.scanClient;
    const wdkResult: WdkBridgeResult = {
      txHash: result.txHash,
      messageGuid: result.messageGuid,
      amountSent: result.amountSent,
      amountToReceive: result.amountToReceive,
      fromChain: result.fromChain,
      toChain: result.toChain,
      estimatedTime: result.estimatedTime,
      async waitForDelivery(options?: WaitOptions): Promise<DeliveryResult> {
        try {
          const message = await scanClient.waitForDelivery(result.messageGuid, {
            timeout: options?.timeout ?? 600_000,
            pollInterval: options?.pollInterval ?? 10_000,
            onStatusChange: options?.onStatusChange as (status: string) => void,
          });

          return {
            success: message.status === "DELIVERED",
            status: message.status as BridgeDeliveryStatus,
            dstTxHash: message.dstTxHash as Hex | undefined,
            srcTxHash: result.txHash,
            messageGuid: result.messageGuid,
          };
        } catch (error) {
          return {
            success: false,
            status: "FAILED" as BridgeDeliveryStatus,
            srcTxHash: result.txHash,
            messageGuid: result.messageGuid,
            error: (error as Error).message,
          };
        }
      },
    };

    return wdkResult;
  }

  /**
   * Get configured chains
   */
  getConfiguredChains(): string[] {
    return Array.from(this.accounts.keys());
  }

  /**
   * Check if a chain is configured
   */
  hasChain(chain: string): boolean {
    return this.accounts.has(chain.toLowerCase());
  }

  /**
   * Track a message by GUID
   */
  async trackMessage(guid: string) {
    return this.scanClient.getMessage(guid);
  }

  /**
   * Wait for a message to be delivered
   */
  async waitForDelivery(guid: string, options?: WaitOptions) {
    return this.scanClient.waitForDelivery(guid, {
      timeout: options?.timeout ?? 600_000,
      pollInterval: options?.pollInterval ?? 10_000,
      onStatusChange: options?.onStatusChange as (status: string) => void,
    });
  }
}

/**
 * Create a WDK bridge client
 */
export function createWdkBridgeClient(
  config: WdkBridgeClientConfig,
): WdkBridgeClient {
  return new WdkBridgeClient(config);
}
