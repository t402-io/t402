/**
 * ERC-4337 Smart Account Implementations
 *
 * Provides smart account signers for use with ERC-4337:
 * - Safe: Multi-sig smart account with 4337 module
 *
 * @example
 * ```typescript
 * import { createSafeSmartAccount } from "@t402/evm/erc4337/accounts";
 * import { createPublicClient, createWalletClient, http } from "viem";
 * import { mainnet } from "viem/chains";
 *
 * const publicClient = createPublicClient({
 *   chain: mainnet,
 *   transport: http(),
 * });
 *
 * const walletClient = createWalletClient({
 *   chain: mainnet,
 *   transport: http(),
 *   account: privateKeyToAccount("0x..."),
 * });
 *
 * const safeAccount = createSafeSmartAccount({
 *   signer: walletClient,
 *   publicClient,
 *   chainId: 1,
 * });
 *
 * // Get counterfactual address
 * const address = await safeAccount.getAddress();
 *
 * // Build call data
 * const callData = safeAccount.encodeExecute(
 *   targetAddress,
 *   value,
 *   data,
 * );
 * ```
 */

import type { Address } from "viem";
import type { SmartAccountSigner } from "../types.js";
import {
  SafeSmartAccount,
  createSafeSmartAccount,
  SAFE_4337_ADDRESSES,
  type SafeSmartAccountConfig,
} from "./safe.js";

/**
 * Account type
 */
export type AccountType = "safe";

/**
 * Account configuration by type
 */
export type AccountTypeConfig<T extends AccountType> =
  T extends "safe" ? SafeSmartAccountConfig :
  never;

/**
 * Account client by type
 */
export type AccountTypeClient<T extends AccountType> =
  T extends "safe" ? SafeSmartAccount :
  never;

/**
 * Create a smart account of the specified type
 */
export function createSmartAccount<T extends AccountType>(
  type: T,
  config: AccountTypeConfig<T>,
): AccountTypeClient<T> {
  switch (type) {
    case "safe":
      return createSafeSmartAccount(config as SafeSmartAccountConfig) as AccountTypeClient<T>;
    default:
      throw new Error(`Unknown account type: ${type}`);
  }
}

/**
 * Get the account type from an address
 * Checks bytecode to determine the smart account implementation
 */
export async function detectAccountType(
  _address: Address,
): Promise<AccountType | null> {
  // Future: Add detection logic based on bytecode patterns
  // For now, return null (unknown)
  return null;
}

// Re-export everything
export {
  // Safe
  SafeSmartAccount,
  createSafeSmartAccount,
  SAFE_4337_ADDRESSES,
  type SafeSmartAccountConfig,
  // Types
  type SmartAccountSigner,
};
