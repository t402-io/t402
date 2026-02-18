/**
 * WDK TON Storage Adapters
 *
 * Storage implementations for wallet state persistence.
 */

import type { TonStorageAdapter } from './types.js'

/**
 * In-memory storage adapter (non-persistent, useful for testing)
 */
export class InMemoryStorage implements TonStorageAdapter {
  private readonly store = new Map<string, string>()

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null
  }

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value)
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key)
  }

  /** Get number of stored entries (for testing) */
  get size(): number {
    return this.store.size
  }

  /** Clear all entries */
  clear(): void {
    this.store.clear()
  }
}

/**
 * File-system storage adapter (persistent, for server-side use)
 *
 * Stores wallet state as JSON files in a directory.
 */
export class FileSystemStorage implements TonStorageAdapter {
  private readonly dir: string

  constructor(directory: string) {
    this.dir = directory
  }

  async get(key: string): Promise<string | null> {
    const { readFile } = await import('node:fs/promises')
    const path = await this.getPath(key)
    try {
      return await readFile(path, 'utf-8')
    } catch {
      return null
    }
  }

  async set(key: string, value: string): Promise<void> {
    const { writeFile, mkdir } = await import('node:fs/promises')
    await mkdir(this.dir, { recursive: true })
    const path = await this.getPath(key)
    await writeFile(path, value, 'utf-8')
  }

  async delete(key: string): Promise<void> {
    const { unlink } = await import('node:fs/promises')
    const path = await this.getPath(key)
    try {
      await unlink(path)
    } catch {
      // File may not exist
    }
  }

  private async getPath(key: string): Promise<string> {
    const { join } = await import('node:path')
    // Sanitize key to prevent path traversal
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_')
    return join(this.dir, `${safeKey}.json`)
  }
}
