/**
 * TRON Exact Payment Scheme - Server Implementation
 *
 * Parses prices and enhances payment requirements for TRC20 payments.
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
import { normalizeNetwork, convertToSmallestUnits } from "../../utils.js";
import { getDefaultToken, getTRC20Config, isNetworkSupported } from "../../tokens.js";

/**
 * Configuration for ExactTronScheme (server)
 */
export type ExactTronSchemeConfig = {
  /** Preferred token symbol (default: highest priority) */
  preferredToken?: string;
};

/**
 * Server-side implementation of the TRON exact payment scheme
 *
 * This scheme parses prices and prepares payment requirements
 * for TRC20 token transfers.
 */
export class ExactTronScheme implements SchemeNetworkServer {
  readonly scheme = SCHEME_EXACT;
  private readonly _config: ExactTronSchemeConfig;
  private readonly moneyParsers: MoneyParser[] = []

  constructor(config?: ExactTronSchemeConfig) {
    this._config = config ?? {};
  }

  /**
   * Register a custom money parser
   *
   * Parsers are tried in registration order. Return null to pass to next parser.
   *
   * @param parser - Money parser function
   * @returns This scheme for chaining
   */
  registerMoneyParser(parser: MoneyParser): ExactTronScheme {
    this.moneyParsers.push(parser);
    return this;
  }

  /**
   * Parse a price into an asset amount
   *
   * @param price - Price to parse (string, number, or AssetAmount)
   * @param network - Target network
   * @returns Parsed asset amount
   */
  async parsePrice(price: Price, network: Network): Promise<AssetAmount> {
    const normalizedNetwork = normalizeNetwork(String(network));

    // Validate network support
    if (!isNetworkSupported(normalizedNetwork)) {
      throw new Error(`Unsupported network: ${network}`);
    }

    // If already an AssetAmount, return it
    if (typeof price === "object" && price !== null && "amount" in price) {
      const assetAmount = price as AssetAmount;
      return {
        amount: assetAmount.amount,
        asset: assetAmount.asset || this.getDefaultAsset(normalizedNetwork),
        extra: assetAmount.extra,
      };
    }

    // Parse money to decimal
    const decimalAmount = this.parseMoneyToDecimal(price);

    // Try custom parsers first
    for (const parser of this.moneyParsers) {
      try {
        const result = await parser(decimalAmount, network);
        if (result !== null) {
          return result;
        }
      } catch {
        // Parser failed, try next one
        continue;
      }
    }

    // Use default conversion (USDT with 6 decimals)
    return this.defaultMoneyConversion(decimalAmount, normalizedNetwork);
  }

  /**
   * Enhance payment requirements with scheme-specific data
   *
   * @param requirements - Base payment requirements
   * @param supportedKind - Supported payment kind
   * @param extensionKeys - Extension keys to include
   * @returns Enhanced payment requirements
   */
  async enhancePaymentRequirements(
    requirements: PaymentRequirements,
    supportedKind: {
      t402Version: number;
      scheme: string;
      network: Network;
      extra?: Record<string, unknown>;
    },
    extensionKeys: string[],
  ): Promise<PaymentRequirements> {
    void extensionKeys;
    const network = normalizeNetwork(String(requirements.network));

    // Get token config
    let tokenConfig = requirements.asset
      ? getTRC20Config(network, requirements.asset) || this.getTokenByAddress(network, requirements.asset)
      : getDefaultToken(network);

    if (!tokenConfig) {
      tokenConfig = getDefaultToken(network);
    }

    // Initialize extra if needed
    const extra: Record<string, unknown> = { ...requirements.extra };

    // Add token metadata
    if (tokenConfig) {
      extra.symbol = tokenConfig.symbol;
      extra.name = tokenConfig.name;
      extra.decimals = tokenConfig.decimals;
    }

    // Copy extension data
    if (supportedKind.extra) {
      for (const key of extensionKeys) {
        if (key in supportedKind.extra) {
          extra[key] = supportedKind.extra[key];
        }
      }
    }

    return {
      ...requirements,
      asset: tokenConfig?.contractAddress || requirements.asset,
      extra,
    };
  }

  /**
   * Parse money (string/number) to decimal number
   */
  private parseMoneyToDecimal(price: Price): number {
    if (typeof price === "number") {
      return price;
    }

    if (typeof price === "string") {
      // Remove currency symbols and whitespace
      let cleanPrice = price.trim();
      cleanPrice = cleanPrice.replace(/^\$/, "").trim();

      // Parse the numeric part
      const parts = cleanPrice.split(/\s+/);
      const numericPart = parts[0];
      const parsed = parseFloat(numericPart);

      if (isNaN(parsed)) {
        throw new Error(`Failed to parse price: ${price}`);
      }

      return parsed;
    }

    throw new Error(`Invalid price type: ${typeof price}`);
  }

  /**
   * Default money to asset conversion
   * Uses preferredToken from config if set, otherwise falls back to network default
   */
  private defaultMoneyConversion(decimalAmount: number, network: string): AssetAmount {
    // Try preferred token first if configured
    let tokenConfig = this._config.preferredToken
      ? getTRC20Config(network, this._config.preferredToken)
      : undefined;

    // Fall back to network default
    if (!tokenConfig) {
      tokenConfig = getDefaultToken(network);
    }

    if (!tokenConfig) {
      throw new Error(`No default token for network: ${network}`);
    }

    const amount = convertToSmallestUnits(decimalAmount.toFixed(6), tokenConfig.decimals);

    return {
      amount,
      asset: tokenConfig.contractAddress,
      extra: {
        symbol: tokenConfig.symbol,
        name: tokenConfig.name,
        decimals: tokenConfig.decimals,
      },
    };
  }

  /**
   * Get default asset address for network
   */
  private getDefaultAsset(network: string): string {
    const tokenConfig = getDefaultToken(network);
    if (!tokenConfig) {
      throw new Error(`No default token for network: ${network}`);
    }
    return tokenConfig.contractAddress;
  }

  /**
   * Get token config by contract address
   */
  private getTokenByAddress(network: string, address: string): { contractAddress: string; symbol: string; name: string; decimals: number } | undefined {
    // Import dynamically to avoid circular deps
    const { getTokenByAddress } = require("../../tokens.js");
    return getTokenByAddress(network, address);
  }
}
