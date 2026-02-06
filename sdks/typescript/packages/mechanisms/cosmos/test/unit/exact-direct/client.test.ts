import { describe, it, expect, vi } from "vitest";
import { ExactDirectCosmosClient } from "../../../src/exact-direct/client/scheme";
import type { ClientCosmosSigner } from "../../../src/types";
import type { PaymentRequirements } from "@t402/core/types";

describe("ExactDirectCosmosClient", () => {
  const createMockSigner = (address: string = "noble1abc123def456ghi789jkl"): ClientCosmosSigner => ({
    address,
    sendTokens: vi.fn().mockResolvedValue("TX_HASH_ABC123DEF456"),
  });

  const createRequirements = (overrides: Partial<PaymentRequirements> = {}): PaymentRequirements => ({
    scheme: "exact-direct",
    network: "cosmos:noble-1",
    asset: "uusdc",
    amount: "1000000",
    payTo: "noble1recipient456789abcdef012",
    maxTimeoutSeconds: 3600,
    extra: {},
    ...overrides,
  });

  describe("scheme property", () => {
    it("should have scheme set to exact-direct", () => {
      const signer = createMockSigner();
      const client = new ExactDirectCosmosClient(signer);
      expect(client.scheme).toBe("exact-direct");
    });
  });

  describe("createPaymentPayload", () => {
    it("should create a valid payment payload", async () => {
      const signer = createMockSigner();
      const client = new ExactDirectCosmosClient(signer);
      const requirements = createRequirements();

      const result = await client.createPaymentPayload(2, requirements);

      expect(result.t402Version).toBe(2);
      expect(result.payload).toBeDefined();

      const payload = result.payload as Record<string, unknown>;
      expect(payload.txHash).toBe("TX_HASH_ABC123DEF456");
      expect(payload.from).toBe("noble1abc123def456ghi789jkl");
      expect(payload.to).toBe("noble1recipient456789abcdef012");
      expect(payload.amount).toBe("1000000");
      expect(payload.denom).toBe("uusdc");
    });

    it("should call signer.sendTokens with correct parameters", async () => {
      const signer = createMockSigner();
      const client = new ExactDirectCosmosClient(signer);
      const requirements = createRequirements();

      await client.createPaymentPayload(2, requirements);

      expect(signer.sendTokens).toHaveBeenCalledWith(
        "cosmos:noble-1",
        "noble1recipient456789abcdef012",
        "1000000",
        "uusdc",
      );
    });

    it("should use denom from extra field when available", async () => {
      const signer = createMockSigner();
      const client = new ExactDirectCosmosClient(signer);
      const requirements = createRequirements({
        extra: { denom: "uatom" },
      });

      await client.createPaymentPayload(2, requirements);

      expect(signer.sendTokens).toHaveBeenCalledWith(
        "cosmos:noble-1",
        "noble1recipient456789abcdef012",
        "1000000",
        "uatom",
      );
    });

    it("should use config denom when no extra denom", async () => {
      const signer = createMockSigner();
      const client = new ExactDirectCosmosClient(signer, { denom: "ustars" });
      const requirements = createRequirements();

      await client.createPaymentPayload(2, requirements);

      expect(signer.sendTokens).toHaveBeenCalledWith(
        "cosmos:noble-1",
        "noble1recipient456789abcdef012",
        "1000000",
        "ustars",
      );
    });

    it("should throw if payTo is missing", async () => {
      const signer = createMockSigner();
      const client = new ExactDirectCosmosClient(signer);
      const requirements = createRequirements({ payTo: "" });

      await expect(client.createPaymentPayload(2, requirements)).rejects.toThrow(
        "PayTo address is required",
      );
    });

    it("should throw if amount is missing", async () => {
      const signer = createMockSigner();
      const client = new ExactDirectCosmosClient(signer);
      const requirements = createRequirements({ amount: "" });

      await expect(client.createPaymentPayload(2, requirements)).rejects.toThrow(
        "Amount is required",
      );
    });

    it("should throw if recipient address is invalid", async () => {
      const signer = createMockSigner();
      const client = new ExactDirectCosmosClient(signer);
      const requirements = createRequirements({ payTo: "cosmos1invalidprefix" });

      await expect(client.createPaymentPayload(2, requirements)).rejects.toThrow(
        "Invalid recipient address",
      );
    });

    it("should throw if sender address is invalid", async () => {
      const signer = createMockSigner("cosmos1wrongprefix");
      const client = new ExactDirectCosmosClient(signer);
      const requirements = createRequirements();

      await expect(client.createPaymentPayload(2, requirements)).rejects.toThrow(
        "Invalid sender address",
      );
    });

    it("should normalize network to CAIP-2 format", async () => {
      const signer = createMockSigner();
      const client = new ExactDirectCosmosClient(signer);
      const requirements = createRequirements({ network: "cosmos:noble-1" });

      const result = await client.createPaymentPayload(2, requirements);
      expect(result.payload).toBeDefined();
    });

    it("should propagate signer errors", async () => {
      const signer = createMockSigner();
      (signer.sendTokens as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Transaction failed"),
      );
      const client = new ExactDirectCosmosClient(signer);
      const requirements = createRequirements();

      await expect(client.createPaymentPayload(2, requirements)).rejects.toThrow(
        "Transaction failed",
      );
    });
  });
});
