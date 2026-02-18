/**
 * Bitcoin On-chain Server Scheme Implementation
 *
 * Handles price parsing and payment requirement enhancement for
 * Bitcoin on-chain payments using the exact scheme.
 */

import type {
  AssetAmount,
  Network,
  PaymentRequirements,
  Price,
  SchemeNetworkServer,
  MoneyParser,
} from '@t402/core/types'
import { SCHEME_EXACT, SATS_PER_BTC } from '../../constants.js'

/**
 * Configuration options for ExactBtcScheme server
 */
export interface ExactBtcSchemeConfig {
  /**
   * The Bitcoin address to receive payments
   */
  payTo: string
}

/**
 * Bitcoin server implementation for the Exact payment scheme.
 * Handles price parsing and converts user-friendly amounts to satoshis.
 *
 * For Bitcoin, the asset is always "BTC" and amounts are in satoshis.
 */
export class ExactBtcScheme implements SchemeNetworkServer {
  readonly scheme = SCHEME_EXACT
  private moneyParsers: MoneyParser[] = []
  private config: ExactBtcSchemeConfig

  constructor(config: ExactBtcSchemeConfig) {
    this.config = config
  }

  /**
   * Register a custom money parser in the parser chain.
   *
   * @param parser - Custom function to convert amount to AssetAmount (or null to skip)
   * @returns The server instance for chaining
   */
  registerMoneyParser(parser: MoneyParser): ExactBtcScheme {
    this.moneyParsers.push(parser)
    return this
  }

  /**
   * Parses a price into an asset amount in satoshis.
   *
   * Accepts:
   * - Number: treated as USD, converted to satoshis at a default rate
   * - String with $: treated as USD
   * - AssetAmount: returned directly
   *
   * For Bitcoin, amounts are always in satoshis and the asset is "BTC".
   *
   * @param price - The price to parse
   * @param network - The network to use
   * @returns Promise that resolves to the parsed asset amount
   */
  async parsePrice(price: Price, network: Network): Promise<AssetAmount> {
    // If already an AssetAmount, return it directly
    if (typeof price === 'object' && price !== null && 'amount' in price) {
      if (!price.asset) {
        throw new Error(`Asset must be specified for AssetAmount on network ${network}`)
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
      const result = await parser(amount, network)
      if (result !== null) {
        return result
      }
    }

    // Default: treat amount as satoshis directly
    return this.defaultMoneyConversion(amount)
  }

  /**
   * Build payment requirements for this scheme/network combination.
   *
   * @param paymentRequirements - Base payment requirements with amount/asset already set
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
    void supportedKind
    void extensionKeys

    return {
      ...paymentRequirements,
      payTo: paymentRequirements.payTo || this.config.payTo,
      asset: paymentRequirements.asset || 'BTC',
    }
  }

  /**
   * Parse Money (string | number) to a decimal number.
   */
  private parseMoneyToDecimal(money: string | number): number {
    if (typeof money === 'number') {
      if (!Number.isFinite(money)) {
        throw new Error(`Invalid money value: ${money}`)
      }
      return money
    }

    const cleanMoney = money.replace(/^\$/, '').trim()
    const amount = parseFloat(cleanMoney)

    if (isNaN(amount)) {
      throw new Error(`Invalid money format: ${money}`)
    }

    return amount
  }

  /**
   * Default money conversion: treat amount as satoshis.
   * For direct satoshi amounts, the amount is used as-is.
   */
  private defaultMoneyConversion(amount: number): AssetAmount {
    // Amount is treated as satoshis directly
    const sats = Math.floor(amount * SATS_PER_BTC)

    return {
      amount: sats.toString(),
      asset: 'BTC',
      extra: {
        symbol: 'BTC',
        decimals: 8,
      },
    }
  }
}
