/**
 * WDK TON Gasless Adapter
 *
 * Detection and delegation layer for @tetherto/wdk-wallet-ton-gasless.
 * Tries the upstream module first, falls back to custom duck-typed logic.
 */

/**
 * Upstream module interface (from @tetherto/wdk-wallet-ton-gasless)
 *
 * The upstream module is expected to expose these methods on its wallet instance.
 * We detect it by checking for characteristic method names.
 */
export interface UpstreamTonGaslessWallet {
  getAddress(): Promise<string>
  sendGaslessTransfer(params: {
    to: string
    amount: string
    jettonAddress: string
    memo?: string
  }): Promise<{ txHash: string }>
  getJettonBalance(address: string, jettonAddress: string): Promise<string>
}

/**
 * Normalized interface that our client consumes.
 * Both upstream and custom implementations produce this shape.
 */
export interface TonGaslessWalletAdapter {
  getAddress(): Promise<string>
  sendGaslessTransfer(params: {
    to: string
    amount: string
    jettonAddress: string
    memo?: string
  }): Promise<{ txHash: string }>
  getJettonBalance(address: string, jettonAddress: string): Promise<string>
}

/**
 * Check if a WDK instance looks like an upstream @tetherto/wdk-wallet-ton-gasless wallet
 */
export function isUpstreamTonGaslessWallet(
  instance: unknown,
): instance is UpstreamTonGaslessWallet {
  if (typeof instance !== 'object' || instance === null) return false
  const obj = instance as Record<string, unknown>
  return (
    typeof obj.getAddress === 'function' &&
    typeof obj.sendGaslessTransfer === 'function' &&
    typeof obj.getJettonBalance === 'function'
  )
}

/**
 * Adapt a WDK instance into a TonGaslessWalletAdapter.
 *
 * Resolution order:
 * 1. If the instance has the full upstream interface, use it directly
 * 2. If the instance has alternative method names, wrap them
 * 3. Throw if no compatible interface is found
 */
export function adaptTonGaslessWallet(instance: unknown): TonGaslessWalletAdapter {
  if (isUpstreamTonGaslessWallet(instance)) {
    return instance
  }

  if (typeof instance !== 'object' || instance === null) {
    throw new Error('WDK instance must be a non-null object')
  }

  const obj = instance as Record<string, unknown>

  // Build address resolver
  let getAddress: () => Promise<string>
  if (typeof obj.getAddress === 'function') {
    getAddress = () => (obj.getAddress as () => Promise<string>)()
  } else if (typeof obj.address === 'string') {
    const addr = obj.address as string
    getAddress = () => Promise.resolve(addr)
  } else {
    throw new Error('WDK instance must provide getAddress() or address property')
  }

  // Build transfer method
  let sendGaslessTransfer: TonGaslessWalletAdapter['sendGaslessTransfer']
  if (typeof obj.sendGaslessTransfer === 'function') {
    sendGaslessTransfer = (params) =>
      (obj.sendGaslessTransfer as (p: Record<string, unknown>) => Promise<{ txHash: string }>)(
        params,
      )
  } else if (typeof obj.transferJettonGasless === 'function') {
    sendGaslessTransfer = (params) =>
      (obj.transferJettonGasless as (p: Record<string, unknown>) => Promise<{ txHash: string }>)({
        to: params.to,
        amount: params.amount,
        jettonAddress: params.jettonAddress,
      })
  } else if (typeof obj.transfer === 'function') {
    sendGaslessTransfer = (params) =>
      (obj.transfer as (p: Record<string, unknown>) => Promise<{ txHash: string }>)({
        to: params.to,
        amount: params.amount,
        jettonAddress: params.jettonAddress,
      })
  } else {
    throw new Error(
      'WDK instance does not support gasless transfers. ' +
        'Ensure @tetherto/wdk-wallet-ton-gasless is properly configured.',
    )
  }

  // Build balance query
  let getJettonBalance: TonGaslessWalletAdapter['getJettonBalance']
  if (typeof obj.getJettonBalance === 'function') {
    getJettonBalance = (address, jettonAddress) =>
      (obj.getJettonBalance as (a: string, j: string) => Promise<string>)(address, jettonAddress)
  } else if (typeof obj.getBalance === 'function') {
    getJettonBalance = (address, jettonAddress) =>
      (obj.getBalance as (a: string, j: string) => Promise<string>)(address, jettonAddress)
  } else {
    throw new Error('WDK instance does not support balance queries')
  }

  return { getAddress, sendGaslessTransfer, getJettonBalance }
}

/**
 * Try to dynamically import the upstream @tetherto/wdk-wallet-ton-gasless module.
 * Returns the module default export if available, or undefined if not installed.
 *
 * Uses a variable for the module specifier to avoid TypeScript
 * emitting type declarations for the optional dependency.
 */
export async function tryLoadUpstreamModule(): Promise<unknown | undefined> {
  try {
    const moduleName = '@tetherto/wdk-wallet-ton-gasless'
    const mod = await (Function('m', 'return import(m)') as (m: string) => Promise<unknown>)(
      moduleName,
    )
    const resolved = mod as Record<string, unknown>
    return resolved.default ?? resolved
  } catch {
    return undefined
  }
}
