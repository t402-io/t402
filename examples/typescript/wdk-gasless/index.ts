/**
 * @t402/wdk-gasless Example
 *
 * This example demonstrates how to use the @t402/wdk-gasless package
 * for gasless USDT0 payments using Tether WDK and ERC-4337.
 *
 * Prerequisites:
 * 1. A Tether WDK account
 * 2. A bundler API key (e.g., from Pimlico, Alchemy, or Stackup)
 * 3. A paymaster API key (for sponsored transactions)
 *
 * Run with: npx tsx index.ts
 */

import { createPublicClient, http, type Address } from "viem";
import { arbitrum } from "viem/chains";
import {
  createWdkGaslessClient,
  USDT0_ADDRESSES,
  CHAIN_IDS,
  type WdkAccount,
} from "@t402/wdk-gasless";

// Demo mode - simulates WDK account behavior
const DEMO_MODE = true;

// Example recipient address (Vitalik's address - for demo purposes)
const DEMO_RECIPIENT = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as Address;

/**
 * Create a mock WDK account for demo purposes.
 * In production, use the actual Tether WDK SDK.
 */
function createMockWdkAccount(address: Address): WdkAccount {
  return {
    getAddress: async () => address,
    getBalance: async () => 1000000000000000000n, // 1 ETH
    getTokenBalance: async () => 1000000n, // 1 USDT
    signMessage: async (message: string) => {
      console.log(`[Mock] Signing message: ${message.slice(0, 20)}...`);
      // Return a mock signature (65 bytes)
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
  console.log("=== @t402/wdk-gasless Demo ===\n");

  // 1. Display supported networks and tokens
  console.log("1. Supported Networks:");
  Object.entries(CHAIN_IDS).forEach(([name, id]) => {
    console.log(`   - ${name}: ${id}`);
  });
  console.log();

  console.log("2. USDT0 Addresses:");
  Object.entries(USDT0_ADDRESSES).slice(0, 5).forEach(([chain, address]) => {
    console.log(`   - ${chain}: ${address}`);
  });
  console.log();

  if (DEMO_MODE) {
    console.log("3. Demo Mode - Creating mock WDK account...\n");

    // Create a mock WDK account
    const mockAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as Address;
    const wdkAccount = createMockWdkAccount(mockAddress);

    console.log(`   WDK Account Address: ${await wdkAccount.getAddress()}`);
    console.log(`   Native Balance: ${await wdkAccount.getBalance()} wei`);
    console.log(`   USDT Balance: ${await wdkAccount.getTokenBalance(USDT0_ADDRESSES.arbitrum)}`);
    console.log();

    console.log("4. Creating public client for Arbitrum...\n");

    // Create a public client
    const publicClient = createPublicClient({
      chain: arbitrum,
      transport: http(),
    });

    console.log("5. Example: How to use createWdkGaslessClient\n");

    console.log(`
// Create the gasless client
const client = await createWdkGaslessClient({
  wdkAccount: myWdkAccount,
  publicClient,
  chainId: 42161, // Arbitrum
  bundler: {
    bundlerUrl: 'https://api.pimlico.io/v2/arbitrum/rpc?apikey=YOUR_API_KEY',
    chainId: 42161,
  },
  paymaster: {
    address: '0x...',
    url: 'https://api.pimlico.io/v2/arbitrum/rpc?apikey=YOUR_API_KEY',
    type: 'sponsoring',
  },
});

// Check smart account address
const accountAddress = await client.getAccountAddress();
console.log('Smart Account:', accountAddress);

// Check if account is deployed
const isDeployed = await client.isAccountDeployed();
console.log('Is Deployed:', isDeployed);

// Check USDT0 balance
const balance = await client.getFormattedBalance();
console.log('USDT0 Balance:', balance);

// Check if payment can be sponsored (free gas)
const sponsorInfo = await client.canSponsor({
  to: '${DEMO_RECIPIENT}',
  amount: 1000000n, // 1 USDT0
});
console.log('Can Sponsor:', sponsorInfo.canSponsor);

// Execute gasless payment
const result = await client.pay({
  to: '${DEMO_RECIPIENT}',
  amount: 1000000n, // 1 USDT0
});

console.log('UserOp Hash:', result.userOpHash);
console.log('Sponsored:', result.sponsored);

// Wait for confirmation
const receipt = await result.wait();
console.log('Transaction Hash:', receipt.txHash);
console.log('Success:', receipt.success);

// Batch payments example
const batchResult = await client.payBatch({
  payments: [
    { to: '0xAlice...', amount: 1000000n }, // 1 USDT0
    { to: '0xBob...', amount: 2000000n },   // 2 USDT0
    { to: '0xCharlie...', amount: 500000n }, // 0.5 USDT0
  ],
});
`);

    console.log("=== Demo Complete ===\n");
    console.log("To use with real funds:");
    console.log("1. Install @tetherto/wdk and @tetherto/wdk-wallet-evm");
    console.log("2. Create a real WDK account");
    console.log("3. Get bundler/paymaster API keys from Pimlico, Alchemy, or Stackup");
    console.log("4. Set DEMO_MODE = false and update the configuration");
    console.log();
  }
}

main().catch(console.error);
