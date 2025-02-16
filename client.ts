import { PublicClient, WalletClient } from "viem";
import { PaymentNeededDetails, PaymentPayloadV1, Resource } from "./types";
import { getUsdcAddress, getVersion, getNonce } from "./usdc";
import {} from "./usdc";
import { signPermit } from "./permit";

export async function createPayment(
  client: WalletClient,
  paymentDetails: PaymentNeededDetails
): Promise<PaymentPayloadV1> {
  const [nonce, version] = await Promise.all([
    getNonce(client, client.account!.address),
    getVersion(client),
  ]);

  const { signature, params } = await signPermit(
    client,
    paymentDetails.usdcAddress,
    {
      ownerAddress: client.account!.address,
      spenderAddress: paymentDetails.routerAddress,
      value: paymentDetails.maxAmountRequired,
      deadline: BigInt(
        Math.floor(Date.now() / 1000) +
          paymentDetails.recommendedDeadlineSeconds
      ),
      nonce: nonce,
      chainId: client.chain!.id,
      permitVersion: version,
    }
  );

  return {
    version: 1,
    payload: { signature, params },
    resource: paymentDetails.resource,
  };
}
