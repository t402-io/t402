import { describe, it, expect } from 'vitest'
import {
  TON_BRIDGE_TOOLS,
  executeTonBridgeTool,
  createTonBridgeToolSet,
  type TonMcpBridgeConfig,
} from '../../src/tools/index.js'

describe('TON Bridge Tools', () => {
  describe('TON_BRIDGE_TOOLS', () => {
    it('should define 5 TON tools', () => {
      expect(Object.keys(TON_BRIDGE_TOOLS)).toHaveLength(5)
    })

    it('should include ton/getBalance', () => {
      expect(TON_BRIDGE_TOOLS['ton/getBalance']).toBeDefined()
      expect(TON_BRIDGE_TOOLS['ton/getBalance'].name).toBe('ton/getBalance')
      expect(TON_BRIDGE_TOOLS['ton/getBalance'].inputSchema.required).toContain('address')
    })

    it('should include ton/transfer', () => {
      expect(TON_BRIDGE_TOOLS['ton/transfer']).toBeDefined()
      expect(TON_BRIDGE_TOOLS['ton/transfer'].inputSchema.required).toContain('to')
      expect(TON_BRIDGE_TOOLS['ton/transfer'].inputSchema.required).toContain('amount')
    })

    it('should include ton/getJettonBalance', () => {
      expect(TON_BRIDGE_TOOLS['ton/getJettonBalance']).toBeDefined()
      expect(TON_BRIDGE_TOOLS['ton/getJettonBalance'].inputSchema.required).toContain('address')
      expect(TON_BRIDGE_TOOLS['ton/getJettonBalance'].inputSchema.required).toContain(
        'jettonMaster',
      )
    })

    it('should include ton/swapJettons', () => {
      expect(TON_BRIDGE_TOOLS['ton/swapJettons']).toBeDefined()
      expect(TON_BRIDGE_TOOLS['ton/swapJettons'].inputSchema.required).toContain('fromJetton')
    })

    it('should include ton/getTransactionStatus', () => {
      expect(TON_BRIDGE_TOOLS['ton/getTransactionStatus']).toBeDefined()
      expect(TON_BRIDGE_TOOLS['ton/getTransactionStatus'].inputSchema.required).toContain('txHash')
    })

    it('all tools should have object-type schemas', () => {
      for (const tool of Object.values(TON_BRIDGE_TOOLS)) {
        expect(tool.inputSchema.type).toBe('object')
        expect(tool.description).toBeTruthy()
      }
    })
  })

  describe('executeTonBridgeTool (demo mode)', () => {
    const demoConfig: TonMcpBridgeConfig = { demoMode: true }

    it('should return demo result for ton/getBalance', async () => {
      const result = await executeTonBridgeTool(
        'ton/getBalance',
        { address: 'UQTestAddress' },
        demoConfig,
      )

      expect(result.content).toHaveLength(1)
      expect(result.content[0].text).toContain('[DEMO]')
      expect(result.content[0].text).toContain('UQTestAddress')
      expect(result.isError).toBeUndefined()
    })

    it('should return demo result for ton/transfer', async () => {
      const result = await executeTonBridgeTool(
        'ton/transfer',
        { to: 'UQRecipient', amount: '1.5' },
        demoConfig,
      )

      expect(result.content[0].text).toContain('[DEMO]')
      expect(result.content[0].text).toContain('UQRecipient')
      expect(result.content[0].text).toContain('1.5')
    })

    it('should return demo result for ton/getJettonBalance', async () => {
      const result = await executeTonBridgeTool(
        'ton/getJettonBalance',
        { address: 'UQTest', jettonMaster: 'EQJetton' },
        demoConfig,
      )

      expect(result.content[0].text).toContain('[DEMO]')
    })

    it('should return demo result for ton/swapJettons', async () => {
      const result = await executeTonBridgeTool(
        'ton/swapJettons',
        { fromJetton: 'TON', toJetton: 'USDT0', amount: '10' },
        demoConfig,
      )

      expect(result.content[0].text).toContain('[DEMO]')
      expect(result.content[0].text).toContain('Swap')
    })

    it('should return demo result for ton/getTransactionStatus', async () => {
      const result = await executeTonBridgeTool(
        'ton/getTransactionStatus',
        { txHash: 'abc123' },
        demoConfig,
      )

      expect(result.content[0].text).toContain('[DEMO]')
      expect(result.content[0].text).toContain('abc123')
    })

    it('should handle unknown tool name', async () => {
      const result = await executeTonBridgeTool('ton/unknown', {}, demoConfig)

      expect(result.content[0].text).toContain('[DEMO]')
      expect(result.content[0].text).toContain('Unknown')
    })
  })

  describe('executeTonBridgeTool (no config)', () => {
    it('should return error when no endpoint or API key is configured', async () => {
      const result = await executeTonBridgeTool('ton/getBalance', { address: 'UQTest' }, {})

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('not configured')
    })
  })

  describe('createTonBridgeToolSet', () => {
    it('should create a tool set with definitions and handler', () => {
      const toolSet = createTonBridgeToolSet({ demoMode: true })

      expect(toolSet.definitions).toBe(TON_BRIDGE_TOOLS)
      expect(typeof toolSet.handleToolCall).toBe('function')
    })

    it('should handle tool calls via the tool set', async () => {
      const toolSet = createTonBridgeToolSet({ demoMode: true })

      const result = await toolSet.handleToolCall('ton/getBalance', {
        address: 'UQTest',
      })

      expect(result.content[0].text).toContain('[DEMO]')
    })
  })
})
