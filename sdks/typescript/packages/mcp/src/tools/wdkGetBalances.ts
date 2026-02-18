/**
 * wdk/getBalances - Get multi-chain balances via WDK
 */

import { z } from 'zod'
import type { T402WDK, AggregatedBalance } from '@t402/wdk'
import { formatUnits } from 'viem'

/**
 * Input schema for wdk/getBalances tool
 */
export const wdkGetBalancesInputSchema = z.object({
  chains: z
    .array(z.string())
    .optional()
    .describe('Optional list of chains to check. If not provided, checks all configured chains.'),
})

export type WdkGetBalancesInput = z.infer<typeof wdkGetBalancesInputSchema>

/**
 * WDK balance result
 */
export interface WdkBalancesResult {
  /** Per-chain balances */
  chains: Array<{
    chain: string
    usdt0: string
    usdc: string
    native: string
  }>
  /** Total USDT0 across all chains */
  totalUsdt0: string
  /** Total USDC across all chains */
  totalUsdc: string
}

/**
 * Find a token balance by symbol from the tokens array
 *
 * @param tokens - Array of token balances
 * @param symbol - Token symbol to find
 * @returns Formatted balance or '0'
 */
function findTokenFormatted(
  tokens: Array<{ symbol: string; formatted: string }>,
  symbol: string,
): string {
  return tokens.find((t) => t.symbol === symbol)?.formatted ?? '0'
}

/**
 * Execute wdk/getBalances tool
 *
 * @param input - Input with optional chains filter
 * @param wdk - T402WDK instance
 * @returns Multi-chain balances
 */
export async function executeWdkGetBalances(
  input: WdkGetBalancesInput,
  wdk: T402WDK,
): Promise<WdkBalancesResult> {
  const balances: AggregatedBalance = await wdk.getAggregatedBalances()

  const chains = balances.chains
    .filter((c) => !input.chains || input.chains.includes(c.chain))
    .map((c) => ({
      chain: c.chain,
      usdt0: findTokenFormatted(c.tokens, 'USDT0'),
      usdc: findTokenFormatted(c.tokens, 'USDC'),
      native: formatUnits(c.native, 18),
    }))

  return {
    chains,
    totalUsdt0: formatUnits(balances.totalUsdt0, 6),
    totalUsdc: formatUnits(balances.totalUsdc, 6),
  }
}

/**
 * Execute wdk/getBalances in demo mode
 *
 * @returns Demo balances
 */
export function executeWdkGetBalancesDemo(): WdkBalancesResult {
  return {
    chains: [
      { chain: 'ethereum', usdt0: '100.00', usdc: '250.00', native: '0.5' },
      { chain: 'arbitrum', usdt0: '500.00', usdc: '0', native: '0.01' },
      { chain: 'base', usdt0: '200.00', usdc: '100.00', native: '0.02' },
    ],
    totalUsdt0: '800.00',
    totalUsdc: '350.00',
  }
}

/**
 * Format balances for display
 *
 * @param result - Balances result
 * @returns Formatted string
 */
export function formatWdkBalancesResult(result: WdkBalancesResult): string {
  const lines: string[] = [
    '## WDK Multi-Chain Balances',
    '',
    `**Total USDT0:** ${result.totalUsdt0}`,
    `**Total USDC:** ${result.totalUsdc}`,
    '',
    '### Per-Chain Breakdown',
    '',
  ]

  for (const chain of result.chains) {
    lines.push(`**${chain.chain}**`)
    lines.push(`- USDT0: ${chain.usdt0}`)
    lines.push(`- USDC: ${chain.usdc}`)
    lines.push(`- Native: ${chain.native}`)
    lines.push('')
  }

  return lines.join('\n')
}
