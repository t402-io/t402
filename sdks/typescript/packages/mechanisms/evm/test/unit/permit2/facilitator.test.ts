import { describe, it, expect, beforeEach, vi } from "vitest";
import { Permit2EvmScheme } from "../../../src/permit2/facilitator/scheme";
import type { FacilitatorEvmSigner } from "../../../src/signer";
import { PERMIT2_ADDRESS } from "../../../src/permit2/constants";

describe("Permit2EvmScheme (Facilitator)", () => {
  let facilitator: Permit2EvmScheme;
  let mockSigner: FacilitatorEvmSigner;

  beforeEach(() => {
    mockSigner = {
      getAddresses: vi.fn().mockReturnValue(["0xFacilitator0000000000000000000000000000001"]),
      readContract: vi.fn().mockResolvedValue(BigInt(10000000)),
      verifyTypedData: vi.fn().mockResolvedValue(true),
      writeContract: vi.fn().mockResolvedValue("0xtxhash123"),
      sendTransaction: vi.fn(),
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "success" }),
      getCode: vi.fn().mockResolvedValue("0x1234"),
    };
    facilitator = new Permit2EvmScheme(mockSigner);
  });

  describe("Construction", () => {
    it("should create instance", () => {
      expect(facilitator).toBeDefined();
      expect(facilitator.scheme).toBe("permit2");
      expect(facilitator.caipFamily).toBe("eip155:*");
    });
  });

  describe("getExtra", () => {
    it("should return permit2Address", () => {
      const extra = facilitator.getExtra("eip155:8453");
      expect(extra?.permit2Address).toBe(PERMIT2_ADDRESS);
    });
  });

  describe("getSigners", () => {
    it("should return signer addresses", () => {
      const signers = facilitator.getSigners("eip155:8453");
      expect(signers).toEqual(["0xFacilitator0000000000000000000000000000001"]);
    });
  });

  describe("verify", () => {
    const validPayload = {
      t402Version: 2,
      accepted: { scheme: "permit2", network: "eip155:8453" },
      payload: {
        permit: {
          permitted: {
            token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            amount: "1000000",
          },
          nonce: "1",
          deadline: (Math.floor(Date.now() / 1000) + 3600).toString(),
        },
        transferDetails: {
          to: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
          requestedAmount: "1000000",
        },
        signature: "0xmocksig",
        owner: "0x1234567890123456789012345678901234567890",
      },
    };

    const validRequirements = {
      scheme: "permit2" as const,
      network: "eip155:8453" as const,
      amount: "1000000",
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
      maxTimeoutSeconds: 300,
    };

    it("should verify valid payload", async () => {
      const result = await facilitator.verify(validPayload as any, validRequirements);
      expect(result.isValid).toBe(true);
      expect(result.payer).toBe("0x1234567890123456789012345678901234567890");
    });

    it("should reject invalid payload structure", async () => {
      const badPayload = {
        ...validPayload,
        payload: {},
      };
      const result = await facilitator.verify(badPayload as any, validRequirements);
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("invalid_payload_structure");
    });

    it("should reject scheme mismatch", async () => {
      const badPayload = {
        ...validPayload,
        accepted: { scheme: "exact", network: "eip155:8453" },
      };
      const result = await facilitator.verify(badPayload as any, validRequirements);
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("unsupported_scheme");
    });

    it("should reject network mismatch", async () => {
      const badPayload = {
        ...validPayload,
        accepted: { scheme: "permit2", network: "eip155:1" },
      };
      const result = await facilitator.verify(badPayload as any, validRequirements);
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("network_mismatch");
    });

    it("should reject token mismatch", async () => {
      const badPayload = {
        ...validPayload,
        payload: {
          ...validPayload.payload,
          permit: {
            ...validPayload.payload.permit,
            permitted: {
              token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
              amount: "1000000",
            },
          },
        },
      };
      const result = await facilitator.verify(badPayload as any, validRequirements);
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("token_mismatch");
    });

    it("should reject expired permit", async () => {
      const badPayload = {
        ...validPayload,
        payload: {
          ...validPayload.payload,
          permit: {
            ...validPayload.payload.permit,
            deadline: "1000000",
          },
        },
      };
      const result = await facilitator.verify(badPayload as any, validRequirements);
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("permit_expired");
    });

    it("should reject insufficient amount", async () => {
      const badPayload = {
        ...validPayload,
        payload: {
          ...validPayload.payload,
          permit: {
            ...validPayload.payload.permit,
            permitted: {
              ...validPayload.payload.permit.permitted,
              amount: "100",
            },
          },
        },
      };
      const result = await facilitator.verify(badPayload as any, validRequirements);
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("insufficient_permitted_amount");
    });

    it("should reject insufficient funds", async () => {
      (mockSigner.readContract as any).mockResolvedValue(BigInt(100));
      const result = await facilitator.verify(validPayload as any, validRequirements);
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("insufficient_funds");
    });
  });

  describe("settle", () => {
    const validPayload = {
      t402Version: 2,
      accepted: { scheme: "permit2", network: "eip155:8453" },
      payload: {
        permit: {
          permitted: {
            token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            amount: "1000000",
          },
          nonce: "1",
          deadline: (Math.floor(Date.now() / 1000) + 3600).toString(),
        },
        transferDetails: {
          to: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
          requestedAmount: "1000000",
        },
        signature: "0xmocksig",
        owner: "0x1234567890123456789012345678901234567890",
      },
    };

    const validRequirements = {
      scheme: "permit2" as const,
      network: "eip155:8453" as const,
      amount: "1000000",
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
      maxTimeoutSeconds: 300,
    };

    it("should settle valid payment", async () => {
      const result = await facilitator.settle(validPayload as any, validRequirements);
      expect(result.success).toBe(true);
      expect(result.transaction).toBe("0xtxhash123");
      expect(result.payer).toBe("0x1234567890123456789012345678901234567890");
    });

    it("should call permitTransferFrom on Permit2 contract", async () => {
      await facilitator.settle(validPayload as any, validRequirements);

      expect(mockSigner.writeContract).toHaveBeenCalled();
      const callArgs = (mockSigner.writeContract as any).mock.calls[0][0];
      expect(callArgs.address).toBe("0x000000000022D473030F116dDEE9F6B43aC78BA3");
      expect(callArgs.functionName).toBe("permitTransferFrom");
    });

    it("should return error on failed transaction", async () => {
      (mockSigner.waitForTransactionReceipt as any).mockResolvedValue({ status: "reverted" });
      const result = await facilitator.settle(validPayload as any, validRequirements);
      expect(result.success).toBe(false);
      expect(result.errorReason).toBe("invalid_transaction_state");
    });

    it("should return error on write contract failure", async () => {
      (mockSigner.writeContract as any).mockRejectedValue(new Error("revert"));
      const result = await facilitator.settle(validPayload as any, validRequirements);
      expect(result.success).toBe(false);
      expect(result.errorReason).toBe("transaction_failed");
    });
  });
});
