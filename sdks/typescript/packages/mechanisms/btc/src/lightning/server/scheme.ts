/**
 * Lightning Network Server Scheme Implementation
 *
 * Handles price parsing and payment requirement enhancement for
 * Lightning Network payments.
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
 * Lightning invoice generator function
 * Used to create BOLT11 invoices for payment requirements
 */
export type InvoiceGenerator = (
  amountSats: string,
  description: string,
  expiry: number,
) => Promise<{
  bolt11Invoice: string
  paymentHash: string
}>

/**
 * Configuration options for Lightning server scheme
 */
export interface LightningSchemeConfig {
  /**
   * Function to generate BOLT11 invoices
   */
  generateInvoice: InvoiceGenerator
}

/**
 * Lightning Network server implementation for the Exact payment scheme.
 * Generates BOLT11 invoices and enhances payment requirements.
 */
export class LightningScheme implements SchemeNetworkServer {
  readonly scheme = SCHEME_EXACT
  private moneyParsers: MoneyParser[] = []
  private config: LightningSchemeConfig

  constructor(config: LightningSchemeConfig) {
    this.config = config
  }

  /**
   * Register a custom money parser in the parser chain.
   *
   * @param parser - Custom function to convert amount to AssetAmount (or null to skip)
   * @returns The server instance for chaining
   */
  registerMoneyParser(parser: MoneyParser): LightningScheme {
    this.moneyParsers.push(parser)
    return this
  }

  /**
   * Parses a price into an asset amount in satoshis.
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

    // Default: convert to satoshis
    return this.defaultMoneyConversion(amount)
  }

  /**
   * Build payment requirements for Lightning Network.
   *
   * Generates a BOLT11 invoice and adds it to the extra field.
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

    // Generate a BOLT11 invoice for the payment
    const invoice = await this.config.generateInvoice(
      paymentRequirements.amount,
      `t402 payment on ${supportedKind.network}`,
      paymentRequirements.maxTimeoutSeconds,
    )

    extra.bolt11Invoice = invoice.bolt11Invoice
    extra.paymentHash = invoice.paymentHash

    return {
      ...paymentRequirements,
      asset: paymentRequirements.asset || 'BTC',
      extra,
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
   * Default money conversion: treat amount as BTC, convert to satoshis.
   */
  private defaultMoneyConversion(amount: number): AssetAmount {
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
