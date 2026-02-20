import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MoonpayOnRampProvider, getMoonpayCurrencyCode } from '../../src/providers/moonpay'
import { T402WDK } from '../../src/t402wdk'
import type { FiatOnRampProvider, WDKConstructor, WDKInstance, WDKAccount } from '../../src/types'

// Mock WDK setup (reused from t402wdk.test.ts pattern)
function createMockAccount(address: string): WDKAccount {
  return {
    getAddress: vi.fn().mockResolvedValue(address),
    getBalance: vi.fn().mockResolvedValue(1000000000000000000n),
    getTokenBalance: vi.fn().mockResolvedValue(1000000n),
    signMessage: vi.fn().mockResolvedValue('0xsignature'),
    signTypedData: vi.fn().mockResolvedValue('0xtypedSignature'),
    sendTransaction: vi.fn().mockResolvedValue('0xtxhash'),
    estimateGas: vi.fn().mockResolvedValue(21000n),
  }
}

function createMockWDK(): WDKInstance {
  const mockAccount = createMockAccount('0x1234567890123456789012345678901234567890')
  return {
    registerWallet: vi.fn().mockReturnThis(),
    registerProtocol: vi.fn().mockReturnThis(),
    getAccount: vi.fn().mockResolvedValue(mockAccount),
    executeProtocol: vi.fn().mockResolvedValue({ txHash: '0xbridgehash' }),
  }
}

const MockWDKConstructor: WDKConstructor = class MockWDK {
  constructor(_seedPhrase: string) {
    return createMockWDK() as unknown as WDKInstance
  }
  static getRandomSeedPhrase(): string {
    return 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
  }
} as unknown as WDKConstructor

const MockWalletManagerEvm = {}

const VALID_SEED_PHRASE =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

describe('MoonpayOnRampProvider', () => {
  let provider: MoonpayOnRampProvider

  beforeEach(() => {
    provider = new MoonpayOnRampProvider({
      apiKey: 'pk_test_123',
      environment: 'sandbox',
    })
  })

  it('should construct with apiKey', () => {
    expect(provider.name).toBe('moonpay')
    expect(provider.baseUrl).toBe('https://buy-sandbox.moonpay.com')
  })

  it('should throw if apiKey is missing', () => {
    expect(() => new MoonpayOnRampProvider({ apiKey: '' })).toThrow('Moonpay API key is required')
  })

  it('should default to production environment', () => {
    const prod = new MoonpayOnRampProvider({ apiKey: 'pk_live_abc' })
    expect(prod.baseUrl).toBe('https://buy.moonpay.com')
  })

  it('should use sandbox URL when environment is sandbox', () => {
    expect(provider.baseUrl).toBe('https://buy-sandbox.moonpay.com')
  })

  describe('getQuote', () => {
    it('should return valid quote structure', async () => {
      // Mock the internal fetch
      vi.spyOn(provider, '_fetchQuote').mockResolvedValue({
        quoteCurrencyAmount: '99.5',
        quoteCurrencyPrice: 1.005,
        networkFeeAmount: '0.5',
        feeAmount: '3.99',
        totalFeeAmount: '4.49',
      })

      const quote = await provider.getQuote({
        fiatAmount: 100,
        fiatCurrency: 'USD',
        network: 'eip155:42161',
      })

      expect(quote).toMatchObject({
        fiatAmount: 100,
        fiatCurrency: 'USD',
        cryptoAmount: '99.5',
        cryptoCurrency: 'USDT',
        exchangeRate: 1.005,
        estimatedTime: 600,
      })
      expect(quote.fees).toMatchObject({
        network: '0.5',
        service: '3.99',
        total: '4.49',
      })
    })

    it('should throw for unsupported network', async () => {
      await expect(
        provider.getQuote({
          fiatAmount: 100,
          fiatCurrency: 'USD',
          network: 'cosmos:cosmoshub-4',
        }),
      ).rejects.toThrow('not supported by Moonpay')
    })

    it('should throw for invalid fiat amount', async () => {
      await expect(
        provider.getQuote({
          fiatAmount: 0,
          fiatCurrency: 'USD',
          network: 'eip155:42161',
        }),
      ).rejects.toThrow('fiatAmount must be greater than 0')
    })

    it('should throw for unsupported fiat currency', async () => {
      await expect(
        provider.getQuote({
          fiatAmount: 100,
          fiatCurrency: 'JPY',
          network: 'eip155:42161',
        }),
      ).rejects.toThrow('not supported')
    })
  })

  describe('createWidget', () => {
    it('should generate correct URL with parameters', () => {
      const result = provider.createWidget({
        fiatAmount: 100,
        fiatCurrency: 'USD',
        walletAddress: '0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
        network: 'eip155:42161',
      })

      expect(result.widgetUrl).toContain('https://buy-sandbox.moonpay.com')
      expect(result.widgetUrl).toContain('apiKey=pk_test_123')
      expect(result.widgetUrl).toContain('currencyCode=usdt_arbitrum')
      expect(result.widgetUrl).toContain('baseCurrencyCode=usd')
      expect(result.widgetUrl).toContain('baseCurrencyAmount=100')
      expect(result.widgetUrl).toContain('walletAddress=0xABCDEF')
      expect(result.orderId).toBeTruthy()
      expect(result.expiresAt).toBeTruthy()
    })

    it('should include all parameters in URL', () => {
      const result = provider.createWidget({
        fiatAmount: 50,
        fiatCurrency: 'EUR',
        walletAddress: '0x1111111111111111111111111111111111111111',
        network: 'eip155:137',
        redirectUrl: 'https://myapp.com/callback',
      })

      expect(result.widgetUrl).toContain('currencyCode=usdt_polygon')
      expect(result.widgetUrl).toContain('baseCurrencyCode=eur')
      expect(result.widgetUrl).toContain('baseCurrencyAmount=50')
      expect(result.widgetUrl).toContain('redirectURL=')
      expect(result.widgetUrl).toContain('myapp.com')
    })

    it('should throw for unsupported network', () => {
      expect(() =>
        provider.createWidget({
          fiatAmount: 100,
          fiatCurrency: 'USD',
          walletAddress: '0x1111111111111111111111111111111111111111',
          network: 'cosmos:cosmoshub-4',
        }),
      ).toThrow('not supported by Moonpay')
    })

    it('should throw for missing wallet address', () => {
      expect(() =>
        provider.createWidget({
          fiatAmount: 100,
          fiatCurrency: 'USD',
          walletAddress: '',
          network: 'eip155:42161',
        }),
      ).toThrow('walletAddress is required')
    })

    it('should throw for invalid fiat amount', () => {
      expect(() =>
        provider.createWidget({
          fiatAmount: 0,
          fiatCurrency: 'USD',
          walletAddress: '0x1111111111111111111111111111111111111111',
          network: 'eip155:42161',
        }),
      ).toThrow('fiatAmount must be greater than 0')
    })

    it('should generate production URLs for production environment', () => {
      const prodProvider = new MoonpayOnRampProvider({
        apiKey: 'pk_live_xyz',
        environment: 'production',
      })

      const result = prodProvider.createWidget({
        fiatAmount: 100,
        fiatCurrency: 'USD',
        walletAddress: '0x1111111111111111111111111111111111111111',
        network: 'eip155:1',
      })

      expect(result.widgetUrl).toContain('https://buy.moonpay.com')
      expect(result.widgetUrl).toContain('currencyCode=usdt')
      expect(result.widgetUrl).not.toContain('usdt_')
    })
  })

  describe('getSupportedCurrencies', () => {
    it('should return expected fiat currencies', () => {
      const currencies = provider.getSupportedCurrencies()
      expect(currencies).toContain('USD')
      expect(currencies).toContain('EUR')
      expect(currencies).toContain('GBP')
      expect(currencies.length).toBe(3)
    })
  })

  describe('getSupportedNetworks', () => {
    it('should return expected CAIP-2 networks', () => {
      const networks = provider.getSupportedNetworks()
      expect(networks).toContain('eip155:1')
      expect(networks).toContain('eip155:42161')
      expect(networks).toContain('eip155:137')
      expect(networks).toContain('eip155:8453')
      expect(networks.length).toBeGreaterThanOrEqual(4)
    })
  })

  describe('CAIP-2 to Moonpay currency code mapping', () => {
    it('should map eip155:42161 to usdt_arbitrum', () => {
      expect(getMoonpayCurrencyCode('eip155:42161')).toBe('usdt_arbitrum')
    })

    it('should map eip155:137 to usdt_polygon', () => {
      expect(getMoonpayCurrencyCode('eip155:137')).toBe('usdt_polygon')
    })

    it('should map eip155:1 to usdt', () => {
      expect(getMoonpayCurrencyCode('eip155:1')).toBe('usdt')
    })

    it('should map eip155:8453 to usdt_base', () => {
      expect(getMoonpayCurrencyCode('eip155:8453')).toBe('usdt_base')
    })

    it('should return undefined for unsupported networks', () => {
      expect(getMoonpayCurrencyCode('cosmos:cosmoshub-4')).toBeUndefined()
      expect(getMoonpayCurrencyCode('ton:mainnet')).toBeUndefined()
    })
  })
})

describe('T402WDK fiat on-ramp integration', () => {
  let mockProvider: FiatOnRampProvider

  beforeEach(() => {
    // Reset WDK registration
    // @ts-expect-error - accessing private static for testing
    T402WDK._WDK = null
    // @ts-expect-error - accessing private static for testing
    T402WDK._WalletManagerEvm = null
    // @ts-expect-error - accessing private static for testing
    T402WDK._BridgeUsdt0Evm = null
    // @ts-expect-error - accessing private static for testing
    T402WDK._fiatOnRampProvider = null

    mockProvider = {
      name: 'mock-onramp',
      getQuote: vi.fn().mockResolvedValue({
        fiatAmount: 100,
        fiatCurrency: 'USD',
        cryptoAmount: '99.5',
        cryptoCurrency: 'USDT',
        exchangeRate: 1.005,
        fees: { network: '0.5', service: '3.99', total: '4.49' },
        estimatedTime: 600,
      }),
      createWidget: vi.fn().mockReturnValue({
        widgetUrl: 'https://buy.example.com?test=1',
        orderId: 'ord_123',
        expiresAt: '2026-12-31T00:00:00Z',
      }),
      getSupportedCurrencies: vi.fn().mockReturnValue(['USD', 'EUR']),
      getSupportedNetworks: vi.fn().mockReturnValue(['eip155:42161']),
    }
  })

  it('should register fiat on-ramp provider', () => {
    expect(T402WDK.isFiatOnRampRegistered()).toBe(false)
    T402WDK.registerFiatOnRamp(mockProvider)
    expect(T402WDK.isFiatOnRampRegistered()).toBe(true)
  })

  it('should report not registered when no provider set', () => {
    expect(T402WDK.isFiatOnRampRegistered()).toBe(false)
  })

  it('should throw when registering invalid provider', () => {
    expect(() => T402WDK.registerFiatOnRamp(null as unknown as FiatOnRampProvider)).toThrow(
      'valid FiatOnRampProvider',
    )
  })

  it('should delegate getFiatOnRampQuote to provider', async () => {
    T402WDK.registerFiatOnRamp(mockProvider)
    T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)
    const wdk = new T402WDK(VALID_SEED_PHRASE)

    const quote = await wdk.getFiatOnRampQuote({
      fiatAmount: 100,
      fiatCurrency: 'USD',
      network: 'eip155:42161',
    })

    expect(mockProvider.getQuote).toHaveBeenCalledWith({
      fiatAmount: 100,
      fiatCurrency: 'USD',
      network: 'eip155:42161',
    })
    expect(quote.cryptoAmount).toBe('99.5')
  })

  it('should throw getFiatOnRampQuote when no provider registered', async () => {
    T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)
    const wdk = new T402WDK(VALID_SEED_PHRASE)

    await expect(
      wdk.getFiatOnRampQuote({
        fiatAmount: 100,
        fiatCurrency: 'USD',
        network: 'eip155:42161',
      }),
    ).rejects.toThrow('No fiat on-ramp provider registered')
  })

  it('should return widget URL from onRampAndPay', () => {
    T402WDK.registerFiatOnRamp(mockProvider)
    T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)
    const wdk = new T402WDK(VALID_SEED_PHRASE)

    const result = wdk.onRampAndPay({
      fiatAmount: 100,
      fiatCurrency: 'USD',
      walletAddress: '0x1111111111111111111111111111111111111111',
      network: 'eip155:42161',
    })

    expect(result.widgetUrl).toBe('https://buy.example.com?test=1')
    expect(result.orderId).toBe('ord_123')
    expect(mockProvider.createWidget).toHaveBeenCalled()
  })

  it('should throw onRampAndPay when no provider registered', () => {
    T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm)
    const wdk = new T402WDK(VALID_SEED_PHRASE)

    expect(() =>
      wdk.onRampAndPay({
        fiatAmount: 100,
        fiatCurrency: 'USD',
        walletAddress: '0x1111111111111111111111111111111111111111',
        network: 'eip155:42161',
      }),
    ).toThrow('No fiat on-ramp provider registered')
  })
})
