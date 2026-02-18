/**
 * wdk/swap - Swap tokens via WDK
 */

import { z } from 'zod'
import type { T402WDK } from '@t402/wdk'
import { formatUnits, parseUnits } from 'viem'

/**
 * Input schema for wdk/swap tool
 */
export const wdkSwapInputSchema = z.object({
  fromToken: z.string().describe('Token to swap from (e.g., "ETH", "USDC")'),
  toToken: z.string().describe('Token to swap to (e.g., "USDT0", "USDC")'),
  amount: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .describe("Amount to swap (e.g., '1.0')"),
  chain: z
    .string()
    .describe('Chain to execute swap on (e.g., "ethereum", "arbitrum")'),
})

export type WdkSwapInput = z.infer<typeof wdkSwapInputSchema>

/**
 * Swap result
 */
export interface WdkSwapResult {
  /** Input amount */
  fromAmount: string
  /** Input token */
  fromToken: string
  /** Output amount (estimated or actual) */
  toAmount: string
  /** Output token */
  toToken: string
  /** Chain */
  chain: string
  /** Transaction hash (if executed) */
  txHash?: string
}

/**
 * Execute wdk/swap tool
 *
 * @param input - Swap parameters
 * @param wdk - T402WDK instance
 * @returns Swap result
 */
export async function executeWdkSwap(
  input: WdkSwapInput,
  wdk: T402WDK,
): Promise<WdkSwapResult> {
  // Parse amount to smallest units (assume 18 decimals for native, 6 for stablecoins)
  const decimals = ['USDC', 'USDT', 'USDT0'].includes(input.fromToken.toUpperCase()) ? 6 : 18
  const amountBigInt = parseUnits(input.amount, decimals)

  // Get swap quote first
  const quote = await wdk.getSwapQuote(input.chain, input.fromToken, amountBigInt)

  // Execute swap
  const result = await wdk.swapAndPay({
    chain: input.chain,
    fromToken: input.fromToken,
    amount: amountBigInt,
  })

  // Format output amount (USDT0 is always 6 decimals output)
  const outputDecimals = ['USDC', 'USDT', 'USDT0'].includes(input.toToken.toUpperCase()) ? 6 : 18
  const toAmount = formatUnits(result?.outputAmount ?? quote.outputAmount, outputDecimals)

  return {
    fromAmount: input.amount,
    fromToken: input.fromToken,
    toAmount,
    toToken: input.toToken,
    chain: input.chain,
    txHash: result?.txHash,
  }
}

/**
 * Execute wdk/swap in demo mode
 *
 * @param input - Swap parameters
 * @returns Demo swap result
 */
export function executeWdkSwapDemo(input: WdkSwapInput): WdkSwapResult {
  // Simulate a swap with ~0.3% slippage
  const inputAmount = parseFloat(input.amount)
  const outputAmount = (inputAmount * 0.997).toFixed(6)

  return {
    fromAmount: input.amount,
    fromToken: input.fromToken,
    toAmount: outputAmount,
    toToken: input.toToken,
    chain: input.chain,
    txHash: '0xdemo' + Math.random().toString(16).slice(2, 10),
  }
}

/**
 * Format swap result for display
 *
 * @param result - Swap result
 * @returns Formatted string
 */
export function formatWdkSwapResult(result: WdkSwapResult): string {
  const lines = [
    '## WDK Swap Result',
    '',
    `**From:** ${result.fromAmount} ${result.fromToken}`,
    `**To:** ${result.toAmount} ${result.toToken}`,
    `**Chain:** ${result.chain}`,
  ]

  if (result.txHash) {
    lines.push(`**Tx Hash:** \`${result.txHash}\``)
  }

  return lines.join('\n')
}
