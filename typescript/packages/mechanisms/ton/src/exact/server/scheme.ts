/**
 * TON Server Scheme Implementation
 *
 * Handles price parsing and payment requirement enhancement for
 * TON Jetton payments using the exact scheme.
 */

import type {
  AssetAmount,
  Network,
  PaymentRequirements,
  Price,
  SchemeNetworkServer,
  MoneyParser,
} from "@t402/core/types";
import { SCHEME_EXACT } from "../../constants.js";
import {
  getDefaultJetton,
  getJettonConfig,
  getJettonByAddress,
  JETTON_REGISTRY,
} from "../../tokens.js";
import { normalizeNetwork } from "../../utils.js";

/**
 * Configuration options for ExactTonScheme server
 */
export interface ExactTonSchemeConfig {
  /** Preferred Jetton symbol (e.g., "USDT"). Defaults to network's highest priority token. */
  preferredJetton?: string;
}

/**
 * TON server implementation for the Exact payment scheme.
 * Handles price parsing and converts user-friendly amounts to Jetton amounts.
 */
export class ExactTonScheme implements SchemeNetworkServer {
  readonly scheme = SCHEME_EXACT;
  private moneyParsers: MoneyParser[] = [];
  private config: ExactTonSchemeConfig;

  constructor(config: ExactTonSchemeConfig = {}) {
    this.config = config;
  }

  /**
   * Register a custom money parser in the parser chain.
   * Multiple parsers can be registered - they will be tried in registration order.
   * Each parser receives a decimal amount (e.g., 1.50 for $1.50).
   * If a parser returns null, the next parser in the chain will be tried.
   * The default parser is always the final fallback.
   *
   * @param parser - Custom function to convert amount to AssetAmount (or null to skip)
   * @returns The server instance for chaining
   *
   * @example
   * tonServer.registerMoneyParser(async (amount, network) => {
   *   // Use custom Jetton for large amounts
   *   if (amount > 1000) {
   *     return {
   *       amount: (amount * 1e9).toString(),
   *       asset: "EQCustomJettonAddress...",
   *       extra: { tier: "premium" }
   *     };
   *   }
   *   return null; // Use next parser
   * });
   */
  registerMoneyParser(parser: MoneyParser): ExactTonScheme {
    this.moneyParsers.push(parser);
    return this;
  }

  /**
   * Parses a price into an asset amount.
   * If price is already an AssetAmount, returns it directly.
   * If price is Money (string | number), parses to decimal and tries custom parsers.
   * Falls back to default conversion if all custom parsers return null.
   *
   * @param price - The price to parse
   * @param network - The network to use
   * @returns Promise that resolves to the parsed asset amount
   */
  async parsePrice(price: Price, network: Network): Promise<AssetAmount> {
    // Normalize network to CAIP-2 format
    const normalizedNetwork = normalizeNetwork(network);

    // If already an AssetAmount, return it directly
    if (typeof price === "object" && price !== null && "amount" in price) {
      if (!price.asset) {
        throw new Error(`Asset address must be specified for AssetAmount on network ${network}`);
      }
      return {
        amount: price.amount,
        asset: price.asset,
        extra: price.extra || {},
      };
    }

    // Parse Money to decimal number
    const amount = this.parseMoneyToDecimal(price);

    // Try each custom money parser in order
    for (const parser of this.moneyParsers) {
      const result = await parser(amount, normalizedNetwork);
      if (result !== null) {
        return result;
      }
    }

    // All custom parsers returned null, use default conversion
    return this.defaultMoneyConversion(amount, normalizedNetwork);
  }

  /**
   * Build payment requirements for this scheme/network combination.
   * Adds TON-specific fields like gas sponsor if provided by facilitator.
   *
   * @param paymentRequirements - Base payment requirements with amount/asset already set
   * @param supportedKind - The supported kind from facilitator's /supported endpoint
   * @param extensionKeys - Extensions supported by the facilitator (unused)
   * @returns Enhanced payment requirements ready to be sent to clients
   */
  async enhancePaymentRequirements(
    paymentRequirements: PaymentRequirements,
    supportedKind: {
      t402Version: number;
      scheme: string;
      network: Network;
      extra?: Record<string, unknown>;
    },
    extensionKeys: string[],
  ): Promise<PaymentRequirements> {
    // Mark unused parameters to satisfy linter
    void extensionKeys;

    // Start with existing extra fields
    const extra = { ...paymentRequirements.extra };

    // Add gas sponsor from facilitator if provided
    if (supportedKind.extra?.gasSponsor) {
      extra.gasSponsor = supportedKind.extra.gasSponsor;
    }

    return {
      ...paymentRequirements,
      extra,
    };
  }

  /**
   * Parse Money (string | number) to a decimal number.
   * Handles formats like "$1.50", "1.50", 1.50, etc.
   *
   * @param money - The money value to parse
   * @returns Decimal number
   */
  private parseMoneyToDecimal(money: string | number): number {
    if (typeof money === "number") {
      return money;
    }

    // Remove $ sign and whitespace, then parse
    const cleanMoney = money.replace(/^\$/, "").trim();
    const amount = parseFloat(cleanMoney);

    if (isNaN(amount)) {
      throw new Error(`Invalid money format: ${money}`);
    }

    return amount;
  }

  /**
   * Default money conversion implementation.
   * Converts decimal amount to the preferred Jetton on the specified network.
   *
   * @param amount - The decimal amount (e.g., 1.50)
   * @param network - The network to use
   * @returns The parsed asset amount
   */
  private defaultMoneyConversion(amount: number, network: Network): AssetAmount {
    const jetton = this.getDefaultAsset(network);

    // Convert decimal amount to token amount
    const tokenAmount = this.convertToTokenAmount(amount.toString(), jetton.decimals);

    return {
      amount: tokenAmount,
      asset: jetton.masterAddress,
      extra: {
        symbol: jetton.symbol,
        name: jetton.name,
        decimals: jetton.decimals,
      },
    };
  }

  /**
   * Convert decimal amount to token units (e.g., 0.10 -> 100000 for 6-decimal tokens)
   *
   * @param decimalAmount - The decimal amount to convert
   * @param decimals - Number of decimals for the token
   * @returns The token amount as a string
   */
  private convertToTokenAmount(decimalAmount: string, decimals: number): string {
    const amount = parseFloat(decimalAmount);
    if (isNaN(amount)) {
      throw new Error(`Invalid amount: ${decimalAmount}`);
    }
    // Convert to smallest unit (e.g., for USDT with 6 decimals: 0.10 * 10^6 = 100000)
    const tokenAmount = Math.floor(amount * Math.pow(10, decimals));
    return tokenAmount.toString();
  }

  /**
   * Get the default asset info for a network.
   * Priority: configured preferredJetton > USDT > first available
   *
   * @param network - The network to get asset info for
   * @returns The Jetton configuration
   */
  private getDefaultAsset(
    network: Network,
  ): { masterAddress: string; symbol: string; name: string; decimals: number } {
    // If a preferred Jetton is configured, try to use it
    if (this.config.preferredJetton) {
      const preferred = getJettonConfig(network, this.config.preferredJetton);
      if (preferred) return preferred;
    }

    // Use the network's default token (sorted by priority)
    const defaultJetton = getDefaultJetton(network);
    if (defaultJetton) return defaultJetton;

    throw new Error(`No Jettons configured for network ${network}`);
  }

  /**
   * Get Jetton info for a given symbol on a network
   *
   * @param symbol - The Jetton symbol (e.g., "USDT")
   * @param network - The network to use
   * @returns The Jetton configuration
   */
  private getAssetInfo(
    symbol: string,
    network: Network,
  ): { masterAddress: string; symbol: string; name: string; decimals: number } {
    const jetton = getJettonConfig(network, symbol);
    if (jetton) return jetton;

    // Fallback: treat "USD" as request for default stablecoin
    if (symbol.toUpperCase() === "USD") {
      return this.getDefaultAsset(network);
    }

    throw new Error(`Unsupported Jetton: ${symbol} on network ${network}`);
  }

  /**
   * Get the number of decimals for a Jetton on a network
   *
   * @param network - The network to use
   * @param jettonAddress - Optional Jetton address to look up
   * @returns The number of decimals for the Jetton
   */
  private getAssetDecimals(network: Network, jettonAddress?: string): number {
    if (jettonAddress) {
      const jetton = getJettonByAddress(network, jettonAddress);
      if (jetton) return jetton.decimals;
    }
    // Default to 6 decimals (USDT standard)
    return 6;
  }

  /**
   * Get all supported networks
   */
  static getSupportedNetworks(): string[] {
    return Object.keys(JETTON_REGISTRY);
  }

  /**
   * Check if a network is supported
   */
  static isNetworkSupported(network: string): boolean {
    return network in JETTON_REGISTRY;
  }
}
