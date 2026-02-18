import { describe, it, expect } from 'vitest'
import { ExactBtcScheme } from '../../../src/exact/server/scheme'
import { BTC_MAINNET } from '../../../src/constants'

describe('ExactBtcScheme (Server)', () => {
  describe('constructor', () => {
    it('should create instance with config', () => {
      const scheme = new ExactBtcScheme({
        payTo: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
      })
      expect(scheme.scheme).toBe('exact')
    })
  })

  describe('parsePrice', () => {
    it('should parse numeric price to satoshi amount', async () => {
      const scheme = new ExactBtcScheme({
        payTo: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
      })
      const result = await scheme.parsePrice(1.5, BTC_MAINNET)

      expect(result.amount).toBe('150000000') // 1.5 * 100_000_000
      expect(result.asset).toBe('BTC')
    })

    it('should parse string price with dollar sign', async () => {
      const scheme = new ExactBtcScheme({
        payTo: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
      })
      const result = await scheme.parsePrice('$0.001', BTC_MAINNET)

      expect(result.amount).toBe('100000') // 0.001 * 100_000_000
      expect(result.asset).toBe('BTC')
    })

    it('should return AssetAmount directly if already parsed', async () => {
      const scheme = new ExactBtcScheme({
        payTo: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
      })
      const assetAmount = {
        amount: '50000',
        asset: 'BTC',
        extra: { custom: true },
      }

      const result = await scheme.parsePrice(assetAmount, BTC_MAINNET)
      expect(result).toEqual(assetAmount)
    })

    it('should throw for AssetAmount without asset', async () => {
      const scheme = new ExactBtcScheme({
        payTo: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
      })

      await expect(scheme.parsePrice({ amount: '5000' } as any, BTC_MAINNET)).rejects.toThrow(
        'Asset must be specified',
      )
    })

    it('should throw for invalid money format', async () => {
      const scheme = new ExactBtcScheme({
        payTo: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
      })

      await expect(scheme.parsePrice('invalid', BTC_MAINNET)).rejects.toThrow(
        'Invalid money format',
      )
    })
  })

  describe('registerMoneyParser', () => {
    it('should allow registering custom money parsers', async () => {
      const scheme = new ExactBtcScheme({
        payTo: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
      })

      scheme.registerMoneyParser(async (amount, _network) => {
        if (amount > 100) {
          return {
            amount: (amount * 1e8).toString(),
            asset: 'BTC',
            extra: { tier: 'large' },
          }
        }
        return null
      })

      const largeResult = await scheme.parsePrice(150, BTC_MAINNET)
      expect(largeResult.extra?.tier).toBe('large')

      const smallResult = await scheme.parsePrice(0.5, BTC_MAINNET)
      expect(smallResult.extra?.tier).toBeUndefined()
    })

    it('should return self for chaining', () => {
      const scheme = new ExactBtcScheme({
        payTo: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
      })

      const result = scheme
        .registerMoneyParser(async () => null)
        .registerMoneyParser(async () => null)

      expect(result).toBe(scheme)
    })
  })

  describe('enhancePaymentRequirements', () => {
    it('should set payTo from config', async () => {
      const payTo = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'
      const scheme = new ExactBtcScheme({ payTo })

      const requirements = {
        scheme: 'exact',
        network: BTC_MAINNET,
        amount: '100000',
        asset: '',
        payTo: '',
        maxTimeoutSeconds: 3600,
        extra: {},
      }

      const enhanced = await scheme.enhancePaymentRequirements(
        requirements,
        { t402Version: 2, scheme: 'exact', network: BTC_MAINNET },
        [],
      )

      expect(enhanced.payTo).toBe(payTo)
      expect(enhanced.asset).toBe('BTC')
    })

    it('should preserve existing payTo', async () => {
      const scheme = new ExactBtcScheme({
        payTo: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
      })

      const existingPayTo = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'
      const requirements = {
        scheme: 'exact',
        network: BTC_MAINNET,
        amount: '100000',
        asset: 'BTC',
        payTo: existingPayTo,
        maxTimeoutSeconds: 3600,
        extra: {},
      }

      const enhanced = await scheme.enhancePaymentRequirements(
        requirements,
        { t402Version: 2, scheme: 'exact', network: BTC_MAINNET },
        [],
      )

      expect(enhanced.payTo).toBe(existingPayTo)
    })
  })
})
