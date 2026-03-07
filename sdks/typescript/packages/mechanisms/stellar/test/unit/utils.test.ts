import { describe, it, expect } from 'vitest'
import {
  normalizeNetwork,
  getHorizonEndpoint,
  getSorobanEndpoint,
  isStellarNetwork,
  validateGAddress,
  validateCAddress,
  validateStellarAddress,
  convertToTokenAmount,
  convertFromTokenAmount,
  calculateMaxLedger,
} from '../../src/utils'
import {
  STELLAR_PUBNET_CAIP2,
  STELLAR_TESTNET_CAIP2,
  LEDGER_TIME_SECONDS,
} from '../../src/constants'

describe('Stellar Utils', () => {
  describe('normalizeNetwork', () => {
    it('should pass through valid CAIP-2 identifiers', () => {
      expect(normalizeNetwork('stellar:pubnet')).toBe(STELLAR_PUBNET_CAIP2)
      expect(normalizeNetwork('stellar:testnet')).toBe(STELLAR_TESTNET_CAIP2)
    })

    it('should convert legacy identifiers', () => {
      expect(normalizeNetwork('stellar')).toBe(STELLAR_PUBNET_CAIP2)
      expect(normalizeNetwork('pubnet')).toBe(STELLAR_PUBNET_CAIP2)
      expect(normalizeNetwork('mainnet')).toBe(STELLAR_PUBNET_CAIP2)
      expect(normalizeNetwork('testnet')).toBe(STELLAR_TESTNET_CAIP2)
    })

    it('should be case-insensitive for legacy identifiers', () => {
      expect(normalizeNetwork('STELLAR')).toBe(STELLAR_PUBNET_CAIP2)
      expect(normalizeNetwork('Testnet')).toBe(STELLAR_TESTNET_CAIP2)
    })

    it('should throw for unsupported networks', () => {
      expect(() => normalizeNetwork('stellar:unknown')).toThrow('Unsupported Stellar network')
      expect(() => normalizeNetwork('unknown')).toThrow('Unsupported Stellar network')
    })
  })

  describe('getHorizonEndpoint', () => {
    it('should return Horizon endpoint for pubnet', () => {
      const endpoint = getHorizonEndpoint('stellar:pubnet')
      expect(endpoint).toMatch(/^https:\/\//)
      expect(endpoint).toContain('horizon')
    })

    it('should return Horizon endpoint for testnet', () => {
      const endpoint = getHorizonEndpoint('stellar:testnet')
      expect(endpoint).toMatch(/^https:\/\//)
      expect(endpoint).toContain('horizon')
    })
  })

  describe('getSorobanEndpoint', () => {
    it('should return Soroban endpoint for pubnet', () => {
      const endpoint = getSorobanEndpoint('stellar:pubnet')
      expect(endpoint).toMatch(/^https:\/\//)
      expect(endpoint).toContain('soroban')
    })

    it('should return Soroban endpoint for testnet', () => {
      const endpoint = getSorobanEndpoint('stellar:testnet')
      expect(endpoint).toMatch(/^https:\/\//)
      expect(endpoint).toContain('soroban')
    })
  })

  describe('isStellarNetwork', () => {
    it('should return true for supported networks', () => {
      expect(isStellarNetwork('stellar:pubnet')).toBe(true)
      expect(isStellarNetwork('stellar:testnet')).toBe(true)
      expect(isStellarNetwork('stellar')).toBe(true)
    })

    it('should return false for unsupported networks', () => {
      expect(isStellarNetwork('eip155:1')).toBe(false)
      expect(isStellarNetwork('ton:mainnet')).toBe(false)
      expect(isStellarNetwork('unknown')).toBe(false)
    })
  })

  describe('validateGAddress', () => {
    it('should validate correct G-account addresses', () => {
      expect(
        validateGAddress('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7'),
      ).toBe(true)
    })

    it('should reject invalid G-account addresses', () => {
      expect(validateGAddress('invalid')).toBe(false)
      expect(validateGAddress('')).toBe(false)
      expect(
        validateGAddress('CAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7'),
      ).toBe(false) // C-account
    })
  })

  describe('validateCAddress', () => {
    it('should validate correct C-account addresses', () => {
      // 56-char StrKey format
      expect(
        validateCAddress('CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'),
      ).toBe(true)
      // Contract addresses from token registry
      expect(
        validateCAddress('CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI'),
      ).toBe(true)
    })

    it('should reject invalid C-account addresses', () => {
      expect(validateCAddress('invalid')).toBe(false)
      expect(validateCAddress('')).toBe(false)
      expect(
        validateCAddress('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7'),
      ).toBe(false) // G-account
    })
  })

  describe('validateStellarAddress', () => {
    it('should accept both G-account and C-account addresses', () => {
      expect(
        validateStellarAddress('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7'),
      ).toBe(true)
      expect(
        validateStellarAddress('CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'),
      ).toBe(true)
    })

    it('should reject invalid addresses', () => {
      expect(validateStellarAddress('invalid')).toBe(false)
    })
  })

  describe('convertToTokenAmount', () => {
    it('should convert decimal amounts to token units (7 decimals)', () => {
      expect(convertToTokenAmount('1.0')).toBe('10000000')
      expect(convertToTokenAmount('1.50')).toBe('15000000')
      expect(convertToTokenAmount('0.10')).toBe('1000000')
    })

    it('should handle whole numbers', () => {
      expect(convertToTokenAmount('10')).toBe('100000000')
      expect(convertToTokenAmount('100')).toBe('1000000000')
    })

    it('should support custom decimals', () => {
      expect(convertToTokenAmount('1.0', 6)).toBe('1000000')
      expect(convertToTokenAmount('1.50', 6)).toBe('1500000')
    })

    it('should throw for invalid amounts', () => {
      expect(() => convertToTokenAmount('invalid')).toThrow('Invalid amount')
    })
  })

  describe('convertFromTokenAmount', () => {
    it('should convert token units to decimal amounts (7 decimals)', () => {
      expect(convertFromTokenAmount('10000000')).toBe('1')
      expect(convertFromTokenAmount('15000000')).toBe('1.5')
      expect(convertFromTokenAmount('1000000')).toBe('0.1')
    })

    it('should handle bigint input', () => {
      expect(convertFromTokenAmount(10000000n)).toBe('1')
    })

    it('should support custom decimals', () => {
      expect(convertFromTokenAmount('1000000', 6)).toBe('1')
    })
  })

  describe('calculateMaxLedger', () => {
    it('should calculate max ledger from timeout', () => {
      const currentLedger = 100000
      const result = calculateMaxLedger(currentLedger, 60) // 60 seconds
      expect(result).toBe(currentLedger + Math.ceil(60 / LEDGER_TIME_SECONDS))
    })

    it('should use ceiling division', () => {
      const currentLedger = 100000
      // 7 seconds / 5 seconds per ledger = 1.4 -> ceil = 2
      expect(calculateMaxLedger(currentLedger, 7)).toBe(currentLedger + 2)
    })

    it('should handle exact multiples', () => {
      const currentLedger = 100000
      // 10 seconds / 5 seconds per ledger = 2 exactly
      expect(calculateMaxLedger(currentLedger, 10)).toBe(currentLedger + 2)
    })
  })
})
