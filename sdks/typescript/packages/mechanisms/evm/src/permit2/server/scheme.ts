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
  TokenConfig,
  TOKEN_REGISTRY,
} from "../../tokens.js";
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

  constructor(config: Permit2EvmSchemeConfig = {}) {
    this.config = config;
  }

  static getSupportedNetworks(): string[] {
    return Object.keys(TOKEN_REGISTRY);
  }

  static isNetworkSupported(network: string): boolean {
    return network in TOKEN_REGISTRY;
  }

  registerMoneyParser(parser: MoneyParser): Permit2EvmScheme {
    this.moneyParsers.push(parser);
    return this;
  }

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
