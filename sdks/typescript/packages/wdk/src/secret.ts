/**
 * WDK Secret Manager
 *
 * Encrypted seed phrase storage and retrieval using
 * AES-256-GCM with PBKDF2 key derivation.
 *
 * Includes:
 * - Key rotation with KDF iteration upgrades
 * - Pluggable SecretManager interface
 * - Backup/recovery with metadata and verification
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
 * Pluggable secret manager interface
 *
 * Allows custom encryption backends (e.g., HSM, cloud KMS).
 * The default implementation uses Node.js crypto.
 */
export interface SecretManager {
  encrypt(data: string, password: string): Promise<EncryptedSeed>
  decrypt(encrypted: EncryptedSeed, password: string): Promise<string>
}

/**
 * Metadata included with seed backups
 */
export interface BackupMetadata {
  createdAt: string
  version: number
  supportedChains: string[]
  /** Chain name -> first derived address hint for verification */
  addressHints: Record<string, string>
}

/**
 * Parsed backup structure (internal)
 */
interface BackupEnvelope {
  encrypted: EncryptedSeed
  metadata: BackupMetadata
}

// Global secret manager registry
let _secretManager: SecretManager | null = null

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

/**
 * Rotate the password on an encrypted seed.
 *
 * Decrypts with the old password, then re-encrypts with the new password.
 * Optionally upgrades KDF iterations (e.g., 100k -> 600k) and bumps version to 2.
 *
 * @param encrypted - The existing encrypted seed
 * @param oldPassword - The current password
 * @param newPassword - The new password to encrypt with
 * @param options - Optional iteration upgrade
 * @returns A new EncryptedSeed encrypted with the new password
 */
export async function rotateSeedPassword(
  encrypted: EncryptedSeed,
  oldPassword: string,
  newPassword: string,
  options?: { iterations?: number },
): Promise<EncryptedSeed> {
  if (!newPassword || typeof newPassword !== 'string') {
    throw new Error('New password is required and must be a string')
  }

  // Use the registered secret manager if available
  const manager = getSecretManager()

  // Decrypt with old password
  const seedPhrase = await manager.decrypt(encrypted, oldPassword)

  // Re-encrypt with new password, possibly with upgraded iterations
  const iterations = options?.iterations ?? encrypted.kdf.iterations
  const newVersion =
    options?.iterations && options.iterations !== encrypted.kdf.iterations ? 2 : encrypted.version

  const crypto = await import('crypto')
  const salt = crypto.randomBytes(32)
  const iv = crypto.randomBytes(16)
  const key = crypto.pbkdf2Sync(newPassword, salt, iterations, 32, 'sha256')

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encryptedData = Buffer.concat([cipher.update(seedPhrase, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return {
    ciphertext: Buffer.concat([encryptedData, authTag]).toString('base64'),
    algorithm: 'aes-256-gcm',
    kdf: {
      salt: salt.toString('base64'),
      iterations,
      keyLength: 32,
      hash: 'sha256',
    },
    iv: iv.toString('base64'),
    version: newVersion,
  }
}

/**
 * Register a custom secret manager
 *
 * @param manager - The secret manager implementation to use
 */
export function registerSecretManager(manager: SecretManager): void {
  _secretManager = manager
}

/**
 * Get the current secret manager
 *
 * Returns the registered secret manager, or a default implementation
 * that uses the built-in encryptSeed/decryptSeed functions.
 */
export function getSecretManager(): SecretManager {
  if (_secretManager) {
    return _secretManager
  }

  // Default implementation using built-in functions
  return {
    encrypt: encryptSeed,
    decrypt: decryptSeed,
  }
}

/**
 * Create a JSON backup of an encrypted seed with metadata
 *
 * @param seedPhrase - The BIP-39 seed phrase to backup
 * @param password - The password to encrypt the backup with
 * @param metadata - Backup metadata (chains, address hints, etc.)
 * @returns JSON string containing the encrypted seed and metadata
 */
export async function createBackup(
  seedPhrase: string,
  password: string,
  metadata: BackupMetadata,
): Promise<string> {
  if (!seedPhrase || typeof seedPhrase !== 'string') {
    throw new Error('Seed phrase is required and must be a string')
  }
  if (!password || typeof password !== 'string') {
    throw new Error('Password is required and must be a string')
  }

  const manager = getSecretManager()
  const encrypted = await manager.encrypt(seedPhrase, password)

  const envelope: BackupEnvelope = {
    encrypted,
    metadata,
  }

  return JSON.stringify(envelope, null, 2)
}

/**
 * Verify a backup by attempting to decrypt and optionally checking address hints
 *
 * @param backup - The JSON backup string
 * @param password - The password to decrypt with
 * @param expectedAddresses - Optional map of chain -> expected address for verification
 * @returns Object with `valid` (decryption succeeded) and `addressMatch` (addresses match if provided)
 */
export async function verifyBackup(
  backup: string,
  password: string,
  expectedAddresses?: Record<string, string>,
): Promise<{ valid: boolean; addressMatch: boolean; metadata?: BackupMetadata }> {
  let envelope: BackupEnvelope
  try {
    envelope = JSON.parse(backup) as BackupEnvelope
  } catch {
    return { valid: false, addressMatch: false }
  }

  if (!envelope.encrypted || !envelope.metadata) {
    return { valid: false, addressMatch: false }
  }

  try {
    const manager = getSecretManager()
    await manager.decrypt(envelope.encrypted, password)
  } catch {
    return { valid: false, addressMatch: false }
  }

  // Check address hints if expected addresses provided
  let addressMatch = true
  if (expectedAddresses && envelope.metadata.addressHints) {
    for (const [chain, expectedAddr] of Object.entries(expectedAddresses)) {
      const hint = envelope.metadata.addressHints[chain]
      if (hint && hint.toLowerCase() !== expectedAddr.toLowerCase()) {
        addressMatch = false
        break
      }
    }
  }

  return { valid: true, addressMatch, metadata: envelope.metadata }
}
