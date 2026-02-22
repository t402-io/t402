/**
 * erc8004/checkReputation - Query an agent's reputation score
 */

import { z } from 'zod'
import { getReputationSummary } from '@t402/erc8004'
import type { ReputationSummary } from '@t402/erc8004'
import type { SupportedNetwork } from '../types.js'
import { createErc8004Client } from './erc8004Shared.js'

/**
 * Input schema for checkReputation tool
 */
export const erc8004CheckReputationInputSchema = z.object({
  agentId: z.number().int().nonnegative().describe('Agent NFT token ID'),
  agentRegistry: z
    .string()
    .regex(/^eip155:\d+:0x[a-fA-F0-9]+$/)
    .describe('Agent registry identifier (e.g., "eip155:8453:0xRegistryAddress")'),
  reputationRegistry: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .describe('Reputation Registry contract address on the same chain'),
  trustedReviewers: z
    .array(z.string().regex(/^0x[a-fA-F0-9]{40}$/))
    .min(1)
    .describe('Addresses whose feedback is trusted (required for Sybil resistance)'),
})

export type Erc8004CheckReputationInput = z.infer<typeof erc8004CheckReputationInputSchema>

/**
 * Execute checkReputation tool
 */
export async function executeErc8004CheckReputation(
  input: Erc8004CheckReputationInput,
  rpcUrls?: Partial<Record<SupportedNetwork, string>>,
): Promise<ReputationSummary> {
  const { client } = createErc8004Client(input.agentRegistry, rpcUrls)

  return getReputationSummary(
    client,
    input.reputationRegistry as `0x${string}`,
    BigInt(input.agentId),
    input.trustedReviewers as `0x${string}`[],
  )
}

/**
 * Format checkReputation result for display
 */
export function formatErc8004CheckReputationResult(summary: ReputationSummary): string {
  const lines: string[] = [
    `## Agent Reputation (ID: ${summary.agentId})`,
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Feedback Count | ${summary.count} |`,
    `| Raw Score | ${summary.summaryValue} |`,
    `| Score Decimals | ${summary.summaryValueDecimals} |`,
    `| **Normalized Score** | **${summary.normalizedScore}/100** |`,
    '',
  ]

  if (summary.normalizedScore >= 80) {
    lines.push('_High reputation — trusted agent_')
  } else if (summary.normalizedScore >= 50) {
    lines.push('_Moderate reputation_')
  } else if (summary.count > 0n) {
    lines.push('_Low reputation — exercise caution_')
  } else {
    lines.push('_No feedback recorded from trusted reviewers_')
  }

  return lines.join('\n')
}
