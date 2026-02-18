/**
 * WDK TRON Gas-Free Constants
 *
 * Addresses and configuration for gas-free TRON payments.
 */

/** USDT contract address on TRON mainnet (TRC20) */
export const TRON_USDT_ADDRESS = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'

/** USDT contract address on TRON Shasta testnet */
export const TRON_USDT_TESTNET_ADDRESS = 'TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs'

/** USDT0 contract address on TRON mainnet */
export const TRON_USDT0_ADDRESS = 'TKiUqMmnCBPqRfREwNExNYKG2KQqj5Gd2m'

/** Default TRON mainnet full node URL */
export const TRON_MAINNET_URL = 'https://api.trongrid.io'

/** Default TRON Shasta testnet full node URL */
export const TRON_TESTNET_URL = 'https://api.shasta.trongrid.io'

/** Token decimals for TRC20 USDT */
export const TRON_USDT_DECIMALS = 6

/** Token addresses by network and token type */
export const TOKEN_ADDRESSES: Record<string, Record<string, string>> = {
  mainnet: {
    USDT: TRON_USDT_ADDRESS,
    USDT0: TRON_USDT0_ADDRESS,
  },
  testnet: {
    USDT: TRON_USDT_TESTNET_ADDRESS,
  },
}

/**
 * Get the token address for a given token type and network
 */
export function getTokenAddress(
  token: 'USDT' | 'USDT0',
  network: 'mainnet' | 'testnet' = 'mainnet',
): string {
  const addresses = TOKEN_ADDRESSES[network]
  if (!addresses) {
    throw new Error(`Unsupported TRON network: ${network}`)
  }

  const address = addresses[token]
  if (!address) {
    throw new Error(`Token ${token} not available on TRON ${network}`)
  }

  return address
}
