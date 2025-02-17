import axios from "axios";
import {
  PaymentExecutionResponse,
  PaymentNeededDetails,
  PaymentPayloadV1,
  ValidPaymentResponse,
} from "../shared/types";
import {
  paymentNeededDetailsToJsonSafe,
  paymentPayloadV1ToJsonSafe,
} from "../shared/types/convert";

const defaultServer = "http://localhost:4020";

export async function requestVerify(
  payload: PaymentPayloadV1,
  paymentDetails: PaymentNeededDetails
): Promise<ValidPaymentResponse> {
  const res = await axios.post(`${defaultServer}/verify`, {
    payload: paymentPayloadV1ToJsonSafe(payload),
    details: paymentNeededDetailsToJsonSafe(paymentDetails),
  });

  if (res.status !== 200) {
    throw new Error(`Failed to verify payment: ${res.statusText}`);
  }

  return res.data as ValidPaymentResponse;
}

export async function requestSettle(
  payload: PaymentPayloadV1,
  paymentDetails: PaymentNeededDetails
): Promise<PaymentExecutionResponse> {
  const res = await axios.post(`${defaultServer}/settle`, {
    payload: paymentPayloadV1ToJsonSafe(payload),
    details: paymentNeededDetailsToJsonSafe(paymentDetails),
  });

  if (res.status !== 200) {
    throw new Error(`Failed to settle payment: ${res.statusText}`);
  }

  return res.data as PaymentExecutionResponse;
}
