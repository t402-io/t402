import { describe, it, expect, beforeEach, vi } from "vitest";
import { Permit2ProxyEvmScheme } from "../../../src/permit2-proxy/facilitator/scheme";
import type { FacilitatorEvmSigner } from "../../../src/signer";
import { PERMIT2_ADDRESS, T402_EXACT_PERMIT2_PROXY, T402_UPTO_PERMIT2_PROXY } from "../../../src/permit2-proxy/constants";

describe("Permit2ProxyEvmScheme (Facilitator)", () => {
  let facilitator: Permit2ProxyEvmScheme;
  let mockSigner: FacilitatorEvmSigner;
  const facilitatorAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as `0x${string}`;

  beforeEach(() => {
    mockSigner = {
      getAddresses: vi.fn().mockReturnValue([facilitatorAddress]),
      readContract: vi.fn().mockResolvedValue(BigInt(10000000)),
      verifyTypedData: vi.fn().mockResolvedValue(true),
      writeContract: vi.fn().mockResolvedValue("0xtxhash123"),
      sendTransaction: vi.fn(),
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "success" }),
      getCode: vi.fn().mockResolvedValue("0x1234"),
    };
    facilitator = new Permit2ProxyEvmScheme(mockSigner);
  });

  describe("Construction", () => {
    it("should create instance", () => {
      expect(facilitator).toBeDefined();
      expect(facilitator.scheme).toBe("permit2-proxy");
      expect(facilitator.caipFamily).toBe("eip155:*");
    });
  });

  describe("getExtra", () => {
    it("should return permit2Address and proxy addresses", () => {
      const extra = facilitator.getExtra("eip155:8453");
      expect(extra?.permit2Address).toBe(PERMIT2_ADDRESS);
      expect(extra?.exactProxyAddress).toBe(T402_EXACT_PERMIT2_PROXY);
      expect(extra?.uptoProxyAddress).toBe(T402_UPTO_PERMIT2_PROXY);
    });

    it("should use custom proxy addresses from config", () => {
      const custom = new Permit2ProxyEvmScheme(mockSigner, {
        exactProxyAddress: "0xCustomExact0000000000000000000000000000001",
        uptoProxyAddress: "0xCustomUpto00000000000000000000000000000001",
      });
      const extra = custom.getExtra("eip155:8453");
      expect(extra?.exactProxyAddress).toBe("0xCustomExact0000000000000000000000000000001");
      expect(extra?.uptoProxyAddress).toBe("0xCustomUpto00000000000000000000000000000001");
    });
  });

  describe("getSigners", () => {
    it("should return signer addresses", () => {
      const signers = facilitator.getSigners("eip155:8453");
      expect(signers).toEqual([facilitatorAddress]);
    });
  });

  describe("verify", () => {
    const validPayload = {
      t402Version: 2,
      accepted: { scheme: "permit2-proxy", network: "eip155:8453" },
      payload: {
        permit: {
          permitted: {
            token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            amount: "1000000",
          },
          nonce: "1",
          deadline: (Math.floor(Date.now() / 1000) + 3600).toString(),
        },
        witness: {
          to: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
          facilitator: facilitatorAddress,
          validAfter: "0",
        },
        signature: "0xmocksig",
        owner: "0x1234567890123456789012345678901234567890",
      },
    };

    const validRequirements = {
      scheme: "permit2-proxy" as const,
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

    it("should reject missing witness", async () => {
      const badPayload = {
        ...validPayload,
        payload: {
          ...validPayload.payload,
          witness: undefined,
        },
      };
      const result = await facilitator.verify(badPayload as any, validRequirements);
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("invalid_payload_structure");
    });

    it("should reject scheme mismatch", async () => {
      const badPayload = {
        ...validPayload,
        accepted: { scheme: "permit2", network: "eip155:8453" },
      };
      const result = await facilitator.verify(badPayload as any, validRequirements);
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("unsupported_scheme");
    });

    it("should reject network mismatch", async () => {
      const badPayload = {
        ...validPayload,
        accepted: { scheme: "permit2-proxy", network: "eip155:1" },
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

    it("should reject recipient mismatch (witness.to vs payTo)", async () => {
      const badPayload = {
        ...validPayload,
        payload: {
          ...validPayload.payload,
          witness: {
            ...validPayload.payload.witness,
            to: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
          },
        },
      };
      const result = await facilitator.verify(badPayload as any, validRequirements);
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("recipient_mismatch");
    });

    it("should reject facilitator mismatch", async () => {
      const badPayload = {
        ...validPayload,
        payload: {
          ...validPayload.payload,
          witness: {
            ...validPayload.payload.witness,
            facilitator: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
          },
        },
      };
      const result = await facilitator.verify(badPayload as any, validRequirements);
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("facilitator_mismatch");
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

    it("should reject payment_too_early (validAfter in future)", async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now
      const badPayload = {
        ...validPayload,
        payload: {
          ...validPayload.payload,
          witness: {
            ...validPayload.payload.witness,
            validAfter: futureTime.toString(),
          },
        },
      };
      const result = await facilitator.verify(badPayload as any, validRequirements);
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("payment_too_early");
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
      accepted: { scheme: "permit2-proxy", network: "eip155:8453" },
      payload: {
        permit: {
          permitted: {
            token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            amount: "1000000",
          },
          nonce: "1",
          deadline: (Math.floor(Date.now() / 1000) + 3600).toString(),
        },
        witness: {
          to: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
          facilitator: facilitatorAddress,
          validAfter: "0",
        },
        signature: "0xmocksig",
        owner: "0x1234567890123456789012345678901234567890",
      },
    };

    const validRequirements = {
      scheme: "permit2-proxy" as const,
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

    it("should call settle on proxy contract", async () => {
      await facilitator.settle(validPayload as any, validRequirements);

      expect(mockSigner.writeContract).toHaveBeenCalled();
      const callArgs = (mockSigner.writeContract as any).mock.calls[0][0];
      expect(callArgs.functionName).toBe("settle");
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

    it("should return error for invalid payload", async () => {
      const badPayload = {
        ...validPayload,
        payload: {},
      };
      const result = await facilitator.settle(badPayload as any, validRequirements);
      expect(result.success).toBe(false);
      expect(result.errorReason).toBe("invalid_payload_structure");
    });
  });
});
