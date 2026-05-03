import { describe, it, expect } from "vitest";

import {
  createOffersFromRequirements,
  createReceiptForPayment,
  extractOffers,
  extractReceipt,
  findAndVerifyOffer,
  verifyReceiptFromResponse,
  OFFER_RECEIPT_KEY,
} from "../src/offer-receipt";

import type {
  EIP712OfferReceiptSigner,
  EIP712OfferReceiptVerifier,
  EIP712Offer,
  EIP712Receipt,
} from "../src/offer-receipt";

const mockSigner: EIP712OfferReceiptSigner = {
  signOffer: async () => "0xoffer_sig",
  signReceipt: async () => "0xreceipt_sig",
  getAddress: () => "0xserver1234",
};

const mockVerifier: EIP712OfferReceiptVerifier = {
  recoverOfferSigner: async () => "0xserver1234",
  recoverReceiptSigner: async () => "0xserver1234",
};

const failingVerifier: EIP712OfferReceiptVerifier = {
  recoverOfferSigner: async () => {
    throw new Error("bad sig");
  },
  recoverReceiptSigner: async () => {
    throw new Error("bad sig");
  },
};

const accepts = [
  {
    scheme: "exact",
    network: "eip155:8453",
    asset: "0xUSDC",
    payTo: "0xserver1234",
    amount: "10000",
  },
  {
    scheme: "exact",
    network: "eip155:1",
    asset: "0xUSDT0",
    payTo: "0xserver1234",
    amount: "10000",
  },
];

describe("Server: createOffersFromRequirements", () => {
  it("should create one offer per accepted payment method", async () => {
    const offers = await createOffersFromRequirements(
      { signer: mockSigner, resourceUrl: "https://api.example.com/data" },
      accepts,
    );

    expect(offers).toHaveLength(2);
    expect(offers[0].format).toBe("eip712");
    expect((offers[0] as EIP712Offer).payload.network).toBe("eip155:8453");
    expect((offers[0] as EIP712Offer).acceptIndex).toBe(0);
    expect((offers[1] as EIP712Offer).payload.network).toBe("eip155:1");
    expect((offers[1] as EIP712Offer).acceptIndex).toBe(1);
  });

  it("should set validUntil when offerValiditySeconds is configured", async () => {
    const offers = await createOffersFromRequirements(
      {
        signer: mockSigner,
        resourceUrl: "https://api.example.com/data",
        offerValiditySeconds: 300,
      },
      accepts,
    );

    const payload = (offers[0] as EIP712Offer).payload;
    expect(payload.validUntil).toBeGreaterThan(0);
  });

  it("should set validUntil to 0 when no offerValiditySeconds", async () => {
    const offers = await createOffersFromRequirements(
      { signer: mockSigner, resourceUrl: "https://api.example.com/data" },
      accepts,
    );

    expect((offers[0] as EIP712Offer).payload.validUntil).toBe(0);
  });
});

describe("Server: createReceiptForPayment", () => {
  it("should create a signed receipt", async () => {
    const receipt = await createReceiptForPayment(
      { signer: mockSigner, resourceUrl: "https://api.example.com/data" },
      {
        network: "eip155:8453",
        payer: "0xpayer",
        transaction: "0xtxhash",
      },
    );

    expect(receipt.format).toBe("eip712");
    const payload = (receipt as EIP712Receipt).payload;
    expect(payload.network).toBe("eip155:8453");
    expect(payload.payer).toBe("0xpayer");
    expect(payload.transaction).toBe("0xtxhash");
    expect(payload.issuedAt).toBeGreaterThan(0);
  });

  it("should handle missing transaction", async () => {
    const receipt = await createReceiptForPayment(
      { signer: mockSigner, resourceUrl: "https://api.example.com/data" },
      { network: "eip155:8453", payer: "0xpayer" },
    );

    expect((receipt as EIP712Receipt).payload.transaction).toBeUndefined();
  });
});

describe("Client: extractOffers", () => {
  it("should extract offers from extensions", () => {
    const extensions = {
      [OFFER_RECEIPT_KEY]: {
        info: {
          offers: [{ format: "eip712", payload: {}, signature: "0x" }],
        },
      },
    };

    const offers = extractOffers(extensions);
    expect(offers).toHaveLength(1);
  });

  it("should return empty array when no extensions", () => {
    expect(extractOffers(undefined)).toEqual([]);
    expect(extractOffers({})).toEqual([]);
  });
});

describe("Client: extractReceipt", () => {
  it("should extract receipt from extensions", () => {
    const extensions = {
      [OFFER_RECEIPT_KEY]: {
        info: {
          receipt: { format: "eip712", payload: {}, signature: "0x" },
        },
      },
    };

    const receipt = extractReceipt(extensions);
    expect(receipt).not.toBeNull();
    expect(receipt!.format).toBe("eip712");
  });

  it("should return null when no receipt", () => {
    expect(extractReceipt(undefined)).toBeNull();
    expect(extractReceipt({})).toBeNull();
  });
});

describe("Client: findAndVerifyOffer", () => {
  const sampleOffer: EIP712Offer = {
    format: "eip712",
    payload: {
      version: 1,
      resourceUrl: "https://api.example.com/data",
      scheme: "exact",
      network: "eip155:8453",
      asset: "0xUSDC",
      payTo: "0xserver1234",
      amount: "10000",
    },
    signature: "0xvalid",
    acceptIndex: 0,
  };

  it("should find and verify a matching offer", async () => {
    const result = await findAndVerifyOffer(mockVerifier, [sampleOffer], {
      scheme: "exact",
      network: "eip155:8453",
      asset: "0xUSDC",
      payTo: "0xserver1234",
      amount: "10000",
    });

    expect(result).not.toBeNull();
    expect(result!.signer).toBe("0xserver1234");
  });

  it("should return null when no matching offer", async () => {
    const result = await findAndVerifyOffer(mockVerifier, [sampleOffer], {
      scheme: "exact",
      network: "eip155:1",
      asset: "0xUSDC",
      payTo: "0xserver1234",
      amount: "10000",
    });

    expect(result).toBeNull();
  });

  it("should return null when signature verification fails", async () => {
    const result = await findAndVerifyOffer(failingVerifier, [sampleOffer], {
      scheme: "exact",
      network: "eip155:8453",
      asset: "0xUSDC",
      payTo: "0xserver1234",
      amount: "10000",
    });

    expect(result).toBeNull();
  });

  it("should return null when expected signer does not match", async () => {
    const result = await findAndVerifyOffer(
      mockVerifier,
      [sampleOffer],
      {
        scheme: "exact",
        network: "eip155:8453",
        asset: "0xUSDC",
        payTo: "0xserver1234",
        amount: "10000",
      },
      { expectedSigner: "0xdifferent" },
    );

    expect(result).toBeNull();
  });

  it("should skip expired offers", async () => {
    const expiredOffer: EIP712Offer = {
      ...sampleOffer,
      payload: { ...sampleOffer.payload, validUntil: 1000 },
    };

    const result = await findAndVerifyOffer(
      mockVerifier,
      [expiredOffer],
      {
        scheme: "exact",
        network: "eip155:8453",
        asset: "0xUSDC",
        payTo: "0xserver1234",
        amount: "10000",
      },
      { nowSeconds: 2000 },
    );

    expect(result).toBeNull();
  });
});

describe("Client: verifyReceiptFromResponse", () => {
  it("should verify a valid receipt", async () => {
    const extensions = {
      [OFFER_RECEIPT_KEY]: {
        info: {
          receipt: {
            format: "eip712" as const,
            payload: {
              version: 1,
              network: "eip155:8453",
              resourceUrl: "https://api.example.com/data",
              payer: "0xpayer",
              issuedAt: 1700000000,
              transaction: "0xtx",
            },
            signature: "0xvalid",
          },
        },
      },
    };

    const result = await verifyReceiptFromResponse(mockVerifier, extensions);
    expect(result).not.toBeNull();
    expect(result!.signer).toBe("0xserver1234");
    expect(result!.payload.payer).toBe("0xpayer");
  });

  it("should return null when no receipt in extensions", async () => {
    const result = await verifyReceiptFromResponse(mockVerifier, {});
    expect(result).toBeNull();
  });

  it("should return null when expected signer does not match", async () => {
    const extensions = {
      [OFFER_RECEIPT_KEY]: {
        info: {
          receipt: {
            format: "eip712" as const,
            payload: {
              version: 1,
              network: "eip155:8453",
              resourceUrl: "https://api.example.com/data",
              payer: "0xpayer",
              issuedAt: 1700000000,
            },
            signature: "0xvalid",
          },
        },
      },
    };

    const result = await verifyReceiptFromResponse(mockVerifier, extensions, {
      expectedSigner: "0xdifferent",
    });
    expect(result).toBeNull();
  });
});
