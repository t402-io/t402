import { config } from "dotenv";
import type { Address, Hex, PrivateKeyAccount } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  createBundlerClient,
  createPaymaster,
  SafeSmartAccount,
  type UserOperation,
  ENTRYPOINT_V07_ADDRESS,
} from "@t402/evm/erc4337";

config();

const ownerPrivateKey = process.env.OWNER_PRIVATE_KEY as Hex;
const pimlicoApiKey = process.env.PIMLICO_API_KEY as string;
const chainId = parseInt(process.env.CHAIN_ID || "84532"); // Base Sepolia

/**
 * Example demonstrating ERC-4337 gasless transactions with T402.
 *
 * This example shows how to:
 * 1. Create a Safe smart account
 * 2. Connect to a Pimlico bundler
 * 3. Use a Pimlico paymaster for gas sponsorship
 * 4. Build and submit a gasless UserOperation
 *
 * Required environment variables:
 * - OWNER_PRIVATE_KEY: EOA private key that owns the Safe (hex encoded with 0x prefix)
 * - PIMLICO_API_KEY: Your Pimlico API key
 * - CHAIN_ID: (optional) Chain ID, defaults to 84532 (Base Sepolia)
 */
async function main(): Promise<void> {
  if (!ownerPrivateKey) {
    console.error("❌ OWNER_PRIVATE_KEY environment variable is required");
    console.error("   Example: '0xabc123...' (66 character hex string with 0x prefix)");
    process.exit(1);
  }

  if (!pimlicoApiKey) {
    console.error("❌ PIMLICO_API_KEY environment variable is required");
    console.error("   Get one at: https://dashboard.pimlico.io/");
    process.exit(1);
  }

  console.log("🚀 ERC-4337 Gasless Transaction Example\n");

  // Create owner account from private key
  const owner: PrivateKeyAccount = privateKeyToAccount(ownerPrivateKey);
  console.log(`Owner EOA: ${owner.address}`);
  console.log(`Chain ID: ${chainId}\n`);

  // Step 1: Create Safe smart account
  console.log("📦 Creating Safe smart account...");
  const safeAccount = new SafeSmartAccount({
    owner,
    chainId,
    salt: 0n, // Use 0 for deterministic address
  });

  const smartAccountAddress = await safeAccount.getAddress();
  console.log(`   Smart Account Address: ${smartAccountAddress}`);

  const isDeployed = await safeAccount.isDeployed();
  console.log(`   Deployed: ${isDeployed}\n`);

  // Step 2: Create Pimlico bundler client
  console.log("🔗 Connecting to Pimlico bundler...");
  const bundler = createBundlerClient("pimlico", {
    apiKey: pimlicoApiKey,
    chainId,
  });

  // Get current gas prices
  const gasPrice = await bundler.getUserOperationGasPrice();
  console.log(`   Fast gas price: ${gasPrice.fast.maxFeePerGas} wei\n`);

  // Step 3: Create Pimlico paymaster for gas sponsorship
  console.log("💰 Setting up Pimlico paymaster...");
  const paymaster = createPaymaster("pimlico", {
    apiKey: pimlicoApiKey,
    chainId,
  });

  // Step 4: Build UserOperation
  console.log("📝 Building UserOperation...\n");

  // Example: encode a simple ETH transfer (0 value, no data = no-op)
  // In production, you would encode your actual transaction here
  const targetAddress: Address = "0x0000000000000000000000000000000000000000";
  const callData = await safeAccount.encodeExecute(targetAddress, 0n, "0x");

  // Get init code if account not deployed
  const initCode = isDeployed ? "0x" : await safeAccount.getInitCode();

  // Build partial UserOperation
  const userOp: Partial<UserOperation> = {
    sender: smartAccountAddress,
    nonce: 0n, // In production: query nonce from EntryPoint
    initCode: initCode as Hex,
    callData,
    maxFeePerGas: gasPrice.fast.maxFeePerGas,
    maxPriorityFeePerGas: gasPrice.fast.maxPriorityFeePerGas,
  };

  // Step 5: Estimate gas
  console.log("⛽ Estimating gas...");
  try {
    const gasEstimate = await bundler.estimateUserOperationGas({
      ...userOp,
      signature: "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c",
    } as UserOperation);

    console.log(`   Verification Gas: ${gasEstimate.verificationGasLimit}`);
    console.log(`   Call Gas: ${gasEstimate.callGasLimit}`);
    console.log(`   Pre-verification Gas: ${gasEstimate.preVerificationGas}\n`);

    userOp.verificationGasLimit = gasEstimate.verificationGasLimit;
    userOp.callGasLimit = gasEstimate.callGasLimit;
    userOp.preVerificationGas = gasEstimate.preVerificationGas;
  } catch (error) {
    console.log("   ⚠️  Gas estimation failed (this is expected without funds)");
    console.log(`   Error: ${error instanceof Error ? error.message : error}\n`);

    // Use default gas limits for demonstration
    userOp.verificationGasLimit = 150000n;
    userOp.callGasLimit = 100000n;
    userOp.preVerificationGas = 50000n;
  }

  // Step 6: Get paymaster sponsorship
  console.log("🎁 Requesting gas sponsorship...");
  try {
    const paymasterData = await paymaster.getPaymasterData(
      userOp as UserOperation,
      chainId,
      ENTRYPOINT_V07_ADDRESS,
    );

    console.log(`   Paymaster: ${paymasterData.paymaster}`);
    console.log(`   Verification Gas: ${paymasterData.paymasterVerificationGasLimit}`);
    console.log(`   Post-op Gas: ${paymasterData.paymasterPostOpGasLimit}\n`);

    userOp.paymasterAndData = paymasterData.toBytes();
  } catch (error) {
    console.log("   ⚠️  Sponsorship not available (configure policy in Pimlico dashboard)");
    console.log(`   Error: ${error instanceof Error ? error.message : error}\n`);
    userOp.paymasterAndData = "0x";
  }

  // Step 7: Sign the UserOperation
  console.log("✍️  Signing UserOperation...");
  // In production: compute userOpHash and sign it
  // const userOpHash = await computeUserOpHash(userOp, chainId, ENTRYPOINT_V07_ADDRESS);
  // const signature = await safeAccount.signUserOpHash(userOpHash);
  // userOp.signature = signature;

  // For demonstration, use a placeholder signature
  userOp.signature = "0x" + "00".repeat(65);
  console.log("   Signature created (placeholder for demo)\n");

  // Step 8: Submit UserOperation (commented out to avoid actual submission)
  console.log("📤 Ready to submit UserOperation!");
  console.log("   (Submission disabled in demo mode)\n");

  /*
  // Uncomment to actually submit:
  const userOpHash = await bundler.sendUserOperation(userOp as UserOperation);
  console.log(`   UserOp Hash: ${userOpHash}`);

  // Wait for receipt
  console.log("⏳ Waiting for confirmation...");
  const receipt = await bundler.waitForReceipt(userOpHash);
  console.log(`   Success: ${receipt.success}`);
  console.log(`   Transaction: ${receipt.transactionHash}`);
  */

  // Summary
  console.log("📋 Summary:");
  console.log(`   Smart Account: ${smartAccountAddress}`);
  console.log(`   Owner: ${owner.address}`);
  console.log(`   Chain: ${chainId}`);
  console.log(`   Bundler: Pimlico`);
  console.log(`   Paymaster: Pimlico (gas sponsorship)`);
  console.log(`   EntryPoint: ${ENTRYPOINT_V07_ADDRESS}`);
}

main().catch((error) => {
  console.error("❌ Error:", error?.message ?? error);
  process.exit(1);
});
