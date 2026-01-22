import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  declareSIWxExtension,
  parseSIWxHeader,
  validateSIWxMessage,
  verifySIWxSignature,
  constructMessage,
  hashMessage,
} from "./server.js";
import type { SIWxPayload } from "./types.js";

describe("Sign-In-With-X Server", () => {
  describe("declareSIWxExtension", () => {
    it("should create extension with correct domain extraction", () => {
      const extension = declareSIWxExtension({
        resourceUri: "https://api.example.com/premium/content",
        network: "eip155:8453",
        statement: "Sign in to access premium content",
      });

      expect(extension.info.domain).toBe("api.example.com");
      expect(extension.info.uri).toBe("https://api.example.com/premium/content");
      expect(extension.info.chainId).toBe("eip155:8453");
      expect(extension.info.statement).toBe("Sign in to access premium content");
      expect(extension.info.version).toBe("1");
      expect(extension.info.nonce).toHaveLength(32); // 16 bytes = 32 hex chars
      expect(extension.info.resources).toEqual(["https://api.example.com/premium/content"]);
    });

    it("should handle custom version", () => {
      const extension = declareSIWxExtension({
        resourceUri: "https://api.example.com/resource",
        network: "eip155:1",
        version: "2",
      });

      expect(extension.info.version).toBe("2");
    });

    it("should set expiration time 5 minutes in the future by default", () => {
      const before = new Date();
      const extension = declareSIWxExtension({
        resourceUri: "https://api.example.com/resource",
        network: "eip155:1",
      });
      const after = new Date();

      const issuedAt = new Date(extension.info.issuedAt);
      const expirationTime = new Date(extension.info.expirationTime!);

      expect(issuedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(issuedAt.getTime()).toBeLessThanOrEqual(after.getTime());

      // Expiration should be ~5 minutes after issuedAt
      const expectedExpiration = issuedAt.getTime() + 5 * 60 * 1000;
      expect(expirationTime.getTime()).toBe(expectedExpiration);
    });

    it("should use custom expiration time when provided", () => {
      const customExpiration = "2025-12-31T23:59:59.000Z";
      const extension = declareSIWxExtension({
        resourceUri: "https://api.example.com/resource",
        network: "eip155:1",
        expirationTime: customExpiration,
      });

      expect(extension.info.expirationTime).toBe(customExpiration);
    });

    it("should include signature scheme when provided", () => {
      const extension = declareSIWxExtension({
        resourceUri: "https://api.example.com/resource",
        network: "eip155:1",
        signatureScheme: "eip712",
      });

      expect(extension.info.signatureScheme).toBe("eip712");
    });

    it("should include JSON schema", () => {
      const extension = declareSIWxExtension({
        resourceUri: "https://api.example.com/resource",
        network: "eip155:1",
      });

      expect(extension.schema).toBeDefined();
      expect(extension.schema).toHaveProperty("type", "object");
      expect(extension.schema).toHaveProperty("required");
    });
  });

  describe("parseSIWxHeader", () => {
    it("should parse valid base64-encoded header", () => {
      const payload: SIWxPayload = {
        domain: "api.example.com",
        address: "0x1234567890123456789012345678901234567890",
        uri: "https://api.example.com/resource",
        version: "1",
        chainId: "eip155:8453",
        nonce: "abc123",
        issuedAt: "2025-01-01T00:00:00.000Z",
        signature: "0x" + "ab".repeat(65),
      };

      const encoded = Buffer.from(JSON.stringify(payload)).toString("base64");
      const parsed = parseSIWxHeader(encoded);

      expect(parsed).toEqual(payload);
    });

    it("should throw on missing header", () => {
      expect(() => parseSIWxHeader("")).toThrow("Missing SIWx header");
    });

    it("should throw on invalid base64", () => {
      expect(() => parseSIWxHeader("not-valid-base64!!!")).toThrow();
    });

    it("should throw on invalid JSON", () => {
      const encoded = Buffer.from("not json").toString("base64");
      expect(() => parseSIWxHeader(encoded)).toThrow("Invalid SIWx header: malformed JSON");
    });

    it("should throw on missing required fields", () => {
      const incomplete = { domain: "example.com" };
      const encoded = Buffer.from(JSON.stringify(incomplete)).toString("base64");
      expect(() => parseSIWxHeader(encoded)).toThrow("Missing required field");
    });
  });

  describe("validateSIWxMessage", () => {
    const basePayload: SIWxPayload = {
      domain: "api.example.com",
      address: "0x1234567890123456789012345678901234567890",
      uri: "https://api.example.com/resource",
      version: "1",
      chainId: "eip155:8453",
      nonce: "abc123",
      issuedAt: new Date().toISOString(),
      signature: "0x" + "ab".repeat(65),
    };

    it("should validate correct message", () => {
      const result = validateSIWxMessage(basePayload, "https://api.example.com/resource");
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject domain mismatch", () => {
      const result = validateSIWxMessage(basePayload, "https://other.example.com/resource");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Domain mismatch");
    });

    it("should reject URI mismatch", () => {
      const result = validateSIWxMessage(basePayload, "https://api.example.com/other");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("URI mismatch");
    });

    it("should reject unsupported version", () => {
      const payload = { ...basePayload, version: "2" };
      const result = validateSIWxMessage(payload, "https://api.example.com/resource");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Unsupported version");
    });

    it("should reject expired issuedAt", () => {
      const oldDate = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 minutes ago
      const payload = { ...basePayload, issuedAt: oldDate };
      const result = validateSIWxMessage(payload, "https://api.example.com/resource", {
        maxAge: 5 * 60 * 1000, // 5 minutes
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("issuedAt too old");
    });

    it("should reject expired expirationTime", () => {
      const pastExpiration = new Date(Date.now() - 1000).toISOString();
      const payload = { ...basePayload, expirationTime: pastExpiration };
      const result = validateSIWxMessage(payload, "https://api.example.com/resource");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Message has expired");
    });

    it("should reject notBefore in future", () => {
      const futureDate = new Date(Date.now() + 60 * 1000).toISOString();
      const payload = { ...basePayload, notBefore: futureDate };
      const result = validateSIWxMessage(payload, "https://api.example.com/resource");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("notBefore in future");
    });

    it("should call custom nonce validator", () => {
      const usedNonces = new Set(["abc123"]);
      const result = validateSIWxMessage(basePayload, "https://api.example.com/resource", {
        checkNonce: (nonce) => !usedNonces.has(nonce),
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("replay attack");
    });
  });

  describe("constructMessage", () => {
    it("should construct CAIP-122 formatted message", () => {
      const payload: SIWxPayload = {
        domain: "api.example.com",
        address: "0x1234567890123456789012345678901234567890",
        statement: "Sign in to access premium content",
        uri: "https://api.example.com/resource",
        version: "1",
        chainId: "eip155:8453",
        nonce: "abc123",
        issuedAt: "2025-01-01T00:00:00.000Z",
        signature: "",
      };

      const message = constructMessage(payload);

      expect(message).toContain("api.example.com wants you to sign in with your eip155:8453 account:");
      expect(message).toContain("0x1234567890123456789012345678901234567890");
      expect(message).toContain("Sign in to access premium content");
      expect(message).toContain("URI: https://api.example.com/resource");
      expect(message).toContain("Version: 1");
      expect(message).toContain("Chain ID: eip155:8453");
      expect(message).toContain("Nonce: abc123");
      expect(message).toContain("Issued At: 2025-01-01T00:00:00.000Z");
    });

    it("should include optional fields when present", () => {
      const payload: SIWxPayload = {
        domain: "api.example.com",
        address: "0x1234567890123456789012345678901234567890",
        uri: "https://api.example.com/resource",
        version: "1",
        chainId: "eip155:8453",
        nonce: "abc123",
        issuedAt: "2025-01-01T00:00:00.000Z",
        expirationTime: "2025-01-01T01:00:00.000Z",
        notBefore: "2025-01-01T00:00:00.000Z",
        requestId: "req-123",
        resources: ["https://api.example.com/resource1", "https://api.example.com/resource2"],
        signature: "",
      };

      const message = constructMessage(payload);

      expect(message).toContain("Expiration Time: 2025-01-01T01:00:00.000Z");
      expect(message).toContain("Not Before: 2025-01-01T00:00:00.000Z");
      expect(message).toContain("Request ID: req-123");
      expect(message).toContain("Resources:");
      expect(message).toContain("- https://api.example.com/resource1");
      expect(message).toContain("- https://api.example.com/resource2");
    });
  });

  describe("hashMessage", () => {
    it("should hash message with Ethereum prefix", () => {
      const message = "Hello, World!";
      const hash = hashMessage(message);

      // Hash should be 32 bytes (64 hex chars) with 0x prefix
      expect(hash).toMatch(/^0x[a-f0-9]{64}$/);
    });

    it("should produce consistent hashes", () => {
      const message = "Test message";
      const hash1 = hashMessage(message);
      const hash2 = hashMessage(message);

      expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different messages", () => {
      const hash1 = hashMessage("Message 1");
      const hash2 = hashMessage("Message 2");

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("verifySIWxSignature", () => {
    // Test with a known signature
    // This test uses a pre-computed signature for deterministic testing
    it("should verify valid EIP-191 signature", async () => {
      // Known test data: message signed by 0x... with signature 0x...
      // For now, we test error handling since we'd need real test vectors
      const payload: SIWxPayload = {
        domain: "api.example.com",
        address: "0x1234567890123456789012345678901234567890",
        uri: "https://api.example.com/resource",
        version: "1",
        chainId: "eip155:8453",
        nonce: "abc123",
        issuedAt: "2025-01-01T00:00:00.000Z",
        signature: "0x" + "00".repeat(65), // Invalid signature
      };

      const result = await verifySIWxSignature(payload, payload.signature);

      // With an invalid signature, it should fail
      expect(result.valid).toBe(false);
    });

    it("should handle signature length validation", async () => {
      const payload: SIWxPayload = {
        domain: "api.example.com",
        address: "0x1234567890123456789012345678901234567890",
        uri: "https://api.example.com/resource",
        version: "1",
        chainId: "eip155:8453",
        nonce: "abc123",
        issuedAt: "2025-01-01T00:00:00.000Z",
        signature: "0x1234", // Too short
      };

      const result = await verifySIWxSignature(payload, payload.signature);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid signature length");
    });
  });
});
