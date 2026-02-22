/**
 * t402 MCP Server - Main server implementation
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import type { McpServerConfig, SupportedNetwork } from '../types.js'
import {
  TOOL_DEFINITIONS,
  WDK_TOOL_DEFINITIONS,
  UNIFIED_TOOL_DEFINITIONS,
  executeGetBalance,
  formatBalanceResult,
  getBalanceInputSchema,
  executeGetAllBalances,
  formatAllBalancesResult,
  getAllBalancesInputSchema,
  executePay,
  formatPaymentResult,
  payInputSchema,
  executePayGasless,
  formatGaslessPaymentResult,
  payGaslessInputSchema,
  executeGetBridgeFee,
  formatBridgeFeeResult,
  getBridgeFeeInputSchema,
  executeBridge,
  formatBridgeResult,
  bridgeInputSchema,
  // WDK tools
  wdkGetWalletInputSchema,
  executeWdkGetWallet,
  executeWdkGetWalletDemo,
  formatWdkWalletResult,
  wdkGetBalancesInputSchema,
  executeWdkGetBalances,
  executeWdkGetBalancesDemo,
  formatWdkBalancesResult,
  wdkTransferInputSchema,
  executeWdkTransfer,
  executeWdkTransferDemo,
  formatWdkTransferResult,
  wdkSwapInputSchema,
  executeWdkSwap,
  executeWdkSwapDemo,
  formatWdkSwapResult,
  autoPayInputSchema,
  executeAutoPay,
  executeAutoPayDemo,
  formatAutoPayResult,
  // Unified tools
  smartPayInputSchema,
  executeSmartPay,
  executeSmartPayDemo,
  formatSmartPayResult,
  paymentPlanInputSchema,
  executePaymentPlan,
  executePaymentPlanDemo,
  formatPaymentPlanResult,
  // TON bridge tools
  TON_BRIDGE_TOOLS,
  executeTonBridgeTool,
  type TonMcpBridgeConfig,
  // ERC-8004 tools
  ERC8004_TOOL_DEFINITIONS,
  erc8004ResolveAgentInputSchema,
  executeErc8004ResolveAgent,
  formatErc8004ResolveAgentResult,
  erc8004CheckReputationInputSchema,
  executeErc8004CheckReputation,
  formatErc8004CheckReputationResult,
  erc8004VerifyWalletInputSchema,
  executeErc8004VerifyWallet,
  formatErc8004VerifyWalletResult,
} from '../tools/index.js'
import type { T402WDK } from '@t402/wdk'

/**
 * t402 MCP Server
 *
 * Provides payment tools for AI agents via the Model Context Protocol.
 * When a WDK seed phrase is configured, additional wallet management tools are available.
 */
export class T402McpServer {
  private server: Server
  private config: McpServerConfig
  private wdk: T402WDK | null = null

  constructor(config: McpServerConfig = {}) {
    this.config = config
    this.server = new Server(
      {
        name: 't402',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    )

    this.setupHandlers()
  }

  /**
   * Initialize the WDK instance from seed phrase
   */
  async initWdk(): Promise<void> {
    if (!this.config.seedPhrase) return

    try {
      const { T402WDK } = await import('@t402/wdk')
      const rpcUrls: Record<string, string> = {}

      if (this.config.rpcUrls) {
        for (const [network, url] of Object.entries(this.config.rpcUrls)) {
          if (url) rpcUrls[network] = url
        }
      }

      this.wdk = new T402WDK(this.config.seedPhrase, rpcUrls)
    } catch {
      console.error('Warning: Failed to initialize WDK. WDK tools will not be available.')
    }
  }

  /** TON MCP bridge configuration */
  private tonBridgeConfig: TonMcpBridgeConfig | null = null

  /**
   * Register TON bridge tools
   *
   * Enables AI agents to use @ton/mcp tools through the t402 MCP server.
   */
  registerTonBridge(config: TonMcpBridgeConfig): void {
    this.tonBridgeConfig = config
  }

  /**
   * Get all tool definitions (base + WDK if configured + unified if enabled + TON bridge if registered)
   */
  private getToolDefinitions() {
    const tools = { ...TOOL_DEFINITIONS, ...ERC8004_TOOL_DEFINITIONS }
    if (this.wdk || this.config.demoMode) {
      Object.assign(tools, WDK_TOOL_DEFINITIONS)
    }
    if (this.config.unifiedMode && (this.wdk || this.config.demoMode)) {
      Object.assign(tools, UNIFIED_TOOL_DEFINITIONS)
    }
    if (this.tonBridgeConfig) {
      Object.assign(tools, TON_BRIDGE_TOOLS)
    }
    return tools
  }

  /**
   * Set up MCP request handlers
   */
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: Object.values(this.getToolDefinitions()),
      }
    })

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params

      try {
        switch (name) {
          case 't402/getBalance':
            return await this.handleGetBalance(args)

          case 't402/getAllBalances':
            return await this.handleGetAllBalances(args)

          case 't402/pay':
            return await this.handlePay(args)

          case 't402/payGasless':
            return await this.handlePayGasless(args)

          case 't402/getBridgeFee':
            return await this.handleGetBridgeFee(args)

          case 't402/bridge':
            return await this.handleBridge(args)

          // WDK tools
          case 'wdk/getWallet':
            return await this.handleWdkGetWallet(args)

          case 'wdk/getBalances':
            return await this.handleWdkGetBalances(args)

          case 'wdk/transfer':
            return await this.handleWdkTransfer(args)

          case 'wdk/swap':
            return await this.handleWdkSwap(args)

          case 't402/autoPay':
            return await this.handleAutoPay(args)

          // Unified tools
          case 't402/smartPay':
            return await this.handleSmartPay(args)

          case 't402/paymentPlan':
            return await this.handlePaymentPlan(args)

          // ERC-8004 tools
          case 'erc8004/resolveAgent':
            return await this.handleErc8004ResolveAgent(args)

          case 'erc8004/checkReputation':
            return await this.handleErc8004CheckReputation(args)

          case 'erc8004/verifyWallet':
            return await this.handleErc8004VerifyWallet(args)

          // TON bridge tools
          case 'ton/getBalance':
          case 'ton/transfer':
          case 'ton/getJettonBalance':
          case 'ton/swapJettons':
          case 'ton/getTransactionStatus':
            return await this.handleTonBridgeTool(name, args)

          default:
            throw new Error(`Unknown tool: ${name}`)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: ${message}`,
            },
          ],
          isError: true,
        }
      }
    })
  }

  /**
   * Handle t402/getBalance
   */
  private async handleGetBalance(args: unknown) {
    const input = getBalanceInputSchema.parse(args)
    const result = await executeGetBalance(input, this.config.rpcUrls)
    return {
      content: [
        {
          type: 'text' as const,
          text: formatBalanceResult(result),
        },
      ],
    }
  }

  /**
   * Handle t402/getAllBalances
   */
  private async handleGetAllBalances(args: unknown) {
    const input = getAllBalancesInputSchema.parse(args)
    const result = await executeGetAllBalances(input, this.config.rpcUrls)
    return {
      content: [
        {
          type: 'text' as const,
          text: formatAllBalancesResult(result),
        },
      ],
    }
  }

  /**
   * Handle t402/pay
   */
  private async handlePay(args: unknown) {
    if (!this.config.privateKey && !this.config.demoMode) {
      throw new Error(
        'Private key not configured. Set T402_PRIVATE_KEY environment variable or enable demo mode.',
      )
    }

    const input = payInputSchema.parse(args)
    const result = await executePay(input, {
      privateKey: this.config.privateKey || '0x',
      rpcUrl: this.config.rpcUrls?.[input.network as SupportedNetwork],
      demoMode: this.config.demoMode,
    })

    return {
      content: [
        {
          type: 'text' as const,
          text: formatPaymentResult(result),
        },
      ],
    }
  }

  /**
   * Handle t402/payGasless
   */
  private async handlePayGasless(args: unknown) {
    if (!this.config.privateKey && !this.config.demoMode) {
      throw new Error(
        'Private key not configured. Set T402_PRIVATE_KEY environment variable or enable demo mode.',
      )
    }

    if (!this.config.bundlerUrl && !this.config.demoMode) {
      throw new Error(
        'Bundler URL not configured. Set T402_BUNDLER_URL environment variable or enable demo mode.',
      )
    }

    if (!this.config.paymasterUrl && !this.config.demoMode) {
      throw new Error(
        'Paymaster URL not configured. Set T402_PAYMASTER_URL environment variable or enable demo mode.',
      )
    }

    const input = payGaslessInputSchema.parse(args)
    const result = await executePayGasless(input, {
      privateKey: this.config.privateKey || '0x',
      bundlerUrl: this.config.bundlerUrl || '',
      paymasterUrl: this.config.paymasterUrl || '',
      rpcUrl: this.config.rpcUrls?.[input.network as SupportedNetwork],
      demoMode: this.config.demoMode,
    })

    return {
      content: [
        {
          type: 'text' as const,
          text: formatGaslessPaymentResult(result),
        },
      ],
    }
  }

  /**
   * Handle t402/getBridgeFee
   */
  private async handleGetBridgeFee(args: unknown) {
    const input = getBridgeFeeInputSchema.parse(args)
    const result = await executeGetBridgeFee(input, this.config.rpcUrls)
    return {
      content: [
        {
          type: 'text' as const,
          text: formatBridgeFeeResult(result),
        },
      ],
    }
  }

  /**
   * Handle t402/bridge
   */
  private async handleBridge(args: unknown) {
    if (!this.config.privateKey && !this.config.demoMode) {
      throw new Error(
        'Private key not configured. Set T402_PRIVATE_KEY environment variable or enable demo mode.',
      )
    }

    const input = bridgeInputSchema.parse(args)
    const result = await executeBridge(input, {
      privateKey: this.config.privateKey || '0x',
      rpcUrl: this.config.rpcUrls?.[input.fromChain as SupportedNetwork],
      demoMode: this.config.demoMode,
    })

    return {
      content: [
        {
          type: 'text' as const,
          text: formatBridgeResult(result),
        },
      ],
    }
  }

  // ---- WDK Tool Handlers ----

  /**
   * Handle wdk/getWallet
   */
  private async handleWdkGetWallet(args: unknown) {
    wdkGetWalletInputSchema.parse(args)

    const result =
      this.config.demoMode || !this.wdk
        ? executeWdkGetWalletDemo()
        : await executeWdkGetWallet({}, this.wdk)

    return {
      content: [{ type: 'text' as const, text: formatWdkWalletResult(result) }],
    }
  }

  /**
   * Handle wdk/getBalances
   */
  private async handleWdkGetBalances(args: unknown) {
    const input = wdkGetBalancesInputSchema.parse(args)

    const result =
      this.config.demoMode || !this.wdk
        ? executeWdkGetBalancesDemo()
        : await executeWdkGetBalances(input, this.wdk)

    return {
      content: [{ type: 'text' as const, text: formatWdkBalancesResult(result) }],
    }
  }

  /**
   * Handle wdk/transfer
   */
  private async handleWdkTransfer(args: unknown) {
    const input = wdkTransferInputSchema.parse(args)

    const result =
      this.config.demoMode || !this.wdk
        ? executeWdkTransferDemo(input)
        : await executeWdkTransfer(input, this.wdk)

    return {
      content: [{ type: 'text' as const, text: formatWdkTransferResult(result) }],
    }
  }

  /**
   * Handle wdk/swap
   */
  private async handleWdkSwap(args: unknown) {
    const input = wdkSwapInputSchema.parse(args)

    const result =
      this.config.demoMode || !this.wdk
        ? executeWdkSwapDemo(input)
        : await executeWdkSwap(input, this.wdk)

    return {
      content: [{ type: 'text' as const, text: formatWdkSwapResult(result) }],
    }
  }

  /**
   * Handle t402/autoPay
   */
  private async handleAutoPay(args: unknown) {
    const input = autoPayInputSchema.parse(args)

    const result =
      this.config.demoMode || !this.wdk
        ? executeAutoPayDemo(input)
        : await executeAutoPay(input, this.wdk)

    return {
      content: [{ type: 'text' as const, text: formatAutoPayResult(result) }],
    }
  }

  // ---- Unified Tool Handlers ----

  /**
   * Handle t402/smartPay
   */
  private async handleSmartPay(args: unknown) {
    const input = smartPayInputSchema.parse(args)

    const result =
      this.config.demoMode || !this.wdk
        ? executeSmartPayDemo(input)
        : await executeSmartPay(input, this.wdk)

    return {
      content: [{ type: 'text' as const, text: formatSmartPayResult(result) }],
    }
  }

  /**
   * Handle t402/paymentPlan
   */
  private async handlePaymentPlan(args: unknown) {
    const input = paymentPlanInputSchema.parse(args)

    const result =
      this.config.demoMode || !this.wdk
        ? executePaymentPlanDemo(input)
        : await executePaymentPlan(input, this.wdk)

    return {
      content: [{ type: 'text' as const, text: formatPaymentPlanResult(result) }],
    }
  }

  // ---- ERC-8004 Tool Handlers ----

  /**
   * Handle erc8004/resolveAgent
   */
  private async handleErc8004ResolveAgent(args: unknown) {
    const input = erc8004ResolveAgentInputSchema.parse(args)
    const result = await executeErc8004ResolveAgent(input, this.config.rpcUrls)
    return {
      content: [{ type: 'text' as const, text: formatErc8004ResolveAgentResult(result) }],
    }
  }

  /**
   * Handle erc8004/checkReputation
   */
  private async handleErc8004CheckReputation(args: unknown) {
    const input = erc8004CheckReputationInputSchema.parse(args)
    const result = await executeErc8004CheckReputation(input, this.config.rpcUrls)
    return {
      content: [{ type: 'text' as const, text: formatErc8004CheckReputationResult(result) }],
    }
  }

  /**
   * Handle erc8004/verifyWallet
   */
  private async handleErc8004VerifyWallet(args: unknown) {
    const input = erc8004VerifyWalletInputSchema.parse(args)
    const result = await executeErc8004VerifyWallet(input, this.config.rpcUrls)
    return {
      content: [{ type: 'text' as const, text: formatErc8004VerifyWalletResult(result) }],
    }
  }

  // ---- TON Bridge Tool Handler ----

  /**
   * Handle TON bridge tool calls
   */
  private async handleTonBridgeTool(name: string, args: unknown) {
    if (!this.tonBridgeConfig) {
      throw new Error('TON bridge not configured. Call registerTonBridge() to enable TON tools.')
    }

    return executeTonBridgeTool(name, (args ?? {}) as Record<string, unknown>, this.tonBridgeConfig)
  }

  /**
   * Start the server using stdio transport
   */
  async run(): Promise<void> {
    // Initialize WDK if seed phrase is configured
    await this.initWdk()

    const transport = new StdioServerTransport()
    await this.server.connect(transport)
    console.error('t402 MCP Server running on stdio')
  }
}

/**
 * Create a new t402 MCP server instance
 */
export function createT402McpServer(config?: McpServerConfig): T402McpServer {
  return new T402McpServer(config)
}

/**
 * Load configuration from environment variables
 */
export function loadConfigFromEnv(): McpServerConfig {
  const config: McpServerConfig = {}

  // Private key
  if (process.env.T402_PRIVATE_KEY) {
    config.privateKey = process.env.T402_PRIVATE_KEY
  }

  // Demo mode
  if (process.env.T402_DEMO_MODE === 'true') {
    config.demoMode = true
  }

  // ERC-4337 configuration
  if (process.env.T402_BUNDLER_URL) {
    config.bundlerUrl = process.env.T402_BUNDLER_URL
  }
  if (process.env.T402_PAYMASTER_URL) {
    config.paymasterUrl = process.env.T402_PAYMASTER_URL
  }

  // WDK configuration
  if (process.env.T402_WDK_SEED_PHRASE) {
    config.seedPhrase = process.env.T402_WDK_SEED_PHRASE
  }
  if (process.env.T402_WDK_CHAINS) {
    config.wdkChains = process.env.T402_WDK_CHAINS.split(',').map((c) => c.trim())
  }

  // Unified mode
  if (process.env.T402_UNIFIED_MODE === 'true') {
    config.unifiedMode = true
  }

  // Custom RPC URLs
  const rpcUrls: Partial<Record<SupportedNetwork, string>> = {}
  const networks: SupportedNetwork[] = [
    'ethereum',
    'base',
    'arbitrum',
    'optimism',
    'polygon',
    'avalanche',
    'ink',
    'berachain',
    'unichain',
  ]

  for (const network of networks) {
    const envVar = `T402_RPC_${network.toUpperCase()}`
    if (process.env[envVar]) {
      rpcUrls[network] = process.env[envVar]
    }
  }

  if (Object.keys(rpcUrls).length > 0) {
    config.rpcUrls = rpcUrls
  }

  // TON MCP bridge configuration
  if (process.env.T402_TON_MCP_ENDPOINT) {
    config.tonMcpEndpoint = process.env.T402_TON_MCP_ENDPOINT
  }
  if (process.env.T402_TON_API_KEY) {
    config.tonApiKey = process.env.T402_TON_API_KEY
  }

  return config
}
