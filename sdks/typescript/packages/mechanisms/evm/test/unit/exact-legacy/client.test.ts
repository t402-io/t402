import { describe, it, expect, beforeEach, vi } from "vitest";
import { ExactLegacyEvmScheme } from "../../../src/exact-legacy/client/scheme";
import type { ClientEvmSigner } from "../../../src/signer";
import { PaymentRequirements } from "@t402/core/types";

describe("ExactLegacyEvmScheme (Client)", () => {
  let client: ExactLegacyEvmScheme;
  let mockSigner: ClientEvmSigner;

  beforeEach(() => {
    mockSigner = {
      address: "0x1234567890123456789012345678901234567890",
      signTypedData: vi.fn().mockResolvedValue("0xmocksignature123456789"),
    };
    client = new ExactLegacyEvmScheme(mockSigner);
  });

  describe("Construction", () => {
    it("should create instance with signer", () => {
      expect(client).toBeDefined();
      expect(client.scheme).toBe("exact-legacy");
    });
  });

  describe("createPaymentPayload", () => {
    const baseRequirements: PaymentRequirements = {
      scheme: "exact-legacy",
      network: "eip155:1",
      amount: "1000000",
      asset: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // Legacy USDT on Ethereum
      payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
      maxTimeoutSeconds: 300,
      extra: {
        spender: "0xFac1111111111111111111111111111111111111",
        tokenType: "legacy",
      },
    };

    it("should create payment payload with legacy authorization", async () => {
      const result = await client.createPaymentPayload(2, baseRequirements);

      expect(result.t402Version).toBe(2);
      expect(result.payload).toBeDefined();
      expect(result.payload.authorization).toBeDefined();
      expect(result.payload.signature).toBeDefined();
    });

    it("should include spender in authorization", async () => {
      const result = await client.createPaymentPayload(2, baseRequirements);

      expect(result.payload.authorization.spender).toBeDefined();
      expect(result.payload.authorization.spender.toLowerCase()).toBe(
        "0xFac1111111111111111111111111111111111111".toLowerCase(),
      );
    });

    it("should generate valid nonce", async () => {
      const result1 = await client.createPaymentPayload(2, baseRequirements);
      const result2 = await client.createPaymentPayload(2, baseRequirements);

      // Nonces should be different
      expect(result1.payload.authorization.nonce).not.toBe(result2.payload.authorization.nonce);

      // Nonce should be 32 bytes hex string
      expect(result1.payload.authorization.nonce).toMatch(/^0x[0-9a-f]{64}$/i);
    });

    it("should set validAfter to 10 minutes before current time", async () => {
      const beforeTime = Math.floor(Date.now() / 1000) - 600;
      const result = await client.createPaymentPayload(2, baseRequirements);
      const afterTime = Math.floor(Date.now() / 1000) - 600;

      const validAfter = parseInt(result.payload.authorization.validAfter);

      expect(validAfter).toBeGreaterThanOrEqual(beforeTime);
      expect(validAfter).toBeLessThanOrEqual(afterTime + 1);
    });

    it("should set validBefore based on maxTimeoutSeconds", async () => {
      const requirements = { ...baseRequirements, maxTimeoutSeconds: 600 };

      const beforeTime = Math.floor(Date.now() / 1000) + 600;
      const result = await client.createPaymentPayload(2, requirements);
      const afterTime = Math.floor(Date.now() / 1000) + 600;

      const validBefore = parseInt(result.payload.authorization.validBefore);

      expect(validBefore).toBeGreaterThanOrEqual(beforeTime);
      expect(validBefore).toBeLessThanOrEqual(afterTime + 1);
    });

    it("should use signer's address as from", async () => {
      const result = await client.createPaymentPayload(2, baseRequirements);

      expect(result.payload.authorization.from).toBe(mockSigner.address);
    });

    it("should use requirements.payTo as to", async () => {
      const result = await client.createPaymentPayload(2, baseRequirements);

      expect(result.payload.authorization.to.toLowerCase()).toBe(
        baseRequirements.payTo.toLowerCase(),
      );
    });

    it("should use requirements.amount as value", async () => {
      const requirements = { ...baseRequirements, amount: "2500000" };
      const result = await client.createPaymentPayload(2, requirements);

      expect(result.payload.authorization.value).toBe("2500000");
    });

    it("should call signTypedData on signer", async () => {
      const result = await client.createPaymentPayload(2, baseRequirements);

      expect(mockSigner.signTypedData).toHaveBeenCalled();
      expect(result.payload.signature).toBeDefined();
    });

    it("should pass correct EIP-712 domain to signTypedData", async () => {
      await client.createPaymentPayload(2, baseRequirements);

      expect(mockSigner.signTypedData).toHaveBeenCalled();
      const callArgs = (mockSigner.signTypedData as any).mock.calls[0][0];
      expect(callArgs.domain.name).toBe("T402LegacyTransfer"); // Default name
      expect(callArgs.domain.version).toBe("1"); // Default version
      expect(callArgs.domain.chainId).toBe(1); // Ethereum mainnet
    });

    it("should use custom name and version if provided", async () => {
      const requirements = {
        ...baseRequirements,
        extra: {
          ...baseRequirements.extra,
          name: "CustomToken",
          version: "2",
        },
      };

      await client.createPaymentPayload(2, requirements);

      const callArgs = (mockSigner.signTypedData as any).mock.calls[0][0];
      expect(callArgs.domain.name).toBe("CustomToken");
      expect(callArgs.domain.version).toBe("2");
    });

    it("should throw if spender is not provided", async () => {
      const requirements = {
        ...baseRequirements,
        extra: { tokenType: "legacy" }, // Missing spender
      };

      await expect(client.createPaymentPayload(2, requirements)).rejects.toThrow(
        "exact-legacy scheme requires 'spender'",
      );
    });

    it("should include spender in typed data message", async () => {
      await client.createPaymentPayload(2, baseRequirements);

      const callArgs = (mockSigner.signTypedData as any).mock.calls[0][0];
      expect(callArgs.message.spender).toBeDefined();
      expect(callArgs.primaryType).toBe("LegacyTransferAuthorization");
    });
  });
});
