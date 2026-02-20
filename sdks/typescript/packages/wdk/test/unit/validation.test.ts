import { describe, it, expect } from 'vitest'
import { validatePaymentAddress } from '../../src/validation'
import type { AddressValidationResult } from '../../src/validation'

describe('validatePaymentAddress', () => {
  // ============================================================
  // Empty / Invalid Input
  // ============================================================

  describe('empty and invalid inputs', () => {
    it('should reject empty string', () => {
      const result = validatePaymentAddress('', 'evm')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Address is required')
    })

    it('should reject null', () => {
      const result = validatePaymentAddress(null as unknown as string, 'evm')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Address is required')
    })

    it('should reject undefined', () => {
      const result = validatePaymentAddress(undefined as unknown as string, 'evm')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Address is required')
    })

    it('should reject whitespace-only string', () => {
      const result = validatePaymentAddress('   ', 'evm')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Address is required')
    })

    it('should reject unsupported chain family', () => {
      const result = validatePaymentAddress('0x1234', 'polkadot' as any)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Unsupported chain family')
    })
  })

  // ============================================================
  // EVM Validation
  // ============================================================

  describe('EVM addresses', () => {
    it('should accept valid EVM address (lowercase)', () => {
      const result = validatePaymentAddress('0x1234567890abcdef1234567890abcdef12345678', 'evm')
      expect(result.valid).toBe(true)
      expect(result.normalized).toBe('0x1234567890abcdef1234567890abcdef12345678')
    })

    it('should accept valid EVM address (mixed case)', () => {
      const result = validatePaymentAddress('0xABCDEF1234567890abcdef1234567890ABCDEF12', 'evm')
      expect(result.valid).toBe(true)
      expect(result.normalized).toBe('0xabcdef1234567890abcdef1234567890abcdef12')
    })

    it('should reject EVM address without 0x prefix', () => {
      const result = validatePaymentAddress('1234567890abcdef1234567890abcdef12345678', 'evm')
      expect(result.valid).toBe(false)
    })

    it('should reject too short EVM address', () => {
      const result = validatePaymentAddress('0x12345678', 'evm')
      expect(result.valid).toBe(false)
    })

    it('should reject EVM address with non-hex characters', () => {
      const result = validatePaymentAddress('0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG', 'evm')
      expect(result.valid).toBe(false)
    })

    it('should detect TRON address used as EVM', () => {
      const result = validatePaymentAddress('TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5', 'evm')
      expect(result.valid).toBe(false)
      expect(result.detectedFamily).toBe('tron')
    })
  })

  // ============================================================
  // TON Validation
  // ============================================================

  describe('TON addresses', () => {
    it('should accept valid raw format address', () => {
      const result = validatePaymentAddress(
        '0:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        'ton',
      )
      expect(result.valid).toBe(true)
      expect(result.normalized).toBeDefined()
    })

    it('should accept valid user-friendly format (48 chars)', () => {
      const result = validatePaymentAddress(
        'EQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkEUe',
        'ton',
      )
      // 48-char base64url
      expect(result.valid).toBe(true)
    })

    it('should accept valid user-friendly format (shorter variants)', () => {
      const result = validatePaymentAddress('EQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDG', 'ton')
      // Some libraries produce 44-46 char addresses
      expect(result.valid).toBe(true)
    })

    it('should reject invalid TON address', () => {
      const result = validatePaymentAddress('invalid-ton-address', 'ton')
      expect(result.valid).toBe(false)
    })

    it('should detect EVM address used as TON', () => {
      const result = validatePaymentAddress('0x1234567890abcdef1234567890abcdef12345678', 'ton')
      expect(result.valid).toBe(false)
      expect(result.detectedFamily).toBe('evm')
    })
  })

  // ============================================================
  // TRON Validation
  // ============================================================

  describe('TRON addresses', () => {
    it('should accept valid TRON address', () => {
      const result = validatePaymentAddress('TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5', 'tron')
      expect(result.valid).toBe(true)
      expect(result.normalized).toBe('TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5')
    })

    it('should reject TRON address not starting with T', () => {
      const result = validatePaymentAddress('AT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5', 'tron')
      expect(result.valid).toBe(false)
    })

    it('should reject TRON address with wrong length', () => {
      const result = validatePaymentAddress('TT1MqNNj2k5qdGA6nrr', 'tron')
      expect(result.valid).toBe(false)
    })

    it('should detect EVM address used as TRON', () => {
      const result = validatePaymentAddress('0x1234567890abcdef1234567890abcdef12345678', 'tron')
      expect(result.valid).toBe(false)
      expect(result.detectedFamily).toBe('evm')
    })
  })

  // ============================================================
  // Solana (SVM) Validation
  // ============================================================

  describe('Solana addresses', () => {
    it('should accept valid Solana address', () => {
      const result = validatePaymentAddress('8GGtWHRQ1wz5gDKE2KXZLktqzcfV1CBqSbeUZjA7hoWL', 'svm')
      expect(result.valid).toBe(true)
      expect(result.normalized).toBe('8GGtWHRQ1wz5gDKE2KXZLktqzcfV1CBqSbeUZjA7hoWL')
    })

    it('should accept short Solana address (32 chars)', () => {
      const result = validatePaymentAddress('11111111111111111111111111111111', 'svm')
      // System program address
      expect(result.valid).toBe(true)
    })

    it('should reject too short address', () => {
      const result = validatePaymentAddress('shortaddr', 'svm')
      expect(result.valid).toBe(false)
    })

    it('should reject address with invalid base58 chars', () => {
      const result = validatePaymentAddress('0OIl' + '1'.repeat(40), 'svm')
      // 0, O, I, l are not in base58
      expect(result.valid).toBe(false)
    })

    it('should detect EVM address used as Solana', () => {
      const result = validatePaymentAddress('0x1234567890abcdef1234567890abcdef12345678', 'svm')
      expect(result.valid).toBe(false)
      expect(result.detectedFamily).toBe('evm')
    })
  })

  // ============================================================
  // Bitcoin (BTC) Validation
  // ============================================================

  describe('Bitcoin addresses', () => {
    it('should accept valid bech32 address', () => {
      const result = validatePaymentAddress('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', 'btc')
      expect(result.valid).toBe(true)
      expect(result.normalized).toBe('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')
    })

    it('should accept valid P2PKH address (starts with 1)', () => {
      const result = validatePaymentAddress('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2', 'btc')
      expect(result.valid).toBe(true)
    })

    it('should accept valid P2SH address (starts with 3)', () => {
      const result = validatePaymentAddress('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy', 'btc')
      expect(result.valid).toBe(true)
    })

    it('should reject invalid Bitcoin address', () => {
      const result = validatePaymentAddress('notabitcoinaddress', 'btc')
      expect(result.valid).toBe(false)
    })

    it('should detect EVM address used as BTC', () => {
      const result = validatePaymentAddress('0x1234567890abcdef1234567890abcdef12345678', 'btc')
      expect(result.valid).toBe(false)
      expect(result.detectedFamily).toBe('evm')
    })
  })

  // ============================================================
  // Cosmos Validation
  // ============================================================

  describe('Cosmos addresses', () => {
    it('should accept valid cosmos address', () => {
      const result = validatePaymentAddress(
        'cosmos1qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5lzv7xu',
        'cosmos' as any,
      )
      expect(result.valid).toBe(true)
    })

    it('should accept valid osmosis address', () => {
      const result = validatePaymentAddress(
        'osmo1qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5hndkeh',
        'cosmos' as any,
      )
      expect(result.valid).toBe(true)
    })

    it('should reject address with uppercase prefix', () => {
      const result = validatePaymentAddress(
        'COSMOS1qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5lzv7xu',
        'cosmos' as any,
      )
      expect(result.valid).toBe(false)
    })
  })

  // ============================================================
  // Spark (delegates to BTC)
  // ============================================================

  describe('Spark addresses', () => {
    it('should accept valid bech32 address for spark', () => {
      const result = validatePaymentAddress('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', 'spark')
      expect(result.valid).toBe(true)
    })
  })

  // ============================================================
  // Cross-chain Mismatch Detection
  // ============================================================

  describe('cross-chain mismatch detection', () => {
    it('should detect TRON address when validating as SVM', () => {
      const result = validatePaymentAddress('TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5', 'svm')
      expect(result.valid).toBe(false)
      // TRON starts with T and is 34 chars, which is in 32-44 range
      // but the tron regex should catch it
      expect(result.detectedFamily).toBe('tron')
    })

    it('should detect BTC bech32 address when validating as EVM', () => {
      const result = validatePaymentAddress('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', 'evm')
      expect(result.valid).toBe(false)
      expect(result.detectedFamily).toBe('btc')
    })
  })

  // ============================================================
  // Trimming
  // ============================================================

  describe('whitespace trimming', () => {
    it('should trim leading and trailing whitespace', () => {
      const result = validatePaymentAddress('  0x1234567890abcdef1234567890abcdef12345678  ', 'evm')
      expect(result.valid).toBe(true)
    })
  })
})
