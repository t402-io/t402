package io.t402.mcp;

import io.t402.mcp.McpTypes.ServerConfig;

/**
 * T402 MCP CLI - Runs the T402 MCP server for AI agent integration.
 *
 * <p>Usage:
 * <pre>
 *     java -cp t402.jar io.t402.mcp.T402Mcp
 * </pre>
 *
 * <p>Environment Variables:
 * <ul>
 *   <li>T402_PRIVATE_KEY - Hex wallet private key (0x...)</li>
 *   <li>T402_DEMO_MODE - Set to "true" to simulate transactions</li>
 *   <li>T402_BUNDLER_URL - ERC-4337 bundler endpoint for gasless payments</li>
 *   <li>T402_PAYMASTER_URL - ERC-4337 paymaster endpoint</li>
 *   <li>T402_RPC_&lt;NETWORK&gt; - Custom RPC URL for specific network (e.g., T402_RPC_ETHEREUM)</li>
 * </ul>
 *
 * <p>Example Claude Desktop Configuration:
 * <pre>
 * {
 *   "mcpServers": {
 *     "t402": {
 *       "command": "java",
 *       "args": ["-cp", "t402.jar", "io.t402.mcp.T402Mcp"],
 *       "env": {
 *         "T402_DEMO_MODE": "true"
 *       }
 *     }
 *   }
 * }
 * </pre>
 */
public final class T402Mcp {

    private T402Mcp() {}

    /**
     * Main entry point.
     */
    public static void main(String[] args) {
        // Check for help flag
        if (args.length > 0 && (args[0].equals("-h") || args[0].equals("--help"))) {
            printUsage();
            return;
        }

        // Load configuration from environment
        ServerConfig config = McpServer.loadConfigFromEnv();

        // Create and run server
        McpServer server = new McpServer(config);

        // Add shutdown hook
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            System.err.println("Shutting down...");
            server.stop();
        }));

        try {
            server.run();
        } catch (Exception e) {
            System.err.println("Server error: " + e.getMessage());
            System.exit(1);
        }
    }

    private static void printUsage() {
        System.out.println("T402 MCP Server - Model Context Protocol server for AI agents");
        System.out.println();
        System.out.println("Usage:");
        System.out.println("    java -cp t402.jar io.t402.mcp.T402Mcp");
        System.out.println();
        System.out.println("Environment Variables:");
        System.out.println("    T402_PRIVATE_KEY     Hex wallet private key (0x...)");
        System.out.println("    T402_DEMO_MODE       Set to 'true' to simulate transactions");
        System.out.println("    T402_BUNDLER_URL     ERC-4337 bundler endpoint");
        System.out.println("    T402_PAYMASTER_URL   ERC-4337 paymaster endpoint");
        System.out.println("    T402_RPC_<NETWORK>   Custom RPC URL (e.g., T402_RPC_ETHEREUM)");
        System.out.println();
        System.out.println("Available Tools:");
        System.out.println("    t402/getBalance      Get token balances for a wallet");
        System.out.println("    t402/getAllBalances  Get balances across all networks");
        System.out.println("    t402/pay             Execute a stablecoin payment");
        System.out.println("    t402/payGasless      Execute a gasless ERC-4337 payment");
        System.out.println("    t402/getBridgeFee    Get LayerZero bridge fee quote");
        System.out.println("    t402/bridge          Bridge USDT0 via LayerZero");
        System.out.println();
        System.out.println("Supported Networks:");
        System.out.println("    ethereum, base, arbitrum, optimism, polygon,");
        System.out.println("    avalanche, ink, berachain, unichain");
        System.out.println();
        System.out.println("Example Claude Desktop config (claude_desktop_config.json):");
        System.out.println("    {");
        System.out.println("      \"mcpServers\": {");
        System.out.println("        \"t402\": {");
        System.out.println("          \"command\": \"java\",");
        System.out.println("          \"args\": [\"-cp\", \"t402.jar\", \"io.t402.mcp.T402Mcp\"],");
        System.out.println("          \"env\": {");
        System.out.println("            \"T402_DEMO_MODE\": \"true\"");
        System.out.println("          }");
        System.out.println("        }");
        System.out.println("      }");
        System.out.println("    }");
    }
}
