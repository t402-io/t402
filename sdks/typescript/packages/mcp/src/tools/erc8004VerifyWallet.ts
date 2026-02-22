/**
 * erc8004/verifyWallet - Verify payTo matches agent's on-chain wallet
 */

import { z } from 'zod'
import { verifyPayToMatchesAgent } from '@t402/erc8004'
import type { SupportedNetwork } from '../types.js'
import { createErc8004Client } from './erc8004Shared.js'

/**
 * Input schema for verifyWallet tool
 */
export const erc8004VerifyWalletInputSchema = z.object({
  agentId: z.number().int().nonnegative().describe('Agent NFT token ID'),
  agentRegistry: z
    .string()
    .regex(/^eip155:\d+:0x[a-fA-F0-9]+$/)
    .describe('Agent registry identifier (e.g., "eip155:8453:0xRegistryAddress")'),
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .describe('Wallet address to verify (typically the payTo from PaymentRequirements)'),
})

export type Erc8004VerifyWalletInput = z.infer<typeof erc8004VerifyWalletInputSchema>

export interface Erc8004VerifyWalletResult {
  matches: boolean
  agentId: number
  walletAddress: string
  registryAddress: string
}

/**
 * Execute verifyWallet tool
 */
export async function executeErc8004VerifyWallet(
  input: Erc8004VerifyWalletInput,
  rpcUrls?: Partial<Record<SupportedNetwork, string>>,
): Promise<Erc8004VerifyWalletResult> {
  const { client, registryAddress } = createErc8004Client(input.agentRegistry, rpcUrls)

  const matches = await verifyPayToMatchesAgent(
    client,
    registryAddress as `0x${string}`,
    BigInt(input.agentId),
    input.walletAddress,
  )

  return {
    matches,
    agentId: input.agentId,
    walletAddress: input.walletAddress,
    registryAddress,
  }
}

/**
 * Format verifyWallet result for display
 */
export function formatErc8004VerifyWalletResult(result: Erc8004VerifyWalletResult): string {
  const status = result.matches ? 'VERIFIED' : 'MISMATCH'
  const icon = result.matches ? '[PASS]' : '[FAIL]'

  const lines: string[] = [
    `## Wallet Verification: ${icon} ${status}`,
    '',
    `| Field | Value |`,
    `|-------|-------|`,
    `| Agent ID | ${result.agentId} |`,
    `| Wallet Address | \`${result.walletAddress}\` |`,
    `| Registry | \`${result.registryAddress}\` |`,
    `| **Result** | **${result.matches ? 'Address matches on-chain agentWallet' : 'Address does NOT match on-chain agentWallet'}** |`,
  ]

  return lines.join('\n')
}
