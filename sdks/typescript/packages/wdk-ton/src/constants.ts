/**
 * WDK TON Wallet Constants
 *
 * Addresses and configuration for TON wallet operations.
 */

/** USDT0 Jetton master address on TON mainnet */
export const TON_USDT0_JETTON_MASTER = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs'

/** USDT Jetton master address on TON mainnet */
export const TON_USDT_JETTON_MASTER = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs'

/** Default TON mainnet API endpoint */
export const TON_MAINNET_ENDPOINT = 'https://toncenter.com/api/v2/jsonRPC'

/** Default TON testnet API endpoint */
export const TON_TESTNET_ENDPOINT = 'https://testnet.toncenter.com/api/v2/jsonRPC'

/** CAIP-2 network identifier for TON mainnet */
export const TON_MAINNET_NETWORK = 'ton:mainnet'

/** CAIP-2 network identifier for TON testnet */
export const TON_TESTNET_NETWORK = 'ton:testnet'

/** Jetton decimals (USDT0 on TON uses 6 decimals) */
export const TON_JETTON_DECIMALS = 6

/**
 * Get the default API endpoint for a network
 */
export function getDefaultEndpoint(network: 'mainnet' | 'testnet' = 'mainnet'): string {
  return network === 'testnet' ? TON_TESTNET_ENDPOINT : TON_MAINNET_ENDPOINT
}
