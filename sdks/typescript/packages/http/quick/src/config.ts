/**
 * Shared configuration parser for @t402/quick
 *
 * Converts simplified user config into the full RoutesConfig
 * required by T402 middleware packages.
 *
 *   USER CONFIG                           INTERNAL CONFIG
 *   ───────────────────                   ──────────────────────
 *   { price: "1.00" }          ──►        RoutesConfig with
 *                                         default network (Arbitrum),
 *                                         default facilitator,
 *                                         USDT asset address
 *
 *   { price: "5.00",           ──►        RoutesConfig with
 *     network: "eip155:56",               BSC network,
 *     facilitator: "https://…" }          custom facilitator
 */

import type { RoutesConfig } from "@t402/core/server";
import type { FacilitatorClient } from "@t402/core/http";
import type { Network } from "@t402/core/types";
import { HTTPFacilitatorClient } from "@t402/core/http";

/**
 * Default network: Arbitrum One (low fees, fast settlement, USDT0 supported)
 */
export const DEFAULT_NETWORK: Network = "eip155:42161";

/**
 * Default facilitator URL (T402 hosted free tier)
 */
export const DEFAULT_FACILITATOR_URL = "https://facilitator.t402.io";

/**
 * Known USDT/USDT0 asset addresses per network
 */
const USDT_ASSETS: Record<string, string> = {
  // USDT0 (LayerZero OFT) — EVM chains
  "eip155:42161": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", // Arbitrum
  "eip155:137": "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", // Polygon
  "eip155:56": "0x55d398326f99059fF775485246999027B3197955", // BSC
  "eip155:1": "0xdAC17F958D2ee523a2206206994597C13D831ec7", // Ethereum
  "eip155:10": "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", // Optimism
  "eip155:8453": "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", // Base
};

/**
 * Simplified configuration for @t402/quick
 */
export interface QuickConfig {
  /**
   * Price in USDT (e.g., "1.00", "0.50", "10")
   */
  price: string;

  /**
   * Target network (CAIP-2 format). Defaults to Arbitrum One.
   * @default "eip155:42161"
   */
  network?: Network;

  /**
   * Wallet address to receive payments.
   * Required for production use. Omit for testing with default.
   */
  payTo?: string;

  /**
   * Facilitator URL. Defaults to T402 hosted facilitator.
   * @default "https://facilitator.t402.io"
   */
  facilitator?: string;

  /**
   * Payment scheme. Defaults to "exact".
   * @default "exact"
   */
  scheme?: string;

  /**
   * Maximum timeout in seconds for payment signatures.
   * @default 120
   */
  maxTimeoutSeconds?: number;
}

/**
 * Resolved configuration with all defaults applied
 */
export interface ResolvedQuickConfig {
  price: string;
  network: Network;
  payTo: string;
  facilitator: string;
  scheme: string;
  asset: string;
  maxTimeoutSeconds: number;
}

/**
 * Resolves a QuickConfig into a full ResolvedQuickConfig with defaults.
 *
 * @throws {Error} If price is empty, zero, or negative
 * @throws {Error} If payTo is not provided (required for production)
 * @throws {Error} If network has no known USDT asset address
 */
export function resolveQuickConfig(config: QuickConfig): ResolvedQuickConfig {
  // Validate price
  if (!config.price || config.price.trim() === "") {
    throw new Error("@t402/quick: price is required (e.g., \"1.00\")");
  }

  const priceNum = parseFloat(config.price);
  if (isNaN(priceNum) || priceNum <= 0) {
    throw new Error(`@t402/quick: price must be a positive number, got "${config.price}"`);
  }

  // Validate payTo
  if (!config.payTo || config.payTo.trim() === "") {
    throw new Error(
      "@t402/quick: payTo (wallet address) is required. " +
      "This is the address that will receive USDT payments."
    );
  }

  const network = config.network ?? DEFAULT_NETWORK;
  const asset = USDT_ASSETS[network];

  if (!asset) {
    const supported = Object.keys(USDT_ASSETS).join(", ");
    throw new Error(
      `@t402/quick: no known USDT asset for network "${network}". ` +
      `Supported networks: ${supported}. ` +
      `For other networks, use @t402/express directly.`
    );
  }

  return {
    price: config.price,
    network,
    payTo: config.payTo,
    facilitator: config.facilitator ?? DEFAULT_FACILITATOR_URL,
    scheme: config.scheme ?? "exact",
    asset,
    maxTimeoutSeconds: config.maxTimeoutSeconds ?? 120,
  };
}

/**
 * Creates a RoutesConfig from a resolved QuickConfig.
 * This is the bridge between the simplified API and T402's full config.
 *
 * Uses PaymentOption format with AssetAmount price (asset + amount + extra).
 */
export function toRoutesConfig(resolved: ResolvedQuickConfig): RoutesConfig {
  // Convert USDT price to the asset's smallest unit (6 decimals for USDT)
  const amountInSmallestUnit = Math.round(parseFloat(resolved.price) * 1_000_000).toString();

  return {
    accepts: {
      scheme: resolved.scheme,
      network: resolved.network,
      price: {
        asset: resolved.asset,
        amount: amountInSmallestUnit,
        extra: { name: "USDT", version: "2" },
      },
      payTo: resolved.payTo,
      maxTimeoutSeconds: resolved.maxTimeoutSeconds,
    },
  };
}

/**
 * Creates a FacilitatorClient from a facilitator URL.
 */
export function createFacilitatorClient(url: string): FacilitatorClient {
  return new HTTPFacilitatorClient({ url });
}
