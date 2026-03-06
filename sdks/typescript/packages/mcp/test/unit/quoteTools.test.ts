import { describe, it, expect, beforeEach } from 'vitest'
import {
  // Quote store
  createQuote,
  getQuote,
  deleteQuote,
  clearQuoteStore,
  // Quote swap
  wdkQuoteSwapInputSchema,
  executeWdkQuoteSwapDemo,
  formatSwapQuoteResult,
  // Execute swap
  wdkExecuteSwapInputSchema,
  executeWdkExecuteSwapDemo,
  formatExecuteSwapResult,
  // Quote bridge
  quoteBridgeInputSchema,
  executeQuoteBridgeDemo,
  formatBridgeQuoteResult,
  // Execute bridge
  executeBridgeFromQuoteInputSchema,
  executeExecuteBridgeFromQuoteDemo,
  formatExecuteBridgeFromQuoteResult,
  // Tool definitions
  TOOL_DEFINITIONS,
  WDK_TOOL_DEFINITIONS,
} from '../../src/tools/index.js'

// ---- Quote Store ----

describe('Quote Store', () => {
  beforeEach(() => {
    clearQuoteStore()
  })

  it('should create and retrieve a quote', () => {
    const quoteId = createQuote('swap', { fromToken: 'ETH', toToken: 'USDT0' })
    const quote = getQuote(quoteId)
    expect(quote).toBeDefined()
    expect(quote!.type).toBe('swap')
    expect(quote!.data.fromToken).toBe('ETH')
  })

  it('should return null for non-existent quote', () => {
    const quote = getQuote('00000000-0000-0000-0000-000000000000')
    expect(quote).toBeNull()
  })

  it('should delete a quote', () => {
    const quoteId = createQuote('bridge', { fromChain: 'ethereum' })
    expect(getQuote(quoteId)).toBeDefined()
    deleteQuote(quoteId)
    expect(getQuote(quoteId)).toBeNull()
  })

  it('should return null for expired quotes', () => {
    const quoteId = createQuote('swap', { test: true }, -1) // TTL = -1ms (already expired)
    // Quote should be expired immediately
    const quote = getQuote(quoteId)
    expect(quote).toBeNull()
  })
})

// ---- Quote Swap Schemas ----

describe('Quote Swap Input Schemas', () => {
  describe('wdkQuoteSwapInputSchema', () => {
    it('should validate valid input', () => {
      const input = {
        fromToken: 'ETH',
        toToken: 'USDT0',
        amount: '1.0',
        chain: 'arbitrum',
      }
      expect(() => wdkQuoteSwapInputSchema.parse(input)).not.toThrow()
    })

    it('should reject invalid amount', () => {
      const input = {
        fromToken: 'ETH',
        toToken: 'USDT0',
        amount: 'abc',
        chain: 'arbitrum',
      }
      expect(() => wdkQuoteSwapInputSchema.parse(input)).toThrow()
    })

    it('should require all fields', () => {
      expect(() => wdkQuoteSwapInputSchema.parse({})).toThrow()
    })
  })

  describe('wdkExecuteSwapInputSchema', () => {
    it('should validate valid input with quoteId', () => {
      const input = {
        quoteId: '12345678-1234-1234-1234-123456789abc',
      }
      expect(() => wdkExecuteSwapInputSchema.parse(input)).not.toThrow()
    })

    it('should accept confirmed: true', () => {
      const input = {
        quoteId: '12345678-1234-1234-1234-123456789abc',
        confirmed: true,
      }
      const parsed = wdkExecuteSwapInputSchema.parse(input)
      expect(parsed.confirmed).toBe(true)
    })

    it('should reject invalid UUID', () => {
      const input = { quoteId: 'not-a-uuid' }
      expect(() => wdkExecuteSwapInputSchema.parse(input)).toThrow()
    })
  })

  describe('quoteBridgeInputSchema', () => {
    it('should validate valid input', () => {
      const input = {
        fromChain: 'ethereum',
        toChain: 'arbitrum',
        amount: '100',
        recipient: '0x1234567890123456789012345678901234567890',
      }
      expect(() => quoteBridgeInputSchema.parse(input)).not.toThrow()
    })

    it('should reject unsupported chain', () => {
      const input = {
        fromChain: 'base',
        toChain: 'ethereum',
        amount: '100',
        recipient: '0x1234567890123456789012345678901234567890',
      }
      expect(() => quoteBridgeInputSchema.parse(input)).toThrow()
    })
  })

  describe('executeBridgeFromQuoteInputSchema', () => {
    it('should validate valid input', () => {
      const input = {
        quoteId: '12345678-1234-1234-1234-123456789abc',
      }
      expect(() => executeBridgeFromQuoteInputSchema.parse(input)).not.toThrow()
    })

    it('should accept confirmed: true', () => {
      const input = {
        quoteId: '12345678-1234-1234-1234-123456789abc',
        confirmed: true,
      }
      const parsed = executeBridgeFromQuoteInputSchema.parse(input)
      expect(parsed.confirmed).toBe(true)
    })
  })
})

// ---- Demo Mode Executors ----

describe('Quote Demo Mode Executors', () => {
  beforeEach(() => {
    clearQuoteStore()
  })

  describe('executeWdkQuoteSwapDemo', () => {
    it('should return a swap quote with quoteId', () => {
      const result = executeWdkQuoteSwapDemo({
        fromToken: 'ETH',
        toToken: 'USDT0',
        amount: '1.0',
        chain: 'arbitrum',
      })
      expect(result.quoteId).toBeDefined()
      expect(result.fromToken).toBe('ETH')
      expect(result.toToken).toBe('USDT0')
      expect(result.fromAmount).toBe('1.0')
      expect(result.exchangeRate).toBeDefined()
      expect(result.fee).toBe('0.3%')
      expect(result.expiresAt).toBeDefined()
      expect(result.chain).toBe('arbitrum')
    })

    it('should store quote in quote store', () => {
      const result = executeWdkQuoteSwapDemo({
        fromToken: 'ETH',
        toToken: 'USDT0',
        amount: '1.0',
        chain: 'arbitrum',
      })
      const quote = getQuote(result.quoteId)
      expect(quote).toBeDefined()
      expect(quote!.type).toBe('swap')
    })
  })

  describe('executeWdkExecuteSwapDemo', () => {
    it('should return confirmation prompt when not confirmed', () => {
      const quoteResult = executeWdkQuoteSwapDemo({
        fromToken: 'ETH',
        toToken: 'USDT0',
        amount: '1.0',
        chain: 'arbitrum',
      })

      const result = executeWdkExecuteSwapDemo({ quoteId: quoteResult.quoteId })
      expect('needsConfirmation' in result).toBe(true)
      if ('needsConfirmation' in result) {
        expect(result.needsConfirmation).toBe(true)
        expect(result.summary).toContain('ETH')
        expect(result.summary).toContain('USDT0')
      }
    })

    it('should execute swap when confirmed', () => {
      const quoteResult = executeWdkQuoteSwapDemo({
        fromToken: 'ETH',
        toToken: 'USDT0',
        amount: '1.0',
        chain: 'arbitrum',
      })

      const result = executeWdkExecuteSwapDemo({
        quoteId: quoteResult.quoteId,
        confirmed: true,
      })
      expect('txHash' in result).toBe(true)
      if ('txHash' in result) {
        expect(result.fromAmount).toBe('1.0')
        expect(result.fromToken).toBe('ETH')
        expect(result.toToken).toBe('USDT0')
        expect(result.chain).toBe('arbitrum')
        expect(result.txHash).toMatch(/^0xdemo/)
      }
    })

    it('should consume quote after execution', () => {
      const quoteResult = executeWdkQuoteSwapDemo({
        fromToken: 'ETH',
        toToken: 'USDT0',
        amount: '1.0',
        chain: 'arbitrum',
      })

      executeWdkExecuteSwapDemo({
        quoteId: quoteResult.quoteId,
        confirmed: true,
      })

      // Quote should be consumed
      expect(getQuote(quoteResult.quoteId)).toBeNull()
    })

    it('should throw for invalid quote', () => {
      expect(() =>
        executeWdkExecuteSwapDemo({
          quoteId: '00000000-0000-0000-0000-000000000000',
          confirmed: true,
        }),
      ).toThrow('Quote not found')
    })

    it('should throw for wrong quote type', () => {
      const quoteId = createQuote('bridge', { fromChain: 'ethereum' })
      expect(() =>
        executeWdkExecuteSwapDemo({ quoteId, confirmed: true }),
      ).toThrow('Invalid quote type')
    })
  })

  describe('executeQuoteBridgeDemo', () => {
    it('should return a bridge quote with quoteId', () => {
      const result = executeQuoteBridgeDemo({
        fromChain: 'ethereum',
        toChain: 'arbitrum',
        amount: '100',
        recipient: '0x1234567890123456789012345678901234567890',
      })
      expect(result.quoteId).toBeDefined()
      expect(result.fromChain).toBe('ethereum')
      expect(result.toChain).toBe('arbitrum')
      expect(result.amount).toBe('100')
      expect(result.nativeFee).toBeDefined()
      expect(result.nativeFeeFormatted).toBeDefined()
      expect(result.estimatedTime).toBeGreaterThan(0)
      expect(result.expiresAt).toBeDefined()
    })

    it('should store quote in quote store', () => {
      const result = executeQuoteBridgeDemo({
        fromChain: 'ethereum',
        toChain: 'arbitrum',
        amount: '100',
        recipient: '0x1234567890123456789012345678901234567890',
      })
      const quote = getQuote(result.quoteId)
      expect(quote).toBeDefined()
      expect(quote!.type).toBe('bridge')
    })

    it('should set longer estimated time for ethereum destination', () => {
      const result = executeQuoteBridgeDemo({
        fromChain: 'arbitrum',
        toChain: 'ethereum',
        amount: '100',
        recipient: '0x1234567890123456789012345678901234567890',
      })
      expect(result.estimatedTime).toBe(900) // 15 min for ethereum
    })
  })

  describe('executeExecuteBridgeFromQuoteDemo', () => {
    it('should return confirmation prompt when not confirmed', () => {
      const quoteResult = executeQuoteBridgeDemo({
        fromChain: 'ethereum',
        toChain: 'arbitrum',
        amount: '100',
        recipient: '0x1234567890123456789012345678901234567890',
      })

      const result = executeExecuteBridgeFromQuoteDemo({ quoteId: quoteResult.quoteId })
      expect('needsConfirmation' in result).toBe(true)
      if ('needsConfirmation' in result) {
        expect(result.needsConfirmation).toBe(true)
        expect(result.summary).toContain('100')
        expect(result.summary).toContain('ethereum')
        expect(result.summary).toContain('arbitrum')
      }
    })

    it('should execute bridge when confirmed', () => {
      const quoteResult = executeQuoteBridgeDemo({
        fromChain: 'ethereum',
        toChain: 'arbitrum',
        amount: '100',
        recipient: '0x1234567890123456789012345678901234567890',
      })

      const result = executeExecuteBridgeFromQuoteDemo({
        quoteId: quoteResult.quoteId,
        confirmed: true,
      })
      expect('txHash' in result).toBe(true)
      if ('txHash' in result) {
        expect(result.amount).toBe('100')
        expect(result.fromChain).toBe('ethereum')
        expect(result.toChain).toBe('arbitrum')
        expect(result.txHash).toBeDefined()
        expect(result.trackingUrl).toContain('layerzeroscan')
      }
    })

    it('should consume quote after execution', () => {
      const quoteResult = executeQuoteBridgeDemo({
        fromChain: 'ethereum',
        toChain: 'arbitrum',
        amount: '100',
        recipient: '0x1234567890123456789012345678901234567890',
      })

      executeExecuteBridgeFromQuoteDemo({
        quoteId: quoteResult.quoteId,
        confirmed: true,
      })

      expect(getQuote(quoteResult.quoteId)).toBeNull()
    })

    it('should throw for invalid quote', () => {
      expect(() =>
        executeExecuteBridgeFromQuoteDemo({
          quoteId: '00000000-0000-0000-0000-000000000000',
          confirmed: true,
        }),
      ).toThrow('Quote not found')
    })

    it('should throw for wrong quote type', () => {
      const quoteId = createQuote('swap', { fromToken: 'ETH' })
      expect(() =>
        executeExecuteBridgeFromQuoteDemo({ quoteId, confirmed: true }),
      ).toThrow('Invalid quote type')
    })
  })
})

// ---- Formatters ----

describe('Quote Tool Formatters', () => {
  it('formatSwapQuoteResult should show quote details', () => {
    const result = formatSwapQuoteResult({
      quoteId: '12345678-1234-1234-1234-123456789abc',
      fromToken: 'ETH',
      toToken: 'USDT0',
      fromAmount: '1.0',
      toAmount: '0.997000',
      exchangeRate: '0.997000',
      fee: '0.3%',
      priceImpact: '< 0.1%',
      expiresAt: '2026-03-07T00:00:00.000Z',
      chain: 'arbitrum',
    })
    expect(result).toContain('Swap Quote')
    expect(result).toContain('12345678-1234-1234-1234-123456789abc')
    expect(result).toContain('1.0 ETH')
    expect(result).toContain('0.997000 USDT0')
    expect(result).toContain('0.3%')
    expect(result).toContain('arbitrum')
    expect(result).toContain('wdk/executeSwap')
  })

  it('formatExecuteSwapResult should show swap details', () => {
    const result = formatExecuteSwapResult({
      fromAmount: '1.0',
      fromToken: 'ETH',
      toAmount: '0.997000',
      toToken: 'USDT0',
      chain: 'arbitrum',
      txHash: '0xdemo12345678',
    })
    expect(result).toContain('Swap Executed')
    expect(result).toContain('1.0 ETH')
    expect(result).toContain('0.997000 USDT0')
    expect(result).toContain('0xdemo12345678')
  })

  it('formatBridgeQuoteResult should show bridge quote details', () => {
    const result = formatBridgeQuoteResult({
      quoteId: '12345678-1234-1234-1234-123456789abc',
      fromChain: 'ethereum',
      toChain: 'arbitrum',
      amount: '100',
      recipient: '0x1234567890123456789012345678901234567890',
      nativeFee: '1000000000000000',
      nativeFeeFormatted: '0.001 ETH',
      estimatedTime: 300,
      expiresAt: '2026-03-07T00:00:00.000Z',
    })
    expect(result).toContain('Bridge Quote')
    expect(result).toContain('12345678-1234-1234-1234-123456789abc')
    expect(result).toContain('ethereum')
    expect(result).toContain('arbitrum')
    expect(result).toContain('100 USDT0')
    expect(result).toContain('0.001 ETH')
    expect(result).toContain('5 minutes')
    expect(result).toContain('t402/executeBridge')
  })

  it('formatExecuteBridgeFromQuoteResult should show bridge result', () => {
    const result = formatExecuteBridgeFromQuoteResult({
      txHash: '0x' + 'a'.repeat(64) as `0x${string}`,
      messageGuid: '0x' + 'b'.repeat(64) as `0x${string}`,
      amount: '100',
      fromChain: 'ethereum',
      toChain: 'arbitrum',
      estimatedTime: 300,
      trackingUrl: 'https://layerzeroscan.com/tx/0x' + 'b'.repeat(64),
    })
    expect(result).toContain('Bridge Transaction')
    expect(result).toContain('ethereum')
    expect(result).toContain('arbitrum')
    expect(result).toContain('100')
  })
})

// ---- Tool Definitions ----

describe('Quote Tool Definitions', () => {
  it('TOOL_DEFINITIONS should include t402/quoteBridge', () => {
    const tool = TOOL_DEFINITIONS['t402/quoteBridge']
    expect(tool).toBeDefined()
    expect(tool.name).toBe('t402/quoteBridge')
    expect(tool.inputSchema.required).toEqual(
      expect.arrayContaining(['fromChain', 'toChain', 'amount', 'recipient']),
    )
  })

  it('TOOL_DEFINITIONS should include t402/executeBridgeQuote', () => {
    const tool = TOOL_DEFINITIONS['t402/executeBridgeQuote']
    expect(tool).toBeDefined()
    expect(tool.name).toBe('t402/executeBridgeQuote')
    expect(tool.inputSchema.required).toContain('quoteId')
    expect(tool.inputSchema.properties).toHaveProperty('confirmed')
  })

  it('WDK_TOOL_DEFINITIONS should include wdk/quoteSwap', () => {
    const tool = WDK_TOOL_DEFINITIONS['wdk/quoteSwap']
    expect(tool).toBeDefined()
    expect(tool.name).toBe('wdk/quoteSwap')
    expect(tool.inputSchema.required).toEqual(
      expect.arrayContaining(['fromToken', 'toToken', 'amount', 'chain']),
    )
  })

  it('WDK_TOOL_DEFINITIONS should include wdk/executeSwap', () => {
    const tool = WDK_TOOL_DEFINITIONS['wdk/executeSwap']
    expect(tool).toBeDefined()
    expect(tool.name).toBe('wdk/executeSwap')
    expect(tool.inputSchema.required).toContain('quoteId')
    expect(tool.inputSchema.properties).toHaveProperty('confirmed')
  })

  it('quote execute tools should NOT be read-only (have confirmed param)', () => {
    const executeBridgeQuote = TOOL_DEFINITIONS['t402/executeBridgeQuote']
    const executeSwap = WDK_TOOL_DEFINITIONS['wdk/executeSwap']
    expect(executeBridgeQuote.inputSchema.properties).toHaveProperty('confirmed')
    expect(executeSwap.inputSchema.properties).toHaveProperty('confirmed')
  })

  it('quote tools should be read-only (no confirmed param)', () => {
    const quoteBridge = TOOL_DEFINITIONS['t402/quoteBridge']
    const quoteSwap = WDK_TOOL_DEFINITIONS['wdk/quoteSwap']
    expect(quoteBridge.inputSchema.properties).not.toHaveProperty('confirmed')
    expect(quoteSwap.inputSchema.properties).not.toHaveProperty('confirmed')
  })
})
