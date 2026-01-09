import { config } from "dotenv";
import { t402Client, wrapFetchWithPayment, t402HTTPClient } from "@t402/fetch";
import { registerExactTronClientScheme } from "@t402/tron";
import type { ClientTronSigner, SignTransactionParams, BlockInfo } from "@t402/tron";

config();

const tronPrivateKey = process.env.TRON_PRIVATE_KEY as string;
const tronAddress = process.env.TRON_ADDRESS as string;
const tronEndpoint = process.env.TRON_ENDPOINT || "https://api.nileex.io";
const baseURL = process.env.RESOURCE_SERVER_URL || "http://localhost:4021";
const endpointPath = process.env.ENDPOINT_PATH || "/weather";
const url = `${baseURL}${endpointPath}`;

/**
 * Example demonstrating how to use @t402/fetch with TRON payments.
 *
 * This example shows how to:
 * 1. Create a TRON wallet from private key
 * 2. Implement the ClientTronSigner interface
 * 3. Register the TRON scheme with the t402 client
 * 4. Make requests with automatic TRON TRC20 USDT payments
 *
 * Required environment variables:
 * - TRON_PRIVATE_KEY: Private key for TRON wallet (hex encoded)
 * - TRON_ADDRESS: TRON wallet address (T...)
 * - TRON_ENDPOINT: (optional) TRON RPC endpoint URL
 * - RESOURCE_SERVER_URL: (optional) URL of the resource server
 */
async function main(): Promise<void> {
  if (!tronPrivateKey) {
    console.error("❌ TRON_PRIVATE_KEY environment variable is required");
    console.error("   Example: 'abc123...' (64 character hex string)");
    process.exit(1);
  }

  if (!tronAddress) {
    console.error("❌ TRON_ADDRESS environment variable is required");
    console.error("   Example: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'");
    process.exit(1);
  }

  console.log(`TRON Wallet Address: ${tronAddress}`);
  console.log(`TRON Endpoint: ${tronEndpoint}\n`);

  /**
   * Create a ClientTronSigner implementation
   *
   * This wraps the wallet to implement the t402 TRON signer interface.
   * The signer is responsible for:
   * - Signing TRC20 transfer transactions
   * - Providing the wallet address
   * - Getting block info for transaction building
   *
   * In production, you would use TronWeb or a similar library:
   * import TronWeb from "tronweb";
   * const tronWeb = new TronWeb({ fullHost: tronEndpoint, privateKey: tronPrivateKey });
   */
  const tronSigner: ClientTronSigner = {
    address: tronAddress,

    async signTransaction(params: SignTransactionParams): Promise<string> {
      // In production, use TronWeb to build and sign the transaction:
      //
      // const tronWeb = new TronWeb({ fullHost: tronEndpoint, privateKey: tronPrivateKey });
      //
      // // Build TRC20 transfer transaction
      // const functionSelector = "transfer(address,uint256)";
      // const parameter = [
      //   { type: "address", value: params.to },
      //   { type: "uint256", value: params.amount },
      // ];
      //
      // const tx = await tronWeb.transactionBuilder.triggerSmartContract(
      //   params.contractAddress,
      //   functionSelector,
      //   { feeLimit: params.feeLimit },
      //   parameter,
      //   tronAddress
      // );
      //
      // const signedTx = await tronWeb.trx.sign(tx.transaction);
      // return JSON.stringify(signedTx);

      console.log("📝 Signing TRC20 transfer:");
      console.log(`   Contract: ${params.contractAddress}`);
      console.log(`   To: ${params.to}`);
      console.log(`   Amount: ${params.amount}`);
      console.log(`   Fee Limit: ${params.feeLimit} SUN`);

      // Placeholder - in production return actual signed transaction
      return JSON.stringify({
        txID: "placeholder_tx_id",
        raw_data: { contract: [] },
        signature: ["placeholder_signature"],
      });
    },

    async getBlockInfo(): Promise<BlockInfo> {
      // In production, use TronWeb to get the latest block:
      //
      // const tronWeb = new TronWeb({ fullHost: tronEndpoint });
      // const block = await tronWeb.trx.getCurrentBlock();
      // const blockHash = block.blockID;
      // const blockNumber = block.block_header.raw_data.number;
      //
      // return {
      //   refBlockBytes: blockNumber.toString(16).slice(-4).padStart(4, "0"),
      //   refBlockHash: blockHash.slice(16, 32),
      //   expiration: Date.now() + 60000, // 1 minute from now
      // };

      const now = Date.now();
      return {
        refBlockBytes: "0000",
        refBlockHash: "0000000000000000",
        expiration: now + 60000,
      };
    },
  };

  // Create t402 client and register TRON scheme
  const client = new t402Client();
  registerExactTronClientScheme(client, {
    signer: tronSigner,
  });

  // Wrap fetch with payment handling
  const fetchWithPayment = wrapFetchWithPayment(fetch, client);

  console.log(`Making request to: ${url}\n`);

  try {
    const response = await fetchWithPayment(url, { method: "GET" });
    const body = await response.json();
    console.log("Response body:", body);

    if (response.ok) {
      const paymentResponse = new t402HTTPClient(client).getPaymentSettleResponse(name =>
        response.headers.get(name),
      );
      if (paymentResponse) {
        console.log("\n💰 Payment Details:");
        console.log(`   Transaction: ${paymentResponse.transaction}`);
        console.log(`   Network: ${paymentResponse.network}`);
        console.log(`   Payer: ${paymentResponse.payer}`);
      }
    } else {
      console.log(`\nNo payment settled (response status: ${response.status})`);
    }
  } catch (error) {
    console.error("Request failed:", error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error(error?.response?.data?.error ?? error);
  process.exit(1);
});
