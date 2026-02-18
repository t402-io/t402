/**
 * Bridge+Swap Strategy - Combines cross-chain bridge with swap
 *
 * For cases where the user has tokens on a different chain,
 * this strategy bridges tokens cross-chain and then swaps
 * to the target payment token if needed.
 */

import type {
  DefiStrategy,
  DefiStrategyParams,
  DefiStrategyResult,
  DefiEstimate,
  DefiStep,
} from '../types.js'
import { USDT0_ADDRESSES } from '../constants.js'

export interface BridgeSwapStrategyConfig {
  /** Bridge executor for cross-chain transfers */
  bridge?: {
    canBridge(fromChain: string, toChain: string): boolean
    getBridgeFee(params: {
      fromChain: string
      toChain: string
      amount: bigint
    }): Promise<{ nativeFee: bigint; estimatedTime: number }>
    executeBridge(params: {
      fromChain: string
      toChain: string
      amount: bigint
      recipient: string
    }): Promise<{ txHash: string; amountReceived: bigint }>
  }
  /** Source chains to check for balances */
  sourceChains?: string[]
}

/**
 * Bridge+Swap strategy implementation
 *
 * Bridges USDT0 from another chain to the target chain.
 */
export class BridgeSwapStrategy implements DefiStrategy {
  readonly name = 'bridge-swap'
  private config: BridgeSwapStrategyConfig

  constructor(config: BridgeSwapStrategyConfig = {}) {
    this.config = config
  }

  async canExecute(params: DefiStrategyParams): Promise<boolean> {
    if (!this.config.bridge) {
      return false
    }

    const sourceChains = this.config.sourceChains ?? []

    // Check if any source chain has USDT0 balance and can bridge
    for (const chain of sourceChains) {
      if (chain === params.targetNetwork) continue

      const usdt0Address = USDT0_ADDRESSES[chain]
      if (!usdt0Address) continue

      if (
        this.config.bridge.canBridge(chain, params.targetNetwork) &&
        (params.currentBalances[`${chain}:${usdt0Address}`] ?? 0n) >= params.targetAmount
      ) {
        return true
      }
    }

    return false
  }

  async estimate(params: DefiStrategyParams): Promise<DefiEstimate> {
    if (!this.config.bridge) {
      throw new Error('Bridge not configured for bridge-swap strategy')
    }

    const sourceChains = this.config.sourceChains ?? []

    for (const chain of sourceChains) {
      if (chain === params.targetNetwork) continue

      const usdt0Address = USDT0_ADDRESSES[chain]
      if (!usdt0Address) continue

      const balance = params.currentBalances[`${chain}:${usdt0Address}`] ?? 0n
      if (balance < params.targetAmount) continue

      if (!this.config.bridge.canBridge(chain, params.targetNetwork)) continue

      const fee = await this.config.bridge.getBridgeFee({
        fromChain: chain,
        toChain: params.targetNetwork,
        amount: params.targetAmount,
      })

      const steps: Omit<DefiStep, 'txHash'>[] = [
        {
          type: 'bridge',
          protocol: 'layerzero',
          fromToken: usdt0Address,
          toToken: params.targetToken,
          amount: params.targetAmount,
        },
      ]

      return {
        outputAmount: params.targetAmount,
        totalFees: fee.nativeFee,
        estimatedTime: fee.estimatedTime,
        steps,
      }
    }

    throw new Error('No viable bridge route found')
  }

  async execute(params: DefiStrategyParams): Promise<DefiStrategyResult> {
    if (!this.config.bridge) {
      throw new Error('Bridge not configured for bridge-swap strategy')
    }

    const sourceChains = this.config.sourceChains ?? []

    for (const chain of sourceChains) {
      if (chain === params.targetNetwork) continue

      const usdt0Address = USDT0_ADDRESSES[chain]
      if (!usdt0Address) continue

      const balance = params.currentBalances[`${chain}:${usdt0Address}`] ?? 0n
      if (balance < params.targetAmount) continue

      if (!this.config.bridge.canBridge(chain, params.targetNetwork)) continue

      const result = await this.config.bridge.executeBridge({
        fromChain: chain,
        toChain: params.targetNetwork,
        amount: params.targetAmount,
        recipient: '', // Will use default wallet address
      })

      return {
        txHashes: [result.txHash],
        outputToken: params.targetToken,
        outputAmount: result.amountReceived,
        fees: 0n,
        steps: [
          {
            type: 'bridge',
            protocol: 'layerzero',
            fromToken: usdt0Address,
            toToken: params.targetToken,
            amount: params.targetAmount,
            txHash: result.txHash,
          },
        ],
      }
    }

    throw new Error('No viable bridge route found')
  }
}

/**
 * Create a bridge-swap strategy
 */
export function createBridgeSwapStrategy(
  config?: BridgeSwapStrategyConfig,
): BridgeSwapStrategy {
  return new BridgeSwapStrategy(config)
}
