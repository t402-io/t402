/**
 * t402/executeBridge (from quote) - Execute a bridge from a stored quote
 */

import { z } from 'zod'
import type { SupportedNetwork, BridgeResult } from '../types.js'
import { getQuote, deleteQuote } from './quoteStore.js'
import { executeBridge } from './bridge.js'

/**
 * Input schema for t402/executeBridge tool
 */
export const executeBridgeFromQuoteInputSchema = z.object({
  quoteId: z.string().uuid().describe('Quote ID from t402/quoteBridge'),
  confirmed: z
    .boolean()
    .optional()
    .describe('Set to true to confirm and execute this bridge'),
})

export type ExecuteBridgeFromQuoteInput = z.infer<typeof executeBridgeFromQuoteInputSchema>

/**
 * Execute t402/executeBridge from quote tool
 */
export async function executeExecuteBridgeFromQuote(
  input: ExecuteBridgeFromQuoteInput,
  options: { privateKey: string; rpcUrl?: string; demoMode?: boolean },
): Promise<
  BridgeResult | { needsConfirmation: true; summary: string; details: Record<string, string> }
> {
  const quote = getQuote(input.quoteId)
  if (!quote) {
    throw new Error('Quote not found or expired. Please request a new quote.')
  }
  if (quote.type !== 'bridge') {
    throw new Error('Invalid quote type. Expected a bridge quote.')
  }

  const { fromChain, toChain, amount, recipient } = quote.data as {
    fromChain: string
    toChain: string
    amount: string
    recipient: string
  }

  // Elicitation: return confirmation prompt if not confirmed
  if (!input.confirmed) {
    return {
      needsConfirmation: true,
      summary: `Bridge ${amount} USDT0 from ${fromChain} to ${toChain}`,
      details: { fromChain, toChain, amount, recipient, quoteId: input.quoteId },
    }
  }

  // Execute the bridge using existing bridge function
  const result = await executeBridge(
    { fromChain: fromChain as 'ethereum', toChain: toChain as 'ethereum', amount, recipient, confirmed: true },
    options,
  )

  // The result could be a confirmation (shouldn't be since we set confirmed: true)
  if ('needsConfirmation' in result) {
    return result
  }

  // Consume the quote
  deleteQuote(input.quoteId)

  return result
}

/**
 * Execute t402/executeBridge from quote in demo mode
 */
export function executeExecuteBridgeFromQuoteDemo(
  input: ExecuteBridgeFromQuoteInput,
): BridgeResult | { needsConfirmation: true; summary: string; details: Record<string, string> } {
  const quote = getQuote(input.quoteId)
  if (!quote) {
    throw new Error('Quote not found or expired. Please request a new quote.')
  }
  if (quote.type !== 'bridge') {
    throw new Error('Invalid quote type. Expected a bridge quote.')
  }

  const { fromChain, toChain, amount, recipient } = quote.data as {
    fromChain: string
    toChain: string
    amount: string
    recipient: string
  }

  // Elicitation: return confirmation prompt if not confirmed
  if (!input.confirmed) {
    return {
      needsConfirmation: true,
      summary: `Bridge ${amount} USDT0 from ${fromChain} to ${toChain}`,
      details: { fromChain, toChain, amount, recipient, quoteId: input.quoteId },
    }
  }

  // Consume the quote
  deleteQuote(input.quoteId)

  const fakeTxHash = `0x${'a'.repeat(64)}` as `0x${string}`
  const fakeGuid = `0x${'b'.repeat(64)}` as `0x${string}`

  return {
    txHash: fakeTxHash,
    messageGuid: fakeGuid,
    amount,
    fromChain: fromChain as SupportedNetwork,
    toChain: toChain as SupportedNetwork,
    estimatedTime: (quote.data.estimatedTime as number) ?? 300,
    trackingUrl: `https://layerzeroscan.com/tx/${fakeGuid}`,
  }
}

/**
 * Format execute bridge result for display (reuses bridge format)
 */
export { formatBridgeResult as formatExecuteBridgeFromQuoteResult } from './bridge.js'
