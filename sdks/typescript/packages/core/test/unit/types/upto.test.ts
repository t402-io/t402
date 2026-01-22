import { describe, it, expect } from "vitest";
import {
  UptoPaymentRequirements,
  UptoExtra,
  UptoSettlement,
  UptoUsageDetails,
  UptoSettlementResponse,
  UptoValidationResult,
  isUptoPaymentRequirements,
  UPTO_SCHEME,
  UPTO_DEFAULTS,
} from "../../../src/types/schemes/upto";
import type { PaymentRequirements } from "../../../src/types";

describe("Upto Core Types", () => {
  describe("UptoPaymentRequirements", () => {
    it("should have upto scheme", () => {
      const requirements: UptoPaymentRequirements = {
        scheme: "upto",
        network: "eip155:8453",
        maxAmount: "1000000",
        minAmount: "10000",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        payTo: "0x1234567890123456789012345678901234567890",
        maxTimeoutSeconds: 300,
        extra: {
          unit: "token",
          unitPrice: "100",
        },
      };

      expect(requirements.scheme).toBe("upto");
      expect(requirements.maxAmount).toBe("1000000");
      expect(requirements.minAmount).toBe("10000");
    });

    it("should work without optional minAmount", () => {
      const requirements: UptoPaymentRequirements = {
        scheme: "upto",
        network: "eip155:8453",
        maxAmount: "1000000",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        payTo: "0x1234567890123456789012345678901234567890",
        maxTimeoutSeconds: 300,
        extra: {},
      };

      expect(requirements.scheme).toBe("upto");
      expect(requirements.minAmount).toBeUndefined();
    });
  });

  describe("UptoExtra", () => {
    it("should support billing unit configuration", () => {
      const extra: UptoExtra = {
        unit: "token",
        unitPrice: "100",
        name: "USD Coin",
        version: "2",
        routerAddress: "0x1234567890123456789012345678901234567890",
      };

      expect(extra.unit).toBe("token");
      expect(extra.unitPrice).toBe("100");
      expect(extra.name).toBe("USD Coin");
      expect(extra.version).toBe("2");
    });
  });

  describe("UptoSettlement", () => {
    it("should contain settle amount", () => {
      const settlement: UptoSettlement = {
        settleAmount: "150000",
      };

      expect(settlement.settleAmount).toBe("150000");
    });

    it("should support usage details", () => {
      const settlement: UptoSettlement = {
        settleAmount: "150000",
        usageDetails: {
          unitsConsumed: 1500,
          unitPrice: "100",
          unitType: "token",
        },
      };

      expect(settlement.usageDetails?.unitsConsumed).toBe(1500);
    });
  });

  describe("UptoUsageDetails", () => {
    it("should track usage metrics", () => {
      const usage: UptoUsageDetails = {
        unitsConsumed: 1500,
        unitPrice: "100",
        unitType: "token",
        startTime: 1740672000,
        endTime: 1740675600,
        metadata: {
          model: "gpt-4",
          promptTokens: 100,
          completionTokens: 1400,
        },
      };

      expect(usage.unitsConsumed).toBe(1500);
      expect(usage.startTime).toBe(1740672000);
      expect(usage.endTime).toBe(1740675600);
      expect(usage.metadata?.model).toBe("gpt-4");
    });
  });

  describe("UptoSettlementResponse", () => {
    it("should report successful settlement", () => {
      const response: UptoSettlementResponse = {
        success: true,
        transactionHash: "0xabc123",
        settledAmount: "150000",
        maxAmount: "1000000",
        blockNumber: 12345678,
        gasUsed: "85000",
      };

      expect(response.success).toBe(true);
      expect(response.settledAmount).toBe("150000");
      expect(response.maxAmount).toBe("1000000");
    });

    it("should report failed settlement", () => {
      const response: UptoSettlementResponse = {
        success: false,
        settledAmount: "0",
        maxAmount: "1000000",
        error: "Insufficient balance",
      };

      expect(response.success).toBe(false);
      expect(response.error).toBe("Insufficient balance");
    });
  });

  describe("UptoValidationResult", () => {
    it("should indicate valid payment", () => {
      const result: UptoValidationResult = {
        isValid: true,
        validatedMaxAmount: "1000000",
        payer: "0x1234567890123456789012345678901234567890",
        expiresAt: 1740675600,
      };

      expect(result.isValid).toBe(true);
      expect(result.validatedMaxAmount).toBe("1000000");
    });

    it("should indicate invalid payment with reason", () => {
      const result: UptoValidationResult = {
        isValid: false,
        invalidReason: "Permit signature is invalid",
      };

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("Permit signature is invalid");
    });
  });

  describe("isUptoPaymentRequirements", () => {
    it("should return true for upto requirements", () => {
      const requirements = {
        scheme: "upto",
        network: "eip155:8453",
        maxAmount: "1000000",
        asset: "0x123",
        payTo: "0x456",
        maxTimeoutSeconds: 300,
        extra: {},
      } as PaymentRequirements & { maxAmount: string };

      expect(isUptoPaymentRequirements(requirements as PaymentRequirements)).toBe(true);
    });

    it("should return false for exact requirements", () => {
      const requirements: PaymentRequirements = {
        scheme: "exact",
        network: "eip155:8453",
        amount: "1000000",
        asset: "0x123",
        payTo: "0x456",
        maxTimeoutSeconds: 300,
        extra: {},
      };

      expect(isUptoPaymentRequirements(requirements)).toBe(false);
    });
  });

  describe("Constants", () => {
    it("should have correct UPTO_SCHEME", () => {
      expect(UPTO_SCHEME).toBe("upto");
    });

    it("should have correct UPTO_DEFAULTS", () => {
      expect(UPTO_DEFAULTS.MIN_AMOUNT).toBe("1000");
      expect(UPTO_DEFAULTS.MAX_TIMEOUT_SECONDS).toBe(300);
      expect(UPTO_DEFAULTS.UNITS).toContain("token");
      expect(UPTO_DEFAULTS.UNITS).toContain("request");
      expect(UPTO_DEFAULTS.UNITS).toContain("second");
    });
  });
});
