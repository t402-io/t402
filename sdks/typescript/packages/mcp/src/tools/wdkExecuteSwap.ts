/**
 * wdk/executeSwap - Execute a swap from a stored quote
 */

import { z } from 'zod'
import type { T402WDK } from '@t402/wdk'
import { parseUnits } from 'viem'
import { getQuote, deleteQuote } from './quoteStore.js'

/**
 * Input schema for wdk/executeSwap tool
 */
export const wdkExecuteSwapInputSchema = z.object({
  quoteId: z.string().uuid().describe('Quote ID from wdk/quoteSwap'),
  confirmed: z
    .boolean()
    .optional()
    .describe('Set to true to confirm and execute this swap'),
})

export type WdkExecuteSwapInput = z.infer<typeof wdkExecuteSwapInputSchema>

/**
 * Execute swap result
 */
export interface ExecuteSwapResult {
  fromAmount: string
  fromToken: string
  toAmount: string
  toToken: string
  chain: string
  txHash: string
}

/**
 * Execute wdk/executeSwap tool
 */
export async function executeWdkExecuteSwap(
  input: WdkExecuteSwapInput,
  wdk: T402WDK,
): Promise<
  ExecuteSwapResult | { needsConfirmation: true; summary: string; details: Record<string, string> }
> {
  const quote = getQuote(input.quoteId)
  if (!quote) {
    throw new Error('Quote not found or expired. Please request a new quote.')
  }
  if (quote.type !== 'swap') {
    throw new Error('Invalid quote type. Expected a swap quote.')
  }

  const { fromToken, toToken, fromAmount, toAmount, chain } = quote.data as {
    fromToken: string
    toToken: string
    fromAmount: string
    toAmount: string
    chain: string
  }

  // Elicitation: return confirmation prompt if not confirmed
  if (!input.confirmed) {
    return {
      needsConfirmation: true,
      summary: `Swap ${fromAmount} ${fromToken} to ${toAmount} ${toToken} on ${chain}`,
      details: { fromToken, toToken, fromAmount, toAmount, chain, quoteId: input.quoteId },
    }
  }

  // Execute the swap
  const decimals = ['USDC', 'USDT', 'USDT0'].includes(fromToken.toUpperCase()) ? 6 : 18
  const amountBigInt = parseUnits(fromAmount, decimals)

  const result = await wdk.swapAndPay({
    chain,
    fromToken,
    amount: amountBigInt,
  })

  // Consume the quote
  deleteQuote(input.quoteId)

  return {
    fromAmount,
    fromToken,
    toAmount,
    toToken,
    chain,
    txHash: result?.txHash ?? '0x',
  }
}

/**
 * Execute wdk/executeSwap in demo mode
 */
export function executeWdkExecuteSwapDemo(
  input: WdkExecuteSwapInput,
): ExecuteSwapResult | { needsConfirmation: true; summary: string; details: Record<string, string> } {
  const quote = getQuote(input.quoteId)
  if (!quote) {
    throw new Error('Quote not found or expired. Please request a new quote.')
  }
  if (quote.type !== 'swap') {
    throw new Error('Invalid quote type. Expected a swap quote.')
  }

  const { fromToken, toToken, fromAmount, toAmount, chain } = quote.data as {
    fromToken: string
    toToken: string
    fromAmount: string
    toAmount: string
    chain: string
  }

  // Elicitation: return confirmation prompt if not confirmed
  if (!input.confirmed) {
    return {
      needsConfirmation: true,
      summary: `Swap ${fromAmount} ${fromToken} to ${toAmount} ${toToken} on ${chain}`,
      details: { fromToken, toToken, fromAmount, toAmount, chain, quoteId: input.quoteId },
    }
  }

  // Consume the quote
  deleteQuote(input.quoteId)

  return {
    fromAmount,
    fromToken,
    toAmount,
    toToken,
    chain,
    txHash: '0xdemo' + Math.random().toString(16).slice(2, 10),
  }
}

/**
 * Format execute swap result for display
 */
export function formatExecuteSwapResult(result: ExecuteSwapResult): string {
  return [
    '## Swap Executed',
    '',
    `- **From:** ${result.fromAmount} ${result.fromToken}`,
    `- **To:** ${result.toAmount} ${result.toToken}`,
    `- **Chain:** ${result.chain}`,
    `- **Tx Hash:** \`${result.txHash}\``,
  ].join('\n')
}
