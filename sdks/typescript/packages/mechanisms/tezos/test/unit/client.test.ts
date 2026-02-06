import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExactDirectTezosClient } from "../../src/exact-direct/client/scheme";
import type { TezosSigner } from "../../src/types";
import type { PaymentRequirements } from "@t402/core/types";
import { TEZOS_MAINNET_CAIP2, TEZOS_GHOSTNET_CAIP2, SCHEME_EXACT_DIRECT } from "../../src/constants";

const USDT_CONTRACT = "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o";
// Operation hashes start with 'o' and are 51 chars
const MOCK_OP_HASH = "oo7WES9FVCkbqP3zxq1bA5nK27EnDr1Hii1ZgNGGMqQUe7V9WaA";

describe("ExactDirectTezosClient", () => {
  let mockSigner: TezosSigner;

  beforeEach(() => {
    mockSigner = {
      getAddress: vi.fn().mockResolvedValue("tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb"),
      transfer: vi.fn().mockResolvedValue(MOCK_OP_HASH),
      getBalance: vi.fn().mockResolvedValue(BigInt(10000000)),
    };
  });

  describe("constructor", () => {
    it("should create instance with correct scheme", () => {
      const client = new ExactDirectTezosClient(mockSigner);
      expect(client.scheme).toBe(SCHEME_EXACT_DIRECT);
    });
  });

  describe("createPaymentPayload", () => {
    it("should create payment payload with opHash", async () => {
      const client = new ExactDirectTezosClient(mockSigner);

      const requirements: PaymentRequirements = {
        scheme: SCHEME_EXACT_DIRECT,
        network: TEZOS_MAINNET_CAIP2,
        asset: USDT_CONTRACT,
        amount: "1000000",
        payTo: "tz1burnburnburnburnburnburnburjAYjjX",
        maxTimeoutSeconds: 3600,
      };

      const result = await client.createPaymentPayload(2, requirements);

      expect(result.t402Version).toBe(2);
      expect(result.payload.opHash).toBe(MOCK_OP_HASH);
      expect(result.payload.from).toBe("tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb");
      expect(result.payload.to).toBe(requirements.payTo);
      expect(result.payload.amount).toBe("1000000");
      expect(result.payload.contractAddress).toBe(USDT_CONTRACT);
      expect(result.payload.tokenId).toBe(0);
    });

    it("should call transfer with correct arguments", async () => {
      const client = new ExactDirectTezosClient(mockSigner);

      const requirements: PaymentRequirements = {
        scheme: SCHEME_EXACT_DIRECT,
        network: TEZOS_MAINNET_CAIP2,
        asset: `${USDT_CONTRACT}/0`,
        amount: "500000",
        payTo: "tz1burnburnburnburnburnburnburjAYjjX",
        maxTimeoutSeconds: 3600,
      };

      await client.createPaymentPayload(2, requirements);

      expect(mockSigner.transfer).toHaveBeenCalledWith(
        USDT_CONTRACT,
        0,
        requirements.payTo,
        BigInt(500000),
      );
    });

    it("should parse CAIP-19 asset identifier", async () => {
      const client = new ExactDirectTezosClient(mockSigner);

      const requirements: PaymentRequirements = {
        scheme: SCHEME_EXACT_DIRECT,
        network: TEZOS_MAINNET_CAIP2,
        asset: `tezos:NetXdQprcVkpaWU/fa2:${USDT_CONTRACT}/0`,
        amount: "1000000",
        payTo: "tz1burnburnburnburnburnburnburjAYjjX",
        maxTimeoutSeconds: 3600,
      };

      const result = await client.createPaymentPayload(2, requirements);

      expect(result.payload.contractAddress).toBe(USDT_CONTRACT);
      expect(result.payload.tokenId).toBe(0);
    });

    it("should throw for invalid scheme", async () => {
      const client = new ExactDirectTezosClient(mockSigner);

      const requirements: PaymentRequirements = {
        scheme: "wrong",
        network: TEZOS_MAINNET_CAIP2,
        asset: USDT_CONTRACT,
        amount: "1000000",
        payTo: "tz1burnburnburnburnburnburnburjAYjjX",
        maxTimeoutSeconds: 3600,
      };

      await expect(client.createPaymentPayload(2, requirements)).rejects.toThrow(
        "Invalid scheme",
      );
    });

    it("should throw for non-Tezos network", async () => {
      const client = new ExactDirectTezosClient(mockSigner);

      const requirements: PaymentRequirements = {
        scheme: SCHEME_EXACT_DIRECT,
        network: "eip155:1",
        asset: USDT_CONTRACT,
        amount: "1000000",
        payTo: "tz1burnburnburnburnburnburnburjAYjjX",
        maxTimeoutSeconds: 3600,
      };

      await expect(client.createPaymentPayload(2, requirements)).rejects.toThrow(
        "Invalid network",
      );
    });

    it("should throw for invalid payTo address", async () => {
      const client = new ExactDirectTezosClient(mockSigner);

      const requirements: PaymentRequirements = {
        scheme: SCHEME_EXACT_DIRECT,
        network: TEZOS_MAINNET_CAIP2,
        asset: USDT_CONTRACT,
        amount: "1000000",
        payTo: "not-a-tezos-address",
        maxTimeoutSeconds: 3600,
      };

      await expect(client.createPaymentPayload(2, requirements)).rejects.toThrow(
        "Invalid payTo address",
      );
    });

    it("should throw for zero amount", async () => {
      const client = new ExactDirectTezosClient(mockSigner);

      const requirements: PaymentRequirements = {
        scheme: SCHEME_EXACT_DIRECT,
        network: TEZOS_MAINNET_CAIP2,
        asset: USDT_CONTRACT,
        amount: "0",
        payTo: "tz1burnburnburnburnburnburnburjAYjjX",
        maxTimeoutSeconds: 3600,
      };

      await expect(client.createPaymentPayload(2, requirements)).rejects.toThrow(
        "Invalid amount",
      );
    });

    it("should throw for insufficient balance", async () => {
      (mockSigner.getBalance as ReturnType<typeof vi.fn>).mockResolvedValue(BigInt(100));
      const client = new ExactDirectTezosClient(mockSigner);

      const requirements: PaymentRequirements = {
        scheme: SCHEME_EXACT_DIRECT,
        network: TEZOS_MAINNET_CAIP2,
        asset: USDT_CONTRACT,
        amount: "1000000",
        payTo: "tz1burnburnburnburnburnburnburjAYjjX",
        maxTimeoutSeconds: 3600,
      };

      await expect(client.createPaymentPayload(2, requirements)).rejects.toThrow(
        "Insufficient balance",
      );
    });

    it("should throw for invalid asset identifier", async () => {
      const client = new ExactDirectTezosClient(mockSigner);

      const requirements: PaymentRequirements = {
        scheme: SCHEME_EXACT_DIRECT,
        network: TEZOS_MAINNET_CAIP2,
        asset: "not-a-valid-asset",
        amount: "1000000",
        payTo: "tz1burnburnburnburnburnburnburjAYjjX",
        maxTimeoutSeconds: 3600,
      };

      await expect(client.createPaymentPayload(2, requirements)).rejects.toThrow(
        "Invalid asset",
      );
    });
  });
});
