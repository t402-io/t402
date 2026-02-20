/**
 * TON MCP Bridge - Connects @ton/mcp tools with @t402/mcp
 *
 * Enables AI agents to perform end-to-end TON payment flows by
 * proxying @ton/mcp's 15 blockchain tools through the t402 MCP server.
 */

/**
 * Configuration for the TON MCP bridge
 */
export interface TonMcpBridgeConfig {
  /** @ton/mcp server URL or SSE endpoint */
  tonMcpEndpoint?: string
  /** TON API key for direct calls (e.g., toncenter.com API key) */
  tonApiKey?: string
  /** Enable demo mode (simulates calls without executing) */
  demoMode?: boolean
}

/**
 * Tool input/output schema type
 */
interface ToolSchema {
  type: 'object'
  properties: Record<string, { type: string; description: string; enum?: string[] }>
  required: string[]
}

/**
 * TON bridge tool definition
 */
interface TonBridgeTool {
  name: string
  description: string
  inputSchema: ToolSchema
}

/**
 * Proxy tool definitions from @ton/mcp
 *
 * These map to the tools available in the @ton/mcp server.
 * When registered, they proxy requests to the @ton/mcp endpoint.
 */
export const TON_BRIDGE_TOOLS: Record<string, TonBridgeTool> = {
  'ton/getBalance': {
    name: 'ton/getBalance',
    description: 'Get TON and Jetton balances for a wallet address on the TON blockchain.',
    inputSchema: {
      type: 'object',
      properties: {
        address: {
          type: 'string',
          description: 'TON wallet address (friendly or raw format)',
        },
      },
      required: ['address'],
    },
  },

  'ton/transfer': {
    name: 'ton/transfer',
    description: 'Send TON to a recipient address on the TON blockchain.',
    inputSchema: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Recipient TON address',
        },
        amount: {
          type: 'string',
          description: 'Amount of TON to send (e.g., "1.5")',
        },
        memo: {
          type: 'string',
          description: 'Optional memo/comment for the transfer',
        },
      },
      required: ['to', 'amount'],
    },
  },

  'ton/getJettonBalance': {
    name: 'ton/getJettonBalance',
    description: 'Get the balance of a specific Jetton (TON token) for a wallet address.',
    inputSchema: {
      type: 'object',
      properties: {
        address: {
          type: 'string',
          description: 'TON wallet address',
        },
        jettonMaster: {
          type: 'string',
          description: 'Jetton master contract address',
        },
      },
      required: ['address', 'jettonMaster'],
    },
  },

  'ton/swapJettons': {
    name: 'ton/swapJettons',
    description:
      'Swap Jettons (TON tokens) using DEX aggregation on the TON network. Returns a raw transaction JSON to be sent via sendTransaction.',
    inputSchema: {
      type: 'object',
      properties: {
        from: {
          type: 'string',
          description: 'Source Jetton master address (or "TON" for native TON)',
        },
        to: {
          type: 'string',
          description: 'Destination Jetton master address (or "TON" for native TON)',
        },
        amount: {
          type: 'string',
          description: 'Amount to swap in human-readable format (e.g., "1.5")',
        },
        slippage: {
          type: 'string',
          description: 'Slippage tolerance (e.g., "0.5" for 0.5%)',
        },
      },
      required: ['from', 'to', 'amount'],
    },
  },

  'ton/getTransactionStatus': {
    name: 'ton/getTransactionStatus',
    description: 'Check the status and details of a TON transaction by its hash.',
    inputSchema: {
      type: 'object',
      properties: {
        txHash: {
          type: 'string',
          description: 'Transaction hash (BOC hash or message hash)',
        },
      },
      required: ['txHash'],
    },
  },
} as const

/**
 * Execute a TON bridge tool call
 *
 * Proxies the tool call to the @ton/mcp endpoint or executes it
 * directly using the TON API key.
 *
 * @param toolName - Name of the tool to execute
 * @param args - Tool arguments
 * @param config - Bridge configuration
 * @returns Tool execution result
 */
export async function executeTonBridgeTool(
  toolName: string,
  args: Record<string, unknown>,
  config: TonMcpBridgeConfig,
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  // Demo mode: return simulated results
  if (config.demoMode) {
    return executeTonBridgeToolDemo(toolName, args)
  }

  // If we have a @ton/mcp endpoint, proxy the request
  if (config.tonMcpEndpoint) {
    return proxyToTonMcp(toolName, args, config.tonMcpEndpoint)
  }

  // If we have an API key, make direct API calls
  if (config.tonApiKey) {
    return executeTonBridgeToolDirect(toolName, args, config.tonApiKey)
  }

  return {
    content: [
      {
        type: 'text',
        text: `Error: TON MCP bridge not configured. Set tonMcpEndpoint or tonApiKey.`,
      },
    ],
    isError: true,
  }
}

/**
 * Demo mode execution for TON bridge tools
 */
function executeTonBridgeToolDemo(
  toolName: string,
  args: Record<string, unknown>,
): { content: Array<{ type: 'text'; text: string }> } {
  const responses: Record<string, string> = {
    'ton/getBalance': `[DEMO] TON Balance for ${args.address ?? 'unknown'}:\n- TON: 5.25\n- USDT0: 100.00`,
    'ton/transfer': `[DEMO] Transfer sent:\n- To: ${args.to ?? 'unknown'}\n- Amount: ${args.amount ?? '0'} TON\n- TX: demo-ton-tx-hash-${Date.now().toString(36)}`,
    'ton/getJettonBalance': `[DEMO] Jetton Balance:\n- Address: ${args.address ?? 'unknown'}\n- Jetton: ${args.jettonMaster ?? 'unknown'}\n- Balance: 50.00`,
    'ton/swapJettons': `[DEMO] Swap quote received:\n- From: ${args.from ?? 'unknown'}\n- To: ${args.to ?? 'unknown'}\n- Amount: ${args.amount ?? '0'}\n- Transaction: {"validUntil":${Math.floor(Date.now() / 1000) + 300},"messages":[{"address":"EQDemo...","amount":"${args.amount ?? '0'}","payload":"base64..."}]}`,
    'ton/getTransactionStatus': `[DEMO] Transaction Status:\n- Hash: ${args.txHash ?? 'unknown'}\n- Status: Confirmed\n- Block: 12345678`,
  }

  return {
    content: [
      {
        type: 'text',
        text: responses[toolName] ?? `[DEMO] Unknown TON tool: ${toolName}`,
      },
    ],
  }
}

/**
 * Proxy a tool call to the @ton/mcp server
 */
async function proxyToTonMcp(
  toolName: string,
  args: Record<string, unknown>,
  endpoint: string,
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: toolName, arguments: args },
      }),
    })

    if (!response.ok) {
      throw new Error(`TON MCP server returned ${response.status}`)
    }

    const result = (await response.json()) as {
      result?: { content: Array<{ type: 'text'; text: string }> }
      error?: { message: string }
    }

    if (result.error) {
      throw new Error(result.error.message)
    }

    return result.result ?? { content: [{ type: 'text', text: 'No result' }] }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      content: [{ type: 'text', text: `Error proxying to @ton/mcp: ${message}` }],
      isError: true,
    }
  }
}

/**
 * Execute TON bridge tool directly using TON API
 */
async function executeTonBridgeToolDirect(
  toolName: string,
  args: Record<string, unknown>,
  apiKey: string,
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const baseUrl = 'https://toncenter.com/api/v2'

  try {
    switch (toolName) {
      case 'ton/getBalance': {
        const response = await fetch(
          `${baseUrl}/getAddressBalance?address=${encodeURIComponent(String(args.address))}&api_key=${apiKey}`,
        )
        const data = (await response.json()) as { result: string }
        const balanceNano = BigInt(data.result)
        const balanceTon = Number(balanceNano) / 1e9
        return {
          content: [{ type: 'text', text: `TON Balance: ${balanceTon.toFixed(4)} TON` }],
        }
      }

      case 'ton/getTransactionStatus': {
        const response = await fetch(
          `${baseUrl}/getTransactions?hash=${encodeURIComponent(String(args.txHash))}&limit=1&api_key=${apiKey}`,
        )
        const data = (await response.json()) as { result: unknown[] }
        if (data.result.length === 0) {
          return {
            content: [{ type: 'text', text: 'Transaction not found' }],
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: `Transaction found:\n${JSON.stringify(data.result[0], null, 2)}`,
            },
          ],
        }
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: `Direct execution of ${toolName} is not supported. Configure tonMcpEndpoint to proxy to @ton/mcp.`,
            },
          ],
          isError: true,
        }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      content: [{ type: 'text', text: `Error executing TON API call: ${message}` }],
      isError: true,
    }
  }
}

/**
 * Register TON bridge tools on a t402 MCP server
 *
 * This function adds the TON bridge tools to the server's tool registry,
 * enabling AI agents to use TON blockchain operations alongside t402 payment tools.
 *
 * @param config - Bridge configuration
 * @returns Tool definitions and handler
 */
export function createTonBridgeToolSet(config: TonMcpBridgeConfig) {
  return {
    definitions: TON_BRIDGE_TOOLS,
    async handleToolCall(
      name: string,
      args: Record<string, unknown>,
    ): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
      return executeTonBridgeTool(name, args, config)
    },
  }
}
