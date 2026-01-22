#!/usr/bin/env node

/**
 * t402 MCP Server CLI
 *
 * Run the t402 MCP server for Claude Desktop and other AI agents.
 *
 * Usage:
 *   npx @t402/mcp
 *   t402-mcp
 *
 * Environment Variables:
 *   T402_PRIVATE_KEY   - Wallet private key (hex with 0x prefix)
 *   T402_DEMO_MODE     - Set to "true" to simulate transactions
 *   T402_BUNDLER_URL   - ERC-4337 bundler URL for gasless transactions
 *   T402_PAYMASTER_URL - Paymaster URL for gasless transactions
 *   T402_RPC_ETHEREUM  - Custom RPC URL for Ethereum
 *   T402_RPC_BASE      - Custom RPC URL for Base
 *   T402_RPC_ARBITRUM  - Custom RPC URL for Arbitrum
 *   ... (other networks follow same pattern)
 */

import { createT402McpServer, loadConfigFromEnv } from "../dist/esm/index.mjs";

async function main() {
  const config = loadConfigFromEnv();

  // Log configuration status (to stderr so it doesn't interfere with stdio)
  console.error("t402 MCP Server Configuration:");
  console.error(`  Private Key: ${config.privateKey ? "configured" : "not set"}`);
  console.error(`  Demo Mode: ${config.demoMode ? "enabled" : "disabled"}`);
  console.error(`  Bundler URL: ${config.bundlerUrl ? "configured" : "not set"}`);
  console.error(`  Paymaster URL: ${config.paymasterUrl ? "configured" : "not set"}`);

  if (config.rpcUrls) {
    console.error(`  Custom RPC URLs: ${Object.keys(config.rpcUrls).join(", ")}`);
  }

  if (!config.privateKey && !config.demoMode) {
    console.error("");
    console.error("Warning: No private key configured.");
    console.error("Set T402_PRIVATE_KEY env var or enable T402_DEMO_MODE=true");
    console.error("");
  }

  const server = createT402McpServer(config);
  await server.run();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
