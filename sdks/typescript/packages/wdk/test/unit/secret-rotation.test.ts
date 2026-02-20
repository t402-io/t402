import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  encryptSeed,
  decryptSeed,
  rotateSeedPassword,
  registerSecretManager,
  getSecretManager,
  createBackup,
  verifyBackup,
} from '../../src/secret'
import type { EncryptedSeed, SecretManager, BackupMetadata } from '../../src/secret'

const SEED_PHRASE =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

const PASSWORD = 'test-password-123'
const NEW_PASSWORD = 'new-password-456'

describe('rotateSeedPassword', () => {
  // Reset the secret manager after each test
  afterEach(() => {
    registerSecretManager(null as unknown as SecretManager)
  })

  it('should rotate password and decrypt with new password', async () => {
    const encrypted = await encryptSeed(SEED_PHRASE, PASSWORD)
    const rotated = await rotateSeedPassword(encrypted, PASSWORD, NEW_PASSWORD)
    const decrypted = await decryptSeed(rotated, NEW_PASSWORD)
    expect(decrypted).toBe(SEED_PHRASE)
  })

  it('should not decrypt with old password after rotation', async () => {
    const encrypted = await encryptSeed(SEED_PHRASE, PASSWORD)
    const rotated = await rotateSeedPassword(encrypted, PASSWORD, NEW_PASSWORD)
    await expect(decryptSeed(rotated, PASSWORD)).rejects.toThrow()
  })

  it('should fail with wrong old password', async () => {
    const encrypted = await encryptSeed(SEED_PHRASE, PASSWORD)
    await expect(rotateSeedPassword(encrypted, 'wrong-password', NEW_PASSWORD)).rejects.toThrow()
  })

  it('should throw for empty new password', async () => {
    const encrypted = await encryptSeed(SEED_PHRASE, PASSWORD)
    await expect(rotateSeedPassword(encrypted, PASSWORD, '')).rejects.toThrow(
      'New password is required',
    )
  })

  it('should preserve version when iterations unchanged', async () => {
    const encrypted = await encryptSeed(SEED_PHRASE, PASSWORD)
    expect(encrypted.version).toBe(1)

    const rotated = await rotateSeedPassword(encrypted, PASSWORD, NEW_PASSWORD)
    expect(rotated.version).toBe(1)
  })

  it('should upgrade version to 2 when iterations change', async () => {
    const encrypted = await encryptSeed(SEED_PHRASE, PASSWORD)
    expect(encrypted.version).toBe(1)

    const rotated = await rotateSeedPassword(encrypted, PASSWORD, NEW_PASSWORD, {
      iterations: 200_000,
    })
    expect(rotated.version).toBe(2)
    expect(rotated.kdf.iterations).toBe(200_000)

    // Should still decrypt correctly
    const decrypted = await decryptSeed(rotated, NEW_PASSWORD)
    expect(decrypted).toBe(SEED_PHRASE)
  })

  it('should keep version unchanged when passing same iterations', async () => {
    const encrypted = await encryptSeed(SEED_PHRASE, PASSWORD)
    const rotated = await rotateSeedPassword(encrypted, PASSWORD, NEW_PASSWORD, {
      iterations: 100_000, // same as default
    })
    expect(rotated.version).toBe(1) // no change
  })

  it('should generate new salt and IV', async () => {
    const encrypted = await encryptSeed(SEED_PHRASE, PASSWORD)
    const rotated = await rotateSeedPassword(encrypted, PASSWORD, NEW_PASSWORD)

    expect(rotated.kdf.salt).not.toBe(encrypted.kdf.salt)
    expect(rotated.iv).not.toBe(encrypted.iv)
  })
})

describe('SecretManager registry', () => {
  afterEach(() => {
    // Reset to default
    registerSecretManager(null as unknown as SecretManager)
  })

  it('should return default manager when none registered', () => {
    const manager = getSecretManager()
    expect(manager).toBeDefined()
    expect(typeof manager.encrypt).toBe('function')
    expect(typeof manager.decrypt).toBe('function')
  })

  it('should use custom secret manager when registered', async () => {
    const customManager: SecretManager = {
      encrypt: async (data, password) => {
        // Delegate to built-in but mark as custom
        const result = await encryptSeed(data, password)
        result.version = 99
        return result
      },
      decrypt: decryptSeed,
    }

    registerSecretManager(customManager)
    const manager = getSecretManager()

    const encrypted = await manager.encrypt(SEED_PHRASE, PASSWORD)
    expect(encrypted.version).toBe(99)

    const decrypted = await manager.decrypt(encrypted, PASSWORD)
    expect(decrypted).toBe(SEED_PHRASE)
  })

  it('should use registered manager in rotateSeedPassword', async () => {
    let decryptCalled = false
    const customManager: SecretManager = {
      encrypt: encryptSeed,
      decrypt: async (encrypted, password) => {
        decryptCalled = true
        return decryptSeed(encrypted, password)
      },
    }

    registerSecretManager(customManager)

    const encrypted = await encryptSeed(SEED_PHRASE, PASSWORD)
    await rotateSeedPassword(encrypted, PASSWORD, NEW_PASSWORD)

    expect(decryptCalled).toBe(true)
  })
})

describe('createBackup', () => {
  const metadata: BackupMetadata = {
    createdAt: '2026-02-20T00:00:00Z',
    version: 1,
    supportedChains: ['arbitrum', 'base', 'ethereum'],
    addressHints: {
      arbitrum: '0x1234567890123456789012345678901234567890',
      base: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    },
  }

  it('should create a valid JSON backup', async () => {
    const backup = await createBackup(SEED_PHRASE, PASSWORD, metadata)
    const parsed = JSON.parse(backup)

    expect(parsed.encrypted).toBeDefined()
    expect(parsed.encrypted.algorithm).toBe('aes-256-gcm')
    expect(parsed.metadata).toEqual(metadata)
  })

  it('should create backup that can be verified', async () => {
    const backup = await createBackup(SEED_PHRASE, PASSWORD, metadata)
    const result = await verifyBackup(backup, PASSWORD)

    expect(result.valid).toBe(true)
    expect(result.addressMatch).toBe(true)
    expect(result.metadata).toEqual(metadata)
  })

  it('should throw for empty seed phrase', async () => {
    await expect(createBackup('', PASSWORD, metadata)).rejects.toThrow('Seed phrase is required')
  })

  it('should throw for empty password', async () => {
    await expect(createBackup(SEED_PHRASE, '', metadata)).rejects.toThrow('Password is required')
  })
})

describe('verifyBackup', () => {
  const metadata: BackupMetadata = {
    createdAt: '2026-02-20T00:00:00Z',
    version: 1,
    supportedChains: ['arbitrum'],
    addressHints: {
      arbitrum: '0x1234567890123456789012345678901234567890',
    },
  }

  it('should return valid=true for correct password', async () => {
    const backup = await createBackup(SEED_PHRASE, PASSWORD, metadata)
    const result = await verifyBackup(backup, PASSWORD)
    expect(result.valid).toBe(true)
  })

  it('should return valid=false for wrong password', async () => {
    const backup = await createBackup(SEED_PHRASE, PASSWORD, metadata)
    const result = await verifyBackup(backup, 'wrong-password')
    expect(result.valid).toBe(false)
    expect(result.addressMatch).toBe(false)
  })

  it('should return valid=false for invalid JSON', async () => {
    const result = await verifyBackup('not-json', PASSWORD)
    expect(result.valid).toBe(false)
  })

  it('should return valid=false for JSON without expected structure', async () => {
    const result = await verifyBackup('{"foo":"bar"}', PASSWORD)
    expect(result.valid).toBe(false)
  })

  it('should match addresses when provided', async () => {
    const backup = await createBackup(SEED_PHRASE, PASSWORD, metadata)

    // Matching address
    const result1 = await verifyBackup(backup, PASSWORD, {
      arbitrum: '0x1234567890123456789012345678901234567890',
    })
    expect(result1.valid).toBe(true)
    expect(result1.addressMatch).toBe(true)
  })

  it('should detect mismatched addresses', async () => {
    const backup = await createBackup(SEED_PHRASE, PASSWORD, metadata)

    const result = await verifyBackup(backup, PASSWORD, {
      arbitrum: '0xdifferentaddress000000000000000000000000',
    })
    expect(result.valid).toBe(true)
    expect(result.addressMatch).toBe(false)
  })

  it('should be case-insensitive for address comparison', async () => {
    const backup = await createBackup(SEED_PHRASE, PASSWORD, metadata)

    const result = await verifyBackup(backup, PASSWORD, {
      arbitrum: '0x1234567890123456789012345678901234567890'.toUpperCase(),
    })
    expect(result.valid).toBe(true)
    expect(result.addressMatch).toBe(true)
  })

  it('should match when expected chain not in hints', async () => {
    const backup = await createBackup(SEED_PHRASE, PASSWORD, metadata)

    // Checking a chain that has no hint
    const result = await verifyBackup(backup, PASSWORD, {
      base: '0xanyaddress',
    })
    expect(result.valid).toBe(true)
    expect(result.addressMatch).toBe(true) // no hint to contradict
  })
})
