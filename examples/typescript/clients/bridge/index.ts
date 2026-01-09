/**
 * USDT0 Cross-Chain Bridge Example
 *
 * This example demonstrates how to:
 * 1. Check supported bridging chains
 * 2. Get a bridge quote
 * 3. Execute a bridge transaction
 * 4. Track message delivery via LayerZero Scan
 *
 * Prerequisites:
 * - Private key with USDT0 balance on source chain
 * - Native token for gas fees on source chain
 *
 * Usage:
 *   PRIVATE_KEY=0x... npx ts-node index.ts
 */

import { createWalletClient, http, createPublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum, mainnet } from "viem/chains";
import {
  Usdt0Bridge,
  LayerZeroScanClient,
  CrossChainPaymentRouter,
  getBridgeableChains,
  supportsBridging,
  type BridgeSigner,
} from "@t402/evm";

// Demo mode flag - set to false to execute real transactions
const DEMO_MODE = true;

// Amount to bridge (100 USDT0 = 100_000000 with 6 decimals)
const BRIDGE_AMOUNT = 100_000000n;

/**
 * Create a BridgeSigner from viem clients
 */
function createBridgeSigner(
  walletClient: ReturnType<typeof createWalletClient>,
  publicClient: ReturnType<typeof createPublicClient>
): BridgeSigner {
  return {
    address: walletClient.account!.address,

    async readContract({ address, abi, functionName, args }) {
      return publicClient.readContract({
        address: address as `0x${string}`,
        abi: abi as any,
        functionName,
        args: args as any,
      });
    },

    async writeContract({ address, abi, functionName, args, value }) {
      const hash = await walletClient.writeContract({
        address: address as `0x${string}`,
        abi: abi as any,
        functionName,
        args: args as any,
        value,
      });
      return hash;
    },

    async waitForTransactionReceipt({ hash }) {
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return {
        status: receipt.status,
        transactionHash: receipt.transactionHash,
        logs: receipt.logs.map((log) => ({
          address: log.address,
          topics: log.topics,
          data: log.data,
        })),
      };
    },
  };
}

async function main() {
  console.log("=== USDT0 Cross-Chain Bridge Example ===\n");

  // 1. Check supported chains
  console.log("Supported bridging chains:");
  const chains = getBridgeableChains();
  chains.forEach((chain) => console.log(`  - ${chain}`));
  console.log();

  // 2. Verify chain support
  console.log("Checking chain support:");
  console.log(`  Arbitrum supports bridging: ${supportsBridging("arbitrum")}`);
  console.log(`  Ethereum supports bridging: ${supportsBridging("ethereum")}`);
  console.log(`  Base supports bridging: ${supportsBridging("base")}`);
  console.log();

  if (DEMO_MODE) {
    console.log("[DEMO MODE] Showing example flow without real transactions\n");
    demonstrateDemoMode();
    return;
  }

  // Real transaction mode
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error("ERROR: PRIVATE_KEY environment variable required");
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  console.log(`Wallet address: ${account.address}\n`);

  // Create clients for Arbitrum
  const publicClient = createPublicClient({
    chain: arbitrum,
    transport: http(),
  });

  const walletClient = createWalletClient({
    chain: arbitrum,
    transport: http(),
    account,
  });

  // Create bridge signer
  const signer = createBridgeSigner(walletClient, publicClient);

  // 3. Create bridge client
  const bridge = new Usdt0Bridge(signer, "arbitrum");
  console.log("Created bridge client for Arbitrum");
  console.log(`Supported destinations: ${bridge.getSupportedDestinations().join(", ")}\n`);

  // 4. Get quote
  console.log("Getting bridge quote...");
  const quote = await bridge.quote({
    fromChain: "arbitrum",
    toChain: "ethereum",
    amount: BRIDGE_AMOUNT,
    recipient: account.address,
  });

  console.log("Bridge Quote:");
  console.log(`  Amount to send: ${quote.amountToSend} (${Number(quote.amountToSend) / 1e6} USDT0)`);
  console.log(`  Min amount to receive: ${quote.minAmountToReceive}`);
  console.log(`  Native fee: ${quote.nativeFee} wei`);
  console.log(`  Estimated time: ${quote.estimatedTime} seconds\n`);

  // 5. Execute bridge (uncomment to run)
  console.log("Executing bridge transaction...");
  const result = await bridge.send({
    fromChain: "arbitrum",
    toChain: "ethereum",
    amount: BRIDGE_AMOUNT,
    recipient: account.address,
    slippageTolerance: 0.5,
  });

  console.log("Bridge Result:");
  console.log(`  TX Hash: ${result.txHash}`);
  console.log(`  Message GUID: ${result.messageGuid}`);
  console.log(`  Amount sent: ${result.amountSent}`);
  console.log(`  Amount to receive: ${result.amountToReceive}\n`);

  // 6. Track message delivery
  console.log("Tracking message delivery via LayerZero Scan...");
  const scanClient = new LayerZeroScanClient();

  const message = await scanClient.waitForDelivery(result.messageGuid, {
    timeout: 600000, // 10 minutes
    pollInterval: 10000, // 10 seconds
    onStatusChange: (status) => {
      console.log(`  Status changed: ${status}`);
    },
  });

  console.log("\nDelivery complete!");
  console.log(`  Final status: ${message.status}`);
  console.log(`  Destination TX: ${message.dstTxHash}`);
}

function demonstrateDemoMode() {
  // Demonstrate the API without real transactions
  console.log("Example: Get Bridge Quote");
  console.log(`
  const bridge = new Usdt0Bridge(signer, 'arbitrum');

  const quote = await bridge.quote({
    fromChain: 'arbitrum',
    toChain: 'ethereum',
    amount: 100_000000n, // 100 USDT0
    recipient: '0x...',
  });

  console.log('Fee:', quote.nativeFee, 'wei');
  `);

  console.log("\nExample: Execute Bridge");
  console.log(`
  const result = await bridge.send({
    fromChain: 'arbitrum',
    toChain: 'ethereum',
    amount: 100_000000n,
    recipient: '0x...',
  });

  console.log('TX:', result.txHash);
  console.log('GUID:', result.messageGuid);
  `);

  console.log("\nExample: Track Delivery");
  console.log(`
  const scanClient = new LayerZeroScanClient();

  const message = await scanClient.waitForDelivery(result.messageGuid, {
    onStatusChange: (status) => console.log('Status:', status),
  });

  console.log('Delivered! Dest TX:', message.dstTxHash);
  `);

  console.log("\nExample: Cross-Chain Payment Router");
  console.log(`
  const router = new CrossChainPaymentRouter(signer, 'arbitrum');

  const paymentResult = await router.routePayment({
    sourceChain: 'arbitrum',
    destinationChain: 'ethereum',
    amount: 100_000000n,
    payTo: recipientAddress,
    payer: userAddress,
  });

  // Wait for delivery
  await router.waitForDelivery(paymentResult.messageGuid);
  `);
}

main().catch(console.error);
