import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExactDirectAptosFacilitator } from "../../src/exact-direct/facilitator/scheme";
import type { FacilitatorAptosSigner, AptosTransactionResult } from "../../src/types";
import type { PaymentPayload, PaymentRequirements } from "@t402/core/types";
import { APTOS_MAINNET_CAIP2, SCHEME_EXACT_DIRECT, FA_TRANSFER_FUNCTION } from "../../src/constants";

const USDT_METADATA =
  "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb";
const MOCK_TX_HASH =
  "0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1";
const SENDER_ADDRESS =
  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
const RECIPIENT_ADDRESS =
  "0x00000000000000000000000000000000000000000000000000000000000000aa";

function buildMockTransaction(overrides?: Partial<{
  success: boolean;
  sender: string;
  to: string;
  metadataAddress: string;
  amount: string;
  vmStatus: string;
}>): AptosTransactionResult {
  const opts = {
    success: true,
    sender: SENDER_ADDRESS,
    to: RECIPIENT_ADDRESS,
    metadataAddress: USDT_METADATA,
    amount: "1000000",
    vmStatus: "Executed successfully",
    ...overrides,
  };

  return {
    hash: MOCK_TX_HASH,
    version: "123456",
    success: opts.success,
    vmStatus: opts.vmStatus,
    sender: opts.sender,
    sequenceNumber: "1",
    gasUsed: "100",
    timestamp: String(Date.now() * 1000), // microseconds
    payload: {
      type: "entry_function_payload",
      function: FA_TRANSFER_FUNCTION,
      typeArguments: [],
      arguments: [opts.metadataAddress, opts.to, opts.amount],
    },
    events: [],
  };
}

describe("ExactDirectAptosFacilitator", () => {
  let mockSigner: FacilitatorAptosSigner;

  beforeEach(() => {
    mockSigner = {
      getAddresses: vi.fn().mockReturnValue([
        "0xfacefacefacefacefacefacefacefacefacefacefacefacefacefacefaceface",
      ]),
      queryTransaction: vi.fn().mockResolvedValue(buildMockTransaction()),
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
      network: overrides?.network ?? APTOS_MAINNET_CAIP2,
    },
    payload: {
      txHash: overrides?.txHash ?? MOCK_TX_HASH,
      from: overrides?.from ?? SENDER_ADDRESS,
      to: RECIPIENT_ADDRESS,
      amount: "1000000",
      metadataAddress: USDT_METADATA,
    },
  });

  const makeRequirements = (overrides?: Partial<PaymentRequirements>): PaymentRequirements => ({
    scheme: SCHEME_EXACT_DIRECT,
    network: APTOS_MAINNET_CAIP2,
    asset: `${APTOS_MAINNET_CAIP2}/fa:${USDT_METADATA}`,
    amount: "1000000",
    payTo: RECIPIENT_ADDRESS,
    maxTimeoutSeconds: 3600,
    ...overrides,
  });

  describe("constructor", () => {
    it("should create instance with correct scheme", () => {
      const facilitator = new ExactDirectAptosFacilitator(mockSigner);
      expect(facilitator.scheme).toBe(SCHEME_EXACT_DIRECT);
    });

    it("should have correct caipFamily", () => {
      const facilitator = new ExactDirectAptosFacilitator(mockSigner);
      expect(facilitator.caipFamily).toBe("aptos:*");
    });
  });

  describe("getSigners", () => {
    it("should return signer addresses for a network", () => {
      const facilitator = new ExactDirectAptosFacilitator(mockSigner);
      const signers = facilitator.getSigners(APTOS_MAINNET_CAIP2);
      expect(signers).toHaveLength(1);
    });
  });

  describe("verify", () => {
    it("should verify a valid transaction", async () => {
      const facilitator = new ExactDirectAptosFacilitator(mockSigner, {
        maxTransactionAge: 0, // Disable age check for tests
      });

      const result = await facilitator.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(true);
      expect(result.payer).toBe(SENDER_ADDRESS);
    });

    it("should reject invalid scheme", async () => {
      const facilitator = new ExactDirectAptosFacilitator(mockSigner);

      const result = await facilitator.verify(
        makePayload({ scheme: "wrong" }),
        makeRequirements(),
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("invalid_scheme");
    });

    it("should reject non-Aptos network", async () => {
      const facilitator = new ExactDirectAptosFacilitator(mockSigner);

      const result = await facilitator.verify(
        makePayload({ network: "eip155:1" }),
        makeRequirements(),
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("invalid_network");
    });

    it("should reject invalid tx hash format", async () => {
      const facilitator = new ExactDirectAptosFacilitator(mockSigner);

      const result = await facilitator.verify(
        makePayload({ txHash: "not-a-valid-hash" }),
        makeRequirements(),
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("invalid_tx_hash_format");
    });

    it("should reject failed transaction", async () => {
      (mockSigner.queryTransaction as ReturnType<typeof vi.fn>).mockResolvedValue(
        buildMockTransaction({ success: false, vmStatus: "Move abort" }),
      );
      const facilitator = new ExactDirectAptosFacilitator(mockSigner, {
        maxTransactionAge: 0,
      });

      const result = await facilitator.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toContain("transaction_failed");
    });

    it("should reject transaction not found", async () => {
      (mockSigner.queryTransaction as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const facilitator = new ExactDirectAptosFacilitator(mockSigner);

      const result = await facilitator.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("transaction_not_found");
    });

    it("should reject wrong recipient", async () => {
      (mockSigner.queryTransaction as ReturnType<typeof vi.fn>).mockResolvedValue(
        buildMockTransaction({
          to: "0x00000000000000000000000000000000000000000000000000000000000000ff",
        }),
      );
      const facilitator = new ExactDirectAptosFacilitator(mockSigner, {
        maxTransactionAge: 0,
      });

      const result = await facilitator.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toContain("recipient_mismatch");
    });

    it("should reject wrong token (metadata address mismatch)", async () => {
      (mockSigner.queryTransaction as ReturnType<typeof vi.fn>).mockResolvedValue(
        buildMockTransaction({
          metadataAddress: "0xdead000000000000000000000000000000000000000000000000000000000000",
        }),
      );
      const facilitator = new ExactDirectAptosFacilitator(mockSigner, {
        maxTransactionAge: 0,
      });

      const result = await facilitator.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toContain("token_mismatch");
    });

    it("should reject insufficient amount", async () => {
      (mockSigner.queryTransaction as ReturnType<typeof vi.fn>).mockResolvedValue(
        buildMockTransaction({ amount: "500000" }),
      );
      const facilitator = new ExactDirectAptosFacilitator(mockSigner, {
        maxTransactionAge: 0,
      });

      const result = await facilitator.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toContain("insufficient_amount");
    });

    it("should accept amount greater than required", async () => {
      (mockSigner.queryTransaction as ReturnType<typeof vi.fn>).mockResolvedValue(
        buildMockTransaction({ amount: "2000000" }),
      );
      const facilitator = new ExactDirectAptosFacilitator(mockSigner, {
        maxTransactionAge: 0,
      });

      const result = await facilitator.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(true);
    });

    it("should reject replayed transaction", async () => {
      const facilitator = new ExactDirectAptosFacilitator(mockSigner, {
        maxTransactionAge: 0,
      });

      const first = await facilitator.verify(makePayload(), makeRequirements());
      expect(first.isValid).toBe(true);

      const second = await facilitator.verify(makePayload(), makeRequirements());
      expect(second.isValid).toBe(false);
      expect(second.invalidReason).toBe("transaction_already_used");
    });

    it("should handle query error gracefully", async () => {
      (mockSigner.queryTransaction as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("RPC error"),
      );
      const facilitator = new ExactDirectAptosFacilitator(mockSigner);

      const result = await facilitator.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toContain("verification_error");
    });
  });

  describe("settle", () => {
    it("should settle a valid transaction", async () => {
      const facilitator = new ExactDirectAptosFacilitator(mockSigner, {
        maxTransactionAge: 0,
      });

      const result = await facilitator.settle(makePayload(), makeRequirements());

      expect(result.success).toBe(true);
      expect(result.transaction).toBe(MOCK_TX_HASH);
      expect(result.network).toBe(APTOS_MAINNET_CAIP2);
      expect(result.payer).toBe(SENDER_ADDRESS);
    });

    it("should fail settlement if verification fails", async () => {
      const facilitator = new ExactDirectAptosFacilitator(mockSigner);

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
