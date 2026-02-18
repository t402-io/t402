import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { T402McpServer, createT402McpServer } from '../../src/server/index.js'
import { TOOL_DEFINITIONS, WDK_TOOL_DEFINITIONS } from '../../src/tools/index.js'
import { startMockFacilitator, type MockFacilitator } from './setup.js'

/**
 * MCP Tools E2E Tests
 *
 * Tests each MCP tool end-to-end using a demo-mode server
 * and a mock facilitator HTTP endpoint.
 */
describe('MCP Tools E2E', () => {
  let facilitator: MockFacilitator
  let server: T402McpServer

  const TEST_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678'

  beforeAll(async () => {
    facilitator = await startMockFacilitator()

    server = createT402McpServer({
      demoMode: true,
    })
  })

  afterAll(async () => {
    await facilitator.stop()
  })

  describe('t402/getBalance', () => {
    it('should return balance for valid address on valid network', async () => {
      const definition = TOOL_DEFINITIONS['t402/getBalance']
      expect(definition).toBeDefined()
      expect(definition.name).toBe('t402/getBalance')
      expect(definition.inputSchema.required).toContain('network')
      expect(definition.inputSchema.required).toContain('address')
    })

    it('should have correct input schema properties', () => {
      const schema = TOOL_DEFINITIONS['t402/getBalance'].inputSchema
      expect(schema.properties.network).toBeDefined()
      expect(schema.properties.address).toBeDefined()
      expect(schema.properties.network.type).toBe('string')
      expect(schema.properties.address.type).toBe('string')
    })

    it('should list all supported networks in enum', () => {
      const schema = TOOL_DEFINITIONS['t402/getBalance'].inputSchema
      const networks = schema.properties.network.enum
      expect(networks).toContain('ethereum')
      expect(networks).toContain('base')
      expect(networks).toContain('arbitrum')
      expect(networks).toContain('optimism')
      expect(networks).toContain('polygon')
      expect(networks).toContain('avalanche')
      expect(networks).toContain('ink')
      expect(networks).toContain('berachain')
      expect(networks).toContain('unichain')
    })
  })

  describe('t402/getAllBalances', () => {
    it('should have correct tool definition', () => {
      const definition = TOOL_DEFINITIONS['t402/getAllBalances']
      expect(definition).toBeDefined()
      expect(definition.name).toBe('t402/getAllBalances')
      expect(definition.inputSchema.required).toContain('address')
    })

    it('should accept optional networks parameter', () => {
      const schema = TOOL_DEFINITIONS['t402/getAllBalances'].inputSchema
      expect(schema.properties.address).toBeDefined()
      expect(schema.properties.networks).toBeDefined()
      expect(schema.properties.networks.type).toBe('array')
    })
  })

  describe('t402/pay', () => {
    it('should have correct tool definition with all required fields', () => {
      const definition = TOOL_DEFINITIONS['t402/pay']
      expect(definition).toBeDefined()
      expect(definition.inputSchema.required).toEqual(
        expect.arrayContaining(['to', 'amount', 'token', 'network']),
      )
    })

    it('should support USDC, USDT, and USDT0 tokens', () => {
      const tokenEnum = TOOL_DEFINITIONS['t402/pay'].inputSchema.properties.token.enum
      expect(tokenEnum).toEqual(['USDC', 'USDT', 'USDT0'])
    })

    it('should have optional memo field', () => {
      const schema = TOOL_DEFINITIONS['t402/pay'].inputSchema
      expect(schema.properties.memo).toBeDefined()
      expect(schema.required).not.toContain('memo')
    })
  })

  describe('t402/payGasless', () => {
    it('should have correct tool definition', () => {
      const definition = TOOL_DEFINITIONS['t402/payGasless']
      expect(definition).toBeDefined()
      expect(definition.inputSchema.required).toEqual(
        expect.arrayContaining(['to', 'amount', 'token', 'network']),
      )
    })

    it('should only list gasless-supported networks', () => {
      const networkEnum = TOOL_DEFINITIONS['t402/payGasless'].inputSchema.properties.network.enum
      // Gasless-supported networks
      expect(networkEnum).toContain('ethereum')
      expect(networkEnum).toContain('base')
      expect(networkEnum).toContain('arbitrum')
      // Not gasless-supported
      expect(networkEnum).not.toContain('ink')
      expect(networkEnum).not.toContain('berachain')
    })
  })

  describe('t402/getBridgeFee', () => {
    it('should have correct tool definition', () => {
      const definition = TOOL_DEFINITIONS['t402/getBridgeFee']
      expect(definition).toBeDefined()
      expect(definition.inputSchema.required).toEqual(
        expect.arrayContaining(['fromChain', 'toChain', 'amount', 'recipient']),
      )
    })

    it('should only list bridgeable chains', () => {
      const fromEnum = TOOL_DEFINITIONS['t402/getBridgeFee'].inputSchema.properties.fromChain.enum
      expect(fromEnum).toContain('ethereum')
      expect(fromEnum).toContain('arbitrum')
      expect(fromEnum).toContain('ink')
      expect(fromEnum).toContain('berachain')
      expect(fromEnum).toContain('unichain')
      // base is not bridgeable
      expect(fromEnum).not.toContain('base')
    })
  })

  describe('t402/bridge', () => {
    it('should have correct tool definition', () => {
      const definition = TOOL_DEFINITIONS['t402/bridge']
      expect(definition).toBeDefined()
      expect(definition.inputSchema.required).toEqual(
        expect.arrayContaining(['fromChain', 'toChain', 'amount', 'recipient']),
      )
    })

    it('should use same chains as getBridgeFee', () => {
      const bridgeChains = TOOL_DEFINITIONS['t402/bridge'].inputSchema.properties.fromChain.enum
      const feeChains = TOOL_DEFINITIONS['t402/getBridgeFee'].inputSchema.properties.fromChain.enum
      expect(bridgeChains).toEqual(feeChains)
    })
  })

  describe('WDK Tools', () => {
    it('should define wdk/getWallet tool', () => {
      const definition = WDK_TOOL_DEFINITIONS['wdk/getWallet']
      expect(definition).toBeDefined()
      expect(definition.name).toBe('wdk/getWallet')
      expect(definition.inputSchema.required).toEqual([])
    })

    it('should define wdk/getBalances tool', () => {
      const definition = WDK_TOOL_DEFINITIONS['wdk/getBalances']
      expect(definition).toBeDefined()
      expect(definition.name).toBe('wdk/getBalances')
    })

    it('should define wdk/transfer tool', () => {
      const definition = WDK_TOOL_DEFINITIONS['wdk/transfer']
      expect(definition).toBeDefined()
      expect(definition.inputSchema.required).toEqual(
        expect.arrayContaining(['to', 'amount', 'token', 'chain']),
      )
    })

    it('should define wdk/swap tool', () => {
      const definition = WDK_TOOL_DEFINITIONS['wdk/swap']
      expect(definition).toBeDefined()
      expect(definition.inputSchema.required).toEqual(
        expect.arrayContaining(['fromToken', 'toToken', 'amount', 'chain']),
      )
    })

    it('should define t402/autoPay tool', () => {
      const definition = WDK_TOOL_DEFINITIONS['t402/autoPay']
      expect(definition).toBeDefined()
      expect(definition.inputSchema.required).toContain('url')
    })
  })

  describe('Tool completeness', () => {
    it('should have 6 base tool definitions', () => {
      expect(Object.keys(TOOL_DEFINITIONS)).toHaveLength(6)
    })

    it('should have 5 WDK tool definitions', () => {
      expect(Object.keys(WDK_TOOL_DEFINITIONS)).toHaveLength(5)
    })

    it('should have unique tool names', () => {
      const allNames = [
        ...Object.keys(TOOL_DEFINITIONS),
        ...Object.keys(WDK_TOOL_DEFINITIONS),
      ]
      const uniqueNames = new Set(allNames)
      expect(uniqueNames.size).toBe(allNames.length)
    })

    it('should have descriptions for all tools', () => {
      for (const [, def] of Object.entries(TOOL_DEFINITIONS)) {
        expect(def.description).toBeTruthy()
        expect(def.description.length).toBeGreaterThan(10)
      }
      for (const [, def] of Object.entries(WDK_TOOL_DEFINITIONS)) {
        expect(def.description).toBeTruthy()
        expect(def.description.length).toBeGreaterThan(10)
      }
    })
  })
})
