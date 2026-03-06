/**
 * t402/compareNetworkFees - Compare payment fees across multiple networks
 */

import { z } from 'zod'
import type { SupportedNetwork } from '../types.js'
import { supportsToken } from '../constants.js'
import {
  executeEstimatePaymentFee,
  type PaymentFeeEstimate,
} from './estimatePaymentFee.js'

/**
 * Input schema for compareNetworkFees tool
 */
export const compareNetworkFeesInputSchema = z.object({
  amount: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .describe("Payment amount (e.g., '100')"),
  token: z
    .enum(['USDC', 'USDT', 'USDT0'])
    .describe('Token to use for payment'),
  networks: z
    .array(z.string())
    .optional()
    .describe(
      'Networks to compare. If not provided, compares all networks that support the token.',
    ),
})

export type CompareNetworkFeesInput = z.infer<typeof compareNetworkFeesInputSchema>

/**
 * All supported networks
 */
const ALL_NETWORKS: SupportedNetwork[] = [
  'ethereum',
  'base',
  'arbitrum',
  'optimism',
  'polygon',
  'avalanche',
  'ink',
  'berachain',
  'unichain',
]

/**
 * Network fee comparison result
 */
export interface NetworkFeeComparison {
  token: string
  amount: string
  fees: PaymentFeeEstimate[]
  cheapest: string
}

/**
 * Execute compareNetworkFees tool
 */
export async function executeCompareNetworkFees(
  input: CompareNetworkFeesInput,
  options: { rpcUrls?: Partial<Record<SupportedNetwork, string>>; demoMode?: boolean },
): Promise<NetworkFeeComparison> {
  const { amount, token } = input

  // Determine networks to compare
  const requestedNetworks = input.networks
    ? (input.networks as SupportedNetwork[])
    : ALL_NETWORKS

  // Filter to networks that support the token
  const networks = requestedNetworks.filter((n) => supportsToken(n, token))

  if (networks.length === 0) {
    throw new Error(`No supported networks found for token ${token}`)
  }

  // Estimate fees in parallel
  const results = await Promise.allSettled(
    networks.map((network) =>
      executeEstimatePaymentFee(
        { network, amount, token },
        {
          rpcUrl: options.rpcUrls?.[network],
          demoMode: options.demoMode,
        },
      ),
    ),
  )

  // Collect successful results
  const fees: PaymentFeeEstimate[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') {
      fees.push(result.value)
    }
  }

  if (fees.length === 0) {
    throw new Error('Failed to estimate fees on any network')
  }

  // Sort by native cost ascending
  fees.sort((a, b) => {
    const costA = parseFloat(a.nativeCost) || Infinity
    const costB = parseFloat(b.nativeCost) || Infinity
    // Compare USD costs when available
    const usdA = parseFloat(a.usdCost.replace('$', '')) || Infinity
    const usdB = parseFloat(b.usdCost.replace('$', '')) || Infinity
    return usdA - usdB || costA - costB
  })

  return {
    token,
    amount,
    fees,
    cheapest: fees[0].network,
  }
}

/**
 * Format network fee comparison result for display
 */
export function formatNetworkFeeComparison(result: NetworkFeeComparison): string {
  const lines = [
    '## Network Fee Comparison',
    '',
    `**Token:** ${result.token} | **Amount:** ${result.amount}`,
    `**Cheapest:** ${result.cheapest}`,
    '',
    '| Network | Gas Price | Native Cost | USD Cost |',
    '|---------|----------|-------------|----------|',
  ]

  for (const fee of result.fees) {
    const marker = fee.network === result.cheapest ? ' *' : ''
    lines.push(
      `| ${fee.network}${marker} | ${fee.gasPriceGwei} gwei | ${fee.nativeCost} ${fee.nativeSymbol} | ${fee.usdCost} |`,
    )
  }

  return lines.join('\n')
}
