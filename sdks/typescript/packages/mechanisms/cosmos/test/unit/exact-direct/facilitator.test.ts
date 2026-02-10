import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExactDirectCosmosFacilitator } from "../../../src/exact-direct/facilitator/scheme";
import type { FacilitatorCosmosSigner, TransactionResult } from "../../../src/types";
import type { PaymentPayload, PaymentRequirements } from "@t402/core/types";

describe("ExactDirectCosmosFacilitator", () => {
  const createMockTransaction = (
    overrides: Partial<TransactionResult> = {},
  ): TransactionResult => ({
    txHash: "TX_HASH_ABC123DEF456",
    height: "12345",
    code: 0,
    rawLog: "[]",
    gasWanted: "200000",
    gasUsed: "150000",
    timestamp: "2026-01-01T00:00:00Z",
    tx: {
      body: {
        messages: [
          {
            "@type": "/cosmos.bank.v1beta1.MsgSend",
            fromAddress: "noble1sender123456789abcdef",
            toAddress: "noble1recipient456789abcdef012",
            amount: [{ denom: "uusdc", amount: "1000000" }],
          },
        ],
        memo: "",
      },
    },
    ...overrides,
  });

  const createMockSigner = (): FacilitatorCosmosSigner => ({
    getAddresses: vi.fn().mockReturnValue(["noble1facilitator789abcdefgh"]),
    queryTransaction: vi.fn().mockResolvedValue(createMockTransaction()),
    getBalance: vi.fn().mockResolvedValue(BigInt("10000000")),
  });

  const createPayload = (overrides: Partial<PaymentPayload> = {}): PaymentPayload => ({
    t402Version: 2,
    accepted: {
      scheme: "exact-direct",
      network: "cosmos:noble-1",
      asset: "uusdc",
      amount: "1000000",
      payTo: "noble1recipient456789abcdef012",
      maxTimeoutSeconds: 3600,
      extra: {},
    },
    payload: {
      txHash: "TX_HASH_ABC123DEF456",
      from: "noble1sender123456789abcdef",
      to: "noble1recipient456789abcdef012",
      amount: "1000000",
      denom: "uusdc",
    },
    ...overrides,
  });

  const createRequirements = (
    overrides: Partial<PaymentRequirements> = {},
  ): PaymentRequirements => ({
    scheme: "exact-direct",
    network: "cosmos:noble-1",
    asset: "uusdc",
    amount: "1000000",
    payTo: "noble1recipient456789abcdef012",
    maxTimeoutSeconds: 3600,
    extra: { denom: "uusdc" },
    ...overrides,
  });

  let signer: FacilitatorCosmosSigner;
  let facilitator: ExactDirectCosmosFacilitator;

  beforeEach(() => {
    signer = createMockSigner();
    facilitator = new ExactDirectCosmosFacilitator(signer);
  });

  describe("scheme and caipFamily properties", () => {
    it("should have correct scheme", () => {
      expect(facilitator.scheme).toBe("exact-direct");
    });

    it("should have correct caipFamily", () => {
      expect(facilitator.caipFamily).toBe("cosmos:*");
    });
  });

  describe("getExtra", () => {
    it("should return token info for supported network", () => {
      const extra = facilitator.getExtra("cosmos:noble-1");
      expect(extra).toBeDefined();
      expect(extra?.assetSymbol).toBe("USDC");
      expect(extra?.assetDecimals).toBe(6);
      expect(extra?.assetDenom).toBe("uusdc");
    });

    it("should return undefined for unsupported network", () => {
      const extra = facilitator.getExtra("cosmos:unknown" as `${string}:${string}`);
      expect(extra).toBeUndefined();
    });
  });

  describe("getSigners", () => {
    it("should delegate to signer", () => {
      const signers = facilitator.getSigners("cosmos:noble-1");
      expect(signers).toEqual(["noble1facilitator789abcdefgh"]);
      expect(signer.getAddresses).toHaveBeenCalledWith("cosmos:noble-1");
    });
  });

  describe("verify", () => {
    it("should verify a valid transaction", async () => {
      const result = await facilitator.verify(createPayload(), createRequirements());

      expect(result.isValid).toBe(true);
      expect(result.payer).toBe("noble1sender123456789abcdef");
    });

    it("should reject invalid scheme", async () => {
      const payload = createPayload({
        accepted: {
          scheme: "wrong-scheme",
          network: "cosmos:noble-1",
          asset: "uusdc",
          amount: "1000000",
          payTo: "noble1recipient456789abcdef012",
          maxTimeoutSeconds: 3600,
          extra: {},
        },
      });

      const result = await facilitator.verify(payload, createRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("invalid_scheme");
    });

    it("should reject network mismatch", async () => {
      const payload = createPayload({
        accepted: {
          scheme: "exact-direct",
          network: "cosmos:grand-1",
          asset: "uusdc",
          amount: "1000000",
          payTo: "noble1recipient456789abcdef012",
          maxTimeoutSeconds: 3600,
          extra: {},
        },
      });

      const result = await facilitator.verify(payload, createRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("network_mismatch");
    });

    it("should reject missing tx hash", async () => {
      const payload = createPayload({
        payload: {
          txHash: "",
          from: "noble1sender123456789abcdef",
          to: "noble1recipient456789abcdef012",
          amount: "1000000",
        },
      });

      const result = await facilitator.verify(payload, createRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("missing_tx_hash");
    });

    it("should reject invalid from address", async () => {
      const payload = createPayload({
        payload: {
          txHash: "TX_HASH_ABC123DEF456",
          from: "invalid",
          to: "noble1recipient456789abcdef012",
          amount: "1000000",
        },
      });

      const result = await facilitator.verify(payload, createRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("invalid_from_address");
    });

    it("should reject replay attacks (transaction already used)", async () => {
      const payload = createPayload();
      const requirements = createRequirements();

      // First verification should succeed
      const result1 = await facilitator.verify(payload, requirements);
      expect(result1.isValid).toBe(true);

      // Second verification with same tx should fail
      const result2 = await facilitator.verify(payload, requirements);
      expect(result2.isValid).toBe(false);
      expect(result2.invalidReason).toBe("transaction_already_used");
    });

    it("should reject failed transactions", async () => {
      (signer.queryTransaction as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockTransaction({ code: 5, rawLog: "insufficient funds" }),
      );

      const result = await facilitator.verify(createPayload(), createRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("transaction_failed");
    });

    it("should reject wrong recipient", async () => {
      (signer.queryTransaction as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockTransaction({
          tx: {
            body: {
              messages: [
                {
                  "@type": "/cosmos.bank.v1beta1.MsgSend",
                  fromAddress: "noble1sender123456789abcdef",
                  toAddress: "noble1wrongrecipient123456789",
                  amount: [{ denom: "uusdc", amount: "1000000" }],
                },
              ],
              memo: "",
            },
          },
        }),
      );

      const result = await facilitator.verify(createPayload(), createRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("wrong_recipient");
    });

    it("should reject sender mismatch", async () => {
      (signer.queryTransaction as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockTransaction({
          tx: {
            body: {
              messages: [
                {
                  "@type": "/cosmos.bank.v1beta1.MsgSend",
                  fromAddress: "noble1differentsender123456",
                  toAddress: "noble1recipient456789abcdef012",
                  amount: [{ denom: "uusdc", amount: "1000000" }],
                },
              ],
              memo: "",
            },
          },
        }),
      );

      const result = await facilitator.verify(createPayload(), createRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("sender_mismatch");
    });

    it("should reject insufficient amount", async () => {
      (signer.queryTransaction as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockTransaction({
          tx: {
            body: {
              messages: [
                {
                  "@type": "/cosmos.bank.v1beta1.MsgSend",
                  fromAddress: "noble1sender123456789abcdef",
                  toAddress: "noble1recipient456789abcdef012",
                  amount: [{ denom: "uusdc", amount: "500000" }],
                },
              ],
              memo: "",
            },
          },
        }),
      );

      const result = await facilitator.verify(createPayload(), createRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("insufficient_amount");
    });

    it("should accept amount greater than required", async () => {
      (signer.queryTransaction as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockTransaction({
          tx: {
            body: {
              messages: [
                {
                  "@type": "/cosmos.bank.v1beta1.MsgSend",
                  fromAddress: "noble1sender123456789abcdef",
                  toAddress: "noble1recipient456789abcdef012",
                  amount: [{ denom: "uusdc", amount: "2000000" }],
                },
              ],
              memo: "",
            },
          },
        }),
      );

      const result = await facilitator.verify(createPayload(), createRequirements());

      expect(result.isValid).toBe(true);
    });

    it("should reject wrong denomination", async () => {
      (signer.queryTransaction as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockTransaction({
          tx: {
            body: {
              messages: [
                {
                  "@type": "/cosmos.bank.v1beta1.MsgSend",
                  fromAddress: "noble1sender123456789abcdef",
                  toAddress: "noble1recipient456789abcdef012",
                  amount: [{ denom: "uatom", amount: "1000000" }],
                },
              ],
              memo: "",
            },
          },
        }),
      );

      const result = await facilitator.verify(createPayload(), createRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("wrong_denomination");
    });

    it("should reject when no MsgSend found", async () => {
      (signer.queryTransaction as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockTransaction({
          tx: {
            body: {
              messages: [],
              memo: "",
            },
          },
        }),
      );

      const result = await facilitator.verify(createPayload(), createRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("no_msg_send_found");
    });

    it("should handle transaction query errors", async () => {
      (signer.queryTransaction as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("RPC error"),
      );

      const result = await facilitator.verify(createPayload(), createRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("transaction_not_found");
    });

    it("should find MsgSend without @type field", async () => {
      (signer.queryTransaction as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockTransaction({
          tx: {
            body: {
              messages: [
                {
                  fromAddress: "noble1sender123456789abcdef",
                  toAddress: "noble1recipient456789abcdef012",
                  amount: [{ denom: "uusdc", amount: "1000000" }],
                },
              ],
              memo: "",
            },
          },
        }),
      );

      const result = await facilitator.verify(createPayload(), createRequirements());

      expect(result.isValid).toBe(true);
    });
  });

  describe("settle", () => {
    it("should settle a valid payment", async () => {
      const result = await facilitator.settle(createPayload(), createRequirements());

      expect(result.success).toBe(true);
      expect(result.transaction).toBe("TX_HASH_ABC123DEF456");
      expect(result.network).toBe("cosmos:noble-1");
      expect(result.payer).toBe("noble1sender123456789abcdef");
    });

    it("should fail settlement if verification fails", async () => {
      (signer.queryTransaction as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockTransaction({ code: 5 }),
      );

      const result = await facilitator.settle(createPayload(), createRequirements());

      expect(result.success).toBe(false);
      expect(result.errorReason).toBe("transaction_failed");
    });

    it("should return correct network in settlement response", async () => {
      const result = await facilitator.settle(createPayload(), createRequirements());

      expect(result.network).toBe("cosmos:noble-1");
    });
  });
});
