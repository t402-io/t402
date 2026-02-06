import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExactDirectPolkadotClient } from "../../src/exact-direct/client/scheme";
import type { ClientPolkadotSigner } from "../../src/types";
import type { PaymentRequirements } from "@t402/core/types";
import {
  POLKADOT_ASSET_HUB_CAIP2,
  WESTEND_ASSET_HUB_CAIP2,
  SCHEME_EXACT_DIRECT,
} from "../../src/constants";

const MOCK_EXTRINSIC_HASH =
  "0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1";
const MOCK_BLOCK_HASH =
  "0xdef456abc123def456abc123def456abc123def456abc123def456abc123def4";
// Valid SS58 address (47 chars, base58)
const VALID_ADDRESS = "15oF4uVJwmo4TdGW7VfQxNLavjCXviqWrztPu6TRSPQnQVkR";
const VALID_PAYTO = "14E5nqKAp3oAJcg6ymCbet8zoYGBnP4y54P3LJ3RhMhQXt2R";

describe("ExactDirectPolkadotClient", () => {
  let mockSigner: ClientPolkadotSigner;

  beforeEach(() => {
    mockSigner = {
      getAddress: vi.fn().mockResolvedValue(VALID_ADDRESS),
      transferAsset: vi.fn().mockResolvedValue({
        extrinsicHash: MOCK_EXTRINSIC_HASH,
        blockHash: MOCK_BLOCK_HASH,
        extrinsicIndex: 2,
      }),
    };
  });

  describe("constructor", () => {
    it("should create instance with correct scheme", () => {
      const client = new ExactDirectPolkadotClient({ signer: mockSigner });
      expect(client.scheme).toBe(SCHEME_EXACT_DIRECT);
    });
  });

  describe("createPaymentPayload", () => {
    it("should create payment payload with extrinsic details", async () => {
      const client = new ExactDirectPolkadotClient({ signer: mockSigner });

      const requirements: PaymentRequirements = {
        scheme: SCHEME_EXACT_DIRECT,
        network: POLKADOT_ASSET_HUB_CAIP2,
        asset: "USDT",
        amount: "1000000",
        payTo: VALID_PAYTO,
        maxTimeoutSeconds: 3600,
        extra: { assetId: 1984, assetSymbol: "USDT" },
      };

      const result = await client.createPaymentPayload(2, requirements);

      expect(result.t402Version).toBe(2);
      expect(result.payload.extrinsicHash).toBe(MOCK_EXTRINSIC_HASH);
      expect(result.payload.blockHash).toBe(MOCK_BLOCK_HASH);
      expect(result.payload.extrinsicIndex).toBe(2);
      expect(result.payload.from).toBe(VALID_ADDRESS);
      expect(result.payload.to).toBe(VALID_PAYTO);
      expect(result.payload.amount).toBe("1000000");
      expect(result.payload.assetId).toBe(1984);
    });

    it("should call transferAsset with correct arguments", async () => {
      const client = new ExactDirectPolkadotClient({ signer: mockSigner });

      const requirements: PaymentRequirements = {
        scheme: SCHEME_EXACT_DIRECT,
        network: POLKADOT_ASSET_HUB_CAIP2,
        asset: "USDT",
        amount: "500000",
        payTo: VALID_PAYTO,
        maxTimeoutSeconds: 3600,
        extra: { assetId: 1984 },
      };

      await client.createPaymentPayload(2, requirements);

      expect(mockSigner.transferAsset).toHaveBeenCalledWith(
        1984,
        VALID_PAYTO,
        "500000",
      );
    });

    it("should use default USDT asset ID from registry", async () => {
      const client = new ExactDirectPolkadotClient({ signer: mockSigner });

      const requirements: PaymentRequirements = {
        scheme: SCHEME_EXACT_DIRECT,
        network: POLKADOT_ASSET_HUB_CAIP2,
        asset: "USDT",
        amount: "1000000",
        payTo: VALID_PAYTO,
        maxTimeoutSeconds: 3600,
      };

      const result = await client.createPaymentPayload(2, requirements);

      // Should use USDT asset ID (1984) from the token registry
      expect(result.payload.assetId).toBe(1984);
    });

    it("should throw for invalid scheme", async () => {
      const client = new ExactDirectPolkadotClient({ signer: mockSigner });

      const requirements: PaymentRequirements = {
        scheme: "wrong",
        network: POLKADOT_ASSET_HUB_CAIP2,
        asset: "USDT",
        amount: "1000000",
        payTo: VALID_PAYTO,
        maxTimeoutSeconds: 3600,
      };

      await expect(client.createPaymentPayload(2, requirements)).rejects.toThrow(
        "Invalid scheme",
      );
    });

    it("should throw for non-Polkadot network", async () => {
      const client = new ExactDirectPolkadotClient({ signer: mockSigner });

      const requirements: PaymentRequirements = {
        scheme: SCHEME_EXACT_DIRECT,
        network: "eip155:1",
        asset: "USDT",
        amount: "1000000",
        payTo: VALID_PAYTO,
        maxTimeoutSeconds: 3600,
      };

      await expect(client.createPaymentPayload(2, requirements)).rejects.toThrow(
        "Invalid network",
      );
    });

    it("should throw for invalid payTo address", async () => {
      const client = new ExactDirectPolkadotClient({ signer: mockSigner });

      const requirements: PaymentRequirements = {
        scheme: SCHEME_EXACT_DIRECT,
        network: POLKADOT_ASSET_HUB_CAIP2,
        asset: "USDT",
        amount: "1000000",
        payTo: "not-a-valid-ss58",
        maxTimeoutSeconds: 3600,
      };

      await expect(client.createPaymentPayload(2, requirements)).rejects.toThrow(
        "Invalid payTo address",
      );
    });

    it("should throw for zero amount", async () => {
      const client = new ExactDirectPolkadotClient({ signer: mockSigner });

      const requirements: PaymentRequirements = {
        scheme: SCHEME_EXACT_DIRECT,
        network: POLKADOT_ASSET_HUB_CAIP2,
        asset: "USDT",
        amount: "0",
        payTo: VALID_PAYTO,
        maxTimeoutSeconds: 3600,
      };

      await expect(client.createPaymentPayload(2, requirements)).rejects.toThrow(
        "Invalid amount",
      );
    });

    it("should work with testnet (Westend)", async () => {
      const client = new ExactDirectPolkadotClient({ signer: mockSigner });

      const requirements: PaymentRequirements = {
        scheme: SCHEME_EXACT_DIRECT,
        network: WESTEND_ASSET_HUB_CAIP2,
        asset: "USDT",
        amount: "1000000",
        payTo: VALID_PAYTO,
        maxTimeoutSeconds: 3600,
      };

      const result = await client.createPaymentPayload(2, requirements);
      expect(result.payload.extrinsicHash).toBe(MOCK_EXTRINSIC_HASH);
    });
  });
});
