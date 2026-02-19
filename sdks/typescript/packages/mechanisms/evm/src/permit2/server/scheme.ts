import {
  AssetAmount,
  Network,
  PaymentRequirements,
  Price,
  SchemeNetworkServer,
  MoneyParser,
} from "@t402/core/types";
import { getDefaultToken, getTokenConfig, TokenConfig, TOKEN_REGISTRY } from "../../tokens.js";
import { PERMIT2_ADDRESS } from "../constants";

/**
 * Configuration options for Permit2EvmScheme server
 */
export interface Permit2EvmSchemeConfig {
  /** Preferred token symbol (e.g., "USDT0", "USDC"). Defaults to network's highest priority token. */
  preferredToken?: string;
}

/**
 * EVM server implementation for the Permit2 payment scheme.
 * Supports USDT0, USDC, and other ERC20 tokens via Uniswap Permit2.
 */
export class Permit2EvmScheme implements SchemeNetworkServer {
  readonly scheme = "permit2";
  private moneyParsers: MoneyParser[] = [];
  private config: Permit2EvmSchemeConfig;

  /**
   * Creates a new Permit2EvmScheme server instance.
   *
   * @param config - Server configuration options
   */
  constructor(config: Permit2EvmSchemeConfig = {}) {
    this.config = config;
  }

  /**
   * Get the list of supported EVM networks.
   *
   * @returns Array of supported network identifiers
   */
  static getSupportedNetworks(): string[] {
    return Object.keys(TOKEN_REGISTRY);
  }

  /**
   * Check if a network is supported.
   *
   * @param network - Network identifier to check
   * @returns Whether the network is supported
   */
  static isNetworkSupported(network: string): boolean {
    return network in TOKEN_REGISTRY;
  }

  /**
   * Register a custom money parser for price conversion.
   *
   * @param parser - The money parser to register
   * @returns This instance for chaining
   */
  registerMoneyParser(parser: MoneyParser): Permit2EvmScheme {
    this.moneyParsers.push(parser);
    return this;
  }

  /**
   * Parse a price into an AssetAmount for the given network.
   *
   * @param price - The price to parse
   * @param network - The target network
   * @returns The parsed asset amount
   */
  async parsePrice(price: Price, network: Network): Promise<AssetAmount> {
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

    const amount = this.parseMoneyToDecimal(price);

    for (const parser of this.moneyParsers) {
      const result = await parser(amount, network);
      if (result !== null) {
        return result;
      }
    }

    return this.defaultMoneyConversion(amount, network);
  }

  /**
   * Enhance payment requirements with Permit2-specific data.
   *
   * @param paymentRequirements - The base payment requirements
   * @param supportedKind - The supported kind metadata
   * @param supportedKind.t402Version - Protocol version
   * @param supportedKind.scheme - Payment scheme
   * @param supportedKind.network - Target network
   * @param supportedKind.extra - Extra metadata
   * @param extensionKeys - Active extension keys
   * @returns Enhanced payment requirements
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
    void supportedKind;
    void extensionKeys;

    // Add permit2Address to extra for clients
    if (!paymentRequirements.extra) {
      paymentRequirements.extra = {};
    }
    paymentRequirements.extra.permit2Address = PERMIT2_ADDRESS;

    return Promise.resolve(paymentRequirements);
  }

  /**
   * Parse a money value into a decimal number.
   *
   * @param money - The money value to parse
   * @returns The decimal amount
   */
  private parseMoneyToDecimal(money: string | number): number {
    if (typeof money === "number") {
      if (!Number.isFinite(money)) {
        throw new Error(`Invalid money value: ${money} (must be a finite number)`);
      }
      return money;
    }

    const cleanMoney = money.replace(/^\$/, "").trim();
    const amount = parseFloat(cleanMoney);

    if (!Number.isFinite(amount)) {
      throw new Error(`Invalid money format: ${money}`);
    }

    return amount;
  }

  /**
   * Convert a decimal amount to a token amount using default network token.
   *
   * @param amount - The decimal amount
   * @param network - The target network
   * @returns The asset amount with token details
   */
  private defaultMoneyConversion(amount: number, network: Network): AssetAmount {
    const token = this.getDefaultAsset(network);

    const tokenAmount = this.convertToTokenAmount(amount.toString(), token.decimals);

    return {
      amount: tokenAmount,
      asset: token.address,
      extra: {
        symbol: token.symbol,
        permit2Address: PERMIT2_ADDRESS,
      },
    };
  }

  /**
   * Convert a decimal amount string to token smallest units.
   *
   * @param decimalAmount - The decimal amount as a string
   * @param decimals - The token's decimal places
   * @returns The amount in smallest units
   */
  private convertToTokenAmount(decimalAmount: string, decimals: number): string {
    if (!/^-?\d+(\.\d+)?$/.test(decimalAmount)) {
      throw new Error(`Invalid amount format: ${decimalAmount}`);
    }

    const [wholePart, fracPart = ""] = decimalAmount.split(".");
    const paddedFrac = fracPart.padEnd(decimals, "0").slice(0, decimals);
    const combined = wholePart + paddedFrac;
    const result = combined.replace(/^0+/, "") || "0";

    return result;
  }

  /**
   * Get the default token asset for a network.
   *
   * @param network - The target network
   * @returns The token configuration
   */
  private getDefaultAsset(network: Network): TokenConfig {
    if (this.config.preferredToken) {
      const preferred = getTokenConfig(network, this.config.preferredToken);
      if (preferred) return preferred;
    }

    const defaultToken = getDefaultToken(network);
    if (defaultToken) return defaultToken;

    throw new Error(`No tokens configured for network ${network}`);
  }
}
