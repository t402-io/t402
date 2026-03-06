/**
 * t402/getTokenPrice - Get current token prices via CoinGecko
 */

import { z } from 'zod'
import { getTokenPrices, getTokenPricesDemo } from './priceService.js'

/**
 * Input schema for getTokenPrice tool
 */
export const getTokenPriceInputSchema = z.object({
  tokens: z
    .array(z.string())
    .min(1)
    .describe('Token symbols to get prices for (e.g., ["ETH", "MATIC", "USDC"])'),
  currency: z
    .string()
    .optional()
    .describe('Target currency (default: "usd"). Supports: usd, eur, gbp, etc.'),
})

export type GetTokenPriceInput = z.infer<typeof getTokenPriceInputSchema>

/**
 * Token price result
 */
export interface TokenPriceResult {
  prices: Record<string, number>
  currency: string
}

/**
 * Execute getTokenPrice tool
 */
export async function executeGetTokenPrice(
  input: GetTokenPriceInput,
  options: { demoMode?: boolean },
): Promise<TokenPriceResult> {
  const currency = input.currency ?? 'usd'

  const prices = options.demoMode
    ? getTokenPricesDemo(input.tokens)
    : await getTokenPrices(input.tokens, currency)

  return { prices, currency }
}

/**
 * Format token price result for display
 */
export function formatTokenPriceResult(result: TokenPriceResult): string {
  const lines = ['## Token Prices', '']
  const currencyUpper = result.currency.toUpperCase()

  for (const [token, price] of Object.entries(result.prices)) {
    if (price > 0) {
      lines.push(`- **${token}:** ${price.toLocaleString()} ${currencyUpper}`)
    } else {
      lines.push(`- **${token}:** Price unavailable`)
    }
  }

  return lines.join('\n')
}
