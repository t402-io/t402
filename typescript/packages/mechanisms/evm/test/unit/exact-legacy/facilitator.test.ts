import { describe, it, expect, beforeEach, vi } from "vitest";
import { ExactLegacyEvmScheme } from "../../../src/exact-legacy/facilitator/scheme";
import { ExactLegacyEvmScheme as ClientExactLegacyEvmScheme } from "../../../src/exact-legacy/client/scheme";
import type { ClientEvmSigner, FacilitatorEvmSigner } from "../../../src/signer";
import { PaymentRequirements, PaymentPayload } from "@t402/core/types";

describe("ExactLegacyEvmScheme (Facilitator)", () => {
  let facilitator: ExactLegacyEvmScheme;
  let mockFacilitatorSigner: FacilitatorEvmSigner;
  let client: ClientExactLegacyEvmScheme;
  let mockClientSigner: ClientEvmSigner;
  const facilitatorAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0";

  beforeEach(() => {
    mockClientSigner = {
      address: "0x1234567890123456789012345678901234567890",
      signTypedData: vi.fn().mockResolvedValue("0xmocksignature"),
    };
    client = new ClientExactLegacyEvmScheme(mockClientSigner);

    mockFacilitatorSigner = {
      getAddresses: vi.fn().mockReturnValue([facilitatorAddress]),
      readContract: vi.fn().mockImplementation(({ functionName }) => {
        if (functionName === "balanceOf") {
          return Promise.resolve(10000000n); // 10 USDT
        }
        if (functionName === "allowance") {
          return Promise.resolve(10000000n); // 10 USDT allowance
        }
        return Promise.resolve(0n);
      }),
      verifyTypedData: vi.fn().mockResolvedValue(true),
      writeContract: vi.fn().mockResolvedValue("0xtxhash"),
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "success" }),
      getCode: vi.fn().mockResolvedValue("0x"),
      sendTransaction: vi.fn().mockResolvedValue("0xtxhash"),
    };
    facilitator = new ExactLegacyEvmScheme(mockFacilitatorSigner);
  });

  describe("Construction", () => {
    it("should create instance with signer", () => {
      expect(facilitator).toBeDefined();
      expect(facilitator.scheme).toBe("exact-legacy");
      expect(facilitator.caipFamily).toBe("eip155:*");
    });
  });

  describe("getExtra", () => {
    it("should return spender address and tokenType", () => {
      const extra = facilitator.getExtra("eip155:1");

      expect(extra?.spender).toBe(facilitatorAddress);
      expect(extra?.tokenType).toBe("legacy");
    });
  });

  describe("getSigners", () => {
    it("should return facilitator addresses", () => {
      const signers = facilitator.getSigners("eip155:1");

      expect(signers).toContain(facilitatorAddress);
    });
  });

  describe("verify", () => {
    const baseRequirements: PaymentRequirements = {
      scheme: "exact-legacy",
      network: "eip155:1",
      amount: "1000000",
      asset: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      payTo: "0x9999999999999999999999999999999999999999",
      maxTimeoutSeconds: 300,
      extra: {
        spender: facilitatorAddress,
        tokenType: "legacy",
      },
    };

    it("should verify valid payment payload", async () => {
      const paymentPayload = await client.createPaymentPayload(2, baseRequirements);

      const fullPayload: PaymentPayload = {
        ...paymentPayload,
        accepted: baseRequirements,
        resource: { url: "test", description: "", mimeType: "" },
      };

      const result = await facilitator.verify(fullPayload, baseRequirements);

      expect(result.isValid).toBe(true);
      expect(result.payer).toBe(mockClientSigner.address);
    });

    it("should reject if scheme doesn't match", async () => {
      const requirements = { ...baseRequirements, scheme: "exact" as const };

      const payload: PaymentPayload = {
        t402Version: 2,
        payload: {
          authorization: {
            from: mockClientSigner.address,
            to: requirements.payTo,
            value: requirements.amount,
            validAfter: "0",
            validBefore: "999999999999",
            nonce: "0x00",
            spender: facilitatorAddress,
          },
          signature: "0x",
        },
        accepted: { ...requirements, scheme: "exact" },
        resource: { url: "", description: "", mimeType: "" },
      };

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("unsupported_scheme");
    });

    it("should reject if network doesn't match", async () => {
      const paymentPayload = await client.createPaymentPayload(2, baseRequirements);

      const fullPayload: PaymentPayload = {
        ...paymentPayload,
        accepted: { ...baseRequirements, network: "eip155:137" as const },
        resource: { url: "", description: "", mimeType: "" },
      };

      const result = await facilitator.verify(fullPayload, baseRequirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("network_mismatch");
    });

    it("should reject if spender is not a facilitator address", async () => {
      const requirements = {
        ...baseRequirements,
        extra: {
          ...baseRequirements.extra,
          spender: "0x0000000000000000000000000000000000000000", // Unknown spender
        },
      };

      const paymentPayload = await client.createPaymentPayload(2, requirements);

      const fullPayload: PaymentPayload = {
        ...paymentPayload,
        accepted: requirements,
        resource: { url: "", description: "", mimeType: "" },
      };

      const result = await facilitator.verify(fullPayload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("invalid_spender");
    });

    it("should reject if recipient doesn't match payTo", async () => {
      const paymentPayload = await client.createPaymentPayload(2, baseRequirements);

      const fullPayload: PaymentPayload = {
        ...paymentPayload,
        accepted: baseRequirements,
        resource: { url: "", description: "", mimeType: "" },
      };

      const modifiedRequirements = {
        ...baseRequirements,
        payTo: "0x0000000000000000000000000000000000000000",
      };

      const result = await facilitator.verify(fullPayload, modifiedRequirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("recipient_mismatch");
    });

    it("should reject if signature is invalid", async () => {
      mockFacilitatorSigner.verifyTypedData = vi.fn().mockResolvedValue(false);

      const paymentPayload = await client.createPaymentPayload(2, baseRequirements);

      const fullPayload: PaymentPayload = {
        ...paymentPayload,
        accepted: baseRequirements,
        resource: { url: "", description: "", mimeType: "" },
      };

      const result = await facilitator.verify(fullPayload, baseRequirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("invalid_signature");
    });

    it("should reject if balance is insufficient", async () => {
      mockFacilitatorSigner.readContract = vi.fn().mockImplementation(({ functionName }) => {
        if (functionName === "balanceOf") {
          return Promise.resolve(100n); // Only 0.0001 USDT
        }
        if (functionName === "allowance") {
          return Promise.resolve(10000000n);
        }
        return Promise.resolve(0n);
      });

      const paymentPayload = await client.createPaymentPayload(2, baseRequirements);

      const fullPayload: PaymentPayload = {
        ...paymentPayload,
        accepted: baseRequirements,
        resource: { url: "", description: "", mimeType: "" },
      };

      const result = await facilitator.verify(fullPayload, baseRequirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("insufficient_balance");
    });

    it("should reject if allowance is insufficient", async () => {
      mockFacilitatorSigner.readContract = vi.fn().mockImplementation(({ functionName }) => {
        if (functionName === "balanceOf") {
          return Promise.resolve(10000000n);
        }
        if (functionName === "allowance") {
          return Promise.resolve(100n); // Only 0.0001 USDT allowance
        }
        return Promise.resolve(0n);
      });

      const paymentPayload = await client.createPaymentPayload(2, baseRequirements);

      const fullPayload: PaymentPayload = {
        ...paymentPayload,
        accepted: baseRequirements,
        resource: { url: "", description: "", mimeType: "" },
      };

      const result = await facilitator.verify(fullPayload, baseRequirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("insufficient_allowance");
    });

    it("should reject if authorization amount is insufficient", async () => {
      const paymentPayload = await client.createPaymentPayload(2, baseRequirements);

      const fullPayload: PaymentPayload = {
        ...paymentPayload,
        accepted: baseRequirements,
        resource: { url: "", description: "", mimeType: "" },
      };

      // Require more than the authorization
      const modifiedRequirements = {
        ...baseRequirements,
        amount: "2000000", // 2 USDT instead of 1
      };

      const result = await facilitator.verify(fullPayload, modifiedRequirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("insufficient_amount");
    });
  });

  describe("settle", () => {
    const baseRequirements: PaymentRequirements = {
      scheme: "exact-legacy",
      network: "eip155:1",
      amount: "1000000",
      asset: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      payTo: "0x9999999999999999999999999999999999999999",
      maxTimeoutSeconds: 300,
      extra: {
        spender: facilitatorAddress,
        tokenType: "legacy",
      },
    };

    it("should settle valid payment", async () => {
      const paymentPayload = await client.createPaymentPayload(2, baseRequirements);

      const fullPayload: PaymentPayload = {
        ...paymentPayload,
        accepted: baseRequirements,
        resource: { url: "test", description: "", mimeType: "" },
      };

      const result = await facilitator.settle(fullPayload, baseRequirements);

      expect(result.success).toBe(true);
      expect(result.transaction).toBe("0xtxhash");
      expect(result.network).toBe("eip155:1");
      expect(result.payer).toBe(mockClientSigner.address);
    });

    it("should call transferFrom on ERC20 contract", async () => {
      const paymentPayload = await client.createPaymentPayload(2, baseRequirements);

      const fullPayload: PaymentPayload = {
        ...paymentPayload,
        accepted: baseRequirements,
        resource: { url: "test", description: "", mimeType: "" },
      };

      await facilitator.settle(fullPayload, baseRequirements);

      expect(mockFacilitatorSigner.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "transferFrom",
        }),
      );
    });

    it("should fail settlement if verification fails", async () => {
      mockFacilitatorSigner.verifyTypedData = vi.fn().mockResolvedValue(false);

      const paymentPayload = await client.createPaymentPayload(2, baseRequirements);

      const fullPayload: PaymentPayload = {
        ...paymentPayload,
        accepted: baseRequirements,
        resource: { url: "test", description: "", mimeType: "" },
      };

      const result = await facilitator.settle(fullPayload, baseRequirements);

      expect(result.success).toBe(false);
      expect(result.errorReason).toBe("invalid_signature");
    });

    it("should handle transaction failure", async () => {
      mockFacilitatorSigner.waitForTransactionReceipt = vi
        .fn()
        .mockResolvedValue({ status: "reverted" });

      const paymentPayload = await client.createPaymentPayload(2, baseRequirements);

      const fullPayload: PaymentPayload = {
        ...paymentPayload,
        accepted: baseRequirements,
        resource: { url: "test", description: "", mimeType: "" },
      };

      const result = await facilitator.settle(fullPayload, baseRequirements);

      expect(result.success).toBe(false);
      expect(result.errorReason).toBe("transaction_failed");
    });

    it("should handle writeContract error", async () => {
      mockFacilitatorSigner.writeContract = vi.fn().mockRejectedValue(new Error("Gas estimation failed"));

      const paymentPayload = await client.createPaymentPayload(2, baseRequirements);

      const fullPayload: PaymentPayload = {
        ...paymentPayload,
        accepted: baseRequirements,
        resource: { url: "test", description: "", mimeType: "" },
      };

      const result = await facilitator.settle(fullPayload, baseRequirements);

      expect(result.success).toBe(false);
      expect(result.errorReason).toBe("settlement_failed");
    });
  });
});
