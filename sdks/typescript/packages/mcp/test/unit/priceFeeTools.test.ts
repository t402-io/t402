import { describe, it, expect } from 'vitest'
import {
  // Price service
  getTokenPricesDemo,
  clearPriceCache,
  // Token price tool
  getTokenPriceInputSchema,
  executeGetTokenPrice,
  formatTokenPriceResult,
  // Gas price tool
  getGasPriceInputSchema,
  executeGetGasPrice,
  formatGasPriceResult,
  // Estimate payment fee tool
  estimatePaymentFeeInputSchema,
  executeEstimatePaymentFee,
  formatPaymentFeeEstimate,
  // Compare network fees tool
  compareNetworkFeesInputSchema,
  executeCompareNetworkFees,
  formatNetworkFeeComparison,
  // Tool definitions
  TOOL_DEFINITIONS,
} from '../../src/tools/index.js'

// ---- Price Service ----

describe('Price Service', () => {
  it('getTokenPricesDemo should return known prices', () => {
    const prices = getTokenPricesDemo(['ETH', 'USDC', 'AVAX'])
    expect(prices.ETH).toBeGreaterThan(0)
    expect(prices.USDC).toBe(1.0)
    expect(prices.AVAX).toBeGreaterThan(0)
  })

  it('getTokenPricesDemo should handle unknown tokens', () => {
    const prices = getTokenPricesDemo(['UNKNOWN'])
    expect(prices.UNKNOWN).toBe(0)
  })

  it('clearPriceCache should not throw', () => {
    expect(() => clearPriceCache()).not.toThrow()
  })
})

// ---- Token Price Tool ----

describe('getTokenPrice', () => {
  describe('schema', () => {
    it('should validate valid input', () => {
      const input = { tokens: ['ETH', 'USDC'] }
      expect(() => getTokenPriceInputSchema.parse(input)).not.toThrow()
    })

    it('should accept optional currency', () => {
      const input = { tokens: ['ETH'], currency: 'eur' }
      expect(() => getTokenPriceInputSchema.parse(input)).not.toThrow()
    })

    it('should reject empty tokens array', () => {
      const input = { tokens: [] }
      expect(() => getTokenPriceInputSchema.parse(input)).toThrow()
    })

    it('should reject missing tokens', () => {
      expect(() => getTokenPriceInputSchema.parse({})).toThrow()
    })
  })

  describe('execute (demo)', () => {
    it('should return prices in demo mode', async () => {
      const result = await executeGetTokenPrice(
        { tokens: ['ETH', 'USDC', 'AVAX'] },
        { demoMode: true },
      )
      expect(result.currency).toBe('usd')
      expect(result.prices.ETH).toBeGreaterThan(0)
      expect(result.prices.USDC).toBe(1.0)
      expect(result.prices.AVAX).toBeGreaterThan(0)
    })
  })

  describe('formatter', () => {
    it('should format prices', () => {
      const result = formatTokenPriceResult({
        prices: { ETH: 3250.42, USDC: 1.0 },
        currency: 'usd',
      })
      expect(result).toContain('Token Prices')
      expect(result).toContain('ETH')
      expect(result).toContain('USDC')
      expect(result).toContain('USD')
    })

    it('should handle unavailable prices', () => {
      const result = formatTokenPriceResult({
        prices: { UNKNOWN: 0 },
        currency: 'usd',
      })
      expect(result).toContain('unavailable')
    })
  })
})

// ---- Gas Price Tool ----

describe('getGasPrice', () => {
  describe('schema', () => {
    it('should validate valid input', () => {
      const input = { network: 'ethereum' }
      expect(() => getGasPriceInputSchema.parse(input)).not.toThrow()
    })

    it('should reject invalid network', () => {
      const input = { network: 'invalid' }
      expect(() => getGasPriceInputSchema.parse(input)).toThrow()
    })

    it('should reject missing network', () => {
      expect(() => getGasPriceInputSchema.parse({})).toThrow()
    })
  })

  describe('execute (demo)', () => {
    it('should return gas price for ethereum', async () => {
      const result = await executeGetGasPrice({ network: 'ethereum' }, { demoMode: true })
      expect(result.network).toBe('ethereum')
      expect(result.nativeSymbol).toBe('ETH')
      expect(parseFloat(result.gasPriceGwei)).toBeGreaterThan(0)
      expect(result.gasPriceWei).toBeDefined()
    })

    it('should return gas price for polygon', async () => {
      const result = await executeGetGasPrice({ network: 'polygon' }, { demoMode: true })
      expect(result.network).toBe('polygon')
      expect(result.nativeSymbol).toBe('MATIC')
    })

    it('should return gas price for base (L2, low fees)', async () => {
      const result = await executeGetGasPrice({ network: 'base' }, { demoMode: true })
      const gwei = parseFloat(result.gasPriceGwei)
      // L2 should have much lower gas prices than mainnet
      expect(gwei).toBeLessThan(1)
    })
  })

  describe('formatter', () => {
    it('should format gas price result', () => {
      const result = formatGasPriceResult({
        network: 'ethereum',
        gasPriceWei: '25000000000',
        gasPriceGwei: '25',
        nativeSymbol: 'ETH',
      })
      expect(result).toContain('Gas Price')
      expect(result).toContain('ethereum')
      expect(result).toContain('25')
      expect(result).toContain('gwei')
      expect(result).toContain('ETH')
    })
  })
})

// ---- Estimate Payment Fee Tool ----

describe('estimatePaymentFee', () => {
  describe('schema', () => {
    it('should validate valid input', () => {
      const input = { network: 'base', amount: '100', token: 'USDC' }
      expect(() => estimatePaymentFeeInputSchema.parse(input)).not.toThrow()
    })

    it('should reject invalid network', () => {
      const input = { network: 'invalid', amount: '100', token: 'USDC' }
      expect(() => estimatePaymentFeeInputSchema.parse(input)).toThrow()
    })

    it('should reject invalid amount', () => {
      const input = { network: 'base', amount: 'abc', token: 'USDC' }
      expect(() => estimatePaymentFeeInputSchema.parse(input)).toThrow()
    })

    it('should reject invalid token', () => {
      const input = { network: 'base', amount: '100', token: 'BTC' }
      expect(() => estimatePaymentFeeInputSchema.parse(input)).toThrow()
    })
  })

  describe('execute (demo)', () => {
    it('should return fee estimate for base', async () => {
      const result = await executeEstimatePaymentFee(
        { network: 'base', amount: '100', token: 'USDC' },
        { demoMode: true },
      )
      expect(result.network).toBe('base')
      expect(result.nativeSymbol).toBe('ETH')
      expect(result.gasLimit).toBeDefined()
      expect(result.gasPriceGwei).toBeDefined()
      expect(result.nativeCost).toBeDefined()
      expect(result.usdCost).toContain('$')
    })

    it('should return fee estimate for polygon', async () => {
      const result = await executeEstimatePaymentFee(
        { network: 'polygon', amount: '50', token: 'USDC' },
        { demoMode: true },
      )
      expect(result.network).toBe('polygon')
      expect(result.nativeSymbol).toBe('MATIC')
    })
  })

  describe('formatter', () => {
    it('should format fee estimate', () => {
      const result = formatPaymentFeeEstimate({
        network: 'base',
        gasLimit: '65000',
        gasPriceGwei: '0.05',
        nativeCost: '0.00000325',
        nativeSymbol: 'ETH',
        usdCost: '$0.0106',
      })
      expect(result).toContain('Payment Fee Estimate')
      expect(result).toContain('base')
      expect(result).toContain('65000')
      expect(result).toContain('0.05')
      expect(result).toContain('ETH')
      expect(result).toContain('$0.0106')
    })
  })
})

// ---- Compare Network Fees Tool ----

describe('compareNetworkFees', () => {
  describe('schema', () => {
    it('should validate valid input', () => {
      const input = { amount: '100', token: 'USDC' }
      expect(() => compareNetworkFeesInputSchema.parse(input)).not.toThrow()
    })

    it('should accept optional networks', () => {
      const input = { amount: '100', token: 'USDC', networks: ['base', 'arbitrum'] }
      expect(() => compareNetworkFeesInputSchema.parse(input)).not.toThrow()
    })

    it('should reject missing amount', () => {
      expect(() => compareNetworkFeesInputSchema.parse({ token: 'USDC' })).toThrow()
    })

    it('should reject missing token', () => {
      expect(() => compareNetworkFeesInputSchema.parse({ amount: '100' })).toThrow()
    })
  })

  describe('execute (demo)', () => {
    it('should compare fees across networks for USDC', async () => {
      const result = await executeCompareNetworkFees(
        { amount: '100', token: 'USDC' },
        { demoMode: true },
      )
      expect(result.token).toBe('USDC')
      expect(result.amount).toBe('100')
      expect(result.fees.length).toBeGreaterThan(0)
      expect(result.cheapest).toBeDefined()
      // Should be sorted by cost ascending
      for (let i = 1; i < result.fees.length; i++) {
        const prevUsd = parseFloat(result.fees[i - 1].usdCost.replace('$', ''))
        const currUsd = parseFloat(result.fees[i].usdCost.replace('$', ''))
        expect(prevUsd).toBeLessThanOrEqual(currUsd)
      }
    })

    it('should compare fees for specific networks', async () => {
      const result = await executeCompareNetworkFees(
        { amount: '50', token: 'USDC', networks: ['ethereum', 'base'] },
        { demoMode: true },
      )
      expect(result.fees.length).toBe(2)
      const networks = result.fees.map((f) => f.network)
      expect(networks).toContain('ethereum')
      expect(networks).toContain('base')
    })

    it('should handle USDT0 (fewer networks)', async () => {
      const result = await executeCompareNetworkFees(
        { amount: '100', token: 'USDT0' },
        { demoMode: true },
      )
      expect(result.token).toBe('USDT0')
      expect(result.fees.length).toBeGreaterThan(0)
      // Only bridgeable chains support USDT0
      for (const fee of result.fees) {
        expect(['ethereum', 'arbitrum', 'ink', 'berachain', 'unichain']).toContain(fee.network)
      }
    })
  })

  describe('formatter', () => {
    it('should format comparison table', () => {
      const result = formatNetworkFeeComparison({
        token: 'USDC',
        amount: '100',
        cheapest: 'base',
        fees: [
          {
            network: 'base',
            gasLimit: '65000',
            gasPriceGwei: '0.05',
            nativeCost: '0.00000325',
            nativeSymbol: 'ETH',
            usdCost: '$0.0106',
          },
          {
            network: 'ethereum',
            gasLimit: '65000',
            gasPriceGwei: '25',
            nativeCost: '0.001625',
            nativeSymbol: 'ETH',
            usdCost: '$5.2819',
          },
        ],
      })
      expect(result).toContain('Network Fee Comparison')
      expect(result).toContain('USDC')
      expect(result).toContain('base')
      expect(result).toContain('ethereum')
      expect(result).toContain('Cheapest')
    })
  })
})

// ---- Tool Definitions ----

describe('Price/Fee Tool Definitions', () => {
  it('should define all 4 new tools', () => {
    expect(TOOL_DEFINITIONS).toHaveProperty('t402/getTokenPrice')
    expect(TOOL_DEFINITIONS).toHaveProperty('t402/getGasPrice')
    expect(TOOL_DEFINITIONS).toHaveProperty('t402/estimatePaymentFee')
    expect(TOOL_DEFINITIONS).toHaveProperty('t402/compareNetworkFees')
  })

  it('should have 12 total base tool definitions', () => {
    expect(Object.keys(TOOL_DEFINITIONS)).toHaveLength(12)
  })

  it('each new tool should have name, description, inputSchema', () => {
    const newTools = [
      't402/getTokenPrice',
      't402/getGasPrice',
      't402/estimatePaymentFee',
      't402/compareNetworkFees',
    ]
    for (const toolName of newTools) {
      const tool = TOOL_DEFINITIONS[toolName as keyof typeof TOOL_DEFINITIONS]
      expect(tool.name).toBe(toolName)
      expect(tool.description).toBeTruthy()
      expect(tool.inputSchema).toBeDefined()
      expect(tool.inputSchema.type).toBe('object')
      expect(tool.inputSchema.properties).toBeDefined()
      expect(tool.inputSchema.required).toBeDefined()
    }
  })

  it('none of the new tools should have confirmed (they are read-only)', () => {
    const newTools = [
      't402/getTokenPrice',
      't402/getGasPrice',
      't402/estimatePaymentFee',
      't402/compareNetworkFees',
    ]
    for (const toolName of newTools) {
      const tool = TOOL_DEFINITIONS[toolName as keyof typeof TOOL_DEFINITIONS]
      expect(tool.inputSchema.properties).not.toHaveProperty('confirmed')
    }
  })
})
