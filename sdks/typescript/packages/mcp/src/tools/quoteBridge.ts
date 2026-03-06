/**
 * t402/quoteBridge - Get a bridge fee quote with a stored quoteId
 */

import { z } from 'zod'
import type { SupportedNetwork } from '../types.js'
import { createQuote } from './quoteStore.js'
import { executeGetBridgeFee, type GetBridgeFeeInput } from './getBridgeFee.js'

/**
 * Input schema for t402/quoteBridge tool (same as getBridgeFee)
 */
export const quoteBridgeInputSchema = z.object({
  fromChain: z
    .enum(['ethereum', 'arbitrum', 'ink', 'berachain', 'unichain'])
    .describe('Source chain to bridge from'),
  toChain: z
    .enum(['ethereum', 'arbitrum', 'ink', 'berachain', 'unichain'])
    .describe('Destination chain to bridge to'),
  amount: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .describe("Amount of USDT0 to bridge (e.g., '100' for 100 USDT0)"),
  recipient: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .describe('Recipient address on destination chain'),
})

export type QuoteBridgeInput = z.infer<typeof quoteBridgeInputSchema>

/**
 * Bridge quote result
 */
export interface BridgeQuoteResult {
  quoteId: string
  fromChain: string
  toChain: string
  amount: string
  recipient: string
  nativeFee: string
  nativeFeeFormatted: string
  estimatedTime: number
  expiresAt: string
}

/**
 * Execute t402/quoteBridge tool
 */
export async function executeQuoteBridge(
  input: QuoteBridgeInput,
  rpcUrls?: Partial<Record<SupportedNetwork, string>>,
): Promise<BridgeQuoteResult> {
  // Get the actual fee quote
  const feeResult = await executeGetBridgeFee(input as GetBridgeFeeInput, rpcUrls)

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

  const quoteId = createQuote('bridge', {
    fromChain: input.fromChain,
    toChain: input.toChain,
    amount: input.amount,
    recipient: input.recipient,
    nativeFee: feeResult.nativeFee,
    nativeFeeFormatted: feeResult.nativeFeeFormatted,
    estimatedTime: feeResult.estimatedTime,
  })

  return {
    quoteId,
    fromChain: input.fromChain,
    toChain: input.toChain,
    amount: input.amount,
    recipient: input.recipient,
    nativeFee: feeResult.nativeFee,
    nativeFeeFormatted: feeResult.nativeFeeFormatted,
    estimatedTime: feeResult.estimatedTime,
    expiresAt,
  }
}

/**
 * Execute t402/quoteBridge in demo mode
 */
export function executeQuoteBridgeDemo(input: QuoteBridgeInput): BridgeQuoteResult {
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
  const estimatedTime = input.toChain === 'ethereum' ? 900 : 300

  const quoteId = createQuote('bridge', {
    fromChain: input.fromChain,
    toChain: input.toChain,
    amount: input.amount,
    recipient: input.recipient,
    nativeFee: '1000000000000000',
    nativeFeeFormatted: '0.001 ETH',
    estimatedTime,
  })

  return {
    quoteId,
    fromChain: input.fromChain,
    toChain: input.toChain,
    amount: input.amount,
    recipient: input.recipient,
    nativeFee: '1000000000000000',
    nativeFeeFormatted: '0.001 ETH',
    estimatedTime,
    expiresAt,
  }
}

/**
 * Format bridge quote result for display
 */
export function formatBridgeQuoteResult(result: BridgeQuoteResult): string {
  const minutes = Math.ceil(result.estimatedTime / 60)
  return [
    '## Bridge Quote',
    '',
    `- **Quote ID:** \`${result.quoteId}\``,
    `- **Route:** ${result.fromChain} -> ${result.toChain}`,
    `- **Amount:** ${result.amount} USDT0`,
    `- **Recipient:** \`${result.recipient}\``,
    `- **Fee:** ${result.nativeFeeFormatted}`,
    `- **Estimated Time:** ~${minutes} minutes`,
    `- **Expires:** ${result.expiresAt}`,
    '',
    '_Call `t402/executeBridge` with the quoteId to execute this bridge._',
  ].join('\n')
}
