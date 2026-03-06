/**
 * t402/estimatePaymentFee - Estimate gas cost for a payment on a specific network
 */

import { z } from 'zod'
import { createPublicClient, http, formatEther, formatGwei, parseUnits } from 'viem'
import * as chains from 'viem/chains'
import type { SupportedNetwork } from '../types.js'
import { DEFAULT_RPC_URLS, NATIVE_SYMBOLS, getTokenAddress } from '../constants.js'
import { getTokenPrices } from './priceService.js'

/**
 * Input schema for estimatePaymentFee tool
 */
export const estimatePaymentFeeInputSchema = z.object({
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
    .describe('Network to estimate fee on'),
  amount: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .describe("Payment amount (e.g., '100')"),
  token: z
    .enum(['USDC', 'USDT', 'USDT0'])
    .describe('Token to use for payment'),
})

export type EstimatePaymentFeeInput = z.infer<typeof estimatePaymentFeeInputSchema>

/**
 * Fee estimation result
 */
export interface PaymentFeeEstimate {
  network: SupportedNetwork
  gasLimit: string
  gasPriceGwei: string
  nativeCost: string
  nativeSymbol: string
  usdCost: string
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
 * Execute estimatePaymentFee tool
 */
export async function executeEstimatePaymentFee(
  input: EstimatePaymentFeeInput,
  options: { rpcUrl?: string; demoMode?: boolean },
): Promise<PaymentFeeEstimate> {
  const { network, amount, token } = input
  const nativeSymbol = NATIVE_SYMBOLS[network]

  // Demo mode: return simulated values
  if (options.demoMode) {
    const demoEstimates: Record<string, { gasLimit: bigint; gasPrice: bigint; nativePrice: number }> = {
      ethereum: { gasLimit: 65000n, gasPrice: 25000000000n, nativePrice: 3250.42 },
      base: { gasLimit: 65000n, gasPrice: 50000000n, nativePrice: 3250.42 },
      arbitrum: { gasLimit: 65000n, gasPrice: 100000000n, nativePrice: 3250.42 },
      optimism: { gasLimit: 65000n, gasPrice: 50000000n, nativePrice: 3250.42 },
      polygon: { gasLimit: 65000n, gasPrice: 30000000000n, nativePrice: 0.58 },
      avalanche: { gasLimit: 65000n, gasPrice: 25000000000n, nativePrice: 24.15 },
      ink: { gasLimit: 65000n, gasPrice: 50000000n, nativePrice: 3250.42 },
      berachain: { gasLimit: 65000n, gasPrice: 1000000000n, nativePrice: 3.82 },
      unichain: { gasLimit: 65000n, gasPrice: 50000000n, nativePrice: 3250.42 },
    }

    const est = demoEstimates[network] ?? demoEstimates['ethereum']
    const nativeCost = est.gasLimit * est.gasPrice
    const usdCost = (Number(nativeCost) / 1e18) * est.nativePrice

    return {
      network,
      gasLimit: est.gasLimit.toString(),
      gasPriceGwei: formatGwei(est.gasPrice),
      nativeCost: formatEther(nativeCost),
      nativeSymbol,
      usdCost: `$${usdCost.toFixed(4)}`,
    }
  }

  // Live mode
  const tokenAddress = getTokenAddress(network, token)
  if (!tokenAddress) {
    throw new Error(`Token ${token} is not supported on ${network}`)
  }

  const chain = getViemChain(network)
  const transport = http(options.rpcUrl ?? DEFAULT_RPC_URLS[network])
  const client = createPublicClient({ chain, transport })

  // Estimate gas for ERC20 transfer
  const amountBigInt = parseUnits(amount, 6)
  const dummyTo = '0x000000000000000000000000000000000000dEaD'

  let gasLimit: bigint
  try {
    gasLimit = await client.estimateGas({
      to: tokenAddress,
      data: `0xa9059cbb${dummyTo.slice(2).padStart(64, '0')}${amountBigInt.toString(16).padStart(64, '0')}` as `0x${string}`,
    })
  } catch {
    // Fallback to standard ERC20 transfer gas estimate
    gasLimit = 65000n
  }

  const gasPrice = await client.getGasPrice()
  const nativeCost = gasLimit * gasPrice

  // Get native token USD price
  let usdCost: string
  try {
    const prices = await getTokenPrices([nativeSymbol])
    const nativePrice = prices[nativeSymbol] ?? 0
    const cost = (Number(nativeCost) / 1e18) * nativePrice
    usdCost = `$${cost.toFixed(4)}`
  } catch {
    usdCost = 'N/A'
  }

  return {
    network,
    gasLimit: gasLimit.toString(),
    gasPriceGwei: formatGwei(gasPrice),
    nativeCost: formatEther(nativeCost),
    nativeSymbol,
    usdCost,
  }
}

/**
 * Format fee estimate result for display
 */
export function formatPaymentFeeEstimate(result: PaymentFeeEstimate): string {
  return [
    '## Payment Fee Estimate',
    '',
    `- **Network:** ${result.network}`,
    `- **Estimated Gas:** ${result.gasLimit}`,
    `- **Gas Price:** ${result.gasPriceGwei} gwei`,
    `- **Native Cost:** ${result.nativeCost} ${result.nativeSymbol}`,
    `- **USD Cost:** ${result.usdCost}`,
  ].join('\n')
}
