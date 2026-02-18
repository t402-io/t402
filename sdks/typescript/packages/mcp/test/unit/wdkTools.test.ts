import { describe, it, expect } from 'vitest'
import {
  // WDK tool schemas
  wdkGetWalletInputSchema,
  wdkGetBalancesInputSchema,
  wdkTransferInputSchema,
  wdkSwapInputSchema,
  autoPayInputSchema,
  // Demo executors
  executeWdkGetWalletDemo,
  executeWdkGetBalancesDemo,
  executeWdkTransferDemo,
  executeWdkSwapDemo,
  executeAutoPayDemo,
  // Formatters
  formatWdkWalletResult,
  formatWdkBalancesResult,
  formatWdkTransferResult,
  formatWdkSwapResult,
  formatAutoPayResult,
  // Tool definitions
  WDK_TOOL_DEFINITIONS,
  TOOL_DEFINITIONS,
} from '../../src/tools/index.js'
import { T402McpServer, createT402McpServer, loadConfigFromEnv } from '../../src/server/index.js'

// ---- Schema Validation ----

describe('WDK Tool Input Schemas', () => {
  describe('wdkGetWalletInputSchema', () => {
    it('should accept empty object', () => {
      expect(() => wdkGetWalletInputSchema.parse({})).not.toThrow()
    })
  })

  describe('wdkGetBalancesInputSchema', () => {
    it('should accept empty object (no chains filter)', () => {
      expect(() => wdkGetBalancesInputSchema.parse({})).not.toThrow()
    })

    it('should accept chains array', () => {
      const input = { chains: ['ethereum', 'arbitrum'] }
      expect(() => wdkGetBalancesInputSchema.parse(input)).not.toThrow()
    })
  })

  describe('wdkTransferInputSchema', () => {
    it('should validate valid transfer input', () => {
      const input = {
        to: '0x1234567890123456789012345678901234567890',
        amount: '10.50',
        token: 'USDC',
        chain: 'ethereum',
      }
      expect(() => wdkTransferInputSchema.parse(input)).not.toThrow()
    })

    it('should reject invalid amount format', () => {
      const input = {
        to: '0x1234567890123456789012345678901234567890',
        amount: 'abc',
        token: 'USDC',
        chain: 'ethereum',
      }
      expect(() => wdkTransferInputSchema.parse(input)).toThrow()
    })

    it('should reject invalid token', () => {
      const input = {
        to: '0x1234567890123456789012345678901234567890',
        amount: '10',
        token: 'BTC',
        chain: 'ethereum',
      }
      expect(() => wdkTransferInputSchema.parse(input)).toThrow()
    })

    it('should require all fields', () => {
      expect(() => wdkTransferInputSchema.parse({})).toThrow()
      expect(() => wdkTransferInputSchema.parse({ to: '0x1234' })).toThrow()
    })
  })

  describe('wdkSwapInputSchema', () => {
    it('should validate valid swap input', () => {
      const input = {
        fromToken: 'ETH',
        toToken: 'USDT0',
        amount: '1.0',
        chain: 'arbitrum',
      }
      expect(() => wdkSwapInputSchema.parse(input)).not.toThrow()
    })

    it('should reject invalid amount', () => {
      const input = {
        fromToken: 'ETH',
        toToken: 'USDT0',
        amount: '-1',
        chain: 'arbitrum',
      }
      expect(() => wdkSwapInputSchema.parse(input)).toThrow()
    })
  })

  describe('autoPayInputSchema', () => {
    it('should accept url only', () => {
      const input = { url: 'https://api.example.com/premium' }
      expect(() => autoPayInputSchema.parse(input)).not.toThrow()
    })

    it('should accept all optional fields', () => {
      const input = {
        url: 'https://api.example.com/premium',
        maxAmount: '10.00',
        preferredChain: 'arbitrum',
      }
      expect(() => autoPayInputSchema.parse(input)).not.toThrow()
    })

    it('should reject invalid url', () => {
      expect(() => autoPayInputSchema.parse({ url: 'not-a-url' })).toThrow()
    })

    it('should reject invalid maxAmount format', () => {
      const input = {
        url: 'https://api.example.com/premium',
        maxAmount: 'abc',
      }
      expect(() => autoPayInputSchema.parse(input)).toThrow()
    })
  })
})

// ---- Demo Mode Executors ----

describe('WDK Demo Mode Executors', () => {
  describe('executeWdkGetWalletDemo', () => {
    it('should return demo wallet info', () => {
      const result = executeWdkGetWalletDemo()
      expect(result.evmAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
      expect(result.chains).toBeInstanceOf(Array)
      expect(result.chains.length).toBeGreaterThan(0)
    })
  })

  describe('executeWdkGetBalancesDemo', () => {
    it('should return demo balances', () => {
      const result = executeWdkGetBalancesDemo()
      expect(result.chains).toBeInstanceOf(Array)
      expect(result.chains.length).toBe(3)
      expect(result.totalUsdt0).toBeDefined()
      expect(result.totalUsdc).toBeDefined()

      for (const chain of result.chains) {
        expect(chain.chain).toBeDefined()
        expect(chain.usdt0).toBeDefined()
        expect(chain.usdc).toBeDefined()
        expect(chain.native).toBeDefined()
      }
    })
  })

  describe('executeWdkTransferDemo', () => {
    it('should return demo transfer result', () => {
      const input = {
        to: '0x1234567890123456789012345678901234567890',
        amount: '10.50',
        token: 'USDC' as const,
        chain: 'ethereum',
      }
      const result = executeWdkTransferDemo(input)
      expect(result.txHash).toMatch(/^0xdemo/)
      expect(result.amount).toBe('10.50')
      expect(result.token).toBe('USDC')
      expect(result.chain).toBe('ethereum')
      expect(result.to).toBe(input.to)
      expect(result.explorerUrl).toContain(result.txHash)
    })
  })

  describe('executeWdkSwapDemo', () => {
    it('should return demo swap result with slippage', () => {
      const input = {
        fromToken: 'ETH',
        toToken: 'USDT0',
        amount: '1.0',
        chain: 'arbitrum',
      }
      const result = executeWdkSwapDemo(input)
      expect(result.fromAmount).toBe('1.0')
      expect(result.fromToken).toBe('ETH')
      expect(result.toToken).toBe('USDT0')
      expect(result.chain).toBe('arbitrum')
      expect(result.txHash).toMatch(/^0xdemo/)
      // ~0.3% slippage
      const toAmount = parseFloat(result.toAmount)
      expect(toAmount).toBeGreaterThan(0.99)
      expect(toAmount).toBeLessThan(1.0)
    })
  })

  describe('executeAutoPayDemo', () => {
    it('should return demo autopay result', () => {
      const input = { url: 'https://api.example.com/premium' }
      const result = executeAutoPayDemo(input)
      expect(result.success).toBe(true)
      expect(result.statusCode).toBe(200)
      expect(result.body).toContain('Demo')
      expect(result.body).toContain(input.url)
      expect(result.contentType).toBe('text/plain')
      expect(result.payment).toBeDefined()
      expect(result.payment!.network).toContain('eip155:')
      expect(result.payment!.scheme).toBe('exact')
      expect(result.payment!.amount).toBeDefined()
      expect(result.payment!.payTo).toMatch(/^0x/)
    })
  })
})

// ---- Formatters ----

describe('WDK Tool Formatters', () => {
  it('formatWdkWalletResult should produce readable output', () => {
    const result = formatWdkWalletResult({
      evmAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      chains: ['ethereum', 'arbitrum'],
    })
    expect(result).toContain('WDK Wallet Info')
    expect(result).toContain('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')
    expect(result).toContain('ethereum')
    expect(result).toContain('arbitrum')
  })

  it('formatWdkBalancesResult should show per-chain balances', () => {
    const result = formatWdkBalancesResult({
      chains: [
        { chain: 'ethereum', usdt0: '100.00', usdc: '250.00', native: '0.5' },
        { chain: 'arbitrum', usdt0: '500.00', usdc: '0', native: '0.01' },
      ],
      totalUsdt0: '600.00',
      totalUsdc: '250.00',
    })
    expect(result).toContain('Multi-Chain Balances')
    expect(result).toContain('600.00')
    expect(result).toContain('250.00')
    expect(result).toContain('ethereum')
    expect(result).toContain('arbitrum')
  })

  it('formatWdkTransferResult should show transfer details', () => {
    const result = formatWdkTransferResult({
      txHash: '0xabc123',
      amount: '10.50',
      token: 'USDC',
      chain: 'ethereum',
      to: '0x1234567890123456789012345678901234567890',
      explorerUrl: 'https://etherscan.io/tx/0xabc123',
    })
    expect(result).toContain('Transfer Complete')
    expect(result).toContain('10.50')
    expect(result).toContain('USDC')
    expect(result).toContain('0xabc123')
    expect(result).toContain('View Transaction')
  })

  it('formatWdkSwapResult should show swap details', () => {
    const result = formatWdkSwapResult({
      fromAmount: '1.0',
      fromToken: 'ETH',
      toAmount: '0.997',
      toToken: 'USDT0',
      chain: 'arbitrum',
      txHash: '0xdef456',
    })
    expect(result).toContain('Swap Result')
    expect(result).toContain('1.0 ETH')
    expect(result).toContain('0.997 USDT0')
    expect(result).toContain('0xdef456')
  })

  it('formatAutoPayResult should show success with payment', () => {
    const result = formatAutoPayResult({
      success: true,
      statusCode: 200,
      body: 'Premium content here',
      contentType: 'text/plain',
      payment: {
        network: 'eip155:42161',
        scheme: 'exact',
        amount: '1000000',
        payTo: '0xC88f67e776f16DcFBf42e6bDda1B82604448899B',
      },
    })
    expect(result).toContain('AutoPay Result')
    expect(result).toContain('Success')
    expect(result).toContain('Payment Details')
    expect(result).toContain('eip155:42161')
    expect(result).toContain('exact')
    expect(result).toContain('Premium content here')
  })

  it('formatAutoPayResult should show error', () => {
    const result = formatAutoPayResult({
      success: false,
      statusCode: 402,
      body: '',
      error: 'Payment amount exceeds max allowed',
    })
    expect(result).toContain('Failed')
    expect(result).toContain('402')
    expect(result).toContain('Payment amount exceeds max allowed')
  })
})

// ---- Tool Definitions ----

describe('WDK Tool Definitions', () => {
  it('should define 5 WDK tools', () => {
    const toolNames = Object.keys(WDK_TOOL_DEFINITIONS)
    expect(toolNames).toHaveLength(5)
    expect(toolNames).toContain('wdk/getWallet')
    expect(toolNames).toContain('wdk/getBalances')
    expect(toolNames).toContain('wdk/transfer')
    expect(toolNames).toContain('wdk/swap')
    expect(toolNames).toContain('t402/autoPay')
  })

  it('should define 6 base tools', () => {
    const toolNames = Object.keys(TOOL_DEFINITIONS)
    expect(toolNames).toHaveLength(6)
    expect(toolNames).toContain('t402/getBalance')
    expect(toolNames).toContain('t402/pay')
    expect(toolNames).toContain('t402/bridge')
  })

  it('each WDK tool should have name, description, inputSchema', () => {
    for (const [key, tool] of Object.entries(WDK_TOOL_DEFINITIONS)) {
      expect(tool.name).toBe(key)
      expect(tool.description).toBeTruthy()
      expect(tool.inputSchema).toBeDefined()
      expect(tool.inputSchema.type).toBe('object')
    }
  })
})

// ---- Server WDK Config ----

describe('Server WDK Configuration', () => {
  it('should create server with seed phrase config', () => {
    const server = createT402McpServer({
      demoMode: true,
      seedPhrase: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    })
    expect(server).toBeInstanceOf(T402McpServer)
  })

  it('should create server with wdkChains config', () => {
    const server = createT402McpServer({
      demoMode: true,
      seedPhrase: 'test seed phrase',
      wdkChains: ['ethereum', 'arbitrum'],
    })
    expect(server).toBeInstanceOf(T402McpServer)
  })

  it('loadConfigFromEnv should read WDK seed phrase', () => {
    const originalEnv = { ...process.env }
    process.env.T402_WDK_SEED_PHRASE = 'test seed phrase for wdk'

    const config = loadConfigFromEnv()

    process.env = originalEnv

    expect(config.seedPhrase).toBe('test seed phrase for wdk')
  })

  it('loadConfigFromEnv should read WDK chains', () => {
    const originalEnv = { ...process.env }
    process.env.T402_WDK_CHAINS = 'ethereum, arbitrum, base'

    const config = loadConfigFromEnv()

    process.env = originalEnv

    expect(config.wdkChains).toEqual(['ethereum', 'arbitrum', 'base'])
  })

  it('loadConfigFromEnv should handle missing WDK env vars', () => {
    const originalEnv = { ...process.env }
    delete process.env.T402_WDK_SEED_PHRASE
    delete process.env.T402_WDK_CHAINS

    const config = loadConfigFromEnv()

    process.env = originalEnv

    expect(config.seedPhrase).toBeUndefined()
    expect(config.wdkChains).toBeUndefined()
  })
})
