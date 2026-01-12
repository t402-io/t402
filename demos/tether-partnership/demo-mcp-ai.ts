/**
 * T402 MCP AI Agent Demo
 *
 * Shows Model Context Protocol integration enabling
 * AI agents to make autonomous USDT payments.
 *
 * Run: npx tsx demo-mcp-ai.ts
 */

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║          T402 MCP Demo - AI Agent Payments                 ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log();

  console.log("🤖 What is MCP (Model Context Protocol)?");
  console.log("   - Standard protocol for AI tool integration");
  console.log("   - Created by Anthropic for Claude");
  console.log("   - Enables AI agents to use external tools");
  console.log("   - T402 provides payment tools via MCP");
  console.log();

  console.log("🎯 Use Case: AI Agent Paying for Data");
  console.log("   - Agent needs premium API data");
  console.log("   - API requires USDT payment");
  console.log("   - Agent autonomously decides to pay");
  console.log("   - Transaction completes, agent gets data");
  console.log();

  console.log("📦 T402 MCP Tools:");
  console.log();
  console.log("   ┌─────────────────────┬────────────────────────────────┐");
  console.log("   │ Tool                │ Description                    │");
  console.log("   ├─────────────────────┼────────────────────────────────┤");
  console.log("   │ t402/getBalance     │ Get balance on specific chain  │");
  console.log("   │ t402/getAllBalances │ Get balances across all chains │");
  console.log("   │ t402/pay            │ Make a standard payment        │");
  console.log("   │ t402/payGasless     │ Make a gasless payment (4337)  │");
  console.log("   │ t402/bridge         │ Bridge USDT across chains      │");
  console.log("   │ t402/getBridgeFee   │ Estimate bridge fees           │");
  console.log("   └─────────────────────┴────────────────────────────────┘");
  console.log();

  // Show Claude Desktop configuration
  const configCode = `
  // claude_desktop_config.json
  {
    "mcpServers": {
      "t402": {
        "command": "npx",
        "args": ["@t402/mcp"],
        "env": {
          "T402_PRIVATE_KEY": "\${T402_PRIVATE_KEY}",
          "T402_NETWORKS": "eip155:8453,ton:mainnet"
        }
      }
    }
  }
  `;

  console.log("⚙️ Claude Desktop Configuration:");
  console.log(configCode);
  console.log();

  console.log("💬 Example Conversation:");
  console.log();
  console.log("   ┌────────────────────────────────────────────────────────┐");
  console.log("   │ User: Can you get the latest market data from the     │");
  console.log("   │       Premium Data API? It costs $0.10 per request.   │");
  console.log("   └────────────────────────────────────────────────────────┘");
  console.log();
  console.log("   ┌────────────────────────────────────────────────────────┐");
  console.log("   │ Claude: I'll check my wallet balance first.           │");
  console.log("   │                                                        │");
  console.log("   │ [Calling t402/getAllBalances]                         │");
  console.log("   │                                                        │");
  console.log("   │ I have $15.50 USDT on Base. Let me pay for the data. │");
  console.log("   │                                                        │");
  console.log("   │ [Calling t402/pay with amount: 0.10, chain: base]     │");
  console.log("   │                                                        │");
  console.log("   │ Payment successful! Here's the market data:           │");
  console.log("   │ - BTC: $67,234.50                                     │");
  console.log("   │ - ETH: $3,456.78                                      │");
  console.log("   │ - ...                                                 │");
  console.log("   └────────────────────────────────────────────────────────┘");
  console.log();

  console.log("🔐 Security Model:");
  console.log();
  console.log("   1. Budget Limits");
  console.log("      - Set max spend per transaction");
  console.log("      - Set daily/weekly/monthly limits");
  console.log("      - Require confirmation above threshold");
  console.log();
  console.log("   2. Allowlists");
  console.log("      - Restrict to specific merchants");
  console.log("      - Restrict to specific chains");
  console.log("      - Restrict to specific use cases");
  console.log();
  console.log("   3. Audit Trail");
  console.log("      - All transactions logged");
  console.log("      - AI decision reasoning recorded");
  console.log("      - Full transparency for user");
  console.log();

  const securityCode = `
  // MCP server with spending limits
  const mcp = createT402MCP({
    signer: wdkSigner,
    limits: {
      maxPerTransaction: "10.00",  // Max $10 per tx
      dailyLimit: "100.00",        // Max $100/day
      requireConfirmation: "5.00", // Confirm above $5
    },
    allowlist: [
      "api.example.com",
      "data.premium.io",
    ],
  });
  `;

  console.log("📝 Security Configuration:");
  console.log(securityCode);
  console.log();

  console.log("🚀 Future Vision: Autonomous AI Commerce");
  console.log();
  console.log("   Today:");
  console.log("   • AI agents can pay for API access");
  console.log("   • Humans set budgets and approve");
  console.log("   • Simple transactions on-demand");
  console.log();
  console.log("   Tomorrow:");
  console.log("   • AI agents negotiate prices");
  console.log("   • Multi-agent marketplaces");
  console.log("   • Subscription management");
  console.log("   • Investment decisions");
  console.log();

  console.log("🌐 Supported AI Platforms:");
  console.log("   • Claude (Anthropic) - Native MCP support");
  console.log("   • GPT (OpenAI) - Via function calling adapter");
  console.log("   • Custom agents - MCP SDK available");
  console.log();

  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  Result: AI agents can spend USDT with human oversight     ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
}

main().catch(console.error);
