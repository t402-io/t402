/**
 * WDK TRON Gas-Free Adapter
 *
 * Detection and delegation layer for @tetherto/wdk-wallet-tron-gasfree.
 * Tries the upstream module first, falls back to custom duck-typed logic.
 */

/**
 * Upstream module interface (from @tetherto/wdk-wallet-tron-gasfree)
 *
 * The upstream module is expected to expose these methods on its wallet instance.
 * We detect it by checking for characteristic method names.
 */
export interface UpstreamTronGasfreeWallet {
  getAddress(): Promise<string>
  sendGasfreeTransfer(params: {
    to: string
    amount: string
    tokenAddress: string
    memo?: string
  }): Promise<{ txId: string }>
  getBalance(address: string, tokenAddress: string): Promise<string>
}

/**
 * Normalized interface that our client consumes.
 * Both upstream and custom implementations produce this shape.
 */
export interface TronGasfreeWalletAdapter {
  getAddress(): Promise<string>
  sendGasfreeTransfer(params: {
    to: string
    amount: string
    tokenAddress: string
    memo?: string
  }): Promise<{ txId: string }>
  getBalance(address: string, tokenAddress: string): Promise<string>
}

/**
 * Check if a WDK instance looks like an upstream @tetherto/wdk-wallet-tron-gasfree wallet
 */
export function isUpstreamTronGasfreeWallet(
  instance: unknown,
): instance is UpstreamTronGasfreeWallet {
  if (typeof instance !== 'object' || instance === null) return false
  const obj = instance as Record<string, unknown>
  return (
    typeof obj.getAddress === 'function' &&
    typeof obj.sendGasfreeTransfer === 'function' &&
    typeof obj.getBalance === 'function'
  )
}

/**
 * Adapt a WDK instance into a TronGasfreeWalletAdapter.
 *
 * Resolution order:
 * 1. If the instance has the full upstream interface, use it directly
 * 2. If the instance has alternative method names, wrap them
 * 3. Throw if no compatible interface is found
 */
export function adaptTronGasfreeWallet(instance: unknown): TronGasfreeWalletAdapter {
  if (isUpstreamTronGasfreeWallet(instance)) {
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
  let sendGasfreeTransfer: TronGasfreeWalletAdapter['sendGasfreeTransfer']
  if (typeof obj.sendGasfreeTransfer === 'function') {
    sendGasfreeTransfer = (params) =>
      (
        obj.sendGasfreeTransfer as (
          p: Record<string, unknown>,
        ) => Promise<{ txId: string }>
      )(params)
  } else if (typeof obj.transfer === 'function') {
    sendGasfreeTransfer = (params) =>
      (
        obj.transfer as (
          p: Record<string, unknown>,
        ) => Promise<{ txId: string }>
      )({ to: params.to, amount: params.amount, tokenAddress: params.tokenAddress })
  } else {
    throw new Error(
      'WDK instance does not support gas-free transfers. ' +
        'Ensure @tetherto/wdk-wallet-tron-gasfree is properly configured.',
    )
  }

  // Build balance query
  let getBalance: TronGasfreeWalletAdapter['getBalance']
  if (typeof obj.getBalance === 'function') {
    getBalance = (address, tokenAddress) =>
      (obj.getBalance as (a: string, t: string) => Promise<string>)(address, tokenAddress)
  } else {
    throw new Error('WDK instance does not support balance queries')
  }

  return { getAddress, sendGasfreeTransfer, getBalance }
}

/**
 * Try to dynamically import the upstream @tetherto/wdk-wallet-tron-gasfree module.
 * Returns the module default export if available, or undefined if not installed.
 *
 * Uses a variable for the module specifier to avoid TypeScript
 * emitting type declarations for the optional dependency.
 */
export async function tryLoadUpstreamModule(): Promise<unknown | undefined> {
  try {
    const moduleName = '@tetherto/wdk-wallet-tron-gasfree'
    const mod = await (Function('m', 'return import(m)') as (m: string) => Promise<unknown>)(
      moduleName,
    )
    const resolved = mod as Record<string, unknown>
    return resolved.default ?? resolved
  } catch {
    return undefined
  }
}
