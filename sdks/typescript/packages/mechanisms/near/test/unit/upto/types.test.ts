import { describe, it, expect } from "vitest";
import {
  UptoNearAuthorization,
  UptoNearPayload,
  UptoNearExtra,
  UptoNearSettlement,
  isUptoNearPayload,
} from "../../../src/upto/types";

describe("Upto NEAR Types", () => {
  describe("UptoNearAuthorization", () => {
    it("should have correct structure", () => {
      const authorization: UptoNearAuthorization = {
        from: "alice.near",
        facilitator: "facilitator.near",
        tokenContract: "usdt.tether-token.near",
        maxAmount: "1000000",
      };

      expect(authorization.from).toBe("alice.near");
      expect(authorization.facilitator).toBe("facilitator.near");
      expect(authorization.tokenContract).toBe("usdt.tether-token.near");
      expect(authorization.maxAmount).toBe("1000000");
    });
  });

  describe("UptoNearPayload", () => {
    it("should have correct structure", () => {
      const payload: UptoNearPayload = {
        txHash: "9FbNk5XzYTa1BRuesGjCZ5uWY8TV9KFesh3PFjDEB4jQ",
        authorization: {
          from: "alice.near",
          facilitator: "facilitator.near",
          tokenContract: "usdt.tether-token.near",
          maxAmount: "1000000",
        },
        paymentNonce: "0xf3746613c2d920b5fdabc0856f2aeb2d4f88ee6037b8cc5d04a71a4462f13480",
      };

      expect(payload.txHash).toBe("9FbNk5XzYTa1BRuesGjCZ5uWY8TV9KFesh3PFjDEB4jQ");
      expect(payload.authorization.from).toBe("alice.near");
      expect(payload.authorization.facilitator).toBe("facilitator.near");
      expect(payload.authorization.tokenContract).toBe("usdt.tether-token.near");
      expect(payload.authorization.maxAmount).toBe("1000000");
      expect(payload.paymentNonce).toMatch(/^0x[0-9a-f]{64}$/);
    });
  });

  describe("UptoNearExtra", () => {
    it("should have correct structure with all fields", () => {
      const extra: UptoNearExtra = {
        facilitator: "facilitator.near",
        maxAmount: "1000000",
        minAmount: "10000",
        unit: "token",
        unitPrice: "100",
      };

      expect(extra.facilitator).toBe("facilitator.near");
      expect(extra.maxAmount).toBe("1000000");
      expect(extra.minAmount).toBe("10000");
      expect(extra.unit).toBe("token");
      expect(extra.unitPrice).toBe("100");
    });

    it("should work with minimal fields", () => {
      const extra: UptoNearExtra = {};

      expect(extra.facilitator).toBeUndefined();
      expect(extra.maxAmount).toBeUndefined();
      expect(extra.minAmount).toBeUndefined();
      expect(extra.unit).toBeUndefined();
      expect(extra.unitPrice).toBeUndefined();
    });

    it("should work with only facilitator", () => {
      const extra: UptoNearExtra = {
        facilitator: "facilitator.near",
      };

      expect(extra.facilitator).toBe("facilitator.near");
      expect(extra.unit).toBeUndefined();
    });
  });

  describe("UptoNearSettlement", () => {
    it("should contain settle amount", () => {
      const settlement: UptoNearSettlement = {
        settleAmount: "150000",
      };

      expect(settlement.settleAmount).toBe("150000");
    });

    it("should support usage details", () => {
      const settlement: UptoNearSettlement = {
        settleAmount: "150000",
        usageDetails: {
          unitsConsumed: 1500,
          unitPrice: "100",
          unitType: "token",
          startTime: 1740672000,
          endTime: 1740675600,
        },
      };

      expect(settlement.settleAmount).toBe("150000");
      expect(settlement.usageDetails?.unitsConsumed).toBe(1500);
      expect(settlement.usageDetails?.unitPrice).toBe("100");
      expect(settlement.usageDetails?.unitType).toBe("token");
    });
  });

  describe("isUptoNearPayload", () => {
    it("should return true for valid payload", () => {
      const payload = {
        txHash: "9FbNk5XzYTa1BRuesGjCZ5uWY8TV9KFesh3PFjDEB4jQ",
        authorization: {
          from: "alice.near",
          facilitator: "facilitator.near",
          tokenContract: "usdt.tether-token.near",
          maxAmount: "1000000",
        },
        paymentNonce: "0xabc123",
      };

      expect(isUptoNearPayload(payload)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isUptoNearPayload(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isUptoNearPayload(undefined)).toBe(false);
    });

    it("should return false for empty object", () => {
      expect(isUptoNearPayload({})).toBe(false);
    });

    it("should return false for missing txHash", () => {
      const payload = {
        authorization: {
          from: "alice.near",
          facilitator: "facilitator.near",
          tokenContract: "usdt.tether-token.near",
          maxAmount: "1000000",
        },
        paymentNonce: "0xabc",
      };

      expect(isUptoNearPayload(payload)).toBe(false);
    });

    it("should return false for missing paymentNonce", () => {
      const payload = {
        txHash: "9FbNk5XzYTa1BRuesGjCZ5uWY8TV9KFesh3PFjDEB4jQ",
        authorization: {
          from: "alice.near",
          facilitator: "facilitator.near",
          tokenContract: "usdt.tether-token.near",
          maxAmount: "1000000",
        },
      };

      expect(isUptoNearPayload(payload)).toBe(false);
    });

    it("should return false for missing authorization", () => {
      const payload = {
        txHash: "9FbNk5XzYTa1BRuesGjCZ5uWY8TV9KFesh3PFjDEB4jQ",
        paymentNonce: "0xabc",
      };

      expect(isUptoNearPayload(payload)).toBe(false);
    });

    it("should return false for incomplete authorization", () => {
      const payload = {
        txHash: "9FbNk5XzYTa1BRuesGjCZ5uWY8TV9KFesh3PFjDEB4jQ",
        authorization: {
          from: "alice.near",
          // missing facilitator, tokenContract, maxAmount
        },
        paymentNonce: "0xabc",
      };

      expect(isUptoNearPayload(payload)).toBe(false);
    });

    it("should return false for exact-direct payload", () => {
      const exactDirectPayload = {
        txHash: "9FbNk5XzYTa1BRuesGjCZ5uWY8TV9KFesh3PFjDEB4jQ",
        from: "alice.near",
        to: "merchant.near",
        amount: "1000000",
      };

      expect(isUptoNearPayload(exactDirectPayload)).toBe(false);
    });

    it("should return false for non-string txHash", () => {
      const payload = {
        txHash: 12345,
        authorization: {
          from: "alice.near",
          facilitator: "facilitator.near",
          tokenContract: "usdt.tether-token.near",
          maxAmount: "1000000",
        },
        paymentNonce: "0xabc",
      };

      expect(isUptoNearPayload(payload)).toBe(false);
    });

    it("should return false for empty from in authorization", () => {
      const payload = {
        txHash: "9FbNk5XzYTa1BRuesGjCZ5uWY8TV9KFesh3PFjDEB4jQ",
        authorization: {
          from: "",
          facilitator: "facilitator.near",
          tokenContract: "usdt.tether-token.near",
          maxAmount: "1000000",
        },
        paymentNonce: "0xabc",
      };

      expect(isUptoNearPayload(payload)).toBe(false);
    });
  });
});
