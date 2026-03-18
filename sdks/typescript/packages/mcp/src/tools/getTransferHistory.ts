/**
 * t402/getTransferHistory - Query recent ERC-20 Transfer events for an address
 */

import { z } from 'zod'
import { createPublicClient, http, formatUnits, parseAbiItem, type Address } from 'viem'
import * as chains from 'viem/chains'
import type { SupportedNetwork } from '../types.js'
import {
  DEFAULT_RPC_URLS,
  CHAIN_IDS,
  EXPLORER_URLS,
  USDC_ADDRESSES,
  USDT_ADDRESSES,
  USDT0_ADDRESSES,
} from '../constants.js'

/**
 * Input schema for getTransferHistory tool
 */
export const getTransferHistoryInputSchema = z.object({
  network: z
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
    .describe('Blockchain network to query'),
  address: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .describe('Wallet address to get transfer history for'),
  token: z
    .enum(['USDC', 'USDT', 'USDT0'])
    .optional()
    .describe('Filter by specific token. If not provided, queries all supported stablecoins.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Maximum number of transfers to return (default: 10, max: 100)'),
})

export type GetTransferHistoryInput = z.infer<typeof getTransferHistoryInputSchema>

/**
 * A single transfer event
 */
export interface TransferEvent {
  /** Transaction hash */
  txHash: string
  /** Block number */
  blockNumber: string
  /** Sender address */
  from: string
  /** Recipient address */
  to: string
  /** Transfer amount (formatted) */
  amount: string
  /** Token symbol */
  token: string
  /** Token contract address */
  tokenAddress: string
  /** Whether this address sent (out) or received (in) */
  direction: 'in' | 'out'
}

/**
 * Transfer history result
 */
export interface TransferHistoryResult {
  /** Network queried */
  network: SupportedNetwork
  /** Chain ID */
  chainId: number
  /** Address queried */
  address: string
  /** Transfer events (most recent first) */
  transfers: TransferEvent[]
  /** Explorer base URL */
  explorerUrl: string
}

/**
 * Get the viem chain configuration for a network
 */
function getViemChain(network: SupportedNetwork) {
  switch (network) {
    case 'ethereum':
      return chains.mainnet
    case 'base':
      return chains.base
    case 'arbitrum':
      return chains.arbitrum
    case 'optimism':
      return chains.optimism
    case 'polygon':
      return chains.polygon
    case 'avalanche':
      return chains.avalanche
    case 'ink':
      return chains.ink
    case 'berachain':
      return chains.berachain
    case 'unichain':
      return chains.unichain
    default:
      return chains.mainnet
  }
}

/**
 * Token decimals lookup (stablecoins are all 6 decimals)
 */
const TOKEN_DECIMALS: Record<string, number> = {
  USDC: 6,
  USDT: 6,
  USDT0: 6,
}

/**
 * Execute getTransferHistory tool
 */
export async function executeGetTransferHistory(
  input: GetTransferHistoryInput,
  rpcUrls?: Partial<Record<SupportedNetwork, string>>,
): Promise<TransferHistoryResult> {
  const { network, address, token, limit = 10 } = input
  const walletAddress = address.toLowerCase() as Address

  const rpcUrl = rpcUrls?.[network] || DEFAULT_RPC_URLS[network]
  const chain = getViemChain(network)

  const client = createPublicClient({
    chain,
    transport: http(rpcUrl),
  })

  // Determine which token contracts to query
  const tokenContracts: { address: Address; symbol: string }[] = []

  if (token) {
    // Query specific token
    const addresses: Partial<Record<SupportedNetwork, Address>> =
      token === 'USDC' ? USDC_ADDRESSES : token === 'USDT' ? USDT_ADDRESSES : USDT0_ADDRESSES
    const addr = addresses[network]
    if (addr) {
      tokenContracts.push({ address: addr, symbol: token })
    }
  } else {
    // Query all supported stablecoins on this network
    if (USDC_ADDRESSES[network]) {
      tokenContracts.push({ address: USDC_ADDRESSES[network]!, symbol: 'USDC' })
    }
    if (USDT_ADDRESSES[network]) {
      tokenContracts.push({ address: USDT_ADDRESSES[network]!, symbol: 'USDT' })
    }
    if (USDT0_ADDRESSES[network]) {
      tokenContracts.push({ address: USDT0_ADDRESSES[network]!, symbol: 'USDT0' })
    }
  }

  if (tokenContracts.length === 0) {
    return {
      network,
      chainId: CHAIN_IDS[network],
      address,
      transfers: [],
      explorerUrl: EXPLORER_URLS[network],
    }
  }

  // Get current block number and compute a reasonable lookback window
  const currentBlock = await client.getBlockNumber()
  // Look back ~50k blocks (roughly 1-7 days depending on chain)
  const fromBlock = currentBlock > 50000n ? currentBlock - 50000n : 0n

  const transferEvent = parseAbiItem(
    'event Transfer(address indexed from, address indexed to, uint256 value)',
  )

  // Query logs for each token — both sent and received
  const allTransfers: TransferEvent[] = []

  for (const tokenContract of tokenContracts) {
    const decimals = TOKEN_DECIMALS[tokenContract.symbol] ?? 6

    // Transfers sent by the address
    const [sentLogs, receivedLogs] = await Promise.all([
      client.getLogs({
        address: tokenContract.address,
        event: transferEvent,
        args: { from: walletAddress },
        fromBlock,
        toBlock: 'latest',
      }),
      client.getLogs({
        address: tokenContract.address,
        event: transferEvent,
        args: { to: walletAddress },
        fromBlock,
        toBlock: 'latest',
      }),
    ])

    for (const log of sentLogs) {
      allTransfers.push({
        txHash: log.transactionHash!,
        blockNumber: (log.blockNumber ?? 0n).toString(),
        from: (log.args.from as string) ?? '',
        to: (log.args.to as string) ?? '',
        amount: formatUnits((log.args.value as bigint) ?? 0n, decimals),
        token: tokenContract.symbol,
        tokenAddress: tokenContract.address,
        direction: 'out',
      })
    }

    for (const log of receivedLogs) {
      allTransfers.push({
        txHash: log.transactionHash!,
        blockNumber: (log.blockNumber ?? 0n).toString(),
        from: (log.args.from as string) ?? '',
        to: (log.args.to as string) ?? '',
        amount: formatUnits((log.args.value as bigint) ?? 0n, decimals),
        token: tokenContract.symbol,
        tokenAddress: tokenContract.address,
        direction: 'in',
      })
    }
  }

  // Sort by block number descending (most recent first), then limit
  allTransfers.sort((a, b) => {
    const blockA = BigInt(a.blockNumber)
    const blockB = BigInt(b.blockNumber)
    if (blockB > blockA) return 1
    if (blockB < blockA) return -1
    return 0
  })

  return {
    network,
    chainId: CHAIN_IDS[network],
    address,
    transfers: allTransfers.slice(0, limit),
    explorerUrl: EXPLORER_URLS[network],
  }
}

/**
 * Format transfer history result for display
 */
export function formatTransferHistoryResult(result: TransferHistoryResult): string {
  const lines = [
    `## Transfer History on ${result.network} (Chain ID: ${result.chainId})`,
    '',
    `**Address:** ${result.address}`,
    '',
  ]

  if (result.transfers.length === 0) {
    lines.push('_No recent transfers found_')
    return lines.join('\n')
  }

  lines.push(`Found ${result.transfers.length} recent transfer(s):`, '')

  for (const tx of result.transfers) {
    const arrow = tx.direction === 'in' ? 'RECEIVED' : 'SENT'
    const counterparty = tx.direction === 'in' ? `from ${tx.from}` : `to ${tx.to}`
    lines.push(
      `- **${arrow}** ${tx.amount} ${tx.token} ${counterparty}`,
      `  Block: ${tx.blockNumber} | [View Tx](${result.explorerUrl}/tx/${tx.txHash})`,
      '',
    )
  }

  return lines.join('\n')
}
