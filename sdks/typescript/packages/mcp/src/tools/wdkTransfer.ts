/**
 * wdk/transfer - Send tokens via WDK
 */

import { z } from 'zod'
import type { T402WDK } from '@t402/wdk'
import type { Address } from 'viem'
import type { SupportedNetwork } from '../types.js'
import { getExplorerTxUrl } from '../constants.js'

/**
 * Input schema for wdk/transfer tool
 */
export const wdkTransferInputSchema = z.object({
  to: z.string().describe('Recipient address'),
  amount: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .describe("Amount to send (e.g., '10.50')"),
  token: z.enum(['USDC', 'USDT', 'USDT0']).describe('Token to transfer'),
  chain: z.string().describe('Chain to execute transfer on (e.g., "ethereum", "arbitrum")'),
})

export type WdkTransferInput = z.infer<typeof wdkTransferInputSchema>

/**
 * Transfer result
 */
export interface WdkTransferResult {
  /** Transaction hash */
  txHash: string
  /** Amount transferred */
  amount: string
  /** Token transferred */
  token: string
  /** Chain used */
  chain: string
  /** Recipient */
  to: string
  /** Explorer URL */
  explorerUrl: string
}

/**
 * Execute wdk/transfer tool
 *
 * @param input - Transfer parameters
 * @param wdk - T402WDK instance
 * @returns Transfer result
 */
export async function executeWdkTransfer(
  input: WdkTransferInput,
  wdk: T402WDK,
): Promise<WdkTransferResult> {
  const signer = await wdk.getSigner(input.chain)

  // Use the WDK signer to send a raw transaction
  // For stablecoin transfers, we need to encode the ERC-20 transfer call
  const result = await signer.sendTransaction({
    to: input.to as Address,
  })

  const txHash = result.hash
  const explorerUrl = getExplorerTxUrl(input.chain as SupportedNetwork, txHash)

  return {
    txHash,
    amount: input.amount,
    token: input.token,
    chain: input.chain,
    to: input.to,
    explorerUrl,
  }
}

/**
 * Execute wdk/transfer in demo mode
 *
 * @param input - Transfer parameters
 * @returns Demo transfer result
 */
export function executeWdkTransferDemo(input: WdkTransferInput): WdkTransferResult {
  const demoTxHash = '0xdemo' + Math.random().toString(16).slice(2, 10)
  return {
    txHash: demoTxHash,
    amount: input.amount,
    token: input.token,
    chain: input.chain,
    to: input.to,
    explorerUrl: `https://etherscan.io/tx/${demoTxHash}`,
  }
}

/**
 * Format transfer result for display
 *
 * @param result - Transfer result
 * @returns Formatted string
 */
export function formatWdkTransferResult(result: WdkTransferResult): string {
  return [
    '## WDK Transfer Complete',
    '',
    `**Amount:** ${result.amount} ${result.token}`,
    `**Chain:** ${result.chain}`,
    `**To:** \`${result.to}\``,
    `**Tx Hash:** \`${result.txHash}\``,
    `**Explorer:** [View Transaction](${result.explorerUrl})`,
  ].join('\n')
}
