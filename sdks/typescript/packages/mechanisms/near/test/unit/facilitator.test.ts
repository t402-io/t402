import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExactDirectNearFacilitator } from "../../src/exact-direct/facilitator/scheme";
import type { FacilitatorNearSigner, TransactionResult } from "../../src/types";
import type { PaymentPayload, PaymentRequirements } from "@t402/core/types";
import { NEAR_MAINNET_CAIP2, SCHEME_EXACT_DIRECT } from "../../src/constants";

/** Helper to base64-encode ft_transfer args */
function encodeFtTransferArgs(args: { receiver_id: string; amount: string; memo?: string }): string {
  return btoa(JSON.stringify(args));
}

/** Build a valid mock transaction result */
function buildMockTransaction(overrides: Partial<{
  receiverId: string;
  signerId: string;
  ftRecipient: string;
  ftAmount: string;
  succeeded: boolean;
}>): TransactionResult {
  const opts = {
    receiverId: "usdt.tether-token.near",
    signerId: "alice.near",
    ftRecipient: "merchant.near",
    ftAmount: "1000000",
    succeeded: true,
    ...overrides,
  };

  return {
    status: opts.succeeded
      ? { SuccessValue: "" }
      : { Failure: { error: "execution failed" } },
    transaction: {
      hash: "9FtHUFBQsZ2MG77K3x3MJ9wjX3UT8zE4Bnv4RbdHJs3",
      signer_id: opts.signerId,
      receiver_id: opts.receiverId,
      actions: [
        {
          FunctionCall: {
            method_name: "ft_transfer",
            args: encodeFtTransferArgs({
              receiver_id: opts.ftRecipient,
              amount: opts.ftAmount,
            }),
            gas: 30000000000000,
            deposit: "1",
          },
        },
      ],
    },
    transaction_outcome: {
      block_hash: "4GpFBH2K3S7GKopj3MJ9bLCbXkxZ8rYV6kzBzv2nAZjS",
      id: "9FtHUFBQsZ2MG77K3x3MJ9wjX3UT8zE4Bnv4RbdHJs3",
    },
    receipts_outcome: [],
  };
}

describe("ExactDirectNearFacilitator", () => {
  let mockSigner: FacilitatorNearSigner;

  beforeEach(() => {
    mockSigner = {
      getAddresses: vi.fn().mockReturnValue(["facilitator.near"]),
      queryTransaction: vi.fn().mockResolvedValue(buildMockTransaction({})),
      getBalance: vi.fn().mockResolvedValue(BigInt(10000000)),
    };
  });

  const makePayload = (overrides?: Partial<{
    scheme: string;
    network: string;
    txHash: string;
    from: string;
  }>): PaymentPayload => ({
    t402Version: 2,
    accepted: {
      scheme: overrides?.scheme ?? SCHEME_EXACT_DIRECT,
      network: overrides?.network ?? NEAR_MAINNET_CAIP2,
    },
    payload: {
      txHash: overrides?.txHash ?? "9FtHUFBQsZ2MG77K3x3MJ9wjX3UT8zE4Bnv4RbdHJs3",
      from: overrides?.from ?? "alice.near",
      to: "merchant.near",
      amount: "1000000",
    },
  });

  const makeRequirements = (overrides?: Partial<PaymentRequirements>): PaymentRequirements => ({
    scheme: SCHEME_EXACT_DIRECT,
    network: NEAR_MAINNET_CAIP2,
    asset: "usdt.tether-token.near",
    amount: "1000000",
    payTo: "merchant.near",
    maxTimeoutSeconds: 3600,
    ...overrides,
  });

  describe("constructor", () => {
    it("should create instance with correct scheme", () => {
      const facilitator = new ExactDirectNearFacilitator(mockSigner);
      expect(facilitator.scheme).toBe(SCHEME_EXACT_DIRECT);
    });

    it("should have correct caipFamily", () => {
      const facilitator = new ExactDirectNearFacilitator(mockSigner);
      expect(facilitator.caipFamily).toBe("near:*");
    });
  });

  describe("getSigners", () => {
    it("should return signer addresses for a network", () => {
      const facilitator = new ExactDirectNearFacilitator(mockSigner);
      const signers = facilitator.getSigners(NEAR_MAINNET_CAIP2);
      expect(signers).toEqual(["facilitator.near"]);
    });
  });

  describe("verify", () => {
    it("should verify a valid transaction", async () => {
      const facilitator = new ExactDirectNearFacilitator(mockSigner);

      const result = await facilitator.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(true);
      expect(result.payer).toBe("alice.near");
    });

    it("should reject invalid scheme", async () => {
      const facilitator = new ExactDirectNearFacilitator(mockSigner);

      const result = await facilitator.verify(
        makePayload({ scheme: "wrong" }),
        makeRequirements(),
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("invalid_scheme");
    });

    it("should reject network mismatch", async () => {
      const facilitator = new ExactDirectNearFacilitator(mockSigner);

      const result = await facilitator.verify(
        makePayload({ network: "near:testnet" }),
        makeRequirements(),
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("network_mismatch");
    });

    it("should reject missing txHash", async () => {
      const facilitator = new ExactDirectNearFacilitator(mockSigner);

      const payload: PaymentPayload = {
        t402Version: 2,
        accepted: {
          scheme: SCHEME_EXACT_DIRECT,
          network: NEAR_MAINNET_CAIP2,
        },
        payload: {
          txHash: "",
          from: "alice.near",
          to: "merchant.near",
          amount: "1000000",
        },
      };

      const result = await facilitator.verify(payload, makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("missing_tx_hash");
    });

    it("should reject invalid from address", async () => {
      const facilitator = new ExactDirectNearFacilitator(mockSigner);

      const result = await facilitator.verify(
        makePayload({ from: "X" }),
        makeRequirements(),
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("invalid_from_address");
    });

    it("should reject failed transaction", async () => {
      (mockSigner.queryTransaction as ReturnType<typeof vi.fn>).mockResolvedValue(
        buildMockTransaction({ succeeded: false }),
      );
      const facilitator = new ExactDirectNearFacilitator(mockSigner);

      const result = await facilitator.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("transaction_failed");
    });

    it("should reject wrong token contract", async () => {
      (mockSigner.queryTransaction as ReturnType<typeof vi.fn>).mockResolvedValue(
        buildMockTransaction({ receiverId: "wrong-contract.near" }),
      );
      const facilitator = new ExactDirectNearFacilitator(mockSigner);

      const result = await facilitator.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("wrong_token_contract");
    });

    it("should reject wrong recipient", async () => {
      (mockSigner.queryTransaction as ReturnType<typeof vi.fn>).mockResolvedValue(
        buildMockTransaction({ ftRecipient: "wrong-recipient.near" }),
      );
      const facilitator = new ExactDirectNearFacilitator(mockSigner);

      const result = await facilitator.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("wrong_recipient");
    });

    it("should reject insufficient amount", async () => {
      (mockSigner.queryTransaction as ReturnType<typeof vi.fn>).mockResolvedValue(
        buildMockTransaction({ ftAmount: "500000" }),
      );
      const facilitator = new ExactDirectNearFacilitator(mockSigner);

      const result = await facilitator.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("insufficient_amount");
    });

    it("should accept amount greater than required", async () => {
      (mockSigner.queryTransaction as ReturnType<typeof vi.fn>).mockResolvedValue(
        buildMockTransaction({ ftAmount: "2000000" }),
      );
      const facilitator = new ExactDirectNearFacilitator(mockSigner);

      const result = await facilitator.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(true);
    });

    it("should reject replayed transaction", async () => {
      const facilitator = new ExactDirectNearFacilitator(mockSigner);

      // First verify should succeed
      const first = await facilitator.verify(makePayload(), makeRequirements());
      expect(first.isValid).toBe(true);

      // Second verify with same txHash should fail
      const second = await facilitator.verify(makePayload(), makeRequirements());
      expect(second.isValid).toBe(false);
      expect(second.invalidReason).toBe("transaction_already_used");
    });

    it("should return transaction_not_found when query throws", async () => {
      (mockSigner.queryTransaction as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("RPC error"),
      );
      const facilitator = new ExactDirectNearFacilitator(mockSigner);

      const result = await facilitator.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("transaction_not_found");
    });
  });

  describe("settle", () => {
    it("should settle a valid transaction", async () => {
      const facilitator = new ExactDirectNearFacilitator(mockSigner);

      const result = await facilitator.settle(makePayload(), makeRequirements());

      expect(result.success).toBe(true);
      expect(result.transaction).toBe("9FtHUFBQsZ2MG77K3x3MJ9wjX3UT8zE4Bnv4RbdHJs3");
      expect(result.network).toBe(NEAR_MAINNET_CAIP2);
      expect(result.payer).toBe("alice.near");
    });

    it("should fail settlement if verification fails", async () => {
      const facilitator = new ExactDirectNearFacilitator(mockSigner);

      const result = await facilitator.settle(
        makePayload({ scheme: "wrong" }),
        makeRequirements(),
      );

      expect(result.success).toBe(false);
      expect(result.errorReason).toBe("invalid_scheme");
      expect(result.transaction).toBe("");
    });
  });
});
