/**
 * T402 Gasless Payment Demo
 *
 * Shows ERC-4337 Account Abstraction integration for
 * gasless USDT payments - users pay $0 in gas fees.
 *
 * Run: npx tsx demo-gasless.ts
 */

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║          T402 Gasless Payment Demo (ERC-4337)              ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log();

  console.log("🎯 Problem: Users need ETH for gas to pay with USDT");
  console.log("   - Bad UX: \"Buy ETH first to spend your USDT\"");
  console.log("   - Friction: Multiple token management");
  console.log("   - Complexity: Gas price estimation");
  console.log();

  console.log("✨ Solution: ERC-4337 Account Abstraction");
  console.log("   - Smart accounts can pay gas in USDT");
  console.log("   - Or sponsors can cover gas entirely");
  console.log("   - User signs once, paymaster handles rest");
  console.log();

  // Show the code
  const gaslessCode = `
  import { WDKGasless } from "@t402/wdk-gasless";
  import { WDK } from "@aspect-build/aspect-wdk";

  // Initialize WDK wallet
  const wdk = await WDK.create({ ... });

  // Create gasless client with paymaster
  const gasless = new WDKGasless(wdk, {
    bundler: "pimlico",     // or "alchemy", "stackup"
    paymaster: "sponsored", // or "usdt" to pay gas in USDT
  });

  // User pays $5 USDT, $0 gas
  const result = await gasless.pay({
    to: "0x...",
    amount: "5.00",
    asset: "USDT0",
    network: "eip155:8453", // Base
  });

  console.log("Transaction:", result.hash);
  console.log("Gas paid by:", result.gasPayment); // "sponsor" or "usdt"
  `;

  console.log("📝 Code Example:");
  console.log(gaslessCode);
  console.log();

  console.log("🔄 How It Works:");
  console.log();
  console.log("   ┌─────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐");
  console.log("   │  User   │     │  Bundler │     │ Paymaster│     │ Blockchain│");
  console.log("   │  (WDK)  │     │ (Pimlico)│     │          │     │          │");
  console.log("   └────┬────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘");
  console.log("        │               │                │                │");
  console.log("        │ UserOperation │                │                │");
  console.log("        │──────────────>│                │                │");
  console.log("        │               │                │                │");
  console.log("        │               │ Sponsor gas?   │                │");
  console.log("        │               │───────────────>│                │");
  console.log("        │               │                │                │");
  console.log("        │               │ Yes, I'll pay  │                │");
  console.log("        │               │<───────────────│                │");
  console.log("        │               │                │                │");
  console.log("        │               │ Bundle + Submit│                │");
  console.log("        │               │───────────────────────────────>│");
  console.log("        │               │                │                │");
  console.log("        │               │                │    Confirmed   │");
  console.log("        │               │<───────────────────────────────│");
  console.log("        │               │                │                │");
  console.log("        │ Success! $0   │                │                │");
  console.log("        │<──────────────│                │                │");
  console.log();

  console.log("💰 Paymaster Options:");
  console.log();
  console.log("   1. Sponsored (Free for User)");
  console.log("      - Merchant/protocol covers gas");
  console.log("      - Best for onboarding new users");
  console.log("      - Example: First 10 transactions free");
  console.log();
  console.log("   2. USDT Gas Payment");
  console.log("      - User pays gas in USDT, not ETH");
  console.log("      - No need to hold native token");
  console.log("      - Automatic conversion at market rate");
  console.log();

  console.log("🔗 Supported Bundlers:");
  console.log("   • Pimlico - https://pimlico.io");
  console.log("   • Alchemy - https://alchemy.com");
  console.log("   • Stackup - https://stackup.sh");
  console.log("   • Biconomy - https://biconomy.io");
  console.log();

  console.log("🌐 Supported Networks:");
  console.log("   • Ethereum (eip155:1)");
  console.log("   • Base (eip155:8453)");
  console.log("   • Arbitrum (eip155:42161)");
  console.log("   • Optimism (eip155:10)");
  console.log("   • All USDT0-enabled EVM chains");
  console.log();

  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  Result: Users pay USDT without ever touching gas tokens   ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
}

main().catch(console.error);
