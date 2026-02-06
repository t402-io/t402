import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExactDirectStacksFacilitator } from "../../src/exact-direct/facilitator/scheme";
import type { FacilitatorStacksSigner, StacksTransactionResult } from "../../src/types";
import type { PaymentPayload, PaymentRequirements } from "@t402/core/types";
import { STACKS_MAINNET_CAIP2, SCHEME_EXACT_DIRECT } from "../../src/constants";

const SUSDC_CONTRACT = "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc";
const MOCK_TX_ID =
  "0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1";
const VALID_SENDER = "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K";
const VALID_RECIPIENT = "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7";

function buildMockTransaction(overrides?: Partial<{
  txStatus: "success" | "abort_by_response" | "abort_by_post_condition" | "pending";
  senderAddress: string;
  contractId: string;
  functionName: string;
  transferSender: string;
  transferRecipient: string;
  transferAmount: string;
}>): StacksTransactionResult {
  const opts = {
    txStatus: "success" as const,
    senderAddress: VALID_SENDER,
    contractId: SUSDC_CONTRACT,
    functionName: "transfer",
    transferSender: VALID_SENDER,
    transferRecipient: VALID_RECIPIENT,
    transferAmount: "1000000",
    ...overrides,
  };

  return {
    txId: MOCK_TX_ID,
    txType: "contract_call",
    txStatus: opts.txStatus,
    blockHash: "0xblockhashblockhashblockhashblockhashblockhashblockhashblockhash",
    blockHeight: 100000,
    burnBlockTime: Math.floor(Date.now() / 1000),
    senderAddress: opts.senderAddress,
    contractCall: {
      contractId: opts.contractId,
      functionName: opts.functionName,
      functionArgs: [
        { hex: "0x01", repr: `u${opts.transferAmount}`, type: "uint" },
        { hex: "0x05", repr: `'${opts.transferSender}`, type: "principal" },
        { hex: "0x05", repr: `'${opts.transferRecipient}`, type: "principal" },
      ],
    },
    postConditionMode: "deny",
    postConditions: [],
    events: [
      {
        eventType: "fungible_token_asset",
        eventIndex: 0,
        asset: {
          assetEventType: "transfer",
          assetId: `${opts.contractId}::susdc`,
          sender: opts.transferSender,
          recipient: opts.transferRecipient,
          amount: opts.transferAmount,
        },
      },
    ],
  };
}

describe("ExactDirectStacksFacilitator", () => {
  let mockSigner: FacilitatorStacksSigner;

  beforeEach(() => {
    mockSigner = {
      getAddresses: vi.fn().mockReturnValue(["SP1FACILITATORADDRESSXXXXXXXXXXXXXXXXX"]),
      queryTransaction: vi.fn().mockResolvedValue(buildMockTransaction()),
    };
  });

  const makePayload = (overrides?: Partial<{
    scheme: string;
    network: string;
    txId: string;
    from: string;
  }>): PaymentPayload => ({
    t402Version: 2,
    accepted: {
      scheme: overrides?.scheme ?? SCHEME_EXACT_DIRECT,
      network: overrides?.network ?? STACKS_MAINNET_CAIP2,
    },
    payload: {
      txId: overrides?.txId ?? MOCK_TX_ID,
      from: overrides?.from ?? VALID_SENDER,
      to: VALID_RECIPIENT,
      amount: "1000000",
      contractAddress: SUSDC_CONTRACT,
    },
  });

  const makeRequirements = (overrides?: Partial<PaymentRequirements>): PaymentRequirements => ({
    scheme: SCHEME_EXACT_DIRECT,
    network: STACKS_MAINNET_CAIP2,
    asset: `${STACKS_MAINNET_CAIP2}/sip010:${SUSDC_CONTRACT}`,
    amount: "1000000",
    payTo: VALID_RECIPIENT,
    maxTimeoutSeconds: 3600,
    extra: { contractAddress: SUSDC_CONTRACT },
    ...overrides,
  });

  describe("constructor", () => {
    it("should create instance with correct scheme", () => {
      const facilitator = new ExactDirectStacksFacilitator(mockSigner);
      expect(facilitator.scheme).toBe(SCHEME_EXACT_DIRECT);
    });

    it("should have correct caipFamily", () => {
      const facilitator = new ExactDirectStacksFacilitator(mockSigner);
      expect(facilitator.caipFamily).toBe("stacks:*");
    });
  });

  describe("getSigners", () => {
    it("should return signer addresses for a network", () => {
      const facilitator = new ExactDirectStacksFacilitator(mockSigner);
      const signers = facilitator.getSigners(STACKS_MAINNET_CAIP2);
      expect(signers).toHaveLength(1);
    });
  });

  describe("verify", () => {
    it("should verify a valid transaction", async () => {
      const facilitator = new ExactDirectStacksFacilitator(mockSigner, {
        maxTransactionAge: 0, // Disable age check
      });

      const result = await facilitator.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(true);
      expect(result.payer).toBe(VALID_SENDER);
    });

    it("should reject invalid scheme", async () => {
      const facilitator = new ExactDirectStacksFacilitator(mockSigner);

      const result = await facilitator.verify(
        makePayload({ scheme: "wrong" }),
        makeRequirements(),
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toContain("invalid_scheme");
    });

    it("should reject network mismatch", async () => {
      const facilitator = new ExactDirectStacksFacilitator(mockSigner);

      const result = await facilitator.verify(
        makePayload({ network: "stacks:2147483648" }),
        makeRequirements(),
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toContain("network_mismatch");
    });

    it("should reject missing txId", async () => {
      const facilitator = new ExactDirectStacksFacilitator(mockSigner);

      const payload: PaymentPayload = {
        t402Version: 2,
        accepted: {
          scheme: SCHEME_EXACT_DIRECT,
          network: STACKS_MAINNET_CAIP2,
        },
        payload: {
          txId: "",
          from: VALID_SENDER,
          to: VALID_RECIPIENT,
          amount: "1000000",
          contractAddress: SUSDC_CONTRACT,
        },
      };

      const result = await facilitator.verify(payload, makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("missing_tx_id");
    });

    it("should reject invalid txId format", async () => {
      const facilitator = new ExactDirectStacksFacilitator(mockSigner);

      const result = await facilitator.verify(
        makePayload({ txId: "not-a-valid-tx-id" }),
        makeRequirements(),
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("invalid_tx_id_format");
    });

    it("should reject missing from address", async () => {
      const facilitator = new ExactDirectStacksFacilitator(mockSigner);

      const payload: PaymentPayload = {
        t402Version: 2,
        accepted: {
          scheme: SCHEME_EXACT_DIRECT,
          network: STACKS_MAINNET_CAIP2,
        },
        payload: {
          txId: MOCK_TX_ID,
          from: "",
          to: VALID_RECIPIENT,
          amount: "1000000",
          contractAddress: SUSDC_CONTRACT,
        },
      };

      const result = await facilitator.verify(payload, makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("missing_from_address");
    });

    it("should reject transaction not found", async () => {
      (mockSigner.queryTransaction as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const facilitator = new ExactDirectStacksFacilitator(mockSigner);

      const result = await facilitator.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("transaction_not_found");
    });

    it("should reject failed transaction", async () => {
      (mockSigner.queryTransaction as ReturnType<typeof vi.fn>).mockResolvedValue(
        buildMockTransaction({ txStatus: "abort_by_response" }),
      );
      const facilitator = new ExactDirectStacksFacilitator(mockSigner);

      const result = await facilitator.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toContain("transaction_failed");
    });

    it("should reject wrong recipient", async () => {
      (mockSigner.queryTransaction as ReturnType<typeof vi.fn>).mockResolvedValue(
        buildMockTransaction({ transferRecipient: "SPWRONGRECIPIENTXXXXXXXXXXXXXXXXXXXXXX" }),
      );
      const facilitator = new ExactDirectStacksFacilitator(mockSigner, {
        maxTransactionAge: 0,
      });

      const result = await facilitator.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toContain("recipient_mismatch");
    });

    it("should reject insufficient amount", async () => {
      (mockSigner.queryTransaction as ReturnType<typeof vi.fn>).mockResolvedValue(
        buildMockTransaction({ transferAmount: "500000" }),
      );
      const facilitator = new ExactDirectStacksFacilitator(mockSigner, {
        maxTransactionAge: 0,
      });

      const result = await facilitator.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toContain("insufficient_amount");
    });

    it("should accept amount greater than required", async () => {
      (mockSigner.queryTransaction as ReturnType<typeof vi.fn>).mockResolvedValue(
        buildMockTransaction({ transferAmount: "2000000" }),
      );
      const facilitator = new ExactDirectStacksFacilitator(mockSigner, {
        maxTransactionAge: 0,
      });

      const result = await facilitator.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(true);
    });

    it("should reject replayed transaction", async () => {
      const facilitator = new ExactDirectStacksFacilitator(mockSigner, {
        maxTransactionAge: 0,
      });

      const first = await facilitator.verify(makePayload(), makeRequirements());
      expect(first.isValid).toBe(true);

      const second = await facilitator.verify(makePayload(), makeRequirements());
      expect(second.isValid).toBe(false);
      expect(second.invalidReason).toBe("transaction_already_used");
    });

    it("should reject wrong contract address", async () => {
      // When contractId doesn't match, extractTokenTransfer returns null
      // because it filters by contractAddress, resulting in "not_token_transfer"
      (mockSigner.queryTransaction as ReturnType<typeof vi.fn>).mockResolvedValue(
        buildMockTransaction({
          contractId: "SPWRONG.wrong-token",
          transferSender: VALID_SENDER,
          transferRecipient: VALID_RECIPIENT,
        }),
      );
      const facilitator = new ExactDirectStacksFacilitator(mockSigner, {
        maxTransactionAge: 0,
      });

      const result = await facilitator.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("not_token_transfer");
    });
  });

  describe("settle", () => {
    it("should settle a valid transaction", async () => {
      const facilitator = new ExactDirectStacksFacilitator(mockSigner, {
        maxTransactionAge: 0,
      });

      const result = await facilitator.settle(makePayload(), makeRequirements());

      expect(result.success).toBe(true);
      expect(result.transaction).toBe(MOCK_TX_ID);
      expect(result.network).toBe(STACKS_MAINNET_CAIP2);
      expect(result.payer).toBe(VALID_SENDER);
    });

    it("should fail settlement if verification fails", async () => {
      const facilitator = new ExactDirectStacksFacilitator(mockSigner);

      const result = await facilitator.settle(
        makePayload({ scheme: "wrong" }),
        makeRequirements(),
      );

      expect(result.success).toBe(false);
      expect(result.errorReason).toContain("invalid_scheme");
      expect(result.transaction).toBe("");
    });
  });
});
