import { Address, Hex } from "viem";

/*
 * Wire types for client
 */

export type PaymentPayload<T> = {
  version: number;
  payload: T;
  resource: Resource;
};

/**
 * Version 1 of payments protocol payload that is included in a header of requests
 * @property {number} version - Version number of the payload format
 * @property {PayloadV1} payload - v1 of the protocol uses a permit signature and the signed values of the payload
 * to faciliate fast and gasless payments for users.
 * @property {Resource} resource - Resource identifier, ex: https://api.example.com/v1/payments
 */
export type PaymentPayloadV1 = PaymentPayload<PayloadV1>;

export type PayloadV1 = {
  signature: AuthorizationSignature;
  params: AuthorizationParameters;
};

export type AuthorizationSignature = Hex;

export type AuthorizationParameters = {
  from: Address;
  to: Address;
  value: bigint;
  validAfter: bigint;
  validBefore: bigint;
  nonce: Hex;
  chainId: number;
  version: string;
  usdcAddress: Address;
};

export type Resource = `${string}://${string}`;

export type PaymentNeededDetails = {
  // version of the payment protocol
  version: number;
  // max amount required to pay for the resource
  maxAmountRequired: bigint;
  // resource identifier
  resource: Resource;
  // description of the resource
  description: string;
  // mime type of the resource response
  mimeType: string;
  // output schema of the resource
  outputSchema?: object | undefined;
  // address to pay value for access to the resource
  resourceAddress: Address;
  // max time in seconds it may take for the resource to be processed
  resourceMaxTimeSeconds: number;
  // recommended deadline in seconds for the resource to be processed
  recommendedDeadlineSeconds: number;
  // address of the USDC contract
  usdcAddress: Address;
  // chain id of the chain to send payment on
  chainId: number;
};

export type PaymentExecutionResponse = {
  success: boolean;
  error?: string | undefined;
  txHash?: Hex | undefined;
  chainId?: number | undefined;
};

// Verifier
export type ValidPaymentRequest = {
  isValid: boolean;
  invalidReason?: string | undefined;
};
