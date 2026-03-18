import { describe, it, expect } from "vitest";

import {
  OFFER_DOMAIN,
  RECEIPT_DOMAIN,
  OFFER_TYPES,
  RECEIPT_TYPES,
  OFFER_PRIMARY_TYPE,
  RECEIPT_PRIMARY_TYPE,
  normalizeOfferForSigning,
  normalizeReceiptForSigning,
  createSignedOffer,
  createSignedReceipt,
  verifyOffer,
  verifyReceipt,
  matchOfferToRequirements,
  isOfferExpired,
} from "../src/offer-receipt";

import type {
  OfferPayload,
  ReceiptPayload,
  EIP712OfferReceiptSigner,
  EIP712OfferReceiptVerifier,
  EIP712Offer,
  EIP712Receipt,
} from "../src/offer-receipt";

// Mock signer
const mockSigner: EIP712OfferReceiptSigner = {
  signOffer: async () => "0xmocksignature_offer",
  signReceipt: async () => "0xmocksignature_receipt",
  getAddress: () => "0x1234567890abcdef1234567890abcdef12345678",
};

// Mock verifier
const mockVerifier: EIP712OfferReceiptVerifier = {
  recoverOfferSigner: async () => "0x1234567890abcdef1234567890abcdef12345678",
  recoverReceiptSigner: async () => "0x1234567890abcdef1234567890abcdef12345678",
};

const failingVerifier: EIP712OfferReceiptVerifier = {
  recoverOfferSigner: async () => { throw new Error("invalid signature"); },
  recoverReceiptSigner: async () => { throw new Error("invalid signature"); },
};

const sampleOffer: OfferPayload = {
  version: 1,
  resourceUrl: "https://api.example.com/data",
  scheme: "exact",
  network: "eip155:8453",
  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  payTo: "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
  amount: "10000",
};

const sampleReceipt: ReceiptPayload = {
  version: 1,
  network: "eip155:8453",
  resourceUrl: "https://api.example.com/data",
  payer: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
  issuedAt: 1700000000,
  transaction: "0xtxhash123",
};

describe("EIP-712 Constants", () => {
  it("should have correct offer domain", () => {
    expect(OFFER_DOMAIN.name).toBe("t402 offer");
    expect(OFFER_DOMAIN.version).toBe("1");
    expect(OFFER_DOMAIN.chainId).toBe(1);
  });

  it("should have correct receipt domain", () => {
    expect(RECEIPT_DOMAIN.name).toBe("t402 receipt");
    expect(RECEIPT_DOMAIN.version).toBe("1");
    expect(RECEIPT_DOMAIN.chainId).toBe(1);
  });

  it("should have correct offer type fields", () => {
    const fieldNames = OFFER_TYPES.Offer.map((f) => f.name);
    expect(fieldNames).toEqual([
      "version", "resourceUrl", "scheme", "network",
      "asset", "payTo", "amount", "validUntil",
    ]);
  });

  it("should have correct receipt type fields", () => {
    const fieldNames = RECEIPT_TYPES.Receipt.map((f) => f.name);
    expect(fieldNames).toEqual([
      "version", "network", "resourceUrl", "payer", "issuedAt", "transaction",
    ]);
  });

  it("should have correct primary types", () => {
    expect(OFFER_PRIMARY_TYPE).toBe("Offer");
    expect(RECEIPT_PRIMARY_TYPE).toBe("Receipt");
  });
});

describe("normalizeOfferForSigning", () => {
  it("should set validUntil to 0 when not provided", () => {
    const normalized = normalizeOfferForSigning(sampleOffer);
    expect(normalized.validUntil).toBe(0);
  });

  it("should preserve validUntil when provided", () => {
    const normalized = normalizeOfferForSigning({ ...sampleOffer, validUntil: 1700001000 });
    expect(normalized.validUntil).toBe(1700001000);
  });

  it("should include all required fields", () => {
    const normalized = normalizeOfferForSigning(sampleOffer);
    expect(normalized.version).toBe(1);
    expect(normalized.resourceUrl).toBe("https://api.example.com/data");
    expect(normalized.scheme).toBe("exact");
    expect(normalized.network).toBe("eip155:8453");
    expect(normalized.asset).toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    expect(normalized.payTo).toBe("0x209693Bc6afc0C5328bA36FaF03C514EF312287C");
    expect(normalized.amount).toBe("10000");
  });
});

describe("normalizeReceiptForSigning", () => {
  it("should set transaction to empty string when not provided", () => {
    const { transaction: _, ...receiptWithout } = sampleReceipt;
    const normalized = normalizeReceiptForSigning(receiptWithout);
    expect(normalized.transaction).toBe("");
  });

  it("should preserve transaction when provided", () => {
    const normalized = normalizeReceiptForSigning(sampleReceipt);
    expect(normalized.transaction).toBe("0xtxhash123");
  });
});

describe("createSignedOffer", () => {
  it("should create a signed offer with EIP-712 format", async () => {
    const offer = await createSignedOffer(mockSigner, sampleOffer, 0);
    expect(offer.format).toBe("eip712");
    expect(offer.payload).toEqual(sampleOffer);
    expect(offer.signature).toBe("0xmocksignature_offer");
    expect(offer.acceptIndex).toBe(0);
  });

  it("should omit acceptIndex when not provided", async () => {
    const offer = await createSignedOffer(mockSigner, sampleOffer);
    expect(offer.acceptIndex).toBeUndefined();
  });
});

describe("createSignedReceipt", () => {
  it("should create a signed receipt with EIP-712 format", async () => {
    const receipt = await createSignedReceipt(mockSigner, sampleReceipt);
    expect(receipt.format).toBe("eip712");
    expect(receipt.payload).toEqual(sampleReceipt);
    expect(receipt.signature).toBe("0xmocksignature_receipt");
  });
});

describe("verifyOffer", () => {
  it("should verify a valid EIP-712 offer", async () => {
    const offer: EIP712Offer = {
      format: "eip712",
      payload: sampleOffer,
      signature: "0xvalid",
    };
    const result = await verifyOffer(mockVerifier, offer);
    expect(result.valid).toBe(true);
    expect(result.signer).toBe("0x1234567890abcdef1234567890abcdef12345678");
    expect(result.payload).toEqual(sampleOffer);
  });

  it("should return invalid for failed verification", async () => {
    const offer: EIP712Offer = {
      format: "eip712",
      payload: sampleOffer,
      signature: "0xinvalid",
    };
    const result = await verifyOffer(failingVerifier, offer);
    expect(result.valid).toBe(false);
  });

  it("should return invalid for JWS format (not yet implemented)", async () => {
    const offer = { format: "jws" as const, signature: "eyJ..." };
    const result = await verifyOffer(mockVerifier, offer);
    expect(result.valid).toBe(false);
  });
});

describe("verifyReceipt", () => {
  it("should verify a valid EIP-712 receipt", async () => {
    const receipt: EIP712Receipt = {
      format: "eip712",
      payload: sampleReceipt,
      signature: "0xvalid",
    };
    const result = await verifyReceipt(mockVerifier, receipt);
    expect(result.valid).toBe(true);
    expect(result.signer).toBe("0x1234567890abcdef1234567890abcdef12345678");
  });

  it("should return invalid for failed verification", async () => {
    const receipt: EIP712Receipt = {
      format: "eip712",
      payload: sampleReceipt,
      signature: "0xinvalid",
    };
    const result = await verifyReceipt(failingVerifier, receipt);
    expect(result.valid).toBe(false);
  });
});

describe("matchOfferToRequirements", () => {
  it("should match when all fields are equal", () => {
    const offer: EIP712Offer = {
      format: "eip712",
      payload: sampleOffer,
      signature: "0x",
    };
    const result = matchOfferToRequirements(offer, {
      scheme: "exact",
      network: "eip155:8453",
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      payTo: "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
      amount: "10000",
    });
    expect(result).toBe(true);
  });

  it("should match case-insensitively for addresses", () => {
    const offer: EIP712Offer = {
      format: "eip712",
      payload: sampleOffer,
      signature: "0x",
    };
    const result = matchOfferToRequirements(offer, {
      scheme: "exact",
      network: "eip155:8453",
      asset: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // lowercase
      payTo: "0x209693bc6afc0c5328ba36faf03c514ef312287c",
      amount: "10000",
    });
    expect(result).toBe(true);
  });

  it("should not match when amount differs", () => {
    const offer: EIP712Offer = {
      format: "eip712",
      payload: sampleOffer,
      signature: "0x",
    };
    const result = matchOfferToRequirements(offer, {
      scheme: "exact",
      network: "eip155:8453",
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      payTo: "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
      amount: "99999",
    });
    expect(result).toBe(false);
  });
});

describe("isOfferExpired", () => {
  it("should return false when validUntil is 0 (no expiry)", () => {
    const offer: EIP712Offer = {
      format: "eip712",
      payload: { ...sampleOffer, validUntil: 0 },
      signature: "0x",
    };
    expect(isOfferExpired(offer)).toBe(false);
  });

  it("should return false when validUntil is not set", () => {
    const offer: EIP712Offer = {
      format: "eip712",
      payload: sampleOffer,
      signature: "0x",
    };
    expect(isOfferExpired(offer)).toBe(false);
  });

  it("should return false when not yet expired", () => {
    const offer: EIP712Offer = {
      format: "eip712",
      payload: { ...sampleOffer, validUntil: 9999999999 },
      signature: "0x",
    };
    expect(isOfferExpired(offer, 1700000000)).toBe(false);
  });

  it("should return true when expired", () => {
    const offer: EIP712Offer = {
      format: "eip712",
      payload: { ...sampleOffer, validUntil: 1700000000 },
      signature: "0x",
    };
    expect(isOfferExpired(offer, 1700000001)).toBe(true);
  });
});
