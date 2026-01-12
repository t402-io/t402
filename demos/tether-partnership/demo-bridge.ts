/**
 * T402 Cross-Chain Bridge Demo
 *
 * Shows LayerZero OFT integration for seamless
 * cross-chain USDT0 payments.
 *
 * Run: npx tsx demo-bridge.ts
 */

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║        T402 Cross-Chain Bridge Demo (LayerZero)            ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log();

  console.log("🎯 Problem: User's USDT is on wrong chain");
  console.log("   - User has USDT on Ethereum");
  console.log("   - Merchant accepts payment on Base");
  console.log("   - Manual bridging is complex and slow");
  console.log();

  console.log("✨ Solution: Automatic Cross-Chain Routing");
  console.log("   - T402 detects balance across all chains");
  console.log("   - Automatically bridges via LayerZero OFT");
  console.log("   - User sees single payment action");
  console.log();

  // Show balances
  console.log("💰 User's Balances (via WDK):");
  console.log();
  console.log("   ┌────────────────┬──────────────┐");
  console.log("   │ Chain          │ USDT Balance │");
  console.log("   ├────────────────┼──────────────┤");
  console.log("   │ Ethereum       │ $100.00      │");
  console.log("   │ Base           │ $0.00        │");
  console.log("   │ Arbitrum       │ $25.00       │");
  console.log("   │ TON            │ $50.00       │");
  console.log("   └────────────────┴──────────────┘");
  console.log();

  // Show the code
  const bridgeCode = `
  import { WDKBridge } from "@t402/wdk-bridge";
  import { WDK } from "@aspect-build/aspect-wdk";

  const wdk = await WDK.create({ ... });
  const bridge = new WDKBridge(wdk);

  // Check all balances
  const balances = await wdk.getAllBalances();
  // { "eip155:1": "100.00", "eip155:8453": "0.00", ... }

  // Pay on Base - bridge handles the rest
  const result = await bridge.pay({
    amount: "10.00",
    targetChain: "eip155:8453",  // Base
    payTo: "0x...",
    // Auto-selects Ethereum as source (has $100)
  });

  console.log("Source chain:", result.sourceChain);  // eip155:1
  console.log("Target chain:", result.targetChain);  // eip155:8453
  console.log("Bridge tx:", result.bridgeTx);
  console.log("Payment tx:", result.paymentTx);
  `;

  console.log("📝 Code Example:");
  console.log(bridgeCode);
  console.log();

  console.log("🔄 Bridge Flow:");
  console.log();
  console.log("   Ethereum                LayerZero                 Base");
  console.log("   ┌─────────┐            ┌─────────┐            ┌─────────┐");
  console.log("   │ USDT0   │            │  OFT    │            │ USDT0   │");
  console.log("   │ $100.00 │────────────│ Bridge  │────────────│ $10.00  │");
  console.log("   └─────────┘   burn     └─────────┘   mint     └─────────┘");
  console.log("        │                      │                      │");
  console.log("        │                      │                      │");
  console.log("        ▼                      ▼                      ▼");
  console.log("   ┌─────────┐            ┌─────────┐            ┌─────────┐");
  console.log("   │ USDT0   │            │ Message │            │ Payment │");
  console.log("   │ $90.00  │            │ Verify  │            │ Settled │");
  console.log("   └─────────┘            └─────────┘            └─────────┘");
  console.log();

  console.log("⚡ Smart Routing Features:");
  console.log();
  console.log("   1. Balance Detection");
  console.log("      - Queries all chains in parallel");
  console.log("      - Caches balances with TTL");
  console.log("      - Updates on transactions");
  console.log();
  console.log("   2. Optimal Chain Selection");
  console.log("      - Prefers chains with sufficient balance");
  console.log("      - Considers bridge fees");
  console.log("      - Minimizes total cost");
  console.log();
  console.log("   3. Fee Estimation");
  console.log("      - Real-time LayerZero fees");
  console.log("      - Shows total cost before confirm");
  console.log("      - Supports gas on destination");
  console.log();

  console.log("💎 USDT0 OFT Advantage:");
  console.log();
  console.log("   Traditional Bridge:");
  console.log("   • Lock tokens on source chain");
  console.log("   • Mint wrapped tokens on destination");
  console.log("   • Different token addresses per chain");
  console.log("   • Liquidity fragmentation");
  console.log();
  console.log("   USDT0 (LayerZero OFT):");
  console.log("   • Burn on source, mint on destination");
  console.log("   • Same token, unified liquidity");
  console.log("   • Native USDT on every chain");
  console.log("   • No wrapped token complexity");
  console.log();

  console.log("🌐 Supported Bridge Routes:");
  console.log();
  console.log("   From/To      │ ETH  │ ARB  │ BASE │ OP   │ INK");
  console.log("   ─────────────┼──────┼──────┼──────┼──────┼─────");
  console.log("   Ethereum     │  -   │  ✓   │  ✓   │  ✓   │  ✓");
  console.log("   Arbitrum     │  ✓   │  -   │  ✓   │  ✓   │  ✓");
  console.log("   Base         │  ✓   │  ✓   │  -   │  ✓   │  ✓");
  console.log("   Optimism     │  ✓   │  ✓   │  ✓   │  -   │  ✓");
  console.log("   Ink          │  ✓   │  ✓   │  ✓   │  ✓   │  -");
  console.log();

  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  Result: Pay on any chain with USDT from any other chain  ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
}

main().catch(console.error);
