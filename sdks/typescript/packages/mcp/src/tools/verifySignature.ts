/**
 * t402/verifySignature - Verify an EIP-191 signed message
 */

import { z } from 'zod'
import { verifyMessage, type Address } from 'viem'
import type { SupportedNetwork } from '../types.js'

/**
 * Input schema for verifySignature tool
 */
export const verifySignatureInputSchema = z.object({
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
    .describe('Blockchain network context for verification'),
  message: z.string().min(1).describe('The original message that was signed'),
  signature: z
    .string()
    .regex(/^0x[a-fA-F0-9]+$/)
    .describe('The signature to verify (hex string)'),
  address: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .describe('The expected signer address'),
})

export type VerifySignatureInput = z.infer<typeof verifySignatureInputSchema>

/**
 * Signature verification result
 */
export interface VerifySignatureResult {
  /** Whether the signature is valid */
  valid: boolean
  /** The expected signer address */
  address: string
  /** The message that was verified */
  message: string
  /** Network context */
  network: SupportedNetwork
  /** Error message if verification failed */
  error?: string
}

/**
 * Execute verifySignature tool
 */
export async function executeVerifySignature(
  input: VerifySignatureInput,
): Promise<VerifySignatureResult> {
  const { chain, message, signature, address } = input

  try {
    const valid = await verifyMessage({
      address: address as Address,
      message,
      signature: signature as `0x${string}`,
    })

    return {
      valid,
      address,
      message,
      network: chain,
    }
  } catch (err) {
    return {
      valid: false,
      address,
      message,
      network: chain,
      error: err instanceof Error ? err.message : 'Unknown verification error',
    }
  }
}

/**
 * Format verification result for display
 */
export function formatVerifySignatureResult(result: VerifySignatureResult): string {
  const status = result.valid ? 'VALID' : 'INVALID'
  const lines = [
    `## Signature Verification: ${status}`,
    '',
    `- **Address:** ${result.address}`,
    `- **Network:** ${result.network}`,
    `- **Message:** ${result.message.length > 100 ? result.message.slice(0, 100) + '...' : result.message}`,
    `- **Result:** ${result.valid ? 'Signature is valid and matches the address' : 'Signature does NOT match the address'}`,
  ]

  if (result.error) {
    lines.push(`- **Error:** ${result.error}`)
  }

  return lines.join('\n')
}
