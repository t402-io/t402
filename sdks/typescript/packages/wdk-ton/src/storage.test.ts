import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryStorage } from './storage'

describe('InMemoryStorage', () => {
  let storage: InMemoryStorage

  beforeEach(() => {
    storage = new InMemoryStorage()
  })

  it('should return null for missing keys', async () => {
    const value = await storage.get('missing')
    expect(value).toBeNull()
  })

  it('should store and retrieve values', async () => {
    await storage.set('key1', 'value1')
    const value = await storage.get('key1')
    expect(value).toBe('value1')
  })

  it('should overwrite existing values', async () => {
    await storage.set('key1', 'value1')
    await storage.set('key1', 'value2')
    const value = await storage.get('key1')
    expect(value).toBe('value2')
  })

  it('should delete values', async () => {
    await storage.set('key1', 'value1')
    await storage.delete('key1')
    const value = await storage.get('key1')
    expect(value).toBeNull()
  })

  it('should not throw when deleting non-existent keys', async () => {
    await expect(storage.delete('missing')).resolves.toBeUndefined()
  })

  it('should track size', async () => {
    expect(storage.size).toBe(0)
    await storage.set('a', '1')
    expect(storage.size).toBe(1)
    await storage.set('b', '2')
    expect(storage.size).toBe(2)
    await storage.delete('a')
    expect(storage.size).toBe(1)
  })

  it('should clear all entries', async () => {
    await storage.set('a', '1')
    await storage.set('b', '2')
    storage.clear()
    expect(storage.size).toBe(0)
    expect(await storage.get('a')).toBeNull()
  })
})
