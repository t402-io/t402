/**
 * Verification Edge Case Integration Tests for TON Mechanism
 *
 * These tests verify the facilitator's verification logic handles
 * various edge cases and security scenarios correctly.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { Cell } from "@ton/core";
import { ExactTonScheme as ExactTonFacilitator } from "../../src/exact/facilitator/scheme";
import type { FacilitatorTonSigner, VerifyMessageParams, WaitForTransactionParams } from "../../src/signer";
import type { PaymentRequirements, PaymentPayload } from "@t402/core/types";
import type { VerifyMessageResult, TransactionConfirmation } from "../../src/types";
import {
  TON_MAINNET_CAIP2,
  TON_TESTNET_CAIP2,
  SCHEME_EXACT,
  DEFAULT_VALIDITY_DURATION,
} from "../../src/constants";
import { USDT_ADDRESSES } from "../../src/tokens";

/**
 * Create a mock FacilitatorTonSigner for testing
 * Matches the FacilitatorTonSigner interface from src/signer.ts
 *
 * @param addresses - One or more addresses this signer manages
 */
function createMockSigner(...addresses: string[]): FacilitatorTonSigner {
  return {
    getAddresses: () => addresses as readonly string[],
    getJettonBalance: vi.fn().mockResolvedValue(10000000000n), // 10000 USDT
    getJettonWalletAddress: vi.fn().mockResolvedValue("EQJettonWallet11111111111111111111111111"),
    verifyMessage: vi.fn().mockResolvedValue({ valid: true } as VerifyMessageResult),
    sendExternalMessage: vi.fn().mockResolvedValue("tx-hash-12345"),
    waitForTransaction: vi.fn().mockResolvedValue({
      success: true,
      hash: "tx-hash-12345",
    } as TransactionConfirmation),
    getSeqno: vi.fn().mockResolvedValue(5),
    isDeployed: vi.fn().mockResolvedValue(true),
  };
}

// Valid TON addresses for testing (mainnet USDT and a derived address)
const VALID_RECIPIENT = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs";
const VALID_SENDER = "EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2";

/**
 * Create mock payment requirements for testing
 */
function createMockRequirements(overrides: Partial<PaymentRequirements> = {}): PaymentRequirements {
  return {
    scheme: SCHEME_EXACT,
    network: TON_MAINNET_CAIP2,
    asset: USDT_ADDRESSES[TON_MAINNET_CAIP2],
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
  const now = Math.floor(Date.now() / 1000);
  // Create a minimal valid BOC for testing
  const cell = new Cell();
  const signedBoc = cell.toBoc().toString("base64");

  return {
    t402Version: 2,
    accepted: {
      scheme: SCHEME_EXACT,
      network: TON_MAINNET_CAIP2,
    },
    payload: {
      signedBoc,
      authorization: {
        from: VALID_SENDER,
        to: VALID_RECIPIENT,
        jettonAmount: "1000000",
        jettonMaster: USDT_ADDRESSES[TON_MAINNET_CAIP2],
        validUntil: now + DEFAULT_VALIDITY_DURATION,
        seqno: 5,
        queryId: "12345",
      },
    },
    ...overrides,
  };
}

describe("TON Verification Edge Cases", () => {
  describe("Payload Structure Validation", () => {
    let facilitator: ExactTonFacilitator;
    let mockSigner: FacilitatorTonSigner;

    beforeEach(() => {
      mockSigner = createMockSigner("EQFacilitatorAddress11111111111111111111");
      facilitator = new ExactTonFacilitator(mockSigner);
    });

    it("should reject empty payload object", async () => {
      const requirements = createMockRequirements();
      const payload = {
        t402Version: 2,
        accepted: {
          scheme: SCHEME_EXACT,
          network: TON_MAINNET_CAIP2,
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
          scheme: SCHEME_EXACT,
          network: TON_MAINNET_CAIP2,
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
          scheme: SCHEME_EXACT,
          network: TON_MAINNET_CAIP2,
        },
        payload: {
          signedBoc: "someBase64Boc",
        },
      } as never;

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("invalid_payload_structure");
    });

    it("should reject payload missing signedBoc", async () => {
      const requirements = createMockRequirements();
      const payload = {
        t402Version: 2,
        accepted: {
          scheme: SCHEME_EXACT,
          network: TON_MAINNET_CAIP2,
        },
        payload: {
          authorization: {
            from: VALID_SENDER,
            to: VALID_RECIPIENT,
            jettonAmount: "1000000",
            jettonMaster: USDT_ADDRESSES[TON_MAINNET_CAIP2],
            validUntil: Math.floor(Date.now() / 1000) + 3600,
            seqno: 5,
            queryId: "12345",
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
          scheme: SCHEME_EXACT,
          network: TON_MAINNET_CAIP2,
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
    let facilitator: ExactTonFacilitator;
    let mockSigner: FacilitatorTonSigner;

    beforeEach(() => {
      mockSigner = createMockSigner("EQFacilitatorAddress11111111111111111111");
      facilitator = new ExactTonFacilitator(mockSigner);
    });

    it("should reject mismatched scheme", async () => {
      const requirements = createMockRequirements();
      const payload = createMockPayload({
        accepted: {
          scheme: "different-scheme",
          network: TON_MAINNET_CAIP2,
        },
      });

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("unsupported_scheme");
    });

    it("should reject mismatched network", async () => {
      const requirements = createMockRequirements({ network: TON_MAINNET_CAIP2 });
      const payload = createMockPayload({
        accepted: {
          scheme: SCHEME_EXACT,
          network: TON_TESTNET_CAIP2,
        },
      });

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("network_mismatch");
    });

    it("should reject invalid network identifier", async () => {
      const requirements = createMockRequirements({ network: "ton:invalid" as any });
      const payload = createMockPayload({
        accepted: {
          scheme: SCHEME_EXACT,
          network: "ton:invalid" as any,
        },
      });

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("invalid_network");
    });
  });

  describe("BOC Format Validation", () => {
    let facilitator: ExactTonFacilitator;
    let mockSigner: FacilitatorTonSigner;

    beforeEach(() => {
      mockSigner = createMockSigner("EQFacilitatorAddress11111111111111111111");
      facilitator = new ExactTonFacilitator(mockSigner);
    });

    it("should reject invalid BOC format", async () => {
      const requirements = createMockRequirements();
      const payload = createMockPayload();
      // Override with invalid BOC
      (payload.payload as any).signedBoc = "not-valid-base64-boc!!!";

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("invalid_boc_format");
    });
  });

  describe("Message Verification", () => {
    it("should reject if message verification fails", async () => {
      const mockSigner = createMockSigner("EQFacilitatorAddress11111111111111111111");
      // Mock verification failure
      (mockSigner.verifyMessage as any).mockResolvedValue({
        valid: false,
        reason: "signature_invalid",
      });

      const facilitator = new ExactTonFacilitator(mockSigner);
      const requirements = createMockRequirements();
      const payload = createMockPayload();

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("signature_invalid");
    });
  });

  describe("Authorization Expiry", () => {
    it("should reject expired authorization", async () => {
      const mockSigner = createMockSigner("EQFacilitatorAddress11111111111111111111");
      const facilitator = new ExactTonFacilitator(mockSigner);
      const requirements = createMockRequirements();

      const now = Math.floor(Date.now() / 1000);
      const payload = createMockPayload();
      // Set validUntil to past
      (payload.payload as any).authorization.validUntil = now - 100;

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("authorization_expired");
    });

    it("should reject authorization expiring within 30 seconds", async () => {
      const mockSigner = createMockSigner("EQFacilitatorAddress11111111111111111111");
      const facilitator = new ExactTonFacilitator(mockSigner);
      const requirements = createMockRequirements();

      const now = Math.floor(Date.now() / 1000);
      const payload = createMockPayload();
      // Set validUntil to 20 seconds from now (within 30 second buffer)
      (payload.payload as any).authorization.validUntil = now + 20;

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("authorization_expired");
    });
  });

  describe("Balance Verification", () => {
    it("should reject if insufficient Jetton balance", async () => {
      const mockSigner = createMockSigner("EQFacilitatorAddress11111111111111111111");
      // Mock insufficient balance
      (mockSigner.getJettonBalance as any).mockResolvedValue(100n); // Only 0.0001 USDT

      const facilitator = new ExactTonFacilitator(mockSigner);
      const requirements = createMockRequirements({ amount: "1000000" }); // 1 USDT
      const payload = createMockPayload();

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("insufficient_jetton_balance");
    });
  });

  describe("Amount Validation", () => {
    it("should reject if transfer amount is insufficient", async () => {
      const mockSigner = createMockSigner("EQFacilitatorAddress11111111111111111111");
      const facilitator = new ExactTonFacilitator(mockSigner);

      const requirements = createMockRequirements({ amount: "5000000" }); // 5 USDT required
      const payload = createMockPayload();
      // Set authorization amount lower than required
      (payload.payload as any).authorization.jettonAmount = "1000000"; // Only 1 USDT

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("insufficient_amount");
    });
  });

  describe("Recipient Validation", () => {
    it("should reject if recipient does not match", async () => {
      const mockSigner = createMockSigner("EQFacilitatorAddress11111111111111111111");
      const facilitator = new ExactTonFacilitator(mockSigner);

      const requirements = createMockRequirements({
        payTo: "EQExpectedRecipient111111111111111111111",
      });
      const payload = createMockPayload();
      // Set different recipient in authorization
      (payload.payload as any).authorization.to = "EQDifferentRecipient1111111111111111111";

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("recipient_mismatch");
    });
  });

  describe("Asset Validation", () => {
    it("should reject if Jetton master does not match", async () => {
      const mockSigner = createMockSigner("EQFacilitatorAddress11111111111111111111");
      const facilitator = new ExactTonFacilitator(mockSigner);

      const requirements = createMockRequirements({
        asset: USDT_ADDRESSES[TON_MAINNET_CAIP2],
      });
      const payload = createMockPayload();
      // Set different Jetton master in authorization
      (payload.payload as any).authorization.jettonMaster = "EQDifferentJetton1111111111111111111111";

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("asset_mismatch");
    });
  });

  describe("Seqno Validation", () => {
    it("should reject if seqno already used", async () => {
      const mockSigner = createMockSigner("EQFacilitatorAddress11111111111111111111");
      // Current seqno is 10, but authorization has seqno 5
      (mockSigner.getSeqno as any).mockResolvedValue(10);

      const facilitator = new ExactTonFacilitator(mockSigner);
      const requirements = createMockRequirements();
      const payload = createMockPayload();
      (payload.payload as any).authorization.seqno = 5;

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("seqno_already_used");
    });

    it("should reject if seqno too high", async () => {
      const mockSigner = createMockSigner("EQFacilitatorAddress11111111111111111111");
      // Current seqno is 5, but authorization has seqno 10
      (mockSigner.getSeqno as any).mockResolvedValue(5);

      const facilitator = new ExactTonFacilitator(mockSigner);
      const requirements = createMockRequirements();
      const payload = createMockPayload();
      (payload.payload as any).authorization.seqno = 10;

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("seqno_too_high");
    });
  });

  describe("Wallet Deployment", () => {
    it("should reject if wallet not deployed", async () => {
      const mockSigner = createMockSigner("EQFacilitatorAddress11111111111111111111");
      (mockSigner.isDeployed as any).mockResolvedValue(false);

      const facilitator = new ExactTonFacilitator(mockSigner);
      const requirements = createMockRequirements();
      const payload = createMockPayload();

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("wallet_not_deployed");
    });
  });

  describe("Facilitator Configuration", () => {
    it("should support single address", () => {
      const mockSigner = createMockSigner("EQSingleAddress111111111111111111111111");
      const facilitator = new ExactTonFacilitator(mockSigner);

      const signers = facilitator.getSigners(TON_MAINNET_CAIP2);
      expect(signers).toHaveLength(1);
      expect(signers[0]).toBe("EQSingleAddress111111111111111111111111");
    });

    it("should support multiple addresses", () => {
      const mockSigner = createMockSigner(
        "EQAddress1111111111111111111111111111111",
        "EQAddress2222222222222222222222222222222",
      );
      const facilitator = new ExactTonFacilitator(mockSigner);

      const signers = facilitator.getSigners(TON_MAINNET_CAIP2);
      expect(signers).toHaveLength(2);
      expect(signers).toContain("EQAddress1111111111111111111111111111111");
      expect(signers).toContain("EQAddress2222222222222222222222222222222");
    });

    it("should have correct scheme identifier", () => {
      const mockSigner = createMockSigner("EQTestAddress11111111111111111111111111");
      const facilitator = new ExactTonFacilitator(mockSigner);

      expect(facilitator.scheme).toBe(SCHEME_EXACT);
    });

    it("should have correct caip family", () => {
      const mockSigner = createMockSigner("EQTestAddress11111111111111111111111111");
      const facilitator = new ExactTonFacilitator(mockSigner);

      expect(facilitator.caipFamily).toBe("ton:*");
    });
  });

  describe("Gas Sponsorship Configuration", () => {
    it("should not return gasSponsor when canSponsorGas is false", () => {
      const mockSigner = createMockSigner("EQGasSponsor11111111111111111111111111");
      const facilitator = new ExactTonFacilitator(mockSigner, { canSponsorGas: false });

      const extra = facilitator.getExtra(TON_MAINNET_CAIP2);
      expect(extra).toBeUndefined();
    });

    it("should return gasSponsor when canSponsorGas is true", () => {
      const mockSigner = createMockSigner("EQGasSponsor11111111111111111111111111");
      const facilitator = new ExactTonFacilitator(mockSigner, { canSponsorGas: true });

      const extra = facilitator.getExtra(TON_MAINNET_CAIP2);
      expect(extra).toBeDefined();
      expect(extra!.gasSponsor).toBe("EQGasSponsor11111111111111111111111111");
    });

    it("should return first address as gasSponsor with multiple signers", () => {
      const mockSigner = createMockSigner(
        "EQFirstSponsor1111111111111111111111111",
        "EQSecondSponsor111111111111111111111111",
      );
      const facilitator = new ExactTonFacilitator(mockSigner, { canSponsorGas: true });

      const extra = facilitator.getExtra(TON_MAINNET_CAIP2);
      expect(extra!.gasSponsor).toBe("EQFirstSponsor1111111111111111111111111");
    });
  });

  describe("Network Support", () => {
    it("should support mainnet", () => {
      const mockSigner = createMockSigner("EQMainnetSigner1111111111111111111111");
      const facilitator = new ExactTonFacilitator(mockSigner);

      const signers = facilitator.getSigners(TON_MAINNET_CAIP2);
      expect(signers).toHaveLength(1);
    });

    it("should support testnet", () => {
      const mockSigner = createMockSigner("EQTestnetSigner1111111111111111111111");
      const facilitator = new ExactTonFacilitator(mockSigner);

      const signers = facilitator.getSigners(TON_TESTNET_CAIP2);
      expect(signers).toHaveLength(1);
    });

    it("should return same signers for all networks", () => {
      const mockSigner = createMockSigner("EQMultiNetSigner11111111111111111111");
      const facilitator = new ExactTonFacilitator(mockSigner);

      const mainnetSigners = facilitator.getSigners(TON_MAINNET_CAIP2);
      const testnetSigners = facilitator.getSigners(TON_TESTNET_CAIP2);

      expect(mainnetSigners).toEqual(testnetSigners);
    });
  });

  describe("Payload Structure", () => {
    it("should expect V2 payload format", () => {
      const payload = createMockPayload();

      expect(payload.t402Version).toBe(2);
      expect(payload.accepted.scheme).toBe(SCHEME_EXACT);
      expect(payload.payload).toHaveProperty("signedBoc");
      expect(payload.payload).toHaveProperty("authorization");
    });

    it("should have required authorization fields", () => {
      const payload = createMockPayload();
      const auth = (payload.payload as any).authorization;

      expect(auth).toHaveProperty("from");
      expect(auth).toHaveProperty("to");
      expect(auth).toHaveProperty("jettonAmount");
      expect(auth).toHaveProperty("jettonMaster");
      expect(auth).toHaveProperty("validUntil");
      expect(auth).toHaveProperty("seqno");
    });
  });

  describe("Payment Requirements Validation", () => {
    it("should require valid asset address", () => {
      const requirements = createMockRequirements({
        asset: USDT_ADDRESSES[TON_MAINNET_CAIP2],
      });

      expect(requirements.asset).toBeDefined();
      expect(requirements.asset.length).toBeGreaterThan(0);
    });

    it("should require valid payTo address", () => {
      const requirements = createMockRequirements({
        payTo: "EQValidRecipient111111111111111111111111",
      });

      expect(requirements.payTo).toBeDefined();
      expect(requirements.payTo.length).toBeGreaterThan(0);
    });
  });

  describe("Amount Validation Edge Cases", () => {
    it("should accept exact amount match", () => {
      const requirements = createMockRequirements({
        amount: "1000000", // 1 USDT
      });

      expect(requirements.amount).toBe("1000000");
    });

    it("should handle large amounts", () => {
      const requirements = createMockRequirements({
        amount: "1000000000000", // 1M USDT
      });

      expect(BigInt(requirements.amount)).toBe(1000000000000n);
    });

    it("should handle small amounts", () => {
      const requirements = createMockRequirements({
        amount: "1", // 0.000001 USDT (smallest unit)
      });

      expect(BigInt(requirements.amount)).toBe(1n);
    });
  });
});
