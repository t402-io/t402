/**
 * t402/getGasPrice - Get current gas price for a network
 */

import { z } from 'zod'
import { createPublicClient, http, formatGwei } from 'viem'
import * as chains from 'viem/chains'
import type { SupportedNetwork } from '../types.js'
import { DEFAULT_RPC_URLS, NATIVE_SYMBOLS } from '../constants.js'

/**
 * Input schema for getGasPrice tool
 */
export const getGasPriceInputSchema = z.object({
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
    .describe('Blockchain network to check gas price on'),
})

export type GetGasPriceInput = z.infer<typeof getGasPriceInputSchema>

/**
 * Gas price result
 */
export interface GasPriceResult {
  network: SupportedNetwork
  gasPriceWei: string
  gasPriceGwei: string
  nativeSymbol: string
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
 * Execute getGasPrice tool
 */
export async function executeGetGasPrice(
  input: GetGasPriceInput,
  options: { rpcUrl?: string; demoMode?: boolean },
): Promise<GasPriceResult> {
  const { network } = input

  // Demo mode: return realistic values
  if (options.demoMode) {
    const demoGasPrices: Record<string, bigint> = {
      ethereum: 25000000000n, // 25 gwei
      base: 50000000n, // 0.05 gwei
      arbitrum: 100000000n, // 0.1 gwei
      optimism: 50000000n, // 0.05 gwei
      polygon: 30000000000n, // 30 gwei
      avalanche: 25000000000n, // 25 nAVAX
      ink: 50000000n, // 0.05 gwei
      berachain: 1000000000n, // 1 gwei
      unichain: 50000000n, // 0.05 gwei
    }

    const gasPrice = demoGasPrices[network] ?? 1000000000n
    return {
      network,
      gasPriceWei: gasPrice.toString(),
      gasPriceGwei: formatGwei(gasPrice),
      nativeSymbol: NATIVE_SYMBOLS[network],
    }
  }

  const chain = getViemChain(network)
  const transport = http(options.rpcUrl ?? DEFAULT_RPC_URLS[network])
  const client = createPublicClient({ chain, transport })

  const gasPrice = await client.getGasPrice()

  return {
    network,
    gasPriceWei: gasPrice.toString(),
    gasPriceGwei: formatGwei(gasPrice),
    nativeSymbol: NATIVE_SYMBOLS[network],
  }
}

/**
 * Format gas price result for display
 */
export function formatGasPriceResult(result: GasPriceResult): string {
  return [
    '## Gas Price',
    '',
    `- **Network:** ${result.network}`,
    `- **Gas Price:** ${result.gasPriceGwei} gwei`,
    `- **Native Token:** ${result.nativeSymbol}`,
  ].join('\n')
}
