import { PublicClient, WalletClient } from "viem";
import { PaymentNeededDetails, PaymentPayloadV1, Resource } from "./types";
import { getUsdcAddress, getVersion, getNonce } from "./usdc";
import { createNonce, signAuthorization } from "./permit";
import { SignerWallet } from "./wallet";

export async function createPayment(
  client: SignerWallet,
  paymentDetails: PaymentNeededDetails
): Promise<PaymentPayloadV1> {
  const nonce = createNonce();
  const version = await getVersion(client);
  const from = client!.account!.address;

  const validAfter = BigInt(
    Math.floor(Date.now() / 1000) - 2 // 1 block before to account for block timestamping
  );
  const validBefore = BigInt(
    Math.floor(Date.now() / 1000 + paymentDetails.resourceMaxTimeSeconds)
  );

  console.log(
    `Creating payment, maxAmountRequired: ${paymentDetails.maxAmountRequired}`
  );

  const { signature } = await signAuthorization(client, {
    from,
    to: paymentDetails.resourceAddress,
    value: paymentDetails.maxAmountRequired,
    validAfter,
    validBefore,
    nonce,
    chainId: client.chain!.id,
    version,
    usdcAddress: paymentDetails.usdcAddress,
  });

  return {
    version: 1,
    payload: {
      signature,
      params: {
        from,
        to: paymentDetails.resourceAddress,
        value: paymentDetails.maxAmountRequired,
        validAfter,
        validBefore,
        nonce,
        chainId: client.chain!.id,
        version,
        usdcAddress: paymentDetails.usdcAddress,
      },
    },
    resource: paymentDetails.resource,
  };
}
