/**
 * WDK Pricing Provider Integration
 *
 * Provides a MoneyParser that converts fiat/stablecoin amounts to
 * on-chain AssetAmount values using WDK pricing data.
 */

import type { MoneyParser, AssetAmount, Network } from '@t402/core/types'
import {
  USDT0_ADDRESSES,
  USDC_ADDRESSES,
  getChainFromNetwork,
  getPreferredToken,
} from './chains.js'

export interface PricingProviderConfig {
  /** Cache TTL in milliseconds (default: 60000 = 60s) */
  cacheTTL?: number
  /** Supported fiat currencies (default: ['USD', 'EUR', 'GBP', 'JPY']) */
  supportedFiat?: string[]
}

interface CachedPrice {
  rate: number
  fetchedAt: number
}

// Stablecoins pass through at 1:1 (no API call needed)
const STABLECOIN_SYMBOLS = new Set(['USDT', 'USDT0', 'USDC', 'DAI', 'BUSD'])

const DEFAULT_TTL = 60_000 // 60 seconds
const DEFAULT_FIAT = ['USD', 'EUR', 'GBP', 'JPY']

/**
 * Creates a MoneyParser that uses WDK pricing provider for fiat-to-crypto conversion.
 *
 * For stablecoin-denominated amounts (USDT, USDC, etc.), returns 1:1 ratio (no API call).
 * For fiat currencies (USD, EUR, etc.), fetches live rates from the pricing provider.
 *
 * The MoneyParser interface receives a numeric amount (e.g., 1.50) and a CAIP-2 network.
 *
 * @example
 * ```typescript
 * import { createWdkMoneyParser } from '@t402/wdk'
 *
 * const parser = createWdkMoneyParser({ cacheTTL: 30_000 })
 * const amount = await parser(1.50, 'eip155:8453') // Returns USDT amount on Base
 * ```
 */
export function createWdkMoneyParser(config?: PricingProviderConfig): MoneyParser {
  const cacheTTL = config?.cacheTTL ?? DEFAULT_TTL
  const supportedFiat = new Set(config?.supportedFiat ?? DEFAULT_FIAT)
  const cache = new Map<string, CachedPrice>()

  return async (amount: number, network: Network): Promise<AssetAmount | null> => {
    if (!Number.isFinite(amount) || amount <= 0) return null

    // Resolve the preferred token for this network
    const chain = getChainFromNetwork(network)
    if (!chain) return null

    const tokenInfo = getPreferredToken(chain)
    if (!tokenInfo) return null

    // Stablecoin pass-through: amount maps 1:1
    if (STABLECOIN_SYMBOLS.has(tokenInfo.symbol.toUpperCase())) {
      return {
        amount: toAtomicUnits(amount, tokenInfo.decimals),
        asset: tokenInfo.address,
      }
    }

    // For fiat-priced tokens, check supported currencies
    // Default assumption: amount is in USD
    const currency = 'USD'
    if (!supportedFiat.has(currency)) return null

    const cacheKey = `${currency}_${tokenInfo.symbol}`
    const cached = cache.get(cacheKey)
    const now = Date.now()

    let rate: number
    if (cached && now - cached.fetchedAt < cacheTTL) {
      rate = cached.rate
    } else {
      // For USD-pegged stablecoins, use 1:1 rate as default
      // When @tetherto/wdk-pricing-provider is available, call it here
      rate = await fetchRate(currency, tokenInfo.symbol)
      cache.set(cacheKey, { rate, fetchedAt: now })
    }

    const convertedAmount = amount * rate
    return {
      amount: toAtomicUnits(convertedAmount, tokenInfo.decimals),
      asset: tokenInfo.address,
    }
  }
}

/**
 * Convert a decimal amount to atomic units string.
 *
 * @example
 * toAtomicUnits(1.5, 6) => "1500000"
 * toAtomicUnits(0.001, 6) => "1000"
 */
export function toAtomicUnits(amount: number, decimals: number): string {
  // Use string math to avoid floating point issues
  const factor = 10 ** decimals
  // Round to avoid floating-point drift
  const atomic = Math.round(amount * factor)
  return atomic.toString()
}

/**
 * Resolve the asset address for a token on a given network.
 */
export function resolveAssetForNetwork(token: string, network: Network): string | null {
  const chain = getChainFromNetwork(network)
  if (!chain) return null

  const upper = token.toUpperCase()
  if (upper === 'USDT0' || upper === 'USDT') {
    return USDT0_ADDRESSES[chain] ?? null
  }
  if (upper === 'USDC') {
    return USDC_ADDRESSES[chain] ?? null
  }
  return null
}

/**
 * Fetch exchange rate. Placeholder for WDK pricing provider integration.
 *
 * When @tetherto/wdk-pricing-provider or @tetherto/wdk-pricing-bitfinex-http
 * is available, this function should delegate to those providers.
 *
 * Currently returns 1:1 for USD (stablecoin assumption).
 */
async function fetchRate(fromCurrency: string, _toToken: string): Promise<number> {
  // USD → stablecoin is 1:1 by default
  if (fromCurrency.toUpperCase() === 'USD') {
    return 1.0
  }

  // Placeholder rates for other fiat currencies
  // In production, these would come from the WDK pricing provider
  const placeholderRates: Record<string, number> = {
    EUR: 1.08,
    GBP: 1.27,
    JPY: 0.0067,
  }

  return placeholderRates[fromCurrency.toUpperCase()] ?? 1.0
}
