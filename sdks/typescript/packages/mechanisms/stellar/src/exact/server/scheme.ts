/**
 * Stellar Server Scheme Implementation
 *
 * Handles price parsing and payment requirement enhancement for
 * Stellar Soroban token payments using the exact scheme.
 */

import type {
  AssetAmount,
  Network,
  PaymentRequirements,
  Price,
  SchemeNetworkServer,
  MoneyParser,
} from '@t402/core/types'
import { SCHEME_EXACT } from '../../constants.js'
import { getDefaultToken, getTokenConfig, TOKEN_REGISTRY } from '../../tokens.js'
import { normalizeNetwork } from '../../utils.js'

/**
 * Configuration options for ExactStellarScheme server
 */
export interface ExactStellarSchemeConfig {
  /** Preferred token symbol (e.g., "USDC"). Defaults to network's highest priority token. */
  preferredToken?: string
}

/**
 * Stellar server implementation for the Exact payment scheme.
 * Handles price parsing and converts user-friendly amounts to token amounts.
 */
export class ExactStellarScheme implements SchemeNetworkServer {
  readonly scheme = SCHEME_EXACT
  private moneyParsers: MoneyParser[] = []
  private config: ExactStellarSchemeConfig

  constructor(config: ExactStellarSchemeConfig = {}) {
    this.config = config
  }

  /**
   * Register a custom money parser in the parser chain.
   *
   * @param parser - Custom function to convert amount to AssetAmount (or null to skip)
   * @returns The server instance for chaining
   */
  registerMoneyParser(parser: MoneyParser): ExactStellarScheme {
    this.moneyParsers.push(parser)
    return this
  }

  /**
   * Parses a price into an asset amount.
   *
   * @param price - The price to parse
   * @param network - The network to use
   * @returns Promise that resolves to the parsed asset amount
   */
  async parsePrice(price: Price, network: Network): Promise<AssetAmount> {
    const normalizedNetwork = normalizeNetwork(network)

    // If already an AssetAmount, return it directly
    if (typeof price === 'object' && price !== null && 'amount' in price) {
      if (!price.asset) {
        throw new Error(`Asset address must be specified for AssetAmount on network ${network}`)
      }
      return {
        amount: price.amount,
        asset: price.asset,
        extra: price.extra || {},
      }
    }

    // Parse Money to decimal number
    const amount = this.parseMoneyToDecimal(price)

    // Try each custom money parser in order
    for (const parser of this.moneyParsers) {
      const result = await parser(amount, normalizedNetwork)
      if (result !== null) {
        return result
      }
    }

    // All custom parsers returned null, use default conversion
    return this.defaultMoneyConversion(amount, normalizedNetwork)
  }

  /**
   * Build payment requirements for this scheme/network combination.
   *
   * @param paymentRequirements - Base payment requirements
   * @param supportedKind - The supported kind from facilitator
   * @param extensionKeys - Extensions supported by the facilitator
   * @returns Enhanced payment requirements
   */
  async enhancePaymentRequirements(
    paymentRequirements: PaymentRequirements,
    supportedKind: {
      t402Version: number
      scheme: string
      network: Network
      extra?: Record<string, unknown>
    },
    extensionKeys: string[],
  ): Promise<PaymentRequirements> {
    void extensionKeys

    const extra = { ...paymentRequirements.extra }

    // Add fee sponsor from facilitator if provided
    if (supportedKind.extra?.feeSponsor) {
      extra.feeSponsor = supportedKind.extra.feeSponsor
    }

    return {
      ...paymentRequirements,
      extra,
    }
  }

  private parseMoneyToDecimal(money: string | number): number {
    if (typeof money === 'number') {
      return money
    }

    const cleanMoney = money.replace(/^\$/, '').trim()
    const amount = parseFloat(cleanMoney)

    if (isNaN(amount)) {
      throw new Error(`Invalid money format: ${money}`)
    }

    return amount
  }

  private defaultMoneyConversion(amount: number, network: Network): AssetAmount {
    const token = this.getDefaultAsset(network)

    const tokenAmount = this.convertToTokenAmount(amount.toString(), token.decimals)

    return {
      amount: tokenAmount,
      asset: token.contractAddress,
      extra: {
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
      },
    }
  }

  private convertToTokenAmount(decimalAmount: string, decimals: number): string {
    const amount = parseFloat(decimalAmount)
    if (isNaN(amount)) {
      throw new Error(`Invalid amount: ${decimalAmount}`)
    }
    const tokenAmount = Math.floor(amount * Math.pow(10, decimals))
    return tokenAmount.toString()
  }

  private getDefaultAsset(network: Network): {
    contractAddress: string
    symbol: string
    name: string
    decimals: number
  } {
    if (this.config.preferredToken) {
      const preferred = getTokenConfig(network, this.config.preferredToken)
      if (preferred) return preferred
    }

    const defaultToken = getDefaultToken(network)
    if (defaultToken) return defaultToken

    throw new Error(`No tokens configured for network ${network}`)
  }

  static getSupportedNetworks(): string[] {
    return Object.keys(TOKEN_REGISTRY)
  }

  static isNetworkSupported(network: string): boolean {
    return network in TOKEN_REGISTRY
  }
}
