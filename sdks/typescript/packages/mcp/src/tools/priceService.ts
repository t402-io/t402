/**
 * Price Service - CoinGecko-based token price fetcher with in-memory cache
 */

/** Cache entry with TTL */
interface CacheEntry {
  prices: Record<string, number>
  timestamp: number
}

/** Cache TTL in milliseconds (5 minutes) */
const CACHE_TTL_MS = 5 * 60 * 1000

/** CoinGecko API base URL */
const COINGECKO_API = 'https://api.coingecko.com/api/v3/simple/price'

/** Map token symbols to CoinGecko IDs */
const TOKEN_TO_COINGECKO_ID: Record<string, string> = {
  ETH: 'ethereum',
  MATIC: 'matic-network',
  AVAX: 'avalanche-2',
  BERA: 'berachain-bera',
  USDC: 'usd-coin',
  USDT: 'tether',
  USDT0: 'tether',
}

/** In-memory price cache keyed by currency */
const cache = new Map<string, CacheEntry>()

/**
 * Get token prices from CoinGecko with caching
 *
 * @param tokens - Token symbols to fetch prices for (e.g., ['ETH', 'MATIC'])
 * @param currency - Target currency (default: 'usd')
 * @returns Map of token symbol to price in target currency
 */
export async function getTokenPrices(
  tokens: string[],
  currency: string = 'usd',
): Promise<Record<string, number>> {
  const cacheKey = `${currency}:${tokens.sort().join(',')}`
  const cached = cache.get(cacheKey)

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.prices
  }

  // Map tokens to CoinGecko IDs
  const coinIds = new Set<string>()
  const tokenToCoinId = new Map<string, string>()
  for (const token of tokens) {
    const coinId = TOKEN_TO_COINGECKO_ID[token.toUpperCase()] ?? token.toLowerCase()
    coinIds.add(coinId)
    tokenToCoinId.set(token.toUpperCase(), coinId)
  }

  const url = `${COINGECKO_API}?ids=${[...coinIds].join(',')}&vs_currencies=${currency}`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as Record<string, Record<string, number>>

  // Map back to token symbols
  const prices: Record<string, number> = {}
  for (const token of tokens) {
    const coinId = tokenToCoinId.get(token.toUpperCase()) ?? token.toLowerCase()
    prices[token.toUpperCase()] = data[coinId]?.[currency] ?? 0
  }

  cache.set(cacheKey, { prices, timestamp: Date.now() })
  return prices
}

/**
 * Get simulated token prices for demo mode
 */
export function getTokenPricesDemo(tokens: string[]): Record<string, number> {
  const demoPrices: Record<string, number> = {
    ETH: 3250.42,
    MATIC: 0.58,
    AVAX: 24.15,
    BERA: 3.82,
    USDC: 1.0,
    USDT: 1.0,
    USDT0: 1.0,
  }

  const prices: Record<string, number> = {}
  for (const token of tokens) {
    prices[token.toUpperCase()] = demoPrices[token.toUpperCase()] ?? 0
  }
  return prices
}

/**
 * Clear the price cache (useful for testing)
 */
export function clearPriceCache(): void {
  cache.clear()
}
