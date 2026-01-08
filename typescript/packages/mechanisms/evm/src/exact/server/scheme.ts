import {
  AssetAmount,
  Network,
  PaymentRequirements,
  Price,
  SchemeNetworkServer,
  MoneyParser,
} from "@t402/core/types";
import {
  getDefaultToken,
  getTokenConfig,
  getTokenByAddress,
  TokenConfig,
  TOKEN_REGISTRY,
} from "../../tokens.js";

/**
 * Configuration options for ExactEvmScheme
 */
export interface ExactEvmSchemeConfig {
  /** Preferred token symbol (e.g., "USDT0", "USDC"). Defaults to network's highest priority token. */
  preferredToken?: string;
}

/**
 * EVM server implementation for the Exact payment scheme.
 * Supports USDT0, USDC, and other EIP-3009 compatible tokens.
 */
export class ExactEvmScheme implements SchemeNetworkServer {
  readonly scheme = "exact";
  private moneyParsers: MoneyParser[] = [];
  private config: ExactEvmSchemeConfig;

  constructor(config: ExactEvmSchemeConfig = {}) {
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
   * evmServer.registerMoneyParser(async (amount, network) => {
   *   // Custom conversion logic
   *   if (amount > 100) {
   *     // Use different token for large amounts
   *     return { amount: (amount * 1e18).toString(), asset: "0xCustomToken" };
   *   }
   *   return null; // Use next parser
   * });
   */
  registerMoneyParser(parser: MoneyParser): ExactEvmScheme {
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
      const result = await parser(amount, network);
      if (result !== null) {
        return result;
      }
    }

    // All custom parsers returned null, use default conversion
    return this.defaultMoneyConversion(amount, network);
  }

  /**
   * Build payment requirements for this scheme/network combination
   *
   * @param paymentRequirements - The base payment requirements
   * @param supportedKind - The supported kind from facilitator (unused)
   * @param supportedKind.t402Version - The t402 version
   * @param supportedKind.scheme - The logical payment scheme
   * @param supportedKind.network - The network identifier in CAIP-2 format
   * @param supportedKind.extra - Optional extra metadata regarding scheme/network implementation details
   * @param extensionKeys - Extension keys supported by the facilitator (unused)
   * @returns Payment requirements ready to be sent to clients
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
    // Mark unused parameters to satisfy linter
    void supportedKind;
    void extensionKeys;
    return Promise.resolve(paymentRequirements);
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
   * Converts decimal amount to the preferred token on the specified network.
   * Priority: USDT0 > USDC > other configured tokens
   *
   * @param amount - The decimal amount (e.g., 1.50)
   * @param network - The network to use
   * @returns The parsed asset amount
   */
  private defaultMoneyConversion(amount: number, network: Network): AssetAmount {
    const token = this.getDefaultAsset(network);

    // Convert decimal amount to token amount
    const tokenAmount = this.convertToTokenAmount(amount.toString(), network, token.decimals);

    return {
      amount: tokenAmount,
      asset: token.address,
      extra: {
        name: token.name,
        version: token.version,
        symbol: token.symbol,
        tokenType: token.tokenType,
      },
    };
  }

  /**
   * Convert decimal amount to token units (e.g., 0.10 -> 100000 for 6-decimal tokens)
   *
   * @param decimalAmount - The decimal amount to convert
   * @param network - The network to use
   * @param decimals - Optional number of decimals (defaults to network asset decimals)
   * @returns The token amount as a string
   */
  private convertToTokenAmount(decimalAmount: string, network: Network, decimals?: number): string {
    const tokenDecimals = decimals ?? this.getAssetDecimals(network);
    const amount = parseFloat(decimalAmount);
    if (isNaN(amount)) {
      throw new Error(`Invalid amount: ${decimalAmount}`);
    }
    // Convert to smallest unit (e.g., for USDC/USDT with 6 decimals: 0.10 * 10^6 = 100000)
    const tokenAmount = Math.floor(amount * Math.pow(10, tokenDecimals));
    return tokenAmount.toString();
  }

  /**
   * Get the default asset info for a network.
   * Priority: configured preferredToken > USDT0 > USDC > first available
   *
   * @param network - The network to get asset info for
   * @returns The asset information including address, name, version, and decimals
   */
  private getDefaultAsset(network: Network): TokenConfig {
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
   * Get asset info for a given symbol on a network
   *
   * @param symbol - The asset symbol (e.g., "USDT0", "USDC", "USDT")
   * @param network - The network to use
   * @returns The token configuration
   */
  private getAssetInfo(symbol: string, network: Network): TokenConfig {
    const token = getTokenConfig(network, symbol);
    if (token) return token;

    // Fallback: treat "USD" as request for default stablecoin
    if (symbol.toUpperCase() === "USD") {
      return this.getDefaultAsset(network);
    }

    throw new Error(`Unsupported asset: ${symbol} on network ${network}`);
  }

  /**
   * Get the number of decimals for the asset on a network
   *
   * @param network - The network to use
   * @param tokenAddress - Optional token address to look up
   * @returns The number of decimals for the asset
   */
  private getAssetDecimals(network: Network, tokenAddress?: string): number {
    if (tokenAddress) {
      const token = getTokenByAddress(network, tokenAddress as `0x${string}`);
      if (token) return token.decimals;
    }
    // Default to 6 decimals (USDC/USDT standard)
    return 6;
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
