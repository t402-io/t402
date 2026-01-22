import {
  AssetAmount,
  Network,
  PaymentRequirements,
  Price,
  SchemeNetworkServer,
  MoneyParser,
  UPTO_DEFAULTS,
} from "@t402/core/types";
import {
  getDefaultToken,
  getTokenConfig,
  getTokenByAddress,
  TokenConfig,
  TOKEN_REGISTRY,
} from "../../tokens.js";

/**
 * Configuration options for UptoEvmServerScheme
 */
export interface UptoEvmServerSchemeConfig {
  /** Preferred token symbol (e.g., "USDT0", "USDC"). Defaults to network's highest priority token. */
  preferredToken?: string;

  /** Router contract address for upto payments. If not set, payTo address is used as spender. */
  routerAddress?: string;

  /** Default billing unit */
  defaultUnit?: string;

  /** Default unit price in smallest denomination */
  defaultUnitPrice?: string;
}

/**
 * EVM server implementation for the Up-To payment scheme.
 *
 * Enables usage-based billing by creating payment requirements
 * that authorize up to a maximum amount, with actual settlement
 * determined by usage.
 *
 * @example
 * ```typescript
 * import { UptoEvmServerScheme } from "@t402/evm/upto/server";
 *
 * const scheme = new UptoEvmServerScheme({
 *   routerAddress: "0x...",  // T402UptoRouter contract
 *   defaultUnit: "token",
 *   defaultUnitPrice: "100", // $0.0001 per token
 * });
 *
 * server.registerScheme("eip155:8453", scheme);
 * ```
 */
export class UptoEvmServerScheme implements SchemeNetworkServer {
  readonly scheme = "upto";
  private moneyParsers: MoneyParser[] = [];
  private config: UptoEvmServerSchemeConfig;

  /**
   * Creates a new UptoEvmServerScheme instance.
   *
   * @param config - Optional configuration options for the scheme
   */
  constructor(config: UptoEvmServerSchemeConfig = {}) {
    this.config = config;
  }

  /**
   * Get all supported networks
   *
   * @returns Array of network identifiers in CAIP-2 format
   */
  static getSupportedNetworks(): string[] {
    return Object.keys(TOKEN_REGISTRY);
  }

  /**
   * Check if a network is supported
   *
   * @param network - The network identifier to check
   * @returns True if the network is supported
   */
  static isNetworkSupported(network: string): boolean {
    return network in TOKEN_REGISTRY;
  }

  /**
   * Register a custom money parser in the parser chain.
   *
   * @param parser - Custom function to convert amount to AssetAmount
   * @returns The server instance for chaining
   */
  registerMoneyParser(parser: MoneyParser): UptoEvmServerScheme {
    this.moneyParsers.push(parser);
    return this;
  }

  /**
   * Parses a price into an asset amount for maxAmount.
   *
   * @param price - The price to parse (represents maxAmount)
   * @param network - The network to use
   * @returns Promise resolving to the parsed asset amount
   */
  async parsePrice(price: Price, network: Network): Promise<AssetAmount> {
    // If already an AssetAmount, return it directly
    if (typeof price === "object" && price !== null && "amount" in price) {
      if (!price.asset) {
        const token = this.getPreferredToken(network);
        return { amount: price.amount, asset: token.address };
      }
      return price as AssetAmount;
    }

    // Parse string/number price to decimal
    const decimalAmount = this.parseToDecimal(price);

    // Try custom parsers first
    for (const parser of this.moneyParsers) {
      const result = await parser(decimalAmount, network);
      if (result !== null) {
        return result;
      }
    }

    // Default: convert to token's smallest denomination
    const token = this.getPreferredToken(network);
    const amount = Math.floor(decimalAmount * 10 ** token.decimals).toString();

    return {
      amount,
      asset: token.address,
    };
  }

  /**
   * Enhance payment requirements for the upto scheme.
   *
   * @param paymentRequirements - Base payment requirements
   * @param supportedKind - The supported kind from facilitator
   * @param facilitatorExtensions - Extensions supported by the facilitator
   * @returns Enhanced payment requirements for upto scheme
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
    // Mark unused parameter to satisfy linter
    void facilitatorExtensions;

    const network = supportedKind.network;
    const token = getTokenByAddress(network, paymentRequirements.asset as `0x${string}`);

    if (!token) {
      throw new Error(`Unknown token ${paymentRequirements.asset} on ${network}`);
    }

    // Build extra with EIP-712 domain and upto-specific fields
    const extra: Record<string, unknown> = {
      // EIP-712 domain (required for permit signing)
      name: token.name,
      version: token.version,

      // Router address (optional - if set, permits go to router)
      ...(this.config.routerAddress && { routerAddress: this.config.routerAddress }),

      // Billing unit info (optional)
      ...(this.config.defaultUnit && { unit: this.config.defaultUnit }),
      ...(this.config.defaultUnitPrice && { unitPrice: this.config.defaultUnitPrice }),

      // Upto-specific fields
      maxAmount: paymentRequirements.amount,
      minAmount: UPTO_DEFAULTS.MIN_AMOUNT,

      // Merge any facilitator extra
      ...supportedKind.extra,
    };

    return {
      ...paymentRequirements,
      scheme: "upto",
      extra,
    };
  }

  /**
   * Get the preferred token for a network.
   *
   * @param network - The network identifier
   * @returns Token configuration
   * @throws Error if no token is found for the network
   */
  private getPreferredToken(network: Network): TokenConfig {
    if (this.config.preferredToken) {
      const token = getTokenConfig(network, this.config.preferredToken);
      if (token) return token;
    }
    const defaultToken = getDefaultToken(network);
    if (!defaultToken) {
      throw new Error(`No token configured for network ${network}`);
    }
    return defaultToken;
  }

  /**
   * Parse price to decimal value.
   *
   * @param price - Price string or number
   * @returns Decimal amount
   */
  private parseToDecimal(price: string | number): number {
    if (typeof price === "number") {
      return price;
    }

    // Remove currency symbols and parse
    const cleaned = price.replace(/[$,]/g, "").trim();
    const parsed = parseFloat(cleaned);

    if (isNaN(parsed)) {
      throw new Error(`Invalid price format: ${price}`);
    }

    return parsed;
  }
}

/**
 * Factory function to create an UptoEvmServerScheme.
 *
 * @param config - Configuration options
 * @returns A new UptoEvmServerScheme instance
 */
export function createUptoEvmServerScheme(config?: UptoEvmServerSchemeConfig): UptoEvmServerScheme {
  return new UptoEvmServerScheme(config);
}
