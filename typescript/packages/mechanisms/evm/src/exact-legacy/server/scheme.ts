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

  constructor(config: ExactLegacyEvmSchemeConfig = {}) {
    this.config = config;
  }

  /**
   * Register a custom money parser in the parser chain.
   */
  registerMoneyParser(parser: MoneyParser): ExactLegacyEvmScheme {
    this.moneyParsers.push(parser);
    return this;
  }

  /**
   * Parses a price into an asset amount for legacy tokens.
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
      const legacyToken = Object.values(tokens).find((t) => t.tokenType === "legacy");
      if (legacyToken) return legacyToken;
    }

    throw new Error(`No legacy tokens configured for network ${network}`);
  }

  /**
   * Get all supported networks that have legacy tokens
   */
  static getSupportedNetworks(): string[] {
    return Object.keys(USDT_LEGACY_ADDRESSES);
  }

  /**
   * Check if a network has legacy token support
   */
  static isNetworkSupported(network: string): boolean {
    return network in USDT_LEGACY_ADDRESSES;
  }
}
