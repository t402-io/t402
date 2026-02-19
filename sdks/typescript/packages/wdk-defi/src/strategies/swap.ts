/**
 * Swap Strategy - Uses Velora for ERC-20 to USDT0 swaps
 *
 * Checks if the user holds any swappable token and converts it
 * to the target payment token via the Velora DEX aggregator.
 */

import type {
  DefiStrategy,
  DefiStrategyParams,
  DefiStrategyResult,
  DefiEstimate,
  DefiStep,
} from '../types.js'
import { DEFAULT_MAX_SLIPPAGE, SUPPORTED_SWAP_TOKENS } from '../constants.js'

export interface SwapStrategyConfig {
  /** WDK instance for executing swaps */
  wdk?: {
    canSwap(): boolean
    getSwapQuote(
      chain: string,
      fromToken: string,
      amount: bigint,
    ): Promise<{
      outputAmount: bigint
      fee: bigint
      route: string[]
    }>
    swapAndPay(params: {
      chain: string
      fromToken: string
      amount: bigint
      maxSlippage?: number
    }): Promise<{
      txHash: string
      outputAmount: bigint
    }>
  }
  /** Maximum acceptable slippage */
  maxSlippage?: number
}

/**
 * Swap strategy implementation
 *
 * Swaps any supported ERC-20 token to USDT0 on the same chain.
 */
export class SwapStrategy implements DefiStrategy {
  readonly name = 'swap'
  private config: SwapStrategyConfig

  constructor(config: SwapStrategyConfig = {}) {
    this.config = config
  }

  async canExecute(params: DefiStrategyParams): Promise<boolean> {
    if (!this.config.wdk?.canSwap()) {
      return false
    }

    // Check if any available token has sufficient balance for a swap
    const chainTokens = SUPPORTED_SWAP_TOKENS[params.targetNetwork]
    if (!chainTokens) return false

    for (const tokenAddress of Object.values(chainTokens)) {
      if (
        params.availableTokens.includes(tokenAddress) &&
        (params.currentBalances[tokenAddress] ?? 0n) > 0n
      ) {
        return true
      }
    }

    return false
  }

  async estimate(params: DefiStrategyParams): Promise<DefiEstimate> {
    if (!this.config.wdk) {
      throw new Error('WDK not configured for swap strategy')
    }

    const chainTokens = SUPPORTED_SWAP_TOKENS[params.targetNetwork]
    if (!chainTokens) {
      throw new Error(`No swappable tokens on ${params.targetNetwork}`)
    }

    // Find best token to swap from
    for (const [, tokenAddress] of Object.entries(chainTokens)) {
      const balance = params.currentBalances[tokenAddress] ?? 0n
      if (balance <= 0n) continue

      const quote = await this.config.wdk.getSwapQuote(params.targetNetwork, tokenAddress, balance)

      if (quote.outputAmount >= params.targetAmount) {
        const steps: Omit<DefiStep, 'txHash'>[] = [
          {
            type: 'swap',
            protocol: 'velora',
            fromToken: tokenAddress,
            toToken: params.targetToken,
            amount: balance,
          },
        ]

        return {
          outputAmount: quote.outputAmount,
          totalFees: quote.fee,
          estimatedTime: 30,
          steps,
        }
      }
    }

    throw new Error('No swappable token with sufficient balance found')
  }

  async execute(params: DefiStrategyParams): Promise<DefiStrategyResult> {
    if (!this.config.wdk) {
      throw new Error('WDK not configured for swap strategy')
    }

    const chainTokens = SUPPORTED_SWAP_TOKENS[params.targetNetwork]
    if (!chainTokens) {
      throw new Error(`No swappable tokens on ${params.targetNetwork}`)
    }

    // Find best token to swap from
    for (const [, tokenAddress] of Object.entries(chainTokens)) {
      const balance = params.currentBalances[tokenAddress] ?? 0n
      if (balance <= 0n) continue

      const result = await this.config.wdk.swapAndPay({
        chain: params.targetNetwork,
        fromToken: tokenAddress,
        amount: balance,
        maxSlippage: this.config.maxSlippage ?? DEFAULT_MAX_SLIPPAGE,
      })

      return {
        txHashes: [result.txHash],
        outputToken: params.targetToken,
        outputAmount: result.outputAmount,
        fees: 0n,
        steps: [
          {
            type: 'swap',
            protocol: 'velora',
            fromToken: tokenAddress,
            toToken: params.targetToken,
            amount: balance,
            txHash: result.txHash,
          },
        ],
      }
    }

    throw new Error('No swappable token with sufficient balance found')
  }
}

/**
 * Create a swap strategy
 */
export function createSwapStrategy(config?: SwapStrategyConfig): SwapStrategy {
  return new SwapStrategy(config)
}
