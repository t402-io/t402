/**
 * Borrow Strategy - Uses Aave V3 to borrow USDT against collateral
 *
 * Allows users to borrow the payment token instead of spending
 * their existing holdings. Useful for users who want to maintain
 * their positions while making payments.
 */

import type {
  DefiStrategy,
  DefiStrategyParams,
  DefiStrategyResult,
  DefiEstimate,
  DefiStep,
} from '../types.js'
import { AAVE_V3_POOL_ADDRESSES } from '../constants.js'

export interface BorrowStrategyConfig {
  /** Aave protocol executor */
  aaveProtocol?: {
    getAvailableBorrowAmount(
      chain: string,
      collateralToken: string,
      collateralAmount: bigint,
    ): Promise<{ borrowable: bigint; healthFactor: number }>
    borrow(params: {
      chain: string
      borrowToken: string
      amount: bigint
      collateralToken: string
      interestRateMode: number
    }): Promise<{ txHash: string; borrowedAmount: bigint }>
  }
  /** Minimum health factor to maintain (default: 1.5) */
  minHealthFactor?: number
}

/**
 * Borrow strategy implementation
 *
 * Borrows payment tokens against existing collateral on Aave V3.
 */
export class BorrowStrategy implements DefiStrategy {
  readonly name = 'borrow'
  private config: BorrowStrategyConfig

  constructor(config: BorrowStrategyConfig = {}) {
    this.config = config
  }

  async canExecute(params: DefiStrategyParams): Promise<boolean> {
    if (!this.config.aaveProtocol) {
      return false
    }

    // Check if Aave is supported on the target network
    if (!AAVE_V3_POOL_ADDRESSES[params.targetNetwork]) {
      return false
    }

    // Check if user has any collateral tokens
    return params.availableTokens.some((token) => (params.currentBalances[token] ?? 0n) > 0n)
  }

  async estimate(params: DefiStrategyParams): Promise<DefiEstimate> {
    if (!this.config.aaveProtocol) {
      throw new Error('Aave protocol not configured for borrow strategy')
    }

    const minHealthFactor = this.config.minHealthFactor ?? 1.5

    // Find best collateral token
    for (const tokenAddress of params.availableTokens) {
      const balance = params.currentBalances[tokenAddress] ?? 0n
      if (balance <= 0n) continue

      const result = await this.config.aaveProtocol.getAvailableBorrowAmount(
        params.targetNetwork,
        tokenAddress,
        balance,
      )

      if (result.borrowable >= params.targetAmount && result.healthFactor >= minHealthFactor) {
        const steps: Omit<DefiStep, 'txHash'>[] = [
          {
            type: 'approve',
            protocol: 'aave-v3',
            fromToken: tokenAddress,
            toToken: tokenAddress,
            amount: balance,
          },
          {
            type: 'borrow',
            protocol: 'aave-v3',
            fromToken: tokenAddress,
            toToken: params.targetToken,
            amount: params.targetAmount,
          },
        ]

        return {
          outputAmount: params.targetAmount,
          totalFees: 0n, // Interest accrues over time, not upfront
          estimatedTime: 60,
          steps,
        }
      }
    }

    throw new Error('No suitable collateral found for borrowing')
  }

  async execute(params: DefiStrategyParams): Promise<DefiStrategyResult> {
    if (!this.config.aaveProtocol) {
      throw new Error('Aave protocol not configured for borrow strategy')
    }

    const minHealthFactor = this.config.minHealthFactor ?? 1.5

    for (const tokenAddress of params.availableTokens) {
      const balance = params.currentBalances[tokenAddress] ?? 0n
      if (balance <= 0n) continue

      const available = await this.config.aaveProtocol.getAvailableBorrowAmount(
        params.targetNetwork,
        tokenAddress,
        balance,
      )

      if (
        available.borrowable >= params.targetAmount &&
        available.healthFactor >= minHealthFactor
      ) {
        const result = await this.config.aaveProtocol.borrow({
          chain: params.targetNetwork,
          borrowToken: params.targetToken,
          amount: params.targetAmount,
          collateralToken: tokenAddress,
          interestRateMode: 2, // Variable rate
        })

        return {
          txHashes: [result.txHash],
          outputToken: params.targetToken,
          outputAmount: result.borrowedAmount,
          fees: 0n,
          steps: [
            {
              type: 'borrow',
              protocol: 'aave-v3',
              fromToken: tokenAddress,
              toToken: params.targetToken,
              amount: params.targetAmount,
              txHash: result.txHash,
            },
          ],
        }
      }
    }

    throw new Error('No suitable collateral found for borrowing')
  }
}

/**
 * Create a borrow strategy
 */
export function createBorrowStrategy(config?: BorrowStrategyConfig): BorrowStrategy {
  return new BorrowStrategy(config)
}
