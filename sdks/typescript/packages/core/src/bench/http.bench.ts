import { bench, describe } from "vitest";
import {
  encodePaymentSignatureHeader,
  decodePaymentSignatureHeader,
  encodePaymentRequiredHeader,
  decodePaymentRequiredHeader,
} from "../http";
import { safeBase64Encode, safeBase64Decode, deepEqual } from "../utils";
import type { PaymentPayload, PaymentRequired } from "../types/payments";

// Sample data for benchmarks
const samplePaymentPayload: PaymentPayload = {
  network: "eip155:1",
  maxAmountRequired: "1000000",
  scheme: "exact",
  namespace: "erc20",
  asset: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  nonce: "123456789",
  validAfter: "1704067200",
  validBefore: "1704153600",
  signature:
    "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b",
};

const samplePaymentRequired: PaymentRequired = {
  version: 2,
  x_paywallId: "test-paywall-123",
  resource: "https://api.example.com/premium",
  description: "Premium API access",
  mimeType: "application/json",
  payTo: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
  maxTimeoutSeconds: 300,
  accepts: [
    {
      scheme: "exact",
      network: "eip155:1",
      maxAmountRequired: "1000000",
      namespace: "erc20",
      asset: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      extra: {},
    },
    {
      scheme: "exact",
      network: "eip155:42161",
      maxAmountRequired: "1000000",
      namespace: "erc20",
      asset: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
      extra: {},
    },
  ],
};

const smallString = "Hello, World!";
const mediumString = JSON.stringify(samplePaymentPayload);
const largeString = JSON.stringify({
  ...samplePaymentRequired,
  accepts: Array(10).fill(samplePaymentRequired.accepts[0]),
});

const encodedSmall = safeBase64Encode(smallString);
const encodedMedium = safeBase64Encode(mediumString);
const encodedLarge = safeBase64Encode(largeString);

describe("Base64 Encoding", () => {
  bench("safeBase64Encode - small string", () => {
    safeBase64Encode(smallString);
  });

  bench("safeBase64Encode - medium string (payment payload)", () => {
    safeBase64Encode(mediumString);
  });

  bench("safeBase64Encode - large string (10 accepts)", () => {
    safeBase64Encode(largeString);
  });
});

describe("Base64 Decoding", () => {
  bench("safeBase64Decode - small string", () => {
    safeBase64Decode(encodedSmall);
  });

  bench("safeBase64Decode - medium string", () => {
    safeBase64Decode(encodedMedium);
  });

  bench("safeBase64Decode - large string", () => {
    safeBase64Decode(encodedLarge);
  });
});

const encodedPayloadHeader = encodePaymentSignatureHeader(samplePaymentPayload);
const encodedRequiredHeader = encodePaymentRequiredHeader(samplePaymentRequired);

describe("Payment Header Encoding", () => {
  bench("encodePaymentSignatureHeader", () => {
    encodePaymentSignatureHeader(samplePaymentPayload);
  });

  bench("encodePaymentRequiredHeader", () => {
    encodePaymentRequiredHeader(samplePaymentRequired);
  });
});

describe("Payment Header Decoding", () => {
  bench("decodePaymentSignatureHeader", () => {
    decodePaymentSignatureHeader(encodedPayloadHeader);
  });

  bench("decodePaymentRequiredHeader", () => {
    decodePaymentRequiredHeader(encodedRequiredHeader);
  });
});

describe("Deep Equality", () => {
  const obj1 = { a: 1, b: { c: 2, d: [1, 2, 3] } };
  const obj2 = { b: { d: [1, 2, 3], c: 2 }, a: 1 };
  const obj3 = { ...samplePaymentRequired };
  const obj4 = { ...samplePaymentRequired };

  bench("deepEqual - small objects (equal)", () => {
    deepEqual(obj1, obj2);
  });

  bench("deepEqual - payment required objects (equal)", () => {
    deepEqual(obj3, obj4);
  });

  bench("deepEqual - different objects", () => {
    deepEqual(obj1, obj3);
  });
});
