import { describe, it, expect } from "vitest";
import {
  isX402Format,
  isT402Format,
  hasVersionField,
  x402ToT402,
  t402ToX402,
  normalizeToT402,
} from "./x402Compat";

describe("x402 Compatibility Shim", () => {
  // --- Format detection ---

  describe("isX402Format", () => {
    it("returns true for x402 payload", () => {
      expect(isX402Format({ x402Version: 2, accepted: {} })).toBe(true);
    });

    it("returns false for T402 payload", () => {
      expect(isX402Format({ t402Version: 2, accepted: {} })).toBe(false);
    });

    it("returns false for payload with both version fields", () => {
      expect(isX402Format({ x402Version: 2, t402Version: 2 })).toBe(false);
    });

    it("returns false for payload with no version field", () => {
      expect(isX402Format({ accepted: {} })).toBe(false);
    });
  });

  describe("isT402Format", () => {
    it("returns true for T402 payload", () => {
      expect(isT402Format({ t402Version: 2, accepted: {} })).toBe(true);
    });

    it("returns false for x402 payload", () => {
      expect(isT402Format({ x402Version: 2, accepted: {} })).toBe(false);
    });
  });

  describe("hasVersionField", () => {
    it("returns true for t402Version", () => {
      expect(hasVersionField({ t402Version: 2 })).toBe(true);
    });

    it("returns true for x402Version", () => {
      expect(hasVersionField({ x402Version: 2 })).toBe(true);
    });

    it("returns false for no version", () => {
      expect(hasVersionField({ accepted: {} })).toBe(false);
    });
  });

  // --- Translation ---

  describe("x402ToT402", () => {
    it("converts x402Version to t402Version", () => {
      const input = { x402Version: 2, accepted: { scheme: "exact" }, payload: { sig: "0x" } };
      const result = x402ToT402(input);

      expect(result).toHaveProperty("t402Version", 2);
      expect(result).not.toHaveProperty("x402Version");
      expect(result).toHaveProperty("accepted");
      expect(result).toHaveProperty("payload");
    });

    it("preserves all other fields", () => {
      const input = {
        x402Version: 2,
        resource: { url: "https://api.example.com" },
        accepted: { scheme: "exact", network: "eip155:42161" },
        payload: { signature: "0xabc" },
        extensions: { bazaar: { listed: true } },
      };
      const result = x402ToT402(input);

      expect(result.t402Version).toBe(2);
      expect(result.resource).toEqual(input.resource);
      expect(result.accepted).toEqual(input.accepted);
      expect(result.payload).toEqual(input.payload);
      expect(result.extensions).toEqual(input.extensions);
    });

    it("returns T402 payload unchanged", () => {
      const input = { t402Version: 2, accepted: {} };
      const result = x402ToT402(input);
      expect(result).toEqual(input);
    });

    it("returns payload without version unchanged", () => {
      const input = { accepted: {} };
      const result = x402ToT402(input);
      expect(result).toEqual(input);
    });
  });

  describe("t402ToX402", () => {
    it("converts t402Version to x402Version", () => {
      const input = { t402Version: 2, accepted: { scheme: "exact" } };
      const result = t402ToX402(input);

      expect(result).toHaveProperty("x402Version", 2);
      expect(result).not.toHaveProperty("t402Version");
      expect(result).toHaveProperty("accepted");
    });

    it("returns x402 payload unchanged", () => {
      const input = { x402Version: 2, accepted: {} };
      const result = t402ToX402(input);
      expect(result).toEqual(input);
    });
  });

  describe("normalizeToT402", () => {
    it("normalizes x402 to T402", () => {
      const result = normalizeToT402({ x402Version: 2, accepted: {} });
      expect(result).toHaveProperty("t402Version", 2);
      expect(result).not.toHaveProperty("x402Version");
    });

    it("passes T402 through unchanged", () => {
      const input = { t402Version: 2, accepted: {} };
      expect(normalizeToT402(input)).toEqual(input);
    });

    it("passes versionless through unchanged", () => {
      const input = { accepted: {} };
      expect(normalizeToT402(input)).toEqual(input);
    });
  });
});
