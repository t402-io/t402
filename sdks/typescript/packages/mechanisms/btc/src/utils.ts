/**
 * Bitcoin & Lightning Utility Functions
 *
 * Helper functions for address validation, unit conversion,
 * and invoice validation.
 */

import { SATS_PER_BTC, MAINNET_ADDRESS_PREFIXES, TESTNET_ADDRESS_PREFIXES } from './constants.js'

/**
 * Convert satoshis to BTC
 *
 * @param sats - Amount in satoshis
 * @returns Amount in BTC as string (to avoid floating point issues)
 */
export function satoshisToBtc(sats: bigint | number | string): string {
  const satsBigInt = BigInt(sats)
  const whole = satsBigInt / BigInt(SATS_PER_BTC)
  const frac = satsBigInt % BigInt(SATS_PER_BTC)

  if (frac === 0n) {
    return whole.toString()
  }

  const fracStr = frac.toString().padStart(8, '0')
  return `${whole}.${fracStr}`.replace(/\.?0+$/, '')
}

/**
 * Convert BTC to satoshis
 *
 * @param btc - Amount in BTC (string or number)
 * @returns Amount in satoshis as bigint
 */
export function btcToSatoshis(btc: string | number): bigint {
  const btcStr = typeof btc === 'number' ? btc.toString() : btc
  const [wholePart, fracPart = ''] = btcStr.split('.')
  const paddedFrac = fracPart.padEnd(8, '0').slice(0, 8)
  const combined = wholePart + paddedFrac
  const result = BigInt(combined.replace(/^0+/, '') || '0')
  return result
}

/**
 * Validate a Bitcoin address (basic format validation)
 *
 * Checks address prefix against known formats:
 * - Mainnet: bc1 (bech32), 1 (P2PKH), 3 (P2SH)
 * - Testnet: tb1 (bech32), m/n (P2PKH), 2 (P2SH)
 *
 * @param address - Bitcoin address to validate
 * @returns true if the address has a valid format
 */
export function validateBitcoinAddress(address: string): boolean {
  if (!address || address.length < 14 || address.length > 90) {
    return false
  }

  const allPrefixes = [...MAINNET_ADDRESS_PREFIXES, ...TESTNET_ADDRESS_PREFIXES]
  return allPrefixes.some((prefix) => address.startsWith(prefix))
}

/**
 * Check if a Bitcoin address is for mainnet
 *
 * @param address - Bitcoin address
 * @returns true if mainnet address
 */
export function isMainnetAddress(address: string): boolean {
  return MAINNET_ADDRESS_PREFIXES.some((prefix) => address.startsWith(prefix))
}

/**
 * Check if a Bitcoin address is for testnet
 *
 * @param address - Bitcoin address
 * @returns true if testnet address
 */
export function isTestnetAddress(address: string): boolean {
  return TESTNET_ADDRESS_PREFIXES.some((prefix) => address.startsWith(prefix))
}

/**
 * Validate a BOLT11 Lightning invoice (basic format validation)
 *
 * BOLT11 invoices follow the format:
 * - lnbc... for mainnet
 * - lntb... for testnet
 * - lnbcrt... for regtest
 *
 * @param invoice - BOLT11 invoice string
 * @returns true if the invoice has a valid format
 */
export function validateBolt11Invoice(invoice: string): boolean {
  if (!invoice || invoice.length < 20) {
    return false
  }

  const lower = invoice.toLowerCase()
  return lower.startsWith('lnbc') || lower.startsWith('lntb') || lower.startsWith('lnbcrt')
}

/**
 * Validate a hex-encoded string
 *
 * @param hex - String to validate
 * @param expectedLength - Expected byte length (hex length / 2)
 * @returns true if valid hex of expected length
 */
export function isValidHex(hex: string, expectedLength?: number): boolean {
  if (!/^[0-9a-fA-F]+$/.test(hex)) {
    return false
  }
  if (expectedLength !== undefined && hex.length !== expectedLength * 2) {
    return false
  }
  return true
}
