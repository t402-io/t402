import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExactDirectNearClient } from "../../src/exact-direct/client/scheme";
import type { ClientNearSigner } from "../../src/types";
import type { PaymentRequirements } from "@t402/core/types";
import { NEAR_MAINNET_CAIP2, NEAR_TESTNET_CAIP2, SCHEME_EXACT_DIRECT } from "../../src/constants";

describe("ExactDirectNearClient", () => {
  let mockSigner: ClientNearSigner;

  beforeEach(() => {
    mockSigner = {
      accountId: "alice.near",
      signAndSendTransaction: vi
        .fn()
        .mockResolvedValue("9FtHUFBQsZ2MG77K3x3MJ9wjX3UT8zE4Bnv4RbdHJs3"),
    };
  });

  describe("constructor", () => {
    it("should create instance with correct scheme", () => {
      const client = new ExactDirectNearClient(mockSigner);
      expect(client.scheme).toBe(SCHEME_EXACT_DIRECT);
    });

    it("should accept optional config", () => {
      const client = new ExactDirectNearClient(mockSigner, {
        gasAmount: "50000000000000",
        memo: "test payment",
      });
      expect(client.scheme).toBe("exact-direct");
    });
  });

  describe("createPaymentPayload", () => {
    it("should create payment payload with txHash", async () => {
      const client = new ExactDirectNearClient(mockSigner);

      const requirements: PaymentRequirements = {
        scheme: SCHEME_EXACT_DIRECT,
        network: NEAR_MAINNET_CAIP2,
        asset: "usdt.tether-token.near",
        amount: "1000000",
        payTo: "merchant.near",
        maxTimeoutSeconds: 3600,
      };

      const result = await client.createPaymentPayload(2, requirements);

      expect(result.t402Version).toBe(2);
      expect(result.payload).toBeDefined();
      expect(result.payload.txHash).toBe("9FtHUFBQsZ2MG77K3x3MJ9wjX3UT8zE4Bnv4RbdHJs3");
      expect(result.payload.from).toBe("alice.near");
      expect(result.payload.to).toBe("merchant.near");
      expect(result.payload.amount).toBe("1000000");
    });

    it("should call signAndSendTransaction with correct arguments", async () => {
      const client = new ExactDirectNearClient(mockSigner);

      const requirements: PaymentRequirements = {
        scheme: SCHEME_EXACT_DIRECT,
        network: NEAR_MAINNET_CAIP2,
        asset: "usdt.tether-token.near",
        amount: "500000",
        payTo: "shop.near",
        maxTimeoutSeconds: 3600,
      };

      await client.createPaymentPayload(2, requirements);

      expect(mockSigner.signAndSendTransaction).toHaveBeenCalledWith(
        "usdt.tether-token.near",
        "ft_transfer",
        expect.objectContaining({
          receiver_id: "shop.near",
          amount: "500000",
        }),
        expect.any(String),
        "1",
      );
    });

    it("should include memo when configured", async () => {
      const client = new ExactDirectNearClient(mockSigner, {
        memo: "t402 payment",
      });

      const requirements: PaymentRequirements = {
        scheme: SCHEME_EXACT_DIRECT,
        network: NEAR_MAINNET_CAIP2,
        asset: "usdt.tether-token.near",
        amount: "1000000",
        payTo: "merchant.near",
        maxTimeoutSeconds: 3600,
      };

      await client.createPaymentPayload(2, requirements);

      expect(mockSigner.signAndSendTransaction).toHaveBeenCalledWith(
        "usdt.tether-token.near",
        "ft_transfer",
        expect.objectContaining({ memo: "t402 payment" }),
        expect.any(String),
        "1",
      );
    });

    it("should throw if asset is missing", async () => {
      const client = new ExactDirectNearClient(mockSigner);

      const requirements = {
        scheme: SCHEME_EXACT_DIRECT,
        network: NEAR_MAINNET_CAIP2,
        asset: "",
        amount: "1000000",
        payTo: "merchant.near",
        maxTimeoutSeconds: 3600,
      } as PaymentRequirements;

      await expect(client.createPaymentPayload(2, requirements)).rejects.toThrow(
        "Asset (token contract address) is required",
      );
    });

    it("should throw if payTo is missing", async () => {
      const client = new ExactDirectNearClient(mockSigner);

      const requirements = {
        scheme: SCHEME_EXACT_DIRECT,
        network: NEAR_MAINNET_CAIP2,
        asset: "usdt.tether-token.near",
        amount: "1000000",
        payTo: "",
        maxTimeoutSeconds: 3600,
      } as PaymentRequirements;

      await expect(client.createPaymentPayload(2, requirements)).rejects.toThrow(
        "PayTo address is required",
      );
    });

    it("should throw if amount is missing", async () => {
      const client = new ExactDirectNearClient(mockSigner);

      const requirements = {
        scheme: SCHEME_EXACT_DIRECT,
        network: NEAR_MAINNET_CAIP2,
        asset: "usdt.tether-token.near",
        amount: "",
        payTo: "merchant.near",
        maxTimeoutSeconds: 3600,
      } as PaymentRequirements;

      await expect(client.createPaymentPayload(2, requirements)).rejects.toThrow(
        "Amount is required",
      );
    });

    it("should throw for invalid payTo account ID", async () => {
      const client = new ExactDirectNearClient(mockSigner);

      const requirements: PaymentRequirements = {
        scheme: SCHEME_EXACT_DIRECT,
        network: NEAR_MAINNET_CAIP2,
        asset: "usdt.tether-token.near",
        amount: "1000000",
        payTo: "X",
        maxTimeoutSeconds: 3600,
      };

      await expect(client.createPaymentPayload(2, requirements)).rejects.toThrow(
        "Invalid recipient account ID",
      );
    });

    it("should work with testnet network", async () => {
      const client = new ExactDirectNearClient(mockSigner);

      const requirements: PaymentRequirements = {
        scheme: SCHEME_EXACT_DIRECT,
        network: NEAR_TESTNET_CAIP2,
        asset: "usdt.fakes.testnet",
        amount: "1000000",
        payTo: "bob.testnet",
        maxTimeoutSeconds: 3600,
      };

      const result = await client.createPaymentPayload(2, requirements);
      expect(result.payload.txHash).toBe("9FtHUFBQsZ2MG77K3x3MJ9wjX3UT8zE4Bnv4RbdHJs3");
    });
  });
});
