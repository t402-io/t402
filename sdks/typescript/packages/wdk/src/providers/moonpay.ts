/**
 * Moonpay fiat on-ramp provider for T402 WDK
 *
 * Enables zero-crypto users to purchase USDT/USDT0 directly
 * via Moonpay's widget and fund their wallet for T402 payments.
 */

import type {
  FiatOnRampProvider,
  FiatOnRampQuote,
  FiatOnRampParams,
  FiatOnRampResult,
} from '../types.js'

/**
 * Moonpay provider configuration
 */
export interface MoonpayConfig {
  /** Moonpay API key */
  apiKey: string
  /** Environment (default: 'production') */
  environment?: 'sandbox' | 'production'
}

/**
 * CAIP-2 network to Moonpay currency code mapping
 */
const NETWORK_TO_MOONPAY_CURRENCY: Record<string, string> = {
  'eip155:1': 'usdt',
  'eip155:42161': 'usdt_arbitrum',
  'eip155:137': 'usdt_polygon',
  'eip155:8453': 'usdt_base',
  'eip155:10': 'usdt_optimism',
  'eip155:43114': 'usdt_avalanche_c_chain',
  'eip155:56': 'usdt_bsc',
}

const SUPPORTED_FIAT_CURRENCIES = ['USD', 'EUR', 'GBP']

const SUPPORTED_NETWORKS = Object.keys(NETWORK_TO_MOONPAY_CURRENCY)

const BASE_URLS: Record<string, string> = {
  production: 'https://buy.moonpay.com',
  sandbox: 'https://buy-sandbox.moonpay.com',
}

const API_URLS: Record<string, string> = {
  production: 'https://api.moonpay.com',
  sandbox: 'https://api.moonpay.com',
}

/**
 * MoonpayOnRampProvider - Fiat on-ramp via Moonpay
 *
 * @example
 * ```typescript
 * import { MoonpayOnRampProvider } from '@t402/wdk';
 *
 * const moonpay = new MoonpayOnRampProvider({
 *   apiKey: 'pk_test_...',
 *   environment: 'sandbox',
 * });
 *
 * // Get a quote
 * const quote = await moonpay.getQuote({
 *   fiatAmount: 100,
 *   fiatCurrency: 'USD',
 *   network: 'eip155:42161',
 * });
 *
 * // Create widget URL for the user
 * const result = moonpay.createWidget({
 *   fiatAmount: 100,
 *   fiatCurrency: 'USD',
 *   walletAddress: '0x...',
 *   network: 'eip155:42161',
 * });
 *
 * // Open result.widgetUrl in browser/webview
 * ```
 */
export class MoonpayOnRampProvider implements FiatOnRampProvider {
  readonly name = 'moonpay'
  private _apiKey: string
  private _environment: 'sandbox' | 'production'

  constructor(config: MoonpayConfig) {
    if (!config.apiKey) {
      throw new Error('Moonpay API key is required')
    }
    this._apiKey = config.apiKey
    this._environment = config.environment ?? 'production'
  }

  /**
   * Get the base widget URL for the current environment
   */
  get baseUrl(): string {
    return BASE_URLS[this._environment]
  }

  /**
   * Get the API base URL for the current environment
   */
  get apiUrl(): string {
    return API_URLS[this._environment]
  }

  /**
   * Get a quote for fiat-to-crypto conversion
   *
   * This method fetches a real-time quote from Moonpay.
   * Override `_fetchQuote` for testing.
   */
  async getQuote(
    params: Pick<FiatOnRampParams, 'fiatAmount' | 'fiatCurrency' | 'network'>,
  ): Promise<FiatOnRampQuote> {
    const currencyCode = this._getCurrencyCode(params.network)
    if (!currencyCode) {
      throw new Error(`Network "${params.network}" is not supported by Moonpay`)
    }

    if (params.fiatAmount <= 0) {
      throw new Error('fiatAmount must be greater than 0')
    }

    if (!SUPPORTED_FIAT_CURRENCIES.includes(params.fiatCurrency.toUpperCase())) {
      throw new Error(
        `Currency "${params.fiatCurrency}" is not supported. Supported: ${SUPPORTED_FIAT_CURRENCIES.join(', ')}`,
      )
    }

    const quoteUrl = `${this.apiUrl}/v3/currencies/${currencyCode}/buy_quote?apiKey=${this._apiKey}&baseCurrencyAmount=${params.fiatAmount}&baseCurrencyCode=${params.fiatCurrency.toLowerCase()}`

    const data = await this._fetchQuote(quoteUrl)

    return {
      fiatAmount: params.fiatAmount,
      fiatCurrency: params.fiatCurrency.toUpperCase(),
      cryptoAmount: String(data.quoteCurrencyAmount ?? '0'),
      cryptoCurrency: 'USDT',
      exchangeRate: Number(data.quoteCurrencyPrice ?? 1),
      fees: {
        network: String(data.networkFeeAmount ?? '0'),
        service: String(data.feeAmount ?? '0'),
        total: String(data.totalFeeAmount ?? '0'),
      },
      estimatedTime: 600, // ~10 minutes typical for card purchases
    }
  }

  /**
   * Fetch quote from Moonpay API (override in tests)
   */
  async _fetchQuote(url: string): Promise<Record<string, unknown>> {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Moonpay API error: ${response.status} ${response.statusText}`)
    }
    return response.json() as Promise<Record<string, unknown>>
  }

  /**
   * Create a Moonpay widget URL for the user
   */
  createWidget(params: FiatOnRampParams): FiatOnRampResult {
    const currencyCode = this._getCurrencyCode(params.network)
    if (!currencyCode) {
      throw new Error(`Network "${params.network}" is not supported by Moonpay`)
    }

    if (!params.walletAddress) {
      throw new Error('walletAddress is required')
    }

    if (params.fiatAmount <= 0) {
      throw new Error('fiatAmount must be greater than 0')
    }

    const queryParams = new URLSearchParams({
      apiKey: this._apiKey,
      currencyCode,
      baseCurrencyCode: params.fiatCurrency.toLowerCase(),
      baseCurrencyAmount: String(params.fiatAmount),
      walletAddress: params.walletAddress,
    })

    if (params.redirectUrl) {
      queryParams.set('redirectURL', params.redirectUrl)
    }

    const widgetUrl = `${this.baseUrl}?${queryParams.toString()}`
    const orderId = `mp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes

    return { widgetUrl, orderId, expiresAt }
  }

  /**
   * Get supported fiat currencies
   */
  getSupportedCurrencies(): string[] {
    return [...SUPPORTED_FIAT_CURRENCIES]
  }

  /**
   * Get supported CAIP-2 networks
   */
  getSupportedNetworks(): string[] {
    return [...SUPPORTED_NETWORKS]
  }

  /**
   * Map CAIP-2 network to Moonpay currency code
   */
  private _getCurrencyCode(network: string): string | undefined {
    return NETWORK_TO_MOONPAY_CURRENCY[network]
  }
}

/**
 * Get the Moonpay currency code for a CAIP-2 network
 * Exported for testing
 */
export function getMoonpayCurrencyCode(network: string): string | undefined {
  return NETWORK_TO_MOONPAY_CURRENCY[network]
}
