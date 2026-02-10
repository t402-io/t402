/**
 * WDK Multi-sig Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import type { Address, Hex } from 'viem'
import {
  combineSignatures,
  formatSignatureForSafe,
  generateRequestId,
  isValidThreshold,
  sortAddresses,
  getOwnerIndex,
  areAddressesUnique,
} from './utils.js'
import { SignatureCollector } from './collector.js'
import { MultiSigError, MultiSigErrorCode } from './errors.js'
import { SAFE_4337_ADDRESSES, SIGNATURE_TYPES, DEFAULTS } from './constants.js'

describe('Constants', () => {
  describe('SAFE_4337_ADDRESSES', () => {
    it('should have all required addresses', () => {
      expect(SAFE_4337_ADDRESSES.module).toBeDefined()
      expect(SAFE_4337_ADDRESSES.moduleSetup).toBeDefined()
      expect(SAFE_4337_ADDRESSES.singleton).toBeDefined()
      expect(SAFE_4337_ADDRESSES.proxyFactory).toBeDefined()
      expect(SAFE_4337_ADDRESSES.fallbackHandler).toBeDefined()
      expect(SAFE_4337_ADDRESSES.addModulesLib).toBeDefined()
    })

    it('should have valid addresses', () => {
      Object.values(SAFE_4337_ADDRESSES).forEach((address) => {
        expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/)
      })
    })
  })

  describe('SIGNATURE_TYPES', () => {
    it('should have correct signature types', () => {
      expect(SIGNATURE_TYPES.EOA).toBe('0x00')
      expect(SIGNATURE_TYPES.CONTRACT).toBe('0x01')
      expect(SIGNATURE_TYPES.APPROVED_HASH).toBe('0x04')
    })
  })

  describe('DEFAULTS', () => {
    it('should have correct default values', () => {
      expect(DEFAULTS.REQUEST_EXPIRATION_MS).toBe(60 * 60 * 1000)
      expect(DEFAULTS.SALT_NONCE).toBe(0n)
      expect(DEFAULTS.MAX_OWNERS).toBe(10)
      expect(DEFAULTS.MIN_THRESHOLD).toBe(1)
    })
  })
})

describe('Utils', () => {
  describe('isValidThreshold', () => {
    it('should return true for valid thresholds', () => {
      expect(isValidThreshold(1, 1)).toBe(true)
      expect(isValidThreshold(1, 3)).toBe(true)
      expect(isValidThreshold(2, 3)).toBe(true)
      expect(isValidThreshold(3, 3)).toBe(true)
    })

    it('should return false for invalid thresholds', () => {
      expect(isValidThreshold(0, 3)).toBe(false)
      expect(isValidThreshold(4, 3)).toBe(false)
      expect(isValidThreshold(-1, 3)).toBe(false)
    })

    it('should return false when threshold is zero regardless of owner count', () => {
      expect(isValidThreshold(0, 0)).toBe(false)
      expect(isValidThreshold(0, 1)).toBe(false)
      expect(isValidThreshold(0, 10)).toBe(false)
    })

    it('should return true for 1-of-1 (minimum valid config)', () => {
      expect(isValidThreshold(1, 1)).toBe(true)
    })

    it('should return true for N-of-N (all must sign)', () => {
      expect(isValidThreshold(5, 5)).toBe(true)
      expect(isValidThreshold(10, 10)).toBe(true)
    })
  })

  describe('sortAddresses', () => {
    it('should sort addresses in ascending order', () => {
      const addresses: Address[] = [
        '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
        '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
      ]

      const sorted = sortAddresses(addresses)

      expect(sorted[0]).toBe('0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')
      expect(sorted[1]).toBe('0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB')
      expect(sorted[2]).toBe('0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC')
    })

    it('should not modify original array', () => {
      const addresses: Address[] = [
        '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
        '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      ]

      const sorted = sortAddresses(addresses)

      expect(addresses[0]).toBe('0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB')
      expect(sorted[0]).toBe('0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')
    })

    it('should produce deterministic ordering using BigInt comparison', () => {
      // Use realistic addresses where lexicographic vs numeric order could differ
      const addresses: Address[] = [
        '0x00000000000000000000000000000000000000FF',
        '0x0000000000000000000000000000000000000001',
        '0x000000000000000000000000000000000000000A',
      ]

      const sorted = sortAddresses(addresses)

      // Numerically: 0x01 < 0x0A < 0xFF
      expect(sorted[0]).toBe('0x0000000000000000000000000000000000000001')
      expect(sorted[1]).toBe('0x000000000000000000000000000000000000000A')
      expect(sorted[2]).toBe('0x00000000000000000000000000000000000000FF')
    })

    it('should handle single address', () => {
      const addresses: Address[] = ['0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA']
      const sorted = sortAddresses(addresses)
      expect(sorted).toHaveLength(1)
      expect(sorted[0]).toBe('0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')
    })

    it('should handle empty array', () => {
      const addresses: Address[] = []
      const sorted = sortAddresses(addresses)
      expect(sorted).toHaveLength(0)
    })

    it('should sort 5 addresses correctly', () => {
      const addresses: Address[] = [
        '0xEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE',
        '0x1111111111111111111111111111111111111111',
        '0xDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
        '0x2222222222222222222222222222222222222222',
        '0x9999999999999999999999999999999999999999',
      ]

      const sorted = sortAddresses(addresses)

      expect(sorted[0]).toBe('0x1111111111111111111111111111111111111111')
      expect(sorted[1]).toBe('0x2222222222222222222222222222222222222222')
      expect(sorted[2]).toBe('0x9999999999999999999999999999999999999999')
      expect(sorted[3]).toBe('0xDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD')
      expect(sorted[4]).toBe('0xEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE')
    })
  })

  describe('areAddressesUnique', () => {
    it('should return true for unique addresses', () => {
      const addresses: Address[] = [
        '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
        '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
      ]

      expect(areAddressesUnique(addresses)).toBe(true)
    })

    it('should return false for duplicate addresses', () => {
      const addresses: Address[] = [
        '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
        '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      ]

      expect(areAddressesUnique(addresses)).toBe(false)
    })

    it('should be case insensitive', () => {
      const addresses: Address[] = [
        '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      ]

      expect(areAddressesUnique(addresses)).toBe(false)
    })

    it('should return true for single address', () => {
      const addresses: Address[] = ['0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA']
      expect(areAddressesUnique(addresses)).toBe(true)
    })

    it('should return true for empty array', () => {
      expect(areAddressesUnique([])).toBe(true)
    })

    it('should detect duplicates with mixed case', () => {
      const addresses: Address[] = [
        '0xAaBbCcDdEeFf00112233445566778899AaBbCcDd',
        '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
        '0xaabbccddeeff00112233445566778899aabbccdd',
      ]
      expect(areAddressesUnique(addresses)).toBe(false)
    })
  })

  describe('getOwnerIndex', () => {
    const owners: Address[] = [
      '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
      '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
    ]

    it('should return correct index for existing owner', () => {
      expect(getOwnerIndex('0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', owners)).toBe(0)
      expect(getOwnerIndex('0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', owners)).toBe(1)
      expect(getOwnerIndex('0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC', owners)).toBe(2)
    })

    it('should return -1 for non-existing owner', () => {
      expect(getOwnerIndex('0xDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD', owners)).toBe(-1)
    })

    it('should be case insensitive', () => {
      expect(getOwnerIndex('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', owners)).toBe(0)
    })
  })

  describe('generateRequestId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateRequestId()
      const id2 = generateRequestId()

      expect(id1).not.toBe(id2)
    })

    it('should start with msig_ prefix', () => {
      const id = generateRequestId()
      expect(id.startsWith('msig_')).toBe(true)
    })

    it('should generate many unique IDs without collisions', () => {
      const ids = new Set<string>()
      for (let i = 0; i < 100; i++) {
        ids.add(generateRequestId())
      }
      expect(ids.size).toBe(100)
    })
  })

  describe('formatSignatureForSafe', () => {
    it('should append EOA signature type by default', () => {
      const sig = '0x1234567890' as Hex
      const formatted = formatSignatureForSafe(sig)

      expect(formatted).toBe('0x123456789000')
    })

    it('should append CONTRACT signature type when specified', () => {
      const sig = '0x1234567890' as Hex
      const formatted = formatSignatureForSafe(sig, 'CONTRACT')

      expect(formatted).toBe('0x123456789001')
    })

    it('should append APPROVED_HASH signature type when specified', () => {
      const sig = '0x1234567890' as Hex
      const formatted = formatSignatureForSafe(sig, 'APPROVED_HASH')

      expect(formatted).toBe('0x123456789004')
    })

    it('should work with a full 65-byte ECDSA signature', () => {
      // 65 bytes = 130 hex chars after 0x
      const sig =
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Hex
      const formatted = formatSignatureForSafe(sig)

      // Should end with '00' (EOA type byte)
      expect(formatted.endsWith('00')).toBe(true)
      expect(formatted.startsWith('0x')).toBe(true)
    })
  })

  describe('combineSignatures', () => {
    it('should combine signatures sorted by owner address', () => {
      const owners: Address[] = [
        '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
        '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
      ]

      const signatures = new Map<number, Hex>([
        [2, '0x3333' as Hex], // C
        [0, '0x1111' as Hex], // A
        [1, '0x2222' as Hex], // B
      ])

      const combined = combineSignatures(signatures, owners)

      // Should be sorted by address: A, B, C
      expect(combined).toBe('0x111122223333')
    })

    it('should return empty hex for no signatures', () => {
      const owners: Address[] = []
      const signatures = new Map<number, Hex>()

      const combined = combineSignatures(signatures, owners)

      expect(combined).toBe('0x')
    })

    it('should combine 2 signatures correctly', () => {
      const owners: Address[] = [
        '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
      ]

      const signatures = new Map<number, Hex>([
        [1, '0xbbbb' as Hex],
        [0, '0xaaaa' as Hex],
      ])

      const combined = combineSignatures(signatures, owners)
      expect(combined).toBe('0xaaaabbbb')
    })

    it('should combine 5 signatures in correct address order', () => {
      const owners: Address[] = [
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222',
        '0x3333333333333333333333333333333333333333',
        '0x4444444444444444444444444444444444444444',
        '0x5555555555555555555555555555555555555555',
      ]

      const signatures = new Map<number, Hex>([
        [4, '0x55' as Hex],
        [2, '0x33' as Hex],
        [0, '0x11' as Hex],
        [3, '0x44' as Hex],
        [1, '0x22' as Hex],
      ])

      const combined = combineSignatures(signatures, owners)
      expect(combined).toBe('0x1122334455')
    })

    it('should handle partial signature set (subset of owners)', () => {
      const owners: Address[] = [
        '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
        '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
      ]

      // Only 2 of 3 owners signed
      const signatures = new Map<number, Hex>([
        [2, '0xcc' as Hex],
        [0, '0xaa' as Hex],
      ])

      const combined = combineSignatures(signatures, owners)
      expect(combined).toBe('0xaacc')
    })

    it('should handle owners in reverse order and still sort correctly', () => {
      const owners: Address[] = [
        '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
        '0x0000000000000000000000000000000000000001',
      ]

      const signatures = new Map<number, Hex>([
        [0, '0xff' as Hex],
        [1, '0x01' as Hex],
      ])

      const combined = combineSignatures(signatures, owners)
      // 0x01 < 0xFF numerically, so 0x01's signature comes first
      expect(combined).toBe('0x01ff')
    })
  })
})

describe('SignatureCollector', () => {
  const owners: Address[] = [
    '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
    '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
  ]

  const mockUserOp = {
    sender: '0x1234567890123456789012345678901234567890' as Address,
    nonce: 0n,
    callData: '0x' as Hex,
    callGasLimit: 100000n,
    verificationGasLimit: 100000n,
    preVerificationGas: 50000n,
    maxFeePerGas: 1000000000n,
    maxPriorityFeePerGas: 1000000000n,
    signature: '0x' as Hex,
  }

  const mockUserOpHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as Hex

  let collector: SignatureCollector

  beforeEach(() => {
    collector = new SignatureCollector()
  })

  describe('createRequest', () => {
    it('should create a new request', () => {
      const request = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2)

      expect(request.id).toBeDefined()
      expect(request.userOp).toBe(mockUserOp)
      expect(request.userOpHash).toBe(mockUserOpHash)
      expect(request.threshold).toBe(2)
      expect(request.collectedCount).toBe(0)
      expect(request.isReady).toBe(false)
      expect(request.signatures.length).toBe(3)
    })

    it('should initialize all signatures as unsigned', () => {
      const request = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2)

      request.signatures.forEach((sig, index) => {
        expect(sig.owner).toBe(owners[index])
        expect(sig.ownerIndex).toBe(index)
        expect(sig.signed).toBe(false)
        expect(sig.signature).toBeUndefined()
      })
    })

    it('should set createdAt and expiresAt timestamps', () => {
      const before = Date.now()
      const request = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2)
      const after = Date.now()

      expect(request.createdAt).toBeGreaterThanOrEqual(before)
      expect(request.createdAt).toBeLessThanOrEqual(after)
      expect(request.expiresAt).toBe(request.createdAt + DEFAULTS.REQUEST_EXPIRATION_MS)
    })

    it('should use custom expiration from constructor', () => {
      const customExpiration = 5000
      const customCollector = new SignatureCollector({ expirationMs: customExpiration })
      const request = customCollector.createRequest(mockUserOp, mockUserOpHash, owners, 2)

      expect(request.expiresAt).toBe(request.createdAt + customExpiration)
    })

    // ----------------------------------------------------------------
    // createRequest input validation
    // ----------------------------------------------------------------
    it('should throw for empty owners array', () => {
      expect(() => collector.createRequest(mockUserOp, mockUserOpHash, [], 1)).toThrow()
    })

    it('should throw INSUFFICIENT_SIGNERS for empty owners', () => {
      try {
        collector.createRequest(mockUserOp, mockUserOpHash, [], 1)
        expect.fail('Should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(MultiSigError)
        expect((e as MultiSigError).code).toBe(MultiSigErrorCode.INSUFFICIENT_SIGNERS)
      }
    })

    it('should throw for threshold of 0', () => {
      expect(() => collector.createRequest(mockUserOp, mockUserOpHash, owners, 0)).toThrow()
    })

    it('should throw INVALID_THRESHOLD for threshold of 0', () => {
      try {
        collector.createRequest(mockUserOp, mockUserOpHash, owners, 0)
        expect.fail('Should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(MultiSigError)
        expect((e as MultiSigError).code).toBe(MultiSigErrorCode.INVALID_THRESHOLD)
      }
    })

    it('should throw for threshold greater than owners count', () => {
      expect(() => collector.createRequest(mockUserOp, mockUserOpHash, owners, 5)).toThrow()
    })

    it('should throw INVALID_THRESHOLD for threshold > owners', () => {
      try {
        collector.createRequest(mockUserOp, mockUserOpHash, owners, 5)
        expect.fail('Should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(MultiSigError)
        expect((e as MultiSigError).code).toBe(MultiSigErrorCode.INVALID_THRESHOLD)
      }
    })

    it('should throw for invalid userOpHash (no 0x prefix)', () => {
      expect(() => collector.createRequest(mockUserOp, 'abcdef1234' as Hex, owners, 2)).toThrow(
        /Invalid userOpHash/,
      )
    })

    it('should throw for empty userOpHash', () => {
      expect(() => collector.createRequest(mockUserOp, '' as Hex, owners, 2)).toThrow(
        /Invalid userOpHash/,
      )
    })
  })

  describe('addSignature', () => {
    it('should add a signature', () => {
      const request = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2)
      const signature = '0x1111' as Hex

      const updated = collector.addSignature(request.id, owners[0], signature)

      expect(updated.signatures[0].signed).toBe(true)
      expect(updated.signatures[0].signature).toBe(signature)
      expect(updated.collectedCount).toBe(1)
      expect(updated.isReady).toBe(false)
    })

    it('should set isReady when threshold is met', () => {
      const request = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2)

      collector.addSignature(request.id, owners[0], '0x1111' as Hex)
      const updated = collector.addSignature(request.id, owners[1], '0x2222' as Hex)

      expect(updated.collectedCount).toBe(2)
      expect(updated.isReady).toBe(true)
    })

    it('should throw for non-existent request', () => {
      expect(() => collector.addSignature('non-existent', owners[0], '0x1111' as Hex)).toThrow(
        MultiSigError,
      )
    })

    it('should throw for duplicate signature', () => {
      const request = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2)

      collector.addSignature(request.id, owners[0], '0x1111' as Hex)

      expect(() => collector.addSignature(request.id, owners[0], '0x1111' as Hex)).toThrow(
        MultiSigError,
      )
    })

    it('should throw ALREADY_SIGNED error code for duplicate', () => {
      const request = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2)
      collector.addSignature(request.id, owners[0], '0x1111' as Hex)

      try {
        collector.addSignature(request.id, owners[0], '0x2222' as Hex)
        expect.fail('Should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(MultiSigError)
        expect((e as MultiSigError).code).toBe(MultiSigErrorCode.ALREADY_SIGNED)
      }
    })

    it('should throw for non-owner address', () => {
      const request = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2)
      const nonOwner = '0xDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD' as Address

      expect(() => collector.addSignature(request.id, nonOwner, '0x1111' as Hex)).toThrow(
        MultiSigError,
      )
    })

    // ----------------------------------------------------------------
    // addSignature format validation
    // ----------------------------------------------------------------
    it('should throw for empty signature', () => {
      const request = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2)

      expect(() => collector.addSignature(request.id, owners[0], '' as Hex)).toThrow(
        /Invalid signature/,
      )
    })

    it('should throw for signature without 0x prefix', () => {
      const request = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2)

      expect(() => collector.addSignature(request.id, owners[0], '1111' as Hex)).toThrow(
        /Invalid signature/,
      )
    })

    it('should throw for signature that is too short', () => {
      const request = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2)

      expect(() => collector.addSignature(request.id, owners[0], '0x' as Hex)).toThrow(
        /Invalid signature/,
      )
    })

    it('should accept minimal valid signature (0x + 2 chars)', () => {
      const request = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2)

      // 0x + at least 2 hex chars (length >= 4) should be accepted
      const updated = collector.addSignature(request.id, owners[0], '0xab' as Hex)
      expect(updated.signatures[0].signed).toBe(true)
    })

    it('should allow adding all 3 signatures even when threshold is 2', () => {
      const request = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2)

      collector.addSignature(request.id, owners[0], '0x1111' as Hex)
      collector.addSignature(request.id, owners[1], '0x2222' as Hex)
      const updated = collector.addSignature(request.id, owners[2], '0x3333' as Hex)

      expect(updated.collectedCount).toBe(3)
      expect(updated.isReady).toBe(true)
    })

    it('should throw for expired request', () => {
      const shortCollector = new SignatureCollector({ expirationMs: 1 })
      const request = shortCollector.createRequest(mockUserOp, mockUserOpHash, owners, 2)

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(() => shortCollector.addSignature(request.id, owners[0], '0x1111' as Hex)).toThrow(
            MultiSigError,
          )
          resolve()
        }, 10)
      })
    })

    it('should throw REQUEST_EXPIRED error code for expired request', () => {
      const shortCollector = new SignatureCollector({ expirationMs: 1 })
      const request = shortCollector.createRequest(mockUserOp, mockUserOpHash, owners, 2)

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          try {
            shortCollector.addSignature(request.id, owners[0], '0x1111' as Hex)
            expect.fail('Should have thrown')
          } catch (e) {
            expect(e).toBeInstanceOf(MultiSigError)
            expect((e as MultiSigError).code).toBe(MultiSigErrorCode.REQUEST_EXPIRED)
          }
          resolve()
        }, 10)
      })
    })
  })

  describe('full lifecycle: createRequest -> addSignature x N -> isComplete -> getCombinedSignature', () => {
    it('should complete a 2-of-3 lifecycle', () => {
      // Step 1: Create request
      const request = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2)
      expect(request.collectedCount).toBe(0)
      expect(request.isReady).toBe(false)

      // Step 2: Add first signature
      collector.addSignature(request.id, owners[0], '0xaaaa' as Hex)
      expect(collector.isComplete(request.id)).toBe(false)

      // Step 3: Add second signature - threshold met
      collector.addSignature(request.id, owners[1], '0xbbbb' as Hex)
      expect(collector.isComplete(request.id)).toBe(true)

      // Step 4: Get combined signature
      const combined = collector.getCombinedSignature(request.id)
      expect(combined).toBeDefined()
      expect(combined.startsWith('0x')).toBe(true)
      // Should contain both signatures sorted by address
      expect(combined).toBe('0xaaaabbbb')
    })

    it('should complete a 3-of-5 multi-party scenario', () => {
      const fiveOwners: Address[] = [
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222',
        '0x3333333333333333333333333333333333333333',
        '0x4444444444444444444444444444444444444444',
        '0x5555555555555555555555555555555555555555',
      ]

      const request = collector.createRequest(mockUserOp, mockUserOpHash, fiveOwners, 3)
      expect(request.signatures.length).toBe(5)
      expect(request.threshold).toBe(3)

      // Party 1 signs
      collector.addSignature(request.id, fiveOwners[0], '0x11' as Hex)
      expect(collector.isComplete(request.id)).toBe(false)
      expect(collector.getPendingOwners(request.id)).toHaveLength(4)

      // Party 3 signs (skipping party 2)
      collector.addSignature(request.id, fiveOwners[2], '0x33' as Hex)
      expect(collector.isComplete(request.id)).toBe(false)
      expect(collector.getPendingOwners(request.id)).toHaveLength(3)
      expect(collector.getSignedOwners(request.id)).toHaveLength(2)

      // Party 5 signs - threshold met
      collector.addSignature(request.id, fiveOwners[4], '0x55' as Hex)
      expect(collector.isComplete(request.id)).toBe(true)

      const combined = collector.getCombinedSignature(request.id)
      expect(combined).toBeDefined()
      // Signatures should be sorted by address: 0x1111..., 0x3333..., 0x5555...
      expect(combined).toBe('0x113355')
    })

    it('should complete a 1-of-1 lifecycle', () => {
      const singleOwner: Address[] = ['0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA']
      const request = collector.createRequest(mockUserOp, mockUserOpHash, singleOwner, 1)

      expect(collector.isComplete(request.id)).toBe(false)

      collector.addSignature(request.id, singleOwner[0], '0xaa' as Hex)
      expect(collector.isComplete(request.id)).toBe(true)

      const combined = collector.getCombinedSignature(request.id)
      expect(combined).toBe('0xaa')
    })
  })

  describe('isComplete', () => {
    it('should return false when threshold not met', () => {
      const request = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2)
      collector.addSignature(request.id, owners[0], '0x1111' as Hex)

      expect(collector.isComplete(request.id)).toBe(false)
    })

    it('should return true when threshold is met', () => {
      const request = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2)
      collector.addSignature(request.id, owners[0], '0x1111' as Hex)
      collector.addSignature(request.id, owners[1], '0x2222' as Hex)

      expect(collector.isComplete(request.id)).toBe(true)
    })

    it('should throw for non-existent request', () => {
      expect(() => collector.isComplete('non-existent')).toThrow(MultiSigError)
    })
  })

  describe('getCombinedSignature', () => {
    it('should return combined signature when ready', () => {
      const request = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2)
      collector.addSignature(request.id, owners[0], '0x1111' as Hex)
      collector.addSignature(request.id, owners[1], '0x2222' as Hex)

      const combined = collector.getCombinedSignature(request.id)

      expect(combined).toBeDefined()
      expect(combined.startsWith('0x')).toBe(true)
    })

    it('should throw when not ready', () => {
      const request = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2)
      collector.addSignature(request.id, owners[0], '0x1111' as Hex)

      expect(() => collector.getCombinedSignature(request.id)).toThrow(MultiSigError)
    })

    it('should throw NOT_READY error code when not ready', () => {
      const request = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2)
      collector.addSignature(request.id, owners[0], '0x1111' as Hex)

      try {
        collector.getCombinedSignature(request.id)
        expect.fail('Should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(MultiSigError)
        expect((e as MultiSigError).code).toBe(MultiSigErrorCode.NOT_READY)
      }
    })

    it('should throw for non-existent request', () => {
      expect(() => collector.getCombinedSignature('non-existent')).toThrow(MultiSigError)
    })

    it('should return signatures sorted by owner address in combined result', () => {
      const request = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2)
      // Add signatures in reverse owner order
      collector.addSignature(request.id, owners[2], '0xcccc' as Hex)
      collector.addSignature(request.id, owners[0], '0xaaaa' as Hex)

      const combined = collector.getCombinedSignature(request.id)
      // A (0xAAAA...) < C (0xCCCC...) numerically
      expect(combined).toBe('0xaaaacccc')
    })
  })

  describe('getPendingOwners', () => {
    it('should return owners who have not signed', () => {
      const request = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2)
      collector.addSignature(request.id, owners[0], '0x1111' as Hex)

      const pending = collector.getPendingOwners(request.id)

      expect(pending.length).toBe(2)
      expect(pending).toContain(owners[1])
      expect(pending).toContain(owners[2])
      expect(pending).not.toContain(owners[0])
    })

    it('should return all owners when none have signed', () => {
      const request = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2)
      const pending = collector.getPendingOwners(request.id)

      expect(pending).toHaveLength(3)
      expect(pending).toEqual(owners)
    })

    it('should return empty array when all have signed', () => {
      const request = collector.createRequest(mockUserOp, mockUserOpHash, owners, 3)
      collector.addSignature(request.id, owners[0], '0x1111' as Hex)
      collector.addSignature(request.id, owners[1], '0x2222' as Hex)
      collector.addSignature(request.id, owners[2], '0x3333' as Hex)

      const pending = collector.getPendingOwners(request.id)
      expect(pending).toHaveLength(0)
    })

    it('should throw for non-existent request', () => {
      expect(() => collector.getPendingOwners('non-existent')).toThrow(MultiSigError)
    })
  })

  describe('getSignedOwners', () => {
    it('should return owners who have signed', () => {
      const request = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2)
      collector.addSignature(request.id, owners[0], '0x1111' as Hex)

      const signed = collector.getSignedOwners(request.id)

      expect(signed.length).toBe(1)
      expect(signed).toContain(owners[0])
    })

    it('should return empty when no signatures collected', () => {
      const request = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2)
      const signed = collector.getSignedOwners(request.id)
      expect(signed).toHaveLength(0)
    })

    it('should throw for non-existent request', () => {
      expect(() => collector.getSignedOwners('non-existent')).toThrow(MultiSigError)
    })
  })

  describe('getPendingCount', () => {
    it('should return correct pending count', () => {
      const request = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2)
      expect(collector.getPendingCount(request.id)).toBe(3)

      collector.addSignature(request.id, owners[0], '0x1111' as Hex)
      expect(collector.getPendingCount(request.id)).toBe(2)

      collector.addSignature(request.id, owners[1], '0x2222' as Hex)
      expect(collector.getPendingCount(request.id)).toBe(1)

      collector.addSignature(request.id, owners[2], '0x3333' as Hex)
      expect(collector.getPendingCount(request.id)).toBe(0)
    })

    it('should throw for non-existent request', () => {
      expect(() => collector.getPendingCount('non-existent')).toThrow(MultiSigError)
    })
  })

  describe('getRequest', () => {
    it('should return existing request', () => {
      const request = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2)
      const retrieved = collector.getRequest(request.id)

      expect(retrieved).toBeDefined()
      expect(retrieved!.id).toBe(request.id)
    })

    it('should return undefined for non-existent request', () => {
      expect(collector.getRequest('non-existent')).toBeUndefined()
    })

    it('should return undefined for expired request', () => {
      const shortCollector = new SignatureCollector({ expirationMs: 1 })
      const request = shortCollector.createRequest(mockUserOp, mockUserOpHash, owners, 2)

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(shortCollector.getRequest(request.id)).toBeUndefined()
          resolve()
        }, 10)
      })
    })
  })

  describe('removeRequest', () => {
    it('should remove an existing request', () => {
      const request = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2)
      expect(collector.removeRequest(request.id)).toBe(true)
      expect(collector.getRequest(request.id)).toBeUndefined()
    })

    it('should return false for non-existent request', () => {
      expect(collector.removeRequest('non-existent')).toBe(false)
    })
  })

  describe('getPendingRequests', () => {
    it('should return all non-expired requests', () => {
      collector.createRequest(mockUserOp, mockUserOpHash, owners, 2)
      collector.createRequest(mockUserOp, mockUserOpHash, owners, 3)

      const requests = collector.getPendingRequests()
      expect(requests).toHaveLength(2)
    })

    it('should return empty array when no requests exist', () => {
      expect(collector.getPendingRequests()).toHaveLength(0)
    })
  })

  describe('clear', () => {
    it('should remove all pending requests', () => {
      collector.createRequest(mockUserOp, mockUserOpHash, owners, 2)
      collector.createRequest(mockUserOp, mockUserOpHash, owners, 3)

      collector.clear()
      expect(collector.getPendingRequests()).toHaveLength(0)
    })
  })

  describe('cleanup', () => {
    it('should remove expired requests', () => {
      // Create collector with very short expiration
      const shortCollector = new SignatureCollector({ expirationMs: 1 })
      const request = shortCollector.createRequest(mockUserOp, mockUserOpHash, owners, 2)

      // Wait for expiration
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          shortCollector.cleanup()
          expect(shortCollector.getRequest(request.id)).toBeUndefined()
          resolve()
        }, 10)
      })
    })

    it('should keep non-expired requests', () => {
      const request = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2)
      collector.cleanup()
      expect(collector.getRequest(request.id)).toBeDefined()
    })

    it('should remove only expired requests from mixed set', () => {
      vi.useFakeTimers()
      try {
        const shortCollector = new SignatureCollector({ expirationMs: 100 })
        const expiredRequest = shortCollector.createRequest(mockUserOp, mockUserOpHash, owners, 2)

        // Advance past expiration
        vi.advanceTimersByTime(150)

        // Create a fresh request after the first has expired
        const freshRequest = shortCollector.createRequest(mockUserOp, mockUserOpHash, owners, 2)

        shortCollector.cleanup()

        expect(shortCollector.getRequest(expiredRequest.id)).toBeUndefined()
        expect(shortCollector.getRequest(freshRequest.id)).toBeDefined()
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('multiple concurrent requests', () => {
    it('should track multiple independent requests', () => {
      const request1 = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2)
      const request2 = collector.createRequest(mockUserOp, mockUserOpHash, owners, 1)

      expect(request1.id).not.toBe(request2.id)

      // Add signature to request 1
      collector.addSignature(request1.id, owners[0], '0x1111' as Hex)
      expect(collector.isComplete(request1.id)).toBe(false)

      // Request 2 is independent - add signature to it
      collector.addSignature(request2.id, owners[0], '0xaaaa' as Hex)
      expect(collector.isComplete(request2.id)).toBe(true)

      // Request 1 still needs another signature
      expect(collector.isComplete(request1.id)).toBe(false)

      // Complete request 1
      collector.addSignature(request1.id, owners[1], '0x2222' as Hex)
      expect(collector.isComplete(request1.id)).toBe(true)
    })

    it('should handle removing one request without affecting others', () => {
      const request1 = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2)
      const request2 = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2)

      collector.removeRequest(request1.id)

      expect(collector.getRequest(request1.id)).toBeUndefined()
      expect(collector.getRequest(request2.id)).toBeDefined()
    })

    it('should handle signatures on different requests with same owners', () => {
      const request1 = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2)
      const request2 = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2)

      // Same owner signs both requests
      collector.addSignature(request1.id, owners[0], '0x1111' as Hex)
      collector.addSignature(request2.id, owners[0], '0xaaaa' as Hex)

      // Verify signatures are independent
      const signed1 = collector.getSignedOwners(request1.id)
      const signed2 = collector.getSignedOwners(request2.id)

      expect(signed1).toHaveLength(1)
      expect(signed2).toHaveLength(1)
    })
  })

  describe('expiration handling', () => {
    it('should use default 1-hour expiration', () => {
      const request = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2)
      const expectedExpiration = request.createdAt + 60 * 60 * 1000
      expect(request.expiresAt).toBe(expectedExpiration)
    })

    it('should use custom expiration time', () => {
      const customMs = 30 * 60 * 1000 // 30 minutes
      const customCollector = new SignatureCollector({ expirationMs: customMs })
      const request = customCollector.createRequest(mockUserOp, mockUserOpHash, owners, 2)

      expect(request.expiresAt - request.createdAt).toBe(customMs)
    })

    it('should delete request on expired addSignature attempt', () => {
      const shortCollector = new SignatureCollector({ expirationMs: 1 })
      const request = shortCollector.createRequest(mockUserOp, mockUserOpHash, owners, 2)

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          try {
            shortCollector.addSignature(request.id, owners[0], '0x1111' as Hex)
          } catch {
            // Expected
          }
          // The expired request should be deleted after the failed attempt
          expect(shortCollector.getRequest(request.id)).toBeUndefined()
          resolve()
        }, 10)
      })
    })
  })
})

describe('MultiSigError', () => {
  it('should create threshold not met error', () => {
    const error = MultiSigError.thresholdNotMet(2, 1)

    expect(error.code).toBe(MultiSigErrorCode.THRESHOLD_NOT_MET)
    expect(error.message).toContain('2')
    expect(error.message).toContain('1')
    expect(error.context).toEqual({ required: 2, collected: 1 })
  })

  it('should create insufficient signers error', () => {
    const error = MultiSigError.insufficientSigners(3, 2)

    expect(error.code).toBe(MultiSigErrorCode.INSUFFICIENT_SIGNERS)
    expect(error.context).toEqual({ required: 3, provided: 2 })
  })

  it('should create invalid threshold error', () => {
    const error = MultiSigError.invalidThreshold(5, 3)

    expect(error.code).toBe(MultiSigErrorCode.INVALID_THRESHOLD)
    expect(error.context).toEqual({ threshold: 5, ownerCount: 3 })
  })

  it('should create owner not found error', () => {
    const error = MultiSigError.ownerNotFound(5)

    expect(error.code).toBe(MultiSigErrorCode.OWNER_NOT_FOUND)
    expect(error.context).toEqual({ ownerIndex: 5 })
  })

  it('should create request not found error', () => {
    const error = MultiSigError.requestNotFound('test-id')

    expect(error.code).toBe(MultiSigErrorCode.REQUEST_NOT_FOUND)
    expect(error.context).toEqual({ requestId: 'test-id' })
  })

  it('should create already signed error', () => {
    const error = MultiSigError.alreadySigned(1)

    expect(error.code).toBe(MultiSigErrorCode.ALREADY_SIGNED)
    expect(error.context).toEqual({ ownerIndex: 1 })
  })

  it('should create not ready error', () => {
    const error = MultiSigError.notReady(3, 2)

    expect(error.code).toBe(MultiSigErrorCode.NOT_READY)
    expect(error.context).toEqual({ required: 3, collected: 2 })
  })

  it('should create not initialized error', () => {
    const error = MultiSigError.notInitialized()

    expect(error.code).toBe(MultiSigErrorCode.NOT_INITIALIZED)
  })

  it('should create request expired error', () => {
    const error = MultiSigError.requestExpired('test-request-id')

    expect(error.code).toBe(MultiSigErrorCode.REQUEST_EXPIRED)
    expect(error.context).toEqual({ requestId: 'test-request-id' })
  })

  it('should create signer mismatch error', () => {
    const error = MultiSigError.signerMismatch('0xexpected', '0xactual', 2)

    expect(error.code).toBe(MultiSigErrorCode.SIGNER_MISMATCH)
    expect(error.context).toEqual({ expected: '0xexpected', actual: '0xactual', ownerIndex: 2 })
  })

  it('should be an instance of Error', () => {
    const error = MultiSigError.notInitialized()
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(MultiSigError)
  })

  it('should have name property set to MultiSigError', () => {
    const error = MultiSigError.notInitialized()
    expect(error.name).toBe('MultiSigError')
  })

  it('should support custom context in constructor', () => {
    const error = new MultiSigError(MultiSigErrorCode.INVALID_THRESHOLD, 'Custom message', {
      key1: 'value1',
      key2: 42,
    })

    expect(error.code).toBe(MultiSigErrorCode.INVALID_THRESHOLD)
    expect(error.message).toBe('Custom message')
    expect(error.context).toEqual({ key1: 'value1', key2: 42 })
  })
})

describe('Exports', () => {
  it('should export main classes', async () => {
    const mod = await import('./index.js')

    expect(mod.MultiSigWdkSmartAccount).toBeDefined()
    expect(mod.MultiSigWdkGaslessClient).toBeDefined()
    expect(mod.SignatureCollector).toBeDefined()
  })

  it('should export factory functions', async () => {
    const mod = await import('./index.js')

    expect(mod.createMultiSigFromSingleSeed).toBeDefined()
    expect(mod.createMultiSigFromMultipleSeeds).toBeDefined()
    expect(mod.createMultiSigFromSigners).toBeDefined()
    expect(mod.createMultiSigWdkSmartAccount).toBeDefined()
  })

  it('should export error types', async () => {
    const mod = await import('./index.js')

    expect(mod.MultiSigError).toBeDefined()
    expect(mod.MultiSigErrorCode).toBeDefined()
  })

  it('should export constants', async () => {
    const mod = await import('./index.js')

    expect(mod.SAFE_4337_ADDRESSES).toBeDefined()
    expect(mod.SIGNATURE_TYPES).toBeDefined()
    expect(mod.DEFAULTS).toBeDefined()
    expect(mod.ENTRYPOINT_V07_ADDRESS).toBeDefined()
  })

  it('should export utilities', async () => {
    const mod = await import('./index.js')

    expect(mod.combineSignatures).toBeDefined()
    expect(mod.formatSignatureForSafe).toBeDefined()
    expect(mod.generateRequestId).toBeDefined()
    expect(mod.isValidThreshold).toBeDefined()
    expect(mod.sortAddresses).toBeDefined()
    expect(mod.getOwnerIndex).toBeDefined()
    expect(mod.areAddressesUnique).toBeDefined()
  })
})
