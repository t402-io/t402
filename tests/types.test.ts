import { describe, test, expect } from "vitest";

import {
  AuthorizationParameters,
  PaymentNeededDetails,
  PayloadV1,
  PaymentPayloadV1,
} from "../src/shared/types";

import {
  paymentNeededDetailsToJSON,
  paymentNeededDetailsFromJSON,
  authorizationParametersToJSON,
  authorizationParametersFromJSON,
  payloadV1ToJSON,
  payloadV1FromJSON,
  paymentPayloadV1ToJSON,
  paymentPayloadV1FromJSON,
} from "../src/shared/types/convert";

describe("types conversion", () => {
  test("PaymentNeededDetails serialization", () => {
    const details: PaymentNeededDetails = {
      version: 1,
      maxAmountRequired: BigInt(1000),
      resource: "https://api.example.com/resource",
      description: "Test resource",
      mimeType: "application/json",
      outputSchema: null,
      resourceAddress: "0x123" as `0x${string}`,
      resourceMaxTimeSeconds: 60,
      recommendedDeadlineSeconds: 30,
      usdcAddress: "0x456" as `0x${string}`,
      chainId: 1,
    };

    const json = paymentNeededDetailsToJSON(details);
    const restored = paymentNeededDetailsFromJSON(json);
    expect(restored).toEqual(details);
  });

  test("AuthorizationParameters serialization", () => {
    const params: AuthorizationParameters = {
      from: "0x123" as `0x${string}`,
      to: "0x456" as `0x${string}`,
      value: BigInt(1000),
      validAfter: BigInt(1000),
      validBefore: BigInt(2000),
      nonce: "0x123" as `0x${string}`,
      chainId: 1,
      version: "1",
      usdcAddress: "0x456" as `0x${string}`,
    };

    const json = authorizationParametersToJSON(params);
    const restored = authorizationParametersFromJSON(json);
    expect(restored).toEqual(params);
  });

  test("PayloadV1 serialization", () => {
    const payload: PayloadV1 = {
      signature: "0xabc" as `0x${string}`,
      params: {
        from: "0x123" as `0x${string}`,
        to: "0x456" as `0x${string}`,
        value: BigInt(1000),
        validAfter: BigInt(1000),
        validBefore: BigInt(2000),
        nonce: "0x123" as `0x${string}`,
        chainId: 1,
        version: "1",
        usdcAddress: "0x456" as `0x${string}`,
      },
    };

    const json = payloadV1ToJSON(payload);
    const restored = payloadV1FromJSON(json);
    expect(restored).toEqual(payload);
  });

  test("PaymentPayloadV1 serialization", () => {
    const paymentPayload: PaymentPayloadV1 = {
      version: 1,
      resource: "https://api.example.com/resource",
      payload: {
        signature: "0xabc" as `0x${string}`,
        params: {
          from: "0x123" as `0x${string}`,
          to: "0x456" as `0x${string}`,
          value: BigInt(1000),
          validAfter: BigInt(1000),
          validBefore: BigInt(2000),
          nonce: "0x123" as `0x${string}`,
          chainId: 1,
          version: "1",
          usdcAddress: "0x456" as `0x${string}`,
        },
      },
    };

    const json = paymentPayloadV1ToJSON(paymentPayload);
    const restored = paymentPayloadV1FromJSON(json);
    expect(restored).toEqual(paymentPayload);
  });
});
