import { describe, it, expect, beforeEach } from 'vitest'
import { ComplianceManager, BlacklistProvider, AmountLimitProvider } from '../../src/compliance'
import type {
  ComplianceCheckParams,
  ComplianceProvider,
  ComplianceResult,
} from '../../src/compliance'

const baseParams: ComplianceCheckParams = {
  from: '0xSender1234567890',
  to: '0xRecipient1234567890',
  chain: 'eip155:42161',
  amount: 1000000n,
  asset: 'USDT0',
}

describe('ComplianceManager', () => {
  let manager: ComplianceManager

  beforeEach(() => {
    manager = new ComplianceManager()
  })

  it('should allow when no providers registered', async () => {
    const result = await manager.check(baseParams)
    expect(result.allowed).toBe(true)
  })

  it('should allow when all providers allow', async () => {
    const allowProvider: ComplianceProvider = {
      check: async () => ({ allowed: true }),
    }
    manager.registerProvider(allowProvider)
    manager.registerProvider(allowProvider)

    const result = await manager.check(baseParams)
    expect(result.allowed).toBe(true)
  })

  it('should block when any provider blocks', async () => {
    const allowProvider: ComplianceProvider = {
      check: async () => ({ allowed: true }),
    }
    const blockProvider: ComplianceProvider = {
      check: async () => ({ allowed: false, reason: 'Blocked by policy' }),
    }

    manager.registerProvider(allowProvider)
    manager.registerProvider(blockProvider)

    const result = await manager.check(baseParams)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('Blocked by policy')
  })

  it('should short-circuit on first rejection', async () => {
    let secondCalled = false

    const blockProvider: ComplianceProvider = {
      check: async () => ({ allowed: false, reason: 'First block' }),
    }
    const secondProvider: ComplianceProvider = {
      check: async () => {
        secondCalled = true
        return { allowed: true }
      },
    }

    manager.registerProvider(blockProvider)
    manager.registerProvider(secondProvider)

    await manager.check(baseParams)
    expect(secondCalled).toBe(false)
  })

  it('should record audit trail', async () => {
    manager.registerProvider({
      check: async () => ({ allowed: true }),
    })

    await manager.check(baseParams, 'payment')
    await manager.check(baseParams, 'bridge')

    const trail = manager.getAuditTrail()
    expect(trail).toHaveLength(2)
    expect(trail[0].action).toBe('payment')
    expect(trail[0].result.allowed).toBe(true)
    expect(trail[1].action).toBe('bridge')
    expect(trail[0].timestamp).toBeLessThanOrEqual(trail[1].timestamp)
  })

  it('should record audit trail for rejected checks', async () => {
    manager.registerProvider({
      check: async () => ({ allowed: false, reason: 'Nope' }),
    })

    await manager.check(baseParams)

    const trail = manager.getAuditTrail()
    expect(trail).toHaveLength(1)
    expect(trail[0].result.allowed).toBe(false)
    expect(trail[0].result.reason).toBe('Nope')
  })

  it('should clear audit trail', async () => {
    manager.registerProvider({ check: async () => ({ allowed: true }) })
    await manager.check(baseParams)

    manager.clearAuditTrail()
    expect(manager.getAuditTrail()).toHaveLength(0)
  })

  it('should return immutable copy of audit trail', async () => {
    manager.registerProvider({ check: async () => ({ allowed: true }) })
    await manager.check(baseParams)

    const trail = manager.getAuditTrail()
    trail.push({
      timestamp: 0,
      action: 'swap',
      params: baseParams,
      result: { allowed: true },
    })

    expect(manager.getAuditTrail()).toHaveLength(1)
  })

  it('should report provider count', () => {
    expect(manager.providerCount).toBe(0)
    manager.registerProvider({ check: async () => ({ allowed: true }) })
    expect(manager.providerCount).toBe(1)
  })

  it('should default action to payment', async () => {
    manager.registerProvider({ check: async () => ({ allowed: true }) })
    await manager.check(baseParams)

    const trail = manager.getAuditTrail()
    expect(trail[0].action).toBe('payment')
  })
})

describe('BlacklistProvider', () => {
  it('should allow non-blacklisted addresses', async () => {
    const provider = new BlacklistProvider(new Set(['0xbad']))
    const result = await provider.check(baseParams)
    expect(result.allowed).toBe(true)
  })

  it('should block blacklisted sender', async () => {
    const provider = new BlacklistProvider(new Set([baseParams.from]))
    const result = await provider.check(baseParams)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('blacklisted (sender)')
  })

  it('should block blacklisted recipient', async () => {
    const provider = new BlacklistProvider(new Set([baseParams.to]))
    const result = await provider.check(baseParams)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('blacklisted (recipient)')
  })

  it('should be case-insensitive', async () => {
    const provider = new BlacklistProvider(new Set(['0xABCDEF']))
    const result = await provider.check({
      ...baseParams,
      from: '0xabcdef',
    })
    expect(result.allowed).toBe(false)
  })

  it('should support adding addresses', async () => {
    const provider = new BlacklistProvider()
    expect(provider.size).toBe(0)

    provider.addAddress(baseParams.from)
    expect(provider.hasAddress(baseParams.from)).toBe(true)
    expect(provider.size).toBe(1)

    const result = await provider.check(baseParams)
    expect(result.allowed).toBe(false)
  })

  it('should support removing addresses', async () => {
    const provider = new BlacklistProvider(new Set([baseParams.from]))
    provider.removeAddress(baseParams.from)

    const result = await provider.check(baseParams)
    expect(result.allowed).toBe(true)
    expect(provider.size).toBe(0)
  })

  it('should work with empty constructor', async () => {
    const provider = new BlacklistProvider()
    const result = await provider.check(baseParams)
    expect(result.allowed).toBe(true)
  })
})

describe('AmountLimitProvider', () => {
  it('should allow amounts within limit', async () => {
    const provider = new AmountLimitProvider(2000000n)
    const result = await provider.check(baseParams)
    expect(result.allowed).toBe(true)
  })

  it('should block amounts exceeding per-transaction limit', async () => {
    const provider = new AmountLimitProvider(500000n)
    const result = await provider.check(baseParams)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('exceeds per-transaction limit')
  })

  it('should block when cumulative limit exceeded', async () => {
    const provider = new AmountLimitProvider(1000000n, 2500000n)

    // First two should pass
    const result1 = await provider.check(baseParams)
    expect(result1.allowed).toBe(true)

    const result2 = await provider.check(baseParams)
    expect(result2.allowed).toBe(true)

    // Third should fail (cumulative: 3000000 > 2500000)
    const result3 = await provider.check(baseParams)
    expect(result3.allowed).toBe(false)
    expect(result3.reason).toContain('Cumulative amount')
  })

  it('should track cumulative per address', async () => {
    const provider = new AmountLimitProvider(1000000n, 1500000n)

    // First sender
    const result1 = await provider.check(baseParams)
    expect(result1.allowed).toBe(true)

    // Different sender should have separate tracking
    const result2 = await provider.check({
      ...baseParams,
      from: '0xOtherSender',
    })
    expect(result2.allowed).toBe(true)

    // First sender's second payment exceeds cumulative
    const result3 = await provider.check(baseParams)
    expect(result3.allowed).toBe(false)
  })

  it('should reset cumulative for an address', async () => {
    const provider = new AmountLimitProvider(1000000n, 1500000n)

    await provider.check(baseParams)
    provider.resetCumulative(baseParams.from)

    // Should allow again after reset
    const result = await provider.check(baseParams)
    expect(result.allowed).toBe(true)
  })

  it('should reset all cumulative tracking', async () => {
    const provider = new AmountLimitProvider(1000000n, 1500000n)

    await provider.check(baseParams)
    await provider.check({ ...baseParams, from: '0xOther' })
    provider.resetAllCumulative()

    // Both should allow again
    const result1 = await provider.check(baseParams)
    const result2 = await provider.check({ ...baseParams, from: '0xOther' })
    expect(result1.allowed).toBe(true)
    expect(result2.allowed).toBe(true)
  })
})
