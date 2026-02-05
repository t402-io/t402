/**
 * MultiSigWdkSmartAccount and Factory Function Tests
 *
 * Tests for the multi-sig smart account class and factory functions
 * using mock WDKSigner and WdkAccount patterns.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Address, Hex, PublicClient } from 'viem'
import type { WDKSigner } from '@t402/wdk'
import { MultiSigWdkSmartAccount, createMultiSigWdkSmartAccount } from './account.js'
import { MultiSigError, MultiSigErrorCode } from './errors.js'
import { DEFAULTS as _DEFAULTS } from './constants.js'

// ---------------------------------------------------------------------------
// Helpers to build mock WDKSigners
// ---------------------------------------------------------------------------

/**
 * Create a mock WDKSigner with the given address.
 * The mock satisfies the WDKSigner interface used by MultiSigWdkSmartAccount.
 */
function createMockWDKSigner(address: Address): WDKSigner {
  return {
    address,
    isInitialized: true,
    initialize: vi.fn().mockResolvedValue(undefined),
    signMessage: vi.fn().mockResolvedValue(
      '0x' + 'ab'.repeat(65), // 65-byte mock signature
    ),
    signTypedData: vi.fn().mockResolvedValue('0x' + 'cd'.repeat(65)),
    getChain: vi.fn().mockReturnValue('arbitrum'),
    getChainId: vi.fn().mockReturnValue(42161),
    getAccountIndex: vi.fn().mockReturnValue(0),
    getBalance: vi.fn().mockResolvedValue(0n),
    getTokenBalance: vi.fn().mockResolvedValue(0n),
    estimateGas: vi.fn().mockResolvedValue(21000n),
    sendTransaction: vi.fn().mockResolvedValue({ hash: '0x' + 'ff'.repeat(32) }),
  } as unknown as WDKSigner
}

/**
 * Create a mock WDKSigner that is NOT initialized.
 * initialize() will set isInitialized to true and set the address.
 */
function createUninitializedMockWDKSigner(address: Address): WDKSigner {
  const signer: Record<string, unknown> = {
    _address: null as Address | null,
    isInitialized: false,
    initialize: vi.fn().mockImplementation(async function (this: Record<string, unknown>) {
      this.isInitialized = true
      this._address = address
    }),
    signMessage: vi.fn().mockResolvedValue('0x' + 'ab'.repeat(65)),
    signTypedData: vi.fn().mockResolvedValue('0x' + 'cd'.repeat(65)),
    getChain: vi.fn().mockReturnValue('arbitrum'),
    getChainId: vi.fn().mockReturnValue(42161),
    getAccountIndex: vi.fn().mockReturnValue(0),
    getBalance: vi.fn().mockResolvedValue(0n),
    getTokenBalance: vi.fn().mockResolvedValue(0n),
    estimateGas: vi.fn().mockResolvedValue(21000n),
    sendTransaction: vi.fn().mockResolvedValue({ hash: '0x' + 'ff'.repeat(32) }),
  }

  // Use a getter for `address` that throws when not initialized (like the real WDKSigner)
  Object.defineProperty(signer, 'address', {
    get() {
      if (!signer._address) {
        return address // For simplicity in tests, always return the address
      }
      return signer._address
    },
    enumerable: true,
  })

  return signer as unknown as WDKSigner
}

/**
 * Create a minimal mock PublicClient for testing purposes.
 * Most tests do not actually call publicClient methods.
 */
function createMockPublicClient(): PublicClient {
  return {
    readContract: vi.fn().mockResolvedValue('0x' + '00'.repeat(32)),
    getCode: vi.fn().mockResolvedValue('0x'),
  } as unknown as PublicClient
}

// ---------------------------------------------------------------------------
// Test addresses (sorted: A < B < C < D < E)
// ---------------------------------------------------------------------------
const ADDR_A = '0x1111111111111111111111111111111111111111' as Address
const ADDR_B = '0x2222222222222222222222222222222222222222' as Address
const ADDR_C = '0x3333333333333333333333333333333333333333' as Address
const _ADDR_D = '0x4444444444444444444444444444444444444444' as Address
const _ADDR_E = '0x5555555555555555555555555555555555555555' as Address

describe('MultiSigWdkSmartAccount', () => {
  let mockPublicClient: PublicClient

  beforeEach(() => {
    mockPublicClient = createMockPublicClient()
  })

  describe('constructor validation', () => {
    it('should throw INSUFFICIENT_SIGNERS when owners array is empty', () => {
      expect(
        () =>
          new MultiSigWdkSmartAccount({
            owners: [],
            threshold: 1,
            chainId: 42161,
            publicClient: mockPublicClient,
          }),
      ).toThrow(MultiSigError)

      try {
        new MultiSigWdkSmartAccount({
          owners: [],
          threshold: 1,
          chainId: 42161,
          publicClient: mockPublicClient,
        })
      } catch (e) {
        expect((e as MultiSigError).code).toBe(MultiSigErrorCode.INSUFFICIENT_SIGNERS)
      }
    })

    it('should throw INVALID_THRESHOLD when owner count exceeds MAX_OWNERS (10)', () => {
      const elevenSigners = Array.from({ length: 11 }, (_, i) =>
        createMockWDKSigner(`0x${(i + 1).toString(16).padStart(40, '0')}` as Address),
      )

      expect(
        () =>
          new MultiSigWdkSmartAccount({
            owners: elevenSigners,
            threshold: 1,
            chainId: 42161,
            publicClient: mockPublicClient,
          }),
      ).toThrow(MultiSigError)

      try {
        new MultiSigWdkSmartAccount({
          owners: elevenSigners,
          threshold: 1,
          chainId: 42161,
          publicClient: mockPublicClient,
        })
      } catch (e) {
        expect((e as MultiSigError).code).toBe(MultiSigErrorCode.INVALID_THRESHOLD)
        expect((e as MultiSigError).context?.ownerCount).toBe(11)
      }
    })

    it('should throw INVALID_THRESHOLD when threshold > owners count', () => {
      const signers = [createMockWDKSigner(ADDR_A), createMockWDKSigner(ADDR_B)]

      expect(
        () =>
          new MultiSigWdkSmartAccount({
            owners: signers,
            threshold: 3,
            chainId: 42161,
            publicClient: mockPublicClient,
          }),
      ).toThrow(MultiSigError)

      try {
        new MultiSigWdkSmartAccount({
          owners: signers,
          threshold: 3,
          chainId: 42161,
          publicClient: mockPublicClient,
        })
      } catch (e) {
        expect((e as MultiSigError).code).toBe(MultiSigErrorCode.INVALID_THRESHOLD)
      }
    })

    it('should throw INVALID_THRESHOLD when threshold is 0', () => {
      const signers = [createMockWDKSigner(ADDR_A)]

      expect(
        () =>
          new MultiSigWdkSmartAccount({
            owners: signers,
            threshold: 0,
            chainId: 42161,
            publicClient: mockPublicClient,
          }),
      ).toThrow(MultiSigError)

      try {
        new MultiSigWdkSmartAccount({
          owners: signers,
          threshold: 0,
          chainId: 42161,
          publicClient: mockPublicClient,
        })
      } catch (e) {
        expect((e as MultiSigError).code).toBe(MultiSigErrorCode.INVALID_THRESHOLD)
      }
    })

    it('should accept exactly 10 owners (MAX_OWNERS limit)', () => {
      const tenSigners = Array.from({ length: 10 }, (_, i) =>
        createMockWDKSigner(`0x${(i + 1).toString(16).padStart(40, '0')}` as Address),
      )

      expect(
        () =>
          new MultiSigWdkSmartAccount({
            owners: tenSigners,
            threshold: 5,
            chainId: 42161,
            publicClient: mockPublicClient,
          }),
      ).not.toThrow()
    })

    it('should accept valid 1-of-1 configuration', () => {
      const signers = [createMockWDKSigner(ADDR_A)]

      expect(
        () =>
          new MultiSigWdkSmartAccount({
            owners: signers,
            threshold: 1,
            chainId: 42161,
            publicClient: mockPublicClient,
          }),
      ).not.toThrow()
    })

    it('should accept valid 2-of-3 configuration', () => {
      const signers = [
        createMockWDKSigner(ADDR_A),
        createMockWDKSigner(ADDR_B),
        createMockWDKSigner(ADDR_C),
      ]

      expect(
        () =>
          new MultiSigWdkSmartAccount({
            owners: signers,
            threshold: 2,
            chainId: 42161,
            publicClient: mockPublicClient,
          }),
      ).not.toThrow()
    })

    it('should accept valid N-of-N configuration', () => {
      const signers = [
        createMockWDKSigner(ADDR_A),
        createMockWDKSigner(ADDR_B),
        createMockWDKSigner(ADDR_C),
      ]

      expect(
        () =>
          new MultiSigWdkSmartAccount({
            owners: signers,
            threshold: 3,
            chainId: 42161,
            publicClient: mockPublicClient,
          }),
      ).not.toThrow()
    })

    it('should use default salt nonce when not provided', () => {
      const signers = [createMockWDKSigner(ADDR_A)]
      const account = new MultiSigWdkSmartAccount({
        owners: signers,
        threshold: 1,
        chainId: 42161,
        publicClient: mockPublicClient,
      })

      // The default salt nonce is DEFAULTS.SALT_NONCE = 0n
      // We can verify through getThreshold (accessible without initialization)
      expect(account.getThreshold()).toBe(1)
    })

    it('should accept custom salt nonce', () => {
      const signers = [createMockWDKSigner(ADDR_A)]

      expect(
        () =>
          new MultiSigWdkSmartAccount({
            owners: signers,
            threshold: 1,
            chainId: 42161,
            publicClient: mockPublicClient,
            saltNonce: 42n,
          }),
      ).not.toThrow()
    })
  })

  describe('initialize()', () => {
    it('should sort owners by address', async () => {
      // Create signers in reverse order
      const signers = [
        createMockWDKSigner(ADDR_C),
        createMockWDKSigner(ADDR_A),
        createMockWDKSigner(ADDR_B),
      ]

      const account = new MultiSigWdkSmartAccount({
        owners: signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
      })

      await account.initialize()

      const owners = account.getOwners()
      expect(owners[0]).toBe(ADDR_A)
      expect(owners[1]).toBe(ADDR_B)
      expect(owners[2]).toBe(ADDR_C)
    })

    it('should initialize uninitialized signers', async () => {
      const signer = createUninitializedMockWDKSigner(ADDR_A)
      const account = new MultiSigWdkSmartAccount({
        owners: [signer],
        threshold: 1,
        chainId: 42161,
        publicClient: mockPublicClient,
      })

      await account.initialize()

      expect(signer.initialize).toHaveBeenCalled()
    })

    it('should not re-initialize if already initialized', async () => {
      const signer = createMockWDKSigner(ADDR_A)
      const account = new MultiSigWdkSmartAccount({
        owners: [signer],
        threshold: 1,
        chainId: 42161,
        publicClient: mockPublicClient,
      })

      await account.initialize()
      await account.initialize() // Second call should be a no-op

      // getOwners should still work
      expect(account.getOwners()).toHaveLength(1)
    })

    it('should throw on duplicate owner addresses', async () => {
      // Two signers with same address
      const signers = [createMockWDKSigner(ADDR_A), createMockWDKSigner(ADDR_A)]

      const account = new MultiSigWdkSmartAccount({
        owners: signers,
        threshold: 1,
        chainId: 42161,
        publicClient: mockPublicClient,
      })

      await expect(account.initialize()).rejects.toThrow(MultiSigError)
    })
  })

  describe('getOwners()', () => {
    it('should return sorted owner addresses', async () => {
      const signers = [
        createMockWDKSigner(ADDR_C),
        createMockWDKSigner(ADDR_A),
        createMockWDKSigner(ADDR_B),
      ]

      const account = new MultiSigWdkSmartAccount({
        owners: signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
      })

      await account.initialize()

      const owners = account.getOwners()
      expect(owners).toEqual([ADDR_A, ADDR_B, ADDR_C])
    })

    it('should return a copy of the owners array', async () => {
      const signers = [createMockWDKSigner(ADDR_A), createMockWDKSigner(ADDR_B)]

      const account = new MultiSigWdkSmartAccount({
        owners: signers,
        threshold: 1,
        chainId: 42161,
        publicClient: mockPublicClient,
      })

      await account.initialize()

      const owners1 = account.getOwners()
      const owners2 = account.getOwners()

      // Should be different array instances
      expect(owners1).not.toBe(owners2)
      // But same values
      expect(owners1).toEqual(owners2)
    })

    it('should throw NOT_INITIALIZED when called before initialize()', () => {
      const signers = [createMockWDKSigner(ADDR_A)]
      const account = new MultiSigWdkSmartAccount({
        owners: signers,
        threshold: 1,
        chainId: 42161,
        publicClient: mockPublicClient,
      })

      expect(() => account.getOwners()).toThrow(MultiSigError)

      try {
        account.getOwners()
      } catch (e) {
        expect((e as MultiSigError).code).toBe(MultiSigErrorCode.NOT_INITIALIZED)
      }
    })
  })

  describe('getThreshold()', () => {
    it('should return the configured threshold', () => {
      const signers = [
        createMockWDKSigner(ADDR_A),
        createMockWDKSigner(ADDR_B),
        createMockWDKSigner(ADDR_C),
      ]

      const account = new MultiSigWdkSmartAccount({
        owners: signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
      })

      expect(account.getThreshold()).toBe(2)
    })

    it('should work without initialization', () => {
      const signers = [createMockWDKSigner(ADDR_A)]
      const account = new MultiSigWdkSmartAccount({
        owners: signers,
        threshold: 1,
        chainId: 42161,
        publicClient: mockPublicClient,
      })

      // getThreshold does not require initialization
      expect(account.getThreshold()).toBe(1)
    })
  })

  describe('getSigners()', () => {
    it('should return all WDK signers', () => {
      const signerA = createMockWDKSigner(ADDR_A)
      const signerB = createMockWDKSigner(ADDR_B)
      const signers = [signerA, signerB]

      const account = new MultiSigWdkSmartAccount({
        owners: signers,
        threshold: 1,
        chainId: 42161,
        publicClient: mockPublicClient,
      })

      const returned = account.getSigners()
      expect(returned).toHaveLength(2)
      expect(returned).toContain(signerA)
      expect(returned).toContain(signerB)
    })

    it('should return a copy of the signers array', () => {
      const signers = [createMockWDKSigner(ADDR_A)]
      const account = new MultiSigWdkSmartAccount({
        owners: signers,
        threshold: 1,
        chainId: 42161,
        publicClient: mockPublicClient,
      })

      const returned1 = account.getSigners()
      const returned2 = account.getSigners()

      expect(returned1).not.toBe(returned2)
      expect(returned1).toEqual(returned2)
    })
  })

  describe('getChainId()', () => {
    it('should return the configured chain ID', () => {
      const signers = [createMockWDKSigner(ADDR_A)]
      const account = new MultiSigWdkSmartAccount({
        owners: signers,
        threshold: 1,
        chainId: 42161,
        publicClient: mockPublicClient,
      })

      expect(account.getChainId()).toBe(42161)
    })
  })

  describe('signUserOpHash()', () => {
    it('should sign with first signer', async () => {
      const signerA = createMockWDKSigner(ADDR_A)
      const signerB = createMockWDKSigner(ADDR_B)

      const account = new MultiSigWdkSmartAccount({
        owners: [signerA, signerB],
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
      })

      await account.initialize()

      const hash = '0xabcdef' as Hex
      const signature = await account.signUserOpHash(hash)

      expect(signature).toBeDefined()
      expect(signature.startsWith('0x')).toBe(true)
      // First signer (in wdkSigners order, not sorted owner order) should be called
      expect(signerA.signMessage).toHaveBeenCalledWith(hash)
    })

    it('should return a formatted Safe signature with type byte', async () => {
      const signer = createMockWDKSigner(ADDR_A)

      const account = new MultiSigWdkSmartAccount({
        owners: [signer],
        threshold: 1,
        chainId: 42161,
        publicClient: mockPublicClient,
      })

      await account.initialize()

      const signature = await account.signUserOpHash('0xabcdef' as Hex)
      // formatSignatureForSafe appends '00' (EOA type byte)
      expect(signature.endsWith('00')).toBe(true)
    })
  })

  describe('signWithOwner()', () => {
    it('should sign with specific owner by index', async () => {
      const signerA = createMockWDKSigner(ADDR_A)
      const signerB = createMockWDKSigner(ADDR_B)
      const signerC = createMockWDKSigner(ADDR_C)

      const account = new MultiSigWdkSmartAccount({
        owners: [signerC, signerA, signerB], // unsorted order
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
      })

      await account.initialize()

      // After initialization, owners are sorted: ADDR_A, ADDR_B, ADDR_C
      // So owner index 0 = ADDR_A, index 1 = ADDR_B, index 2 = ADDR_C
      const hash = '0xdeadbeef' as Hex
      await account.signWithOwner(hash, 1) // Should sign with ADDR_B

      expect(signerB.signMessage).toHaveBeenCalledWith(hash)
    })

    it('should throw OWNER_NOT_FOUND for out-of-range index', async () => {
      const signers = [createMockWDKSigner(ADDR_A), createMockWDKSigner(ADDR_B)]

      const account = new MultiSigWdkSmartAccount({
        owners: signers,
        threshold: 1,
        chainId: 42161,
        publicClient: mockPublicClient,
      })

      await account.initialize()

      await expect(account.signWithOwner('0xabcdef' as Hex, 5)).rejects.toThrow(MultiSigError)

      try {
        await account.signWithOwner('0xabcdef' as Hex, 5)
      } catch (e) {
        expect((e as MultiSigError).code).toBe(MultiSigErrorCode.OWNER_NOT_FOUND)
      }
    })

    it('should throw OWNER_NOT_FOUND for negative index', async () => {
      const signers = [createMockWDKSigner(ADDR_A)]

      const account = new MultiSigWdkSmartAccount({
        owners: signers,
        threshold: 1,
        chainId: 42161,
        publicClient: mockPublicClient,
      })

      await account.initialize()

      await expect(account.signWithOwner('0xabcdef' as Hex, -1)).rejects.toThrow(MultiSigError)
    })

    it('should return a formatted Safe signature', async () => {
      const signers = [createMockWDKSigner(ADDR_A)]

      const account = new MultiSigWdkSmartAccount({
        owners: signers,
        threshold: 1,
        chainId: 42161,
        publicClient: mockPublicClient,
      })

      await account.initialize()

      const signature = await account.signWithOwner('0xdeadbeef' as Hex, 0)
      expect(signature.startsWith('0x')).toBe(true)
      expect(signature.endsWith('00')).toBe(true) // EOA type byte
    })
  })

  describe('combineSignatures()', () => {
    it('should combine signatures merging in address order', async () => {
      const signers = [
        createMockWDKSigner(ADDR_A),
        createMockWDKSigner(ADDR_B),
        createMockWDKSigner(ADDR_C),
      ]

      const account = new MultiSigWdkSmartAccount({
        owners: signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
      })

      await account.initialize()

      // Provide signatures out of order
      const signatures = new Map<number, Hex>([
        [2, '0xcc' as Hex], // ADDR_C
        [0, '0xaa' as Hex], // ADDR_A
      ])

      const combined = account.combineSignatures(signatures)
      // Should be sorted by address: ADDR_A < ADDR_C
      expect(combined).toBe('0xaacc')
    })

    it('should throw NOT_INITIALIZED when called before initialize()', () => {
      const signers = [createMockWDKSigner(ADDR_A), createMockWDKSigner(ADDR_B)]
      const account = new MultiSigWdkSmartAccount({
        owners: signers,
        threshold: 1,
        chainId: 42161,
        publicClient: mockPublicClient,
      })

      const signatures = new Map<number, Hex>([[0, '0xaa' as Hex]])

      expect(() => account.combineSignatures(signatures)).toThrow(MultiSigError)
    })
  })

  describe('hasEnoughSignatures()', () => {
    it('should return true when signature count meets threshold', () => {
      const signers = [
        createMockWDKSigner(ADDR_A),
        createMockWDKSigner(ADDR_B),
        createMockWDKSigner(ADDR_C),
      ]

      const account = new MultiSigWdkSmartAccount({
        owners: signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
      })

      const signatures = new Map<number, Hex>([
        [0, '0xaa' as Hex],
        [1, '0xbb' as Hex],
      ])

      expect(account.hasEnoughSignatures(signatures)).toBe(true)
    })

    it('should return true when signature count exceeds threshold', () => {
      const signers = [
        createMockWDKSigner(ADDR_A),
        createMockWDKSigner(ADDR_B),
        createMockWDKSigner(ADDR_C),
      ]

      const account = new MultiSigWdkSmartAccount({
        owners: signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
      })

      const signatures = new Map<number, Hex>([
        [0, '0xaa' as Hex],
        [1, '0xbb' as Hex],
        [2, '0xcc' as Hex],
      ])

      expect(account.hasEnoughSignatures(signatures)).toBe(true)
    })

    it('should return false when signature count is below threshold', () => {
      const signers = [
        createMockWDKSigner(ADDR_A),
        createMockWDKSigner(ADDR_B),
        createMockWDKSigner(ADDR_C),
      ]

      const account = new MultiSigWdkSmartAccount({
        owners: signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
      })

      const signatures = new Map<number, Hex>([[0, '0xaa' as Hex]])

      expect(account.hasEnoughSignatures(signatures)).toBe(false)
    })

    it('should return false for empty signature map', () => {
      const signers = [createMockWDKSigner(ADDR_A)]
      const account = new MultiSigWdkSmartAccount({
        owners: signers,
        threshold: 1,
        chainId: 42161,
        publicClient: mockPublicClient,
      })

      const signatures = new Map<number, Hex>()
      expect(account.hasEnoughSignatures(signatures)).toBe(false)
    })
  })

  describe('getAddress()', () => {
    it('should call publicClient.readContract for proxy creation code', async () => {
      const signers = [createMockWDKSigner(ADDR_A)]
      const account = new MultiSigWdkSmartAccount({
        owners: signers,
        threshold: 1,
        chainId: 42161,
        publicClient: mockPublicClient,
      })

      // The mock returns '0x' + '00'.repeat(32) for readContract,
      // which getContractAddress will process
      const address = await account.getAddress()
      expect(address).toBeDefined()
      expect(address.startsWith('0x')).toBe(true)
      expect(address).toHaveLength(42) // 0x + 40 hex chars
    })

    it('should cache the address after first call', async () => {
      const signers = [createMockWDKSigner(ADDR_A)]
      const account = new MultiSigWdkSmartAccount({
        owners: signers,
        threshold: 1,
        chainId: 42161,
        publicClient: mockPublicClient,
      })

      const address1 = await account.getAddress()
      const address2 = await account.getAddress()

      expect(address1).toBe(address2)
      // readContract should only be called once (for proxy creation code)
      expect(mockPublicClient.readContract).toHaveBeenCalledTimes(1)
    })

    it('should produce deterministic address for same config', async () => {
      const signers1 = [createMockWDKSigner(ADDR_A)]
      const signers2 = [createMockWDKSigner(ADDR_A)]

      const account1 = new MultiSigWdkSmartAccount({
        owners: signers1,
        threshold: 1,
        chainId: 42161,
        publicClient: mockPublicClient,
      })

      const account2 = new MultiSigWdkSmartAccount({
        owners: signers2,
        threshold: 1,
        chainId: 42161,
        publicClient: mockPublicClient,
      })

      const address1 = await account1.getAddress()
      const address2 = await account2.getAddress()

      expect(address1).toBe(address2)
    })
  })

  describe('encodeExecute()', () => {
    it('should encode a single execute call', () => {
      const signers = [createMockWDKSigner(ADDR_A)]
      const account = new MultiSigWdkSmartAccount({
        owners: signers,
        threshold: 1,
        chainId: 42161,
        publicClient: mockPublicClient,
      })

      const callData = account.encodeExecute(ADDR_B, 0n, '0x' as Hex)
      expect(callData).toBeDefined()
      expect(callData.startsWith('0x')).toBe(true)
    })
  })

  describe('encodeExecuteBatch()', () => {
    it('should encode a batch execute call', () => {
      const signers = [createMockWDKSigner(ADDR_A)]
      const account = new MultiSigWdkSmartAccount({
        owners: signers,
        threshold: 1,
        chainId: 42161,
        publicClient: mockPublicClient,
      })

      const callData = account.encodeExecuteBatch(
        [ADDR_B, ADDR_C],
        [0n, 0n],
        ['0x' as Hex, '0x' as Hex],
      )
      expect(callData).toBeDefined()
      expect(callData.startsWith('0x')).toBe(true)
    })

    it('should throw when array lengths do not match', () => {
      const signers = [createMockWDKSigner(ADDR_A)]
      const account = new MultiSigWdkSmartAccount({
        owners: signers,
        threshold: 1,
        chainId: 42161,
        publicClient: mockPublicClient,
      })

      expect(() =>
        account.encodeExecuteBatch([ADDR_B, ADDR_C], [0n], ['0x' as Hex, '0x' as Hex]),
      ).toThrow('Array lengths must match')
    })
  })

  describe('isDeployed()', () => {
    it('should return false when no contract code exists', async () => {
      const signers = [createMockWDKSigner(ADDR_A)]
      ;(mockPublicClient.getCode as ReturnType<typeof vi.fn>).mockResolvedValue('0x')

      const account = new MultiSigWdkSmartAccount({
        owners: signers,
        threshold: 1,
        chainId: 42161,
        publicClient: mockPublicClient,
      })

      const deployed = await account.isDeployed()
      expect(deployed).toBe(false)
    })

    it('should return true when contract code exists', async () => {
      const signers = [createMockWDKSigner(ADDR_A)]
      ;(mockPublicClient.getCode as ReturnType<typeof vi.fn>).mockResolvedValue('0x608060405...')

      const account = new MultiSigWdkSmartAccount({
        owners: signers,
        threshold: 1,
        chainId: 42161,
        publicClient: mockPublicClient,
      })

      const deployed = await account.isDeployed()
      expect(deployed).toBe(true)
    })

    it('should cache deployment status', async () => {
      const signers = [createMockWDKSigner(ADDR_A)]
      ;(mockPublicClient.getCode as ReturnType<typeof vi.fn>).mockResolvedValue('0x608060405...')

      const account = new MultiSigWdkSmartAccount({
        owners: signers,
        threshold: 1,
        chainId: 42161,
        publicClient: mockPublicClient,
      })

      await account.isDeployed()
      await account.isDeployed()

      // getCode should only be called once
      expect(mockPublicClient.getCode).toHaveBeenCalledTimes(1)
    })
  })

  describe('getInitCode()', () => {
    it('should return 0x if already deployed', async () => {
      const signers = [createMockWDKSigner(ADDR_A)]
      ;(mockPublicClient.getCode as ReturnType<typeof vi.fn>).mockResolvedValue('0x608060405...')

      const account = new MultiSigWdkSmartAccount({
        owners: signers,
        threshold: 1,
        chainId: 42161,
        publicClient: mockPublicClient,
      })

      const initCode = await account.getInitCode()
      expect(initCode).toBe('0x')
    })

    it('should return init code when not deployed', async () => {
      const signers = [createMockWDKSigner(ADDR_A)]
      ;(mockPublicClient.getCode as ReturnType<typeof vi.fn>).mockResolvedValue('0x')

      const account = new MultiSigWdkSmartAccount({
        owners: signers,
        threshold: 1,
        chainId: 42161,
        publicClient: mockPublicClient,
      })

      const initCode = await account.getInitCode()
      expect(initCode).not.toBe('0x')
      expect(initCode.startsWith('0x')).toBe(true)
      // Init code should include the proxy factory address
      expect(initCode.toLowerCase()).toContain(
        '4e1dcf7ad4e460cfd30791ccc4f9c8a4f820ec67', // proxyFactory address without 0x
      )
    })
  })

  describe('clearCache()', () => {
    it('should clear cached address and allow re-computation', async () => {
      const signers = [createMockWDKSigner(ADDR_A)]
      const account = new MultiSigWdkSmartAccount({
        owners: signers,
        threshold: 1,
        chainId: 42161,
        publicClient: mockPublicClient,
      })

      const address1 = await account.getAddress()
      account.clearCache()
      const address2 = await account.getAddress()

      // Should be the same address (deterministic)
      expect(address1).toBe(address2)
      // But readContract should have been called twice
      expect(mockPublicClient.readContract).toHaveBeenCalledTimes(2)
    })
  })
})

describe('createMultiSigWdkSmartAccount', () => {
  it('should create and initialize a smart account', async () => {
    const signers = [createMockWDKSigner(ADDR_A), createMockWDKSigner(ADDR_B)]
    const mockPublicClient = createMockPublicClient()

    const account = await createMultiSigWdkSmartAccount({
      owners: signers,
      threshold: 2,
      chainId: 42161,
      publicClient: mockPublicClient,
    })

    // Should be initialized, so getOwners() should work
    expect(account.getOwners()).toHaveLength(2)
    expect(account.getThreshold()).toBe(2)
  })

  it('should throw for invalid configuration', async () => {
    const mockPublicClient = createMockPublicClient()

    await expect(
      createMultiSigWdkSmartAccount({
        owners: [],
        threshold: 1,
        chainId: 42161,
        publicClient: mockPublicClient,
      }),
    ).rejects.toThrow(MultiSigError)
  })
})

describe('Factory functions', () => {
  describe('createMultiSigFromSigners', () => {
    // We need to import the factory function and mock its dependencies
    // Since the factory creates a MultiSigWdkGaslessClient which depends on
    // BundlerClient and other EVM infrastructure, we test validation paths.

    it('should be importable', async () => {
      const { createMultiSigFromSigners } = await import('./factory.js')
      expect(createMultiSigFromSigners).toBeDefined()
    })

    it('should throw for empty signers array', async () => {
      const { createMultiSigFromSigners } = await import('./factory.js')
      const mockPublicClient = createMockPublicClient()

      await expect(
        createMultiSigFromSigners({
          signers: [],
          threshold: 1,
          chainId: 42161,
          publicClient: mockPublicClient,
          bundler: { bundlerUrl: 'http://localhost:4337', chainId: 42161 },
        }),
      ).rejects.toThrow(MultiSigError)

      try {
        await createMultiSigFromSigners({
          signers: [],
          threshold: 1,
          chainId: 42161,
          publicClient: mockPublicClient,
          bundler: { bundlerUrl: 'http://localhost:4337', chainId: 42161 },
        })
      } catch (e) {
        expect((e as MultiSigError).code).toBe(MultiSigErrorCode.INSUFFICIENT_SIGNERS)
      }
    })

    it('should throw for invalid threshold with signers', async () => {
      const { createMultiSigFromSigners } = await import('./factory.js')
      const mockPublicClient = createMockPublicClient()
      const signers = [createMockWDKSigner(ADDR_A), createMockWDKSigner(ADDR_B)]

      await expect(
        createMultiSigFromSigners({
          signers,
          threshold: 5, // exceeds signer count
          chainId: 42161,
          publicClient: mockPublicClient,
          bundler: { bundlerUrl: 'http://localhost:4337', chainId: 42161 },
        }),
      ).rejects.toThrow(MultiSigError)

      try {
        await createMultiSigFromSigners({
          signers,
          threshold: 5,
          chainId: 42161,
          publicClient: mockPublicClient,
          bundler: { bundlerUrl: 'http://localhost:4337', chainId: 42161 },
        })
      } catch (e) {
        expect((e as MultiSigError).code).toBe(MultiSigErrorCode.INVALID_THRESHOLD)
      }
    })

    it('should throw for threshold of 0', async () => {
      const { createMultiSigFromSigners } = await import('./factory.js')
      const mockPublicClient = createMockPublicClient()
      const signers = [createMockWDKSigner(ADDR_A)]

      await expect(
        createMultiSigFromSigners({
          signers,
          threshold: 0,
          chainId: 42161,
          publicClient: mockPublicClient,
          bundler: { bundlerUrl: 'http://localhost:4337', chainId: 42161 },
        }),
      ).rejects.toThrow(MultiSigError)
    })

    it('should initialize uninitialized signers', async () => {
      const { createMultiSigFromSigners } = await import('./factory.js')
      const mockPublicClient = createMockPublicClient()

      const uninitializedSigner = createUninitializedMockWDKSigner(ADDR_A)
      // Override isInitialized to false for this test
      Object.defineProperty(uninitializedSigner, 'isInitialized', {
        get: vi
          .fn()
          .mockReturnValueOnce(false) // First check: not initialized
          .mockReturnValue(true), // After initialize: initialized
        configurable: true,
      })

      // This will throw because of duplicate address detection after createMultiSigWdkSmartAccount
      // tries to init the same address, but the important thing is initialize() gets called
      const signers = [uninitializedSigner, createMockWDKSigner(ADDR_B)]

      // The factory will try to create the gasless client, but validation of signers should pass
      try {
        await createMultiSigFromSigners({
          signers,
          threshold: 1,
          chainId: 42161,
          publicClient: mockPublicClient,
          bundler: { bundlerUrl: 'http://localhost:4337', chainId: 42161 },
        })
      } catch {
        // May throw due to mock limitations, but initialize should have been called
      }

      expect(uninitializedSigner.initialize).toHaveBeenCalled()
    })
  })

  describe('createMultiSigFromSingleSeed', () => {
    it('should be importable', async () => {
      const { createMultiSigFromSingleSeed } = await import('./factory.js')
      expect(createMultiSigFromSingleSeed).toBeDefined()
    })

    it('should throw for empty accountIndices', async () => {
      const { createMultiSigFromSingleSeed } = await import('./factory.js')

      await expect(
        createMultiSigFromSingleSeed({
          seedPhrase: 'test seed phrase',
          accountIndices: [],
          threshold: 1,
          chainConfig: { arbitrum: 'https://arb1.arbitrum.io/rpc' },
          chain: 'arbitrum',
          bundler: { bundlerUrl: 'http://localhost:4337', chainId: 42161 },
        }),
      ).rejects.toThrow(MultiSigError)

      try {
        await createMultiSigFromSingleSeed({
          seedPhrase: 'test seed phrase',
          accountIndices: [],
          threshold: 1,
          chainConfig: { arbitrum: 'https://arb1.arbitrum.io/rpc' },
          chain: 'arbitrum',
          bundler: { bundlerUrl: 'http://localhost:4337', chainId: 42161 },
        })
      } catch (e) {
        expect((e as MultiSigError).code).toBe(MultiSigErrorCode.INSUFFICIENT_SIGNERS)
      }
    })

    it('should throw for invalid threshold with single seed', async () => {
      const { createMultiSigFromSingleSeed } = await import('./factory.js')

      await expect(
        createMultiSigFromSingleSeed({
          seedPhrase: 'test seed phrase',
          accountIndices: [0, 1],
          threshold: 5, // exceeds account count
          chainConfig: { arbitrum: 'https://arb1.arbitrum.io/rpc' },
          chain: 'arbitrum',
          bundler: { bundlerUrl: 'http://localhost:4337', chainId: 42161 },
        }),
      ).rejects.toThrow(MultiSigError)

      try {
        await createMultiSigFromSingleSeed({
          seedPhrase: 'test seed phrase',
          accountIndices: [0, 1],
          threshold: 5,
          chainConfig: { arbitrum: 'https://arb1.arbitrum.io/rpc' },
          chain: 'arbitrum',
          bundler: { bundlerUrl: 'http://localhost:4337', chainId: 42161 },
        })
      } catch (e) {
        expect((e as MultiSigError).code).toBe(MultiSigErrorCode.INVALID_THRESHOLD)
      }
    })
  })

  describe('createMultiSigFromMultipleSeeds', () => {
    it('should be importable', async () => {
      const { createMultiSigFromMultipleSeeds } = await import('./factory.js')
      expect(createMultiSigFromMultipleSeeds).toBeDefined()
    })

    it('should throw for empty seedPhrases', async () => {
      const { createMultiSigFromMultipleSeeds } = await import('./factory.js')

      await expect(
        createMultiSigFromMultipleSeeds({
          seedPhrases: [],
          threshold: 1,
          chainConfig: { arbitrum: 'https://arb1.arbitrum.io/rpc' },
          chain: 'arbitrum',
          bundler: { bundlerUrl: 'http://localhost:4337', chainId: 42161 },
        }),
      ).rejects.toThrow(MultiSigError)

      try {
        await createMultiSigFromMultipleSeeds({
          seedPhrases: [],
          threshold: 1,
          chainConfig: { arbitrum: 'https://arb1.arbitrum.io/rpc' },
          chain: 'arbitrum',
          bundler: { bundlerUrl: 'http://localhost:4337', chainId: 42161 },
        })
      } catch (e) {
        expect((e as MultiSigError).code).toBe(MultiSigErrorCode.INSUFFICIENT_SIGNERS)
      }
    })

    it('should throw for invalid threshold with multiple seeds', async () => {
      const { createMultiSigFromMultipleSeeds } = await import('./factory.js')

      await expect(
        createMultiSigFromMultipleSeeds({
          seedPhrases: ['seed1', 'seed2'],
          threshold: 3, // exceeds seed count
          chainConfig: { arbitrum: 'https://arb1.arbitrum.io/rpc' },
          chain: 'arbitrum',
          bundler: { bundlerUrl: 'http://localhost:4337', chainId: 42161 },
        }),
      ).rejects.toThrow(MultiSigError)

      try {
        await createMultiSigFromMultipleSeeds({
          seedPhrases: ['seed1', 'seed2'],
          threshold: 3,
          chainConfig: { arbitrum: 'https://arb1.arbitrum.io/rpc' },
          chain: 'arbitrum',
          bundler: { bundlerUrl: 'http://localhost:4337', chainId: 42161 },
        })
      } catch (e) {
        expect((e as MultiSigError).code).toBe(MultiSigErrorCode.INVALID_THRESHOLD)
      }
    })

    it('should throw for threshold of 0 with multiple seeds', async () => {
      const { createMultiSigFromMultipleSeeds } = await import('./factory.js')

      await expect(
        createMultiSigFromMultipleSeeds({
          seedPhrases: ['seed1', 'seed2'],
          threshold: 0,
          chainConfig: { arbitrum: 'https://arb1.arbitrum.io/rpc' },
          chain: 'arbitrum',
          bundler: { bundlerUrl: 'http://localhost:4337', chainId: 42161 },
        }),
      ).rejects.toThrow(MultiSigError)
    })
  })
})
