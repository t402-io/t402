/**
 * T402 + WDK Payment Demo
 *
 * This demo shows how T402 integrates with Tether's Wallet Development Kit
 * for seamless USDT payments across multiple blockchains.
 *
 * Run: npx tsx demo-wdk-payment.ts
 */

import { WDKSigner } from "@t402/wdk";
import { createPaymentClient, wrapFetch } from "@t402/core";
import { evmScheme } from "@t402/evm";
import { tonScheme } from "@t402/ton";

// Demo configuration
const DEMO_API = "https://demo.t402.io";

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║          T402 + Tether WDK Payment Demo                    ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log();

  // Step 1: Initialize WDK (user's self-custodial wallet)
  console.log("📱 Step 1: Initialize WDK Wallet");
  console.log("   - User controls their own keys");
  console.log("   - Multi-chain support (EVM, TON, TRON, Solana)");
  console.log("   - Balance aggregation across all chains");
  console.log();

  // In real usage, this would be:
  // const wdk = await WDK.create({ ... });
  // const signer = new WDKSigner(wdk);

  // For demo, we'll show the code pattern
  const demoCode = `
  import { WDK } from "@aspect-build/aspect-wdk";
  import { WDKSigner } from "@t402/wdk";

  // Initialize WDK (Tether's Wallet Development Kit)
  const wdk = await WDK.create({
    chains: ["ethereum", "base", "arbitrum", "ton"],
    // Self-custodial: user's keys never leave their device
  });

  // Create T402 signer from WDK
  const signer = new WDKSigner(wdk);
  `;
  console.log("   Code:", demoCode.trim().split("\n").map(l => "   " + l).join("\n"));
  console.log();

  // Step 2: Create Payment Client
  console.log("💳 Step 2: Create T402 Payment Client");
  console.log("   - Register signer for all supported chains");
  console.log("   - Automatic chain detection from payment requirements");
  console.log();

  const clientCode = `
  import { createPaymentClient } from "@t402/core";
  import { evmScheme } from "@t402/evm";
  import { tonScheme } from "@t402/ton";

  const client = createPaymentClient()
    .withScheme("eip155:*", evmScheme(signer))  // All EVM chains
    .withScheme("ton:*", tonScheme(signer))      // TON mainnet/testnet
    .build();
  `;
  console.log("   Code:", clientCode.trim().split("\n").map(l => "   " + l).join("\n"));
  console.log();

  // Step 3: Make Payment Request
  console.log("🌐 Step 3: Fetch with Automatic Payment");
  console.log("   - Request premium content");
  console.log("   - Receive 402 Payment Required");
  console.log("   - Client signs payment (off-chain, gasless)");
  console.log("   - Retry with payment header");
  console.log("   - Receive content");
  console.log();

  const fetchCode = `
  // Wrap fetch with payment handling
  const paidFetch = wrapFetch(fetch, client);

  // Fetch premium content - payment handled automatically
  const response = await paidFetch("https://api.example.com/premium/data");
  const data = await response.json();

  console.log("Content received:", data);
  `;
  console.log("   Code:", fetchCode.trim().split("\n").map(l => "   " + l).join("\n"));
  console.log();

  // Step 4: Show Payment Flow
  console.log("📊 Payment Flow:");
  console.log();
  console.log("   ┌─────────┐         ┌─────────┐         ┌─────────────┐");
  console.log("   │  User   │         │ Server  │         │ Facilitator │");
  console.log("   │  (WDK)  │         │         │         │             │");
  console.log("   └────┬────┘         └────┬────┘         └──────┬──────┘");
  console.log("        │                   │                     │");
  console.log("        │  GET /premium     │                     │");
  console.log("        │──────────────────>│                     │");
  console.log("        │                   │                     │");
  console.log("        │  402 + Payment Req│                     │");
  console.log("        │<──────────────────│                     │");
  console.log("        │                   │                     │");
  console.log("        │ [Sign with WDK]   │                     │");
  console.log("        │                   │                     │");
  console.log("        │  GET + X-Payment  │                     │");
  console.log("        │──────────────────>│                     │");
  console.log("        │                   │                     │");
  console.log("        │                   │  Verify signature   │");
  console.log("        │                   │────────────────────>│");
  console.log("        │                   │                     │");
  console.log("        │                   │  Valid ✓            │");
  console.log("        │                   │<────────────────────│");
  console.log("        │                   │                     │");
  console.log("        │  200 OK + Content │                     │");
  console.log("        │<──────────────────│                     │");
  console.log("        │                   │                     │");
  console.log("        │                   │  Settle on-chain    │");
  console.log("        │                   │────────────────────>│");
  console.log("        │                   │                     │");
  console.log();

  // Step 5: Show Benefits
  console.log("✨ Key Benefits:");
  console.log();
  console.log("   For Users:");
  console.log("   • Self-custodial (WDK) - user controls keys");
  console.log("   • Gasless payments via EIP-3009");
  console.log("   • One wallet for all chains");
  console.log("   • Transparent pricing in USDT");
  console.log();
  console.log("   For Developers:");
  console.log("   • 5-line integration");
  console.log("   • Works with any HTTP framework");
  console.log("   • Production-ready SDKs");
  console.log("   • Automatic chain handling");
  console.log();
  console.log("   For Tether:");
  console.log("   • Increased USDT utility");
  console.log("   • WDK ecosystem growth");
  console.log("   • Cross-chain adoption");
  console.log("   • Standard payment protocol");
  console.log();

  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║                    Demo Complete                           ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
}

main().catch(console.error);
