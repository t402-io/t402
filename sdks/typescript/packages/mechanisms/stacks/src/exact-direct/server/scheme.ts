/**
 * Stacks Exact-Direct Server Scheme
 *
 * Handles price parsing and payment requirement enhancement for
 * Stacks payments using the exact-direct scheme.
 */

import type {
  SchemeNetworkServer,
  PaymentRequirements,
  Price,
  AssetAmount,
  Network,
  MoneyParser,
} from "@t402/core/types";
import { SCHEME_EXACT_DIRECT, isStacksNetwork } from "../../constants.js";
import { getDefaultToken, getTokenConfig, TOKEN_REGISTRY } from "../../tokens.js";
import { parseAmount } from "../../utils.js";

/**
 * Configuration for ExactDirectStacksServer
 */
export interface ExactDirectStacksServerConfig {
  /** Preferred token symbol (e.g., "sUSDC"). Defaults to network's default token. */
  preferredToken?: string;
}

/**
 * Stacks Exact-Direct Server
 *
 * Implements the server-side price parsing and payment requirements enhancement.
 */
export class ExactDirectStacksServer implements SchemeNetworkServer {
  readonly scheme = SCHEME_EXACT_DIRECT;
  private moneyParsers: MoneyParser[] = [];
  private config: ExactDirectStacksServerConfig;

  constructor(config: ExactDirectStacksServerConfig = {}) {
    this.config = config;
  }

  /**
   * Register a custom money parser in the parser chain.
   */
  registerMoneyParser(parser: MoneyParser): ExactDirectStacksServer {
    this.moneyParsers.push(parser);
    return this;
  }

  /**
   * Parse price into Stacks-specific amount
   */
  async parsePrice(price: Price, network: Network): Promise<AssetAmount> {
    // Validate network
    if (!isStacksNetwork(network)) {
      throw new Error(`Invalid Stacks network: ${network}`);
    }

    // If already an AssetAmount, return it directly
    if (typeof price === "object" && price !== null && "amount" in price) {
      if (!price.asset) {
        throw new Error(`Asset must be specified for AssetAmount on network ${network}`);
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
      const result = await parser(amount, network);
      if (result !== null) {
        return result;
      }
    }

    // All custom parsers returned null, use default conversion
    return this.defaultMoneyConversion(amount, network);
  }

  /**
   * Enhance payment requirements with Stacks-specific details
   */
  async enhancePaymentRequirements(
    paymentRequirements: PaymentRequirements,
    supportedKind: {
      t402Version: number;
      scheme: string;
      network: Network;
      extra?: Record<string, unknown>;
    },
    facilitatorExtensions: string[],
  ): Promise<PaymentRequirements> {
    // Mark unused parameters
    void facilitatorExtensions;

    // Start with existing extra fields
    const extra = { ...paymentRequirements.extra };

    // Add any facilitator-provided extra fields
    if (supportedKind.extra?.contractAddress) {
      extra.contractAddress = supportedKind.extra.contractAddress;
    }
    if (supportedKind.extra?.assetSymbol) {
      extra.assetSymbol = supportedKind.extra.assetSymbol;
    }
    if (supportedKind.extra?.assetDecimals) {
      extra.assetDecimals = supportedKind.extra.assetDecimals;
    }
    if (supportedKind.extra?.networkName) {
      extra.networkName = supportedKind.extra.networkName;
    }

    return {
      ...paymentRequirements,
      extra,
    };
  }

  /**
   * Parse Money (string | number) to a decimal number.
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
   */
  private defaultMoneyConversion(amount: number, network: Network): AssetAmount {
    const token = this.getDefaultAsset(network);

    // Convert decimal amount to token amount
    const tokenAmount = parseAmount(amount.toString(), token.decimals);

    return {
      amount: tokenAmount.toString(),
      asset: this.createAssetIdentifier(network, token.contractAddress),
      extra: {
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        contractAddress: token.contractAddress,
      },
    };
  }

  /**
   * Create a CAIP-19 asset identifier for Stacks tokens
   */
  private createAssetIdentifier(
    network: Network,
    contractAddress: string,
  ): string {
    return `${network}/sip010:${contractAddress}`;
  }

  /**
   * Get the default asset info for a network.
   */
  private getDefaultAsset(
    network: Network,
  ): { contractAddress: string; symbol: string; name: string; decimals: number } {
    // If a preferred token is configured, try to use it
    if (this.config.preferredToken) {
      const preferred = getTokenConfig(network, this.config.preferredToken);
      if (preferred) return preferred;
    }

    // Use the network's default token
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

/**
 * Create an exact-direct server for Stacks
 */
export function createExactDirectStacksServer(
  config: ExactDirectStacksServerConfig = {},
): ExactDirectStacksServer {
  return new ExactDirectStacksServer(config);
}
