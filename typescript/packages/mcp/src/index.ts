/**
 * @t402/mcp - MCP Server for AI Agent Payments
 *
 * This package provides a Model Context Protocol (MCP) server that enables
 * AI agents to make stablecoin payments across multiple blockchain networks.
 *
 * @example
 * ```typescript
 * import { createT402McpServer, loadConfigFromEnv } from '@t402/mcp';
 *
 * const config = loadConfigFromEnv();
 * const server = createT402McpServer(config);
 * await server.run();
 * ```
 *
 * @example Claude Desktop Configuration
 * ```json
 * {
 *   "mcpServers": {
 *     "t402": {
 *       "command": "npx",
 *       "args": ["@t402/mcp"],
 *       "env": {
 *         "T402_PRIVATE_KEY": "0x...",
 *         "T402_DEMO_MODE": "true"
 *       }
 *     }
 *   }
 * }
 * ```
 */

// Server
export {
  T402McpServer,
  createT402McpServer,
  loadConfigFromEnv,
} from "./server/index.js";

// Tools
export {
  // Tool definitions
  TOOL_DEFINITIONS,
  // Balance tools
  getBalanceInputSchema,
  executeGetBalance,
  formatBalanceResult,
  getAllBalancesInputSchema,
  executeGetAllBalances,
  formatAllBalancesResult,
  // Payment tools
  payInputSchema,
  executePay,
  formatPaymentResult,
  payGaslessInputSchema,
  executePayGasless,
  formatGaslessPaymentResult,
  GASLESS_SUPPORTED_NETWORKS,
  // Bridge tools
  getBridgeFeeInputSchema,
  executeGetBridgeFee,
  formatBridgeFeeResult,
  bridgeInputSchema,
  executeBridge,
  formatBridgeResult,
  // Types
  type GetBalanceInput,
  type GetAllBalancesInput,
  type AllBalancesResult,
  type PayInput,
  type PayOptions,
  type PayGaslessInput,
  type PayGaslessOptions,
  type GetBridgeFeeInput,
  type BridgeInput,
  type BridgeOptions,
} from "./tools/index.js";

// Types
export type {
  SupportedNetwork,
  TokenBalance,
  ChainBalance,
  PaymentParams,
  PaymentResult,
  GaslessPaymentResult,
  BridgeFeeQuote,
  BridgeResult,
  McpServerConfig,
  ToolContext,
} from "./types.js";

// Constants
export {
  CHAIN_IDS,
  NATIVE_SYMBOLS,
  EXPLORER_URLS,
  DEFAULT_RPC_URLS,
  USDC_ADDRESSES,
  USDT_ADDRESSES,
  USDT0_ADDRESSES,
  BRIDGEABLE_CHAINS,
  getExplorerTxUrl,
  getLayerZeroScanUrl,
  supportsToken,
  getTokenAddress,
  formatTokenAmount,
  parseTokenAmount,
} from "./constants.js";
