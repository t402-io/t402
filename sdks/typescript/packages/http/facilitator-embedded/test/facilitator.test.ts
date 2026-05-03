import { describe, it, expect, vi } from 'vitest'
import { EmbeddedFacilitator } from '../src/facilitator'
import type { SchemeHandler } from '../src/types'
import type { PaymentPayload, PaymentRequirements, Network } from '@t402/core/types'

/**
 *
 * @param overrides
 */
function makePayload(overrides: Partial<PaymentPayload> = {}): PaymentPayload {
  return {
    t402Version: 2,
    accepted: {
      scheme: 'exact',
      network: 'eip155:8453' as Network,
      asset: '0xUSDC',
      amount: '100000',
      payTo: '0xRecipient',
      maxTimeoutSeconds: 60,
      extra: {},
    },
    payload: { signature: '0xabc' },
    ...overrides,
  }
}

/**
 *
 * @param overrides
 */
function makeRequirements(overrides: Partial<PaymentRequirements> = {}): PaymentRequirements {
  return {
    scheme: 'exact',
    network: 'eip155:8453' as Network,
    asset: '0xUSDC',
    amount: '100000',
    payTo: '0xRecipient',
    maxTimeoutSeconds: 60,
    extra: {},
    ...overrides,
  }
}

/**
 *
 * @param verifyResult
 * @param settleResult
 */
function createMockHandler(
  verifyResult = { isValid: true, payer: '0xPayer' },
  settleResult = {
    success: true,
    transaction: '0xtx123',
    network: 'eip155:8453' as Network,
    payer: '0xPayer',
  },
): SchemeHandler {
  return {
    verify: vi.fn().mockResolvedValue(verifyResult),
    settle: vi.fn().mockResolvedValue(settleResult),
  }
}

describe('EmbeddedFacilitator', () => {
  describe('constructor', () => {
    it('should create an instance with empty schemes', () => {
      const facilitator = new EmbeddedFacilitator({ schemes: new Map() })
      expect(facilitator.supported().kinds).toEqual([])
    })

    it('should create an instance with provided schemes', () => {
      const handler = createMockHandler()
      const schemes = new Map([['exact:eip155:8453', handler]])
      const facilitator = new EmbeddedFacilitator({ schemes })
      expect(facilitator.supported().kinds).toEqual(['exact:eip155:8453'])
    })

    it('should accept an optional API key', () => {
      const facilitator = new EmbeddedFacilitator({
        schemes: new Map(),
        apiKey: 'test-key',
      })
      expect(facilitator.validateApiKey('test-key')).toBe(true)
      expect(facilitator.validateApiKey('wrong-key')).toBe(false)
    })
  })

  describe('verify', () => {
    it('should route to the correct handler by exact match', async () => {
      const handler = createMockHandler()
      const schemes = new Map([['exact:eip155:8453', handler]])
      const facilitator = new EmbeddedFacilitator({ schemes })

      const result = await facilitator.verify(makePayload(), makeRequirements())

      expect(result.isValid).toBe(true)
      expect(result.payer).toBe('0xPayer')
      expect(handler.verify).toHaveBeenCalledOnce()
    })

    it('should route to wildcard handler when exact match not found', async () => {
      const handler = createMockHandler()
      const schemes = new Map([['exact:eip155:*', handler]])
      const facilitator = new EmbeddedFacilitator({ schemes })

      const result = await facilitator.verify(makePayload(), makeRequirements())

      expect(result.isValid).toBe(true)
      expect(handler.verify).toHaveBeenCalledOnce()
    })

    it('should prefer exact match over wildcard', async () => {
      const exactHandler = createMockHandler({ isValid: true, payer: '0xExact' })
      const wildcardHandler = createMockHandler({ isValid: true, payer: '0xWildcard' })
      const schemes = new Map<string, SchemeHandler>([
        ['exact:eip155:8453', exactHandler],
        ['exact:eip155:*', wildcardHandler],
      ])
      const facilitator = new EmbeddedFacilitator({ schemes })

      const result = await facilitator.verify(makePayload(), makeRequirements())

      expect(result.payer).toBe('0xExact')
      expect(exactHandler.verify).toHaveBeenCalledOnce()
      expect(wildcardHandler.verify).not.toHaveBeenCalled()
    })

    it('should return invalid when no handler matches', async () => {
      const facilitator = new EmbeddedFacilitator({ schemes: new Map() })

      const result = await facilitator.verify(makePayload(), makeRequirements())

      expect(result.isValid).toBe(false)
      expect(result.invalidReason).toContain('No handler registered')
      expect(result.invalidReason).toContain('exact')
      expect(result.invalidReason).toContain('eip155:8453')
    })

    it('should pass payload and requirements to the handler', async () => {
      const handler = createMockHandler()
      const schemes = new Map([['exact:eip155:8453', handler]])
      const facilitator = new EmbeddedFacilitator({ schemes })

      const payload = makePayload()
      const requirements = makeRequirements()
      await facilitator.verify(payload, requirements)

      expect(handler.verify).toHaveBeenCalledWith(payload, requirements)
    })

    it('should handle different schemes separately', async () => {
      const exactHandler = createMockHandler({ isValid: true, payer: '0xExact' })
      const uptoHandler = createMockHandler({ isValid: true, payer: '0xUpto' })
      const schemes = new Map<string, SchemeHandler>([
        ['exact:eip155:8453', exactHandler],
        ['upto:eip155:8453', uptoHandler],
      ])
      const facilitator = new EmbeddedFacilitator({ schemes })

      const uptoReqs = makeRequirements({ scheme: 'upto' })
      const uptoPayload = makePayload({
        accepted: { ...makeRequirements(), scheme: 'upto' },
      })
      const result = await facilitator.verify(uptoPayload, uptoReqs)

      expect(result.payer).toBe('0xUpto')
      expect(uptoHandler.verify).toHaveBeenCalledOnce()
      expect(exactHandler.verify).not.toHaveBeenCalled()
    })

    it('should handle different networks separately', async () => {
      const baseHandler = createMockHandler({ isValid: true, payer: '0xBase' })
      const mainnetHandler = createMockHandler({ isValid: true, payer: '0xMainnet' })
      const schemes = new Map<string, SchemeHandler>([
        ['exact:eip155:8453', baseHandler],
        ['exact:eip155:1', mainnetHandler],
      ])
      const facilitator = new EmbeddedFacilitator({ schemes })

      const mainnetReqs = makeRequirements({ network: 'eip155:1' as Network })
      const mainnetPayload = makePayload({
        accepted: { ...makeRequirements(), network: 'eip155:1' as Network },
      })
      const result = await facilitator.verify(mainnetPayload, mainnetReqs)

      expect(result.payer).toBe('0xMainnet')
      expect(mainnetHandler.verify).toHaveBeenCalledOnce()
      expect(baseHandler.verify).not.toHaveBeenCalled()
    })
  })

  describe('settle', () => {
    it('should route to the correct handler by exact match', async () => {
      const handler = createMockHandler()
      const schemes = new Map([['exact:eip155:8453', handler]])
      const facilitator = new EmbeddedFacilitator({ schemes })

      const result = await facilitator.settle(makePayload(), makeRequirements())

      expect(result.success).toBe(true)
      expect(result.transaction).toBe('0xtx123')
      expect(handler.settle).toHaveBeenCalledOnce()
    })

    it('should route to wildcard handler for settle', async () => {
      const handler = createMockHandler()
      const schemes = new Map([['exact:eip155:*', handler]])
      const facilitator = new EmbeddedFacilitator({ schemes })

      const result = await facilitator.settle(makePayload(), makeRequirements())

      expect(result.success).toBe(true)
      expect(handler.settle).toHaveBeenCalledOnce()
    })

    it('should return failure when no handler matches for settle', async () => {
      const facilitator = new EmbeddedFacilitator({ schemes: new Map() })

      const result = await facilitator.settle(makePayload(), makeRequirements())

      expect(result.success).toBe(false)
      expect(result.errorReason).toContain('No handler registered')
      expect(result.transaction).toBe('')
    })
  })

  describe('supported', () => {
    it('should return all registered kinds', () => {
      const handler = createMockHandler()
      const schemes = new Map<string, SchemeHandler>([
        ['exact:eip155:8453', handler],
        ['exact:eip155:1', handler],
        ['upto:solana:mainnet', handler],
      ])
      const facilitator = new EmbeddedFacilitator({ schemes })

      const result = facilitator.supported()
      expect(result.kinds).toHaveLength(3)
      expect(result.kinds).toContain('exact:eip155:8453')
      expect(result.kinds).toContain('exact:eip155:1')
      expect(result.kinds).toContain('upto:solana:mainnet')
    })
  })

  describe('register', () => {
    it('should add a new handler at runtime', async () => {
      const facilitator = new EmbeddedFacilitator({ schemes: new Map() })
      expect(facilitator.supported().kinds).toHaveLength(0)

      const handler = createMockHandler()
      facilitator.register('exact:eip155:8453', handler)

      expect(facilitator.supported().kinds).toHaveLength(1)
      const result = await facilitator.verify(makePayload(), makeRequirements())
      expect(result.isValid).toBe(true)
    })

    it('should override an existing handler', async () => {
      const oldHandler = createMockHandler({ isValid: true, payer: '0xOld' })
      const newHandler = createMockHandler({ isValid: true, payer: '0xNew' })
      const schemes = new Map([['exact:eip155:8453', oldHandler]])
      const facilitator = new EmbeddedFacilitator({ schemes })

      facilitator.register('exact:eip155:8453', newHandler)
      const result = await facilitator.verify(makePayload(), makeRequirements())

      expect(result.payer).toBe('0xNew')
      expect(newHandler.verify).toHaveBeenCalledOnce()
      expect(oldHandler.verify).not.toHaveBeenCalled()
    })
  })

  describe('unregister', () => {
    it('should remove a handler', () => {
      const handler = createMockHandler()
      const schemes = new Map([['exact:eip155:8453', handler]])
      const facilitator = new EmbeddedFacilitator({ schemes })

      const removed = facilitator.unregister('exact:eip155:8453')
      expect(removed).toBe(true)
      expect(facilitator.supported().kinds).toHaveLength(0)
    })

    it('should return false when removing non-existent handler', () => {
      const facilitator = new EmbeddedFacilitator({ schemes: new Map() })
      expect(facilitator.unregister('exact:eip155:8453')).toBe(false)
    })
  })

  describe('validateApiKey', () => {
    it('should return true when no API key is configured', () => {
      const facilitator = new EmbeddedFacilitator({ schemes: new Map() })
      expect(facilitator.validateApiKey(undefined)).toBe(true)
      expect(facilitator.validateApiKey('anything')).toBe(true)
    })

    it('should return true for matching API key', () => {
      const facilitator = new EmbeddedFacilitator({
        schemes: new Map(),
        apiKey: 'secret-key',
      })
      expect(facilitator.validateApiKey('secret-key')).toBe(true)
    })

    it('should return false for non-matching API key', () => {
      const facilitator = new EmbeddedFacilitator({
        schemes: new Map(),
        apiKey: 'secret-key',
      })
      expect(facilitator.validateApiKey('wrong-key')).toBe(false)
      expect(facilitator.validateApiKey(undefined)).toBe(false)
    })
  })
})
