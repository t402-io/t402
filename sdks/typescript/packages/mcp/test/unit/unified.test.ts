import { describe, it, expect } from 'vitest'
import {
  // Unified tool schemas
  smartPayInputSchema,
  paymentPlanInputSchema,
  // Demo executors
  executeSmartPayDemo,
  executePaymentPlanDemo,
  // Formatters
  formatSmartPayResult,
  formatPaymentPlanResult,
  // Tool definitions
  UNIFIED_TOOL_DEFINITIONS,
  TOOL_DEFINITIONS,
  WDK_TOOL_DEFINITIONS,
} from '../../src/tools/index.js'
import { T402McpServer, createT402McpServer, loadConfigFromEnv } from '../../src/server/index.js'

// ---- Schema Validation ----

describe('Unified Tool Input Schemas', () => {
  describe('smartPayInputSchema', () => {
    it('should accept url only', () => {
      const input = { url: 'https://api.example.com/premium' }
      expect(() => smartPayInputSchema.parse(input)).not.toThrow()
    })

    it('should accept all optional fields', () => {
      const input = {
        url: 'https://api.example.com/premium',
        maxBridgeFee: '0.01',
        preferredNetwork: 'arbitrum',
      }
      expect(() => smartPayInputSchema.parse(input)).not.toThrow()
    })

    it('should reject invalid url', () => {
      expect(() => smartPayInputSchema.parse({ url: 'not-a-url' })).toThrow()
    })

    it('should reject invalid maxBridgeFee format', () => {
      const input = {
        url: 'https://api.example.com/premium',
        maxBridgeFee: 'abc',
      }
      expect(() => smartPayInputSchema.parse(input)).toThrow()
    })
  })

  describe('paymentPlanInputSchema', () => {
    it('should accept paymentRequired object', () => {
      const input = {
        paymentRequired: {
          scheme: 'exact',
          network: 'eip155:42161',
          maxAmountRequired: '1000000',
        },
      }
      expect(() => paymentPlanInputSchema.parse(input)).not.toThrow()
    })

    it('should accept empty paymentRequired object', () => {
      const input = { paymentRequired: {} }
      expect(() => paymentPlanInputSchema.parse(input)).not.toThrow()
    })

    it('should reject missing paymentRequired', () => {
      expect(() => paymentPlanInputSchema.parse({})).toThrow()
    })
  })
})

// ---- Demo Mode Executors ----

describe('Unified Demo Mode Executors', () => {
  describe('executeSmartPayDemo', () => {
    it('should return demo smartpay result', () => {
      const input = { url: 'https://api.example.com/premium' }
      const result = executeSmartPayDemo(input)
      expect(result.success).toBe(true)
      expect(result.statusCode).toBe(200)
      expect(result.body).toContain('Demo')
      expect(result.body).toContain(input.url)
      expect(result.steps).toBeInstanceOf(Array)
      expect(result.steps.length).toBeGreaterThan(0)
      expect(result.payment).toBeDefined()
      expect(result.payment!.network).toContain('eip155:')
    })

    it('should use preferred network in demo', () => {
      const input = { url: 'https://api.example.com/premium', preferredNetwork: 'base' }
      const result = executeSmartPayDemo(input)
      expect(result.steps[0].detail).toContain('base')
    })
  })

  describe('executePaymentPlanDemo', () => {
    it('should return demo payment plan', () => {
      const input = {
        paymentRequired: { scheme: 'exact', network: 'eip155:42161' },
      }
      const result = executePaymentPlanDemo(input)
      expect(result.viable).toBe(true)
      expect(result.recommendedNetwork).toBe('arbitrum')
      expect(result.balances).toBeInstanceOf(Array)
      expect(result.balances.length).toBe(3)
      expect(result.bridgeRequired).toBe(false)
    })
  })
})

// ---- Formatters ----

describe('Unified Tool Formatters', () => {
  it('formatSmartPayResult should show steps and payment', () => {
    const result = formatSmartPayResult({
      success: true,
      statusCode: 200,
      body: 'Content here',
      contentType: 'text/plain',
      steps: [
        { action: 'check_balance', status: 'success', detail: 'Checked balances' },
        { action: 'pay', status: 'success', detail: 'Paid 1 USDT0' },
      ],
      payment: {
        network: 'eip155:42161',
        scheme: 'exact',
        amount: '1000000',
        payTo: '0xC88f67e776f16DcFBf42e6bDda1B82604448899B',
      },
    })
    expect(result).toContain('SmartPay Result')
    expect(result).toContain('Success')
    expect(result).toContain('Steps')
    expect(result).toContain('[OK]')
    expect(result).toContain('check_balance')
    expect(result).toContain('Payment Details')
    expect(result).toContain('eip155:42161')
  })

  it('formatSmartPayResult should show error', () => {
    const result = formatSmartPayResult({
      success: false,
      statusCode: 402,
      body: '',
      steps: [
        { action: 'check_balance', status: 'failed', detail: 'No balance' },
      ],
      error: 'Insufficient funds',
    })
    expect(result).toContain('Failed')
    expect(result).toContain('[FAIL]')
    expect(result).toContain('Insufficient funds')
  })

  it('formatPaymentPlanResult should show viable plan', () => {
    const result = formatPaymentPlanResult({
      viable: true,
      recommendedNetwork: 'arbitrum',
      availableBalance: '500000000',
      bridgeRequired: false,
      balances: [
        { chain: 'ethereum', usdt0: '100.00', usdc: '250.00' },
        { chain: 'arbitrum', usdt0: '500.00', usdc: '0' },
      ],
    })
    expect(result).toContain('Payment Plan')
    expect(result).toContain('Viable:** Yes')
    expect(result).toContain('arbitrum')
    expect(result).toContain('Chain Balances')
    expect(result).toContain('500.00')
  })

  it('formatPaymentPlanResult should show non-viable with reason', () => {
    const result = formatPaymentPlanResult({
      viable: false,
      bridgeRequired: false,
      balances: [],
      reason: 'Insufficient balance across all chains',
    })
    expect(result).toContain('Viable:** No')
    expect(result).toContain('Insufficient balance')
  })

  it('formatPaymentPlanResult should show bridge details', () => {
    const result = formatPaymentPlanResult({
      viable: true,
      recommendedNetwork: 'ethereum',
      availableBalance: '100000000',
      bridgeRequired: true,
      bridgeDetails: {
        fromChain: 'ethereum',
        toChain: 'arbitrum',
        amount: '1000000',
        estimatedFee: '0.001',
      },
      balances: [{ chain: 'ethereum', usdt0: '100.00', usdc: '0' }],
    })
    expect(result).toContain('Bridge Required')
    expect(result).toContain('ethereum')
    expect(result).toContain('arbitrum')
    expect(result).toContain('0.001')
  })
})

// ---- Tool Definitions ----

describe('Unified Tool Definitions', () => {
  it('should define 2 unified tools', () => {
    const toolNames = Object.keys(UNIFIED_TOOL_DEFINITIONS)
    expect(toolNames).toHaveLength(2)
    expect(toolNames).toContain('t402/smartPay')
    expect(toolNames).toContain('t402/paymentPlan')
  })

  it('each unified tool should have name, description, inputSchema', () => {
    for (const [key, tool] of Object.entries(UNIFIED_TOOL_DEFINITIONS)) {
      expect(tool.name).toBe(key)
      expect(tool.description).toBeTruthy()
      expect(tool.inputSchema).toBeDefined()
      expect(tool.inputSchema.type).toBe('object')
    }
  })

  it('smartPay should require url', () => {
    const tool = UNIFIED_TOOL_DEFINITIONS['t402/smartPay']
    expect(tool.inputSchema.required).toContain('url')
  })

  it('paymentPlan should require paymentRequired', () => {
    const tool = UNIFIED_TOOL_DEFINITIONS['t402/paymentPlan']
    expect(tool.inputSchema.required).toContain('paymentRequired')
  })
})

// ---- Server Unified Mode ----

describe('Server Unified Mode Configuration', () => {
  it('should create server with unified mode enabled', () => {
    const server = createT402McpServer({
      demoMode: true,
      seedPhrase: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      unifiedMode: true,
    })
    expect(server).toBeInstanceOf(T402McpServer)
  })

  it('loadConfigFromEnv should read unified mode', () => {
    const originalEnv = { ...process.env }
    process.env.T402_UNIFIED_MODE = 'true'

    const config = loadConfigFromEnv()

    process.env = originalEnv

    expect(config.unifiedMode).toBe(true)
  })

  it('loadConfigFromEnv should default unified mode to undefined', () => {
    const originalEnv = { ...process.env }
    delete process.env.T402_UNIFIED_MODE

    const config = loadConfigFromEnv()

    process.env = originalEnv

    expect(config.unifiedMode).toBeUndefined()
  })
})
