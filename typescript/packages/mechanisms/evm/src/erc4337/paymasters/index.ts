/**
 * ERC-4337 Paymaster Clients
 *
 * Provides factory functions and exports for paymaster integrations:
 * - Pimlico: Verifying and ERC-20 paymasters
 * - Biconomy: Sponsored and token-based paymasters
 * - Stackup: Verifying paymaster with custom policies
 *
 * @example
 * ```typescript
 * import { createPaymaster } from "@t402/evm/erc4337/paymasters";
 *
 * // Create Pimlico paymaster
 * const pimlico = createPaymaster("pimlico", {
 *   chainId: 1,
 *   apiKey: process.env.PIMLICO_API_KEY,
 * });
 *
 * // Create Biconomy paymaster
 * const biconomy = createPaymaster("biconomy", {
 *   chainId: 1,
 *   apiKey: process.env.BICONOMY_API_KEY,
 *   mode: "SPONSORED",
 * });
 *
 * // Create Stackup paymaster
 * const stackup = createPaymaster("stackup", {
 *   chainId: 1,
 *   apiKey: process.env.STACKUP_API_KEY,
 * });
 * ```
 */

import type { Address, Hex } from "viem";
import type { UserOperation, PaymasterData } from "../types.js";
import {
  PimlicoPaymaster,
  createPimlicoPaymaster,
  type PimlicoPaymasterConfig,
  type PimlicoPaymasterType,
  type PimlicoPolicy,
  type PimlicoSponsorResult,
} from "./pimlico.js";
import {
  BiconomyPaymaster,
  createBiconomyPaymaster,
  type BiconomyPaymasterConfig,
  type BiconomyPaymasterMode,
  type BiconomySpendingLimit,
  type BiconomyErc20Config,
  type BiconomySponsorResult,
} from "./biconomy.js";
import {
  StackupPaymaster,
  createStackupPaymaster,
  type StackupPaymasterConfig,
  type StackupPaymasterType,
  type StackupContext,
  type StackupSponsorResult,
} from "./stackup.js";

/**
 * Paymaster provider type
 */
export type PaymasterProvider = "pimlico" | "biconomy" | "stackup";

/**
 * Paymaster configuration by provider
 */
export type PaymasterProviderConfig<T extends PaymasterProvider> =
  T extends "pimlico" ? PimlicoPaymasterConfig :
  T extends "biconomy" ? BiconomyPaymasterConfig :
  T extends "stackup" ? StackupPaymasterConfig :
  never;

/**
 * Paymaster client by provider
 */
export type PaymasterProviderClient<T extends PaymasterProvider> =
  T extends "pimlico" ? PimlicoPaymaster :
  T extends "biconomy" ? BiconomyPaymaster :
  T extends "stackup" ? StackupPaymaster :
  never;

/**
 * Unified paymaster interface
 */
export interface UnifiedPaymaster {
  /** Sponsor a UserOperation */
  sponsorUserOperation(
    userOp: Partial<UserOperation> & {
      sender: Address;
      callData: Hex;
    },
    options?: Record<string, unknown>,
  ): Promise<{
    paymaster: Address;
    paymasterAndData: Hex;
    callGasLimit: bigint;
    verificationGasLimit: bigint;
    preVerificationGas: bigint;
    paymasterVerificationGasLimit: bigint;
    paymasterPostOpGasLimit: bigint;
  }>;

  /** Get paymaster data for a UserOperation */
  getPaymasterData(
    userOp: UserOperation,
    context?: Record<string, unknown>,
  ): Promise<PaymasterData>;
}

/**
 * Create a paymaster client for the specified provider
 */
export function createPaymaster<T extends PaymasterProvider>(
  provider: T,
  config: PaymasterProviderConfig<T>,
): PaymasterProviderClient<T> {
  switch (provider) {
    case "pimlico":
      return createPimlicoPaymaster(config as PimlicoPaymasterConfig) as PaymasterProviderClient<T>;
    case "biconomy":
      return createBiconomyPaymaster(config as BiconomyPaymasterConfig) as PaymasterProviderClient<T>;
    case "stackup":
      return createStackupPaymaster(config as StackupPaymasterConfig) as PaymasterProviderClient<T>;
    default:
      throw new Error(`Unknown paymaster provider: ${provider}`);
  }
}

/**
 * Auto-detect paymaster provider from URL
 */
export function detectPaymasterProvider(url: string): PaymasterProvider | null {
  if (url.includes("pimlico")) {
    return "pimlico";
  }
  if (url.includes("biconomy")) {
    return "biconomy";
  }
  if (url.includes("stackup")) {
    return "stackup";
  }
  return null;
}

/**
 * Create a unified paymaster wrapper
 * Normalizes the interface across different providers
 */
export function createUnifiedPaymaster(
  provider: PaymasterProvider,
  config: PaymasterProviderConfig<typeof provider>,
): UnifiedPaymaster {
  const client = createPaymaster(provider, config);

  return {
    async sponsorUserOperation(userOp, options) {
      switch (provider) {
        case "pimlico":
          return (client as PimlicoPaymaster).sponsorUserOperation(userOp, options as { gasOverrides?: Record<string, bigint> });
        case "biconomy":
          return (client as BiconomyPaymaster).sponsorUserOperation(userOp, options as { webhookData?: Record<string, unknown> });
        case "stackup":
          return (client as StackupPaymaster).sponsorUserOperation(userOp, options as StackupContext);
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }
    },

    async getPaymasterData(userOp, context) {
      switch (provider) {
        case "pimlico":
          return (client as PimlicoPaymaster).getPaymasterData(userOp);
        case "biconomy":
          return (client as BiconomyPaymaster).getPaymasterData(userOp);
        case "stackup":
          return (client as StackupPaymaster).getPaymasterData(userOp, context as StackupContext);
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }
    },
  };
}

// Re-export everything
export {
  // Pimlico
  PimlicoPaymaster,
  createPimlicoPaymaster,
  type PimlicoPaymasterConfig,
  type PimlicoPaymasterType,
  type PimlicoPolicy,
  type PimlicoSponsorResult,
  // Biconomy
  BiconomyPaymaster,
  createBiconomyPaymaster,
  type BiconomyPaymasterConfig,
  type BiconomyPaymasterMode,
  type BiconomySpendingLimit,
  type BiconomyErc20Config,
  type BiconomySponsorResult,
  // Stackup
  StackupPaymaster,
  createStackupPaymaster,
  type StackupPaymasterConfig,
  type StackupPaymasterType,
  type StackupContext,
  type StackupSponsorResult,
};
