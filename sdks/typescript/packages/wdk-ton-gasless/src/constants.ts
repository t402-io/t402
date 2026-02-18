/**
 * WDK TON Gasless Constants
 *
 * Addresses and configuration for gasless TON payments.
 */

/** USDT0 Jetton master address on TON mainnet */
export const TON_USDT0_JETTON_MASTER = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs'

/** USDT Jetton master address on TON mainnet */
export const TON_USDT_JETTON_MASTER = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs'

/** Default TON mainnet API endpoint */
export const TON_MAINNET_ENDPOINT = 'https://toncenter.com/api/v2/jsonRPC'

/** Default TON testnet API endpoint */
export const TON_TESTNET_ENDPOINT = 'https://testnet.toncenter.com/api/v2/jsonRPC'

/** Jetton decimals (USDT0 on TON uses 6 decimals) */
export const TON_JETTON_DECIMALS = 6

/** Token addresses by token type */
export const JETTON_ADDRESSES: Record<string, string> = {
  USDT0: TON_USDT0_JETTON_MASTER,
  USDT: TON_USDT_JETTON_MASTER,
}

/**
 * Get the Jetton master address for a given token type
 */
export function getJettonAddress(token: 'USDT0' | 'USDT'): string {
  const address = JETTON_ADDRESSES[token]
  if (!address) {
    throw new Error(`Unsupported token on TON: ${token}`)
  }
  return address
}
