/**
 * erc8004/resolveAgent - Look up an agent's on-chain identity
 */

import { z } from 'zod'
import { resolveAgent } from '@t402/erc8004'
import type { ResolvedAgent, AgentRegistryId } from '@t402/erc8004'
import type { SupportedNetwork } from '../types.js'
import { createErc8004Client } from './erc8004Shared.js'

/**
 * Input schema for resolveAgent tool
 */
export const erc8004ResolveAgentInputSchema = z.object({
  agentId: z.number().int().nonnegative().describe('Agent NFT token ID on the Identity Registry'),
  agentRegistry: z
    .string()
    .regex(/^eip155:\d+:0x[a-fA-F0-9]+$/)
    .describe('Agent registry identifier (e.g., "eip155:8453:0xRegistryAddress")'),
})

export type Erc8004ResolveAgentInput = z.infer<typeof erc8004ResolveAgentInputSchema>

/**
 * Execute resolveAgent tool
 */
export async function executeErc8004ResolveAgent(
  input: Erc8004ResolveAgentInput,
  rpcUrls?: Partial<Record<SupportedNetwork, string>>,
): Promise<ResolvedAgent> {
  const { client, registryAddress } = createErc8004Client(input.agentRegistry, rpcUrls)

  return resolveAgent(
    client,
    registryAddress as `0x${string}`,
    BigInt(input.agentId),
    input.agentRegistry as AgentRegistryId,
  )
}

/**
 * Format resolveAgent result for display
 */
export function formatErc8004ResolveAgentResult(agent: ResolvedAgent): string {
  const lines: string[] = [
    `## Agent Identity (ID: ${agent.agentId})`,
    '',
    `**Registry:** ${agent.registry.id}`,
    `**Wallet:** \`${agent.agentWallet}\``,
    `**Owner:** \`${agent.owner}\``,
    `**Registration URI:** ${agent.agentURI}`,
    '',
  ]

  if (agent.registration) {
    const reg = agent.registration
    lines.push('### Registration File')
    if (reg.name) lines.push(`- **Name:** ${reg.name}`)
    if (reg.description) lines.push(`- **Description:** ${reg.description}`)
    if (reg.image) lines.push(`- **Image:** ${reg.image}`)
    if (reg.x402Support !== undefined) lines.push(`- **x402 Support:** ${reg.x402Support}`)

    if (reg.services?.length) {
      lines.push('')
      lines.push('### Services')
      for (const svc of reg.services) {
        lines.push(`- **${svc.name}:** ${svc.endpoint}`)
      }
    }
  }

  return lines.join('\n')
}
