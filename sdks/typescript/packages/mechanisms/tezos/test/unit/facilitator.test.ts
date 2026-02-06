import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExactDirectTezosFacilitator } from "../../src/exact-direct/facilitator/scheme";
import type { FacilitatorTezosSigner, TezosOperationResult } from "../../src/types";
import type { PaymentPayload, PaymentRequirements } from "@t402/core/types";
import { TEZOS_MAINNET_CAIP2, SCHEME_EXACT_DIRECT } from "../../src/constants";

const USDT_CONTRACT = "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o";
const MOCK_OP_HASH = "oo7WES9FVCkbqP3zxq1bA5nK27EnDr1Hii1ZgNGGMqQUe7V9WaA";
const SENDER_ADDRESS = "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb";
const RECIPIENT_ADDRESS = "tz1burnburnburnburnburnburnburjAYjjX";

function buildMockOperation(overrides?: Partial<{
  status: "applied" | "failed" | "backtracked" | "skipped";
  senderAddress: string;
  targetAddress: string;
  entrypoint: string;
  paramFrom: string;
  paramTo: string;
  paramTokenId: number;
  paramAmount: string;
}>): TezosOperationResult {
  const opts = {
    status: "applied" as const,
    senderAddress: SENDER_ADDRESS,
    targetAddress: USDT_CONTRACT,
    entrypoint: "transfer",
    paramFrom: SENDER_ADDRESS,
    paramTo: RECIPIENT_ADDRESS,
    paramTokenId: 0,
    paramAmount: "1000000",
    ...overrides,
  };

  return {
    hash: MOCK_OP_HASH,
    level: 1234567,
    timestamp: new Date().toISOString(),
    status: opts.status,
    sender: { address: opts.senderAddress },
    target: { address: opts.targetAddress },
    entrypoint: opts.entrypoint,
    parameter: [
      {
        from_: opts.paramFrom,
        txs: [
          {
            to_: opts.paramTo,
            token_id: opts.paramTokenId,
            amount: opts.paramAmount,
          },
        ],
      },
    ],
  };
}

describe("ExactDirectTezosFacilitator", () => {
  let mockSigner: FacilitatorTezosSigner;

  beforeEach(() => {
    mockSigner = {
      getAddresses: vi.fn().mockReturnValue(["tz1FacilitatorFakeAddressXXXXXXXXXX"]),
      queryOperation: vi.fn().mockResolvedValue(buildMockOperation()),
      getBalance: vi.fn().mockResolvedValue("10000000"),
    };
  });

  const makePayload = (overrides?: Partial<{
    scheme: string;
    network: string;
    opHash: string;
    from: string;
  }>): PaymentPayload => ({
    t402Version: 2,
    accepted: {
      scheme: overrides?.scheme ?? SCHEME_EXACT_DIRECT,
      network: overrides?.network ?? TEZOS_MAINNET_CAIP2,
    },
    payload: {
      opHash: overrides?.opHash ?? MOCK_OP_HASH,
      from: overrides?.from ?? SENDER_ADDRESS,
      to: RECIPIENT_ADDRESS,
      amount: "1000000",
      contractAddress: USDT_CONTRACT,
      tokenId: 0,
    },
  });

  const makeRequirements = (overrides?: Partial<PaymentRequirements>): PaymentRequirements => ({
    scheme: SCHEME_EXACT_DIRECT,
    network: TEZOS_MAINNET_CAIP2,
    asset: USDT_CONTRACT,
    amount: "1000000",
    payTo: RECIPIENT_ADDRESS,
    maxTimeoutSeconds: 3600,
    ...overrides,
  });

  describe("constructor", () => {
    it("should create instance with correct scheme", () => {
      const facilitator = new ExactDirectTezosFacilitator(mockSigner);
      expect(facilitator.scheme).toBe(SCHEME_EXACT_DIRECT);
    });

    it("should have correct caipFamily", () => {
      const facilitator = new ExactDirectTezosFacilitator(mockSigner);
      expect(facilitator.caipFamily).toBe("tezos:*");
    });
  });

  describe("getSigners", () => {
    it("should return signer addresses for a network", () => {
      const facilitator = new ExactDirectTezosFacilitator(mockSigner);
      const signers = facilitator.getSigners(TEZOS_MAINNET_CAIP2);
      expect(signers).toHaveLength(1);
    });
  });

  describe("verify", () => {
    it("should verify a valid operation", async () => {
      const facilitator = new ExactDirectTezosFacilitator(mockSigner, {
        maxOperationAge: 0, // Disable age check
      });

      const result = await facilitator.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(true);
      expect(result.payer).toBe(SENDER_ADDRESS);
    });

    it("should reject invalid scheme", async () => {
      const facilitator = new ExactDirectTezosFacilitator(mockSigner);

      const result = await facilitator.verify(
        makePayload({ scheme: "wrong" }),
        makeRequirements(),
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("invalid_scheme");
    });

    it("should reject non-Tezos network", async () => {
      const facilitator = new ExactDirectTezosFacilitator(mockSigner);

      const result = await facilitator.verify(
        makePayload({ network: "eip155:1" }),
        makeRequirements(),
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("invalid_network");
    });

    it("should reject invalid operation hash format", async () => {
      const facilitator = new ExactDirectTezosFacilitator(mockSigner);

      const result = await facilitator.verify(
        makePayload({ opHash: "not-valid" }),
        makeRequirements(),
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("invalid_operation_hash_format");
    });

    it("should reject operation not found", async () => {
      (mockSigner.queryOperation as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const facilitator = new ExactDirectTezosFacilitator(mockSigner);

      const result = await facilitator.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("operation_not_found");
    });

    it("should reject failed operation", async () => {
      (mockSigner.queryOperation as ReturnType<typeof vi.fn>).mockResolvedValue(
        buildMockOperation({ status: "failed" }),
      );
      const facilitator = new ExactDirectTezosFacilitator(mockSigner);

      const result = await facilitator.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toContain("operation_not_applied");
    });

    it("should reject wrong contract address", async () => {
      (mockSigner.queryOperation as ReturnType<typeof vi.fn>).mockResolvedValue(
        buildMockOperation({ targetAddress: "KT1WrongContractAddressXXXXXXXXXXX" }),
      );
      const facilitator = new ExactDirectTezosFacilitator(mockSigner, {
        maxOperationAge: 0,
      });

      const result = await facilitator.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toContain("contract_mismatch");
    });

    it("should reject wrong entrypoint", async () => {
      (mockSigner.queryOperation as ReturnType<typeof vi.fn>).mockResolvedValue(
        buildMockOperation({ entrypoint: "approve" }),
      );
      const facilitator = new ExactDirectTezosFacilitator(mockSigner, {
        maxOperationAge: 0,
      });

      const result = await facilitator.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toContain("entrypoint_mismatch");
    });

    it("should reject wrong recipient", async () => {
      (mockSigner.queryOperation as ReturnType<typeof vi.fn>).mockResolvedValue(
        buildMockOperation({ paramTo: "tz1WrongRecipientAddressXXXXXXXXXXX" }),
      );
      const facilitator = new ExactDirectTezosFacilitator(mockSigner, {
        maxOperationAge: 0,
      });

      const result = await facilitator.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toContain("recipient_mismatch");
    });

    it("should reject insufficient amount", async () => {
      (mockSigner.queryOperation as ReturnType<typeof vi.fn>).mockResolvedValue(
        buildMockOperation({ paramAmount: "500000" }),
      );
      const facilitator = new ExactDirectTezosFacilitator(mockSigner, {
        maxOperationAge: 0,
      });

      const result = await facilitator.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toContain("insufficient_amount");
    });

    it("should accept amount greater than required", async () => {
      (mockSigner.queryOperation as ReturnType<typeof vi.fn>).mockResolvedValue(
        buildMockOperation({ paramAmount: "2000000" }),
      );
      const facilitator = new ExactDirectTezosFacilitator(mockSigner, {
        maxOperationAge: 0,
      });

      const result = await facilitator.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(true);
    });

    it("should reject wrong token ID", async () => {
      (mockSigner.queryOperation as ReturnType<typeof vi.fn>).mockResolvedValue(
        buildMockOperation({ paramTokenId: 5 }),
      );
      const facilitator = new ExactDirectTezosFacilitator(mockSigner, {
        maxOperationAge: 0,
      });

      const result = await facilitator.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toContain("token_id_mismatch");
    });

    it("should reject replayed operation", async () => {
      const facilitator = new ExactDirectTezosFacilitator(mockSigner, {
        maxOperationAge: 0,
      });

      const first = await facilitator.verify(makePayload(), makeRequirements());
      expect(first.isValid).toBe(true);

      const second = await facilitator.verify(makePayload(), makeRequirements());
      expect(second.isValid).toBe(false);
      expect(second.invalidReason).toBe("operation_already_used");
    });

    it("should handle query error gracefully", async () => {
      (mockSigner.queryOperation as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Indexer error"),
      );
      const facilitator = new ExactDirectTezosFacilitator(mockSigner);

      const result = await facilitator.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toContain("verification_error");
    });
  });

  describe("settle", () => {
    it("should settle a valid operation", async () => {
      const facilitator = new ExactDirectTezosFacilitator(mockSigner, {
        maxOperationAge: 0,
      });

      const result = await facilitator.settle(makePayload(), makeRequirements());

      expect(result.success).toBe(true);
      expect(result.transaction).toBe(MOCK_OP_HASH);
      expect(result.network).toBe(TEZOS_MAINNET_CAIP2);
      expect(result.payer).toBe(SENDER_ADDRESS);
    });

    it("should fail settlement if verification fails", async () => {
      const facilitator = new ExactDirectTezosFacilitator(mockSigner);

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
