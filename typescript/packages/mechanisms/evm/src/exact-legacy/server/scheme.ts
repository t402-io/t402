import {
  AssetAmount,
  Network,
  PaymentRequirements,
  Price,
  SchemeNetworkServer,
  MoneyParser,
} from "@t402/core/types";
import {
  getTokenConfig,
  TokenConfig,
  TOKEN_REGISTRY,
  USDT_LEGACY_ADDRESSES,
} from "../../tokens.js";

/**
 * Configuration options for ExactLegacyEvmScheme
 */
export interface ExactLegacyEvmSchemeConfig {
  /** Preferred token symbol. Defaults to "USDT" (legacy USDT) */
  preferredToken?: string;
}

/**
 * EVM server implementation for the exact-legacy payment scheme.
 * Supports legacy tokens that use approve + transferFrom pattern.
 */
export class ExactLegacyEvmScheme implements SchemeNetworkServer {
  readonly scheme = "exact-legacy";
  private moneyParsers: MoneyParser[] = [];
  private config: ExactLegacyEvmSchemeConfig;

  /**
   * Creates a new ExactLegacyEvmScheme instance.
   *
   * @param config - Optional configuration options for the scheme
   */
  constructor(config: ExactLegacyEvmSchemeConfig = {}) {
    this.config = config;
  }

  /**
   * Get all supported networks that have legacy tokens
   *
   * @returns Array of network identifiers with legacy token support
   */
  static getSupportedNetworks(): string[] {
    return Object.keys(USDT_LEGACY_ADDRESSES);
  }

  /**
   * Check if a network has legacy token support
   *
   * @param network - The network identifier to check
   * @returns True if the network has legacy token support
   */
  static isNetworkSupported(network: string): boolean {
    return network in USDT_LEGACY_ADDRESSES;
  }

  /**
   * Register a custom money parser in the parser chain.
   *
   * @param parser - Custom function to convert amount to AssetAmount
   * @returns The scheme instance for method chaining
   */
  registerMoneyParser(parser: MoneyParser): ExactLegacyEvmScheme {
    this.moneyParsers.push(parser);
    return this;
  }

  /**
   * Parses a price into an asset amount for legacy tokens.
   *
   * @param price - The price to parse (Money or AssetAmount)
   * @param network - The network identifier in CAIP-2 format
   * @returns Promise resolving to the parsed asset amount
   */
  async parsePrice(price: Price, network: Network): Promise<AssetAmount> {
    // If already an AssetAmount, return it directly
    if (typeof price === "object" && price !== null && "amount" in price) {
      if (!price.asset) {
        throw new Error(`Asset address must be specified for AssetAmount on network ${network}`);
      }
      return {
        amount: price.amount,
        asset: price.asset,
        extra: {
          ...price.extra,
          tokenType: "legacy",
        },
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
   * Build payment requirements for this scheme/network combination.
   * Adds the spender (facilitator) address to the extra field.
   *
   * @param paymentRequirements - The base payment requirements to enhance
   * @param supportedKind - The supported kind from facilitator
   * @param supportedKind.t402Version - The t402 protocol version
   * @param supportedKind.scheme - The logical payment scheme identifier
   * @param supportedKind.network - The network identifier in CAIP-2 format
   * @param supportedKind.extra - Optional extra metadata with spender address
   * @param extensionKeys - Extension keys supported by the facilitator (unused)
   * @returns Promise resolving to enhanced payment requirements
   */
  enhancePaymentRequirements(
    paymentRequirements: PaymentRequirements,
    supportedKind: {
      t402Version: number;
      scheme: string;
      network: Network;
      extra?: Record<string, unknown>;
    },
    extensionKeys: string[],
  ): Promise<PaymentRequirements> {
    void extensionKeys;

    // Add spender (facilitator) address from supportedKind.extra
    // The facilitator should provide its address in the extra field
    const spender = supportedKind.extra?.spender as string | undefined;

    return Promise.resolve({
      ...paymentRequirements,
      extra: {
        ...paymentRequirements.extra,
        tokenType: "legacy",
        ...(spender && { spender }),
      },
    });
  }

  /**
   * Parse Money (string | number) to a decimal number.
   *
   * @param money - The money value to parse (e.g., "$1.50" or 1.50)
   * @returns The decimal number representation
   */
  private parseMoneyToDecimal(money: string | number): number {
    if (typeof money === "number") {
      return money;
    }

    const cleanMoney = money.replace(/^\$/, "").trim();
    const amount = parseFloat(cleanMoney);

    if (isNaN(amount)) {
      throw new Error(`Invalid money format: ${money}`);
    }

    return amount;
  }

  /**
   * Default money conversion implementation for legacy tokens.
   *
   * @param amount - The decimal amount to convert (e.g., 1.50)
   * @param network - The network identifier in CAIP-2 format
   * @returns The asset amount in token units
   */
  private defaultMoneyConversion(amount: number, network: Network): AssetAmount {
    const token = this.getDefaultAsset(network);

    const tokenAmount = this.convertToTokenAmount(amount.toString(), token.decimals);

    return {
      amount: tokenAmount,
      asset: token.address,
      extra: {
        name: token.name,
        version: token.version,
        symbol: token.symbol,
        tokenType: "legacy",
      },
    };
  }

  /**
   * Convert decimal amount to token units
   *
   * @param decimalAmount - The decimal amount as a string (e.g., "1.50")
   * @param decimals - The number of decimal places for the token
   * @returns The token amount as a string in smallest units
   */
  private convertToTokenAmount(decimalAmount: string, decimals: number): string {
    const amount = parseFloat(decimalAmount);
    if (isNaN(amount)) {
      throw new Error(`Invalid amount: ${decimalAmount}`);
    }
    const tokenAmount = Math.floor(amount * Math.pow(10, decimals));
    return tokenAmount.toString();
  }

  /**
   * Get the default legacy token for a network.
   *
   * @param network - The network identifier in CAIP-2 format
   * @returns The token configuration for the default legacy token
   */
  private getDefaultAsset(network: Network): TokenConfig {
    // If a preferred token is configured, try to use it
    if (this.config.preferredToken) {
      const preferred = getTokenConfig(network, this.config.preferredToken);
      if (preferred && preferred.tokenType === "legacy") {
        return preferred;
      }
    }

    // Look for legacy USDT on this network
    const usdt = getTokenConfig(network, "USDT");
    if (usdt && usdt.tokenType === "legacy") {
      return usdt;
    }

    // Fallback: find any legacy token on this network
    const tokens = TOKEN_REGISTRY[network];
    if (tokens) {
      const legacyToken = Object.values(tokens).find(t => t.tokenType === "legacy");
      if (legacyToken) return legacyToken;
    }

    throw new Error(`No legacy tokens configured for network ${network}`);
  }
}
