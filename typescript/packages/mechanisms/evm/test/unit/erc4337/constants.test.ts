import { describe, it, expect } from "vitest";
import {
  ENTRYPOINT_V07_ADDRESS,
  ENTRYPOINT_V06_ADDRESS,
  DEFAULT_GAS_LIMITS,
  BUNDLER_METHODS,
  PaymasterType,
  packAccountGasLimits,
  unpackAccountGasLimits,
  packGasFees,
  unpackGasFees,
} from "../../../src/erc4337/constants";

describe("ERC-4337 Constants", () => {
  describe("EntryPoint addresses", () => {
    it("should have correct v0.7 EntryPoint address", () => {
      expect(ENTRYPOINT_V07_ADDRESS).toBe(
        "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
      );
    });

    it("should have correct v0.6 EntryPoint address", () => {
      expect(ENTRYPOINT_V06_ADDRESS).toBe(
        "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
      );
    });
  });

  describe("DEFAULT_GAS_LIMITS", () => {
    it("should have reasonable default gas limits", () => {
      expect(DEFAULT_GAS_LIMITS.verificationGasLimit).toBe(150000n);
      expect(DEFAULT_GAS_LIMITS.callGasLimit).toBe(100000n);
      expect(DEFAULT_GAS_LIMITS.preVerificationGas).toBe(50000n);
      expect(DEFAULT_GAS_LIMITS.paymasterVerificationGasLimit).toBe(50000n);
      expect(DEFAULT_GAS_LIMITS.paymasterPostOpGasLimit).toBe(50000n);
    });
  });

  describe("BUNDLER_METHODS", () => {
    it("should have all required bundler methods", () => {
      expect(BUNDLER_METHODS.sendUserOperation).toBe("eth_sendUserOperation");
      expect(BUNDLER_METHODS.estimateUserOperationGas).toBe(
        "eth_estimateUserOperationGas",
      );
      expect(BUNDLER_METHODS.getUserOperationByHash).toBe(
        "eth_getUserOperationByHash",
      );
      expect(BUNDLER_METHODS.getUserOperationReceipt).toBe(
        "eth_getUserOperationReceipt",
      );
      expect(BUNDLER_METHODS.supportedEntryPoints).toBe("eth_supportedEntryPoints");
      expect(BUNDLER_METHODS.chainId).toBe("eth_chainId");
    });
  });

  describe("PaymasterType", () => {
    it("should have all paymaster types", () => {
      expect(PaymasterType.None).toBe("none");
      expect(PaymasterType.Verifying).toBe("verifying");
      expect(PaymasterType.Token).toBe("token");
      expect(PaymasterType.Sponsoring).toBe("sponsoring");
    });
  });

  describe("packAccountGasLimits", () => {
    it("should pack verification and call gas limits", () => {
      const packed = packAccountGasLimits(150000n, 100000n);

      // Should be 64 hex chars + 0x prefix
      expect(packed).toHaveLength(66);
      expect(packed).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it("should pack zero values correctly", () => {
      const packed = packAccountGasLimits(0n, 0n);
      expect(packed).toBe(
        "0x" + "0".repeat(64),
      );
    });

    it("should pack max values correctly", () => {
      const maxUint128 = (1n << 128n) - 1n;
      const packed = packAccountGasLimits(maxUint128, maxUint128);
      expect(packed).toBe("0x" + "f".repeat(64));
    });
  });

  describe("unpackAccountGasLimits", () => {
    it("should unpack to original values", () => {
      const verification = 150000n;
      const call = 100000n;

      const packed = packAccountGasLimits(verification, call);
      const unpacked = unpackAccountGasLimits(packed);

      expect(unpacked.verificationGasLimit).toBe(verification);
      expect(unpacked.callGasLimit).toBe(call);
    });

    it("should handle large values", () => {
      const verification = 1000000000000n;
      const call = 500000000000n;

      const packed = packAccountGasLimits(verification, call);
      const unpacked = unpackAccountGasLimits(packed);

      expect(unpacked.verificationGasLimit).toBe(verification);
      expect(unpacked.callGasLimit).toBe(call);
    });
  });

  describe("packGasFees", () => {
    it("should pack priority fee and max fee", () => {
      const packed = packGasFees(1500000000n, 30000000000n);

      expect(packed).toHaveLength(66);
      expect(packed).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it("should be inverse of unpackGasFees", () => {
      const priority = 1500000000n;
      const maxFee = 30000000000n;

      const packed = packGasFees(priority, maxFee);
      const unpacked = unpackGasFees(packed);

      expect(unpacked.maxPriorityFeePerGas).toBe(priority);
      expect(unpacked.maxFeePerGas).toBe(maxFee);
    });
  });

  describe("unpackGasFees", () => {
    it("should unpack to original values", () => {
      const priority = 2000000000n;
      const maxFee = 50000000000n;

      const packed = packGasFees(priority, maxFee);
      const unpacked = unpackGasFees(packed);

      expect(unpacked.maxPriorityFeePerGas).toBe(priority);
      expect(unpacked.maxFeePerGas).toBe(maxFee);
    });
  });
});
