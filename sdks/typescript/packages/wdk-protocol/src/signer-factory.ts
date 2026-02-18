/**
 * Chain detection utilities for CAIP-2 network identifiers
 */

/**
 * CAIP-2 namespace prefixes
 */
const CAIP2_EVM = 'eip155:'
const CAIP2_TON = 'ton:'
const CAIP2_SOLANA = 'solana:'
const CAIP2_TRON = 'tron:'
const CAIP2_NEAR = 'near:'
const CAIP2_APTOS = 'aptos:'
const CAIP2_TEZOS = 'tezos:'
const CAIP2_POLKADOT = 'polkadot:'
const CAIP2_STACKS = 'stacks:'
const CAIP2_COSMOS = 'cosmos:'

/**
 * Chain family detected from CAIP-2 network identifier
 */
export type ChainFamily =
  | 'evm'
  | 'ton'
  | 'solana'
  | 'tron'
  | 'near'
  | 'aptos'
  | 'tezos'
  | 'polkadot'
  | 'stacks'
  | 'cosmos'

/**
 * Detect chain family from a CAIP-2 network identifier
 *
 * @param network - CAIP-2 network identifier (e.g., "eip155:1", "ton:mainnet")
 * @returns The chain family
 * @throws Error if network prefix is not recognized
 */
export function detectChainFamily(network: string): ChainFamily {
  if (network.startsWith(CAIP2_EVM)) return 'evm'
  if (network.startsWith(CAIP2_TON)) return 'ton'
  if (network.startsWith(CAIP2_SOLANA)) return 'solana'
  if (network.startsWith(CAIP2_TRON)) return 'tron'
  if (network.startsWith(CAIP2_NEAR)) return 'near'
  if (network.startsWith(CAIP2_APTOS)) return 'aptos'
  if (network.startsWith(CAIP2_TEZOS)) return 'tezos'
  if (network.startsWith(CAIP2_POLKADOT)) return 'polkadot'
  if (network.startsWith(CAIP2_STACKS)) return 'stacks'
  if (network.startsWith(CAIP2_COSMOS)) return 'cosmos'

  throw new Error(
    `Unsupported network: ${network}. Cannot detect chain family from CAIP-2 prefix.`,
  )
}

/**
 * Map of EVM chain names to CAIP-2 identifiers
 */
export const EVM_CHAIN_MAP: Record<string, string> = {
  ethereum: 'eip155:1',
  base: 'eip155:8453',
  arbitrum: 'eip155:42161',
  optimism: 'eip155:10',
  polygon: 'eip155:137',
  avalanche: 'eip155:43114',
  ink: 'eip155:57073',
  berachain: 'eip155:80094',
  unichain: 'eip155:130',
}

/**
 * Get EVM chain name from CAIP-2 network identifier
 *
 * @param network - CAIP-2 network (e.g., "eip155:42161")
 * @returns Chain name (e.g., "arbitrum") or undefined
 */
export function getEvmChainName(network: string): string | undefined {
  for (const [name, caip2] of Object.entries(EVM_CHAIN_MAP)) {
    if (caip2 === network) return name
  }
  return undefined
}

/**
 * Check if a network is an EVM chain
 *
 * @param network - CAIP-2 network identifier
 * @returns True if the network is an EVM chain
 */
export function isEvmNetwork(network: string): boolean {
  return network.startsWith(CAIP2_EVM)
}
