/**
 * t402 MCP Server - Main server implementation
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { McpServerConfig, SupportedNetwork } from "../types.js";
import {
  TOOL_DEFINITIONS,
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
} from "../tools/index.js";

/**
 * t402 MCP Server
 *
 * Provides payment tools for AI agents via the Model Context Protocol.
 */
export class T402McpServer {
  private server: Server;
  private config: McpServerConfig;

  constructor(config: McpServerConfig = {}) {
    this.config = config;
    this.server = new Server(
      {
        name: "t402",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  /**
   * Set up MCP request handlers
   */
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: Object.values(TOOL_DEFINITIONS),
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "t402/getBalance":
            return await this.handleGetBalance(args);

          case "t402/getAllBalances":
            return await this.handleGetAllBalances(args);

          case "t402/pay":
            return await this.handlePay(args);

          case "t402/payGasless":
            return await this.handlePayGasless(args);

          case "t402/getBridgeFee":
            return await this.handleGetBridgeFee(args);

          case "t402/bridge":
            return await this.handleBridge(args);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  /**
   * Handle t402/getBalance
   */
  private async handleGetBalance(args: unknown) {
    const input = getBalanceInputSchema.parse(args);
    const result = await executeGetBalance(input, this.config.rpcUrls);
    return {
      content: [
        {
          type: "text" as const,
          text: formatBalanceResult(result),
        },
      ],
    };
  }

  /**
   * Handle t402/getAllBalances
   */
  private async handleGetAllBalances(args: unknown) {
    const input = getAllBalancesInputSchema.parse(args);
    const result = await executeGetAllBalances(input, this.config.rpcUrls);
    return {
      content: [
        {
          type: "text" as const,
          text: formatAllBalancesResult(result),
        },
      ],
    };
  }

  /**
   * Handle t402/pay
   */
  private async handlePay(args: unknown) {
    if (!this.config.privateKey && !this.config.demoMode) {
      throw new Error(
        "Private key not configured. Set T402_PRIVATE_KEY environment variable or enable demo mode."
      );
    }

    const input = payInputSchema.parse(args);
    const result = await executePay(input, {
      privateKey: this.config.privateKey || "0x",
      rpcUrl: this.config.rpcUrls?.[input.network as SupportedNetwork],
      demoMode: this.config.demoMode,
    });

    return {
      content: [
        {
          type: "text" as const,
          text: formatPaymentResult(result),
        },
      ],
    };
  }

  /**
   * Handle t402/payGasless
   */
  private async handlePayGasless(args: unknown) {
    if (!this.config.privateKey && !this.config.demoMode) {
      throw new Error(
        "Private key not configured. Set T402_PRIVATE_KEY environment variable or enable demo mode."
      );
    }

    if (!this.config.bundlerUrl && !this.config.demoMode) {
      throw new Error(
        "Bundler URL not configured. Set T402_BUNDLER_URL environment variable or enable demo mode."
      );
    }

    if (!this.config.paymasterUrl && !this.config.demoMode) {
      throw new Error(
        "Paymaster URL not configured. Set T402_PAYMASTER_URL environment variable or enable demo mode."
      );
    }

    const input = payGaslessInputSchema.parse(args);
    const result = await executePayGasless(input, {
      privateKey: this.config.privateKey || "0x",
      bundlerUrl: this.config.bundlerUrl || "",
      paymasterUrl: this.config.paymasterUrl || "",
      rpcUrl: this.config.rpcUrls?.[input.network as SupportedNetwork],
      demoMode: this.config.demoMode,
    });

    return {
      content: [
        {
          type: "text" as const,
          text: formatGaslessPaymentResult(result),
        },
      ],
    };
  }

  /**
   * Handle t402/getBridgeFee
   */
  private async handleGetBridgeFee(args: unknown) {
    const input = getBridgeFeeInputSchema.parse(args);
    const result = await executeGetBridgeFee(input, this.config.rpcUrls);
    return {
      content: [
        {
          type: "text" as const,
          text: formatBridgeFeeResult(result),
        },
      ],
    };
  }

  /**
   * Handle t402/bridge
   */
  private async handleBridge(args: unknown) {
    if (!this.config.privateKey && !this.config.demoMode) {
      throw new Error(
        "Private key not configured. Set T402_PRIVATE_KEY environment variable or enable demo mode."
      );
    }

    const input = bridgeInputSchema.parse(args);
    const result = await executeBridge(input, {
      privateKey: this.config.privateKey || "0x",
      rpcUrl: this.config.rpcUrls?.[input.fromChain as SupportedNetwork],
      demoMode: this.config.demoMode,
    });

    return {
      content: [
        {
          type: "text" as const,
          text: formatBridgeResult(result),
        },
      ],
    };
  }

  /**
   * Start the server using stdio transport
   */
  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("t402 MCP Server running on stdio");
  }
}

/**
 * Create a new t402 MCP server instance
 */
export function createT402McpServer(config?: McpServerConfig): T402McpServer {
  return new T402McpServer(config);
}

/**
 * Load configuration from environment variables
 */
export function loadConfigFromEnv(): McpServerConfig {
  const config: McpServerConfig = {};

  // Private key
  if (process.env.T402_PRIVATE_KEY) {
    config.privateKey = process.env.T402_PRIVATE_KEY;
  }

  // Demo mode
  if (process.env.T402_DEMO_MODE === "true") {
    config.demoMode = true;
  }

  // ERC-4337 configuration
  if (process.env.T402_BUNDLER_URL) {
    config.bundlerUrl = process.env.T402_BUNDLER_URL;
  }
  if (process.env.T402_PAYMASTER_URL) {
    config.paymasterUrl = process.env.T402_PAYMASTER_URL;
  }

  // Custom RPC URLs
  const rpcUrls: Partial<Record<SupportedNetwork, string>> = {};
  const networks: SupportedNetwork[] = [
    "ethereum",
    "base",
    "arbitrum",
    "optimism",
    "polygon",
    "avalanche",
    "ink",
    "berachain",
    "unichain",
  ];

  for (const network of networks) {
    const envVar = `T402_RPC_${network.toUpperCase()}`;
    if (process.env[envVar]) {
      rpcUrls[network] = process.env[envVar];
    }
  }

  if (Object.keys(rpcUrls).length > 0) {
    config.rpcUrls = rpcUrls;
  }

  return config;
}
