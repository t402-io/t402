/**
 * WDK Multi-sig Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { Address, Hex } from "viem";
import {
  combineSignatures,
  formatSignatureForSafe,
  generateRequestId,
  isValidThreshold,
  sortAddresses,
  getOwnerIndex,
  areAddressesUnique,
} from "./utils.js";
import { SignatureCollector } from "./collector.js";
import { MultiSigError, MultiSigErrorCode } from "./errors.js";
import { SAFE_4337_ADDRESSES, SIGNATURE_TYPES, DEFAULTS } from "./constants.js";

describe("Constants", () => {
  describe("SAFE_4337_ADDRESSES", () => {
    it("should have all required addresses", () => {
      expect(SAFE_4337_ADDRESSES.module).toBeDefined();
      expect(SAFE_4337_ADDRESSES.moduleSetup).toBeDefined();
      expect(SAFE_4337_ADDRESSES.singleton).toBeDefined();
      expect(SAFE_4337_ADDRESSES.proxyFactory).toBeDefined();
      expect(SAFE_4337_ADDRESSES.fallbackHandler).toBeDefined();
      expect(SAFE_4337_ADDRESSES.addModulesLib).toBeDefined();
    });

    it("should have valid addresses", () => {
      Object.values(SAFE_4337_ADDRESSES).forEach((address) => {
        expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      });
    });
  });

  describe("SIGNATURE_TYPES", () => {
    it("should have correct signature types", () => {
      expect(SIGNATURE_TYPES.EOA).toBe("0x00");
      expect(SIGNATURE_TYPES.CONTRACT).toBe("0x01");
      expect(SIGNATURE_TYPES.APPROVED_HASH).toBe("0x04");
    });
  });

  describe("DEFAULTS", () => {
    it("should have correct default values", () => {
      expect(DEFAULTS.REQUEST_EXPIRATION_MS).toBe(60 * 60 * 1000);
      expect(DEFAULTS.SALT_NONCE).toBe(0n);
      expect(DEFAULTS.MAX_OWNERS).toBe(10);
      expect(DEFAULTS.MIN_THRESHOLD).toBe(1);
    });
  });
});

describe("Utils", () => {
  describe("isValidThreshold", () => {
    it("should return true for valid thresholds", () => {
      expect(isValidThreshold(1, 1)).toBe(true);
      expect(isValidThreshold(1, 3)).toBe(true);
      expect(isValidThreshold(2, 3)).toBe(true);
      expect(isValidThreshold(3, 3)).toBe(true);
    });

    it("should return false for invalid thresholds", () => {
      expect(isValidThreshold(0, 3)).toBe(false);
      expect(isValidThreshold(4, 3)).toBe(false);
      expect(isValidThreshold(-1, 3)).toBe(false);
    });
  });

  describe("sortAddresses", () => {
    it("should sort addresses in ascending order", () => {
      const addresses: Address[] = [
        "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
        "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        "0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
      ];

      const sorted = sortAddresses(addresses);

      expect(sorted[0]).toBe("0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
      expect(sorted[1]).toBe("0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB");
      expect(sorted[2]).toBe("0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC");
    });

    it("should not modify original array", () => {
      const addresses: Address[] = [
        "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
        "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      ];

      const sorted = sortAddresses(addresses);

      expect(addresses[0]).toBe("0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB");
      expect(sorted[0]).toBe("0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
    });
  });

  describe("areAddressesUnique", () => {
    it("should return true for unique addresses", () => {
      const addresses: Address[] = [
        "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
        "0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
      ];

      expect(areAddressesUnique(addresses)).toBe(true);
    });

    it("should return false for duplicate addresses", () => {
      const addresses: Address[] = [
        "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
        "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      ];

      expect(areAddressesUnique(addresses)).toBe(false);
    });

    it("should be case insensitive", () => {
      const addresses: Address[] = [
        "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      ];

      expect(areAddressesUnique(addresses)).toBe(false);
    });
  });

  describe("getOwnerIndex", () => {
    const owners: Address[] = [
      "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
      "0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
    ];

    it("should return correct index for existing owner", () => {
      expect(getOwnerIndex("0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", owners)).toBe(0);
      expect(getOwnerIndex("0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", owners)).toBe(1);
      expect(getOwnerIndex("0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC", owners)).toBe(2);
    });

    it("should return -1 for non-existing owner", () => {
      expect(getOwnerIndex("0xDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD", owners)).toBe(-1);
    });

    it("should be case insensitive", () => {
      expect(getOwnerIndex("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", owners)).toBe(0);
    });
  });

  describe("generateRequestId", () => {
    it("should generate unique IDs", () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();

      expect(id1).not.toBe(id2);
    });

    it("should start with msig_ prefix", () => {
      const id = generateRequestId();
      expect(id.startsWith("msig_")).toBe(true);
    });
  });

  describe("formatSignatureForSafe", () => {
    it("should append EOA signature type by default", () => {
      const sig = "0x1234567890" as Hex;
      const formatted = formatSignatureForSafe(sig);

      expect(formatted).toBe("0x123456789000");
    });

    it("should append CONTRACT signature type when specified", () => {
      const sig = "0x1234567890" as Hex;
      const formatted = formatSignatureForSafe(sig, "CONTRACT");

      expect(formatted).toBe("0x123456789001");
    });
  });

  describe("combineSignatures", () => {
    it("should combine signatures sorted by owner address", () => {
      const owners: Address[] = [
        "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
        "0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
      ];

      const signatures = new Map<number, Hex>([
        [2, "0x3333" as Hex], // C
        [0, "0x1111" as Hex], // A
        [1, "0x2222" as Hex], // B
      ]);

      const combined = combineSignatures(signatures, owners);

      // Should be sorted by address: A, B, C
      expect(combined).toBe("0x111122223333");
    });

    it("should return empty hex for no signatures", () => {
      const owners: Address[] = [];
      const signatures = new Map<number, Hex>();

      const combined = combineSignatures(signatures, owners);

      expect(combined).toBe("0x");
    });
  });
});

describe("SignatureCollector", () => {
  const owners: Address[] = [
    "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
    "0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
  ];

  const mockUserOp = {
    sender: "0x1234567890123456789012345678901234567890" as Address,
    nonce: 0n,
    callData: "0x" as Hex,
    callGasLimit: 100000n,
    verificationGasLimit: 100000n,
    preVerificationGas: 50000n,
    maxFeePerGas: 1000000000n,
    maxPriorityFeePerGas: 1000000000n,
    signature: "0x" as Hex,
  };

  const mockUserOpHash = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as Hex;

  let collector: SignatureCollector;

  beforeEach(() => {
    collector = new SignatureCollector();
  });

  describe("createRequest", () => {
    it("should create a new request", () => {
      const request = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2);

      expect(request.id).toBeDefined();
      expect(request.userOp).toBe(mockUserOp);
      expect(request.userOpHash).toBe(mockUserOpHash);
      expect(request.threshold).toBe(2);
      expect(request.collectedCount).toBe(0);
      expect(request.isReady).toBe(false);
      expect(request.signatures.length).toBe(3);
    });

    it("should initialize all signatures as unsigned", () => {
      const request = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2);

      request.signatures.forEach((sig, index) => {
        expect(sig.owner).toBe(owners[index]);
        expect(sig.ownerIndex).toBe(index);
        expect(sig.signed).toBe(false);
        expect(sig.signature).toBeUndefined();
      });
    });
  });

  describe("addSignature", () => {
    it("should add a signature", () => {
      const request = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2);
      const signature = "0x1111" as Hex;

      const updated = collector.addSignature(request.id, owners[0], signature);

      expect(updated.signatures[0].signed).toBe(true);
      expect(updated.signatures[0].signature).toBe(signature);
      expect(updated.collectedCount).toBe(1);
      expect(updated.isReady).toBe(false);
    });

    it("should set isReady when threshold is met", () => {
      const request = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2);

      collector.addSignature(request.id, owners[0], "0x1111" as Hex);
      const updated = collector.addSignature(request.id, owners[1], "0x2222" as Hex);

      expect(updated.collectedCount).toBe(2);
      expect(updated.isReady).toBe(true);
    });

    it("should throw for non-existent request", () => {
      expect(() =>
        collector.addSignature("non-existent", owners[0], "0x1111" as Hex)
      ).toThrow(MultiSigError);
    });

    it("should throw for duplicate signature", () => {
      const request = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2);

      collector.addSignature(request.id, owners[0], "0x1111" as Hex);

      expect(() =>
        collector.addSignature(request.id, owners[0], "0x1111" as Hex)
      ).toThrow(MultiSigError);
    });
  });

  describe("isComplete", () => {
    it("should return false when threshold not met", () => {
      const request = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2);
      collector.addSignature(request.id, owners[0], "0x1111" as Hex);

      expect(collector.isComplete(request.id)).toBe(false);
    });

    it("should return true when threshold is met", () => {
      const request = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2);
      collector.addSignature(request.id, owners[0], "0x1111" as Hex);
      collector.addSignature(request.id, owners[1], "0x2222" as Hex);

      expect(collector.isComplete(request.id)).toBe(true);
    });
  });

  describe("getCombinedSignature", () => {
    it("should return combined signature when ready", () => {
      const request = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2);
      collector.addSignature(request.id, owners[0], "0x1111" as Hex);
      collector.addSignature(request.id, owners[1], "0x2222" as Hex);

      const combined = collector.getCombinedSignature(request.id);

      expect(combined).toBeDefined();
      expect(combined.startsWith("0x")).toBe(true);
    });

    it("should throw when not ready", () => {
      const request = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2);
      collector.addSignature(request.id, owners[0], "0x1111" as Hex);

      expect(() => collector.getCombinedSignature(request.id)).toThrow(MultiSigError);
    });
  });

  describe("getPendingOwners", () => {
    it("should return owners who have not signed", () => {
      const request = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2);
      collector.addSignature(request.id, owners[0], "0x1111" as Hex);

      const pending = collector.getPendingOwners(request.id);

      expect(pending.length).toBe(2);
      expect(pending).toContain(owners[1]);
      expect(pending).toContain(owners[2]);
      expect(pending).not.toContain(owners[0]);
    });
  });

  describe("getSignedOwners", () => {
    it("should return owners who have signed", () => {
      const request = collector.createRequest(mockUserOp, mockUserOpHash, owners, 2);
      collector.addSignature(request.id, owners[0], "0x1111" as Hex);

      const signed = collector.getSignedOwners(request.id);

      expect(signed.length).toBe(1);
      expect(signed).toContain(owners[0]);
    });
  });

  describe("cleanup", () => {
    it("should remove expired requests", () => {
      // Create collector with very short expiration
      const shortCollector = new SignatureCollector({ expirationMs: 1 });
      const request = shortCollector.createRequest(mockUserOp, mockUserOpHash, owners, 2);

      // Wait for expiration
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          shortCollector.cleanup();
          expect(shortCollector.getRequest(request.id)).toBeUndefined();
          resolve();
        }, 10);
      });
    });
  });
});

describe("MultiSigError", () => {
  it("should create threshold not met error", () => {
    const error = MultiSigError.thresholdNotMet(2, 1);

    expect(error.code).toBe(MultiSigErrorCode.THRESHOLD_NOT_MET);
    expect(error.message).toContain("2");
    expect(error.message).toContain("1");
    expect(error.context).toEqual({ required: 2, collected: 1 });
  });

  it("should create insufficient signers error", () => {
    const error = MultiSigError.insufficientSigners(3, 2);

    expect(error.code).toBe(MultiSigErrorCode.INSUFFICIENT_SIGNERS);
    expect(error.context).toEqual({ required: 3, provided: 2 });
  });

  it("should create invalid threshold error", () => {
    const error = MultiSigError.invalidThreshold(5, 3);

    expect(error.code).toBe(MultiSigErrorCode.INVALID_THRESHOLD);
    expect(error.context).toEqual({ threshold: 5, ownerCount: 3 });
  });

  it("should create owner not found error", () => {
    const error = MultiSigError.ownerNotFound(5);

    expect(error.code).toBe(MultiSigErrorCode.OWNER_NOT_FOUND);
    expect(error.context).toEqual({ ownerIndex: 5 });
  });

  it("should create request not found error", () => {
    const error = MultiSigError.requestNotFound("test-id");

    expect(error.code).toBe(MultiSigErrorCode.REQUEST_NOT_FOUND);
    expect(error.context).toEqual({ requestId: "test-id" });
  });

  it("should create already signed error", () => {
    const error = MultiSigError.alreadySigned(1);

    expect(error.code).toBe(MultiSigErrorCode.ALREADY_SIGNED);
    expect(error.context).toEqual({ ownerIndex: 1 });
  });

  it("should create not ready error", () => {
    const error = MultiSigError.notReady(3, 2);

    expect(error.code).toBe(MultiSigErrorCode.NOT_READY);
    expect(error.context).toEqual({ required: 3, collected: 2 });
  });

  it("should create not initialized error", () => {
    const error = MultiSigError.notInitialized();

    expect(error.code).toBe(MultiSigErrorCode.NOT_INITIALIZED);
  });
});

describe("Exports", () => {
  it("should export main classes", async () => {
    const mod = await import("./index.js");

    expect(mod.MultiSigWdkSmartAccount).toBeDefined();
    expect(mod.MultiSigWdkGaslessClient).toBeDefined();
    expect(mod.SignatureCollector).toBeDefined();
  });

  it("should export factory functions", async () => {
    const mod = await import("./index.js");

    expect(mod.createMultiSigFromSingleSeed).toBeDefined();
    expect(mod.createMultiSigFromMultipleSeeds).toBeDefined();
    expect(mod.createMultiSigFromSigners).toBeDefined();
    expect(mod.createMultiSigWdkSmartAccount).toBeDefined();
  });

  it("should export error types", async () => {
    const mod = await import("./index.js");

    expect(mod.MultiSigError).toBeDefined();
    expect(mod.MultiSigErrorCode).toBeDefined();
  });

  it("should export constants", async () => {
    const mod = await import("./index.js");

    expect(mod.SAFE_4337_ADDRESSES).toBeDefined();
    expect(mod.SIGNATURE_TYPES).toBeDefined();
    expect(mod.DEFAULTS).toBeDefined();
    expect(mod.ENTRYPOINT_V07_ADDRESS).toBeDefined();
  });

  it("should export utilities", async () => {
    const mod = await import("./index.js");

    expect(mod.combineSignatures).toBeDefined();
    expect(mod.formatSignatureForSafe).toBeDefined();
    expect(mod.generateRequestId).toBeDefined();
    expect(mod.isValidThreshold).toBeDefined();
    expect(mod.sortAddresses).toBeDefined();
    expect(mod.getOwnerIndex).toBeDefined();
    expect(mod.areAddressesUnique).toBeDefined();
  });
});
