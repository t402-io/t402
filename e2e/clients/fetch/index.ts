import { config } from "dotenv";
import { wrapFetchWithPayment, decodePaymentResponseHeader } from "@t402/fetch";
import { privateKeyToAccount } from "viem/accounts";
import { registerExactEvmScheme } from "@t402/evm/exact/client";
import { registerExactSvmScheme } from "@t402/svm/exact/client";
import { base58 } from "@scure/base";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { t402Client, t402HTTPClient } from "@t402/core/client";

config();

const baseURL = process.env.RESOURCE_SERVER_URL as string;
const endpointPath = process.env.ENDPOINT_PATH as string;
const url = `${baseURL}${endpointPath}`;
const evmAccount = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);
const svmSigner = await createKeyPairSignerFromBytes(base58.decode(process.env.SVM_PRIVATE_KEY as string));

// Create client and register EVM and SVM schemes using the new register helpers
const client = new t402Client();
registerExactEvmScheme(client, { signer: evmAccount });
registerExactSvmScheme(client, { signer: svmSigner });

const fetchWithPayment = wrapFetchWithPayment(fetch, client);

fetchWithPayment(url, {
  method: "GET",
}).then(async response => {
  const data = await response.json();
  const paymentResponse = new t402HTTPClient(client).getPaymentSettleResponse((name) => response.headers.get(name));

  if (!paymentResponse) {
    // No payment was required
    const result = {
      success: true,
      data: data,
      status_code: response.status,
    };
    console.log(JSON.stringify(result));
    process.exit(0);
    return;
  }

  const result = {
    success: paymentResponse.success,
    data: data,
    status_code: response.status,
    payment_response: paymentResponse,
  };

  // Output structured result as JSON for proxy to parse
  console.log(JSON.stringify(result));
  process.exit(0);
});
