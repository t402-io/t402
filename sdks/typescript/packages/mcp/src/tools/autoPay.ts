/**
 * t402/autoPay - Smart payment orchestrator
 *
 * Fetches a URL, detects 402 payment requirements, checks WDK balances,
 * signs payment, and returns the paid content.
 */

import { z } from 'zod'
import type { T402WDK } from '@t402/wdk'

/**
 * Input schema for t402/autoPay tool
 */
export const autoPayInputSchema = z.object({
  url: z.string().url().describe('URL to fetch (may return 402 Payment Required)'),
  maxAmount: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .optional()
    .describe('Maximum amount willing to pay (e.g., "10.00"). If not set, pays any amount.'),
  preferredChain: z
    .string()
    .optional()
    .describe(
      'Preferred chain for payment (e.g., "arbitrum"). If not specified, uses first available.',
    ),
})

export type AutoPayInput = z.infer<typeof autoPayInputSchema>

/**
 * AutoPay result
 */
export interface AutoPayResult {
  /** Whether the resource was successfully accessed */
  success: boolean
  /** HTTP status code */
  statusCode: number
  /** Response body (truncated if large) */
  body: string
  /** Content type of the response */
  contentType?: string
  /** Payment details (if payment was made) */
  payment?: {
    network: string
    scheme: string
    amount: string
    payTo: string
  }
  /** Error message (if failed) */
  error?: string
}

/**
 * Execute t402/autoPay tool
 *
 * @param input - AutoPay parameters
 * @param wdk - T402WDK instance
 * @returns AutoPay result
 */
export async function executeAutoPay(input: AutoPayInput, wdk: T402WDK): Promise<AutoPayResult> {
  const chains = input.preferredChain ? [input.preferredChain] : ['ethereum', 'arbitrum', 'base']

  const { T402Protocol } = await import('@t402/wdk-protocol')
  const protocol = await T402Protocol.create(wdk, { chains })

  const { response, receipt } = await protocol.fetch(input.url)

  // Check max amount
  if (receipt && input.maxAmount) {
    const paidAmount = parseFloat(receipt.amount) / 1e6 // Assume 6 decimals
    const maxAmount = parseFloat(input.maxAmount)
    if (paidAmount > maxAmount) {
      return {
        success: false,
        statusCode: 402,
        body: '',
        error: `Payment amount (${paidAmount}) exceeds max allowed (${maxAmount})`,
      }
    }
  }

  // Read response body
  const contentType = response.headers.get('content-type') ?? undefined
  let body = ''
  try {
    body = await response.text()
    // Truncate large responses
    if (body.length > 10000) {
      body = body.slice(0, 10000) + '\n... (truncated)'
    }
  } catch {
    body = '[Could not read response body]'
  }

  return {
    success: response.ok,
    statusCode: response.status,
    body,
    contentType,
    payment: receipt
      ? {
          network: receipt.network,
          scheme: receipt.scheme,
          amount: receipt.amount,
          payTo: receipt.payTo,
        }
      : undefined,
  }
}

/**
 * Execute t402/autoPay in demo mode
 *
 * @param input - AutoPay parameters
 * @returns Demo autopay result
 */
export function executeAutoPayDemo(input: AutoPayInput): AutoPayResult {
  return {
    success: true,
    statusCode: 200,
    body: `[Demo] Premium content from ${input.url}\n\nThis is simulated content that would be returned after payment.`,
    contentType: 'text/plain',
    payment: {
      network: 'eip155:42161',
      scheme: 'exact',
      amount: '1000000',
      payTo: '0xC88f67e776f16DcFBf42e6bDda1B82604448899B',
    },
  }
}

/**
 * Format autopay result for display
 *
 * @param result - AutoPay result
 * @returns Formatted string
 */
export function formatAutoPayResult(result: AutoPayResult): string {
  const lines: string[] = ['## AutoPay Result', '']

  if (result.success) {
    lines.push(`**Status:** Success (${result.statusCode})`)
  } else {
    lines.push(`**Status:** Failed (${result.statusCode})`)
  }

  if (result.payment) {
    lines.push('')
    lines.push('### Payment Details')
    lines.push(`- **Network:** ${result.payment.network}`)
    lines.push(`- **Scheme:** ${result.payment.scheme}`)
    lines.push(`- **Amount:** ${result.payment.amount}`)
    lines.push(`- **Pay To:** \`${result.payment.payTo}\``)
  }

  if (result.error) {
    lines.push('')
    lines.push(`**Error:** ${result.error}`)
  }

  if (result.body) {
    lines.push('')
    lines.push('### Response Content')
    if (result.contentType) {
      lines.push(`_Content-Type: ${result.contentType}_`)
    }
    lines.push('')
    lines.push('```')
    lines.push(result.body)
    lines.push('```')
  }

  return lines.join('\n')
}
