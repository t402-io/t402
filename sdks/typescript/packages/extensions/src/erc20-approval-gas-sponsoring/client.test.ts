import { describe, it, expect } from "vitest";
import {
  encodeApproveCalldata,
  createERC20ApprovalGasSponsorPayload,
  encodeERC20ApprovalGasSponsorHeader,
  ERC20_APPROVAL_GAS_SPONSOR_EXTENSION_KEY,
  ERC20_APPROVAL_GAS_SPONSOR_HEADER_NAME,
  APPROVE_FUNCTION_SELECTOR,
} from "./client.js";
import type {
  ERC20ApprovalGasSponsorPayload,
  ERC20ApprovalGasSponsorExtensionInfo,
} from "./types.js";

describe("ERC-20 Approval Gas Sponsoring Client", () => {
  describe("encodeApproveCalldata", () => {
    it("should encode approve calldata with correct function selector", () => {
      const calldata = encodeApproveCalldata(
        "0xFacilitator0000000000000000000000000000",
        "1000000",
      );

      expect(calldata.startsWith("0x095ea7b3")).toBe(true);
    });

    it("should encode spender address padded to 32 bytes", () => {
      const spender = "0x1234567890123456789012345678901234567890";
      const calldata = encodeApproveCalldata(spender, "1000000");

      // Function selector (8 chars) + 32 bytes spender (64 chars) + 32 bytes amount (64 chars)
      expect(calldata.length).toBe(2 + 8 + 64 + 64); // 0x + selector + spender + amount

      // The spender should be left-padded with zeros in the 32-byte word
      const spenderWord = calldata.slice(10, 74); // after "0x095ea7b3"
      expect(spenderWord).toBe("0000000000000000000000001234567890123456789012345678901234567890");
    });

    it("should encode amount as 32-byte hex", () => {
      const calldata = encodeApproveCalldata(
        "0x1234567890123456789012345678901234567890",
        "1000000",
      );

      // 1000000 = 0xF4240
      const amountWord = calldata.slice(74, 138);
      expect(amountWord).toBe("00000000000000000000000000000000000000000000000000000000000f4240");
    });

    it("should handle spender without 0x prefix", () => {
      const calldata = encodeApproveCalldata("1234567890123456789012345678901234567890", "1000000");

      expect(calldata.startsWith("0x095ea7b3")).toBe(true);
      const spenderWord = calldata.slice(10, 74);
      expect(spenderWord).toBe("0000000000000000000000001234567890123456789012345678901234567890");
    });

    it("should handle large amounts", () => {
      const calldata = encodeApproveCalldata(
        "0x1234567890123456789012345678901234567890",
        "999999999999999999999999999",
      );

      expect(calldata.startsWith("0x095ea7b3")).toBe(true);
      // Verify calldata is correct length
      expect(calldata.length).toBe(2 + 8 + 64 + 64);
    });

    it("should handle zero amount", () => {
      const calldata = encodeApproveCalldata("0x1234567890123456789012345678901234567890", "0");

      const amountWord = calldata.slice(74, 138);
      expect(amountWord).toBe("0".repeat(64));
    });
  });

  describe("createERC20ApprovalGasSponsorPayload", () => {
    const extensionInfo: ERC20ApprovalGasSponsorExtensionInfo = {
      sponsoredNetworks: ["eip155:8453", "eip155:42161"],
      maxAmount: "1000000000",
      sponsorAddress: "0xFacilitator0000000000000000000000000000",
      requiresAtomicBatch: true,
    };

    it("should create payload with all required fields", () => {
      const payload = createERC20ApprovalGasSponsorPayload(extensionInfo, {
        network: "eip155:8453",
        from: "0x1234567890123456789012345678901234567890",
        asset: "0xUSDT000000000000000000000000000000000000",
        amount: "1000000",
        signedApprovalTx: "0xf8a980...",
        chainId: 8453,
      });

      expect(payload.network).toBe("eip155:8453");
      expect(payload.from).toBe("0x1234567890123456789012345678901234567890");
      expect(payload.asset).toBe("0xUSDT000000000000000000000000000000000000");
      expect(payload.amount).toBe("1000000");
      expect(payload.signedApprovalTx).toBe("0xf8a980...");
      expect(payload.chainId).toBe(8453);
      expect(payload.nonce).toBeUndefined();
    });

    it("should include nonce when provided", () => {
      const payload = createERC20ApprovalGasSponsorPayload(extensionInfo, {
        network: "eip155:8453",
        from: "0x1234567890123456789012345678901234567890",
        asset: "0xUSDT000000000000000000000000000000000000",
        amount: "1000000",
        signedApprovalTx: "0xf8a980...",
        chainId: 8453,
        nonce: 42,
      });

      expect(payload.nonce).toBe(42);
    });

    it("should add 0x prefix to signedApprovalTx if missing", () => {
      const payload = createERC20ApprovalGasSponsorPayload(extensionInfo, {
        network: "eip155:8453",
        from: "0x1234567890123456789012345678901234567890",
        asset: "0xUSDT000000000000000000000000000000000000",
        amount: "1000000",
        signedApprovalTx: "f8a980aabb",
        chainId: 8453,
      });

      expect(payload.signedApprovalTx).toBe("0xf8a980aabb");
    });
  });

  describe("encodeERC20ApprovalGasSponsorHeader", () => {
    it("should encode payload as base64 JSON", () => {
      const payload: ERC20ApprovalGasSponsorPayload = {
        network: "eip155:8453",
        from: "0x1234567890123456789012345678901234567890",
        asset: "0xUSDT000000000000000000000000000000000000",
        amount: "1000000",
        signedApprovalTx: "0xf8a980" + "ab".repeat(50),
        chainId: 8453,
      };

      const encoded = encodeERC20ApprovalGasSponsorHeader(payload);
      const decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf-8"));
      expect(decoded).toEqual(payload);
    });

    it("should handle large values in payload", () => {
      const payload: ERC20ApprovalGasSponsorPayload = {
        network: "eip155:42161",
        from: "0x" + "aa".repeat(20),
        asset: "0x" + "bb".repeat(20),
        amount: "999999999999999999999999999",
        signedApprovalTx: "0x" + "ff".repeat(200),
        chainId: 42161,
      };

      const encoded = encodeERC20ApprovalGasSponsorHeader(payload);
      const decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf-8"));
      expect(decoded.amount).toBe("999999999999999999999999999");
    });
  });

  describe("Constants", () => {
    it("should export correct extension key", () => {
      expect(ERC20_APPROVAL_GAS_SPONSOR_EXTENSION_KEY).toBe("erc20ApprovalGasSponsoring");
    });

    it("should export correct header name", () => {
      expect(ERC20_APPROVAL_GAS_SPONSOR_HEADER_NAME).toBe("X-T402-ERC20-Approval-Gas-Sponsoring");
    });

    it("should export correct approve function selector", () => {
      expect(APPROVE_FUNCTION_SELECTOR).toBe("0x095ea7b3");
    });
  });
});
