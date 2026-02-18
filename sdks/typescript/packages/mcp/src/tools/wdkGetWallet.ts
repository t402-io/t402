/**
 * wdk/getWallet - Get wallet info from WDK
 */

import { z } from 'zod'
import type { T402WDK } from '@t402/wdk'

/**
 * Input schema for wdk/getWallet tool
 */
export const wdkGetWalletInputSchema = z.object({})

export type WdkGetWalletInput = z.infer<typeof wdkGetWalletInputSchema>

/**
 * Wallet info result
 */
export interface WdkWalletInfo {
  /** EVM address */
  evmAddress: string
  /** Supported chains */
  chains: string[]
}

/**
 * Execute wdk/getWallet tool
 *
 * @param _input - Empty input (no params needed)
 * @param wdk - T402WDK instance
 * @returns Wallet info
 */
export async function executeWdkGetWallet(
  _input: WdkGetWalletInput,
  wdk: T402WDK,
): Promise<WdkWalletInfo> {
  const signer = await wdk.getSigner('ethereum')
  const chains = wdk.getConfiguredChains()

  return {
    evmAddress: signer.address,
    chains: chains.length > 0 ? chains : ['ethereum'],
  }
}

/**
 * Execute wdk/getWallet in demo mode
 *
 * @returns Demo wallet info
 */
export function executeWdkGetWalletDemo(): WdkWalletInfo {
  return {
    evmAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    chains: ['ethereum', 'arbitrum', 'base', 'optimism'],
  }
}

/**
 * Format wallet info for display
 *
 * @param info - Wallet info
 * @returns Formatted string
 */
export function formatWdkWalletResult(info: WdkWalletInfo): string {
  const lines: string[] = [
    '## WDK Wallet Info',
    '',
    `**EVM Address:** \`${info.evmAddress}\``,
    '',
    '### Supported Chains',
    ...info.chains.map((c) => `- ${c}`),
  ]
  return lines.join('\n')
}
