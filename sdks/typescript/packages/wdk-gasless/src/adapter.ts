/**
 * WDK EVM Gasless Adapter
 *
 * Detection and delegation layer for @tetherto/wdk-wallet-evm-erc-4337.
 * When the upstream module is available, its smart account implementation
 * is used. Otherwise, the custom Safe-based WdkSmartAccount is used as fallback.
 */

import type { Address, Hex } from 'viem'
import type { SmartAccountSigner } from '@t402/evm'
import type { WdkSmartAccountConfig } from './types.js'
import { createWdkSmartAccount } from './account.js'

/**
 * Upstream ERC-4337 wallet interface (from @tetherto/wdk-wallet-evm-erc-4337)
 *
 * The upstream module provides a smart account that implements these methods.
 * We detect it by checking for characteristic method signatures.
 */
export interface UpstreamErc4337Wallet {
  getAddress(): Promise<Address>
  signUserOpHash(hash: Hex): Promise<Hex>
  getInitCode(): Promise<Hex>
  isDeployed(): Promise<boolean>
  encodeExecute(target: Address, value: bigint, data: Hex): Hex
  encodeExecuteBatch(targets: Address[], values: bigint[], datas: Hex[]): Hex
}

/**
 * Check if an object looks like an upstream ERC-4337 smart account signer
 */
export function isUpstreamErc4337Wallet(instance: unknown): instance is UpstreamErc4337Wallet {
  if (typeof instance !== 'object' || instance === null) return false
  const obj = instance as Record<string, unknown>
  return (
    typeof obj.getAddress === 'function' &&
    typeof obj.signUserOpHash === 'function' &&
    typeof obj.getInitCode === 'function' &&
    typeof obj.isDeployed === 'function' &&
    typeof obj.encodeExecute === 'function' &&
    typeof obj.encodeExecuteBatch === 'function'
  )
}

/**
 * Create a SmartAccountSigner, preferring the upstream @tetherto/wdk-wallet-evm-erc-4337
 * module when available, falling back to the custom WdkSmartAccount.
 *
 * Resolution order:
 * 1. If `upstreamWallet` is provided and satisfies SmartAccountSigner, use it directly
 * 2. If `upstreamModule` is provided (the module constructor), create an instance
 * 3. Fall back to custom WdkSmartAccount (Safe-based ERC-4337)
 *
 * @param config - Smart account configuration
 * @param upstreamWallet - Optional pre-created upstream wallet instance
 */
export async function createSmartAccountSigner(
  config: WdkSmartAccountConfig,
  upstreamWallet?: unknown,
): Promise<SmartAccountSigner> {
  // Case 1: Pre-created upstream wallet that satisfies the signer interface
  if (upstreamWallet && isUpstreamErc4337Wallet(upstreamWallet)) {
    return upstreamWallet as SmartAccountSigner
  }

  // Case 2: Try to dynamically load the upstream module
  const upstreamModule = await tryLoadUpstreamModule()
  if (upstreamModule) {
    try {
      const wallet = await createFromUpstream(upstreamModule, config)
      if (wallet && isUpstreamErc4337Wallet(wallet)) {
        return wallet as SmartAccountSigner
      }
    } catch {
      // Fall through to custom implementation
    }
  }

  // Case 3: Fall back to custom Safe-based WdkSmartAccount
  return createWdkSmartAccount(config)
}

/**
 * Try to create a smart account from the upstream module.
 * The upstream module is expected to export a factory function.
 */
async function createFromUpstream(
  upstreamModule: unknown,
  config: WdkSmartAccountConfig,
): Promise<unknown> {
  if (typeof upstreamModule !== 'object' || upstreamModule === null) {
    return undefined
  }

  const mod = upstreamModule as Record<string, unknown>

  // Try common factory function names from the upstream module
  const factoryNames = ['createSmartAccount', 'createErc4337Wallet', 'create', 'default']
  for (const name of factoryNames) {
    if (typeof mod[name] === 'function') {
      const factory = mod[name] as (config: Record<string, unknown>) => Promise<unknown>
      return factory({
        account: config.wdkAccount,
        publicClient: config.publicClient,
        chainId: config.chainId,
        saltNonce: config.saltNonce,
      })
    }
  }

  return undefined
}

/**
 * Try to dynamically import the upstream @tetherto/wdk-wallet-evm-erc-4337 module.
 * Returns the module if available, or undefined if not installed.
 *
 * Uses a string variable for the module specifier to avoid TypeScript
 * emitting type declarations for the optional dependency.
 */
export async function tryLoadUpstreamModule(): Promise<unknown | undefined> {
  try {
    // Use a variable to prevent TypeScript from resolving the module at compile time
    const moduleName = '@tetherto/wdk-wallet-evm-erc-4337'
    const mod = await (Function('m', 'return import(m)') as (m: string) => Promise<unknown>)(
      moduleName,
    )
    const resolved = mod as Record<string, unknown>
    return resolved.default ?? resolved
  } catch {
    return undefined
  }
}
