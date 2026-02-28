import { describe, it, expect, beforeEach, vi } from "vitest";
import { Permit2ProxyEvmScheme } from "../../../src/permit2-proxy/client/scheme";
import type { ClientEvmSigner } from "../../../src/signer";
import { PaymentRequirements } from "@t402/core/types";

describe("Permit2ProxyEvmScheme (Client)", () => {
  let client: Permit2ProxyEvmScheme;
  let mockSigner: ClientEvmSigner;

  beforeEach(() => {
    mockSigner = {
      address: "0x1234567890123456789012345678901234567890",
      signTypedData: vi.fn().mockResolvedValue("0xmocksignature123456789"),
    };
    client = new Permit2ProxyEvmScheme(mockSigner);
  });

  describe("Construction", () => {
    it("should create instance with signer", () => {
      expect(client).toBeDefined();
      expect(client.scheme).toBe("permit2-proxy");
    });
  });

  describe("createPaymentPayload", () => {
    const baseRequirements: PaymentRequirements = {
      scheme: "permit2-proxy",
      network: "eip155:8453",
      amount: "1000000",
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
      maxTimeoutSeconds: 300,
      extra: {
        exactProxyAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        facilitator: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      },
    };

    it("should create payment payload with Permit2 Proxy structure", async () => {
      const result = await client.createPaymentPayload(2, baseRequirements);

      expect(result.t402Version).toBe(2);
      expect(result.payload).toBeDefined();
      expect(result.payload.permit).toBeDefined();
      expect(result.payload.witness).toBeDefined();
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

    it("should set correct witness data", async () => {
      const result = await client.createPaymentPayload(2, baseRequirements);

      expect(result.payload.witness.to.toLowerCase()).toBe(baseRequirements.payTo.toLowerCase());
      expect(result.payload.witness.facilitator.toLowerCase()).toBe(
        (baseRequirements.extra!.facilitator as string).toLowerCase(),
      );
      expect(result.payload.witness.validAfter).toBe("0");
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

    it("should call signTypedData with PermitWitnessTransferFrom", async () => {
      await client.createPaymentPayload(2, baseRequirements);

      expect(mockSigner.signTypedData).toHaveBeenCalled();
      const callArgs = (mockSigner.signTypedData as any).mock.calls[0][0];
      expect(callArgs.domain.name).toBe("Permit2");
      expect(callArgs.domain.chainId).toBe(8453);
      expect(callArgs.domain.verifyingContract).toBe("0x000000000022D473030F116dDEE9F6B43aC78BA3");
      expect(callArgs.primaryType).toBe("PermitWitnessTransferFrom");
    });

    it("should include witness types in signTypedData call", async () => {
      await client.createPaymentPayload(2, baseRequirements);

      const callArgs = (mockSigner.signTypedData as any).mock.calls[0][0];
      expect(callArgs.types.Witness).toBeDefined();
      expect(callArgs.types.PermitWitnessTransferFrom).toBeDefined();
      expect(callArgs.message.witness).toBeDefined();
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

    it("should throw when proxy address is missing", async () => {
      const badRequirements: PaymentRequirements = {
        ...baseRequirements,
        extra: { facilitator: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" },
      };

      await expect(client.createPaymentPayload(2, badRequirements)).rejects.toThrow(
        /proxy address/i,
      );
    });

    it("should throw when facilitator address is missing", async () => {
      const badRequirements: PaymentRequirements = {
        ...baseRequirements,
        extra: { exactProxyAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" },
      };

      await expect(client.createPaymentPayload(2, badRequirements)).rejects.toThrow(/facilitator/i);
    });
  });
});
