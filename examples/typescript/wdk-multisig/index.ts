/**
 * @t402/wdk-multisig Example
 *
 * This example demonstrates how to use the @t402/wdk-multisig package
 * for multi-sig Safe smart accounts with M-of-N threshold signatures.
 *
 * Prerequisites:
 * 1. Tether WDK accounts (or seed phrases)
 * 2. A bundler API key (e.g., from Pimlico, Alchemy, or Stackup)
 * 3. A paymaster API key (optional, for sponsored transactions)
 *
 * Run with: npx tsx index.ts
 */

import type { Address, Hex } from "viem";
import {
  SAFE_4337_ADDRESSES,
  DEFAULTS,
  MultiSigErrorCode,
  SignatureCollector,
  combineSignatures,
  sortAddresses,
  isValidThreshold,
  generateRequestId,
} from "@t402/wdk-multisig";

// Demo mode - shows API usage without real transactions
const DEMO_MODE = true;

// Example addresses for demo
const DEMO_OWNERS: Address[] = [
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
];

const DEMO_RECIPIENT = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as Address;

async function main() {
  console.log("=== @t402/wdk-multisig Demo ===\n");

  // 1. Display Safe 4337 Module addresses
  console.log("1. Safe 4337 Module Addresses (v0.3.0):");
  console.log(`   Module: ${SAFE_4337_ADDRESSES.module}`);
  console.log(`   Singleton: ${SAFE_4337_ADDRESSES.singleton}`);
  console.log(`   Proxy Factory: ${SAFE_4337_ADDRESSES.proxyFactory}`);
  console.log(`   Fallback Handler: ${SAFE_4337_ADDRESSES.fallbackHandler}`);
  console.log();

  // 2. Display default configuration
  console.log("2. Default Configuration:");
  console.log(`   Request Expiration: ${DEFAULTS.REQUEST_EXPIRATION_MS / 1000 / 60} minutes`);
  console.log(`   Max Owners: ${DEFAULTS.MAX_OWNERS}`);
  console.log(`   Min Threshold: ${DEFAULTS.MIN_THRESHOLD}`);
  console.log();

  // 3. Demonstrate utility functions
  console.log("3. Utility Functions Demo:");

  // Threshold validation
  console.log("\n   isValidThreshold examples:");
  console.log(`   - 2-of-3: ${isValidThreshold(2, 3)}`);
  console.log(`   - 3-of-3: ${isValidThreshold(3, 3)}`);
  console.log(`   - 4-of-3: ${isValidThreshold(4, 3)} (invalid)`);
  console.log(`   - 0-of-3: ${isValidThreshold(0, 3)} (invalid)`);

  // Address sorting
  console.log("\n   sortAddresses (Safe requires sorted owners):");
  const unsorted = [...DEMO_OWNERS].reverse();
  const sorted = sortAddresses(unsorted);
  console.log(`   Before: ${unsorted.map((a) => a.slice(0, 10)).join(", ")}`);
  console.log(`   After:  ${sorted.map((a) => a.slice(0, 10)).join(", ")}`);

  // Request ID generation
  console.log("\n   generateRequestId:");
  console.log(`   - ${generateRequestId()}`);
  console.log(`   - ${generateRequestId()}`);
  console.log();

  // 4. Demonstrate SignatureCollector
  console.log("4. SignatureCollector Demo:");

  const collector = new SignatureCollector({ expirationMs: 60000 }); // 1 minute

  // Create a mock UserOperation
  const mockUserOp = {
    sender: "0x1234567890123456789012345678901234567890" as Address,
    nonce: 0n,
    callData: "0x" as Hex,
    callGasLimit: 100000n,
    verificationGasLimit: 100000n,
    preVerificationGas: 50000n,
    maxFeePerGas: 1000000000n,
    maxPriorityFeePerGas: 1000000000n,
    signature: "0x" as Hex,
  };

  const mockUserOpHash =
    "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as Hex;

  // Create a signature request
  const request = collector.createRequest(mockUserOp, mockUserOpHash, DEMO_OWNERS, 2);

  console.log(`\n   Created request: ${request.id}`);
  console.log(`   Threshold: ${request.threshold}`);
  console.log(`   Owners: ${request.signatures.length}`);
  console.log(`   Collected: ${request.collectedCount}`);
  console.log(`   Is Ready: ${request.isReady}`);

  // Add signatures
  console.log("\n   Adding signature from owner 0...");
  const mockSig1 = "0x" + "11".repeat(65) as Hex;
  collector.addSignature(request.id, DEMO_OWNERS[0], mockSig1);

  let updated = collector.getRequest(request.id)!;
  console.log(`   Collected: ${updated.collectedCount}, Ready: ${updated.isReady}`);

  console.log("\n   Adding signature from owner 1...");
  const mockSig2 = "0x" + "22".repeat(65) as Hex;
  collector.addSignature(request.id, DEMO_OWNERS[1], mockSig2);

  updated = collector.getRequest(request.id)!;
  console.log(`   Collected: ${updated.collectedCount}, Ready: ${updated.isReady}`);

  // Get combined signature
  if (updated.isReady) {
    const combined = collector.getCombinedSignature(request.id);
    console.log(`\n   Combined signature length: ${combined.length} chars`);
    console.log(`   Combined signature: ${combined.slice(0, 50)}...`);
  }

  // Show pending/signed owners
  console.log("\n   Pending owners:", collector.getPendingOwners(request.id).length);
  console.log("   Signed owners:", collector.getSignedOwners(request.id).length);
  console.log();

  // 5. Show usage examples
  console.log("5. Usage Examples:\n");

  console.log(`
// ========================================
// Example 1: Single Seed Multi-sig (2-of-3)
// ========================================
// Use this when you want multi-sig security with one seed phrase.
// Different HD paths create different owner addresses.

import { createMultiSigFromSingleSeed } from '@t402/wdk-multisig';

const client = await createMultiSigFromSingleSeed({
  seedPhrase: 'your seed phrase here...',
  accountIndices: [0, 1, 2], // Uses m/44'/60'/0'/0/0, /1, /2
  threshold: 2,              // 2-of-3 required
  chainConfig: {
    arbitrum: 'https://arb1.arbitrum.io/rpc'
  },
  chain: 'arbitrum',
  bundler: {
    bundlerUrl: 'https://api.pimlico.io/v2/arbitrum/rpc?apikey=YOUR_KEY',
    chainId: 42161,
  },
  paymaster: {
    address: '0x...',
    url: 'https://api.pimlico.io/v2/arbitrum/rpc?apikey=YOUR_KEY',
    type: 'sponsoring',
  },
});

// Check the multi-sig Safe address
const safeAddress = await client.getAccountAddress();
console.log('Safe Address:', safeAddress);
console.log('Owners:', client.getOwners());
console.log('Threshold:', client.getThreshold());

// Execute payment with all local signers
const result = await client.payWithAllSigners(
  { to: '${DEMO_RECIPIENT}', amount: 1000000n }, // 1 USDT0
  client.getSigners()
);

const receipt = await result.wait();
console.log('Transaction Hash:', receipt.txHash);


// ========================================
// Example 2: Multi-party Multi-sig (2-of-3)
// ========================================
// Use this for team wallets where each party has their own seed.

import { createMultiSigFromMultipleSeeds } from '@t402/wdk-multisig';

const teamClient = await createMultiSigFromMultipleSeeds({
  seedPhrases: [
    'alice seed phrase...',
    'bob seed phrase...',
    'charlie seed phrase...',
  ],
  threshold: 2, // 2-of-3 required
  chainConfig: { arbitrum: 'https://arb1.arbitrum.io/rpc' },
  chain: 'arbitrum',
  bundler: { bundlerUrl: '...', chainId: 42161 },
});

// Initiate a payment (requires collecting signatures)
const paymentRequest = await teamClient.initiatePayment({
  to: '${DEMO_RECIPIENT}',
  amount: 5000000n, // 5 USDT0
});

console.log('Request ID:', paymentRequest.requestId);
console.log('UserOp Hash:', paymentRequest.userOpHash);
console.log('Threshold:', paymentRequest.threshold);

// Alice signs (owner index 0)
await paymentRequest.addSignature(0, aliceSigner);
console.log('Signatures:', paymentRequest.collectedCount);

// Bob signs (owner index 1)
await paymentRequest.addSignature(1, bobSigner);
console.log('Ready:', paymentRequest.isReady); // true - threshold met!

// Submit the transaction
const txResult = await paymentRequest.submit();
const txReceipt = await txResult.wait();
console.log('Success:', txReceipt.success);
console.log('Gas Used:', txReceipt.gasUsed);


// ========================================
// Example 3: Managing Pending Requests
// ========================================

// Get all pending signature requests
const pending = client.getPendingRequests();
console.log('Pending requests:', pending.length);

// Check who needs to sign a specific request
const pendingOwners = client.getPendingOwners(requestId);
const signedOwners = client.getSignedOwners(requestId);

console.log('Waiting for:', pendingOwners);
console.log('Already signed:', signedOwners);

// Clean up expired requests
client.cleanup();


// ========================================
// Example 4: Batch Payments
// ========================================

const batchResult = await client.payBatchWithAllSigners({
  payments: [
    { to: '0xAlice...', amount: 1000000n },  // 1 USDT0
    { to: '0xBob...', amount: 2000000n },    // 2 USDT0
    { to: '0xCharlie...', amount: 500000n }, // 0.5 USDT0
  ],
}, client.getSigners());

const batchReceipt = await batchResult.wait();
console.log('Batch payment confirmed:', batchReceipt.txHash);


// ========================================
// Example 5: Error Handling
// ========================================

import { MultiSigError, MultiSigErrorCode } from '@t402/wdk-multisig';

try {
  await paymentRequest.submit();
} catch (error) {
  if (error instanceof MultiSigError) {
    switch (error.code) {
      case MultiSigErrorCode.THRESHOLD_NOT_MET:
        console.log('Need more signatures:', error.context);
        break;
      case MultiSigErrorCode.REQUEST_EXPIRED:
        console.log('Request expired, create a new one');
        break;
      case MultiSigErrorCode.ALREADY_SIGNED:
        console.log('This owner already signed');
        break;
      case MultiSigErrorCode.OWNER_NOT_FOUND:
        console.log('Invalid owner index');
        break;
    }
  }
}
`);

  console.log("=== Demo Complete ===\n");
  console.log("To use with real funds:");
  console.log("1. Install @tetherto/wdk and @tetherto/wdk-wallet-evm");
  console.log("2. Create WDK accounts or prepare seed phrases");
  console.log("3. Get bundler API key from Pimlico, Alchemy, or Stackup");
  console.log("4. Get paymaster API key for sponsored transactions");
  console.log("5. Update the configuration and run your multi-sig!");
  console.log();
}

main().catch(console.error);
