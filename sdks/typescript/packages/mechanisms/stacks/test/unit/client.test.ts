import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExactDirectStacksClient } from "../../src/exact-direct/client/scheme";
import type { ClientStacksSigner } from "../../src/types";
import type { PaymentRequirements } from "@t402/core/types";
import {
  STACKS_MAINNET_CAIP2,
  STACKS_TESTNET_CAIP2,
  SCHEME_EXACT_DIRECT,
} from "../../src/constants";

const SUSDC_CONTRACT = "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc";
const MOCK_TX_ID =
  "0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1";
const VALID_SENDER = "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K";
const VALID_RECIPIENT = "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7";

describe("ExactDirectStacksClient", () => {
  let mockSigner: ClientStacksSigner;

  beforeEach(() => {
    mockSigner = {
      getAddress: vi.fn().mockResolvedValue(VALID_SENDER),
      transferToken: vi.fn().mockResolvedValue({ txId: MOCK_TX_ID }),
    };
  });

  describe("constructor", () => {
    it("should create instance with correct scheme", () => {
      const client = new ExactDirectStacksClient({ signer: mockSigner });
      expect(client.scheme).toBe(SCHEME_EXACT_DIRECT);
    });
  });

  describe("createPaymentPayload", () => {
    it("should create payment payload with txId", async () => {
      const client = new ExactDirectStacksClient({ signer: mockSigner });

      const requirements: PaymentRequirements = {
        scheme: SCHEME_EXACT_DIRECT,
        network: STACKS_MAINNET_CAIP2,
        asset: "USDC",
        amount: "1000000",
        payTo: VALID_RECIPIENT,
        maxTimeoutSeconds: 3600,
        extra: { contractAddress: SUSDC_CONTRACT, assetSymbol: "sUSDC" },
      };

      const result = await client.createPaymentPayload(2, requirements);

      expect(result.t402Version).toBe(2);
      expect(result.payload.txId).toBe(MOCK_TX_ID);
      expect(result.payload.from).toBe(VALID_SENDER);
      expect(result.payload.to).toBe(VALID_RECIPIENT);
      expect(result.payload.amount).toBe("1000000");
      expect(result.payload.contractAddress).toBe(SUSDC_CONTRACT);
    });

    it("should call transferToken with correct arguments", async () => {
      const client = new ExactDirectStacksClient({ signer: mockSigner });

      const requirements: PaymentRequirements = {
        scheme: SCHEME_EXACT_DIRECT,
        network: STACKS_MAINNET_CAIP2,
        asset: "USDC",
        amount: "500000",
        payTo: VALID_RECIPIENT,
        maxTimeoutSeconds: 3600,
        extra: { contractAddress: SUSDC_CONTRACT },
      };

      await client.createPaymentPayload(2, requirements);

      expect(mockSigner.transferToken).toHaveBeenCalledWith(
        SUSDC_CONTRACT,
        VALID_RECIPIENT,
        "500000",
      );
    });

    it("should use default sUSDC contract from token registry", async () => {
      const client = new ExactDirectStacksClient({ signer: mockSigner });

      const requirements: PaymentRequirements = {
        scheme: SCHEME_EXACT_DIRECT,
        network: STACKS_MAINNET_CAIP2,
        asset: "USDC",
        amount: "1000000",
        payTo: VALID_RECIPIENT,
        maxTimeoutSeconds: 3600,
      };

      const result = await client.createPaymentPayload(2, requirements);

      // Uses default sUSDC from token registry
      expect(result.payload.contractAddress).toBe(SUSDC_CONTRACT);
    });

    it("should throw for invalid scheme", async () => {
      const client = new ExactDirectStacksClient({ signer: mockSigner });

      const requirements: PaymentRequirements = {
        scheme: "wrong",
        network: STACKS_MAINNET_CAIP2,
        asset: "USDC",
        amount: "1000000",
        payTo: VALID_RECIPIENT,
        maxTimeoutSeconds: 3600,
      };

      await expect(client.createPaymentPayload(2, requirements)).rejects.toThrow(
        "Invalid scheme",
      );
    });

    it("should throw for non-Stacks network", async () => {
      const client = new ExactDirectStacksClient({ signer: mockSigner });

      const requirements: PaymentRequirements = {
        scheme: SCHEME_EXACT_DIRECT,
        network: "eip155:1",
        asset: "USDC",
        amount: "1000000",
        payTo: VALID_RECIPIENT,
        maxTimeoutSeconds: 3600,
      };

      await expect(client.createPaymentPayload(2, requirements)).rejects.toThrow(
        "Invalid network",
      );
    });

    it("should throw for invalid payTo address", async () => {
      const client = new ExactDirectStacksClient({ signer: mockSigner });

      const requirements: PaymentRequirements = {
        scheme: SCHEME_EXACT_DIRECT,
        network: STACKS_MAINNET_CAIP2,
        asset: "USDC",
        amount: "1000000",
        payTo: "not-a-valid-principal",
        maxTimeoutSeconds: 3600,
      };

      await expect(client.createPaymentPayload(2, requirements)).rejects.toThrow(
        "Invalid payTo address",
      );
    });

    it("should throw for zero amount", async () => {
      const client = new ExactDirectStacksClient({ signer: mockSigner });

      const requirements: PaymentRequirements = {
        scheme: SCHEME_EXACT_DIRECT,
        network: STACKS_MAINNET_CAIP2,
        asset: "USDC",
        amount: "0",
        payTo: VALID_RECIPIENT,
        maxTimeoutSeconds: 3600,
      };

      await expect(client.createPaymentPayload(2, requirements)).rejects.toThrow(
        "Invalid amount",
      );
    });

    it("should work with testnet", async () => {
      const client = new ExactDirectStacksClient({ signer: mockSigner });

      const requirements: PaymentRequirements = {
        scheme: SCHEME_EXACT_DIRECT,
        network: STACKS_TESTNET_CAIP2,
        asset: "USDC",
        amount: "1000000",
        payTo: "ST2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQYAC0RQ",
        maxTimeoutSeconds: 3600,
      };

      const result = await client.createPaymentPayload(2, requirements);
      expect(result.payload.txId).toBe(MOCK_TX_ID);
    });
  });
});
