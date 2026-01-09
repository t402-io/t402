import { config } from "dotenv";
import { t402Client, wrapFetchWithPayment, t402HTTPClient } from "@t402/fetch";
import { registerExactTonClientScheme } from "@t402/ton";
import type { ClientTonSigner, SignMessageParams } from "@t402/ton";
import { TonClient, WalletContractV4 } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { Address, Cell, internal, SendMode, beginCell } from "@ton/core";

config();

const tonMnemonic = process.env.TON_MNEMONIC as string;
const tonEndpoint = process.env.TON_ENDPOINT || "https://testnet.toncenter.com/api/v2/jsonRPC";
const baseURL = process.env.RESOURCE_SERVER_URL || "http://localhost:4021";
const endpointPath = process.env.ENDPOINT_PATH || "/weather";
const url = `${baseURL}${endpointPath}`;

/**
 * Example demonstrating how to use @t402/fetch with TON payments.
 *
 * This example shows how to:
 * 1. Create a TON wallet from mnemonic
 * 2. Implement the ClientTonSigner interface
 * 3. Register the TON scheme with the t402 client
 * 4. Make requests with automatic TON Jetton payments
 *
 * Required environment variables:
 * - TON_MNEMONIC: 24-word mnemonic phrase for TON wallet
 * - TON_ENDPOINT: (optional) TON RPC endpoint URL
 * - RESOURCE_SERVER_URL: (optional) URL of the resource server
 */
async function main(): Promise<void> {
  if (!tonMnemonic) {
    console.error("❌ TON_MNEMONIC environment variable is required");
    console.error("   Example: 'word1 word2 word3 ... word24'");
    process.exit(1);
  }

  // Initialize TON client and wallet
  const tonClient = new TonClient({ endpoint: tonEndpoint });
  const keyPair = await mnemonicToPrivateKey(tonMnemonic.split(" "));
  const wallet = WalletContractV4.create({
    workchain: 0,
    publicKey: keyPair.publicKey,
  });
  const walletContract = tonClient.open(wallet);

  console.log(`TON Wallet Address: ${wallet.address.toString()}`);
  console.log(`TON Endpoint: ${tonEndpoint}\n`);

  /**
   * Create a ClientTonSigner implementation
   *
   * This wraps the wallet to implement the t402 TON signer interface.
   * The signer is responsible for:
   * - Signing Jetton transfer messages
   * - Providing the wallet address
   * - Getting the current seqno for replay protection
   */
  const tonSigner: ClientTonSigner = {
    address: wallet.address,

    async signMessage(params: SignMessageParams): Promise<Cell> {
      const seqno = await walletContract.getSeqno();

      // Create external message with the internal transfer
      const transfer = wallet.createTransfer({
        seqno,
        secretKey: keyPair.secretKey,
        messages: [
          internal({
            to: params.to,
            value: params.value,
            body: params.body,
            bounce: params.bounce ?? true,
          }),
        ],
        sendMode: params.sendMode ?? SendMode.PAY_GAS_SEPARATELY,
        timeout: params.timeout,
      });

      return transfer;
    },

    async getSeqno(): Promise<number> {
      return walletContract.getSeqno();
    },
  };

  /**
   * Function to get Jetton wallet address
   *
   * Derives the Jetton wallet contract address for a given owner and Jetton master.
   * This is required for building Jetton transfer messages.
   */
  async function getJettonWalletAddress(
    ownerAddress: string,
    jettonMasterAddress: string,
  ): Promise<string> {
    const jettonMaster = Address.parse(jettonMasterAddress);
    const owner = Address.parse(ownerAddress);

    // Call get_wallet_address on Jetton master contract
    const result = await tonClient.runMethod(jettonMaster, "get_wallet_address", [
      { type: "slice", cell: beginCell().storeAddress(owner).endCell() },
    ]);

    const jettonWalletAddress = result.stack.readAddress();
    return jettonWalletAddress.toString();
  }

  // Create t402 client and register TON scheme
  const client = new t402Client();
  registerExactTonClientScheme(client, {
    signer: tonSigner,
    getJettonWalletAddress,
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
