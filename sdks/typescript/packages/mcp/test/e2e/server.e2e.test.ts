import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { T402McpServer, createT402McpServer } from '../../src/server/index.js'
import { TOOL_DEFINITIONS, WDK_TOOL_DEFINITIONS } from '../../src/tools/index.js'
import { startMockFacilitator, type MockFacilitator } from './setup.js'

/**
 * MCP Server E2E Tests
 *
 * Tests the MCP server lifecycle, tool listing, and error handling
 * using a demo-mode server configuration.
 */
describe('MCP Server E2E', () => {
  let facilitator: MockFacilitator

  beforeAll(async () => {
    facilitator = await startMockFacilitator()
  })

  afterAll(async () => {
    await facilitator.stop()
  })

  describe('Server Lifecycle', () => {
    it('should create server in demo mode', () => {
      const server = createT402McpServer({ demoMode: true })
      expect(server).toBeInstanceOf(T402McpServer)
    })

    it('should create server with default config', () => {
      const server = createT402McpServer()
      expect(server).toBeInstanceOf(T402McpServer)
    })

    it('should create server with custom RPC URLs', () => {
      const server = createT402McpServer({
        demoMode: true,
        rpcUrls: {
          ethereum: 'https://custom-eth-rpc.com',
          base: 'https://custom-base-rpc.com',
        },
      })
      expect(server).toBeInstanceOf(T402McpServer)
    })

    it('should create server with private key', () => {
      const server = createT402McpServer({
        privateKey: '0x' + 'ab'.repeat(32),
      })
      expect(server).toBeInstanceOf(T402McpServer)
    })

    it('should create server with bundler and paymaster config', () => {
      const server = createT402McpServer({
        demoMode: true,
        bundlerUrl: 'https://bundler.example.com',
        paymasterUrl: 'https://paymaster.example.com',
      })
      expect(server).toBeInstanceOf(T402McpServer)
    })
  })

  describe('Tool Listing', () => {
    it('should expose all 6 base tools', () => {
      const expectedTools = [
        't402/getBalance',
        't402/getAllBalances',
        't402/pay',
        't402/payGasless',
        't402/getBridgeFee',
        't402/bridge',
      ]

      for (const tool of expectedTools) {
        expect(TOOL_DEFINITIONS).toHaveProperty(tool)
      }
    })

    it('should expose WDK tools when demo mode is active', () => {
      const expectedWdkTools = [
        'wdk/getWallet',
        'wdk/getBalances',
        'wdk/transfer',
        'wdk/swap',
        't402/autoPay',
      ]

      for (const tool of expectedWdkTools) {
        expect(WDK_TOOL_DEFINITIONS).toHaveProperty(tool)
      }
    })

    it('should have valid schemas for all base tools', () => {
      for (const [name, definition] of Object.entries(TOOL_DEFINITIONS)) {
        expect(definition.name).toBe(name)
        expect(definition.description).toBeTruthy()
        expect(definition.inputSchema.type).toBe('object')
        expect(definition.inputSchema.properties).toBeDefined()
        expect(Array.isArray(definition.inputSchema.required)).toBe(true)

        // All required fields must exist in properties
        for (const req of definition.inputSchema.required) {
          expect(definition.inputSchema.properties).toHaveProperty(req)
        }
      }
    })

    it('should have valid schemas for all WDK tools', () => {
      for (const [name, definition] of Object.entries(WDK_TOOL_DEFINITIONS)) {
        expect(definition.name).toBe(name)
        expect(definition.description).toBeTruthy()
        expect(definition.inputSchema.type).toBe('object')
        expect(definition.inputSchema.properties).toBeDefined()
        expect(Array.isArray(definition.inputSchema.required)).toBe(true)
      }
    })
  })

  describe('Error Handling', () => {
    it('should handle server creation with all supported RPC URLs', () => {
      const allNetworkRpcs: Record<string, string> = {}
      const networks = TOOL_DEFINITIONS['t402/getBalance'].inputSchema.properties.network.enum
      if (networks) {
        for (const network of networks) {
          allNetworkRpcs[network] = `https://rpc.${network}.example.com`
        }
      }

      const server = createT402McpServer({
        demoMode: true,
        rpcUrls: allNetworkRpcs,
      })
      expect(server).toBeInstanceOf(T402McpServer)
    })

    it('should handle server creation with empty config', () => {
      const server = createT402McpServer({})
      expect(server).toBeInstanceOf(T402McpServer)
    })
  })

  describe('Mock Facilitator Integration', () => {
    it('should have mock facilitator running', () => {
      expect(facilitator.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
    })

    it('should respond to GET /supported', async () => {
      const res = await fetch(`${facilitator.url}/supported`)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.networks).toBeDefined()
      expect(data.networks.length).toBeGreaterThan(0)
    })

    it('should respond to POST /verify', async () => {
      const res = await fetch(`${facilitator.url}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: 'test' }),
      })
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.isValid).toBe(true)
    })

    it('should respond to POST /settle', async () => {
      const res = await fetch(`${facilitator.url}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: 'test' }),
      })
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.success).toBe(true)
    })

    it('should return 404 for unknown endpoints', async () => {
      const res = await fetch(`${facilitator.url}/unknown`)
      expect(res.status).toBe(404)
    })
  })
})
