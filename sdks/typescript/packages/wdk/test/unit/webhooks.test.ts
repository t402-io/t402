import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { WebhookManager } from '../../src/webhooks'
import type { WebhookConfig } from '../../src/webhooks'

describe('WebhookManager', () => {
  let manager: WebhookManager

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('signPayload', () => {
    it('should produce consistent signatures for same payload and secret', () => {
      manager = new WebhookManager([])
      const sig1 = manager.signPayload('test-data', 'secret-key')
      const sig2 = manager.signPayload('test-data', 'secret-key')
      expect(sig1).toBe(sig2)
    })

    it('should produce different signatures for different payloads', () => {
      manager = new WebhookManager([])
      const sig1 = manager.signPayload('data-a', 'secret-key')
      const sig2 = manager.signPayload('data-b', 'secret-key')
      expect(sig1).not.toBe(sig2)
    })

    it('should produce different signatures for different secrets', () => {
      manager = new WebhookManager([])
      const sig1 = manager.signPayload('test-data', 'secret-1')
      const sig2 = manager.signPayload('test-data', 'secret-2')
      expect(sig1).not.toBe(sig2)
    })

    it('should JSON.stringify objects', () => {
      manager = new WebhookManager([])
      const sig1 = manager.signPayload({ foo: 'bar' }, 'secret')
      const sig2 = manager.signPayload('{"foo":"bar"}', 'secret')
      expect(sig1).toBe(sig2)
    })
  })

  describe('verifySignature', () => {
    it('should return true for valid signature', () => {
      manager = new WebhookManager([])
      const payload = '{"event":"test"}'
      const signature = manager.signPayload(payload, 'my-secret')
      expect(manager.verifySignature(payload, signature, 'my-secret')).toBe(true)
    })

    it('should return false for invalid signature', () => {
      manager = new WebhookManager([])
      const payload = '{"event":"test"}'
      expect(manager.verifySignature(payload, 'bad-signature', 'my-secret')).toBe(false)
    })

    it('should return false for wrong secret', () => {
      manager = new WebhookManager([])
      const payload = '{"event":"test"}'
      const signature = manager.signPayload(payload, 'correct-secret')
      expect(manager.verifySignature(payload, signature, 'wrong-secret')).toBe(false)
    })

    it('should return false for tampered payload', () => {
      manager = new WebhookManager([])
      const payload = '{"event":"test"}'
      const signature = manager.signPayload(payload, 'my-secret')
      expect(manager.verifySignature('{"event":"tampered"}', signature, 'my-secret')).toBe(false)
    })
  })

  describe('send', () => {
    it('should send to all matching endpoints', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })
      vi.stubGlobal('fetch', fetchMock)

      const configs: WebhookConfig[] = [
        { url: 'https://a.example.com/hook', secret: 'secret-a' },
        { url: 'https://b.example.com/hook', secret: 'secret-b' },
      ]
      manager = new WebhookManager(configs)

      const results = await manager.send('payment.completed', { amount: '100' })

      expect(results).toHaveLength(2)
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(true)
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('should filter by event subscription', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })
      vi.stubGlobal('fetch', fetchMock)

      const configs: WebhookConfig[] = [
        { url: 'https://a.example.com/hook', secret: 'secret-a', events: ['payment.completed'] },
        { url: 'https://b.example.com/hook', secret: 'secret-b', events: ['payment.failed'] },
      ]
      manager = new WebhookManager(configs)

      const results = await manager.send('payment.completed', { amount: '100' })

      expect(results).toHaveLength(1)
      expect(results[0].url).toBe('https://a.example.com/hook')
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('should send to all endpoints when events is empty', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })
      vi.stubGlobal('fetch', fetchMock)

      const configs: WebhookConfig[] = [
        { url: 'https://a.example.com/hook', secret: 'secret-a', events: [] },
      ]
      manager = new WebhookManager(configs)

      const results = await manager.send('payment.completed', {})
      // Empty events array means all events
      expect(results).toHaveLength(1)
    })

    it('should include signature in headers', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })
      vi.stubGlobal('fetch', fetchMock)

      manager = new WebhookManager([{ url: 'https://a.example.com/hook', secret: 'test-secret' }])

      await manager.send('payment.completed', { amount: '100' })

      const callArgs = fetchMock.mock.calls[0]
      expect(callArgs[1].headers['X-Webhook-Signature']).toBeTruthy()
      expect(callArgs[1].headers['X-Webhook-Event']).toBe('payment.completed')
      expect(callArgs[1].headers['Content-Type']).toBe('application/json')
    })

    it('should handle fetch failure with retries', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'))
      vi.stubGlobal('fetch', fetchMock)

      manager = new WebhookManager([
        { url: 'https://a.example.com/hook', secret: 'secret', retries: 1 },
      ])

      const results = await manager.send('payment.completed', {})

      expect(results).toHaveLength(1)
      expect(results[0].success).toBe(false)
      expect(results[0].error).toContain('Network error')
      expect(results[0].attempts).toBe(1)
    })

    it('should not retry on 4xx errors', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      })
      vi.stubGlobal('fetch', fetchMock)

      manager = new WebhookManager([
        { url: 'https://a.example.com/hook', secret: 'secret', retries: 3 },
      ])

      const results = await manager.send('payment.completed', {})

      expect(results[0].success).toBe(false)
      expect(results[0].statusCode).toBe(404)
      expect(results[0].attempts).toBe(1)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('should retry on 5xx errors', async () => {
      let callCount = 0
      const fetchMock = vi.fn().mockImplementation(async () => {
        callCount++
        if (callCount < 3) {
          return { ok: false, status: 500 }
        }
        return { ok: true, status: 200 }
      })
      vi.stubGlobal('fetch', fetchMock)

      manager = new WebhookManager([
        { url: 'https://a.example.com/hook', secret: 'secret', retries: 3 },
      ])

      const results = await manager.send('payment.completed', {})

      expect(results[0].success).toBe(true)
      expect(results[0].attempts).toBe(3)
    })
  })

  describe('delivery history', () => {
    it('should track delivery results', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })
      vi.stubGlobal('fetch', fetchMock)

      manager = new WebhookManager([{ url: 'https://a.example.com/hook', secret: 'secret' }])

      await manager.send('payment.completed', {})

      const history = manager.getDeliveryResults()
      expect(history).toHaveLength(1)
      expect(history[0].success).toBe(true)
    })

    it('should limit delivery history size', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })
      vi.stubGlobal('fetch', fetchMock)

      manager = new WebhookManager(
        [{ url: 'https://a.example.com/hook', secret: 'secret' }],
        3, // max 3 history entries
      )

      for (let i = 0; i < 5; i++) {
        await manager.send('payment.completed', { i })
      }

      expect(manager.getDeliveryResults()).toHaveLength(3)
    })

    it('should clear delivery history', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })
      vi.stubGlobal('fetch', fetchMock)

      manager = new WebhookManager([{ url: 'https://a.example.com/hook', secret: 'secret' }])

      await manager.send('payment.completed', {})
      manager.clearDeliveryResults()

      expect(manager.getDeliveryResults()).toHaveLength(0)
    })

    it('should return immutable copy of delivery results', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })
      vi.stubGlobal('fetch', fetchMock)

      manager = new WebhookManager([{ url: 'https://a.example.com/hook', secret: 'secret' }])

      await manager.send('payment.completed', {})

      const results = manager.getDeliveryResults()
      results.push({ url: 'fake', success: false, attempts: 0 })

      expect(manager.getDeliveryResults()).toHaveLength(1)
    })
  })

  it('should report endpoint count', () => {
    manager = new WebhookManager([
      { url: 'https://a.example.com', secret: 'a' },
      { url: 'https://b.example.com', secret: 'b' },
    ])
    expect(manager.endpointCount).toBe(2)
  })
})
