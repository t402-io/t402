/**
 * Tezos Exact-Direct Server Scheme
 *
 * Handles price parsing and payment requirement enhancement for
 * Tezos FA2 payments using the exact-direct scheme.
 */

import type {
  SchemeNetworkServer,
  PaymentRequirements,
  Price,
  AssetAmount,
  Network,
  MoneyParser,
} from "@t402/core/types";
import { SCHEME_EXACT_DIRECT } from "../../constants.js";
import { getTokenBySymbol, getDefaultToken, TOKEN_REGISTRY } from "../../tokens.js";
import { parseAmount } from "../../utils.js";
import { isTezosNetwork } from "../../types.js";

/**
 * Configuration for ExactDirectTezosServer
 */
export interface ExactDirectTezosServerConfig {
  /** Preferred token symbol (e.g., "USDt"). Defaults to network's default token. */
  preferredToken?: string;
}

/**
 * Tezos Exact-Direct Server
 *
 * Implements the server-side price parsing and payment requirements enhancement.
 */
export class ExactDirectTezosServer implements SchemeNetworkServer {
  readonly scheme = SCHEME_EXACT_DIRECT;
  private moneyParsers: MoneyParser[] = [];
  private config: ExactDirectTezosServerConfig;

  constructor(config: ExactDirectTezosServerConfig = {}) {
    this.config = config;
  }

  /**
   * Register a custom money parser in the parser chain.
   */
  registerMoneyParser(parser: MoneyParser): ExactDirectTezosServer {
    this.moneyParsers.push(parser);
    return this;
  }

  /**
   * Parse price into Tezos-specific amount
   */
  async parsePrice(price: Price, network: Network): Promise<AssetAmount> {
    // Validate network
    if (!isTezosNetwork(network)) {
      throw new Error(`Invalid Tezos network: ${network}`);
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
   * Enhance payment requirements with Tezos-specific details
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
      asset: this.createAssetIdentifier(network, token.contractAddress, token.tokenId),
      extra: {
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        tokenId: token.tokenId,
      },
    };
  }

  /**
   * Create a CAIP-19 asset identifier for Tezos FA2
   */
  private createAssetIdentifier(
    network: Network,
    contractAddress: string,
    tokenId: number,
  ): string {
    return `${network}/fa2:${contractAddress}/${tokenId}`;
  }

  /**
   * Get the default asset info for a network.
   */
  private getDefaultAsset(
    network: Network,
  ): { contractAddress: string; tokenId: number; symbol: string; name: string; decimals: number } {
    // If a preferred token is configured, try to use it
    if (this.config.preferredToken) {
      const preferred = getTokenBySymbol(network, this.config.preferredToken);
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

export default ExactDirectTezosServer;
