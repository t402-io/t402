/**
 * ERC-4337 Account Abstraction Module
 *
 * Provides ERC-4337 v0.7 support for T402 payment protocol:
 * - UserOperation building and signing
 * - Bundler client for operation submission
 * - Paymaster integration for gas sponsorship
 * - Gasless T402 payment execution
 *
 * @example Basic gasless payment
 * ```typescript
 * import { createGaslessT402Client } from '@t402/evm';
 *
 * const client = createGaslessT402Client({
 *   signer: mySmartAccountSigner,
 *   bundler: {
 *     bundlerUrl: 'https://bundler.example.com',
 *     chainId: 42161,
 *   },
 *   paymaster: {
 *     address: '0x...',
 *     url: 'https://paymaster.example.com',
 *     type: 'sponsoring',
 *   },
 *   chainId: 42161,
 *   publicClient,
 * });
 *
 * // Execute gasless payment
 * const result = await client.executePayment({
 *   tokenAddress: USDT0_ADDRESS,
 *   to: merchantAddress,
 *   amount: 1000000n, // 1 USDT0
 * });
 *
 * // Wait for confirmation
 * const receipt = await result.wait();
 * ```
 */

// Types
export type {
  UserOperation,
  PackedUserOperation,
  PaymasterData,
  GasEstimate,
  UserOperationReceipt,
  UserOperationResult,
  BundlerConfig,
  PaymasterConfig,
  SmartAccountSigner,
  UserOpBuilderConfig,
  TransactionIntent,
} from "./types.js";

// Constants
export {
  ENTRYPOINT_V07_ADDRESS,
  ENTRYPOINT_V06_ADDRESS,
  DEFAULT_GAS_LIMITS,
  ENTRYPOINT_V07_ABI,
  ACCOUNT_ABI,
  BUNDLER_METHODS,
  PaymasterType,
  packAccountGasLimits,
  unpackAccountGasLimits,
  packGasFees,
  unpackGasFees,
} from "./constants.js";

// Builder
export { UserOpBuilder, createUserOpBuilder } from "./builder.js";
export type { UserOpBuilderOptions } from "./builder.js";

// Bundler
export { BundlerClient, BundlerError, createBundlerClient } from "./bundler.js";

// Paymaster
export {
  PaymasterClient,
  createPaymasterClient,
  encodePaymasterAndData,
  decodePaymasterAndData,
} from "./paymaster.js";
export type { PaymasterResponse, SponsorRequest } from "./paymaster.js";

// T402 Integration
export { GaslessT402Client, createGaslessT402Client } from "./t402.js";
export type {
  GaslessPaymentParams,
  GaslessClientConfig,
} from "./t402.js";
