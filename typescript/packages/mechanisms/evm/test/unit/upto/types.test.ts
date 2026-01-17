import { describe, it, expect } from "vitest";
import {
  UptoEIP2612Payload,
  UptoEvmExtra,
  UptoEvmSettlement,
  PermitSignature,
  PermitAuthorization,
  permitTypes,
  isUptoEIP2612Payload,
} from "../../../src/types";

describe("Upto EVM Types", () => {
  describe("PermitSignature", () => {
    it("should have correct structure", () => {
      const signature: PermitSignature = {
        v: 27,
        r: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        s: "0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
      };

      expect(signature.v).toBe(27);
      expect(signature.r).toMatch(/^0x[0-9a-f]{64}$/);
      expect(signature.s).toMatch(/^0x[0-9a-f]{64}$/);
    });
  });

  describe("PermitAuthorization", () => {
    it("should have correct structure", () => {
      const authorization: PermitAuthorization = {
        owner: "0x1234567890123456789012345678901234567890",
        spender: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        value: "1000000",
        deadline: "1740675689",
        nonce: 5,
      };

      expect(authorization.owner).toMatch(/^0x[0-9a-f]{40}$/i);
      expect(authorization.spender).toMatch(/^0x[0-9a-f]{40}$/i);
      expect(authorization.value).toBe("1000000");
      expect(authorization.deadline).toBe("1740675689");
      expect(authorization.nonce).toBe(5);
    });
  });

  describe("UptoEIP2612Payload", () => {
    it("should have correct structure", () => {
      const payload: UptoEIP2612Payload = {
        signature: {
          v: 28,
          r: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
          s: "0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
        },
        authorization: {
          owner: "0x1234567890123456789012345678901234567890",
          spender: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
          value: "1000000",
          deadline: "1740675689",
          nonce: 0,
        },
        paymentNonce: "0xf3746613c2d920b5fdabc0856f2aeb2d4f88ee6037b8cc5d04a71a4462f13480",
      };

      expect(payload.signature).toBeDefined();
      expect(payload.authorization).toBeDefined();
      expect(payload.paymentNonce).toMatch(/^0x[0-9a-f]{64}$/);
    });
  });

  describe("UptoEvmExtra", () => {
    it("should have EIP-712 domain parameters", () => {
      const extra: UptoEvmExtra = {
        name: "USD Coin",
        version: "2",
        routerAddress: "0x1234567890123456789012345678901234567890",
        unit: "token",
        unitPrice: "100",
      };

      expect(extra.name).toBe("USD Coin");
      expect(extra.version).toBe("2");
      expect(extra.routerAddress).toMatch(/^0x[0-9a-f]{40}$/i);
      expect(extra.unit).toBe("token");
      expect(extra.unitPrice).toBe("100");
    });

    it("should work with minimal required fields", () => {
      const extra: UptoEvmExtra = {
        name: "USDC",
        version: "1",
      };

      expect(extra.name).toBe("USDC");
      expect(extra.version).toBe("1");
      expect(extra.routerAddress).toBeUndefined();
    });
  });

  describe("UptoEvmSettlement", () => {
    it("should contain settle amount", () => {
      const settlement: UptoEvmSettlement = {
        settleAmount: "150000",
      };

      expect(settlement.settleAmount).toBe("150000");
    });

    it("should support usage details", () => {
      const settlement: UptoEvmSettlement = {
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

  describe("permitTypes", () => {
    it("should have correct EIP-712 structure", () => {
      expect(permitTypes.Permit).toBeDefined();
      expect(permitTypes.Permit).toHaveLength(5);

      const fieldNames = permitTypes.Permit.map((f) => f.name);
      expect(fieldNames).toContain("owner");
      expect(fieldNames).toContain("spender");
      expect(fieldNames).toContain("value");
      expect(fieldNames).toContain("nonce");
      expect(fieldNames).toContain("deadline");
    });
  });

  describe("isUptoEIP2612Payload", () => {
    it("should return true for valid payload", () => {
      const payload = {
        signature: { v: 28, r: "0x123", s: "0x456" },
        authorization: {
          owner: "0x123",
          spender: "0x456",
          value: "1000",
          deadline: "123456",
          nonce: 0,
        },
        paymentNonce: "0xabc",
      };

      expect(isUptoEIP2612Payload(payload)).toBe(true);
    });

    it("should return false for invalid payload", () => {
      expect(isUptoEIP2612Payload(null)).toBe(false);
      expect(isUptoEIP2612Payload(undefined)).toBe(false);
      expect(isUptoEIP2612Payload({})).toBe(false);
      expect(isUptoEIP2612Payload({ signature: "0x123" })).toBe(false);
      expect(isUptoEIP2612Payload({
        signature: { v: 28 },
        authorization: {},
      })).toBe(false);
    });

    it("should return false for exact scheme payload", () => {
      const exactPayload = {
        signature: "0x123",
        authorization: {
          from: "0x123",
          to: "0x456",
          value: "1000",
          validAfter: "0",
          validBefore: "999999",
          nonce: "0xabc",
        },
      };

      expect(isUptoEIP2612Payload(exactPayload)).toBe(false);
    });
  });
});
