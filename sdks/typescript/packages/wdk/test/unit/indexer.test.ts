import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WdkIndexerVerifier, createIndexerVerifier } from '../../src/indexer.js'

// Mock global fetch
const mockFetch = vi.fn()

describe('WdkIndexerVerifier', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should create verifier with valid config', () => {
      const verifier = new WdkIndexerVerifier({
        endpoint: 'https://indexer.example.com',
      })
      expect(verifier).toBeInstanceOf(WdkIndexerVerifier)
    })

    it('should create verifier via factory', () => {
      const verifier = createIndexerVerifier({
        endpoint: 'https://indexer.example.com',
      })
      expect(verifier).toBeInstanceOf(WdkIndexerVerifier)
    })

    it('should throw when endpoint is missing', () => {
      expect(() => new WdkIndexerVerifier({ endpoint: '' })).toThrow(
        'Indexer endpoint is required',
      )
    })

    it('should normalize endpoint by removing trailing slash', () => {
      const verifier = new WdkIndexerVerifier({
        endpoint: 'https://indexer.example.com/',
      })
      // Verify by making a query and checking the URL
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          from: '0xsender',
          to: '0xrecipient',
          amount: '1000000',
          confirmed: true,
          token: '0xtoken',
        }),
      })

      verifier.queryTransaction({ txHash: '0xabc', network: 'eip155:42161' })
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://indexer.example.com/v1/transactions/'),
        expect.anything(),
      )
    })
  })

  describe('queryTransaction', () => {
    it('should query and return transaction result', async () => {
      const verifier = new WdkIndexerVerifier({
        endpoint: 'https://indexer.example.com',
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          from: '0xsender',
          to: '0xrecipient',
          amount: '1000000',
          confirmed: true,
          token: '0xUSDT0',
          blockNumber: 12345,
          timestamp: 1700000000,
        }),
      })

      const result = await verifier.queryTransaction({
        txHash: '0xabc123',
        network: 'eip155:42161',
      })

      expect(result.found).toBe(true)
      expect(result.confirmed).toBe(true)
      expect(result.from).toBe('0xsender')
      expect(result.to).toBe('0xrecipient')
      expect(result.amount).toBe('1000000')
      expect(result.token).toBe('0xUSDT0')
      expect(result.blockNumber).toBe(12345)
      expect(result.timestamp).toBe(1700000000)
    })

    it('should return not-found for 404', async () => {
      const verifier = new WdkIndexerVerifier({
        endpoint: 'https://indexer.example.com',
      })

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })

      const result = await verifier.queryTransaction({
        txHash: '0xnotfound',
        network: 'eip155:42161',
      })

      expect(result.found).toBe(false)
      expect(result.confirmed).toBe(false)
    })

    it('should throw on server error', async () => {
      const verifier = new WdkIndexerVerifier({
        endpoint: 'https://indexer.example.com',
      })

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })

      await expect(
        verifier.queryTransaction({ txHash: '0xabc', network: 'eip155:42161' }),
      ).rejects.toThrow('Indexer request failed: 500')
    })

    it('should throw on missing txHash', async () => {
      const verifier = new WdkIndexerVerifier({
        endpoint: 'https://indexer.example.com',
      })

      await expect(
        verifier.queryTransaction({ txHash: '', network: 'eip155:42161' }),
      ).rejects.toThrow('Transaction hash is required')
    })

    it('should throw on missing network', async () => {
      const verifier = new WdkIndexerVerifier({
        endpoint: 'https://indexer.example.com',
      })

      await expect(
        verifier.queryTransaction({ txHash: '0xabc', network: '' }),
      ).rejects.toThrow('Network is required')
    })

    it('should include API key in authorization header', async () => {
      const verifier = new WdkIndexerVerifier({
        endpoint: 'https://indexer.example.com',
        apiKey: 'test-key-123',
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          from: '0xsender',
          to: '0xrecipient',
          amount: '1000000',
          confirmed: true,
          token: '0xtoken',
        }),
      })

      await verifier.queryTransaction({ txHash: '0xabc', network: 'eip155:42161' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key-123',
          }),
        }),
      )
    })

    it('should handle alternative response field names', async () => {
      const verifier = new WdkIndexerVerifier({
        endpoint: 'https://indexer.example.com',
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          from: '0xsender',
          to: '0xrecipient',
          value: '2000000',
          status: 'confirmed',
          tokenAddress: '0xtoken',
          block_number: 99999,
          block_timestamp: 1700000001,
        }),
      })

      const result = await verifier.queryTransaction({
        txHash: '0xabc',
        network: 'eip155:1',
      })

      expect(result.found).toBe(true)
      expect(result.confirmed).toBe(true)
      expect(result.amount).toBe('2000000')
      expect(result.token).toBe('0xtoken')
      expect(result.blockNumber).toBe(99999)
      expect(result.timestamp).toBe(1700000001)
    })
  })

  describe('verifyPayment', () => {
    it('should verify successful payment', async () => {
      const verifier = new WdkIndexerVerifier({
        endpoint: 'https://indexer.example.com',
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          from: '0xsender',
          to: '0xRecipient',
          amount: '1000000',
          confirmed: true,
          token: '0xtoken',
        }),
      })

      const result = await verifier.verifyPayment({
        txHash: '0xabc',
        network: 'eip155:42161',
        expectedTo: '0xRecipient',
        expectedAmount: '1000000',
      })

      expect(result.verified).toBe(true)
      expect(result.reason).toBeUndefined()
    })

    it('should fail when transaction not found', async () => {
      const verifier = new WdkIndexerVerifier({
        endpoint: 'https://indexer.example.com',
      })

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })

      const result = await verifier.verifyPayment({
        txHash: '0xnotfound',
        network: 'eip155:42161',
      })

      expect(result.verified).toBe(false)
      expect(result.reason).toBe('Transaction not found')
    })

    it('should fail when not yet confirmed', async () => {
      const verifier = new WdkIndexerVerifier({
        endpoint: 'https://indexer.example.com',
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          from: '0xsender',
          to: '0xrecipient',
          amount: '1000000',
          confirmed: false,
          token: '0xtoken',
        }),
      })

      const result = await verifier.verifyPayment({
        txHash: '0xpending',
        network: 'eip155:42161',
      })

      expect(result.verified).toBe(false)
      expect(result.reason).toBe('Transaction not yet confirmed')
    })

    it('should fail on recipient mismatch', async () => {
      const verifier = new WdkIndexerVerifier({
        endpoint: 'https://indexer.example.com',
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          from: '0xsender',
          to: '0xwrongrecipient',
          amount: '1000000',
          confirmed: true,
          token: '0xtoken',
        }),
      })

      const result = await verifier.verifyPayment({
        txHash: '0xabc',
        network: 'eip155:42161',
        expectedTo: '0xExpectedRecipient',
      })

      expect(result.verified).toBe(false)
      expect(result.reason).toContain('Recipient mismatch')
    })

    it('should fail on insufficient amount', async () => {
      const verifier = new WdkIndexerVerifier({
        endpoint: 'https://indexer.example.com',
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          from: '0xsender',
          to: '0xrecipient',
          amount: '500000',
          confirmed: true,
          token: '0xtoken',
        }),
      })

      const result = await verifier.verifyPayment({
        txHash: '0xabc',
        network: 'eip155:42161',
        expectedAmount: '1000000',
      })

      expect(result.verified).toBe(false)
      expect(result.reason).toContain('Amount insufficient')
    })

    it('should verify with case-insensitive address comparison', async () => {
      const verifier = new WdkIndexerVerifier({
        endpoint: 'https://indexer.example.com',
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          from: '0xsender',
          to: '0xRecipient',
          amount: '1000000',
          confirmed: true,
          token: '0xtoken',
        }),
      })

      const result = await verifier.verifyPayment({
        txHash: '0xabc',
        network: 'eip155:42161',
        expectedTo: '0xrecipient', // different case
      })

      expect(result.verified).toBe(true)
    })

    it('should pass when amount exceeds expected', async () => {
      const verifier = new WdkIndexerVerifier({
        endpoint: 'https://indexer.example.com',
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          from: '0xsender',
          to: '0xrecipient',
          amount: '2000000', // More than expected
          confirmed: true,
          token: '0xtoken',
        }),
      })

      const result = await verifier.verifyPayment({
        txHash: '0xabc',
        network: 'eip155:42161',
        expectedAmount: '1000000',
      })

      expect(result.verified).toBe(true)
    })
  })

  describe('healthCheck', () => {
    it('should return true when healthy', async () => {
      const verifier = new WdkIndexerVerifier({
        endpoint: 'https://indexer.example.com',
      })

      mockFetch.mockResolvedValueOnce({ ok: true })

      const healthy = await verifier.healthCheck()
      expect(healthy).toBe(true)
    })

    it('should return false when unhealthy', async () => {
      const verifier = new WdkIndexerVerifier({
        endpoint: 'https://indexer.example.com',
      })

      mockFetch.mockResolvedValueOnce({ ok: false, status: 503 })

      const healthy = await verifier.healthCheck()
      expect(healthy).toBe(false)
    })

    it('should return false when fetch throws', async () => {
      const verifier = new WdkIndexerVerifier({
        endpoint: 'https://indexer.example.com',
      })

      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const healthy = await verifier.healthCheck()
      expect(healthy).toBe(false)
    })

    it('should include API key in health check', async () => {
      const verifier = new WdkIndexerVerifier({
        endpoint: 'https://indexer.example.com',
        apiKey: 'my-key',
      })

      mockFetch.mockResolvedValueOnce({ ok: true })

      await verifier.healthCheck()

      expect(mockFetch).toHaveBeenCalledWith(
        'https://indexer.example.com/health',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-key',
          }),
        }),
      )
    })
  })
})
