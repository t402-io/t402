/**
 * t402 MCP Tools - Export all payment tools
 */

// Balance tools
export {
  getBalanceInputSchema,
  executeGetBalance,
  formatBalanceResult,
  type GetBalanceInput,
} from './getBalance.js'

export {
  getAllBalancesInputSchema,
  executeGetAllBalances,
  formatAllBalancesResult,
  type GetAllBalancesInput,
  type AllBalancesResult,
} from './getAllBalances.js'

// Payment tools
export {
  payInputSchema,
  executePay,
  formatPaymentResult,
  type PayInput,
  type PayOptions,
} from './pay.js'

export {
  payGaslessInputSchema,
  executePayGasless,
  formatGaslessPaymentResult,
  GASLESS_SUPPORTED_NETWORKS,
  type PayGaslessInput,
  type PayGaslessOptions,
} from './payGasless.js'

// Bridge tools
export {
  getBridgeFeeInputSchema,
  executeGetBridgeFee,
  formatBridgeFeeResult,
  type GetBridgeFeeInput,
} from './getBridgeFee.js'

export {
  bridgeInputSchema,
  executeBridge,
  formatBridgeResult,
  type BridgeInput,
  type BridgeOptions,
} from './bridge.js'

// WDK tools
export {
  wdkGetWalletInputSchema,
  executeWdkGetWallet,
  executeWdkGetWalletDemo,
  formatWdkWalletResult,
  type WdkGetWalletInput,
  type WdkWalletInfo,
} from './wdkGetWallet.js'

export {
  wdkGetBalancesInputSchema,
  executeWdkGetBalances,
  executeWdkGetBalancesDemo,
  formatWdkBalancesResult,
  type WdkGetBalancesInput,
  type WdkBalancesResult,
} from './wdkGetBalances.js'

export {
  wdkTransferInputSchema,
  executeWdkTransfer,
  executeWdkTransferDemo,
  formatWdkTransferResult,
  type WdkTransferInput,
  type WdkTransferResult,
} from './wdkTransfer.js'

export {
  wdkSwapInputSchema,
  executeWdkSwap,
  executeWdkSwapDemo,
  formatWdkSwapResult,
  type WdkSwapInput,
  type WdkSwapResult,
} from './wdkSwap.js'

export {
  autoPayInputSchema,
  executeAutoPay,
  executeAutoPayDemo,
  formatAutoPayResult,
  type AutoPayInput,
  type AutoPayResult,
} from './autoPay.js'

// TON bridge tools
export {
  TON_BRIDGE_TOOLS,
  executeTonBridgeTool,
  createTonBridgeToolSet,
  type TonMcpBridgeConfig,
} from './ton-bridge.js'

// Unified tools
export {
  smartPayInputSchema,
  executeSmartPay,
  executeSmartPayDemo,
  formatSmartPayResult,
  paymentPlanInputSchema,
  executePaymentPlan,
  executePaymentPlanDemo,
  formatPaymentPlanResult,
  UNIFIED_TOOL_DEFINITIONS,
  type SmartPayInput,
  type SmartPayResult,
  type SmartPayStep,
  type PaymentPlanInput,
  type PaymentPlanResult,
  type UnifiedMcpConfig,
} from './unified.js'

/**
 * Base tool definitions (always available)
 */
export const TOOL_DEFINITIONS = {
  't402/getBalance': {
    name: 't402/getBalance',
    description:
      'Get token balances (native + stablecoins) for a wallet on a specific blockchain network. Returns ETH/native token balance plus USDC, USDT, and USDT0 balances where supported.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        network: {
          type: 'string',
          enum: [
            'ethereum',
            'base',
            'arbitrum',
            'optimism',
            'polygon',
            'avalanche',
            'ink',
            'berachain',
            'unichain',
          ],
          description: 'Blockchain network to check balance on',
        },
        address: {
          type: 'string',
          pattern: '^0x[a-fA-F0-9]{40}$',
          description: 'Wallet address to check balance for',
        },
      },
      required: ['network', 'address'],
    },
  },

  't402/getAllBalances': {
    name: 't402/getAllBalances',
    description:
      'Get token balances across all supported networks for a wallet. Returns aggregated totals and per-network breakdown of native tokens and stablecoins (USDC, USDT, USDT0).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        address: {
          type: 'string',
          pattern: '^0x[a-fA-F0-9]{40}$',
          description: 'Wallet address to check balances for',
        },
        networks: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
              'ethereum',
              'base',
              'arbitrum',
              'optimism',
              'polygon',
              'avalanche',
              'ink',
              'berachain',
              'unichain',
            ],
          },
          description:
            'Optional list of networks to check. If not provided, checks all supported networks.',
        },
      },
      required: ['address'],
    },
  },

  't402/pay': {
    name: 't402/pay',
    description:
      'Execute a stablecoin payment on a specific blockchain network. Supports USDC, USDT, and USDT0 tokens. Requires a configured wallet with sufficient balance and native token for gas.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        to: {
          type: 'string',
          pattern: '^0x[a-fA-F0-9]{40}$',
          description: 'Recipient address',
        },
        amount: {
          type: 'string',
          pattern: '^\\d+(\\.\\d+)?$',
          description: "Amount to pay (e.g., '10.50' for 10.50 USDC)",
        },
        token: {
          type: 'string',
          enum: ['USDC', 'USDT', 'USDT0'],
          description: 'Token to use for payment',
        },
        network: {
          type: 'string',
          enum: [
            'ethereum',
            'base',
            'arbitrum',
            'optimism',
            'polygon',
            'avalanche',
            'ink',
            'berachain',
            'unichain',
          ],
          description: 'Network to execute payment on',
        },
        memo: {
          type: 'string',
          description: 'Optional memo/reference for the payment',
        },
      },
      required: ['to', 'amount', 'token', 'network'],
    },
  },

  't402/payGasless': {
    name: 't402/payGasless',
    description:
      'Execute a gasless stablecoin payment using ERC-4337 account abstraction. Gas fees are sponsored by a paymaster, so no ETH is needed for the transaction. Supported on select networks.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        to: {
          type: 'string',
          pattern: '^0x[a-fA-F0-9]{40}$',
          description: 'Recipient address',
        },
        amount: {
          type: 'string',
          pattern: '^\\d+(\\.\\d+)?$',
          description: "Amount to pay (e.g., '10.50' for 10.50 USDC)",
        },
        token: {
          type: 'string',
          enum: ['USDC', 'USDT', 'USDT0'],
          description: 'Token to use for payment',
        },
        network: {
          type: 'string',
          enum: ['ethereum', 'base', 'arbitrum', 'optimism', 'polygon', 'avalanche'],
          description: 'Network to execute gasless payment on (must support ERC-4337)',
        },
      },
      required: ['to', 'amount', 'token', 'network'],
    },
  },

  't402/getBridgeFee': {
    name: 't402/getBridgeFee',
    description:
      'Get the fee quote for bridging USDT0 between chains using LayerZero OFT. Returns the native token fee required and estimated delivery time. Supported chains: ethereum, arbitrum, ink, berachain, unichain.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        fromChain: {
          type: 'string',
          enum: ['ethereum', 'arbitrum', 'ink', 'berachain', 'unichain'],
          description: 'Source chain to bridge from',
        },
        toChain: {
          type: 'string',
          enum: ['ethereum', 'arbitrum', 'ink', 'berachain', 'unichain'],
          description: 'Destination chain to bridge to',
        },
        amount: {
          type: 'string',
          pattern: '^\\d+(\\.\\d+)?$',
          description: "Amount of USDT0 to bridge (e.g., '100' for 100 USDT0)",
        },
        recipient: {
          type: 'string',
          pattern: '^0x[a-fA-F0-9]{40}$',
          description: 'Recipient address on destination chain',
        },
      },
      required: ['fromChain', 'toChain', 'amount', 'recipient'],
    },
  },

  't402/bridge': {
    name: 't402/bridge',
    description:
      'Bridge USDT0 between chains using LayerZero OFT standard. Executes a cross-chain transfer and returns the LayerZero message GUID for tracking. Supported chains: ethereum, arbitrum, ink, berachain, unichain.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        fromChain: {
          type: 'string',
          enum: ['ethereum', 'arbitrum', 'ink', 'berachain', 'unichain'],
          description: 'Source chain to bridge from',
        },
        toChain: {
          type: 'string',
          enum: ['ethereum', 'arbitrum', 'ink', 'berachain', 'unichain'],
          description: 'Destination chain to bridge to',
        },
        amount: {
          type: 'string',
          pattern: '^\\d+(\\.\\d+)?$',
          description: "Amount of USDT0 to bridge (e.g., '100' for 100 USDT0)",
        },
        recipient: {
          type: 'string',
          pattern: '^0x[a-fA-F0-9]{40}$',
          description: 'Recipient address on destination chain',
        },
      },
      required: ['fromChain', 'toChain', 'amount', 'recipient'],
    },
  },
}

/**
 * WDK tool definitions (only available when WDK seed phrase is configured)
 */
export const WDK_TOOL_DEFINITIONS = {
  'wdk/getWallet': {
    name: 'wdk/getWallet',
    description:
      'Get wallet information from the configured WDK wallet. Returns EVM address and supported chains. No parameters needed.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [] as string[],
    },
  },

  'wdk/getBalances': {
    name: 'wdk/getBalances',
    description:
      'Get multi-chain token balances from the WDK wallet. Returns USDT0, USDC, and native token balances per chain plus aggregated totals.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        chains: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Optional list of chains to check (e.g., ["ethereum", "arbitrum"]). If not provided, checks all configured chains.',
        },
      },
      required: [] as string[],
    },
  },

  'wdk/transfer': {
    name: 'wdk/transfer',
    description:
      'Send stablecoins (USDC, USDT, USDT0) from the WDK wallet to a recipient address on a specific chain.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        to: {
          type: 'string',
          description: 'Recipient address',
        },
        amount: {
          type: 'string',
          pattern: '^\\d+(\\.\\d+)?$',
          description: "Amount to send (e.g., '10.50')",
        },
        token: {
          type: 'string',
          enum: ['USDC', 'USDT', 'USDT0'],
          description: 'Token to transfer',
        },
        chain: {
          type: 'string',
          description: 'Chain to execute transfer on (e.g., "ethereum", "arbitrum")',
        },
      },
      required: ['to', 'amount', 'token', 'chain'],
    },
  },

  'wdk/swap': {
    name: 'wdk/swap',
    description:
      'Swap tokens using the WDK Velora protocol. Supports swapping between stablecoins and native tokens.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        fromToken: {
          type: 'string',
          description: 'Token to swap from (e.g., "ETH", "USDC")',
        },
        toToken: {
          type: 'string',
          description: 'Token to swap to (e.g., "USDT0", "USDC")',
        },
        amount: {
          type: 'string',
          pattern: '^\\d+(\\.\\d+)?$',
          description: "Amount to swap (e.g., '1.0')",
        },
        chain: {
          type: 'string',
          description: 'Chain to execute swap on (e.g., "ethereum", "arbitrum")',
        },
      },
      required: ['fromToken', 'toToken', 'amount', 'chain'],
    },
  },

  't402/autoPay': {
    name: 't402/autoPay',
    description:
      'Smart payment orchestrator. Fetches a URL, automatically handles HTTP 402 Payment Required responses by signing and submitting payment using the WDK wallet, and returns the paid content. The killer tool for AI agents.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        url: {
          type: 'string',
          description: 'URL to fetch (may return 402 Payment Required)',
        },
        maxAmount: {
          type: 'string',
          pattern: '^\\d+(\\.\\d+)?$',
          description:
            'Maximum amount willing to pay (e.g., "10.00"). If not set, pays any amount.',
        },
        preferredChain: {
          type: 'string',
          description:
            'Preferred chain for payment (e.g., "arbitrum"). If not specified, uses first available.',
        },
      },
      required: ['url'],
    },
  },
}
