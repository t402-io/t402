/**
 * @t402/wdk-tron-gasfree
 *
 * Gas-free USDT payments on TRON using Tether WDK.
 *
 * This package enables users to send TRC20 USDT payments without holding
 * any TRX for bandwidth/energy costs. It works by:
 *
 * 1. Wrapping a WDK TRON gas-free wallet instance
 * 2. Using Tether's gas-free relay to sponsor transaction costs
 * 3. Submitting signed TRC20 transfers through the relay
 *
 * @example Basic usage
 * ```typescript
 * import { createWdkTronGasfreeClient } from '@t402/wdk-tron-gasfree';
 *
 * const client = await createWdkTronGasfreeClient({
 *   wdkInstance: myTronGasfreeWallet,
 * });
 *
 * // Check balance
 * const balance = await client.getBalance();
 * const formatted = client.getFormattedBalance(balance);
 * console.log(`USDT Balance: ${formatted}`);
 *
 * // Execute gas-free payment
 * const result = await client.pay({
 *   to: 'TAddress...',
 *   amount: 1000000n, // 1 USDT (6 decimals)
 * });
 *
 * console.log('Transaction ID:', result.txId);
 * console.log('Gas-free:', result.sponsored);
 * ```
 *
 * @packageDocumentation
 */

// Main client
export { WdkTronGasfreeClient, createWdkTronGasfreeClient } from './client.js'

// Types
export type {
  WdkTronGasfreeConfig,
  GasfreePaymentParams,
  GasfreePaymentResult,
} from './types.js'

// Constants
export {
  TRON_USDT_ADDRESS,
  TRON_USDT_TESTNET_ADDRESS,
  TRON_USDT0_ADDRESS,
  TRON_MAINNET_URL,
  TRON_TESTNET_URL,
  TRON_USDT_DECIMALS,
  TOKEN_ADDRESSES,
  getTokenAddress,
} from './constants.js'
