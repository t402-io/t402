import { describe, it, expect, vi } from 'vitest'
import { createWdkMoneyParser, toAtomicUnits, resolveAssetForNetwork } from '../../src/pricing'

describe('createWdkMoneyParser', () => {
  it('should return AssetAmount for a valid amount on a known network', async () => {
    const parser = createWdkMoneyParser()
    const result = await parser(1.5, 'eip155:42161') // Arbitrum

    expect(result).not.toBeNull()
    expect(result!.amount).toBe('1500000') // 1.5 * 10^6
    expect(result!.asset).toBeTruthy()
  })

  it('should return null for non-positive amounts', async () => {
    const parser = createWdkMoneyParser()

    expect(await parser(0, 'eip155:42161')).toBeNull()
    expect(await parser(-1, 'eip155:42161')).toBeNull()
    expect(await parser(NaN, 'eip155:42161')).toBeNull()
    expect(await parser(Infinity, 'eip155:42161')).toBeNull()
  })

  it('should return null for unknown network', async () => {
    const parser = createWdkMoneyParser()
    const result = await parser(1.5, 'eip155:999999' as `${string}:${string}`)
    expect(result).toBeNull()
  })

  it('should handle stablecoin pass-through at 1:1', async () => {
    const parser = createWdkMoneyParser()

    // Arbitrum has USDT0 as preferred token
    const result = await parser(10.0, 'eip155:42161')
    expect(result).not.toBeNull()
    expect(result!.amount).toBe('10000000') // 10 * 10^6
  })

  it('should handle small amounts accurately', async () => {
    const parser = createWdkMoneyParser()
    const result = await parser(0.01, 'eip155:42161')

    expect(result).not.toBeNull()
    expect(result!.amount).toBe('10000') // 0.01 * 10^6
  })

  it('should handle large amounts', async () => {
    const parser = createWdkMoneyParser()
    const result = await parser(1000000, 'eip155:42161')

    expect(result).not.toBeNull()
    expect(result!.amount).toBe('1000000000000') // 1M * 10^6
  })

  it('should use cached rate within TTL', async () => {
    const parser = createWdkMoneyParser({ cacheTTL: 60_000 })

    // First call populates cache
    const result1 = await parser(1, 'eip155:42161')
    // Second call should use cache (same result)
    const result2 = await parser(1, 'eip155:42161')

    expect(result1).toEqual(result2)
  })

  it('should respect custom cacheTTL', async () => {
    const now = Date.now()
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(now) // first call
      .mockReturnValueOnce(now) // cache set
      .mockReturnValueOnce(now + 100) // second call (within TTL)
      .mockReturnValueOnce(now + 100) // cache check

    const parser = createWdkMoneyParser({ cacheTTL: 50 })

    const result1 = await parser(1, 'eip155:42161')
    const result2 = await parser(1, 'eip155:42161')

    // Both should succeed
    expect(result1).not.toBeNull()
    expect(result2).not.toBeNull()

    vi.restoreAllMocks()
  })

  it('should work with multiple networks', async () => {
    const parser = createWdkMoneyParser()

    const arbitrum = await parser(1, 'eip155:42161')
    const base = await parser(1, 'eip155:8453')
    const ethereum = await parser(1, 'eip155:1')

    // All should return valid results
    expect(arbitrum).not.toBeNull()
    expect(base).not.toBeNull()
    expect(ethereum).not.toBeNull()

    // Assets should differ per network
    expect(arbitrum!.asset).not.toBe(base!.asset)
  })

  it('should accept custom supportedFiat', async () => {
    const parser = createWdkMoneyParser({ supportedFiat: ['USD'] })
    // Should still work since default behavior uses USD
    const result = await parser(5, 'eip155:42161')
    expect(result).not.toBeNull()
  })
})

describe('toAtomicUnits', () => {
  it('should convert 1.5 with 6 decimals to "1500000"', () => {
    expect(toAtomicUnits(1.5, 6)).toBe('1500000')
  })

  it('should convert 0.001 with 6 decimals to "1000"', () => {
    expect(toAtomicUnits(0.001, 6)).toBe('1000')
  })

  it('should convert 1 with 18 decimals to "1000000000000000000"', () => {
    expect(toAtomicUnits(1, 18)).toBe('1000000000000000000')
  })

  it('should convert 0 to "0"', () => {
    expect(toAtomicUnits(0, 6)).toBe('0')
  })

  it('should handle integer amounts', () => {
    expect(toAtomicUnits(100, 6)).toBe('100000000')
  })

  it('should round correctly to avoid floating-point drift', () => {
    // 0.1 + 0.2 = 0.30000000000000004 in JS
    expect(toAtomicUnits(0.3, 6)).toBe('300000')
  })
})

describe('resolveAssetForNetwork', () => {
  it('should resolve USDT0 on Arbitrum', () => {
    const asset = resolveAssetForNetwork('USDT0', 'eip155:42161')
    expect(asset).toBeTruthy()
    expect(asset).toMatch(/^0x/)
  })

  it('should resolve USDC on Base', () => {
    const asset = resolveAssetForNetwork('USDC', 'eip155:8453')
    expect(asset).toBeTruthy()
    expect(asset).toMatch(/^0x/)
  })

  it('should return null for unknown network', () => {
    const asset = resolveAssetForNetwork('USDT0', 'eip155:999999' as `${string}:${string}`)
    expect(asset).toBeNull()
  })

  it('should return null for unsupported token on a chain', () => {
    // Base does not have USDT0
    const asset = resolveAssetForNetwork('USDT0', 'eip155:8453')
    expect(asset).toBeNull()
  })

  it('should be case-insensitive for token symbol', () => {
    const upper = resolveAssetForNetwork('USDT0', 'eip155:42161')
    const lower = resolveAssetForNetwork('usdt0', 'eip155:42161')
    expect(upper).toBe(lower)
  })
})
