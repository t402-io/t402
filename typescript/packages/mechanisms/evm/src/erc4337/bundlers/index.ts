/**
 * ERC-4337 Bundler Clients
 *
 * Provides factory functions and exports for bundler integrations:
 * - Pimlico: Full-featured bundler with compression support
 * - Alchemy: Bundler with gas manager integration
 *
 * @example
 * ```typescript
 * import { createBundlerClient } from "@t402/evm/erc4337/bundlers";
 *
 * // Create Pimlico bundler
 * const pimlico = createBundlerClient("pimlico", {
 *   chainId: 1,
 *   apiKey: process.env.PIMLICO_API_KEY,
 * });
 *
 * // Create Alchemy bundler
 * const alchemy = createBundlerClient("alchemy", {
 *   chainId: 1,
 *   apiKey: process.env.ALCHEMY_API_KEY,
 *   policy: { policyId: "..." },
 * });
 * ```
 */

import type { BundlerConfig } from "../types.js";
import { BundlerClient } from "../bundler.js";
import {
  PimlicoBundlerClient,
  createPimlicoBundlerClient,
  type PimlicoConfig,
  type PimlicoGasPrice,
} from "./pimlico.js";
import {
  AlchemyBundlerClient,
  createAlchemyBundlerClient,
  type AlchemyConfig,
  type AlchemyPolicyConfig,
  type AssetChange,
  type SimulationResult,
} from "./alchemy.js";

/**
 * Bundler provider type
 */
export type BundlerProvider = "pimlico" | "alchemy" | "generic";

/**
 * Bundler configuration by provider
 */
export type BundlerProviderConfig<T extends BundlerProvider> =
  T extends "pimlico" ? PimlicoConfig :
  T extends "alchemy" ? AlchemyConfig :
  BundlerConfig;

/**
 * Bundler client by provider
 */
export type BundlerProviderClient<T extends BundlerProvider> =
  T extends "pimlico" ? PimlicoBundlerClient :
  T extends "alchemy" ? AlchemyBundlerClient :
  BundlerClient;

/**
 * Create a bundler client for the specified provider
 */
export function createBundlerClient<T extends BundlerProvider>(
  provider: T,
  config: BundlerProviderConfig<T>,
): BundlerProviderClient<T> {
  switch (provider) {
    case "pimlico":
      return createPimlicoBundlerClient(config as PimlicoConfig) as BundlerProviderClient<T>;
    case "alchemy":
      return createAlchemyBundlerClient(config as AlchemyConfig) as BundlerProviderClient<T>;
    case "generic":
    default:
      return new BundlerClient(config as BundlerConfig) as BundlerProviderClient<T>;
  }
}

/**
 * Auto-detect bundler provider from URL
 */
export function detectBundlerProvider(url: string): BundlerProvider {
  if (url.includes("pimlico")) {
    return "pimlico";
  }
  if (url.includes("alchemy")) {
    return "alchemy";
  }
  return "generic";
}

/**
 * Create a bundler client with auto-detection
 */
export function createBundlerClientFromUrl(
  bundlerUrl: string,
  chainId: number,
  apiKey?: string,
): BundlerClient | PimlicoBundlerClient | AlchemyBundlerClient {
  const provider = detectBundlerProvider(bundlerUrl);

  switch (provider) {
    case "pimlico":
      if (!apiKey) {
        throw new Error("API key required for Pimlico bundler");
      }
      return createPimlicoBundlerClient({
        bundlerUrl,
        chainId,
        apiKey,
      });

    case "alchemy":
      if (!apiKey) {
        throw new Error("API key required for Alchemy bundler");
      }
      return createAlchemyBundlerClient({
        bundlerUrl,
        chainId,
        apiKey,
      });

    default:
      return new BundlerClient({
        bundlerUrl,
        chainId,
      });
  }
}

// Re-export everything
export {
  // Pimlico
  PimlicoBundlerClient,
  createPimlicoBundlerClient,
  type PimlicoConfig,
  type PimlicoGasPrice,
  // Alchemy
  AlchemyBundlerClient,
  createAlchemyBundlerClient,
  type AlchemyConfig,
  type AlchemyPolicyConfig,
  type AssetChange,
  type SimulationResult,
};
