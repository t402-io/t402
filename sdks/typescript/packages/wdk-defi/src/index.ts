/**
 * @module @t402/wdk-defi - DeFi Pre-Payment Processing
 *
 * Integrates DeFi protocols (swap, borrow, bridge) as pre-payment steps
 * for t402 payments. When a user lacks sufficient payment tokens, the
 * processor automatically obtains them via the optimal DeFi strategy.
 *
 * @example
 * ```typescript
 * import { createDefiProcessor, createSwapStrategy } from '@t402/wdk-defi';
 *
 * const processor = createDefiProcessor();
 * processor.registerStrategy(createSwapStrategy({ wdk }));
 *
 * // Use as a beforePay hook
 * const hook = processor.createBeforePayHook();
 *
 * // Or estimate without executing
 * const estimate = await processor.estimate({
 *   targetToken: '0x...',
 *   targetAmount: 1000000n,
 *   targetNetwork: 'arbitrum',
 *   currentBalances: { '0x...': 500000n },
 *   availableTokens: ['0x...'],
 * });
 * ```
 */

// Processor
export { DefiPrePaymentProcessor, createDefiProcessor } from './processor.js'

// Strategies
export { SwapStrategy, createSwapStrategy } from './strategies/swap.js'
export type { SwapStrategyConfig } from './strategies/swap.js'

export { BorrowStrategy, createBorrowStrategy } from './strategies/borrow.js'
export type { BorrowStrategyConfig } from './strategies/borrow.js'

export { BridgeSwapStrategy, createBridgeSwapStrategy } from './strategies/bridge-swap.js'
export type { BridgeSwapStrategyConfig } from './strategies/bridge-swap.js'

// Types
export type {
  DefiStrategy,
  DefiStrategyParams,
  DefiStrategyResult,
  DefiStep,
  DefiEstimate,
  BeforePayHook,
  DefiProcessorConfig,
} from './types.js'

// Constants
export {
  USDT0_ADDRESSES,
  USDC_ADDRESSES,
  AAVE_V3_POOL_ADDRESSES,
  DEFAULT_MAX_SLIPPAGE,
  SUPPORTED_SWAP_TOKENS,
} from './constants.js'
