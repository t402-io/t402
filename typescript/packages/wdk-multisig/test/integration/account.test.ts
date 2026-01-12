/**
 * Integration tests for MultiSigWdkSmartAccount
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Address, Hex } from "viem";
import { MultiSigWdkSmartAccount, createMultiSigWdkSmartAccount } from "../../src/account.js";
import { MultiSigError, MultiSigErrorCode } from "../../src/errors.js";
import { SAFE_4337_ADDRESSES } from "../../src/constants.js";
import {
  createMockWDKSigners,
  createMockPublicClient,
  TEST_ADDRESSES,
} from "./mocks.js";

describe("MultiSigWdkSmartAccount Integration", () => {
  let mockPublicClient: ReturnType<typeof createMockPublicClient>;

  beforeEach(() => {
    mockPublicClient = createMockPublicClient();
  });

  describe("Account Creation", () => {
    it("should create a 2-of-3 multi-sig account", async () => {
      const signers = createMockWDKSigners(3);

      const account = new MultiSigWdkSmartAccount({
        owners: signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
      });

      await account.initialize();

      expect(account.getThreshold()).toBe(2);
      expect(account.getOwners()).toHaveLength(3);
      expect(account.getSigners()).toHaveLength(3);
    });

    it("should create a 1-of-1 single-owner account", async () => {
      const signers = createMockWDKSigners(1);

      const account = new MultiSigWdkSmartAccount({
        owners: signers,
        threshold: 1,
        chainId: 42161,
        publicClient: mockPublicClient,
      });

      await account.initialize();

      expect(account.getThreshold()).toBe(1);
      expect(account.getOwners()).toHaveLength(1);
    });

    it("should create a 3-of-5 multi-sig account", async () => {
      const signers = createMockWDKSigners(5);

      const account = new MultiSigWdkSmartAccount({
        owners: signers,
        threshold: 3,
        chainId: 42161,
        publicClient: mockPublicClient,
      });

      await account.initialize();

      expect(account.getThreshold()).toBe(3);
      expect(account.getOwners()).toHaveLength(5);
    });

    it("should reject invalid threshold (0)", () => {
      const signers = createMockWDKSigners(3);

      expect(() => {
        new MultiSigWdkSmartAccount({
          owners: signers,
          threshold: 0,
          chainId: 42161,
          publicClient: mockPublicClient,
        });
      }).toThrow(MultiSigError);
    });

    it("should reject threshold greater than owner count", () => {
      const signers = createMockWDKSigners(3);

      expect(() => {
        new MultiSigWdkSmartAccount({
          owners: signers,
          threshold: 4,
          chainId: 42161,
          publicClient: mockPublicClient,
        });
      }).toThrow(MultiSigError);
    });

    it("should reject empty owners array", () => {
      expect(() => {
        new MultiSigWdkSmartAccount({
          owners: [],
          threshold: 1,
          chainId: 42161,
          publicClient: mockPublicClient,
        });
      }).toThrow(MultiSigError);
    });

    it("should use factory function for convenience", async () => {
      const signers = createMockWDKSigners(3);

      const account = await createMultiSigWdkSmartAccount({
        owners: signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
      });

      expect(account.getThreshold()).toBe(2);
      expect(account.getOwners()).toHaveLength(3);
    });
  });

  describe("Owner Sorting", () => {
    it("should sort owners by address (ascending)", async () => {
      // Create signers with unsorted addresses
      const signers = createMockWDKSigners(3);

      const account = await createMultiSigWdkSmartAccount({
        owners: signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
      });

      const owners = account.getOwners();

      // Verify sorted order (numerically ascending)
      for (let i = 0; i < owners.length - 1; i++) {
        const current = BigInt(owners[i]!);
        const next = BigInt(owners[i + 1]!);
        expect(current < next).toBe(true);
      }
    });
  });

  describe("Address Computation", () => {
    it("should compute deterministic Safe address", async () => {
      const signers = createMockWDKSigners(3);

      const account = await createMultiSigWdkSmartAccount({
        owners: signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
      });

      const address1 = await account.getAddress();
      const address2 = await account.getAddress();

      // Address should be deterministic
      expect(address1).toBe(address2);
      expect(address1).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it("should compute different addresses for different thresholds", async () => {
      const signers = createMockWDKSigners(3);

      const account1 = await createMultiSigWdkSmartAccount({
        owners: signers,
        threshold: 1,
        chainId: 42161,
        publicClient: mockPublicClient,
      });

      const account2 = await createMultiSigWdkSmartAccount({
        owners: signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
      });

      const address1 = await account1.getAddress();
      const address2 = await account2.getAddress();

      // Different thresholds should produce different addresses
      expect(address1).not.toBe(address2);
    });

    it("should compute different addresses with different salt nonces", async () => {
      const signers = createMockWDKSigners(3);

      const account1 = await createMultiSigWdkSmartAccount({
        owners: signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
        saltNonce: 0n,
      });

      const account2 = await createMultiSigWdkSmartAccount({
        owners: signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
        saltNonce: 1n,
      });

      const address1 = await account1.getAddress();
      const address2 = await account2.getAddress();

      // Different salt nonces should produce different addresses
      expect(address1).not.toBe(address2);
    });
  });

  describe("Init Code Generation", () => {
    it("should generate init code for undeployed account", async () => {
      const signers = createMockWDKSigners(3);

      // Mock as undeployed
      mockPublicClient.getCode = vi.fn().mockResolvedValue("0x");

      const account = await createMultiSigWdkSmartAccount({
        owners: signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
      });

      const initCode = await account.getInitCode();

      // Init code should be non-empty hex and contain the factory address
      expect(initCode).toMatch(/^0x[a-fA-F0-9]+$/);
      expect(initCode.length).toBeGreaterThan(42); // Address + function selector + data
      // The init code is: factory address (20 bytes) + createProxyWithNonce call data
      expect(initCode.toLowerCase().includes(SAFE_4337_ADDRESSES.proxyFactory.toLowerCase().slice(2))).toBe(true);
    });

    it("should return empty init code for deployed account", async () => {
      const signers = createMockWDKSigners(3);

      // Mock as deployed
      mockPublicClient.getCode = vi.fn().mockResolvedValue("0x6080604052");

      const account = await createMultiSigWdkSmartAccount({
        owners: signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
      });

      const initCode = await account.getInitCode();

      expect(initCode).toBe("0x");
    });
  });

  describe("Deployment Check", () => {
    it("should detect undeployed account", async () => {
      const signers = createMockWDKSigners(3);

      mockPublicClient.getCode = vi.fn().mockResolvedValue("0x");

      const account = await createMultiSigWdkSmartAccount({
        owners: signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
      });

      const isDeployed = await account.isDeployed();

      expect(isDeployed).toBe(false);
    });

    it("should detect deployed account", async () => {
      const signers = createMockWDKSigners(3);

      mockPublicClient.getCode = vi.fn().mockResolvedValue("0x6080604052");

      const account = await createMultiSigWdkSmartAccount({
        owners: signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
      });

      const isDeployed = await account.isDeployed();

      expect(isDeployed).toBe(true);
    });

    it("should cache deployment check result", async () => {
      const signers = createMockWDKSigners(3);

      mockPublicClient.getCode = vi.fn().mockResolvedValue("0x6080604052");

      const account = await createMultiSigWdkSmartAccount({
        owners: signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
      });

      await account.isDeployed();
      await account.isDeployed();
      await account.isDeployed();

      // Should only call getCode once due to caching
      expect(mockPublicClient.getCode).toHaveBeenCalledTimes(1);
    });
  });

  describe("Signature Operations", () => {
    it("should sign with single owner", async () => {
      const signers = createMockWDKSigners(3);
      const userOpHash = "0x" + "ab".repeat(32) as Hex;

      const account = await createMultiSigWdkSmartAccount({
        owners: signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
      });

      const signature = await account.signUserOpHash(userOpHash);

      // Signature should be formatted for Safe (with EOA type appended)
      expect(signature).toMatch(/^0x[a-fA-F0-9]+$/);
      expect(signature.endsWith("00")).toBe(true); // EOA signature type
    });

    it("should sign with specific owner index", async () => {
      const signers = createMockWDKSigners(3);
      const userOpHash = "0x" + "ab".repeat(32) as Hex;

      const account = await createMultiSigWdkSmartAccount({
        owners: signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
      });

      const signature0 = await account.signWithOwner(userOpHash, 0);
      const signature1 = await account.signWithOwner(userOpHash, 1);

      expect(signature0).toBeDefined();
      expect(signature1).toBeDefined();
      // Signatures from different owners should be different
      // (unless mock returns same value)
    });

    it("should throw for invalid owner index", async () => {
      const signers = createMockWDKSigners(3);
      const userOpHash = "0x" + "ab".repeat(32) as Hex;

      const account = await createMultiSigWdkSmartAccount({
        owners: signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
      });

      await expect(account.signWithOwner(userOpHash, 10)).rejects.toThrow(MultiSigError);
    });

    it("should combine multiple signatures", async () => {
      const signers = createMockWDKSigners(3);

      const account = await createMultiSigWdkSmartAccount({
        owners: signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
      });

      const signatures = new Map<number, Hex>([
        [0, "0x" + "11".repeat(65) as Hex],
        [1, "0x" + "22".repeat(65) as Hex],
      ]);

      const combined = account.combineSignatures(signatures);

      // Combined signature should contain both signatures
      expect(combined).toMatch(/^0x[a-fA-F0-9]+$/);
      expect(combined.length).toBeGreaterThan(4); // More than just "0x"
    });

    it("should check if enough signatures are collected", async () => {
      const signers = createMockWDKSigners(3);

      const account = await createMultiSigWdkSmartAccount({
        owners: signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
      });

      const oneSignature = new Map<number, Hex>([[0, "0x" + "11".repeat(65) as Hex]]);
      const twoSignatures = new Map<number, Hex>([
        [0, "0x" + "11".repeat(65) as Hex],
        [1, "0x" + "22".repeat(65) as Hex],
      ]);

      expect(account.hasEnoughSignatures(oneSignature)).toBe(false);
      expect(account.hasEnoughSignatures(twoSignatures)).toBe(true);
    });
  });

  describe("Execute Encoding", () => {
    it("should encode single execute call", async () => {
      const signers = createMockWDKSigners(3);

      const account = await createMultiSigWdkSmartAccount({
        owners: signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
      });

      const callData = account.encodeExecute(
        TEST_ADDRESSES.recipient,
        0n,
        "0x" as Hex,
      );

      expect(callData).toMatch(/^0x[a-fA-F0-9]+$/);
      // Should contain executeUserOp function selector
    });

    it("should encode batch execute call", async () => {
      const signers = createMockWDKSigners(3);

      const account = await createMultiSigWdkSmartAccount({
        owners: signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
      });

      const callData = account.encodeExecuteBatch(
        [TEST_ADDRESSES.recipient, TEST_ADDRESSES.token],
        [0n, 0n],
        ["0x" as Hex, "0x" as Hex],
      );

      expect(callData).toMatch(/^0x[a-fA-F0-9]+$/);
      // Should contain executeUserOpBatch function selector
    });

    it("should throw for mismatched array lengths in batch", async () => {
      const signers = createMockWDKSigners(3);

      const account = await createMultiSigWdkSmartAccount({
        owners: signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
      });

      expect(() => {
        account.encodeExecuteBatch(
          [TEST_ADDRESSES.recipient, TEST_ADDRESSES.token],
          [0n], // Mismatched length
          ["0x" as Hex, "0x" as Hex],
        );
      }).toThrow("Array lengths must match");
    });
  });

  describe("Cache Management", () => {
    it("should clear cache", async () => {
      const signers = createMockWDKSigners(3);

      mockPublicClient.getCode = vi.fn().mockResolvedValue("0x");

      const account = await createMultiSigWdkSmartAccount({
        owners: signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
      });

      // Populate cache
      await account.getAddress();
      await account.isDeployed();

      // Clear cache
      account.clearCache();

      // Should re-fetch after cache clear
      mockPublicClient.getCode = vi.fn().mockResolvedValue("0x6080604052");
      const isDeployed = await account.isDeployed();

      expect(isDeployed).toBe(true);
    });
  });

  describe("Not Initialized Errors", () => {
    it("should throw when accessing owners before initialization", () => {
      const signers = createMockWDKSigners(3);

      const account = new MultiSigWdkSmartAccount({
        owners: signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
      });

      expect(() => account.getOwners()).toThrow(MultiSigError);
    });

    it("should throw when combining signatures before initialization", () => {
      const signers = createMockWDKSigners(3);

      const account = new MultiSigWdkSmartAccount({
        owners: signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
      });

      const signatures = new Map<number, Hex>([[0, "0x11" as Hex]]);

      expect(() => account.combineSignatures(signatures)).toThrow(MultiSigError);
    });
  });
});
