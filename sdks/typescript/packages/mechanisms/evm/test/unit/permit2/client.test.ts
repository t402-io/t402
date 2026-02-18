import { describe, it, expect, beforeEach, vi } from "vitest";
import { Permit2EvmScheme } from "../../../src/permit2/client/scheme";
import type { ClientEvmSigner } from "../../../src/signer";
import { PaymentRequirements } from "@t402/core/types";

describe("Permit2EvmScheme (Client)", () => {
  let client: Permit2EvmScheme;
  let mockSigner: ClientEvmSigner;

  beforeEach(() => {
    mockSigner = {
      address: "0x1234567890123456789012345678901234567890",
      signTypedData: vi.fn().mockResolvedValue("0xmocksignature123456789"),
    };
    client = new Permit2EvmScheme(mockSigner);
  });

  describe("Construction", () => {
    it("should create instance with signer", () => {
      expect(client).toBeDefined();
      expect(client.scheme).toBe("permit2");
    });
  });

  describe("createPaymentPayload", () => {
    const baseRequirements: PaymentRequirements = {
      scheme: "permit2",
      network: "eip155:8453",
      amount: "1000000",
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
      maxTimeoutSeconds: 300,
    };

    it("should create payment payload with Permit2 structure", async () => {
      const result = await client.createPaymentPayload(2, baseRequirements);

      expect(result.t402Version).toBe(2);
      expect(result.payload).toBeDefined();
      expect(result.payload.permit).toBeDefined();
      expect(result.payload.transferDetails).toBeDefined();
      expect(result.payload.signature).toBeDefined();
      expect(result.payload.owner).toBe(mockSigner.address);
    });

    it("should set correct token in permit", async () => {
      const result = await client.createPaymentPayload(2, baseRequirements);

      expect(result.payload.permit.permitted.token.toLowerCase()).toBe(
        baseRequirements.asset.toLowerCase(),
      );
      expect(result.payload.permit.permitted.amount).toBe(baseRequirements.amount);
    });

    it("should set correct transfer details", async () => {
      const result = await client.createPaymentPayload(2, baseRequirements);

      expect(result.payload.transferDetails.to.toLowerCase()).toBe(
        baseRequirements.payTo.toLowerCase(),
      );
      expect(result.payload.transferDetails.requestedAmount).toBe(baseRequirements.amount);
    });

    it("should set deadline based on maxTimeoutSeconds", async () => {
      const beforeTime = Math.floor(Date.now() / 1000) + 300;
      const result = await client.createPaymentPayload(2, baseRequirements);
      const afterTime = Math.floor(Date.now() / 1000) + 300;

      const deadline = parseInt(result.payload.permit.deadline);
      expect(deadline).toBeGreaterThanOrEqual(beforeTime);
      expect(deadline).toBeLessThanOrEqual(afterTime + 1);
    });

    it("should generate unique nonces", async () => {
      const result1 = await client.createPaymentPayload(2, baseRequirements);
      const result2 = await client.createPaymentPayload(2, baseRequirements);

      expect(result1.payload.permit.nonce).not.toBe(result2.payload.permit.nonce);
    });

    it("should call signTypedData with Permit2 domain", async () => {
      await client.createPaymentPayload(2, baseRequirements);

      expect(mockSigner.signTypedData).toHaveBeenCalled();
      const callArgs = (mockSigner.signTypedData as any).mock.calls[0][0];
      expect(callArgs.domain.name).toBe("Permit2");
      expect(callArgs.domain.chainId).toBe(8453);
      expect(callArgs.domain.verifyingContract).toBe(
        "0x000000000022D473030F116dDEE9F6B43aC78BA3",
      );
      expect(callArgs.primaryType).toBe("PermitTransferFrom");
    });

    it("should handle different networks", async () => {
      const ethRequirements: PaymentRequirements = {
        ...baseRequirements,
        network: "eip155:1",
        asset: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      };

      await client.createPaymentPayload(2, ethRequirements);

      const callArgs = (mockSigner.signTypedData as any).mock.calls[0][0];
      expect(callArgs.domain.chainId).toBe(1);
    });
  });
});
