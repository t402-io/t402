import { PublicClient, WalletClient, WalletClient } from "viem";
import {
  PaymentExecutionResponse,
  PaymentNeededDetails,
  PaymentPayloadV1,
  ValidPaymentRequest,
} from "./types";
import { permitTypes, usdcName } from "./permit";
import { getUsdcAddressForChain, getUSDCBalance } from "./usdc";
import { abi } from "./erc20PermitABI";

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

  // Verify permit signature is recoverable for the owner address
  const permitTypedData = {
    types: permitTypes,
    primaryType: "Permit",
    domain: {
      name: usdcName,
      version: payload.payload.params.permitVersion,
      chainId: payload.payload.params.chainId,
      // This implicitly verifies the usdc address is correct in the signature
      verifyingContract: paymentDetails.usdcAddress,
    },
    message: {
      owner: payload.payload.params.ownerAddress,
      spender: payload.payload.params.spenderAddress,
      value: payload.payload.params.value,
      nonce: payload.payload.params.nonce,
      deadline: payload.payload.params.deadline,
    },
  };

  const recoveredAddress = await client.verifyTypedData({
    address: payload.payload.params.ownerAddress,
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
    payload.payload.params.deadline <
    Date.now() / 1000 + paymentDetails.resourceMaxTimeSeconds
  ) {
    return {
      isValid: false,
      invalidReason: "Deadline on permit isn't far enough in the future",
    };
  }

  // Verify client has enough funds to cover paymentDetails.maxAmountRequired
  const balance = await getUSDCBalance(
    client,
    payload.payload.params.ownerAddress
  );

  console.log(`balance: ${balance}`);

  if (balance <= paymentDetails.maxAmountRequired) {
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
  wallet: WalletClient,
  payload: PaymentPayloadV1,
  paymentDetails: PaymentNeededDetails
): Promise<PaymentExecutionResponse> {
  // TODO: probably should store stuff in a db here, but the txs can be recovered from chain if we must

  const usdcAddress = getUsdcAddressForChain(payload.payload.params.chainId);

  const results = await wallet.multicall({
    allowFailure: false,
    contracts: [
      {
        abi,
        address: usdcAddress,
        functionName: "permit",
        args: [
          payload.payload.params.ownerAddress,
          payload.payload.params.spenderAddress,
          payload.payload.params.value,
          payload.payload.params.deadline,
          payload.payload.signature,
        ],
      },
      {
        abi: abi,
        address: usdcAddress,
        functionName: "transferFrom",
        args: [
          payload.payload.params.ownerAddress,
          paymentDetails.resourceAddress,
          payload.payload.params.value,
        ],
      },
    ],
  });

  console.log(results);

  return {
    success: true,
    txHash: results[0].hash,
    chainId: payload.payload.params.chainId,
  };
}
