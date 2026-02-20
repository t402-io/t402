/**
 * @t402/wdk-ton-gasless
 *
 * Gasless USDT0 payments on TON using Tether WDK.
 *
 * This package enables users to send Jetton USDT0 payments without holding
 * any TON for gas costs. It works by:
 *
 * 1. Wrapping a WDK TON gasless wallet instance
 * 2. Using Tether's gasless relay to sponsor transaction costs
 * 3. Submitting signed Jetton transfers through the relay
 *
 * @example Basic usage
 * ```typescript
 * import { createTonGaslessClient } from '@t402/wdk-ton-gasless';
 *
 * const client = await createTonGaslessClient({
 *   wdkInstance: myTonGaslessWallet,
 * });
 *
 * // Check balance
 * const balance = await client.getBalance();
 * const formatted = client.getFormattedBalance(balance);
 * console.log(`USDT0 Balance: ${formatted}`);
 *
 * // Execute gasless payment
 * const result = await client.pay({
 *   to: 'UQ...',
 *   amount: 1000000n, // 1 USDT0 (6 decimals)
 * });
 *
 * console.log('Transaction:', result.txHash);
 * console.log('Gasless:', result.sponsored);
 * ```
 *
 * @packageDocumentation
 */

// Main client
export { TonGaslessClient, createTonGaslessClient } from './client.js'

// Adapter (upstream integration)
export {
  adaptTonGaslessWallet,
  isUpstreamTonGaslessWallet,
  tryLoadUpstreamModule,
} from './adapter.js'
export type { TonGaslessWalletAdapter, UpstreamTonGaslessWallet } from './adapter.js'

// Types
export type { TonGaslessConfig, TonGaslessPaymentParams, TonGaslessPaymentResult } from './types.js'

// Constants
export {
  TON_USDT0_JETTON_MASTER,
  TON_USDT_JETTON_MASTER,
  TON_MAINNET_ENDPOINT,
  TON_TESTNET_ENDPOINT,
  TON_JETTON_DECIMALS,
  JETTON_ADDRESSES,
  getJettonAddress,
} from './constants.js'
