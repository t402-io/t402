/**
 * DeFi Pre-Payment Processor
 *
 * Orchestrates DeFi strategies (swap, borrow, bridge) as pre-payment steps
 * to ensure the user has sufficient payment tokens before making a t402 payment.
 */

import type { PaymentRequirements } from '@t402/core/types'
import type {
  DefiStrategy,
  DefiStrategyParams,
  DefiStrategyResult,
  DefiEstimate,
  BeforePayHook,
  DefiProcessorConfig,
} from './types.js'

/**
 * DeFi Pre-Payment Processor
 *
 * Manages a set of DeFi strategies and selects the optimal one
 * for obtaining payment tokens.
 *
 * @example
 * ```typescript
 * import { DefiPrePaymentProcessor, createSwapStrategy } from '@t402/wdk-defi';
 *
 * const processor = new DefiPrePaymentProcessor();
 * processor.registerStrategy(createSwapStrategy({ wdk }));
 *
 * // Use as a beforePay hook
 * const hook = processor.createBeforePayHook();
 * ```
 */
export class DefiPrePaymentProcessor {
  private strategies: DefiStrategy[] = []
  private config: DefiProcessorConfig

  constructor(config: DefiProcessorConfig = {}) {
    this.config = config
  }

  /**
   * Register a DeFi strategy
   */
  registerStrategy(strategy: DefiStrategy): void {
    // Remove existing strategy with the same name
    this.strategies = this.strategies.filter((s) => s.name !== strategy.name)
    this.strategies.push(strategy)
  }

  /**
   * Remove a strategy by name
   */
  removeStrategy(name: string): void {
    this.strategies = this.strategies.filter((s) => s.name !== name)
  }

  /**
   * Get all registered strategy names
   */
  getStrategyNames(): string[] {
    return this.strategies.map((s) => s.name)
  }

  /**
   * Create a beforePay hook for the t402 client
   *
   * The hook checks if the user has sufficient balance for payment.
   * If not, it finds and executes the best DeFi strategy to obtain
   * the required tokens.
   */
  createBeforePayHook(): BeforePayHook {
    return async (
      requirements: PaymentRequirements,
      balances: Record<string, bigint>,
    ): Promise<DefiStrategyResult | null> => {
      const targetToken = requirements.asset
      const targetAmount = requirements.amount ? BigInt(requirements.amount) : 0n

      if (!targetToken || targetAmount <= 0n) {
        return null
      }

      // Check if user already has sufficient balance
      const currentBalance = balances[targetToken] ?? 0n
      if (currentBalance >= targetAmount) {
        return null // No action needed
      }

      // Build params
      const params: DefiStrategyParams = {
        targetToken,
        targetAmount,
        targetNetwork: requirements.network ?? this.config.defaultChain ?? 'arbitrum',
        currentBalances: balances,
        availableTokens: Object.keys(balances).filter((k) => balances[k] > 0n),
      }

      // Find and execute best strategy
      return this.executeBestStrategy(params)
    }
  }

  /**
   * Estimate the best strategy without executing
   */
  async estimate(params: DefiStrategyParams): Promise<DefiEstimate | null> {
    let bestEstimate: DefiEstimate | null = null
    let bestFee = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF')

    for (const strategy of this.strategies) {
      try {
        const canExecute = await strategy.canExecute(params)
        if (!canExecute) continue

        const estimate = await strategy.estimate(params)

        if (estimate.totalFees < bestFee) {
          bestEstimate = estimate
          bestFee = estimate.totalFees
        }
      } catch {
        // Skip strategies that fail to estimate
      }
    }

    return bestEstimate
  }

  /**
   * Find and execute the best available strategy
   */
  private async executeBestStrategy(
    params: DefiStrategyParams,
  ): Promise<DefiStrategyResult | null> {
    // Try each strategy in order (they are registered in priority order)
    for (const strategy of this.strategies) {
      try {
        const canExecute = await strategy.canExecute(params)
        if (!canExecute) continue

        return await strategy.execute(params)
      } catch {
        // Try next strategy
      }
    }

    return null
  }
}

/**
 * Create a DeFi pre-payment processor
 */
export function createDefiProcessor(config?: DefiProcessorConfig): DefiPrePaymentProcessor {
  return new DefiPrePaymentProcessor(config)
}
