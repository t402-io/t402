/**
 * Shared utilities for ERC-8004 MCP tools
 */

import { createPublicClient, http, type Chain } from 'viem'
import * as chains from 'viem/chains'
import { parseAgentRegistry, type ERC8004ReadClient } from '@t402/erc8004'
import type { SupportedNetwork } from '../types.js'
import { DEFAULT_RPC_URLS, CHAIN_IDS } from '../constants.js'

/**
 * Map of EVM chain IDs to viem chain configs
 */
const CHAIN_ID_TO_VIEM: Record<number, Chain> = {
  1: chains.mainnet,
  8453: chains.base,
  42161: chains.arbitrum,
  10: chains.optimism,
  137: chains.polygon,
  43114: chains.avalanche,
  57073: chains.ink,
  80094: chains.berachain,
  130: chains.unichain,
}

/**
 * Reverse map: chain ID → SupportedNetwork name
 */
const CHAIN_ID_TO_NETWORK: Record<number, SupportedNetwork> = Object.fromEntries(
  Object.entries(CHAIN_IDS).map(([name, id]) => [id, name as SupportedNetwork]),
) as Record<number, SupportedNetwork>

/**
 * Create an ERC8004ReadClient from an agentRegistry string.
 *
 * Parses the registry ID, resolves the chain, and creates a viem PublicClient.
 */
export function createErc8004Client(
  agentRegistry: string,
  rpcUrls?: Partial<Record<SupportedNetwork, string>>,
): { client: ERC8004ReadClient; registryAddress: string } {
  const parsed = parseAgentRegistry(agentRegistry)
  const chainId = parseInt(parsed.chainId, 10)

  const viemChain = CHAIN_ID_TO_VIEM[chainId]
  if (!viemChain) {
    throw new Error(
      `Unsupported chain ID ${chainId} from registry ${agentRegistry}. Supported: ${Object.keys(CHAIN_ID_TO_VIEM).join(', ')}`,
    )
  }

  const network = CHAIN_ID_TO_NETWORK[chainId]
  const rpcUrl = (network && rpcUrls?.[network]) || (network && DEFAULT_RPC_URLS[network])

  const client = createPublicClient({
    chain: viemChain,
    transport: http(rpcUrl),
  })

  return { client: client as unknown as ERC8004ReadClient, registryAddress: parsed.address }
}
