/**
 * @t402/mcp Standalone Usage Example
 *
 * This example demonstrates how to use the t402 MCP tools programmatically
 * without running a full MCP server.
 *
 * Run with: npx tsx examples/typescript/mcp/standalone.ts
 */

import {
  executeGetBalance,
  executeGetAllBalances,
  executePay,
  executeGetBridgeFee,
  formatBalanceResult,
  formatAllBalancesResult,
  formatPaymentResult,
  formatBridgeFeeResult,
} from "@t402/mcp";

// Example wallet address (Vitalik's address - for demo purposes)
const DEMO_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

async function main() {
  console.log("=== t402 MCP Tools Demo ===\n");

  // 1. Check balance on a single network
  console.log("1. Checking balance on Ethereum...\n");
  try {
    const balance = await executeGetBalance({
      network: "ethereum",
      address: DEMO_ADDRESS,
    });
    console.log(formatBalanceResult(balance));
    console.log("\n" + "=".repeat(50) + "\n");
  } catch (error) {
    console.error("Error checking balance:", error);
  }

  // 2. Check balances across multiple networks
  console.log("2. Checking balances across networks...\n");
  try {
    const allBalances = await executeGetAllBalances({
      address: DEMO_ADDRESS,
      networks: ["ethereum", "base", "arbitrum"],
    });
    console.log(formatAllBalancesResult(allBalances));
    console.log("\n" + "=".repeat(50) + "\n");
  } catch (error) {
    console.error("Error checking all balances:", error);
  }

  // 3. Get bridge fee quote
  console.log("3. Getting bridge fee quote (Arbitrum -> Ethereum)...\n");
  try {
    const quote = await executeGetBridgeFee({
      fromChain: "arbitrum",
      toChain: "ethereum",
      amount: "100",
      recipient: DEMO_ADDRESS,
    });
    console.log(formatBridgeFeeResult(quote));
    console.log("\n" + "=".repeat(50) + "\n");
  } catch (error) {
    console.error("Error getting bridge fee:", error);
  }

  // 4. Demo payment (simulation only)
  console.log("4. Simulating payment (demo mode)...\n");
  try {
    const payment = await executePay(
      {
        to: "0x1234567890123456789012345678901234567890",
        amount: "10.00",
        token: "USDC",
        network: "base",
      },
      {
        privateKey: "0x", // Not needed in demo mode
        demoMode: true,
      }
    );
    console.log(formatPaymentResult(payment));
    console.log("\n(This was a simulated transaction - no real funds moved)");
  } catch (error) {
    console.error("Error executing payment:", error);
  }

  console.log("\n=== Demo Complete ===");
}

main().catch(console.error);
