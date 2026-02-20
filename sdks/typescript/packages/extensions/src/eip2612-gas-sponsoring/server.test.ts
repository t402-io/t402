import { describe, it, expect } from "vitest";
import {
  declareEip2612GasSponsorExtension,
  parseEip2612GasSponsorHeader,
  validateEip2612GasSponsorPayload,
} from "./server.js";
import {
  extractEip2612GasSponsorPayload,
  validateAndExtractPermit,
  buildPermitCallData,
} from "./facilitator.js";
import type { Eip2612GasSponsorPayload, Eip2612GasSponsorExtensionInfo } from "./types.js";

describe("EIP-2612 Gas Sponsoring Server", () => {
  describe("declareEip2612GasSponsorExtension", () => {
    it("should create extension with provided options", () => {
      const extension = declareEip2612GasSponsorExtension({
        sponsoredNetworks: ["eip155:8453", "eip155:42161"],
        maxAmount: "1000000000",
        sponsorAddress: "0xFacilitator0000000000000000000000000000",
      });

      expect(extension.info.sponsoredNetworks).toEqual(["eip155:8453", "eip155:42161"]);
      expect(extension.info.maxAmount).toBe("1000000000");
      expect(extension.info.sponsorAddress).toBe("0xFacilitator0000000000000000000000000000");
    });

    it("should default permitDeadline to 300 seconds", () => {
      const extension = declareEip2612GasSponsorExtension({
        sponsoredNetworks: ["eip155:8453"],
        maxAmount: "1000000000",
        sponsorAddress: "0xSponsor",
      });

      expect(extension.info.permitDeadline).toBe(300);
    });

    it("should use custom permitDeadline when provided", () => {
      const extension = declareEip2612GasSponsorExtension({
        sponsoredNetworks: ["eip155:8453"],
        maxAmount: "1000000000",
        permitDeadline: 600,
        sponsorAddress: "0xSponsor",
      });

      expect(extension.info.permitDeadline).toBe(600);
    });

    it("should include JSON schema", () => {
      const extension = declareEip2612GasSponsorExtension({
        sponsoredNetworks: ["eip155:8453"],
        maxAmount: "1000000000",
        sponsorAddress: "0xSponsor",
      });

      expect(extension.schema).toBeDefined();
      expect(extension.schema).toHaveProperty("type", "object");
      expect(extension.schema).toHaveProperty("required");
    });
  });

  describe("parseEip2612GasSponsorHeader", () => {
    const validPayload: Eip2612GasSponsorPayload = {
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

    it("should parse valid base64-encoded header", () => {
      const encoded = Buffer.from(JSON.stringify(validPayload)).toString("base64");
      const parsed = parseEip2612GasSponsorHeader(encoded);

      expect(parsed).toEqual(validPayload);
    });

    it("should throw on missing header", () => {
      expect(() => parseEip2612GasSponsorHeader("")).toThrow("Missing EIP-2612 gas sponsor header");
    });

    it("should throw on invalid JSON", () => {
      const encoded = Buffer.from("not json").toString("base64");
      expect(() => parseEip2612GasSponsorHeader(encoded)).toThrow(
        "Invalid EIP-2612 gas sponsor header: malformed JSON",
      );
    });

    it("should throw on missing required fields", () => {
      const incomplete = { network: "eip155:8453" };
      const encoded = Buffer.from(JSON.stringify(incomplete)).toString("base64");
      expect(() => parseEip2612GasSponsorHeader(encoded)).toThrow("Missing required field");
    });
  });

  describe("validateEip2612GasSponsorPayload", () => {
    const nowMs = 1700000000 * 1000;
    const nowFn = () => nowMs;

    const extensionInfo: Eip2612GasSponsorExtensionInfo = {
      sponsoredNetworks: ["eip155:8453", "eip155:42161"],
      maxAmount: "1000000000",
      permitDeadline: 300,
      sponsorAddress: "0xFacilitator0000000000000000000000000000",
    };

    const validPayload: Eip2612GasSponsorPayload = {
      network: "eip155:8453",
      permitSignature: "0x" + "ab".repeat(65),
      owner: "0x1234567890123456789012345678901234567890",
      spender: "0xFacilitator0000000000000000000000000000",
      value: "1000000",
      deadline: 1700000000 + 200,
      v: 27,
      r: "0x" + "ab".repeat(32),
      s: "0x" + "cd".repeat(32),
    };

    it("should validate correct payload", () => {
      const result = validateEip2612GasSponsorPayload(validPayload, extensionInfo, { now: nowFn });
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject unsupported network", () => {
      const payload = { ...validPayload, network: "eip155:1" };
      const result = validateEip2612GasSponsorPayload(payload, extensionInfo, { now: nowFn });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not in sponsored networks");
    });

    it("should reject value exceeding maxAmount", () => {
      const payload = { ...validPayload, value: "2000000000" };
      const result = validateEip2612GasSponsorPayload(payload, extensionInfo, { now: nowFn });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceeds maximum amount");
    });

    it("should reject expired deadline", () => {
      const payload = { ...validPayload, deadline: 1700000000 - 10 };
      const result = validateEip2612GasSponsorPayload(payload, extensionInfo, { now: nowFn });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("deadline has expired");
    });

    it("should reject deadline exceeding permitDeadline window", () => {
      const payload = { ...validPayload, deadline: 1700000000 + 600 };
      const result = validateEip2612GasSponsorPayload(payload, extensionInfo, { now: nowFn });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceeds maximum allowed deadline");
    });

    it("should reject spender mismatch", () => {
      const payload = { ...validPayload, spender: "0xWrongAddress000000000000000000000000000" };
      const result = validateEip2612GasSponsorPayload(payload, extensionInfo, { now: nowFn });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("does not match sponsor address");
    });

    it("should reject invalid permit signature length", () => {
      const payload = { ...validPayload, permitSignature: "0x1234" };
      const result = validateEip2612GasSponsorPayload(payload, extensionInfo, { now: nowFn });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid permit signature length");
    });

    it("should reject invalid v value", () => {
      const payload = { ...validPayload, v: 25 };
      const result = validateEip2612GasSponsorPayload(payload, extensionInfo, { now: nowFn });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid v value");
    });

    it("should reject invalid r length", () => {
      const payload = { ...validPayload, r: "0x1234" };
      const result = validateEip2612GasSponsorPayload(payload, extensionInfo, { now: nowFn });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid r length");
    });

    it("should reject invalid s length", () => {
      const payload = { ...validPayload, s: "0x5678" };
      const result = validateEip2612GasSponsorPayload(payload, extensionInfo, { now: nowFn });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid s length");
    });

    it("should accept case-insensitive spender address match", () => {
      const info = {
        ...extensionInfo,
        sponsorAddress: "0xfacilitator0000000000000000000000000000",
      };
      const payload = {
        ...validPayload,
        spender: "0xFacilitator0000000000000000000000000000",
      };
      const result = validateEip2612GasSponsorPayload(payload, info, { now: nowFn });
      expect(result.valid).toBe(true);
    });

    it("should handle permitSignature without 0x prefix", () => {
      const payload = { ...validPayload, permitSignature: "ab".repeat(65) };
      const result = validateEip2612GasSponsorPayload(payload, extensionInfo, { now: nowFn });
      expect(result.valid).toBe(true);
    });

    it("should handle r and s without 0x prefix", () => {
      const payload = { ...validPayload, r: "ab".repeat(32), s: "cd".repeat(32) };
      const result = validateEip2612GasSponsorPayload(payload, extensionInfo, { now: nowFn });
      expect(result.valid).toBe(true);
    });
  });

  describe("extractEip2612GasSponsorPayload (facilitator)", () => {
    it("should extract payload from extensions map", () => {
      const extensions = {
        eip2612GasSponsoring: {
          network: "eip155:8453",
          permitSignature: "0x" + "ab".repeat(65),
          owner: "0xOwner",
          spender: "0xSpender",
          value: "1000000",
          deadline: 1700000200,
          v: 27,
          r: "0x" + "ab".repeat(32),
          s: "0x" + "cd".repeat(32),
        },
      };

      const result = extractEip2612GasSponsorPayload(extensions);
      expect(result).not.toBeNull();
      expect(result!.network).toBe("eip155:8453");
      expect(result!.owner).toBe("0xOwner");
    });

    it("should return null when extensions is undefined", () => {
      const result = extractEip2612GasSponsorPayload(undefined);
      expect(result).toBeNull();
    });

    it("should return null when extension key is missing", () => {
      const result = extractEip2612GasSponsorPayload({ otherExtension: {} });
      expect(result).toBeNull();
    });

    it("should return null when required fields are missing", () => {
      const extensions = {
        eip2612GasSponsoring: { network: "eip155:8453" },
      };
      const result = extractEip2612GasSponsorPayload(extensions);
      expect(result).toBeNull();
    });
  });

  describe("validateAndExtractPermit (facilitator)", () => {
    const extensionInfo: Eip2612GasSponsorExtensionInfo = {
      sponsoredNetworks: ["eip155:8453"],
      maxAmount: "1000000000",
      permitDeadline: 300,
      sponsorAddress: "0xFacilitator0000000000000000000000000000",
    };

    it("should validate and extract valid permit", () => {
      const extensions = {
        eip2612GasSponsoring: {
          network: "eip155:8453",
          permitSignature: "0x" + "ab".repeat(65),
          owner: "0xOwner",
          spender: "0xFacilitator0000000000000000000000000000",
          value: "1000000",
          deadline: Math.floor(Date.now() / 1000) + 200,
          v: 27,
          r: "0x" + "ab".repeat(32),
          s: "0x" + "cd".repeat(32),
        },
      };

      const result = validateAndExtractPermit(extensions, extensionInfo);
      expect(result.valid).toBe(true);
      expect(result.payload).toBeDefined();
      expect(result.payload!.network).toBe("eip155:8453");
    });

    it("should return error when extension is missing", () => {
      const result = validateAndExtractPermit({}, extensionInfo);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Missing or invalid");
    });
  });

  describe("buildPermitCallData (facilitator)", () => {
    it("should build correct permit call parameters", () => {
      const payload: Eip2612GasSponsorPayload = {
        network: "eip155:8453",
        permitSignature: "0x" + "ab".repeat(65),
        owner: "0xOwner",
        spender: "0xSpender",
        value: "1000000",
        deadline: 1700000200,
        v: 27,
        r: "0x" + "ab".repeat(32),
        s: "0x" + "cd".repeat(32),
      };

      const callData = buildPermitCallData(payload);
      expect(callData.owner).toBe("0xOwner");
      expect(callData.spender).toBe("0xSpender");
      expect(callData.value).toBe("1000000");
      expect(callData.deadline).toBe(1700000200);
      expect(callData.v).toBe(27);
      expect(callData.r).toBe("0x" + "ab".repeat(32));
      expect(callData.s).toBe("0x" + "cd".repeat(32));
    });
  });
});
