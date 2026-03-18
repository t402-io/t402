/**
 * t402/signMessage - Sign a message using the configured wallet
 */

import { z } from 'zod'
import type { SupportedNetwork } from '../types.js'

/**
 * Input schema for signMessage tool
 */
export const signMessageInputSchema = z.object({
  chain: z
    .enum([
      'ethereum',
      'base',
      'arbitrum',
      'optimism',
      'polygon',
      'avalanche',
      'ink',
      'berachain',
      'unichain',
    ])
    .describe('Blockchain network context for signing'),
  message: z.string().min(1).describe('Message to sign'),
})

export type SignMessageInput = z.infer<typeof signMessageInputSchema>

/**
 * Sign message result
 */
export interface SignMessageResult {
  /** The original message that was signed */
  message: string
  /** The produced signature (hex) */
  signature: string
  /** The signer address */
  address: string
  /** Network context */
  network: SupportedNetwork
}

/**
 * Execute signMessage tool
 *
 * Currently throws because wallet signing requires a configured private key.
 * This will be implemented when the MCP server supports wallet configuration.
 */
export async function executeSignMessage(_input: SignMessageInput): Promise<SignMessageResult> {
  throw new Error(
    'Wallet not configured. To sign messages, configure a private key via the T402_PRIVATE_KEY environment variable.',
  )
}

/**
 * Format sign message result for display
 */
export function formatSignMessageResult(result: SignMessageResult): string {
  const lines = [
    `## Message Signed on ${result.network}`,
    '',
    `- **Signer:** ${result.address}`,
    `- **Message:** ${result.message.length > 100 ? result.message.slice(0, 100) + '...' : result.message}`,
    `- **Signature:** \`${result.signature}\``,
  ]

  return lines.join('\n')
}
