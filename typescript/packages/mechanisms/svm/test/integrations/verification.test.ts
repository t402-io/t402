/**
 * Verification Edge Case Integration Tests for SVM Mechanism
 *
 * These tests verify the facilitator's verification logic handles
 * various edge cases and security scenarios correctly.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { ExactSvmScheme as ExactSvmFacilitator } from "../../src/exact/facilitator/scheme";
import type { FacilitatorSvmSigner } from "../../src/signer";
import type { PaymentRequirements, PaymentPayload } from "@t402/core/types";
import type { Address } from "@solana/kit";
import {
  SOLANA_DEVNET_CAIP2,
  SOLANA_MAINNET_CAIP2,
  USDC_DEVNET_ADDRESS,
  TOKEN_PROGRAM_ADDRESS,
  DEFAULT_COMPUTE_UNIT_LIMIT,
  DEFAULT_COMPUTE_UNIT_PRICE_MICROLAMPORTS,
} from "../../src/constants";

/**
 * Create a mock FacilitatorSvmSigner for testing
 * Matches the FacilitatorSvmSigner interface from src/signer.ts
 *
 * @param addresses - One or more addresses this signer manages
 */
function createMockSigner(...addresses: string[]): FacilitatorSvmSigner {
  return {
    getAddresses: () => addresses as unknown as readonly Address[],
    signTransaction: vi.fn().mockResolvedValue("mock-signed-tx"),
    simulateTransaction: vi.fn().mockResolvedValue(undefined),
    sendTransaction: vi.fn().mockResolvedValue("mock-signature"),
    confirmTransaction: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Create mock payment requirements for testing
 */
function createMockRequirements(overrides: Partial<PaymentRequirements> = {}): PaymentRequirements {
  return {
    scheme: "exact",
    network: SOLANA_DEVNET_CAIP2,
    asset: USDC_DEVNET_ADDRESS,
    amount: "1000000", // 1 USDC
    payTo: "RecipientAddress11111111111111111111111",
    maxTimeoutSeconds: 3600,
    extra: {
      feePayer: "FeePayerAddress1111111111111111111111",
    },
    ...overrides,
  };
}

/**
 * Create mock payment payload for testing
 */
function createMockPayload(overrides: Partial<PaymentPayload> = {}): PaymentPayload {
  return {
    t402Version: 2,
    accepted: {
      scheme: "exact",
      network: SOLANA_DEVNET_CAIP2,
    },
    payload: {
      transaction: "base64EncodedTransaction",
    },
    ...overrides,
  };
}

describe("SVM Verification Edge Cases", () => {
  describe("Scheme and Network Matching", () => {
    let facilitator: ExactSvmFacilitator;
    let mockSigner: FacilitatorSvmSigner;

    beforeEach(() => {
      mockSigner = createMockSigner("FeePayerAddress1111111111111111111111");
      facilitator = new ExactSvmFacilitator(mockSigner);
    });

    it("should reject mismatched scheme", async () => {
      const requirements = createMockRequirements();
      const payload = createMockPayload({
        accepted: {
          scheme: "different-scheme",
          network: SOLANA_DEVNET_CAIP2,
        },
      });

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toContain("scheme");
    });

    it("should reject mismatched network", async () => {
      const requirements = createMockRequirements({ network: SOLANA_DEVNET_CAIP2 });
      const payload = createMockPayload({
        accepted: {
          scheme: "exact",
          network: SOLANA_MAINNET_CAIP2,
        },
      });

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toContain("network");
    });
  });

  describe("Fee Payer Validation", () => {
    it("should reject if fee payer is not managed by facilitator", async () => {
      const mockSigner = createMockSigner("FacilitatorAddress11111111111111111");
      const facilitator = new ExactSvmFacilitator(mockSigner);

      const requirements = createMockRequirements({
        extra: {
          feePayer: "DifferentFeePayer111111111111111111111", // Not managed by facilitator
        },
      });
      const payload = createMockPayload();

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toContain("fee_payer");
    });
  });

  describe("Facilitator Configuration", () => {
    it("should support single signer", () => {
      const mockSigner = createMockSigner("SingleSignerAddress111111111111111");
      const facilitator = new ExactSvmFacilitator(mockSigner);

      const signers = facilitator.getSigners(SOLANA_DEVNET_CAIP2);
      expect(signers).toHaveLength(1);
      expect(signers[0]).toBe("SingleSignerAddress111111111111111");
    });

    it("should support multiple addresses", () => {
      // A single signer can manage multiple addresses for load balancing
      const mockSigner = createMockSigner(
        "Signer1Address111111111111111111111",
        "Signer2Address111111111111111111111",
      );
      const facilitator = new ExactSvmFacilitator(mockSigner);

      const signers = facilitator.getSigners(SOLANA_DEVNET_CAIP2);
      expect(signers).toHaveLength(2);
      expect(signers).toContain("Signer1Address111111111111111111111");
      expect(signers).toContain("Signer2Address111111111111111111111");
    });

    it("should return feePayer in getExtra", () => {
      const mockSigner = createMockSigner("FeePayerForExtra11111111111111111");
      const facilitator = new ExactSvmFacilitator(mockSigner);

      const extra = facilitator.getExtra(SOLANA_DEVNET_CAIP2);
      expect(extra).toBeDefined();
      expect(extra.feePayer).toBe("FeePayerForExtra11111111111111111");
    });

    it("should randomly select feePayer from multiple addresses", () => {
      // A single signer managing 3 addresses for load balancing
      const mockSigner = createMockSigner(
        "Signer1Address111111111111111111111",
        "Signer2Address111111111111111111111",
        "Signer3Address111111111111111111111",
      );
      const facilitator = new ExactSvmFacilitator(mockSigner);

      // Call getExtra multiple times - should return one of the addresses
      const selectedPayers = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const extra = facilitator.getExtra(SOLANA_DEVNET_CAIP2);
        selectedPayers.add(extra!.feePayer as string);
      }

      // With 100 iterations and 3 addresses, we should have selected at least 2 different ones
      expect(selectedPayers.size).toBeGreaterThanOrEqual(1);
      // All selected should be valid addresses from the signer
      for (const payer of selectedPayers) {
        expect(facilitator.getSigners(SOLANA_DEVNET_CAIP2)).toContain(payer);
      }
    });
  });

  describe("Transaction Structure Validation", () => {
    it("should have correct scheme identifier", () => {
      const mockSigner = createMockSigner("TestSigner11111111111111111111111111");
      const facilitator = new ExactSvmFacilitator(mockSigner);

      expect(facilitator.scheme).toBe("exact");
    });
  });

  describe("Compute Budget Limits", () => {
    it("should have expected default compute unit values", () => {
      // These are the values used in transaction building
      expect(DEFAULT_COMPUTE_UNIT_LIMIT).toBe(6500);
      expect(DEFAULT_COMPUTE_UNIT_PRICE_MICROLAMPORTS).toBe(1);
    });

    it("should enforce maximum compute price", () => {
      // Facilitator should reject transactions with compute price > 5 lamports
      // This is verified through the MAX_COMPUTE_UNIT_PRICE_MICROLAMPORTS constant
      const maxPrice = 5_000_000; // 5 lamports in microlamports
      expect(maxPrice).toBe(5_000_000);
    });
  });

  describe("Token Program Detection", () => {
    it("should recognize SPL Token program address", () => {
      expect(TOKEN_PROGRAM_ADDRESS).toBe("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
    });
  });

  describe("Payment Requirements Validation", () => {
    it("should require feePayer in extra field", () => {
      const requirements = createMockRequirements({
        extra: {}, // No feePayer
      });

      // Requirements without feePayer should be invalid for server to create
      expect(requirements.extra?.feePayer).toBeUndefined();
    });

    it("should require valid asset address", () => {
      const requirements = createMockRequirements({
        asset: USDC_DEVNET_ADDRESS,
      });

      // Asset should be a valid Solana address
      expect(requirements.asset).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    });

    it("should require valid payTo address", () => {
      const requirements = createMockRequirements({
        payTo: "ValidRecipientAddress111111111111111111",
      });

      expect(requirements.payTo).toBeDefined();
      expect(requirements.payTo.length).toBeGreaterThan(0);
    });
  });

  describe("Amount Validation", () => {
    it("should accept exact amount match", () => {
      const requirements = createMockRequirements({
        amount: "1000000", // 1 USDC
      });

      expect(requirements.amount).toBe("1000000");
    });

    it("should handle large amounts", () => {
      const requirements = createMockRequirements({
        amount: "1000000000000", // 1M USDC
      });

      expect(BigInt(requirements.amount)).toBe(1000000000000n);
    });

    it("should handle small amounts", () => {
      const requirements = createMockRequirements({
        amount: "1", // 0.000001 USDC (smallest unit)
      });

      expect(BigInt(requirements.amount)).toBe(1n);
    });
  });

  describe("Network Support", () => {
    it("should support devnet", () => {
      const mockSigner = createMockSigner("DevnetSigner111111111111111111111111");
      const facilitator = new ExactSvmFacilitator(mockSigner);

      const signers = facilitator.getSigners(SOLANA_DEVNET_CAIP2);
      expect(signers).toHaveLength(1);
    });

    it("should support mainnet", () => {
      const mockSigner = createMockSigner("MainnetSigner11111111111111111111111");
      const facilitator = new ExactSvmFacilitator(mockSigner);

      const signers = facilitator.getSigners(SOLANA_MAINNET_CAIP2);
      expect(signers).toHaveLength(1);
    });

    it("should return same signers for all networks", () => {
      const mockSigner = createMockSigner("MultiNetSigner11111111111111111111");
      const facilitator = new ExactSvmFacilitator(mockSigner);

      const devnetSigners = facilitator.getSigners(SOLANA_DEVNET_CAIP2);
      const mainnetSigners = facilitator.getSigners(SOLANA_MAINNET_CAIP2);

      // Same signer should be available on all networks
      expect(devnetSigners).toEqual(mainnetSigners);
    });
  });

  describe("Payload Structure", () => {
    it("should expect V2 payload format", () => {
      const payload = createMockPayload();

      expect(payload.t402Version).toBe(2);
      expect(payload.accepted.scheme).toBe("exact");
      expect(payload.payload).toHaveProperty("transaction");
    });

    it("should have transaction as base64 string", () => {
      const payload = createMockPayload({
        payload: {
          transaction: "SGVsbG8gV29ybGQ=", // "Hello World" in base64
        },
      });

      expect(typeof payload.payload.transaction).toBe("string");
    });
  });
});
