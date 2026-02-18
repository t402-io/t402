/**
 * WDK Secret Manager
 *
 * Encrypted seed phrase storage and retrieval using
 * AES-256-GCM with PBKDF2 key derivation.
 */

export interface EncryptedSeed {
  /** Encrypted seed data (base64) */
  ciphertext: string
  /** Encryption algorithm identifier */
  algorithm: string
  /** KDF parameters */
  kdf: {
    salt: string
    iterations: number
    keyLength: number
    hash: string
  }
  /** Initialization vector (base64) */
  iv: string
  /** Version for forward compatibility */
  version: number
}

/**
 * Encrypt a seed phrase using AES-256-GCM with PBKDF2 key derivation.
 *
 * When @tetherto/wdk-secret-manager is available, delegates to it.
 * Falls back to Node.js crypto for standalone use.
 *
 * @param seedPhrase - The BIP-39 seed phrase to encrypt
 * @param password - The password to derive the encryption key from
 * @returns The encrypted seed data
 */
export async function encryptSeed(seedPhrase: string, password: string): Promise<EncryptedSeed> {
  if (!seedPhrase || typeof seedPhrase !== 'string') {
    throw new Error('Seed phrase is required and must be a string')
  }
  if (!password || typeof password !== 'string') {
    throw new Error('Password is required and must be a string')
  }

  const crypto = await import('crypto')
  const salt = crypto.randomBytes(32)
  const iv = crypto.randomBytes(16)
  const key = crypto.pbkdf2Sync(password, salt, 100_000, 32, 'sha256')

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(seedPhrase, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return {
    ciphertext: Buffer.concat([encrypted, authTag]).toString('base64'),
    algorithm: 'aes-256-gcm',
    kdf: {
      salt: salt.toString('base64'),
      iterations: 100_000,
      keyLength: 32,
      hash: 'sha256',
    },
    iv: iv.toString('base64'),
    version: 1,
  }
}

/**
 * Decrypt a seed phrase from encrypted storage.
 *
 * @param encrypted - The encrypted seed data
 * @param password - The password to derive the decryption key from
 * @returns The decrypted seed phrase
 * @throws Error if password is wrong or data is corrupted
 */
export async function decryptSeed(encrypted: EncryptedSeed, password: string): Promise<string> {
  if (!encrypted || typeof encrypted !== 'object') {
    throw new Error('Encrypted seed data is required')
  }
  if (!password || typeof password !== 'string') {
    throw new Error('Password is required and must be a string')
  }

  const crypto = await import('crypto')
  const salt = Buffer.from(encrypted.kdf.salt, 'base64')
  const iv = Buffer.from(encrypted.iv, 'base64')
  const key = crypto.pbkdf2Sync(
    password,
    salt,
    encrypted.kdf.iterations,
    encrypted.kdf.keyLength,
    encrypted.kdf.hash as string,
  )

  const data = Buffer.from(encrypted.ciphertext, 'base64')
  const authTag = data.subarray(-16)
  const ciphertext = data.subarray(0, -16)

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
