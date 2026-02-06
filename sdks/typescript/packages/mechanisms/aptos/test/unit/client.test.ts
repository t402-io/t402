import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExactDirectAptosClient } from "../../src/exact-direct/client/scheme";
import type { ClientAptosSigner } from "../../src/types";
import type { PaymentRequirements } from "@t402/core/types";
import {
  APTOS_MAINNET_CAIP2,
  APTOS_TESTNET_CAIP2,
  SCHEME_EXACT_DIRECT,
} from "../../src/constants";

const USDT_METADATA =
  "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb";
const MOCK_TX_HASH =
  "0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1";

describe("ExactDirectAptosClient", () => {
  let mockSigner: ClientAptosSigner;

  beforeEach(() => {
    mockSigner = {
      getAddress: vi.fn().mockResolvedValue(
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      ),
      transfer: vi.fn().mockResolvedValue(MOCK_TX_HASH),
      getBalance: vi.fn().mockResolvedValue(BigInt(10000000)),
    };
  });

  describe("constructor", () => {
    it("should create instance with correct scheme", () => {
      const client = new ExactDirectAptosClient(mockSigner);
      expect(client.scheme).toBe(SCHEME_EXACT_DIRECT);
    });
  });

  describe("createPaymentPayload", () => {
    it("should create payment payload with txHash", async () => {
      const client = new ExactDirectAptosClient(mockSigner);

      const requirements: PaymentRequirements = {
        scheme: SCHEME_EXACT_DIRECT,
        network: APTOS_MAINNET_CAIP2,
        asset: `${APTOS_MAINNET_CAIP2}/fa:${USDT_METADATA}`,
        amount: "1000000",
        payTo: "0x00000000000000000000000000000000000000000000000000000000000000aa",
        maxTimeoutSeconds: 3600,
      };

      const result = await client.createPaymentPayload(2, requirements);

      expect(result.t402Version).toBe(2);
      expect(result.payload.txHash).toBe(MOCK_TX_HASH);
      expect(result.payload.from).toBe(
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      );
      expect(result.payload.to).toBe(requirements.payTo);
      expect(result.payload.amount).toBe("1000000");
      expect(result.payload.metadataAddress).toBe(USDT_METADATA);
    });

    it("should call transfer with correct arguments", async () => {
      const client = new ExactDirectAptosClient(mockSigner);

      const requirements: PaymentRequirements = {
        scheme: SCHEME_EXACT_DIRECT,
        network: APTOS_MAINNET_CAIP2,
        asset: `${APTOS_MAINNET_CAIP2}/fa:${USDT_METADATA}`,
        amount: "500000",
        payTo: "0x00000000000000000000000000000000000000000000000000000000000000bb",
        maxTimeoutSeconds: 3600,
      };

      await client.createPaymentPayload(2, requirements);

      expect(mockSigner.transfer).toHaveBeenCalledWith(
        requirements.payTo,
        USDT_METADATA,
        BigInt(500000),
      );
    });

    it("should throw for invalid scheme", async () => {
      const client = new ExactDirectAptosClient(mockSigner);

      const requirements: PaymentRequirements = {
        scheme: "wrong",
        network: APTOS_MAINNET_CAIP2,
        asset: `${APTOS_MAINNET_CAIP2}/fa:${USDT_METADATA}`,
        amount: "1000000",
        payTo: "0x00000000000000000000000000000000000000000000000000000000000000aa",
        maxTimeoutSeconds: 3600,
      };

      await expect(client.createPaymentPayload(2, requirements)).rejects.toThrow(
        "Invalid scheme",
      );
    });

    it("should throw for non-Aptos network", async () => {
      const client = new ExactDirectAptosClient(mockSigner);

      const requirements: PaymentRequirements = {
        scheme: SCHEME_EXACT_DIRECT,
        network: "eip155:1",
        asset: `${APTOS_MAINNET_CAIP2}/fa:${USDT_METADATA}`,
        amount: "1000000",
        payTo: "0x00000000000000000000000000000000000000000000000000000000000000aa",
        maxTimeoutSeconds: 3600,
      };

      await expect(client.createPaymentPayload(2, requirements)).rejects.toThrow(
        "Invalid network",
      );
    });

    it("should throw for invalid payTo address", async () => {
      const client = new ExactDirectAptosClient(mockSigner);

      const requirements: PaymentRequirements = {
        scheme: SCHEME_EXACT_DIRECT,
        network: APTOS_MAINNET_CAIP2,
        asset: `${APTOS_MAINNET_CAIP2}/fa:${USDT_METADATA}`,
        amount: "1000000",
        payTo: "not-a-valid-address",
        maxTimeoutSeconds: 3600,
      };

      await expect(client.createPaymentPayload(2, requirements)).rejects.toThrow(
        "Invalid payTo address",
      );
    });

    it("should throw for zero amount", async () => {
      const client = new ExactDirectAptosClient(mockSigner);

      const requirements: PaymentRequirements = {
        scheme: SCHEME_EXACT_DIRECT,
        network: APTOS_MAINNET_CAIP2,
        asset: `${APTOS_MAINNET_CAIP2}/fa:${USDT_METADATA}`,
        amount: "0",
        payTo: "0x00000000000000000000000000000000000000000000000000000000000000aa",
        maxTimeoutSeconds: 3600,
      };

      await expect(client.createPaymentPayload(2, requirements)).rejects.toThrow(
        "Invalid amount",
      );
    });

    it("should throw for insufficient balance", async () => {
      (mockSigner.getBalance as ReturnType<typeof vi.fn>).mockResolvedValue(BigInt(100));
      const client = new ExactDirectAptosClient(mockSigner);

      const requirements: PaymentRequirements = {
        scheme: SCHEME_EXACT_DIRECT,
        network: APTOS_MAINNET_CAIP2,
        asset: `${APTOS_MAINNET_CAIP2}/fa:${USDT_METADATA}`,
        amount: "1000000",
        payTo: "0x00000000000000000000000000000000000000000000000000000000000000aa",
        maxTimeoutSeconds: 3600,
      };

      await expect(client.createPaymentPayload(2, requirements)).rejects.toThrow(
        "Insufficient balance",
      );
    });

    it("should work with testnet network", async () => {
      const client = new ExactDirectAptosClient(mockSigner);

      const requirements: PaymentRequirements = {
        scheme: SCHEME_EXACT_DIRECT,
        network: APTOS_TESTNET_CAIP2,
        asset: `${APTOS_TESTNET_CAIP2}/fa:${USDT_METADATA}`,
        amount: "1000000",
        payTo: "0x00000000000000000000000000000000000000000000000000000000000000aa",
        maxTimeoutSeconds: 3600,
      };

      const result = await client.createPaymentPayload(2, requirements);
      expect(result.payload.txHash).toBe(MOCK_TX_HASH);
    });
  });
});
