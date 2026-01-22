/**
 * NEAR Server Scheme Implementation - Exact Direct
 *
 * Handles price parsing and payment requirement enhancement for
 * NEAR NEP-141 payments using the exact-direct scheme.
 */

import type {
  AssetAmount,
  Network,
  PaymentRequirements,
  Price,
  SchemeNetworkServer,
  MoneyParser,
} from "@t402/core/types";
import { SCHEME_EXACT_DIRECT } from "../../constants.js";
import { getDefaultToken, getTokenConfig, TOKEN_REGISTRY } from "../../tokens.js";
import { normalizeNetwork, toTokenUnits } from "../../utils.js";

/**
 * Configuration options for ExactDirectNearServer
 */
export interface ExactDirectNearServerConfig {
  /** Preferred token symbol (e.g., "USDC"). Defaults to network's highest priority token. */
  preferredToken?: string;
}

/**
 * NEAR server implementation for the Exact-Direct payment scheme.
 * Handles price parsing and converts user-friendly amounts to token amounts.
 */
export class ExactDirectNearServer implements SchemeNetworkServer {
  readonly scheme = SCHEME_EXACT_DIRECT;
  private moneyParsers: MoneyParser[] = [];
  private config: ExactDirectNearServerConfig;

  constructor(config: ExactDirectNearServerConfig = {}) {
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
   */
  registerMoneyParser(parser: MoneyParser): ExactDirectNearServer {
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
   *
   * @param paymentRequirements - Base payment requirements with amount/asset already set
   * @param supportedKind - The supported kind from facilitator's /supported endpoint
   * @param extensionKeys - Extensions supported by the facilitator
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

    // Add any facilitator-provided extra fields
    if (supportedKind.extra?.assetSymbol) {
      extra.assetSymbol = supportedKind.extra.assetSymbol;
    }
    if (supportedKind.extra?.assetDecimals) {
      extra.assetDecimals = supportedKind.extra.assetDecimals;
    }

    return {
      ...paymentRequirements,
      extra,
    };
  }

  /**
   * Parse Money (string | number) to a decimal number.
   * Handles formats like "$1.50", "1.50", 1.50, etc.
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
   * Converts decimal amount to the preferred token on the specified network.
   */
  private defaultMoneyConversion(amount: number, network: Network): AssetAmount {
    const token = this.getDefaultAsset(network);

    // Convert decimal amount to token amount
    const tokenAmount = toTokenUnits(amount, token.decimals);

    return {
      amount: tokenAmount.toString(),
      asset: token.contractId,
      extra: {
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
      },
    };
  }

  /**
   * Get the default asset info for a network.
   * Priority: configured preferredToken > network default
   */
  private getDefaultAsset(network: Network): {
    contractId: string;
    symbol: string;
    name: string;
    decimals: number;
  } {
    // If a preferred token is configured, try to use it
    if (this.config.preferredToken) {
      const preferred = getTokenConfig(network, this.config.preferredToken);
      if (preferred) return preferred;
    }

    // Use the network's default token (sorted by priority)
    const defaultToken = getDefaultToken(network);
    if (defaultToken) return defaultToken;

    throw new Error(`No tokens configured for network ${network}`);
  }

  /**
   * Get all supported networks
   */
  static getSupportedNetworks(): string[] {
    return Object.keys(TOKEN_REGISTRY);
  }

  /**
   * Check if a network is supported
   */
  static isNetworkSupported(network: string): boolean {
    return network in TOKEN_REGISTRY;
  }
}
