import { describe, it, expect, vi } from 'vitest'
import { LightningScheme } from '../../../src/lightning/server/scheme'
import { LIGHTNING_MAINNET } from '../../../src/constants'

function createMockInvoiceGenerator() {
  return vi.fn().mockResolvedValue({
    bolt11Invoice: 'lnbc1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctn',
    paymentHash: 'b'.repeat(64),
  })
}

describe('LightningScheme (Server)', () => {
  describe('constructor', () => {
    it('should create instance with config', () => {
      const scheme = new LightningScheme({
        generateInvoice: createMockInvoiceGenerator(),
      })
      expect(scheme.scheme).toBe('exact')
    })
  })

  describe('parsePrice', () => {
    it('should parse numeric price to satoshi amount', async () => {
      const scheme = new LightningScheme({
        generateInvoice: createMockInvoiceGenerator(),
      })
      const result = await scheme.parsePrice(0.001, LIGHTNING_MAINNET)

      expect(result.amount).toBe('100000') // 0.001 * 100_000_000
      expect(result.asset).toBe('BTC')
    })

    it('should return AssetAmount directly if already parsed', async () => {
      const scheme = new LightningScheme({
        generateInvoice: createMockInvoiceGenerator(),
      })
      const assetAmount = {
        amount: '50000',
        asset: 'BTC',
        extra: {},
      }

      const result = await scheme.parsePrice(assetAmount, LIGHTNING_MAINNET)
      expect(result).toEqual(assetAmount)
    })

    it('should throw for invalid money format', async () => {
      const scheme = new LightningScheme({
        generateInvoice: createMockInvoiceGenerator(),
      })

      await expect(scheme.parsePrice('invalid', LIGHTNING_MAINNET)).rejects.toThrow(
        'Invalid money format',
      )
    })
  })

  describe('enhancePaymentRequirements', () => {
    it('should generate and add BOLT11 invoice', async () => {
      const generateInvoice = createMockInvoiceGenerator()
      const scheme = new LightningScheme({ generateInvoice })

      const requirements = {
        scheme: 'exact',
        network: LIGHTNING_MAINNET,
        amount: '100000',
        asset: 'BTC',
        payTo: '02' + 'd'.repeat(64),
        maxTimeoutSeconds: 3600,
        extra: {},
      }

      const enhanced = await scheme.enhancePaymentRequirements(
        requirements,
        { t402Version: 2, scheme: 'exact', network: LIGHTNING_MAINNET },
        [],
      )

      expect(enhanced.extra.bolt11Invoice).toBeDefined()
      expect(enhanced.extra.paymentHash).toBe('b'.repeat(64))
      expect(generateInvoice).toHaveBeenCalledWith(
        '100000',
        expect.stringContaining('t402 payment'),
        3600,
      )
    })

    it('should set asset to BTC if not set', async () => {
      const scheme = new LightningScheme({
        generateInvoice: createMockInvoiceGenerator(),
      })

      const requirements = {
        scheme: 'exact',
        network: LIGHTNING_MAINNET,
        amount: '100000',
        asset: '',
        payTo: '02' + 'd'.repeat(64),
        maxTimeoutSeconds: 3600,
        extra: {},
      }

      const enhanced = await scheme.enhancePaymentRequirements(
        requirements,
        { t402Version: 2, scheme: 'exact', network: LIGHTNING_MAINNET },
        [],
      )

      expect(enhanced.asset).toBe('BTC')
    })
  })

  describe('registerMoneyParser', () => {
    it('should return self for chaining', () => {
      const scheme = new LightningScheme({
        generateInvoice: createMockInvoiceGenerator(),
      })

      const result = scheme.registerMoneyParser(async () => null)
      expect(result).toBe(scheme)
    })
  })
})
