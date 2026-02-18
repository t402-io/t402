import { describe, it, expect, vi } from 'vitest'
import { encryptSeed, decryptSeed } from '../../src/secret'
import type { EncryptedSeed } from '../../src/secret'
import { T402WDK } from '../../src/t402wdk'
import type { WDKConstructor, WDKInstance, WDKAccount } from '../../src/types'

const SEED_PHRASE =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

const PASSWORD = 'test-password-123'

describe('encryptSeed', () => {
  it('should produce a valid EncryptedSeed structure', async () => {
    const encrypted = await encryptSeed(SEED_PHRASE, PASSWORD)

    expect(encrypted.version).toBe(1)
    expect(encrypted.algorithm).toBe('aes-256-gcm')
    expect(encrypted.ciphertext).toBeTruthy()
    expect(encrypted.iv).toBeTruthy()
    expect(encrypted.kdf).toEqual({
      salt: expect.any(String),
      iterations: 100_000,
      keyLength: 32,
      hash: 'sha256',
    })
  })

  it('should produce different ciphertexts for the same seed (random salt/iv)', async () => {
    const encrypted1 = await encryptSeed(SEED_PHRASE, PASSWORD)
    const encrypted2 = await encryptSeed(SEED_PHRASE, PASSWORD)

    expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext)
    expect(encrypted1.kdf.salt).not.toBe(encrypted2.kdf.salt)
    expect(encrypted1.iv).not.toBe(encrypted2.iv)
  })

  it('should produce different ciphertexts for different seed phrases', async () => {
    const seed2 =
      'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong'
    const encrypted1 = await encryptSeed(SEED_PHRASE, PASSWORD)
    const encrypted2 = await encryptSeed(seed2, PASSWORD)

    expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext)
  })

  it('should throw for empty seed phrase', async () => {
    await expect(encryptSeed('', PASSWORD)).rejects.toThrow('Seed phrase is required')
  })

  it('should throw for empty password', async () => {
    await expect(encryptSeed(SEED_PHRASE, '')).rejects.toThrow('Password is required')
  })
})

describe('decryptSeed', () => {
  it('should decrypt back to the original seed phrase', async () => {
    const encrypted = await encryptSeed(SEED_PHRASE, PASSWORD)
    const decrypted = await decryptSeed(encrypted, PASSWORD)

    expect(decrypted).toBe(SEED_PHRASE)
  })

  it('should throw with wrong password', async () => {
    const encrypted = await encryptSeed(SEED_PHRASE, PASSWORD)
    await expect(decryptSeed(encrypted, 'wrong-password')).rejects.toThrow()
  })

  it('should throw with corrupted ciphertext', async () => {
    const encrypted = await encryptSeed(SEED_PHRASE, PASSWORD)
    encrypted.ciphertext = 'corrupted-data'

    await expect(decryptSeed(encrypted, PASSWORD)).rejects.toThrow()
  })

  it('should throw for null encrypted data', async () => {
    await expect(
      decryptSeed(null as unknown as EncryptedSeed, PASSWORD),
    ).rejects.toThrow('Encrypted seed data is required')
  })

  it('should throw for empty password', async () => {
    const encrypted = await encryptSeed(SEED_PHRASE, PASSWORD)
    await expect(decryptSeed(encrypted, '')).rejects.toThrow('Password is required')
  })

  it('should handle round-trip with various seed lengths', async () => {
    const seeds = [
      // 12 words
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      // 24 words
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art',
    ]

    for (const seed of seeds) {
      const encrypted = await encryptSeed(seed, PASSWORD)
      const decrypted = await decryptSeed(encrypted, PASSWORD)
      expect(decrypted).toBe(seed)
    }
  })
})

describe('T402WDK secret methods', () => {
  // Mock WDK for testing
  function createMockAccount(address: string): WDKAccount {
    return {
      getAddress: vi.fn().mockResolvedValue(address),
      getBalance: vi.fn().mockResolvedValue(1000000000000000000n),
      getTokenBalance: vi.fn().mockResolvedValue(1000000n),
      signMessage: vi.fn().mockResolvedValue('0xsignature'),
      signTypedData: vi.fn().mockResolvedValue('0xtypedSignature'),
      sendTransaction: vi.fn().mockResolvedValue('0xtxhash'),
    }
  }

  function createMockWDKInstance(): WDKInstance {
    const mockAccount = createMockAccount('0x1234567890123456789012345678901234567890')
    return {
      registerWallet: vi.fn().mockReturnThis(),
      registerProtocol: vi.fn().mockReturnThis(),
      getAccount: vi.fn().mockResolvedValue(mockAccount),
      executeProtocol: vi.fn().mockResolvedValue({ txHash: '0xhash' }),
    }
  }

  const MockWDKConstructor: WDKConstructor = class MockWDK {
    constructor(_seedPhrase: string) {
      return createMockWDKInstance() as unknown as WDKInstance
    }
    static getRandomSeedPhrase(): string {
      return SEED_PHRASE
    }
  } as unknown as WDKConstructor

  const MockWalletManagerEvm = {}

  it('should create T402WDK from encrypted seed', async () => {
    // Register WDK modules
    T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)

    const encrypted = await encryptSeed(SEED_PHRASE, PASSWORD)
    const wdk = await T402WDK.fromEncryptedSeed(encrypted, PASSWORD, {
      arbitrum: 'https://arb1.arbitrum.io/rpc',
    })

    expect(wdk).toBeInstanceOf(T402WDK)
    expect(wdk.getConfiguredChains()).toContain('arbitrum')

    // Clean up
    // @ts-expect-error - accessing private static for testing
    T402WDK._WDK = null
    // @ts-expect-error - accessing private static for testing
    T402WDK._WalletManagerEvm = null
  })

  it('should encrypt seed from instance', async () => {
    // Register WDK modules
    T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)

    const wdk = new T402WDK(SEED_PHRASE, {
      arbitrum: 'https://arb1.arbitrum.io/rpc',
    })

    const encrypted = await wdk.encryptSeed(PASSWORD)
    expect(encrypted.version).toBe(1)
    expect(encrypted.algorithm).toBe('aes-256-gcm')

    // Should decrypt back to original
    const decrypted = await decryptSeed(encrypted, PASSWORD)
    expect(decrypted).toBe(SEED_PHRASE)

    // Clean up
    // @ts-expect-error - accessing private static for testing
    T402WDK._WDK = null
    // @ts-expect-error - accessing private static for testing
    T402WDK._WalletManagerEvm = null
  })

  it('should reject fromEncryptedSeed with wrong password', async () => {
    T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)

    const encrypted = await encryptSeed(SEED_PHRASE, PASSWORD)
    await expect(
      T402WDK.fromEncryptedSeed(encrypted, 'wrong-password'),
    ).rejects.toThrow()

    // Clean up
    // @ts-expect-error - accessing private static for testing
    T402WDK._WDK = null
    // @ts-expect-error - accessing private static for testing
    T402WDK._WalletManagerEvm = null
  })
})
