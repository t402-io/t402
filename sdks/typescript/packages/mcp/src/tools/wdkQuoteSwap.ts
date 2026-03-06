/**
 * wdk/quoteSwap - Get a swap quote with a stored quoteId
 */

import { z } from 'zod'
import type { T402WDK } from '@t402/wdk'
import { parseUnits } from 'viem'
import { createQuote } from './quoteStore.js'

/**
 * Input schema for wdk/quoteSwap tool
 */
export const wdkQuoteSwapInputSchema = z.object({
  fromToken: z.string().describe('Token to swap from (e.g., "ETH", "USDC")'),
  toToken: z.string().describe('Token to swap to (e.g., "USDT0", "USDC")'),
  amount: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .describe("Amount to swap (e.g., '1.0')"),
  chain: z.string().describe('Chain to execute swap on (e.g., "ethereum", "arbitrum")'),
})

export type WdkQuoteSwapInput = z.infer<typeof wdkQuoteSwapInputSchema>

/**
 * Swap quote result
 */
export interface SwapQuoteResult {
  quoteId: string
  fromToken: string
  toToken: string
  fromAmount: string
  toAmount: string
  exchangeRate: string
  fee: string
  priceImpact: string
  expiresAt: string
  chain: string
}

/**
 * Execute wdk/quoteSwap tool
 */
export async function executeWdkQuoteSwap(
  input: WdkQuoteSwapInput,
  wdk: T402WDK,
): Promise<SwapQuoteResult> {
  const decimals = ['USDC', 'USDT', 'USDT0'].includes(input.fromToken.toUpperCase()) ? 6 : 18
  const amountBigInt = parseUnits(input.amount, decimals)

  const quote = await wdk.getSwapQuote(input.chain, input.fromToken, amountBigInt)

  const outputDecimals = ['USDC', 'USDT', 'USDT0'].includes(input.toToken.toUpperCase()) ? 6 : 18
  const outputDivisor = 10 ** outputDecimals
  const toAmount = (Number(quote.outputAmount) / outputDivisor).toFixed(outputDecimals === 6 ? 6 : 8)

  const inputAmount = parseFloat(input.amount)
  const outputAmount = parseFloat(toAmount)
  const exchangeRate = inputAmount > 0 ? (outputAmount / inputAmount).toFixed(6) : '0'

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

  const quoteId = createQuote('swap', {
    fromToken: input.fromToken,
    toToken: input.toToken,
    fromAmount: input.amount,
    toAmount,
    chain: input.chain,
    exchangeRate,
  })

  return {
    quoteId,
    fromToken: input.fromToken,
    toToken: input.toToken,
    fromAmount: input.amount,
    toAmount,
    exchangeRate,
    fee: '0.3%',
    priceImpact: '< 0.1%',
    expiresAt,
    chain: input.chain,
  }
}

/**
 * Execute wdk/quoteSwap in demo mode
 */
export function executeWdkQuoteSwapDemo(input: WdkQuoteSwapInput): SwapQuoteResult {
  const inputAmount = parseFloat(input.amount)
  const toAmount = (inputAmount * 0.997).toFixed(6) // ~0.3% fee
  const exchangeRate = (0.997).toFixed(6)

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

  const quoteId = createQuote('swap', {
    fromToken: input.fromToken,
    toToken: input.toToken,
    fromAmount: input.amount,
    toAmount,
    chain: input.chain,
    exchangeRate,
  })

  return {
    quoteId,
    fromToken: input.fromToken,
    toToken: input.toToken,
    fromAmount: input.amount,
    toAmount,
    exchangeRate,
    fee: '0.3%',
    priceImpact: '< 0.1%',
    expiresAt,
    chain: input.chain,
  }
}

/**
 * Format swap quote result for display
 */
export function formatSwapQuoteResult(result: SwapQuoteResult): string {
  return [
    '## Swap Quote',
    '',
    `- **Quote ID:** \`${result.quoteId}\``,
    `- **From:** ${result.fromAmount} ${result.fromToken}`,
    `- **To:** ${result.toAmount} ${result.toToken}`,
    `- **Exchange Rate:** ${result.exchangeRate}`,
    `- **Fee:** ${result.fee}`,
    `- **Price Impact:** ${result.priceImpact}`,
    `- **Chain:** ${result.chain}`,
    `- **Expires:** ${result.expiresAt}`,
    '',
    '_Call `wdk/executeSwap` with the quoteId to execute this swap._',
  ].join('\n')
}
