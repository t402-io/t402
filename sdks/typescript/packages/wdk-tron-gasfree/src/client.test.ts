import { describe, it, expect, beforeEach, vi } from 'vitest'
import { WdkTronGasfreeClient, createWdkTronGasfreeClient } from './client'
import type { WdkTronGasfreeConfig } from './types'

describe('WdkTronGasfreeClient', () => {
  let mockWdk: {
    getAddress: ReturnType<typeof vi.fn>
    getBalance: ReturnType<typeof vi.fn>
    sendGasfreeTransfer: ReturnType<typeof vi.fn>
  }
  let config: WdkTronGasfreeConfig

  beforeEach(() => {
    mockWdk = {
      getAddress: vi.fn().mockResolvedValue('TTestAddress1234567890123456789012'),
      getBalance: vi.fn().mockResolvedValue('5000000'),
      sendGasfreeTransfer: vi.fn().mockResolvedValue({
        txId: 'mock-tx-id-123',
      }),
    }
    config = {
      wdkInstance: mockWdk,
    }
  })

  describe('createWdkTronGasfreeClient', () => {
    it('should create a client instance', async () => {
      const client = await createWdkTronGasfreeClient(config)
      expect(client).toBeInstanceOf(WdkTronGasfreeClient)
    })
  })

  describe('pay', () => {
    it('should execute a gas-free payment', async () => {
      const client = new WdkTronGasfreeClient(config)

      const result = await client.pay({
        to: 'TRecipientAddress12345678901234567',
        amount: 1000000n,
      })

      expect(result.txId).toBe('mock-tx-id-123')
      expect(result.from).toBe('TTestAddress1234567890123456789012')
      expect(result.to).toBe('TRecipientAddress12345678901234567')
      expect(result.sponsored).toBe(true)
    })

    it('should call sendGasfreeTransfer with correct params', async () => {
      const client = new WdkTronGasfreeClient(config)

      await client.pay({
        to: 'TRecipientAddress12345678901234567',
        amount: 2000000n,
        token: 'USDT',
        memo: 'test payment',
      })

      expect(mockWdk.sendGasfreeTransfer).toHaveBeenCalledWith({
        to: 'TRecipientAddress12345678901234567',
        amount: '2000000',
        tokenAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        memo: 'test payment',
      })
    })

    it('should throw for invalid address', async () => {
      const client = new WdkTronGasfreeClient(config)

      await expect(
        client.pay({
          to: '',
          amount: 1000000n,
        }),
      ).rejects.toThrow('Invalid TRON recipient address')
    })

    it('should throw for zero amount', async () => {
      const client = new WdkTronGasfreeClient(config)

      await expect(
        client.pay({
          to: 'TRecipientAddress12345678901234567',
          amount: 0n,
        }),
      ).rejects.toThrow('Payment amount must be greater than zero')
    })

    it('should throw without WDK instance', async () => {
      const client = new WdkTronGasfreeClient({})

      await expect(
        client.pay({
          to: 'TRecipientAddress12345678901234567',
          amount: 1000000n,
        }),
      ).rejects.toThrow('WDK instance not configured')
    })
  })

  describe('getBalance', () => {
    it('should return balance as bigint', async () => {
      const client = new WdkTronGasfreeClient(config)

      const balance = await client.getBalance()

      expect(balance).toBe(5000000n)
      expect(mockWdk.getBalance).toHaveBeenCalled()
    })

    it('should query with USDT0 token', async () => {
      const client = new WdkTronGasfreeClient(config)

      await client.getBalance('USDT0')

      expect(mockWdk.getBalance).toHaveBeenCalledWith(
        'TTestAddress1234567890123456789012',
        'TKiUqMmnCBPqRfREwNExNYKG2KQqj5Gd2m',
      )
    })
  })

  describe('getFormattedBalance', () => {
    it('should format balance correctly', () => {
      const client = new WdkTronGasfreeClient(config)

      expect(client.getFormattedBalance(1500000n)).toBe('1.5')
      expect(client.getFormattedBalance(1000000n)).toBe('1.0')
      expect(client.getFormattedBalance(100n)).toBe('0.0001')
      expect(client.getFormattedBalance(0n)).toBe('0.0')
    })

    it('should support custom decimals', () => {
      const client = new WdkTronGasfreeClient(config)

      expect(client.getFormattedBalance(1500000000000000000n, 18)).toBe('1.5')
    })
  })

  describe('getAddress', () => {
    it('should return address from WDK', async () => {
      const client = new WdkTronGasfreeClient(config)

      const address = await client.getAddress()

      expect(address).toBe('TTestAddress1234567890123456789012')
    })

    it('should support address property', async () => {
      const client = new WdkTronGasfreeClient({
        wdkInstance: { address: 'TAddressProp123456789012345678901' },
      })

      const address = await client.getAddress()

      expect(address).toBe('TAddressProp123456789012345678901')
    })

    it('should throw without WDK instance', async () => {
      const client = new WdkTronGasfreeClient({})

      await expect(client.getAddress()).rejects.toThrow('WDK instance not configured')
    })
  })

  describe('canSponsor', () => {
    it('should return true with valid config', async () => {
      const client = new WdkTronGasfreeClient(config)

      const result = await client.canSponsor({
        to: 'TRecipientAddress12345678901234567',
        amount: 1000000n,
      })

      expect(result).toBe(true)
    })

    it('should return false without WDK or relay', async () => {
      const client = new WdkTronGasfreeClient({})

      const result = await client.canSponsor({
        to: 'TRecipientAddress12345678901234567',
        amount: 1000000n,
      })

      expect(result).toBe(false)
    })

    it('should return false for zero amount', async () => {
      const client = new WdkTronGasfreeClient(config)

      const result = await client.canSponsor({
        to: 'TRecipientAddress12345678901234567',
        amount: 0n,
      })

      expect(result).toBe(false)
    })

    it('should return false for negative amount', async () => {
      const client = new WdkTronGasfreeClient(config)

      const result = await client.canSponsor({
        to: 'TRecipientAddress12345678901234567',
        amount: -1n,
      })

      expect(result).toBe(false)
    })
  })
})
