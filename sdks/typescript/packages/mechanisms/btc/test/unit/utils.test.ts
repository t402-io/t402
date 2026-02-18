import { describe, it, expect } from 'vitest'
import {
  satoshisToBtc,
  btcToSatoshis,
  validateBitcoinAddress,
  isMainnetAddress,
  isTestnetAddress,
  validateBolt11Invoice,
  isValidHex,
} from '../../src/utils'

describe('satoshisToBtc', () => {
  it('should convert whole satoshi amounts', () => {
    expect(satoshisToBtc(100000000n)).toBe('1')
    expect(satoshisToBtc(0n)).toBe('0')
    expect(satoshisToBtc(200000000n)).toBe('2')
  })

  it('should convert fractional amounts', () => {
    expect(satoshisToBtc(50000000n)).toBe('0.5')
    expect(satoshisToBtc(1n)).toBe('0.00000001')
    expect(satoshisToBtc(12345678n)).toBe('0.12345678')
  })

  it('should accept number and string inputs', () => {
    expect(satoshisToBtc(100000000)).toBe('1')
    expect(satoshisToBtc('100000000')).toBe('1')
  })
})

describe('btcToSatoshis', () => {
  it('should convert whole BTC amounts', () => {
    expect(btcToSatoshis('1')).toBe(100000000n)
    expect(btcToSatoshis('0')).toBe(0n)
    expect(btcToSatoshis('2')).toBe(200000000n)
  })

  it('should convert fractional BTC amounts', () => {
    expect(btcToSatoshis('0.5')).toBe(50000000n)
    expect(btcToSatoshis('0.00000001')).toBe(1n)
    expect(btcToSatoshis('0.12345678')).toBe(12345678n)
  })

  it('should accept number input', () => {
    expect(btcToSatoshis(1)).toBe(100000000n)
    expect(btcToSatoshis(0.5)).toBe(50000000n)
  })
})

describe('validateBitcoinAddress', () => {
  it('should accept valid mainnet addresses', () => {
    expect(validateBitcoinAddress('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')).toBe(true)
    expect(validateBitcoinAddress('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2')).toBe(true)
    expect(validateBitcoinAddress('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy')).toBe(true)
  })

  it('should accept valid testnet addresses', () => {
    expect(validateBitcoinAddress('tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx')).toBe(true)
    expect(validateBitcoinAddress('mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn')).toBe(true)
    expect(validateBitcoinAddress('2MzQwSSnBHWHqSAqtTVQ6v47XtaisrJa1Vc')).toBe(true)
    expect(validateBitcoinAddress('n3GNqMveyvaPvUbH469vDRadqpJMPc84JA')).toBe(true)
  })

  it('should reject invalid addresses', () => {
    expect(validateBitcoinAddress('')).toBe(false)
    expect(validateBitcoinAddress('invalid')).toBe(false)
    expect(validateBitcoinAddress('0x1234567890abcdef')).toBe(false)
    expect(validateBitcoinAddress('short')).toBe(false)
  })
})

describe('isMainnetAddress', () => {
  it('should identify mainnet addresses', () => {
    expect(isMainnetAddress('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')).toBe(true)
    expect(isMainnetAddress('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2')).toBe(true)
    expect(isMainnetAddress('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy')).toBe(true)
  })

  it('should reject testnet addresses', () => {
    expect(isMainnetAddress('tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx')).toBe(false)
    expect(isMainnetAddress('mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn')).toBe(false)
  })
})

describe('isTestnetAddress', () => {
  it('should identify testnet addresses', () => {
    expect(isTestnetAddress('tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx')).toBe(true)
    expect(isTestnetAddress('mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn')).toBe(true)
    expect(isTestnetAddress('2MzQwSSnBHWHqSAqtTVQ6v47XtaisrJa1Vc')).toBe(true)
    expect(isTestnetAddress('n3GNqMveyvaPvUbH469vDRadqpJMPc84JA')).toBe(true)
  })

  it('should reject mainnet addresses', () => {
    expect(isTestnetAddress('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')).toBe(false)
    expect(isTestnetAddress('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2')).toBe(false)
  })
})

describe('validateBolt11Invoice', () => {
  it('should accept valid mainnet invoices', () => {
    expect(validateBolt11Invoice('lnbc1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctn')).toBe(true)
  })

  it('should accept valid testnet invoices', () => {
    expect(validateBolt11Invoice('lntb1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqd')).toBe(true)
  })

  it('should accept regtest invoices', () => {
    expect(validateBolt11Invoice('lnbcrt1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqyp')).toBe(true)
  })

  it('should reject invalid invoices', () => {
    expect(validateBolt11Invoice('')).toBe(false)
    expect(validateBolt11Invoice('invalid')).toBe(false)
    expect(validateBolt11Invoice('short')).toBe(false)
  })
})

describe('isValidHex', () => {
  it('should validate hex strings', () => {
    expect(isValidHex('abcdef0123456789')).toBe(true)
    expect(isValidHex('ABCDEF0123456789')).toBe(true)
  })

  it('should validate hex with expected length', () => {
    expect(isValidHex('abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789', 32)).toBe(true)
    expect(isValidHex('abcdef', 3)).toBe(true)
    expect(isValidHex('abcdef', 4)).toBe(false)
  })

  it('should reject invalid hex', () => {
    expect(isValidHex('xyz')).toBe(false)
    expect(isValidHex('0xabcdef')).toBe(false)
    expect(isValidHex('')).toBe(false)
  })
})
