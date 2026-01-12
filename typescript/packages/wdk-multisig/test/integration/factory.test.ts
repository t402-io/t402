/**
 * Integration tests for Factory Functions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Address } from "viem";
import {
  createMultiSigFromSigners,
} from "../../src/factory.js";
import { MultiSigError } from "../../src/errors.js";
import {
  createMockWDKSigners,
  createMockPublicClient,
  createMockFetch,
  MOCK_BUNDLER_CONFIG,
  MOCK_PAYMASTER_CONFIG,
} from "./mocks.js";

describe("Factory Functions Integration", () => {
  let mockPublicClient: ReturnType<typeof createMockPublicClient>;
  let mockFetch: ReturnType<typeof createMockFetch>;
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockPublicClient = createMockPublicClient();
    mockFetch = createMockFetch();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("createMultiSigFromSigners", () => {
    it("should create client from existing signers", async () => {
      const signers = createMockWDKSigners(3);

      const client = await createMultiSigFromSigners({
        signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
        bundler: MOCK_BUNDLER_CONFIG,
      });

      expect(client).toBeDefined();
      expect(client.getThreshold()).toBe(2);
      expect(client.getOwners()).toHaveLength(3);
    });

    it("should create client with paymaster", async () => {
      const signers = createMockWDKSigners(3);

      const client = await createMultiSigFromSigners({
        signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
        bundler: MOCK_BUNDLER_CONFIG,
        paymaster: MOCK_PAYMASTER_CONFIG,
      });

      expect(client).toBeDefined();
    });

    it("should create 1-of-1 client", async () => {
      const signers = createMockWDKSigners(1);

      const client = await createMultiSigFromSigners({
        signers,
        threshold: 1,
        chainId: 42161,
        publicClient: mockPublicClient,
        bundler: MOCK_BUNDLER_CONFIG,
      });

      expect(client.getThreshold()).toBe(1);
      expect(client.getOwners()).toHaveLength(1);
    });

    it("should create 3-of-5 client", async () => {
      const signers = createMockWDKSigners(5);

      const client = await createMultiSigFromSigners({
        signers,
        threshold: 3,
        chainId: 42161,
        publicClient: mockPublicClient,
        bundler: MOCK_BUNDLER_CONFIG,
      });

      expect(client.getThreshold()).toBe(3);
      expect(client.getOwners()).toHaveLength(5);
    });

    it("should use custom salt nonce", async () => {
      const signers = createMockWDKSigners(3);

      const client1 = await createMultiSigFromSigners({
        signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
        bundler: MOCK_BUNDLER_CONFIG,
        saltNonce: 0n,
      });

      const client2 = await createMultiSigFromSigners({
        signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
        bundler: MOCK_BUNDLER_CONFIG,
        saltNonce: 1n,
      });

      const address1 = await client1.getAccountAddress();
      const address2 = await client2.getAccountAddress();

      // Different salt nonces should produce different addresses
      expect(address1).not.toBe(address2);
    });

    it("should throw for empty signers", async () => {
      await expect(
        createMultiSigFromSigners({
          signers: [],
          threshold: 1,
          chainId: 42161,
          publicClient: mockPublicClient,
          bundler: MOCK_BUNDLER_CONFIG,
        }),
      ).rejects.toThrow(MultiSigError);
    });

    it("should throw for invalid threshold (0)", async () => {
      const signers = createMockWDKSigners(3);

      await expect(
        createMultiSigFromSigners({
          signers,
          threshold: 0,
          chainId: 42161,
          publicClient: mockPublicClient,
          bundler: MOCK_BUNDLER_CONFIG,
        }),
      ).rejects.toThrow(MultiSigError);
    });

    it("should throw for threshold greater than signer count", async () => {
      const signers = createMockWDKSigners(3);

      await expect(
        createMultiSigFromSigners({
          signers,
          threshold: 4,
          chainId: 42161,
          publicClient: mockPublicClient,
          bundler: MOCK_BUNDLER_CONFIG,
        }),
      ).rejects.toThrow(MultiSigError);
    });

    it("should initialize uninitialized signers", async () => {
      const signers = createMockWDKSigners(3);
      // Mark signers as not initialized
      signers.forEach((signer) => {
        (signer as any).isInitialized = false;
      });

      const client = await createMultiSigFromSigners({
        signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
        bundler: MOCK_BUNDLER_CONFIG,
      });

      expect(client).toBeDefined();
      // Verify initialize was called on each signer
      signers.forEach((signer) => {
        expect(signer.initialize).toHaveBeenCalled();
      });
    });
  });

  describe("Factory Function - Client Functionality", () => {
    it("should create functional client that can initiate payments", async () => {
      const signers = createMockWDKSigners(3);

      const client = await createMultiSigFromSigners({
        signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
        bundler: MOCK_BUNDLER_CONFIG,
      });

      const result = await client.initiatePayment({
        to: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as Address,
        amount: 1000000n,
      });

      expect(result.requestId).toBeDefined();
      expect(result.threshold).toBe(2);
    });

    it("should create functional client that can collect signatures", async () => {
      const signers = createMockWDKSigners(3);

      const client = await createMultiSigFromSigners({
        signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
        bundler: MOCK_BUNDLER_CONFIG,
      });

      const result = await client.initiatePayment({
        to: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as Address,
        amount: 1000000n,
      });

      await client.signWithOwner(result.requestId, 0, signers[0]!);

      const signed = client.getSignedOwners(result.requestId);
      expect(signed).toHaveLength(1);
    });

    it("should create functional client that can submit transactions", async () => {
      const signers = createMockWDKSigners(3);

      const client = await createMultiSigFromSigners({
        signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
        bundler: MOCK_BUNDLER_CONFIG,
      });

      const result = await client.initiatePayment({
        to: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as Address,
        amount: 1000000n,
      });

      await client.signWithOwner(result.requestId, 0, signers[0]!);
      await client.signWithOwner(result.requestId, 1, signers[1]!);

      const submitResult = await client.submitRequest(result.requestId);

      expect(submitResult.userOpHash).toBeDefined();
    });
  });

  describe("Different Chain Configurations", () => {
    it("should work with Ethereum mainnet chain ID", async () => {
      const signers = createMockWDKSigners(3);

      const client = await createMultiSigFromSigners({
        signers,
        threshold: 2,
        chainId: 1, // Ethereum mainnet
        publicClient: mockPublicClient,
        bundler: { ...MOCK_BUNDLER_CONFIG, chainId: 1 },
      });

      expect(client).toBeDefined();
    });

    it("should work with Base chain ID", async () => {
      const signers = createMockWDKSigners(3);

      const client = await createMultiSigFromSigners({
        signers,
        threshold: 2,
        chainId: 8453, // Base
        publicClient: mockPublicClient,
        bundler: { ...MOCK_BUNDLER_CONFIG, chainId: 8453 },
      });

      expect(client).toBeDefined();
    });

    it("should work with Optimism chain ID", async () => {
      const signers = createMockWDKSigners(3);

      const client = await createMultiSigFromSigners({
        signers,
        threshold: 2,
        chainId: 10, // Optimism
        publicClient: mockPublicClient,
        bundler: { ...MOCK_BUNDLER_CONFIG, chainId: 10 },
      });

      expect(client).toBeDefined();
    });
  });

  describe("Address Determinism", () => {
    it("should produce same address for same inputs", async () => {
      const signers = createMockWDKSigners(3);

      const client1 = await createMultiSigFromSigners({
        signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
        bundler: MOCK_BUNDLER_CONFIG,
        saltNonce: 0n,
      });

      const client2 = await createMultiSigFromSigners({
        signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
        bundler: MOCK_BUNDLER_CONFIG,
        saltNonce: 0n,
      });

      const address1 = await client1.getAccountAddress();
      const address2 = await client2.getAccountAddress();

      expect(address1).toBe(address2);
    });

    it("should produce different addresses for different thresholds", async () => {
      const signers = createMockWDKSigners(3);

      const client1 = await createMultiSigFromSigners({
        signers,
        threshold: 1,
        chainId: 42161,
        publicClient: mockPublicClient,
        bundler: MOCK_BUNDLER_CONFIG,
      });

      const client2 = await createMultiSigFromSigners({
        signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
        bundler: MOCK_BUNDLER_CONFIG,
      });

      const address1 = await client1.getAccountAddress();
      const address2 = await client2.getAccountAddress();

      expect(address1).not.toBe(address2);
    });
  });
});
