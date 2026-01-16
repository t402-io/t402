/**
 * Verification Edge Case Integration Tests for TRON Mechanism
 *
 * These tests verify the facilitator's verification logic handles
 * various edge cases and security scenarios correctly.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { ExactTronScheme as ExactTronFacilitator } from "../../src/exact/facilitator/scheme";
import type { FacilitatorTronSigner } from "../../src/signer";
import type { PaymentRequirements, PaymentPayload } from "@t402/core/types";
import type { VerifyMessageResult, TransactionConfirmation } from "../../src/types";
import {
  TRON_MAINNET_CAIP2,
  TRON_NILE_CAIP2,
  USDT_ADDRESSES,
  MIN_VALIDITY_BUFFER,
  DEFAULT_FEE_LIMIT,
} from "../../src/constants";

// Valid TRON addresses for testing
const VALID_RECIPIENT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const VALID_SENDER = "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf";
const VALID_FACILITATOR = "TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs";

/**
 * Create a mock FacilitatorTronSigner for testing
 */
function createMockSigner(...addresses: string[]): FacilitatorTronSigner {
  return {
    getAddresses: () => addresses,
    getBalance: vi.fn().mockResolvedValue("1000000000"), // 1000 USDT
    verifyTransaction: vi.fn().mockResolvedValue({ valid: true } as VerifyMessageResult),
    broadcastTransaction: vi.fn().mockResolvedValue("mock-tx-id"),
    waitForTransaction: vi.fn().mockResolvedValue({ success: true, txId: "mock-tx-id" } as TransactionConfirmation),
    isActivated: vi.fn().mockResolvedValue(true),
  };
}

/**
 * Create mock payment requirements for testing
 */
function createMockRequirements(overrides: Partial<PaymentRequirements> = {}): PaymentRequirements {
  return {
    scheme: "exact",
    network: TRON_MAINNET_CAIP2,
    asset: USDT_ADDRESSES[TRON_MAINNET_CAIP2],
    amount: "1000000", // 1 USDT
    payTo: VALID_RECIPIENT,
    maxTimeoutSeconds: 3600,
    ...overrides,
  };
}

/**
 * Create mock payment payload for testing
 */
function createMockPayload(overrides: Partial<PaymentPayload> = {}): PaymentPayload {
  const defaultAuthorization = {
    from: VALID_SENDER,
    to: VALID_RECIPIENT,
    contractAddress: USDT_ADDRESSES[TRON_MAINNET_CAIP2],
    amount: "1000000",
    expiration: Date.now() + 3600 * 1000, // 1 hour from now
  };

  return {
    t402Version: 2,
    accepted: {
      scheme: "exact",
      network: TRON_MAINNET_CAIP2,
    },
    payload: {
      signedTransaction: "mock-signed-transaction-hex",
      authorization: defaultAuthorization,
      ...((overrides.payload as Record<string, unknown>) || {}),
    },
    ...overrides,
  };
}

describe("TRON Verification Edge Cases", () => {
  describe("Payload Structure Validation", () => {
    let facilitator: ExactTronFacilitator;
    let mockSigner: FacilitatorTronSigner;

    beforeEach(() => {
      mockSigner = createMockSigner(VALID_FACILITATOR);
      facilitator = new ExactTronFacilitator(mockSigner);
    });

    it("should reject empty payload object", async () => {
      const requirements = createMockRequirements();
      const payload = {
        t402Version: 2,
        accepted: {
          scheme: "exact",
          network: TRON_MAINNET_CAIP2,
        },
        payload: {},
      } as never;

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("invalid_payload_structure");
      expect(result.payer).toBe("");
    });

    it("should reject null payload", async () => {
      const requirements = createMockRequirements();
      const payload = {
        t402Version: 2,
        accepted: {
          scheme: "exact",
          network: TRON_MAINNET_CAIP2,
        },
        payload: null,
      } as never;

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("invalid_payload_structure");
    });

    it("should reject payload missing authorization", async () => {
      const requirements = createMockRequirements();
      const payload = {
        t402Version: 2,
        accepted: {
          scheme: "exact",
          network: TRON_MAINNET_CAIP2,
        },
        payload: {
          signedTransaction: "mock-signed-transaction-hex",
        },
      } as never;

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("invalid_payload_structure");
    });

    it("should reject payload missing signedTransaction", async () => {
      const requirements = createMockRequirements();
      const payload = {
        t402Version: 2,
        accepted: {
          scheme: "exact",
          network: TRON_MAINNET_CAIP2,
        },
        payload: {
          authorization: {
            from: VALID_SENDER,
            to: VALID_RECIPIENT,
            contractAddress: USDT_ADDRESSES[TRON_MAINNET_CAIP2],
            amount: "1000000",
            expiration: Date.now() + 3600 * 1000,
          },
        },
      } as never;

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("invalid_payload_structure");
    });

    it("should reject settle with empty payload", async () => {
      const requirements = createMockRequirements();
      const payload = {
        t402Version: 2,
        accepted: {
          scheme: "exact",
          network: TRON_MAINNET_CAIP2,
        },
        payload: {},
      } as never;

      const result = await facilitator.settle(payload, requirements);

      expect(result.success).toBe(false);
      expect(result.errorReason).toBe("invalid_payload_structure");
      expect(result.payer).toBe("");
    });
  });

  describe("Scheme and Network Matching", () => {
    let facilitator: ExactTronFacilitator;
    let mockSigner: FacilitatorTronSigner;

    beforeEach(() => {
      mockSigner = createMockSigner(VALID_FACILITATOR);
      facilitator = new ExactTronFacilitator(mockSigner);
    });

    it("should reject mismatched scheme in payload", async () => {
      const requirements = createMockRequirements();
      const payload = createMockPayload({
        accepted: {
          scheme: "different-scheme",
          network: TRON_MAINNET_CAIP2,
        },
      });

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("unsupported_scheme");
    });

    it("should reject mismatched scheme in requirements", async () => {
      const requirements = createMockRequirements({ scheme: "different-scheme" });
      const payload = createMockPayload();

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("unsupported_scheme");
    });

    it("should reject mismatched network", async () => {
      const requirements = createMockRequirements({ network: TRON_MAINNET_CAIP2 });
      const payload = createMockPayload({
        accepted: {
          scheme: "exact",
          network: TRON_NILE_CAIP2,
        },
      });

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("network_mismatch");
    });

    it("should accept matching scheme and network", async () => {
      const requirements = createMockRequirements();
      const payload = createMockPayload();

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(true);
    });

    it("should normalize network names", async () => {
      const requirements = createMockRequirements({ network: "mainnet" });
      const payload = createMockPayload({
        accepted: {
          scheme: "exact",
          network: "tron:mainnet",
        },
      });

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(true);
    });
  });

  describe("Payload Structure Validation", () => {
    let facilitator: ExactTronFacilitator;
    let mockSigner: FacilitatorTronSigner;

    beforeEach(() => {
      mockSigner = createMockSigner(VALID_FACILITATOR);
      facilitator = new ExactTronFacilitator(mockSigner);
    });

    it("should reject missing signedTransaction", async () => {
      const requirements = createMockRequirements();
      const payload = createMockPayload();
      // Remove signedTransaction
      (payload.payload as Record<string, unknown>).signedTransaction = undefined;

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("invalid_payload_structure");
    });

    it("should reject missing authorization", async () => {
      const requirements = createMockRequirements();
      const payload: PaymentPayload = {
        t402Version: 2,
        accepted: {
          scheme: "exact",
          network: TRON_MAINNET_CAIP2,
        },
        payload: {
          signedTransaction: "mock-hex",
        },
      };

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
    });
  });

  describe("Address Validation", () => {
    let facilitator: ExactTronFacilitator;
    let mockSigner: FacilitatorTronSigner;

    beforeEach(() => {
      mockSigner = createMockSigner(VALID_FACILITATOR);
      facilitator = new ExactTronFacilitator(mockSigner);
    });

    it("should reject invalid sender address", async () => {
      const requirements = createMockRequirements();
      const payload = createMockPayload();
      (payload.payload as Record<string, unknown>).authorization = {
        from: "invalid-address",
        to: VALID_RECIPIENT,
        contractAddress: USDT_ADDRESSES[TRON_MAINNET_CAIP2],
        amount: "1000000",
        expiration: Date.now() + 3600 * 1000,
      };

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("invalid_sender_address");
    });

    it("should reject invalid recipient address", async () => {
      const requirements = createMockRequirements();
      const payload = createMockPayload();
      (payload.payload as Record<string, unknown>).authorization = {
        from: VALID_SENDER,
        to: "invalid-address",
        contractAddress: USDT_ADDRESSES[TRON_MAINNET_CAIP2],
        amount: "1000000",
        expiration: Date.now() + 3600 * 1000,
      };

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("invalid_recipient_address");
    });

    it("should reject invalid contract address", async () => {
      const requirements = createMockRequirements();
      const payload = createMockPayload();
      (payload.payload as Record<string, unknown>).authorization = {
        from: VALID_SENDER,
        to: VALID_RECIPIENT,
        contractAddress: "invalid-contract",
        amount: "1000000",
        expiration: Date.now() + 3600 * 1000,
      };

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("invalid_contract_address");
    });
  });

  describe("Transaction Verification", () => {
    it("should reject if transaction verification fails", async () => {
      const mockSigner = createMockSigner(VALID_FACILITATOR);
      (mockSigner.verifyTransaction as ReturnType<typeof vi.fn>).mockResolvedValue({
        valid: false,
        reason: "invalid_signature",
      });
      const facilitator = new ExactTronFacilitator(mockSigner);

      const requirements = createMockRequirements();
      const payload = createMockPayload();

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("invalid_signature");
    });

    it("should use default reason if not provided", async () => {
      const mockSigner = createMockSigner(VALID_FACILITATOR);
      (mockSigner.verifyTransaction as ReturnType<typeof vi.fn>).mockResolvedValue({
        valid: false,
      });
      const facilitator = new ExactTronFacilitator(mockSigner);

      const requirements = createMockRequirements();
      const payload = createMockPayload();

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("transaction_verification_failed");
    });
  });

  describe("Authorization Expiry", () => {
    let facilitator: ExactTronFacilitator;
    let mockSigner: FacilitatorTronSigner;

    beforeEach(() => {
      mockSigner = createMockSigner(VALID_FACILITATOR);
      facilitator = new ExactTronFacilitator(mockSigner);
    });

    it("should reject expired authorization", async () => {
      const requirements = createMockRequirements();
      const payload = createMockPayload();
      (payload.payload as Record<string, unknown>).authorization = {
        from: VALID_SENDER,
        to: VALID_RECIPIENT,
        contractAddress: USDT_ADDRESSES[TRON_MAINNET_CAIP2],
        amount: "1000000",
        expiration: Date.now() - 1000, // Already expired
      };

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("authorization_expired");
    });

    it("should reject authorization expiring within buffer", async () => {
      const requirements = createMockRequirements();
      const payload = createMockPayload();
      (payload.payload as Record<string, unknown>).authorization = {
        from: VALID_SENDER,
        to: VALID_RECIPIENT,
        contractAddress: USDT_ADDRESSES[TRON_MAINNET_CAIP2],
        amount: "1000000",
        expiration: Date.now() + (MIN_VALIDITY_BUFFER - 1) * 1000, // Within buffer
      };

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("authorization_expired");
    });

    it("should accept authorization with sufficient validity", async () => {
      const requirements = createMockRequirements();
      const payload = createMockPayload();
      (payload.payload as Record<string, unknown>).authorization = {
        from: VALID_SENDER,
        to: VALID_RECIPIENT,
        contractAddress: USDT_ADDRESSES[TRON_MAINNET_CAIP2],
        amount: "1000000",
        expiration: Date.now() + 3600 * 1000, // 1 hour from now
      };

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(true);
    });
  });

  describe("Balance Verification", () => {
    it("should reject insufficient balance", async () => {
      const mockSigner = createMockSigner(VALID_FACILITATOR);
      (mockSigner.getBalance as ReturnType<typeof vi.fn>).mockResolvedValue("500000"); // Only 0.5 USDT
      const facilitator = new ExactTronFacilitator(mockSigner);

      const requirements = createMockRequirements({ amount: "1000000" }); // Requires 1 USDT
      const payload = createMockPayload();

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("insufficient_balance");
    });

    it("should continue if balance check fails", async () => {
      const mockSigner = createMockSigner(VALID_FACILITATOR);
      (mockSigner.getBalance as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));
      const facilitator = new ExactTronFacilitator(mockSigner);

      const requirements = createMockRequirements();
      const payload = createMockPayload();

      // Should continue to next checks even if balance check fails
      const result = await facilitator.verify(payload, requirements);
      expect(result.isValid).toBe(true); // Other checks pass
    });
  });

  describe("Amount Validation", () => {
    let facilitator: ExactTronFacilitator;
    let mockSigner: FacilitatorTronSigner;

    beforeEach(() => {
      mockSigner = createMockSigner(VALID_FACILITATOR);
      facilitator = new ExactTronFacilitator(mockSigner);
    });

    it("should reject insufficient amount", async () => {
      const requirements = createMockRequirements({ amount: "2000000" }); // Requires 2 USDT
      const payload = createMockPayload();
      (payload.payload as Record<string, unknown>).authorization = {
        from: VALID_SENDER,
        to: VALID_RECIPIENT,
        contractAddress: USDT_ADDRESSES[TRON_MAINNET_CAIP2],
        amount: "1000000", // Only 1 USDT
        expiration: Date.now() + 3600 * 1000,
      };

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("insufficient_amount");
    });

    it("should accept exact amount", async () => {
      const requirements = createMockRequirements({ amount: "1000000" });
      const payload = createMockPayload();

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(true);
    });

    it("should accept overpayment", async () => {
      const requirements = createMockRequirements({ amount: "500000" }); // Requires 0.5 USDT
      const payload = createMockPayload();
      (payload.payload as Record<string, unknown>).authorization = {
        from: VALID_SENDER,
        to: VALID_RECIPIENT,
        contractAddress: USDT_ADDRESSES[TRON_MAINNET_CAIP2],
        amount: "1000000", // Paying 1 USDT
        expiration: Date.now() + 3600 * 1000,
      };

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(true);
    });

    it("should handle large amounts", async () => {
      const requirements = createMockRequirements({ amount: "1000000000000" }); // 1M USDT
      const payload = createMockPayload();
      (payload.payload as Record<string, unknown>).authorization = {
        from: VALID_SENDER,
        to: VALID_RECIPIENT,
        contractAddress: USDT_ADDRESSES[TRON_MAINNET_CAIP2],
        amount: "1000000000000",
        expiration: Date.now() + 3600 * 1000,
      };

      // Need sufficient balance
      (mockSigner.getBalance as ReturnType<typeof vi.fn>).mockResolvedValue("2000000000000");

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(true);
    });
  });

  describe("Recipient Validation", () => {
    let facilitator: ExactTronFacilitator;
    let mockSigner: FacilitatorTronSigner;

    beforeEach(() => {
      mockSigner = createMockSigner(VALID_FACILITATOR);
      facilitator = new ExactTronFacilitator(mockSigner);
    });

    it("should reject mismatched recipient", async () => {
      const requirements = createMockRequirements({ payTo: VALID_RECIPIENT });
      const payload = createMockPayload();
      (payload.payload as Record<string, unknown>).authorization = {
        from: VALID_SENDER,
        to: VALID_FACILITATOR, // Different recipient
        contractAddress: USDT_ADDRESSES[TRON_MAINNET_CAIP2],
        amount: "1000000",
        expiration: Date.now() + 3600 * 1000,
      };

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("recipient_mismatch");
    });
  });

  describe("Asset Validation", () => {
    let facilitator: ExactTronFacilitator;
    let mockSigner: FacilitatorTronSigner;

    beforeEach(() => {
      mockSigner = createMockSigner(VALID_FACILITATOR);
      facilitator = new ExactTronFacilitator(mockSigner);
    });

    it("should reject mismatched contract address", async () => {
      const requirements = createMockRequirements({ asset: USDT_ADDRESSES[TRON_MAINNET_CAIP2] });
      const payload = createMockPayload();
      (payload.payload as Record<string, unknown>).authorization = {
        from: VALID_SENDER,
        to: VALID_RECIPIENT,
        contractAddress: USDT_ADDRESSES[TRON_NILE_CAIP2], // Different contract
        amount: "1000000",
        expiration: Date.now() + 3600 * 1000,
      };

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("asset_mismatch");
    });
  });

  describe("Account Activation", () => {
    it("should reject if account is not activated", async () => {
      const mockSigner = createMockSigner(VALID_FACILITATOR);
      (mockSigner.isActivated as ReturnType<typeof vi.fn>).mockResolvedValue(false);
      const facilitator = new ExactTronFacilitator(mockSigner);

      const requirements = createMockRequirements();
      const payload = createMockPayload();

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("account_not_activated");
    });

    it("should continue if activation check fails", async () => {
      const mockSigner = createMockSigner(VALID_FACILITATOR);
      (mockSigner.isActivated as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));
      const facilitator = new ExactTronFacilitator(mockSigner);

      const requirements = createMockRequirements();
      const payload = createMockPayload();

      // Should pass even if activation check fails
      const result = await facilitator.verify(payload, requirements);
      expect(result.isValid).toBe(true);
    });
  });

  describe("Facilitator Configuration", () => {
    it("should support single signer", () => {
      const mockSigner = createMockSigner(VALID_FACILITATOR);
      const facilitator = new ExactTronFacilitator(mockSigner);

      const signers = facilitator.getSigners(TRON_MAINNET_CAIP2);
      expect(signers).toHaveLength(1);
      expect(signers[0]).toBe(VALID_FACILITATOR);
    });

    it("should support multiple addresses", () => {
      const mockSigner = createMockSigner(
        VALID_FACILITATOR,
        VALID_RECIPIENT,
        VALID_SENDER,
      );
      const facilitator = new ExactTronFacilitator(mockSigner);

      const signers = facilitator.getSigners(TRON_MAINNET_CAIP2);
      expect(signers).toHaveLength(3);
      expect(signers).toContain(VALID_FACILITATOR);
      expect(signers).toContain(VALID_RECIPIENT);
      expect(signers).toContain(VALID_SENDER);
    });

    it("should return same signers for all networks", () => {
      const mockSigner = createMockSigner(VALID_FACILITATOR);
      const facilitator = new ExactTronFacilitator(mockSigner);

      const mainnetSigners = facilitator.getSigners(TRON_MAINNET_CAIP2);
      const nileSigners = facilitator.getSigners(TRON_NILE_CAIP2);

      expect(mainnetSigners).toEqual(nileSigners);
    });
  });

  describe("Gas Sponsorship Configuration", () => {
    it("should not include gasSponsor by default", () => {
      const mockSigner = createMockSigner(VALID_FACILITATOR);
      const facilitator = new ExactTronFacilitator(mockSigner);

      const extra = facilitator.getExtra(TRON_MAINNET_CAIP2);
      expect(extra).toBeUndefined();
    });

    it("should include gasSponsor when configured", () => {
      const mockSigner = createMockSigner(VALID_FACILITATOR);
      const facilitator = new ExactTronFacilitator(mockSigner, { canSponsorGas: true });

      const extra = facilitator.getExtra(TRON_MAINNET_CAIP2);
      expect(extra).toBeDefined();
      expect(extra?.gasSponsor).toBe(VALID_FACILITATOR);
    });
  });

  describe("Network Support", () => {
    it("should support mainnet", () => {
      const mockSigner = createMockSigner(VALID_FACILITATOR);
      const facilitator = new ExactTronFacilitator(mockSigner);

      const signers = facilitator.getSigners(TRON_MAINNET_CAIP2);
      expect(signers).toHaveLength(1);
    });

    it("should support nile testnet", () => {
      const mockSigner = createMockSigner(VALID_FACILITATOR);
      const facilitator = new ExactTronFacilitator(mockSigner);

      const signers = facilitator.getSigners(TRON_NILE_CAIP2);
      expect(signers).toHaveLength(1);
    });

    it("should have correct scheme identifier", () => {
      const mockSigner = createMockSigner(VALID_FACILITATOR);
      const facilitator = new ExactTronFacilitator(mockSigner);

      expect(facilitator.scheme).toBe("exact");
    });

    it("should have correct caipFamily pattern", () => {
      const mockSigner = createMockSigner(VALID_FACILITATOR);
      const facilitator = new ExactTronFacilitator(mockSigner);

      expect(facilitator.caipFamily).toBe("tron:*");
    });
  });

  describe("Payload Structure", () => {
    it("should expect V2 payload format", () => {
      const payload = createMockPayload();

      expect(payload.t402Version).toBe(2);
      expect(payload.accepted.scheme).toBe("exact");
      expect(payload.payload).toHaveProperty("signedTransaction");
      expect(payload.payload).toHaveProperty("authorization");
    });

    it("should have authorization with required fields", () => {
      const payload = createMockPayload();
      const authorization = (payload.payload as Record<string, unknown>).authorization as Record<string, unknown>;

      expect(authorization).toHaveProperty("from");
      expect(authorization).toHaveProperty("to");
      expect(authorization).toHaveProperty("contractAddress");
      expect(authorization).toHaveProperty("amount");
      expect(authorization).toHaveProperty("expiration");
    });
  });

  describe("Settlement", () => {
    it("should settle valid payment", async () => {
      const mockSigner = createMockSigner(VALID_FACILITATOR);
      const facilitator = new ExactTronFacilitator(mockSigner);

      const requirements = createMockRequirements();
      const payload = createMockPayload();

      const result = await facilitator.settle(payload, requirements);

      expect(result.success).toBe(true);
      expect(result.transaction).toBe("mock-tx-id");
      expect(result.network).toBe(TRON_MAINNET_CAIP2);
    });

    it("should reject settlement if verification fails", async () => {
      const mockSigner = createMockSigner(VALID_FACILITATOR);
      (mockSigner.verifyTransaction as ReturnType<typeof vi.fn>).mockResolvedValue({
        valid: false,
        reason: "invalid_signature",
      });
      const facilitator = new ExactTronFacilitator(mockSigner);

      const requirements = createMockRequirements();
      const payload = createMockPayload();

      const result = await facilitator.settle(payload, requirements);

      expect(result.success).toBe(false);
      expect(result.errorReason).toBe("invalid_signature");
    });

    it("should handle broadcast failure", async () => {
      const mockSigner = createMockSigner(VALID_FACILITATOR);
      (mockSigner.broadcastTransaction as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Broadcast failed"));
      const facilitator = new ExactTronFacilitator(mockSigner);

      const requirements = createMockRequirements();
      const payload = createMockPayload();

      const result = await facilitator.settle(payload, requirements);

      expect(result.success).toBe(false);
      expect(result.errorReason).toBe("transaction_failed");
    });

    it("should handle confirmation failure", async () => {
      const mockSigner = createMockSigner(VALID_FACILITATOR);
      (mockSigner.waitForTransaction as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: "Transaction reverted",
      });
      const facilitator = new ExactTronFacilitator(mockSigner);

      const requirements = createMockRequirements();
      const payload = createMockPayload();

      const result = await facilitator.settle(payload, requirements);

      expect(result.success).toBe(false);
      expect(result.errorReason).toBe("Transaction reverted");
    });
  });
});
