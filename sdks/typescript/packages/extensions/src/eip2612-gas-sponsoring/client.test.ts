import { describe, it, expect, vi } from "vitest";
import {
  createPermitSignature,
  createEip2612GasSponsorPayload,
  encodeEip2612GasSponsorHeader,
  EIP2612_GAS_SPONSOR_EXTENSION_KEY,
  EIP2612_GAS_SPONSOR_HEADER_NAME,
} from "./client.js";
import type { Eip2612GasSponsorPayload, PermitSigner } from "./types.js";

describe("EIP-2612 Gas Sponsoring Client", () => {
  describe("encodeEip2612GasSponsorHeader", () => {
    it("should encode payload as base64 JSON", () => {
      const payload: Eip2612GasSponsorPayload = {
        network: "eip155:8453",
        permitSignature: "0x" + "ab".repeat(65),
        owner: "0x1234567890123456789012345678901234567890",
        spender: "0xFacilitator0000000000000000000000000000",
        value: "1000000",
        deadline: 1700000000,
        v: 27,
        r: "0x" + "ab".repeat(32),
        s: "0x" + "cd".repeat(32),
      };

      const encoded = encodeEip2612GasSponsorHeader(payload);
      const decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf-8"));
      expect(decoded).toEqual(payload);
    });

    it("should handle large values in payload", () => {
      const payload: Eip2612GasSponsorPayload = {
        network: "eip155:42161",
        permitSignature: "0x" + "ff".repeat(65),
        owner: "0x" + "aa".repeat(20),
        spender: "0x" + "bb".repeat(20),
        value: "999999999999999999999999999",
        deadline: 2000000000,
        v: 28,
        r: "0x" + "11".repeat(32),
        s: "0x" + "22".repeat(32),
      };

      const encoded = encodeEip2612GasSponsorHeader(payload);
      const decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf-8"));
      expect(decoded.value).toBe("999999999999999999999999999");
    });
  });

  describe("createPermitSignature", () => {
    it("should create permit with correct EIP-712 typed data", async () => {
      const mockSigner: PermitSigner = {
        address: "0x1234567890123456789012345678901234567890",
        signTypedData: vi.fn().mockResolvedValue("0x" + "ab".repeat(64) + "1b"),
      };

      const result = await createPermitSignature({
        signer: mockSigner,
        tokenAddress: "0xTokenAddress0000000000000000000000000000",
        tokenName: "Tether USD",
        chainId: 8453,
        spender: "0xSpenderAddress00000000000000000000000000",
        value: "1000000",
        deadline: 1700000000,
      });

      expect(mockSigner.signTypedData).toHaveBeenCalledWith({
        domain: {
          name: "Tether USD",
          version: "1",
          chainId: 8453,
          verifyingContract: "0xTokenAddress0000000000000000000000000000",
        },
        types: {
          Permit: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
            { name: "value", type: "uint256" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint256" },
          ],
        },
        primaryType: "Permit",
        message: {
          owner: "0x1234567890123456789012345678901234567890",
          spender: "0xSpenderAddress00000000000000000000000000",
          value: "1000000",
          nonce: 0,
          deadline: 1700000000,
        },
      });

      expect(result.owner).toBe("0x1234567890123456789012345678901234567890");
      expect(result.spender).toBe("0xSpenderAddress00000000000000000000000000");
      expect(result.value).toBe("1000000");
      expect(result.deadline).toBe(1700000000);
    });

    it("should parse signature into v, r, s components", async () => {
      const rPart = "aa".repeat(32);
      const sPart = "bb".repeat(32);
      const vPart = "1b"; // v = 27
      const mockSigner: PermitSigner = {
        address: "0x1234567890123456789012345678901234567890",
        signTypedData: vi.fn().mockResolvedValue("0x" + rPart + sPart + vPart),
      };

      const result = await createPermitSignature({
        signer: mockSigner,
        tokenAddress: "0xToken",
        tokenName: "Test",
        chainId: 1,
        spender: "0xSpender",
        value: "100",
        deadline: 1700000000,
      });

      expect(result.r).toBe("0x" + rPart);
      expect(result.s).toBe("0x" + sPart);
      expect(result.v).toBe(27);
      expect(result.permitSignature).toBe("0x" + rPart + sPart + vPart);
    });

    it("should normalize v value less than 27", async () => {
      const rPart = "aa".repeat(32);
      const sPart = "bb".repeat(32);
      const vPart = "00"; // v = 0, should normalize to 27
      const mockSigner: PermitSigner = {
        address: "0xOwner",
        signTypedData: vi.fn().mockResolvedValue("0x" + rPart + sPart + vPart),
      };

      const result = await createPermitSignature({
        signer: mockSigner,
        tokenAddress: "0xToken",
        tokenName: "Test",
        chainId: 1,
        spender: "0xSpender",
        value: "100",
        deadline: 1700000000,
      });

      expect(result.v).toBe(27);
    });

    it("should use custom nonce when provided", async () => {
      const mockSigner: PermitSigner = {
        address: "0xOwner",
        signTypedData: vi.fn().mockResolvedValue("0x" + "ab".repeat(64) + "1b"),
      };

      await createPermitSignature({
        signer: mockSigner,
        tokenAddress: "0xToken",
        tokenName: "Test",
        chainId: 1,
        spender: "0xSpender",
        value: "100",
        deadline: 1700000000,
        nonce: 5,
      });

      const calledArgs = (mockSigner.signTypedData as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(calledArgs.message.nonce).toBe(5);
    });

    it("should throw on invalid signature length", async () => {
      const mockSigner: PermitSigner = {
        address: "0xOwner",
        signTypedData: vi.fn().mockResolvedValue("0x1234"),
      };

      await expect(
        createPermitSignature({
          signer: mockSigner,
          tokenAddress: "0xToken",
          tokenName: "Test",
          chainId: 1,
          spender: "0xSpender",
          value: "100",
          deadline: 1700000000,
        }),
      ).rejects.toThrow("Invalid signature length");
    });

    it("should handle signature without 0x prefix", async () => {
      const rPart = "aa".repeat(32);
      const sPart = "bb".repeat(32);
      const vPart = "1c"; // v = 28
      const mockSigner: PermitSigner = {
        address: "0xOwner",
        signTypedData: vi.fn().mockResolvedValue(rPart + sPart + vPart),
      };

      const result = await createPermitSignature({
        signer: mockSigner,
        tokenAddress: "0xToken",
        tokenName: "Test",
        chainId: 1,
        spender: "0xSpender",
        value: "100",
        deadline: 1700000000,
      });

      expect(result.v).toBe(28);
      expect(result.permitSignature).toBe("0x" + rPart + sPart + vPart);
    });
  });

  describe("createEip2612GasSponsorPayload", () => {
    it("should create payload from permit data and network", () => {
      const permit = {
        owner: "0xOwner",
        spender: "0xSpender",
        value: "1000000",
        deadline: 1700000000,
        v: 27,
        r: "0x" + "aa".repeat(32),
        s: "0x" + "bb".repeat(32),
        permitSignature: "0x" + "aa".repeat(32) + "bb".repeat(32) + "1b",
      };

      const payload = createEip2612GasSponsorPayload(permit, "eip155:8453");

      expect(payload.network).toBe("eip155:8453");
      expect(payload.owner).toBe("0xOwner");
      expect(payload.spender).toBe("0xSpender");
      expect(payload.value).toBe("1000000");
      expect(payload.deadline).toBe(1700000000);
      expect(payload.v).toBe(27);
      expect(payload.r).toBe("0x" + "aa".repeat(32));
      expect(payload.s).toBe("0x" + "bb".repeat(32));
      expect(payload.permitSignature).toBe("0x" + "aa".repeat(32) + "bb".repeat(32) + "1b");
    });
  });

  describe("Constants", () => {
    it("should export correct extension key", () => {
      expect(EIP2612_GAS_SPONSOR_EXTENSION_KEY).toBe("eip2612GasSponsoring");
    });

    it("should export correct header name", () => {
      expect(EIP2612_GAS_SPONSOR_HEADER_NAME).toBe("X-T402-EIP2612-Gas-Sponsoring");
    });
  });
});
