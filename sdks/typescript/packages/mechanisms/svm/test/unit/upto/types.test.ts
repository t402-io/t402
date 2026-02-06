import { describe, it, expect } from "vitest";
import type {
  UptoSvmPayload,
  UptoSvmAuthorization,
  UptoSvmExtra,
} from "../../../src/upto/types";
import { isUptoSvmPayload } from "../../../src/upto/types";

// Sample valid Solana addresses (base58)
const SAMPLE_OWNER = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
const SAMPLE_DELEGATE = "8GGtWHRQ1wz5gDKE2KXZLktqzcfV1CBqSbeUZjA7hoWL";
const SAMPLE_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SAMPLE_ATA = "FEeSRuEDk8ENZbpzXjn4DLBMbCjPo2EfQQsMCAfmxZGu";
const SAMPLE_TX_BASE64 = "AQAAAA" + "A".repeat(200) + "==";

describe("Upto SVM Types", () => {
  describe("UptoSvmAuthorization", () => {
    it("should accept valid authorization structure", () => {
      const auth: UptoSvmAuthorization = {
        owner: SAMPLE_OWNER,
        delegate: SAMPLE_DELEGATE,
        mint: SAMPLE_MINT,
        maxAmount: "1000000",
        sourceATA: SAMPLE_ATA,
      };

      expect(auth.owner).toBe(SAMPLE_OWNER);
      expect(auth.delegate).toBe(SAMPLE_DELEGATE);
      expect(auth.mint).toBe(SAMPLE_MINT);
      expect(auth.maxAmount).toBe("1000000");
      expect(auth.sourceATA).toBe(SAMPLE_ATA);
    });
  });

  describe("UptoSvmPayload", () => {
    it("should accept valid payload structure", () => {
      const payload: UptoSvmPayload = {
        transaction: SAMPLE_TX_BASE64,
        authorization: {
          owner: SAMPLE_OWNER,
          delegate: SAMPLE_DELEGATE,
          mint: SAMPLE_MINT,
          maxAmount: "1000000",
          sourceATA: SAMPLE_ATA,
        },
        paymentNonce: "a1b2c3d4e5f6",
      };

      expect(payload.transaction).toBe(SAMPLE_TX_BASE64);
      expect(payload.authorization.owner).toBe(SAMPLE_OWNER);
      expect(payload.authorization.delegate).toBe(SAMPLE_DELEGATE);
      expect(payload.paymentNonce).toBe("a1b2c3d4e5f6");
    });

    it("should accept long base64 transaction strings", () => {
      const longTransaction = "A".repeat(1000) + "==";
      const payload: UptoSvmPayload = {
        transaction: longTransaction,
        authorization: {
          owner: SAMPLE_OWNER,
          delegate: SAMPLE_DELEGATE,
          mint: SAMPLE_MINT,
          maxAmount: "5000000",
          sourceATA: SAMPLE_ATA,
        },
        paymentNonce: "deadbeef",
      };

      expect(payload.transaction).toBe(longTransaction);
      expect(payload.transaction.length).toBe(1002);
    });
  });

  describe("UptoSvmExtra", () => {
    it("should accept full extra fields", () => {
      const extra: UptoSvmExtra = {
        feePayer: SAMPLE_DELEGATE,
        maxAmount: "10000000",
        minAmount: "100000",
        unit: "token",
        unitPrice: "100",
      };

      expect(extra.feePayer).toBe(SAMPLE_DELEGATE);
      expect(extra.maxAmount).toBe("10000000");
      expect(extra.minAmount).toBe("100000");
      expect(extra.unit).toBe("token");
      expect(extra.unitPrice).toBe("100");
    });

    it("should accept empty extra (all optional fields)", () => {
      const extra: UptoSvmExtra = {};

      expect(extra.feePayer).toBeUndefined();
      expect(extra.maxAmount).toBeUndefined();
      expect(extra.minAmount).toBeUndefined();
      expect(extra.unit).toBeUndefined();
      expect(extra.unitPrice).toBeUndefined();
    });

    it("should accept partial extra fields", () => {
      const extra: UptoSvmExtra = {
        feePayer: SAMPLE_DELEGATE,
        unit: "request",
      };

      expect(extra.feePayer).toBe(SAMPLE_DELEGATE);
      expect(extra.unit).toBe("request");
      expect(extra.maxAmount).toBeUndefined();
    });
  });

  describe("isUptoSvmPayload", () => {
    it("should return true for valid UptoSvmPayload", () => {
      const payload = {
        transaction: SAMPLE_TX_BASE64,
        authorization: {
          owner: SAMPLE_OWNER,
          delegate: SAMPLE_DELEGATE,
          mint: SAMPLE_MINT,
          maxAmount: "1000000",
          sourceATA: SAMPLE_ATA,
        },
        paymentNonce: "a1b2c3d4e5f6",
      };

      expect(isUptoSvmPayload(payload)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isUptoSvmPayload(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isUptoSvmPayload(undefined)).toBe(false);
    });

    it("should return false for non-object types", () => {
      expect(isUptoSvmPayload("string")).toBe(false);
      expect(isUptoSvmPayload(42)).toBe(false);
      expect(isUptoSvmPayload(true)).toBe(false);
    });

    it("should return false for empty object", () => {
      expect(isUptoSvmPayload({})).toBe(false);
    });

    it("should return false when transaction is missing", () => {
      const payload = {
        authorization: {
          owner: SAMPLE_OWNER,
          delegate: SAMPLE_DELEGATE,
          mint: SAMPLE_MINT,
          maxAmount: "1000000",
          sourceATA: SAMPLE_ATA,
        },
        paymentNonce: "a1b2c3d4e5f6",
      };

      expect(isUptoSvmPayload(payload)).toBe(false);
    });

    it("should return false when paymentNonce is missing", () => {
      const payload = {
        transaction: SAMPLE_TX_BASE64,
        authorization: {
          owner: SAMPLE_OWNER,
          delegate: SAMPLE_DELEGATE,
          mint: SAMPLE_MINT,
          maxAmount: "1000000",
          sourceATA: SAMPLE_ATA,
        },
      };

      expect(isUptoSvmPayload(payload)).toBe(false);
    });

    it("should return false when authorization is missing", () => {
      const payload = {
        transaction: SAMPLE_TX_BASE64,
        paymentNonce: "a1b2c3d4e5f6",
      };

      expect(isUptoSvmPayload(payload)).toBe(false);
    });

    it("should return false when authorization is not an object", () => {
      const payload = {
        transaction: SAMPLE_TX_BASE64,
        authorization: "not-an-object",
        paymentNonce: "a1b2c3d4e5f6",
      };

      expect(isUptoSvmPayload(payload)).toBe(false);
    });

    it("should return false when authorization fields are missing", () => {
      const payload = {
        transaction: SAMPLE_TX_BASE64,
        authorization: {
          owner: SAMPLE_OWNER,
          // missing delegate, mint, maxAmount, sourceATA
        },
        paymentNonce: "a1b2c3d4e5f6",
      };

      expect(isUptoSvmPayload(payload)).toBe(false);
    });

    it("should return false when authorization fields are wrong types", () => {
      const payload = {
        transaction: SAMPLE_TX_BASE64,
        authorization: {
          owner: SAMPLE_OWNER,
          delegate: SAMPLE_DELEGATE,
          mint: SAMPLE_MINT,
          maxAmount: 1000000, // number instead of string
          sourceATA: SAMPLE_ATA,
        },
        paymentNonce: "a1b2c3d4e5f6",
      };

      expect(isUptoSvmPayload(payload)).toBe(false);
    });

    it("should return false for exact SVM payload (no authorization.delegate)", () => {
      const exactPayload = {
        transaction: SAMPLE_TX_BASE64,
      };

      expect(isUptoSvmPayload(exactPayload)).toBe(false);
    });

    it("should return true even with extra fields present", () => {
      const payload = {
        transaction: SAMPLE_TX_BASE64,
        authorization: {
          owner: SAMPLE_OWNER,
          delegate: SAMPLE_DELEGATE,
          mint: SAMPLE_MINT,
          maxAmount: "1000000",
          sourceATA: SAMPLE_ATA,
          extraField: "should be ignored",
        },
        paymentNonce: "a1b2c3d4e5f6",
        anotherExtra: "also ignored",
      };

      expect(isUptoSvmPayload(payload)).toBe(true);
    });
  });
});
