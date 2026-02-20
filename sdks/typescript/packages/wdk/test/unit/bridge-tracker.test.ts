import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BridgeTracker, mapLayerZeroStatus } from '../../src/bridge-tracker'

describe('BridgeTracker', () => {
  let tracker: BridgeTracker
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    tracker = new BridgeTracker({ apiBaseUrl: 'https://test-api.example.com/v1' })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getStatus', () => {
    it('should return DELIVERED status with dstTxHash', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messages: [{ status: 'DELIVERED', dstTxHash: '0xdst123' }],
        }),
      })

      const result = await tracker.getStatus('0xabc')
      expect(result.status).toBe('DELIVERED')
      expect(result.dstTxHash).toBe('0xdst123')
      expect(fetchMock).toHaveBeenCalledWith('https://test-api.example.com/v1/messages/tx/0xabc')
    })

    it('should return INFLIGHT for 404 response', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 404 })
      const result = await tracker.getStatus('0x123')
      expect(result.status).toBe('INFLIGHT')
    })

    it('should throw for non-404 error responses', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 500 })
      await expect(tracker.getStatus('0x123')).rejects.toThrow('LayerZero API error: 500')
    })

    it('should return FAILED status', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [{ status: 'FAILED' }] }),
      })
      const result = await tracker.getStatus('0x123')
      expect(result.status).toBe('FAILED')
    })

    it('should return BLOCKED status', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [{ status: 'BLOCKED' }] }),
      })
      const result = await tracker.getStatus('0x123')
      expect(result.status).toBe('BLOCKED')
    })

    it('should return CONFIRMING status', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [{ status: 'CONFIRMING' }] }),
      })
      const result = await tracker.getStatus('0x123')
      expect(result.status).toBe('CONFIRMING')
    })

    it('should use default API URL if no config provided', async () => {
      const defaultTracker = new BridgeTracker()
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [{ status: 'DELIVERED' }] }),
      })
      await defaultTracker.getStatus('0xabc')
      expect(fetchMock).toHaveBeenCalledWith('https://scan.layerzero-api.com/v1/messages/tx/0xabc')
    })
  })

  describe('waitForDelivery', () => {
    it('should return immediately when status is DELIVERED', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [{ status: 'DELIVERED', dstTxHash: '0xdst' }] }),
      })

      const result = await tracker.waitForDelivery('0xsrc', { pollInterval: 10, timeout: 1000 })
      expect(result.success).toBe(true)
      expect(result.status).toBe('DELIVERED')
      expect(result.dstTxHash).toBe('0xdst')
      expect(result.srcTxHash).toBe('0xsrc')
    })

    it('should return failure when status is FAILED', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [{ status: 'FAILED' }] }),
      })

      const result = await tracker.waitForDelivery('0xsrc', { pollInterval: 10, timeout: 1000 })
      expect(result.success).toBe(false)
      expect(result.status).toBe('FAILED')
      expect(result.error).toBe('Bridge failed')
    })

    it('should return failure when status is BLOCKED', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [{ status: 'BLOCKED' }] }),
      })

      const result = await tracker.waitForDelivery('0xsrc', { pollInterval: 10, timeout: 1000 })
      expect(result.success).toBe(false)
      expect(result.status).toBe('BLOCKED')
      expect(result.error).toBe('Bridge blocked')
    })

    it('should poll until delivered', async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ messages: [{ status: 'INFLIGHT' }] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ messages: [{ status: 'CONFIRMING' }] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ messages: [{ status: 'DELIVERED', dstTxHash: '0xfinal' }] }),
        })

      const statuses: string[] = []
      const result = await tracker.waitForDelivery('0xsrc', {
        pollInterval: 10,
        timeout: 5000,
        onStatusChange: (s) => statuses.push(s),
      })

      expect(result.success).toBe(true)
      expect(result.dstTxHash).toBe('0xfinal')
      expect(statuses).toEqual(['INFLIGHT', 'CONFIRMING', 'DELIVERED'])
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it('should timeout and return failure', async () => {
      // Always return INFLIGHT
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ messages: [{ status: 'INFLIGHT' }] }),
      })

      const result = await tracker.waitForDelivery('0xsrc', {
        pollInterval: 10,
        timeout: 50,
      })

      expect(result.success).toBe(false)
      expect(result.status).toBe('INFLIGHT')
      expect(result.error).toBe('Timeout waiting for delivery')
    })
  })

  describe('mapLayerZeroStatus', () => {
    it('should map DESTINATION_FINALIZED to DELIVERED', () => {
      const result = mapLayerZeroStatus({
        messages: [{ status: 'DESTINATION_FINALIZED', dstTxHash: '0xdst' }],
      })
      expect(result.status).toBe('DELIVERED')
      expect(result.dstTxHash).toBe('0xdst')
    })

    it('should handle data field instead of messages', () => {
      const result = mapLayerZeroStatus({
        data: [{ status: 'DELIVERED', dstTxHash: '0xd' }],
      })
      expect(result.status).toBe('DELIVERED')
    })

    it('should handle msgStatus field instead of status', () => {
      const result = mapLayerZeroStatus({
        messages: [{ msgStatus: 'FAILED' }],
      })
      expect(result.status).toBe('FAILED')
    })

    it('should return INFLIGHT for null/empty data', () => {
      expect(mapLayerZeroStatus(null).status).toBe('INFLIGHT')
      expect(mapLayerZeroStatus({}).status).toBe('INFLIGHT')
      expect(mapLayerZeroStatus({ messages: [] }).status).toBe('INFLIGHT')
    })

    it('should handle non-array messages field (single object)', () => {
      const result = mapLayerZeroStatus({
        messages: { status: 'BLOCKED' },
      })
      expect(result.status).toBe('BLOCKED')
    })
  })
})
