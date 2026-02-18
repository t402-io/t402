import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TonGaslessClient, createTonGaslessClient } from './client'
import type { TonGaslessConfig } from './types'

describe('TonGaslessClient', () => {
  let mockWdk: {
    getAddress: ReturnType<typeof vi.fn>
    getJettonBalance: ReturnType<typeof vi.fn>
    sendGaslessTransfer: ReturnType<typeof vi.fn>
  }
  let config: TonGaslessConfig

  beforeEach(() => {
    mockWdk = {
      getAddress: vi.fn().mockResolvedValue('UQTestAddress1234567890123456789012345678901234'),
      getJettonBalance: vi.fn().mockResolvedValue('5000000'),
      sendGaslessTransfer: vi.fn().mockResolvedValue({
        txHash: 'mock-ton-tx-hash-123',
      }),
    }
    config = {
      wdkInstance: mockWdk,
    }
  })

  describe('createTonGaslessClient', () => {
    it('should create a client instance', async () => {
      const client = await createTonGaslessClient(config)
      expect(client).toBeInstanceOf(TonGaslessClient)
    })
  })

  describe('pay', () => {
    it('should execute a gasless payment', async () => {
      const client = new TonGaslessClient(config)

      const result = await client.pay({
        to: 'UQRecipientAddress123456789012345678901234',
        amount: 1000000n,
      })

      expect(result.txHash).toBe('mock-ton-tx-hash-123')
      expect(result.from).toBe('UQTestAddress1234567890123456789012345678901234')
      expect(result.to).toBe('UQRecipientAddress123456789012345678901234')
      expect(result.sponsored).toBe(true)
      expect(result.token).toBe('USDT0')
    })

    it('should call sendGaslessTransfer with correct params', async () => {
      const client = new TonGaslessClient(config)

      await client.pay({
        to: 'UQRecipientAddress123456789012345678901234',
        amount: 2000000n,
        token: 'USDT0',
        memo: 'test payment',
      })

      expect(mockWdk.sendGaslessTransfer).toHaveBeenCalledWith({
        to: 'UQRecipientAddress123456789012345678901234',
        amount: '2000000',
        jettonAddress: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
        memo: 'test payment',
      })
    })

    it('should throw for invalid address', async () => {
      const client = new TonGaslessClient(config)

      await expect(
        client.pay({
          to: '',
          amount: 1000000n,
        }),
      ).rejects.toThrow('Invalid TON recipient address')
    })

    it('should throw for zero amount', async () => {
      const client = new TonGaslessClient(config)

      await expect(
        client.pay({
          to: 'UQRecipientAddress123456789012345678901234',
          amount: 0n,
        }),
      ).rejects.toThrow('Payment amount must be greater than zero')
    })

    it('should throw without WDK instance', async () => {
      const client = new TonGaslessClient({})

      await expect(
        client.pay({
          to: 'UQRecipientAddress123456789012345678901234',
          amount: 1000000n,
        }),
      ).rejects.toThrow('WDK instance not configured')
    })
  })

  describe('getBalance', () => {
    it('should return balance as bigint', async () => {
      const client = new TonGaslessClient(config)

      const balance = await client.getBalance()

      expect(balance).toBe(5000000n)
      expect(mockWdk.getJettonBalance).toHaveBeenCalled()
    })

    it('should query with USDT token', async () => {
      const client = new TonGaslessClient(config)

      await client.getBalance('USDT')

      expect(mockWdk.getJettonBalance).toHaveBeenCalledWith(
        'UQTestAddress1234567890123456789012345678901234',
        'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
      )
    })
  })

  describe('getFormattedBalance', () => {
    it('should format balance correctly', () => {
      const client = new TonGaslessClient(config)

      expect(client.getFormattedBalance(1500000n)).toBe('1.5')
      expect(client.getFormattedBalance(1000000n)).toBe('1.0')
      expect(client.getFormattedBalance(100n)).toBe('0.0001')
      expect(client.getFormattedBalance(0n)).toBe('0.0')
    })

    it('should support custom decimals', () => {
      const client = new TonGaslessClient(config)

      expect(client.getFormattedBalance(1500000000n, 9)).toBe('1.5')
    })
  })

  describe('getAddress', () => {
    it('should return address from WDK', async () => {
      const client = new TonGaslessClient(config)

      const address = await client.getAddress()

      expect(address).toBe('UQTestAddress1234567890123456789012345678901234')
    })

    it('should support address property', async () => {
      const client = new TonGaslessClient({
        wdkInstance: { address: 'UQAddressProp12345678901234567890123456789' },
      })

      const address = await client.getAddress()

      expect(address).toBe('UQAddressProp12345678901234567890123456789')
    })

    it('should throw without WDK instance', async () => {
      const client = new TonGaslessClient({})

      await expect(client.getAddress()).rejects.toThrow('WDK instance not configured')
    })
  })

  describe('canSponsor', () => {
    it('should return true with valid config', async () => {
      const client = new TonGaslessClient(config)

      const result = await client.canSponsor({
        to: 'UQRecipientAddress123456789012345678901234',
        amount: 1000000n,
      })

      expect(result).toBe(true)
    })

    it('should return false without WDK or relay', async () => {
      const client = new TonGaslessClient({})

      const result = await client.canSponsor({
        to: 'UQRecipientAddress123456789012345678901234',
        amount: 1000000n,
      })

      expect(result).toBe(false)
    })

    it('should return false for zero amount', async () => {
      const client = new TonGaslessClient(config)

      const result = await client.canSponsor({
        to: 'UQRecipientAddress123456789012345678901234',
        amount: 0n,
      })

      expect(result).toBe(false)
    })

    it('should return false for negative amount', async () => {
      const client = new TonGaslessClient(config)

      const result = await client.canSponsor({
        to: 'UQRecipientAddress123456789012345678901234',
        amount: -1n,
      })

      expect(result).toBe(false)
    })
  })
})
