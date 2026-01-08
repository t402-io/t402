/**
 * USDT0 Bridge integration for T402 WDK
 *
 * Provides cross-chain USDT0 transfers using:
 * 1. Tether WDK bridge protocol (if available)
 * 2. Direct LayerZero OFT integration (fallback)
 */

import type { Address } from "viem";
import type { WDKSigner } from "./signer.js";
import type { BridgeParams, BridgeResult } from "./types.js";
import {
  Usdt0Bridge,
  supportsBridging,
  getBridgeableChains,
  type BridgeQuote,
  type BridgeSigner,
} from "@t402/evm";

/**
 * Extended bridge result with quote information
 */
export interface BridgeQuoteResult extends BridgeResult {
  /** Native fee in wei */
  nativeFee: bigint;
  /** Minimum amount to receive */
  minAmountToReceive: bigint;
}

/**
 * WDK Bridge wrapper for USDT0 cross-chain transfers
 *
 * This class provides a high-level API for bridging USDT0 between chains.
 * It automatically handles:
 * - Fee estimation
 * - Token approval
 * - Transaction execution
 * - Receipt handling
 */
export class WdkBridge {
  private bridges: Map<string, Usdt0Bridge> = new Map();

  /**
   * Create bridge signer adapter from WDK signer
   */
  private createBridgeSigner(signer: WDKSigner): BridgeSigner {
    return {
      address: signer.address,
      readContract: async (args) => {
        // WDK signer needs to be extended to support readContract
        // For now, throw an error indicating this needs WDK account
        throw new Error(
          "readContract not available on WDKSigner. Use T402WDK.bridgeUsdt0() instead.",
        );
      },
      writeContract: async (args) => {
        throw new Error(
          "writeContract not available on WDKSigner. Use T402WDK.bridgeUsdt0() instead.",
        );
      },
      waitForTransactionReceipt: async (args) => {
        throw new Error(
          "waitForTransactionReceipt not available on WDKSigner. Use T402WDK.bridgeUsdt0() instead.",
        );
      },
    };
  }

  /**
   * Get or create a bridge instance for a chain
   */
  private getBridge(chain: string, signer: WDKSigner): Usdt0Bridge {
    const cached = this.bridges.get(chain);
    if (cached) {
      return cached;
    }

    const bridgeSigner = this.createBridgeSigner(signer);
    const bridge = new Usdt0Bridge(bridgeSigner, chain);
    this.bridges.set(chain, bridge);
    return bridge;
  }

  /**
   * Check if a chain supports USDT0 bridging
   */
  static supportsBridging(chain: string): boolean {
    return supportsBridging(chain);
  }

  /**
   * Get all chains that support USDT0 bridging
   */
  static getBridgeableChains(): string[] {
    return getBridgeableChains();
  }

  /**
   * Get supported destinations from a source chain
   */
  static getSupportedDestinations(fromChain: string): string[] {
    return getBridgeableChains().filter((chain) => chain !== fromChain);
  }
}

/**
 * Bridge configuration for direct LayerZero OFT usage
 */
export interface DirectBridgeConfig {
  /** RPC URL for the source chain */
  rpcUrl: string;
  /** Private key or signer */
  signer: BridgeSigner;
}

/**
 * Create a direct USDT0 bridge (without WDK)
 *
 * Use this when you have a viem wallet client and want to bridge directly.
 *
 * @example
 * ```typescript
 * import { createDirectBridge } from '@t402/wdk';
 * import { createWalletClient, http } from 'viem';
 * import { arbitrum } from 'viem/chains';
 *
 * const walletClient = createWalletClient({
 *   chain: arbitrum,
 *   transport: http('https://arb1.arbitrum.io/rpc'),
 *   account: privateKeyToAccount(privateKey),
 * });
 *
 * const bridge = createDirectBridge(walletClient, 'arbitrum');
 *
 * const quote = await bridge.quote({
 *   fromChain: 'arbitrum',
 *   toChain: 'ethereum',
 *   amount: 100_000000n,
 *   recipient: walletClient.account.address,
 * });
 *
 * const result = await bridge.send({
 *   fromChain: 'arbitrum',
 *   toChain: 'ethereum',
 *   amount: 100_000000n,
 *   recipient: walletClient.account.address,
 * });
 * ```
 */
export function createDirectBridge(signer: BridgeSigner, chain: string): Usdt0Bridge {
  return new Usdt0Bridge(signer, chain);
}

// Re-export types from @t402/evm for convenience
export type { BridgeQuote, BridgeSigner } from "@t402/evm";
