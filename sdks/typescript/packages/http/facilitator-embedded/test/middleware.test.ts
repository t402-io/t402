import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EmbeddedFacilitator } from '../src/facilitator'
import { PaymentLifecycleEmitter } from '../src/lifecycle'
import { createEmbeddedPaymentMiddleware } from '../src/middleware'
import type { SchemeHandler, GenericRequest, GenericResponse, NextFunction } from '../src/types'
import type { PaymentPayload, PaymentRequirements, Network } from '@t402/core/types'

const TEST_REQUIREMENTS: PaymentRequirements = {
  scheme: 'exact',
  network: 'eip155:8453' as Network,
  asset: '0xUSDC',
  amount: '100000',
  payTo: '0xRecipient',
  maxTimeoutSeconds: 60,
  extra: {},
}

const TEST_PAYLOAD: PaymentPayload = {
  t402Version: 2,
  accepted: TEST_REQUIREMENTS,
  payload: { signature: '0xabc' },
}

/**
 *
 * @param overrides
 */
function createMockReq(overrides: Partial<GenericRequest> = {}): GenericRequest {
  return {
    path: '/api/resource',
    method: 'GET',
    header: vi.fn().mockReturnValue(undefined),
    body: undefined,
    ...overrides,
  }
}

/**
 *
 */
function createMockRes(): GenericResponse & {
  statusCode: number
  headers: Record<string, string>
  body: unknown
} {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    status: vi.fn().mockImplementation((code: number) => {
      res.statusCode = code
      return res
    }),
    json: vi.fn().mockImplementation((body: unknown) => {
      res.body = body
      return res
    }),
    setHeader: vi.fn().mockImplementation((name: string, value: string) => {
      res.headers[name] = value
      return res
    }),
  }
  return res
}

/**
 *
 */
function createSuccessHandler(): SchemeHandler {
  return {
    verify: vi.fn().mockResolvedValue({ isValid: true, payer: '0xPayer' }),
    settle: vi.fn().mockResolvedValue({
      success: true,
      transaction: '0xtx123',
      network: 'eip155:8453' as Network,
      payer: '0xPayer',
    }),
  }
}

describe('createEmbeddedPaymentMiddleware', () => {
  let facilitator: EmbeddedFacilitator
  let handler: SchemeHandler

  beforeEach(() => {
    handler = createSuccessHandler()
    facilitator = new EmbeddedFacilitator({
      schemes: new Map([['exact:eip155:8453', handler]]),
    })
  })

  describe('route without payment requirements', () => {
    it('should call next() when no requirements for the route', async () => {
      const middleware = createEmbeddedPaymentMiddleware(facilitator, {
        extractPayload: () => null,
        getRequirements: () => null,
      })

      const req = createMockReq()
      const res = createMockRes()
      const next = vi.fn()

      await middleware(req, res, next)

      expect(next).toHaveBeenCalledOnce()
      expect(res.status).not.toHaveBeenCalled()
    })
  })

  describe('missing payment payload', () => {
    it('should return 402 when no payload provided for protected route', async () => {
      const middleware = createEmbeddedPaymentMiddleware(facilitator, {
        extractPayload: () => null,
        getRequirements: () => TEST_REQUIREMENTS,
      })

      const req = createMockReq()
      const res = createMockRes()
      const next = vi.fn()

      await middleware(req, res, next)

      expect(next).not.toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(402)
      expect(res.body).toEqual({
        error: 'Payment required',
        accepts: [TEST_REQUIREMENTS],
      })
    })
  })

  describe('successful payment flow', () => {
    it('should verify and settle, then call next()', async () => {
      const middleware = createEmbeddedPaymentMiddleware(facilitator, {
        extractPayload: () => TEST_PAYLOAD,
        getRequirements: () => TEST_REQUIREMENTS,
      })

      const req = createMockReq()
      const res = createMockRes()
      const next = vi.fn()

      await middleware(req, res, next)

      expect(handler.verify).toHaveBeenCalledWith(TEST_PAYLOAD, TEST_REQUIREMENTS)
      expect(handler.settle).toHaveBeenCalledWith(TEST_PAYLOAD, TEST_REQUIREMENTS)
      expect(next).toHaveBeenCalledOnce()
    })

    it('should set settlement headers on success', async () => {
      const middleware = createEmbeddedPaymentMiddleware(facilitator, {
        extractPayload: () => TEST_PAYLOAD,
        getRequirements: () => TEST_REQUIREMENTS,
      })

      const req = createMockReq()
      const res = createMockRes()
      const next = vi.fn()

      await middleware(req, res, next)

      expect(res.headers['X-Payment-Transaction']).toBe('0xtx123')
      expect(res.headers['X-Payment-Network']).toBe('eip155:8453')
      expect(res.headers['X-Payment-Payer']).toBe('0xPayer')
    })
  })

  describe('verification failure', () => {
    it('should return 402 when verification fails', async () => {
      const failHandler: SchemeHandler = {
        verify: vi.fn().mockResolvedValue({
          isValid: false,
          invalidReason: 'Invalid signature',
        }),
        settle: vi.fn(),
      }
      const failFacilitator = new EmbeddedFacilitator({
        schemes: new Map([['exact:eip155:8453', failHandler]]),
      })

      const middleware = createEmbeddedPaymentMiddleware(failFacilitator, {
        extractPayload: () => TEST_PAYLOAD,
        getRequirements: () => TEST_REQUIREMENTS,
      })

      const req = createMockReq()
      const res = createMockRes()
      const next = vi.fn()

      await middleware(req, res, next)

      expect(next).not.toHaveBeenCalled()
      expect(res.statusCode).toBe(402)
      expect(res.body).toEqual({
        error: 'Payment verification failed',
        reason: 'Invalid signature',
      })
      expect(failHandler.settle).not.toHaveBeenCalled()
    })
  })

  describe('settlement failure', () => {
    it('should return 402 when settlement fails', async () => {
      const failHandler: SchemeHandler = {
        verify: vi.fn().mockResolvedValue({ isValid: true, payer: '0xPayer' }),
        settle: vi.fn().mockResolvedValue({
          success: false,
          errorReason: 'Insufficient gas',
          transaction: '',
          network: 'eip155:8453' as Network,
        }),
      }
      const failFacilitator = new EmbeddedFacilitator({
        schemes: new Map([['exact:eip155:8453', failHandler]]),
      })

      const middleware = createEmbeddedPaymentMiddleware(failFacilitator, {
        extractPayload: () => TEST_PAYLOAD,
        getRequirements: () => TEST_REQUIREMENTS,
      })

      const req = createMockReq()
      const res = createMockRes()
      const next = vi.fn()

      await middleware(req, res, next)

      expect(next).not.toHaveBeenCalled()
      expect(res.statusCode).toBe(402)
      expect(res.body).toEqual({
        error: 'Payment settlement failed',
        reason: 'Insufficient gas',
      })
    })
  })

  describe('autoSettle option', () => {
    it('should skip settlement when autoSettle is false', async () => {
      const middleware = createEmbeddedPaymentMiddleware(facilitator, {
        extractPayload: () => TEST_PAYLOAD,
        getRequirements: () => TEST_REQUIREMENTS,
        autoSettle: false,
      })

      const req = createMockReq()
      const res = createMockRes()
      const next = vi.fn()

      await middleware(req, res, next)

      expect(handler.verify).toHaveBeenCalledOnce()
      expect(handler.settle).not.toHaveBeenCalled()
      expect(next).toHaveBeenCalledOnce()
    })
  })

  describe('lifecycle events', () => {
    it('should emit lifecycle events during successful flow', async () => {
      const lifecycle = new PaymentLifecycleEmitter()
      const allListener = vi.fn()
      lifecycle.onAll(allListener)

      const middleware = createEmbeddedPaymentMiddleware(facilitator, {
        extractPayload: () => TEST_PAYLOAD,
        getRequirements: () => TEST_REQUIREMENTS,
        lifecycle,
      })

      const req = createMockReq()
      const res = createMockRes()
      const next = vi.fn()

      await middleware(req, res, next)

      expect(allListener).toHaveBeenCalledTimes(5)
      const eventTypes = allListener.mock.calls.map((call: [{ type: string }]) => call[0].type)
      expect(eventTypes).toEqual([
        'payment.received',
        'payment.verifying',
        'payment.verified',
        'payment.settling',
        'payment.settled',
      ])
    })

    it('should emit failed event on verification failure', async () => {
      const failHandler: SchemeHandler = {
        verify: vi.fn().mockResolvedValue({
          isValid: false,
          invalidReason: 'Bad signature',
        }),
        settle: vi.fn(),
      }
      const failFacilitator = new EmbeddedFacilitator({
        schemes: new Map([['exact:eip155:8453', failHandler]]),
      })

      const lifecycle = new PaymentLifecycleEmitter()
      const allListener = vi.fn()
      lifecycle.onAll(allListener)

      const middleware = createEmbeddedPaymentMiddleware(failFacilitator, {
        extractPayload: () => TEST_PAYLOAD,
        getRequirements: () => TEST_REQUIREMENTS,
        lifecycle,
      })

      const req = createMockReq()
      const res = createMockRes()
      const next = vi.fn()

      await middleware(req, res, next)

      const eventTypes = allListener.mock.calls.map((call: [{ type: string }]) => call[0].type)
      expect(eventTypes).toEqual(['payment.received', 'payment.verifying', 'payment.failed'])

      const failedEvent = allListener.mock.calls[2][0]
      expect(failedEvent.error).toBe('Bad signature')
      expect(failedEvent.phase).toBe('verification')
    })

    it('should emit failed event on settlement failure', async () => {
      const failHandler: SchemeHandler = {
        verify: vi.fn().mockResolvedValue({ isValid: true }),
        settle: vi.fn().mockResolvedValue({
          success: false,
          errorReason: 'Out of gas',
          transaction: '',
          network: 'eip155:8453',
        }),
      }
      const failFacilitator = new EmbeddedFacilitator({
        schemes: new Map([['exact:eip155:8453', failHandler]]),
      })

      const lifecycle = new PaymentLifecycleEmitter()
      const allListener = vi.fn()
      lifecycle.onAll(allListener)

      const middleware = createEmbeddedPaymentMiddleware(failFacilitator, {
        extractPayload: () => TEST_PAYLOAD,
        getRequirements: () => TEST_REQUIREMENTS,
        lifecycle,
      })

      const req = createMockReq()
      const res = createMockRes()
      const next: NextFunction = vi.fn()

      await middleware(req, res, next)

      const eventTypes = allListener.mock.calls.map((call: [{ type: string }]) => call[0].type)
      expect(eventTypes).toEqual([
        'payment.received',
        'payment.verifying',
        'payment.verified',
        'payment.settling',
        'payment.failed',
      ])

      const failedEvent = allListener.mock.calls[4][0]
      expect(failedEvent.error).toBe('Out of gas')
      expect(failedEvent.phase).toBe('settlement')
    })

    it('should not emit events when lifecycle is not configured', async () => {
      const middleware = createEmbeddedPaymentMiddleware(facilitator, {
        extractPayload: () => TEST_PAYLOAD,
        getRequirements: () => TEST_REQUIREMENTS,
        // No lifecycle emitter
      })

      const req = createMockReq()
      const res = createMockRes()
      const next = vi.fn()

      // Should not throw
      await middleware(req, res, next)
      expect(next).toHaveBeenCalledOnce()
    })
  })

  describe('settlement headers without payer', () => {
    it('should not set X-Payment-Payer when payer is undefined', async () => {
      const noPayer: SchemeHandler = {
        verify: vi.fn().mockResolvedValue({ isValid: true }),
        settle: vi.fn().mockResolvedValue({
          success: true,
          transaction: '0xtx',
          network: 'eip155:8453' as Network,
        }),
      }
      const f = new EmbeddedFacilitator({
        schemes: new Map([['exact:eip155:8453', noPayer]]),
      })

      const middleware = createEmbeddedPaymentMiddleware(f, {
        extractPayload: () => TEST_PAYLOAD,
        getRequirements: () => TEST_REQUIREMENTS,
      })

      const req = createMockReq()
      const res = createMockRes()
      const next = vi.fn()

      await middleware(req, res, next)

      expect(res.headers['X-Payment-Transaction']).toBe('0xtx')
      expect(res.headers['X-Payment-Payer']).toBeUndefined()
    })
  })
})
