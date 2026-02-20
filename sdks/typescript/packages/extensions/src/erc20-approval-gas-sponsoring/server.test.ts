import { describe, it, expect } from "vitest";
import {
  declareERC20ApprovalGasSponsorExtension,
  parseERC20ApprovalGasSponsorHeader,
  validateERC20ApprovalGasSponsorPayload,
} from "./server.js";
import {
  extractERC20ApprovalGasSponsorPayload,
  processERC20ApprovalPayload,
  validateAndExtractApproval,
  decodeApproveCalldata,
} from "./facilitator.js";
import type {
  ERC20ApprovalGasSponsorPayload,
  ERC20ApprovalGasSponsorExtensionInfo,
} from "./types.js";

describe("ERC-20 Approval Gas Sponsoring Server", () => {
  describe("declareERC20ApprovalGasSponsorExtension", () => {
    it("should create extension with provided options", () => {
      const extension = declareERC20ApprovalGasSponsorExtension({
        sponsoredNetworks: ["eip155:8453", "eip155:42161"],
        maxAmount: "1000000000",
        sponsorAddress: "0xFacilitator0000000000000000000000000000",
        requiresAtomicBatch: true,
      });

      expect(extension.info.sponsoredNetworks).toEqual(["eip155:8453", "eip155:42161"]);
      expect(extension.info.maxAmount).toBe("1000000000");
      expect(extension.info.sponsorAddress).toBe("0xFacilitator0000000000000000000000000000");
      expect(extension.info.requiresAtomicBatch).toBe(true);
    });

    it("should default requiresAtomicBatch to false", () => {
      const extension = declareERC20ApprovalGasSponsorExtension({
        sponsoredNetworks: ["eip155:8453"],
        maxAmount: "1000000000",
        sponsorAddress: "0xSponsor0000000000000000000000000000000000",
      });

      expect(extension.info.requiresAtomicBatch).toBe(false);
    });

    it("should include permit2Address when provided", () => {
      const extension = declareERC20ApprovalGasSponsorExtension({
        sponsoredNetworks: ["eip155:8453"],
        maxAmount: "1000000000",
        sponsorAddress: "0xSponsor0000000000000000000000000000000000",
        permit2Address: "0xPermit2000000000000000000000000000000000",
      });

      expect(extension.info.permit2Address).toBe("0xPermit2000000000000000000000000000000000");
    });

    it("should include JSON schema", () => {
      const extension = declareERC20ApprovalGasSponsorExtension({
        sponsoredNetworks: ["eip155:8453"],
        maxAmount: "1000000000",
        sponsorAddress: "0xSponsor0000000000000000000000000000000000",
      });

      expect(extension.schema).toBeDefined();
      expect(extension.schema).toHaveProperty("type", "object");
      expect(extension.schema).toHaveProperty("required");
    });
  });

  describe("parseERC20ApprovalGasSponsorHeader", () => {
    const validPayload: ERC20ApprovalGasSponsorPayload = {
      network: "eip155:8453",
      from: "0x1234567890123456789012345678901234567890",
      asset: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      amount: "1000000",
      signedApprovalTx: "0x" + "ab".repeat(100),
      chainId: 8453,
    };

    it("should parse valid base64-encoded header", () => {
      const encoded = Buffer.from(JSON.stringify(validPayload)).toString("base64");
      const parsed = parseERC20ApprovalGasSponsorHeader(encoded);

      expect(parsed).toEqual(validPayload);
    });

    it("should throw on missing header", () => {
      expect(() => parseERC20ApprovalGasSponsorHeader("")).toThrow(
        "Missing ERC-20 approval gas sponsor header",
      );
    });

    it("should throw on invalid JSON", () => {
      const encoded = Buffer.from("not json").toString("base64");
      expect(() => parseERC20ApprovalGasSponsorHeader(encoded)).toThrow(
        "Invalid ERC-20 approval gas sponsor header: malformed JSON",
      );
    });

    it("should throw on missing required fields", () => {
      const incomplete = { network: "eip155:8453" };
      const encoded = Buffer.from(JSON.stringify(incomplete)).toString("base64");
      expect(() => parseERC20ApprovalGasSponsorHeader(encoded)).toThrow("Missing required field");
    });
  });

  describe("validateERC20ApprovalGasSponsorPayload", () => {
    const extensionInfo: ERC20ApprovalGasSponsorExtensionInfo = {
      sponsoredNetworks: ["eip155:8453", "eip155:42161"],
      maxAmount: "1000000000",
      sponsorAddress: "0xFacilitator0000000000000000000000000000",
      requiresAtomicBatch: true,
    };

    const validPayload: ERC20ApprovalGasSponsorPayload = {
      network: "eip155:8453",
      from: "0x1234567890123456789012345678901234567890",
      asset: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      amount: "1000000",
      signedApprovalTx: "0x" + "ab".repeat(100),
      chainId: 8453,
    };

    it("should validate correct payload", () => {
      const result = validateERC20ApprovalGasSponsorPayload(validPayload, extensionInfo);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject unsupported network", () => {
      const payload = { ...validPayload, network: "eip155:1" };
      const result = validateERC20ApprovalGasSponsorPayload(payload, extensionInfo);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not in sponsored networks");
    });

    it("should reject amount exceeding maxAmount", () => {
      const payload = { ...validPayload, amount: "2000000000" };
      const result = validateERC20ApprovalGasSponsorPayload(payload, extensionInfo);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceeds maximum amount");
    });

    it("should reject mismatched chainId when expectedChainIds provided", () => {
      const payload = { ...validPayload, chainId: 1 };
      const result = validateERC20ApprovalGasSponsorPayload(payload, extensionInfo, {
        expectedChainIds: { "eip155:8453": 8453 },
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("does not match expected chain ID");
    });

    it("should accept correct chainId when expectedChainIds provided", () => {
      const result = validateERC20ApprovalGasSponsorPayload(validPayload, extensionInfo, {
        expectedChainIds: { "eip155:8453": 8453 },
      });
      expect(result.valid).toBe(true);
    });

    it("should reject empty signedApprovalTx", () => {
      const payload = { ...validPayload, signedApprovalTx: "0x" };
      const result = validateERC20ApprovalGasSponsorPayload(payload, extensionInfo);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("empty");
    });

    it("should reject non-hex signedApprovalTx", () => {
      const payload = { ...validPayload, signedApprovalTx: "0xnothex" };
      const result = validateERC20ApprovalGasSponsorPayload(payload, extensionInfo);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not valid hex");
    });

    it("should reject invalid from address", () => {
      const payload = { ...validPayload, from: "0x1234" };
      const result = validateERC20ApprovalGasSponsorPayload(payload, extensionInfo);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid from address");
    });

    it("should reject invalid asset address", () => {
      const payload = { ...validPayload, asset: "0xshort" };
      const result = validateERC20ApprovalGasSponsorPayload(payload, extensionInfo);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid asset address");
    });
  });

  describe("extractERC20ApprovalGasSponsorPayload (facilitator)", () => {
    it("should extract payload from extensions map", () => {
      const extensions = {
        erc20ApprovalGasSponsoring: {
          network: "eip155:8453",
          from: "0x1234567890123456789012345678901234567890",
          asset: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
          amount: "1000000",
          signedApprovalTx: "0x" + "ab".repeat(100),
          chainId: 8453,
        },
      };

      const result = extractERC20ApprovalGasSponsorPayload(extensions);
      expect(result).not.toBeNull();
      expect(result!.network).toBe("eip155:8453");
      expect(result!.from).toBe("0x1234567890123456789012345678901234567890");
    });

    it("should extract payload with optional nonce", () => {
      const extensions = {
        erc20ApprovalGasSponsoring: {
          network: "eip155:8453",
          from: "0x1234567890123456789012345678901234567890",
          asset: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
          amount: "1000000",
          signedApprovalTx: "0x" + "ab".repeat(100),
          chainId: 8453,
          nonce: 5,
        },
      };

      const result = extractERC20ApprovalGasSponsorPayload(extensions);
      expect(result).not.toBeNull();
      expect(result!.nonce).toBe(5);
    });

    it("should return null when extensions is undefined", () => {
      const result = extractERC20ApprovalGasSponsorPayload(undefined);
      expect(result).toBeNull();
    });

    it("should return null when extension key is missing", () => {
      const result = extractERC20ApprovalGasSponsorPayload({ otherExtension: {} });
      expect(result).toBeNull();
    });

    it("should return null when required fields are missing", () => {
      const extensions = {
        erc20ApprovalGasSponsoring: { network: "eip155:8453" },
      };
      const result = extractERC20ApprovalGasSponsorPayload(extensions);
      expect(result).toBeNull();
    });
  });

  describe("processERC20ApprovalPayload (facilitator)", () => {
    const extensionInfo: ERC20ApprovalGasSponsorExtensionInfo = {
      sponsoredNetworks: ["eip155:8453"],
      maxAmount: "1000000000",
      sponsorAddress: "0xFacilitator0000000000000000000000000000",
      requiresAtomicBatch: true,
    };

    it("should validate a correct payload", () => {
      const payload: ERC20ApprovalGasSponsorPayload = {
        network: "eip155:8453",
        from: "0x1234567890123456789012345678901234567890",
        asset: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        amount: "1000000",
        signedApprovalTx: "0x" + "ab".repeat(100),
        chainId: 8453,
      };

      const result = processERC20ApprovalPayload(payload, extensionInfo);
      expect(result.valid).toBe(true);
    });

    it("should reject payload with too-short signedApprovalTx", () => {
      const payload: ERC20ApprovalGasSponsorPayload = {
        network: "eip155:8453",
        from: "0x1234567890123456789012345678901234567890",
        asset: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        amount: "1000000",
        signedApprovalTx: "0xab",
        chainId: 8453,
      };

      const result = processERC20ApprovalPayload(payload, extensionInfo);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("too short");
    });
  });

  describe("validateAndExtractApproval (facilitator)", () => {
    const extensionInfo: ERC20ApprovalGasSponsorExtensionInfo = {
      sponsoredNetworks: ["eip155:8453"],
      maxAmount: "1000000000",
      sponsorAddress: "0xFacilitator0000000000000000000000000000",
      requiresAtomicBatch: true,
    };

    it("should validate and extract valid approval", () => {
      const extensions = {
        erc20ApprovalGasSponsoring: {
          network: "eip155:8453",
          from: "0x1234567890123456789012345678901234567890",
          asset: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
          amount: "1000000",
          signedApprovalTx: "0x" + "ab".repeat(100),
          chainId: 8453,
        },
      };

      const result = validateAndExtractApproval(extensions, extensionInfo);
      expect(result.valid).toBe(true);
      expect(result.payload).toBeDefined();
      expect(result.payload!.network).toBe("eip155:8453");
    });

    it("should return error when extension is missing", () => {
      const result = validateAndExtractApproval({}, extensionInfo);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Missing or invalid");
    });
  });

  describe("decodeApproveCalldata (facilitator)", () => {
    it("should decode valid approve calldata", () => {
      // approve(0x1234567890123456789012345678901234567890, 1000000)
      const spender = "1234567890123456789012345678901234567890";
      const paddedSpender = spender.padStart(64, "0");
      const amount = BigInt("1000000").toString(16).padStart(64, "0");
      const calldata = "0x095ea7b3" + paddedSpender + amount;

      const decoded = decodeApproveCalldata(calldata);
      expect(decoded).not.toBeNull();
      expect(decoded!.spender).toBe("0x" + spender);
      expect(decoded!.amount).toBe("1000000");
    });

    it("should return null for non-approve function selector", () => {
      const calldata = "0xdeadbeef" + "00".repeat(64);
      const decoded = decodeApproveCalldata(calldata);
      expect(decoded).toBeNull();
    });

    it("should return null for calldata too short", () => {
      const decoded = decodeApproveCalldata("0x095ea7b3");
      expect(decoded).toBeNull();
    });

    it("should handle calldata without 0x prefix", () => {
      const spender = "1234567890123456789012345678901234567890";
      const paddedSpender = spender.padStart(64, "0");
      const amount = BigInt("500000").toString(16).padStart(64, "0");
      const calldata = "095ea7b3" + paddedSpender + amount;

      const decoded = decodeApproveCalldata(calldata);
      expect(decoded).not.toBeNull();
      expect(decoded!.spender).toBe("0x" + spender);
      expect(decoded!.amount).toBe("500000");
    });

    it("should decode zero amount", () => {
      const spender = "1234567890123456789012345678901234567890";
      const paddedSpender = spender.padStart(64, "0");
      const amount = "0".repeat(64);
      const calldata = "0x095ea7b3" + paddedSpender + amount;

      const decoded = decodeApproveCalldata(calldata);
      expect(decoded).not.toBeNull();
      expect(decoded!.amount).toBe("0");
    });
  });
});
