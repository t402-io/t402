/**
 * t402/getHistoricalPrice - Get historical price data from CoinGecko
 */

import { z } from 'zod'

/**
 * Input schema for getHistoricalPrice tool
 */
export const getHistoricalPriceInputSchema = z.object({
  token: z
    .string()
    .min(1)
    .describe('Token symbol (e.g., "ETH", "USDC", "USDT", "MATIC", "AVAX")'),
  days: z
    .number()
    .int()
    .min(1)
    .max(365)
    .optional()
    .describe('Number of days of history to retrieve (default: 7, max: 365)'),
})

export type GetHistoricalPriceInput = z.infer<typeof getHistoricalPriceInputSchema>

/**
 * A single price data point
 */
export interface PriceDataPoint {
  /** Unix timestamp in milliseconds */
  timestamp: number
  /** ISO date string */
  date: string
  /** Price in USD */
  price: number
}

/**
 * Historical price result
 */
export interface HistoricalPriceResult {
  /** Token symbol */
  token: string
  /** CoinGecko ID used */
  coinId: string
  /** Currency */
  currency: string
  /** Number of days queried */
  days: number
  /** Price data points */
  prices: PriceDataPoint[]
  /** Price change over the period */
  priceChange: {
    /** Absolute change */
    absolute: number
    /** Percentage change */
    percentage: number
    /** Highest price in period */
    high: number
    /** Lowest price in period */
    low: number
  }
}

/** CoinGecko API base URL */
const COINGECKO_MARKET_CHART = 'https://api.coingecko.com/api/v3/coins'

/** Map token symbols to CoinGecko IDs */
const TOKEN_TO_COINGECKO_ID: Record<string, string> = {
  ETH: 'ethereum',
  MATIC: 'matic-network',
  AVAX: 'avalanche-2',
  BERA: 'berachain-bera',
  USDC: 'usd-coin',
  USDT: 'tether',
  USDT0: 'tether',
  BTC: 'bitcoin',
  SOL: 'solana',
  TON: 'the-open-network',
  TRX: 'tron',
}

/**
 * Execute getHistoricalPrice tool
 */
export async function executeGetHistoricalPrice(
  input: GetHistoricalPriceInput,
  options: { demoMode?: boolean } = {},
): Promise<HistoricalPriceResult> {
  const { token, days = 7 } = input
  const tokenUpper = token.toUpperCase()
  const coinId = TOKEN_TO_COINGECKO_ID[tokenUpper] ?? token.toLowerCase()
  const currency = 'usd'

  if (options.demoMode) {
    return generateDemoData(tokenUpper, coinId, days)
  }

  const url = `${COINGECKO_MARKET_CHART}/${coinId}/market_chart?vs_currency=${currency}&days=${days}`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as { prices: [number, number][] }

  const prices: PriceDataPoint[] = data.prices.map(([timestamp, price]) => ({
    timestamp,
    date: new Date(timestamp).toISOString(),
    price,
  }))

  // Calculate price change stats
  const priceValues = prices.map((p) => p.price)
  const firstPrice = priceValues[0] ?? 0
  const lastPrice = priceValues[priceValues.length - 1] ?? 0
  const high = Math.max(...priceValues)
  const low = Math.min(...priceValues)
  const absolute = lastPrice - firstPrice
  const percentage = firstPrice > 0 ? (absolute / firstPrice) * 100 : 0

  return {
    token: tokenUpper,
    coinId,
    currency,
    days,
    prices,
    priceChange: {
      absolute: Math.round(absolute * 100) / 100,
      percentage: Math.round(percentage * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
    },
  }
}

/**
 * Generate demo data for testing without API calls
 */
function generateDemoData(
  token: string,
  coinId: string,
  days: number,
): HistoricalPriceResult {
  const basePrices: Record<string, number> = {
    ETH: 3250,
    MATIC: 0.58,
    AVAX: 24.15,
    BERA: 3.82,
    USDC: 1.0,
    USDT: 1.0,
    USDT0: 1.0,
    BTC: 62000,
    SOL: 145,
    TON: 5.2,
    TRX: 0.12,
  }

  const basePrice = basePrices[token] ?? 1.0
  const now = Date.now()
  const interval = (days * 24 * 60 * 60 * 1000) / Math.min(days * 24, 168)
  const numPoints = Math.min(days * 24, 168)
  const prices: PriceDataPoint[] = []

  for (let i = 0; i < numPoints; i++) {
    const timestamp = now - (numPoints - i) * interval
    // Simulate small random fluctuations (within +/- 5%)
    const fluctuation = 1 + (Math.sin(i * 0.5) * 0.03 + Math.cos(i * 0.3) * 0.02)
    const price = Math.round(basePrice * fluctuation * 100) / 100
    prices.push({
      timestamp,
      date: new Date(timestamp).toISOString(),
      price,
    })
  }

  const priceValues = prices.map((p) => p.price)
  const firstPrice = priceValues[0] ?? 0
  const lastPrice = priceValues[priceValues.length - 1] ?? 0

  return {
    token,
    coinId,
    currency: 'usd',
    days,
    prices,
    priceChange: {
      absolute: Math.round((lastPrice - firstPrice) * 100) / 100,
      percentage:
        firstPrice > 0 ? Math.round(((lastPrice - firstPrice) / firstPrice) * 10000) / 100 : 0,
      high: Math.round(Math.max(...priceValues) * 100) / 100,
      low: Math.round(Math.min(...priceValues) * 100) / 100,
    },
  }
}

/**
 * Format historical price result for display
 */
export function formatHistoricalPriceResult(result: HistoricalPriceResult): string {
  const lines = [
    `## ${result.token} Price History (${result.days} day${result.days > 1 ? 's' : ''})`,
    '',
    `- **Current:** $${result.prices[result.prices.length - 1]?.price.toLocaleString() ?? 'N/A'}`,
    `- **High:** $${result.priceChange.high.toLocaleString()}`,
    `- **Low:** $${result.priceChange.low.toLocaleString()}`,
    `- **Change:** ${result.priceChange.absolute >= 0 ? '+' : ''}$${result.priceChange.absolute.toLocaleString()} (${result.priceChange.percentage >= 0 ? '+' : ''}${result.priceChange.percentage}%)`,
    '',
    `_${result.prices.length} data points from CoinGecko_`,
  ]

  return lines.join('\n')
}
