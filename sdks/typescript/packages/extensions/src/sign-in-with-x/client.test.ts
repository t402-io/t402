import { describe, it, expect, vi } from "vitest";
import {
  encodeSIWxHeader,
  createSIWxMessage,
  createSIWxTypedData,
  signSIWxMessage,
  createSIWxPayload,
  SIWX_EXTENSION_KEY,
  SIWX_HEADER_NAME,
} from "./client.js";
import type { SIWxPayload, SIWxExtension, SIWxSigner, SIWxExtensionInfo } from "./types.js";

describe("Sign-In-With-X Client", () => {
  describe("encodeSIWxHeader", () => {
    it("should encode payload as base64 JSON", () => {
      const payload: SIWxPayload = {
        domain: "api.example.com",
        address: "0x1234567890123456789012345678901234567890",
        uri: "https://api.example.com/resource",
        version: "1",
        chainId: "eip155:8453",
        nonce: "abc123",
        issuedAt: "2025-01-01T00:00:00.000Z",
        signature: "0xsig",
      };

      const encoded = encodeSIWxHeader(payload);

      // Decode and verify
      const decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf-8"));
      expect(decoded).toEqual(payload);
    });

    it("should handle special characters in statement", () => {
      const payload: SIWxPayload = {
        domain: "api.example.com",
        address: "0x1234567890123456789012345678901234567890",
        statement: 'Special chars: "quotes", <brackets>, & ampersand',
        uri: "https://api.example.com/resource",
        version: "1",
        chainId: "eip155:8453",
        nonce: "abc123",
        issuedAt: "2025-01-01T00:00:00.000Z",
        signature: "0xsig",
      };

      const encoded = encodeSIWxHeader(payload);
      const decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf-8"));

      expect(decoded.statement).toBe('Special chars: "quotes", <brackets>, & ampersand');
    });
  });

  describe("createSIWxMessage", () => {
    const serverInfo: SIWxExtensionInfo = {
      domain: "api.example.com",
      uri: "https://api.example.com/resource",
      statement: "Sign in to access premium content",
      version: "1",
      chainId: "eip155:8453",
      nonce: "abc123",
      issuedAt: "2025-01-01T00:00:00.000Z",
      resources: ["https://api.example.com/resource"],
    };

    it("should create CAIP-122 formatted message", () => {
      const message = createSIWxMessage(serverInfo, "0x1234567890123456789012345678901234567890");

      expect(message).toContain(
        "api.example.com wants you to sign in with your eip155:8453 account:",
      );
      expect(message).toContain("0x1234567890123456789012345678901234567890");
      expect(message).toContain("Sign in to access premium content");
    });

    it("should include all required fields", () => {
      const message = createSIWxMessage(serverInfo, "0x1234567890123456789012345678901234567890");

      expect(message).toContain("URI: https://api.example.com/resource");
      expect(message).toContain("Version: 1");
      expect(message).toContain("Chain ID: eip155:8453");
      expect(message).toContain("Nonce: abc123");
      expect(message).toContain("Issued At: 2025-01-01T00:00:00.000Z");
    });
  });

  describe("createSIWxTypedData", () => {
    const serverInfo: SIWxExtensionInfo = {
      domain: "api.example.com",
      uri: "https://api.example.com/resource",
      statement: "Sign in to access premium content",
      version: "1",
      chainId: "eip155:8453",
      nonce: "abc123",
      issuedAt: "2025-01-01T00:00:00.000Z",
      resources: ["https://api.example.com/resource"],
    };

    it("should create valid EIP-712 typed data", () => {
      const typedData = createSIWxTypedData(
        serverInfo,
        "0x1234567890123456789012345678901234567890",
      );

      expect(typedData.domain.name).toBe("api.example.com");
      expect(typedData.domain.version).toBe("1");
      expect(typedData.domain.chainId).toBe(8453);
      expect(typedData.primaryType).toBe("SIWx");
    });

    it("should include correct types", () => {
      const typedData = createSIWxTypedData(
        serverInfo,
        "0x1234567890123456789012345678901234567890",
      );

      expect(typedData.types.SIWx).toBeDefined();
      expect(typedData.types.SIWx).toContainEqual({ name: "domain", type: "string" });
      expect(typedData.types.SIWx).toContainEqual({ name: "address", type: "address" });
      expect(typedData.types.SIWx).toContainEqual({ name: "nonce", type: "string" });
    });

    it("should include message with all fields", () => {
      const typedData = createSIWxTypedData(
        serverInfo,
        "0x1234567890123456789012345678901234567890",
      );

      expect(typedData.message.domain).toBe("api.example.com");
      expect(typedData.message.address).toBe("0x1234567890123456789012345678901234567890");
      expect(typedData.message.statement).toBe("Sign in to access premium content");
      expect(typedData.message.uri).toBe("https://api.example.com/resource");
      expect(typedData.message.chainId).toBe("eip155:8453");
      expect(typedData.message.nonce).toBe("abc123");
    });

    it("should handle different chain ID formats", () => {
      const solanaInfo = { ...serverInfo, chainId: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" };
      // For non-numeric chain IDs, it should still work (NaN or 0)
      const typedData = createSIWxTypedData(
        solanaInfo,
        "0x1234567890123456789012345678901234567890",
      );

      // Non-EVM chains may have NaN chainId, which is fine for signing
      expect(typedData.domain).toBeDefined();
    });
  });

  describe("signSIWxMessage", () => {
    it("should sign message using EIP-191", async () => {
      const mockSigner: SIWxSigner = {
        address: "0x1234567890123456789012345678901234567890",
        signMessage: vi.fn().mockResolvedValue("0xsignature123"),
      };

      const signature = await signSIWxMessage("Test message", mockSigner, {
        signatureScheme: "eip191",
      });

      expect(mockSigner.signMessage).toHaveBeenCalledWith("Test message");
      expect(signature).toBe("0xsignature123");
    });

    it("should default to EIP-191", async () => {
      const mockSigner: SIWxSigner = {
        address: "0x1234567890123456789012345678901234567890",
        signMessage: vi.fn().mockResolvedValue("0xsignature123"),
      };

      await signSIWxMessage("Test message", mockSigner);

      expect(mockSigner.signMessage).toHaveBeenCalled();
    });

    it("should sign message using EIP-712 when specified", async () => {
      const mockSigner: SIWxSigner = {
        address: "0x1234567890123456789012345678901234567890",
        signTypedData: vi.fn().mockResolvedValue("0xtypedsig"),
      };

      const serverInfo: SIWxExtensionInfo = {
        domain: "api.example.com",
        uri: "https://api.example.com/resource",
        version: "1",
        chainId: "eip155:8453",
        nonce: "abc123",
        issuedAt: "2025-01-01T00:00:00.000Z",
        resources: [],
      };

      const signature = await signSIWxMessage("Test message", mockSigner, {
        signatureScheme: "eip712",
        serverInfo,
      });

      expect(mockSigner.signTypedData).toHaveBeenCalled();
      expect(signature).toBe("0xtypedsig");
    });

    it("should throw when EIP-712 requested without serverInfo", async () => {
      const mockSigner: SIWxSigner = {
        address: "0x1234567890123456789012345678901234567890",
        signTypedData: vi.fn(),
      };

      await expect(
        signSIWxMessage("Test message", mockSigner, { signatureScheme: "eip712" }),
      ).rejects.toThrow("serverInfo");
    });

    it("should throw when signer doesn't support required method", async () => {
      const mockSigner: SIWxSigner = {
        address: "0x1234567890123456789012345678901234567890",
        // No signMessage or signTypedData
      };

      await expect(signSIWxMessage("Test message", mockSigner)).rejects.toThrow("does not support");
    });

    it("should support SIWS (Solana) signing", async () => {
      const mockSigner: SIWxSigner = {
        address: "0x1234567890123456789012345678901234567890",
        signMessage: vi.fn().mockResolvedValue("base58signature"),
      };

      const signature = await signSIWxMessage("Test message", mockSigner, {
        signatureScheme: "siws",
      });

      expect(mockSigner.signMessage).toHaveBeenCalled();
      expect(signature).toBe("base58signature");
    });

    it("should throw for SEP-10 (Stellar) - not implemented", async () => {
      const mockSigner: SIWxSigner = {
        address: "0x1234567890123456789012345678901234567890",
        signMessage: vi.fn(),
      };

      await expect(
        signSIWxMessage("Test message", mockSigner, { signatureScheme: "sep10" }),
      ).rejects.toThrow("not yet implemented");
    });
  });

  describe("createSIWxPayload", () => {
    it("should create complete signed payload", async () => {
      const mockSigner: SIWxSigner = {
        address: "0x1234567890123456789012345678901234567890",
        signMessage: vi.fn().mockResolvedValue("0xsignature"),
      };

      const extension: SIWxExtension = {
        info: {
          domain: "api.example.com",
          uri: "https://api.example.com/resource",
          statement: "Sign in",
          version: "1",
          chainId: "eip155:8453",
          nonce: "abc123",
          issuedAt: "2025-01-01T00:00:00.000Z",
          resources: ["https://api.example.com/resource"],
        },
        schema: {},
      };

      const payload = await createSIWxPayload(extension, mockSigner);

      expect(payload.domain).toBe("api.example.com");
      expect(payload.address).toBe("0x1234567890123456789012345678901234567890");
      expect(payload.signature).toBe("0xsignature");
      expect(payload.nonce).toBe("abc123");
      expect(payload.uri).toBe("https://api.example.com/resource");
    });

    it("should use signature scheme from extension", async () => {
      const mockSigner: SIWxSigner = {
        address: "0x1234567890123456789012345678901234567890",
        signTypedData: vi.fn().mockResolvedValue("0xtypedsig"),
      };

      const extension: SIWxExtension = {
        info: {
          domain: "api.example.com",
          uri: "https://api.example.com/resource",
          version: "1",
          chainId: "eip155:8453",
          nonce: "abc123",
          issuedAt: "2025-01-01T00:00:00.000Z",
          resources: [],
          signatureScheme: "eip712",
        },
        schema: {},
      };

      const payload = await createSIWxPayload(extension, mockSigner);

      expect(mockSigner.signTypedData).toHaveBeenCalled();
      expect(payload.signature).toBe("0xtypedsig");
    });
  });

  describe("Constants", () => {
    it("should export correct extension key", () => {
      expect(SIWX_EXTENSION_KEY).toBe("siwx");
    });

    it("should export correct header name", () => {
      expect(SIWX_HEADER_NAME).toBe("X-T402-SIWx");
    });
  });
});
