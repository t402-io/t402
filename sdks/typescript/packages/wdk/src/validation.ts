/**
 * Multi-chain address validation for T402 WDK
 *
 * Provides address validation and normalization across supported chain families.
 * Includes cross-chain mismatch detection to help users avoid sending to wrong chains.
 */

import type { ChainFamily } from './types.js'

/**
 * Result of validating a payment address
 */
export interface AddressValidationResult {
  /** Whether the address is valid for the specified chain family */
  valid: boolean
  /** Normalized form of the address (e.g., checksummed, lowercased) */
  normalized?: string
  /** Error message if validation failed */
  error?: string
  /** Detected chain family if the address appears to belong to a different chain */
  detectedFamily?: ChainFamily
}

// ============================================================
// Chain-specific validators
// ============================================================

const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/
const TON_RAW_RE = /^0:[0-9a-fA-F]{64}$/
const TRON_ADDRESS_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/
const BASE58_CHARS = /^[1-9A-HJ-NP-Za-km-z]+$/
const BECH32_BTC_RE = /^bc1[a-zA-HJ-NP-Z0-9]{25,90}$/
const COSMOS_BECH32_RE = /^[a-z]+1[a-z0-9]{38,58}$/

function isBase58(s: string): boolean {
  return BASE58_CHARS.test(s)
}

function validateEvm(address: string): AddressValidationResult {
  if (!EVM_ADDRESS_RE.test(address)) {
    // Cross-chain mismatch detection
    const detected = detectFamily(address, 'evm')
    if (detected) {
      return {
        valid: false,
        error: `Address appears to be a ${detected} address, not an EVM address`,
        detectedFamily: detected,
      }
    }
    return {
      valid: false,
      error: 'Invalid EVM address: must be 0x-prefixed, 40 hex characters',
    }
  }
  // Normalize to checksummed form (EIP-55 lowercase for simplicity)
  return {
    valid: true,
    normalized: address.toLowerCase(),
  }
}

function validateTon(address: string): AddressValidationResult {
  // Raw format: 0:<64 hex chars>
  if (TON_RAW_RE.test(address)) {
    return { valid: true, normalized: address.toLowerCase() }
  }

  // User-friendly format: base64url encoded, 48 chars (with checksum)
  // Also accept 44-char and 46-char forms used by some libraries
  // Supports both standard base64 and base64url encoding
  const base64UrlRe = /^[A-Za-z0-9_\-+/=]{44,48}$/
  if (base64UrlRe.test(address)) {
    return { valid: true, normalized: address }
  }

  const detected = detectFamily(address, 'ton')
  if (detected) {
    return {
      valid: false,
      error: `Address appears to be a ${detected} address, not a TON address`,
      detectedFamily: detected,
    }
  }

  return {
    valid: false,
    error:
      'Invalid TON address: must be raw format (0:<64 hex>) or user-friendly (48 chars base64)',
  }
}

function validateTron(address: string): AddressValidationResult {
  if (!TRON_ADDRESS_RE.test(address)) {
    const detected = detectFamily(address, 'tron')
    if (detected) {
      return {
        valid: false,
        error: `Address appears to be a ${detected} address, not a TRON address`,
        detectedFamily: detected,
      }
    }
    return {
      valid: false,
      error: 'Invalid TRON address: must be T-prefixed base58check, 34 characters',
    }
  }
  return { valid: true, normalized: address }
}

function validateSvm(address: string): AddressValidationResult {
  // Check for TRON address first (T-prefix, 34 chars, overlaps with base58 32-44 range)
  if (TRON_ADDRESS_RE.test(address)) {
    return {
      valid: false,
      error: 'Address appears to be a tron address, not a Solana address',
      detectedFamily: 'tron',
    }
  }

  if (!isBase58(address) || address.length < 32 || address.length > 44) {
    const detected = detectFamily(address, 'svm')
    if (detected) {
      return {
        valid: false,
        error: `Address appears to be a ${detected} address, not a Solana address`,
        detectedFamily: detected,
      }
    }
    return {
      valid: false,
      error: 'Invalid Solana address: must be base58, 32-44 characters',
    }
  }
  return { valid: true, normalized: address }
}

function validateBtc(address: string): AddressValidationResult {
  // Bech32: bc1...
  if (BECH32_BTC_RE.test(address)) {
    return { valid: true, normalized: address.toLowerCase() }
  }

  // Legacy P2PKH (1...) or P2SH (3...)
  if ((address.startsWith('1') || address.startsWith('3')) && isBase58(address)) {
    if (address.length >= 25 && address.length <= 34) {
      return { valid: true, normalized: address }
    }
  }

  const detected = detectFamily(address, 'btc')
  if (detected) {
    return {
      valid: false,
      error: `Address appears to be a ${detected} address, not a Bitcoin address`,
      detectedFamily: detected,
    }
  }

  return {
    valid: false,
    error:
      'Invalid Bitcoin address: must be bech32 (bc1...) or base58 (1... or 3...), 25-90 characters',
  }
}

function validateCosmos(address: string): AddressValidationResult {
  if (!COSMOS_BECH32_RE.test(address)) {
    const detected = detectFamily(address, 'cosmos' as ChainFamily)
    if (detected) {
      return {
        valid: false,
        error: `Address appears to be a ${detected} address, not a Cosmos address`,
        detectedFamily: detected,
      }
    }
    return {
      valid: false,
      error: 'Invalid Cosmos address: must be bech32 with lowercase prefix',
    }
  }
  return { valid: true, normalized: address }
}

// ============================================================
// Cross-chain mismatch detection
// ============================================================

type DetectableFamily = ChainFamily | 'cosmos'

/**
 * Attempt to detect which chain family an address belongs to.
 * Returns undefined if no match detected, or the family if detected.
 * `exclude` is the family we are currently validating against.
 */
function detectFamily(address: string, exclude: DetectableFamily): ChainFamily | undefined {
  if (exclude !== 'evm' && EVM_ADDRESS_RE.test(address)) return 'evm'
  if (exclude !== 'tron' && TRON_ADDRESS_RE.test(address)) return 'tron'
  if (exclude !== 'ton' && (TON_RAW_RE.test(address) || /^[A-Za-z0-9_\-+/=]{44,48}$/.test(address)))
    return 'ton'
  if (
    exclude !== 'btc' &&
    (BECH32_BTC_RE.test(address) ||
      (address.startsWith('1') &&
        isBase58(address) &&
        address.length >= 25 &&
        address.length <= 34))
  )
    return 'btc'
  if (
    exclude !== 'svm' &&
    exclude !== 'tron' &&
    isBase58(address) &&
    address.length >= 32 &&
    address.length <= 44 &&
    !address.startsWith('T')
  )
    return 'svm'
  return undefined
}

// ============================================================
// Public API
// ============================================================

type ValidatorFamily = ChainFamily | 'cosmos'

const VALIDATORS: Record<ValidatorFamily, (address: string) => AddressValidationResult> = {
  evm: validateEvm,
  ton: validateTon,
  tron: validateTron,
  svm: validateSvm,
  btc: validateBtc,
  spark: validateBtc, // Spark uses Bitcoin addresses
  cosmos: validateCosmos,
}

/**
 * Validate a payment address for a given chain family.
 *
 * Supports EVM, TON, TRON, Solana (SVM), Bitcoin (BTC/Spark), and Cosmos.
 * Returns validation result with optional normalization and cross-chain mismatch detection.
 *
 * @param address - The address to validate
 * @param family - The target chain family
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const result = validatePaymentAddress('0x1234...', 'evm');
 * if (result.valid) {
 *   console.log('Normalized:', result.normalized);
 * } else {
 *   console.error(result.error);
 *   if (result.detectedFamily) {
 *     console.error(`Did you mean to use ${result.detectedFamily}?`);
 *   }
 * }
 * ```
 */
export function validatePaymentAddress(
  address: string,
  family: ChainFamily | 'cosmos',
): AddressValidationResult {
  if (!address || typeof address !== 'string') {
    return { valid: false, error: 'Address is required' }
  }

  const trimmed = address.trim()
  if (trimmed.length === 0) {
    return { valid: false, error: 'Address is required' }
  }

  const validator = VALIDATORS[family]
  if (!validator) {
    return { valid: false, error: `Unsupported chain family: ${family}` }
  }

  return validator(trimmed)
}
