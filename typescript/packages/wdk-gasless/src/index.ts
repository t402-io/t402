/**
 * @t402/wdk-gasless
 *
 * Gasless USDT0 payments using Tether WDK and ERC-4337 Account Abstraction.
 *
 * This package enables users to send USDT0 payments without holding any ETH
 * for gas fees. It works by:
 *
 * 1. Wrapping a WDK account in a Safe smart account (ERC-4337)
 * 2. Using a paymaster to sponsor gas fees
 * 3. Submitting UserOperations through a bundler
 *
 * @example Basic usage
 * ```typescript
 * import { createWdkGaslessClient } from '@t402/wdk-gasless';
 * import { createPublicClient, http } from 'viem';
 * import { arbitrum } from 'viem/chains';
 *
 * // Create public client
 * const publicClient = createPublicClient({
 *   chain: arbitrum,
 *   transport: http(),
 * });
 *
 * // Create gasless client
 * const client = await createWdkGaslessClient({
 *   wdkAccount: myWdkAccount,
 *   publicClient,
 *   chainId: 42161,
 *   bundler: {
 *     bundlerUrl: 'https://api.pimlico.io/v2/arbitrum/rpc?apikey=...',
 *     chainId: 42161,
 *   },
 *   paymaster: {
 *     address: '0x...',
 *     url: 'https://api.pimlico.io/v2/arbitrum/rpc?apikey=...',
 *     type: 'sponsoring',
 *   },
 * });
 *
 * // Check balance
 * const balance = await client.getFormattedBalance();
 * console.log(`USDT0 Balance: ${balance}`);
 *
 * // Execute gasless payment
 * const result = await client.pay({
 *   to: '0x...',
 *   amount: 1000000n, // 1 USDT0 (6 decimals)
 * });
 *
 * console.log('UserOp submitted:', result.userOpHash);
 * console.log('Sponsored (free gas):', result.sponsored);
 *
 * // Wait for confirmation
 * const receipt = await result.wait();
 * console.log('Confirmed in tx:', receipt.txHash);
 * ```
 *
 * @example Batch payments
 * ```typescript
 * // Send to multiple recipients in one transaction
 * const result = await client.payBatch({
 *   payments: [
 *     { to: '0xAlice...', amount: 1000000n }, // 1 USDT0
 *     { to: '0xBob...', amount: 2000000n },   // 2 USDT0
 *     { to: '0xCharlie...', amount: 500000n }, // 0.5 USDT0
 *   ],
 * });
 * ```
 *
 * @example Check sponsorship eligibility
 * ```typescript
 * const info = await client.canSponsor({
 *   to: '0x...',
 *   amount: 1000000n,
 * });
 *
 * if (info.canSponsor) {
 *   console.log('Payment will be sponsored (free gas)');
 * } else {
 *   console.log('Not sponsored:', info.reason);
 *   console.log('Estimated gas cost:', info.estimatedGasCost);
 * }
 * ```
 *
 * @packageDocumentation
 */

// Main client
export {
  WdkGaslessClient,
  createWdkGaslessClient,
} from "./client.js";
export type { CreateWdkGaslessClientConfig } from "./client.js";

// Smart account
export {
  WdkSmartAccount,
  createWdkSmartAccount,
  SAFE_4337_ADDRESSES,
} from "./account.js";

// Types
export type {
  WdkAccount,
  WdkInstance,
  WdkSmartAccountConfig,
  WdkGaslessClientConfig,
  GaslessPaymentParams,
  BatchPaymentParams,
  GaslessPaymentResult,
  GaslessPaymentReceipt,
  SponsorshipInfo,
} from "./types.js";

// Constants
export {
  USDT0_ADDRESSES,
  USDC_ADDRESSES,
  CHAIN_IDS,
  DEFAULT_BUNDLER_URLS,
  getTokenAddress,
  getChainName,
} from "./constants.js";

// Re-export essential types from @t402/evm for convenience
export type {
  SmartAccountSigner,
  BundlerConfig,
  PaymasterConfig,
  UserOperationReceipt,
} from "@t402/evm";
