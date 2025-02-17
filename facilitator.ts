import { PublicClient } from "viem";
import {
  PaymentExecutionResponse,
  PaymentNeededDetails,
  PaymentPayloadV1,
  ValidPaymentRequest,
} from "./types";

import { getUsdcAddressForChain, getUSDCBalance } from "./usdc";
import { abi } from "./erc20PermitABI";
import { SignerWallet } from "./wallet";
import { authorizationTypes, authorizationPrimaryType } from "./permit";
import { config } from "./config";

const PROTOCOL_VERSION = 1;

export async function verifyPayment(
  client: PublicClient,
  payload: PaymentPayloadV1,
  paymentDetails: PaymentNeededDetails
): Promise<ValidPaymentRequest> {
  /* TODO: verification steps:
    - ✅ verify payload version
    - ✅ verify usdc address is correct for the chain
    - ✅ verify permit signature
    - ✅ verify deadline
    - ✅ verify nonce is current
    - verify client has enough funds to cover paymentDetails.maxAmountRequired
    - verify value in payload is enough to cover paymentDetails.maxAmountRequired
    - verify resource is not expired
    - verify resource is not already paid for
    */

  // Verify payload version
  if (
    payload.version !== PROTOCOL_VERSION ||
    paymentDetails.version !== PROTOCOL_VERSION
  ) {
    return {
      isValid: false,
      invalidReason: `Incompatible payload version. payload: ${payload.version}, paymentDetails: ${paymentDetails.version}, supported: ${PROTOCOL_VERSION}`,
    };
  }

  const usdcName = config[payload.payload.params.chainId].usdcName;

  // Verify permit signature is recoverable for the owner address
  const permitTypedData = {
    types: authorizationTypes,
    primaryType: authorizationPrimaryType,
    domain: {
      name: usdcName,
      version: payload.payload.params.version,
      chainId: payload.payload.params.chainId,
      // This implicitly verifies the usdc address is correct in the signature
      verifyingContract: paymentDetails.usdcAddress,
    },
    message: {
      from: payload.payload.params.from,
      to: payload.payload.params.to,
      value: payload.payload.params.value,
      validAfter: payload.payload.params.validAfter,
      validBefore: payload.payload.params.validBefore,
      nonce: payload.payload.params.nonce,
    },
  };

  const recoveredAddress = await client.verifyTypedData({
    address: payload.payload.params.from,
    ...permitTypedData,
    signature: payload.payload.signature,
  });

  if (!recoveredAddress) {
    return {
      isValid: false,
      invalidReason: "Invalid permit signature",
    };
  }

  // Verify usdc address is correct for the chain
  if (
    paymentDetails.usdcAddress !==
    getUsdcAddressForChain(payload.payload.params.chainId)
  ) {
    return {
      isValid: false,
      invalidReason: "Invalid usdc address",
    };
  }

  // Verify deadline is far enough in the future
  if (
    payload.payload.params.validBefore <
    Date.now() / 1000 + paymentDetails.recommendedDeadlineSeconds
  ) {
    return {
      isValid: false,
      invalidReason: "Deadline on permit isn't far enough in the future",
    };
  }

  // Verify client has enough funds to cover paymentDetails.maxAmountRequired
  const balance = await getUSDCBalance(client, payload.payload.params.from);

  if (balance < paymentDetails.maxAmountRequired) {
    return {
      isValid: false,
      invalidReason: "Client does not have enough funds",
    };
  }

  // Verify value in payload is enough to cover paymentDetails.maxAmountRequired
  if (payload.payload.params.value < paymentDetails.maxAmountRequired) {
    return {
      isValid: false,
      invalidReason:
        "Value in payload is not enough to cover paymentDetails.maxAmountRequired",
    };
  }

  return {
    isValid: true,
    invalidReason: undefined,
  };
}

export async function settlePayment(
  wallet: SignerWallet,
  payload: PaymentPayloadV1,
  paymentDetails: PaymentNeededDetails
): Promise<PaymentExecutionResponse> {
  // TODO: probably should store stuff in a db here, but the txs can be recovered from chain if we must

  const tx = await wallet.writeContract({
    address: payload.payload.params.usdcAddress,
    abi,
    functionName: "transferWithAuthorization",
    args: [
      payload.payload.params.from,
      payload.payload.params.to,
      payload.payload.params.value,
      payload.payload.params.validAfter,
      payload.payload.params.validBefore,
      payload.payload.params.nonce,
      payload.payload.signature,
    ],
  });

  const receipt = await wallet.waitForTransactionReceipt({ hash: tx });

  return {
    success: true,
    txHash: tx,
    chainId: payload.payload.params.chainId,
  };
}
