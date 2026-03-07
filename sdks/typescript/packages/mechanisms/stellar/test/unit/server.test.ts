import { describe, it, expect } from 'vitest'
import { ExactStellarScheme } from '../../src/exact/server/scheme'
import { STELLAR_PUBNET_CAIP2, STELLAR_TESTNET_CAIP2 } from '../../src/constants'
import { USDC_ADDRESSES } from '../../src/tokens'

describe('ExactStellarScheme (Server)', () => {
  describe('constructor', () => {
    it('should create instance with default config', () => {
      const scheme = new ExactStellarScheme()
      expect(scheme.scheme).toBe('exact')
    })

    it('should create instance with custom config', () => {
      const scheme = new ExactStellarScheme({ preferredToken: 'USDC' })
      expect(scheme.scheme).toBe('exact')
    })
  })

  describe('parsePrice', () => {
    it('should parse numeric price to USDC amount', async () => {
      const scheme = new ExactStellarScheme()
      const result = await scheme.parsePrice(1.5, STELLAR_PUBNET_CAIP2)

      expect(result.amount).toBe('15000000') // 1.5 * 10^7
      expect(result.asset).toBe(USDC_ADDRESSES[STELLAR_PUBNET_CAIP2])
      expect(result.extra?.symbol).toBe('USDC')
    })

    it('should parse string price with dollar sign', async () => {
      const scheme = new ExactStellarScheme()
      const result = await scheme.parsePrice('$10.50', STELLAR_PUBNET_CAIP2)

      expect(result.amount).toBe('105000000') // 10.50 * 10^7
      expect(result.asset).toBe(USDC_ADDRESSES[STELLAR_PUBNET_CAIP2])
    })

    it('should parse string price without dollar sign', async () => {
      const scheme = new ExactStellarScheme()
      const result = await scheme.parsePrice('25.00', STELLAR_PUBNET_CAIP2)

      expect(result.amount).toBe('250000000') // 25 * 10^7
    })

    it('should return AssetAmount directly if already parsed', async () => {
      const scheme = new ExactStellarScheme()
      const assetAmount = {
        amount: '50000000',
        asset: 'CCustomTokenAddress00000000000000000000000000000000000',
        extra: { custom: true },
      }

      const result = await scheme.parsePrice(assetAmount, STELLAR_PUBNET_CAIP2)

      expect(result).toEqual(assetAmount)
    })

    it('should throw for AssetAmount without asset', async () => {
      const scheme = new ExactStellarScheme()
      const assetAmount = {
        amount: '50000000',
      }

      await expect(
        scheme.parsePrice(assetAmount as any, STELLAR_PUBNET_CAIP2),
      ).rejects.toThrow('Asset address must be specified')
    })

    it('should throw for invalid money format', async () => {
      const scheme = new ExactStellarScheme()

      await expect(scheme.parsePrice('invalid', STELLAR_PUBNET_CAIP2)).rejects.toThrow(
        'Invalid money format',
      )
    })

    it('should work with testnet', async () => {
      const scheme = new ExactStellarScheme()
      const result = await scheme.parsePrice(1.0, STELLAR_TESTNET_CAIP2)

      expect(result.amount).toBe('10000000') // 1.0 * 10^7
      expect(result.asset).toBe(USDC_ADDRESSES[STELLAR_TESTNET_CAIP2])
    })
  })

  describe('registerMoneyParser', () => {
    it('should allow registering custom money parsers', async () => {
      const scheme = new ExactStellarScheme()

      scheme.registerMoneyParser(async (amount, _network) => {
        if (amount > 100) {
          return {
            amount: (amount * 1e7).toString(),
            asset: 'CLargeTokenAddress0000000000000000000000000000000000000',
            extra: { tier: 'large' },
          }
        }
        return null
      })

      // Large amount should use custom parser
      const largeResult = await scheme.parsePrice(150, STELLAR_PUBNET_CAIP2)
      expect(largeResult.asset).toBe(
        'CLargeTokenAddress0000000000000000000000000000000000000',
      )
      expect(largeResult.extra?.tier).toBe('large')

      // Small amount should fall back to default
      const smallResult = await scheme.parsePrice(50, STELLAR_PUBNET_CAIP2)
      expect(smallResult.asset).toBe(USDC_ADDRESSES[STELLAR_PUBNET_CAIP2])
    })

    it('should chain multiple parsers', async () => {
      const scheme = new ExactStellarScheme()

      scheme.registerMoneyParser(async (amount, _network) => {
        if (amount > 1000) {
          return {
            amount: amount.toString(),
            asset: 'CPremiumToken000000000000000000000000000000000000000000',
            extra: { tier: 'premium' },
          }
        }
        return null
      })

      scheme.registerMoneyParser(async (amount, _network) => {
        if (amount > 100) {
          return {
            amount: amount.toString(),
            asset: 'CLargeToken00000000000000000000000000000000000000000000',
            extra: { tier: 'large' },
          }
        }
        return null
      })

      const premium = await scheme.parsePrice(2000, STELLAR_PUBNET_CAIP2)
      expect(premium.extra?.tier).toBe('premium')

      const large = await scheme.parsePrice(200, STELLAR_PUBNET_CAIP2)
      expect(large.extra?.tier).toBe('large')

      const standard = await scheme.parsePrice(50, STELLAR_PUBNET_CAIP2)
      expect(standard.asset).toBe(USDC_ADDRESSES[STELLAR_PUBNET_CAIP2])
    })

    it('should return self for chaining', () => {
      const scheme = new ExactStellarScheme()

      const result = scheme
        .registerMoneyParser(async () => null)
        .registerMoneyParser(async () => null)

      expect(result).toBe(scheme)
    })
  })

  describe('enhancePaymentRequirements', () => {
    it('should add fee sponsor from supportedKind', async () => {
      const scheme = new ExactStellarScheme()

      const requirements = {
        scheme: 'exact',
        network: STELLAR_PUBNET_CAIP2,
        asset: USDC_ADDRESSES[STELLAR_PUBNET_CAIP2],
        amount: '10000000',
        payTo: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
        maxTimeoutSeconds: 60,
        extra: {},
      }

      const supportedKind = {
        t402Version: 2,
        scheme: 'exact',
        network: STELLAR_PUBNET_CAIP2,
        extra: {
          feeSponsor: 'GBCZ4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
        },
      }

      const enhanced = await scheme.enhancePaymentRequirements(requirements, supportedKind, [])

      expect(enhanced.extra.feeSponsor).toBe(
        'GBCZ4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
      )
    })

    it('should preserve existing extra fields', async () => {
      const scheme = new ExactStellarScheme()

      const requirements = {
        scheme: 'exact',
        network: STELLAR_PUBNET_CAIP2,
        asset: USDC_ADDRESSES[STELLAR_PUBNET_CAIP2],
        amount: '10000000',
        payTo: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
        maxTimeoutSeconds: 60,
        extra: { existingField: 'value' },
      }

      const supportedKind = {
        t402Version: 2,
        scheme: 'exact',
        network: STELLAR_PUBNET_CAIP2,
        extra: {
          feeSponsor: 'GBCZ4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
        },
      }

      const enhanced = await scheme.enhancePaymentRequirements(requirements, supportedKind, [])

      expect(enhanced.extra.existingField).toBe('value')
      expect(enhanced.extra.feeSponsor).toBe(
        'GBCZ4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
      )
    })
  })

  describe('static methods', () => {
    it('should return supported networks', () => {
      const networks = ExactStellarScheme.getSupportedNetworks()
      expect(networks).toContain(STELLAR_PUBNET_CAIP2)
      expect(networks).toContain(STELLAR_TESTNET_CAIP2)
    })

    it('should check network support', () => {
      expect(ExactStellarScheme.isNetworkSupported(STELLAR_PUBNET_CAIP2)).toBe(true)
      expect(ExactStellarScheme.isNetworkSupported('unknown:network')).toBe(false)
    })
  })
})
