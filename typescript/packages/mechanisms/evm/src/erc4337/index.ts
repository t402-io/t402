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

// Bundler (base)
export { BundlerClient, BundlerError, createBundlerClient } from "./bundler.js";

// Bundlers (provider-specific)
export {
  // Factory
  createBundlerClient as createProviderBundlerClient,
  detectBundlerProvider,
  createBundlerClientFromUrl,
  // Pimlico
  PimlicoBundlerClient,
  createPimlicoBundlerClient,
  // Alchemy
  AlchemyBundlerClient,
  createAlchemyBundlerClient,
  // Types
  type BundlerProvider,
  type PimlicoConfig,
  type PimlicoGasPrice,
  type AlchemyConfig,
  type AlchemyPolicyConfig,
  type AssetChange,
  type SimulationResult,
} from "./bundlers/index.js";

// Paymaster (base)
export {
  PaymasterClient,
  createPaymasterClient,
  encodePaymasterAndData,
  decodePaymasterAndData,
} from "./paymaster.js";
export type { PaymasterResponse, SponsorRequest } from "./paymaster.js";

// Paymasters (provider-specific)
export {
  // Factory
  createPaymaster,
  detectPaymasterProvider,
  createUnifiedPaymaster,
  // Pimlico
  PimlicoPaymaster,
  createPimlicoPaymaster,
  // Biconomy
  BiconomyPaymaster,
  createBiconomyPaymaster,
  // Stackup
  StackupPaymaster,
  createStackupPaymaster,
  // Types
  type PaymasterProvider,
  type UnifiedPaymaster,
  type PimlicoPaymasterConfig,
  type PimlicoPaymasterType,
  type PimlicoPolicy,
  type PimlicoSponsorResult,
  type BiconomyPaymasterConfig,
  type BiconomyPaymasterMode,
  type BiconomySpendingLimit,
  type BiconomyErc20Config,
  type BiconomySponsorResult,
  type StackupPaymasterConfig,
  type StackupPaymasterType,
  type StackupContext,
  type StackupSponsorResult,
} from "./paymasters/index.js";

// Smart Accounts
export {
  // Factory
  createSmartAccount,
  detectAccountType,
  // Safe
  SafeSmartAccount,
  createSafeSmartAccount,
  SAFE_4337_ADDRESSES,
  // Types
  type AccountType,
  type SafeSmartAccountConfig,
} from "./accounts/index.js";

// T402 Integration
export { GaslessT402Client, createGaslessT402Client } from "./t402.js";
export type {
  GaslessPaymentParams,
  GaslessClientConfig,
} from "./t402.js";
