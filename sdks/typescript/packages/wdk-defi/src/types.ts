/**
 * DeFi Pre-Payment Processing Types
 */

import type { PaymentRequirements } from '@t402/core/types'

/**
 * Strategy interface for DeFi pre-payment actions
 */
export interface DefiStrategy {
  /** Strategy name (e.g., 'swap', 'borrow', 'bridge-swap') */
  name: string
  /** Check if this strategy can execute with the given params */
  canExecute(params: DefiStrategyParams): Promise<boolean>
  /** Execute the strategy */
  execute(params: DefiStrategyParams): Promise<DefiStrategyResult>
  /** Estimate output without executing */
  estimate(params: DefiStrategyParams): Promise<DefiEstimate>
}

/**
 * Parameters for strategy execution
 */
export interface DefiStrategyParams {
  /** Target token address (what we need for payment) */
  targetToken: string
  /** Target amount in smallest units */
  targetAmount: bigint
  /** Target network (CAIP-2 or chain name) */
  targetNetwork: string
  /** Current balances keyed by token address */
  currentBalances: Record<string, bigint>
  /** Available token addresses the user holds */
  availableTokens: string[]
}

/**
 * Result of strategy execution
 */
export interface DefiStrategyResult {
  /** Transaction hashes from the execution */
  txHashes: string[]
  /** Output token address */
  outputToken: string
  /** Output amount received */
  outputAmount: bigint
  /** Total fees paid */
  fees: bigint
  /** Steps taken during execution */
  steps: DefiStep[]
}

/**
 * A single step in a DeFi strategy
 */
export interface DefiStep {
  /** Type of DeFi operation */
  type: 'swap' | 'borrow' | 'bridge' | 'approve'
  /** Protocol used (e.g., 'velora', 'aave-v3', 'layerzero') */
  protocol: string
  /** Input token address */
  fromToken: string
  /** Output token address */
  toToken: string
  /** Amount in smallest units */
  amount: bigint
  /** Transaction hash (set after execution) */
  txHash?: string
}

/**
 * Estimate for a strategy (without executing)
 */
export interface DefiEstimate {
  /** Estimated output amount */
  outputAmount: bigint
  /** Estimated total fees */
  totalFees: bigint
  /** Estimated time in seconds */
  estimatedTime: number
  /** Steps that would be taken */
  steps: Omit<DefiStep, 'txHash'>[]
}

/**
 * Hook called before payment to optionally execute DeFi operations
 */
export interface BeforePayHook {
  (
    requirements: PaymentRequirements,
    balances: Record<string, bigint>,
  ): Promise<DefiStrategyResult | null>
}

/**
 * Configuration for the DeFi processor
 */
export interface DefiProcessorConfig {
  /** Default chain for operations */
  defaultChain?: string
  /** Maximum acceptable slippage (0-1, default 0.005 = 0.5%) */
  maxSlippage?: number
  /** Whether to auto-approve token spending */
  autoApprove?: boolean
}
