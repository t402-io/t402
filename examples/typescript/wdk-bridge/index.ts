/**
 * @t402/wdk-bridge Example
 *
 * This example demonstrates how to use the @t402/wdk-bridge package
 * for cross-chain USDT0 bridging using Tether WDK and LayerZero.
 *
 * Prerequisites:
 * 1. Tether WDK accounts on multiple chains
 * 2. USDT0 tokens on at least one chain
 * 3. Native tokens for gas fees
 *
 * Run with: npx tsx index.ts
 */

import type { Address } from "viem";
import {
  WdkBridgeClient,
  BRIDGE_CHAINS,
  USDT0_ADDRESSES,
  CHAIN_IDS,
  getEstimatedBridgeTime,
  getBridgeableChains,
  type WdkAccount,
} from "@t402/wdk-bridge";

// Demo mode - simulates WDK account behavior
const DEMO_MODE = true;

/**
 * Create a mock WDK account for demo purposes.
 * In production, use the actual Tether WDK SDK.
 */
function createMockWdkAccount(
  address: Address,
  nativeBalance: bigint,
  usdt0Balance: bigint,
): WdkAccount {
  return {
    getAddress: async () => address,
    getBalance: async () => nativeBalance,
    getTokenBalance: async () => usdt0Balance,
    signMessage: async (message: string) => {
      console.log(`[Mock] Signing message: ${message.slice(0, 20)}...`);
      return "0x" + "ab".repeat(65);
    },
    signTypedData: async (params) => {
      console.log(`[Mock] Signing typed data: ${params.primaryType}`);
      return "0x" + "cd".repeat(65);
    },
    sendTransaction: async (params) => {
      console.log(`[Mock] Sending transaction to: ${params.to}`);
      return "0x" + "ef".repeat(32);
    },
  };
}

async function main() {
  console.log("=== @t402/wdk-bridge Demo ===\n");

  // 1. Display supported chains
  console.log("1. Supported Bridge Chains:");
  getBridgeableChains().forEach((chain) => {
    const chainId = CHAIN_IDS[chain];
    const usdt0Addr = USDT0_ADDRESSES[chain];
    console.log(`   - ${chain} (Chain ID: ${chainId})`);
    console.log(`     USDT0: ${usdt0Addr}`);
  });
  console.log();

  // 2. Show estimated bridge times
  console.log("2. Estimated Bridge Times:");
  const routes = [
    ["ethereum", "arbitrum"],
    ["arbitrum", "ethereum"],
    ["arbitrum", "ink"],
    ["ethereum", "berachain"],
  ];
  routes.forEach(([from, to]) => {
    const time = getEstimatedBridgeTime(from, to);
    console.log(`   - ${from} -> ${to}: ~${time / 60} minutes`);
  });
  console.log();

  if (DEMO_MODE) {
    console.log("3. Demo Mode - Creating mock WDK accounts...\n");

    // Create mock accounts for different chains with varying balances
    const mockAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as Address;

    const accounts: Record<string, WdkAccount> = {
      ethereum: createMockWdkAccount(
        mockAddress,
        500000000000000000n, // 0.5 ETH
        10_000000n, // 10 USDT0
      ),
      arbitrum: createMockWdkAccount(
        mockAddress,
        1000000000000000000n, // 1 ETH
        500_000000n, // 500 USDT0
      ),
      ink: createMockWdkAccount(
        mockAddress,
        100000000000000000n, // 0.1 ETH
        0n, // 0 USDT0
      ),
    };

    // Create the bridge client
    const bridge = new WdkBridgeClient({
      accounts,
      defaultStrategy: "cheapest",
      defaultSlippage: 0.5, // 0.5%
    });

    console.log("   Configured chains:", bridge.getConfiguredChains().join(", "));
    console.log();

    // 4. Get balances across all chains
    console.log("4. Multi-Chain Balance Summary:\n");

    const summary = await bridge.getBalances();
    console.log(`   Total USDT0: ${Number(summary.totalUsdt0) / 1e6} USDT0`);
    console.log(`   Chains with balance: ${summary.chainsWithBalance.join(", ")}`);
    console.log(`   Bridgeable chains: ${summary.bridgeableChains.join(", ")}`);
    console.log();

    summary.balances.forEach((bal) => {
      console.log(`   ${bal.chain}:`);
      console.log(`     - USDT0: ${Number(bal.usdt0Balance) / 1e6}`);
      console.log(`     - Native: ${Number(bal.nativeBalance) / 1e18} ETH`);
      console.log(`     - Can bridge: ${bal.canBridge}`);
    });
    console.log();

    // 5. Show example usage
    console.log("5. Example: How to use WdkBridgeClient\n");

    console.log(`
// Create bridge client with WDK accounts
const bridge = new WdkBridgeClient({
  accounts: {
    ethereum: ethereumWdkAccount,
    arbitrum: arbitrumWdkAccount,
    ink: inkWdkAccount,
  },
  defaultStrategy: 'cheapest', // or 'fastest', 'preferred'
  defaultSlippage: 0.5, // 0.5%
});

// Get multi-chain balance summary
const summary = await bridge.getBalances();
console.log('Total USDT0:', summary.totalUsdt0);
console.log('Bridgeable chains:', summary.bridgeableChains);

// Get available routes to a destination
const routes = await bridge.getRoutes('ethereum', 100_000000n);
routes.forEach(route => {
  console.log(\`\${route.fromChain} -> \${route.toChain}\`);
  console.log(\`  Fee: \${route.nativeFee} wei\`);
  console.log(\`  Available: \${route.available}\`);
  if (!route.available) {
    console.log(\`  Reason: \${route.unavailableReason}\`);
  }
});

// Auto-bridge: automatically selects the best source chain
const result = await bridge.autoBridge({
  toChain: 'ethereum',
  amount: 100_000000n, // 100 USDT0
  recipient: '0x...',
  // Optional: preferredSourceChain: 'arbitrum'
  // Optional: slippageTolerance: 0.5
});

console.log('Bridge TX:', result.txHash);
console.log('From chain:', result.fromChain);
console.log('Message GUID:', result.messageGuid);
console.log('Estimated time:', result.estimatedTime, 'seconds');

// Wait for delivery with status updates
const delivery = await result.waitForDelivery({
  timeout: 600000, // 10 minutes
  pollInterval: 10000, // 10 seconds
  onStatusChange: (status) => {
    console.log('Status:', status);
    // INFLIGHT -> CONFIRMING -> DELIVERED
  },
});

console.log('Delivery success:', delivery.success);
console.log('Destination TX:', delivery.dstTxHash);

// Direct bridge from a specific chain
const directResult = await bridge.bridge({
  fromChain: 'arbitrum',
  toChain: 'ethereum',
  amount: 50_000000n, // 50 USDT0
  recipient: '0x...',
  slippageTolerance: 0.3,
});

// Track a message manually
const message = await bridge.trackMessage(result.messageGuid);
console.log('Message status:', message.status);
`);

    console.log("\n=== Demo Complete ===\n");
    console.log("To use with real funds:");
    console.log("1. Install @tetherto/wdk and @tetherto/wdk-wallet-evm");
    console.log("2. Create WDK accounts on multiple chains");
    console.log("3. Ensure you have USDT0 on at least one chain");
    console.log("4. Ensure you have native tokens for gas fees");
    console.log("5. Set DEMO_MODE = false and update the configuration");
    console.log();

    console.log("Supported chains:");
    BRIDGE_CHAINS.forEach((chain) => {
      console.log(`  - ${chain}`);
    });
  }
}

main().catch(console.error);
