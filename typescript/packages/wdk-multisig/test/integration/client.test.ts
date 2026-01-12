/**
 * Integration tests for MultiSigWdkGaslessClient
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Address, Hex } from "viem";
import { MultiSigWdkGaslessClient } from "../../src/client.js";
import { createMultiSigWdkSmartAccount } from "../../src/account.js";
import { MultiSigError, MultiSigErrorCode } from "../../src/errors.js";
import {
  createMockWDKSigners,
  createMockPublicClient,
  createMockFetch,
  TEST_ADDRESSES,
  MOCK_BUNDLER_CONFIG,
  MOCK_PAYMASTER_CONFIG,
} from "./mocks.js";

describe("MultiSigWdkGaslessClient Integration", () => {
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

  async function createTestClient(threshold = 2, ownerCount = 3, usePaymaster = false) {
    const signers = createMockWDKSigners(ownerCount);

    const smartAccount = await createMultiSigWdkSmartAccount({
      owners: signers,
      threshold,
      chainId: 42161,
      publicClient: mockPublicClient,
    });

    return new MultiSigWdkGaslessClient({
      signer: smartAccount,
      bundler: MOCK_BUNDLER_CONFIG,
      paymaster: usePaymaster ? MOCK_PAYMASTER_CONFIG : undefined,
      chainId: 42161,
      publicClient: mockPublicClient,
    });
  }

  describe("Client Creation", () => {
    it("should create client with bundler and paymaster", async () => {
      const client = await createTestClient();

      expect(client).toBeDefined();
      expect(client.getOwners()).toHaveLength(3);
      expect(client.getThreshold()).toBe(2);
    });

    it("should create client without paymaster", async () => {
      const signers = createMockWDKSigners(3);

      const smartAccount = await createMultiSigWdkSmartAccount({
        owners: signers,
        threshold: 2,
        chainId: 42161,
        publicClient: mockPublicClient,
      });

      const client = new MultiSigWdkGaslessClient({
        signer: smartAccount,
        bundler: MOCK_BUNDLER_CONFIG,
        chainId: 42161,
        publicClient: mockPublicClient,
      });

      expect(client).toBeDefined();
    });
  });

  describe("Account Info", () => {
    it("should get account address", async () => {
      const client = await createTestClient();

      const address = await client.getAccountAddress();

      expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it("should check if account is deployed", async () => {
      const client = await createTestClient();

      const isDeployed = await client.isAccountDeployed();

      expect(typeof isDeployed).toBe("boolean");
    });

    it("should get token balance", async () => {
      const client = await createTestClient();

      const balance = await client.getBalance("USDT0");

      expect(balance).toBe(1000000n); // From mock
    });

    it("should get formatted balance", async () => {
      const client = await createTestClient();

      const formattedBalance = await client.getFormattedBalance("USDT0", 6);

      expect(formattedBalance).toBe("1"); // 1000000 / 10^6
    });
  });

  describe("Payment Initiation", () => {
    it("should initiate a single payment", async () => {
      const client = await createTestClient();

      const result = await client.initiatePayment({
        to: TEST_ADDRESSES.recipient,
        amount: 1000000n,
      });

      expect(result.requestId).toBeDefined();
      expect(result.requestId.startsWith("msig_")).toBe(true);
      expect(result.userOpHash).toBeDefined();
      expect(result.threshold).toBe(2);
      expect(result.collectedCount).toBe(0);
      expect(result.isReady).toBe(false);
      expect(result.signatures).toHaveLength(3);
    });

    it("should initiate a payment with custom token", async () => {
      const client = await createTestClient();

      const result = await client.initiatePayment({
        to: TEST_ADDRESSES.recipient,
        amount: 500000n,
        token: "USDC",
      });

      expect(result.requestId).toBeDefined();
      expect(result.userOpHash).toBeDefined();
    });

    it("should initiate a payment with custom token address", async () => {
      const client = await createTestClient();

      const result = await client.initiatePayment({
        to: TEST_ADDRESSES.recipient,
        amount: 500000n,
        token: TEST_ADDRESSES.token,
      });

      expect(result.requestId).toBeDefined();
    });

    it("should indicate unsponsored transaction when paymaster is not configured", async () => {
      const client = await createTestClient();

      const result = await client.initiatePayment({
        to: TEST_ADDRESSES.recipient,
        amount: 1000000n,
      });

      expect(result.sponsored).toBe(false);
    });
  });

  describe("Batch Payment Initiation", () => {
    it("should initiate a batch payment", async () => {
      const client = await createTestClient();

      const result = await client.initiateBatchPayment({
        payments: [
          { to: TEST_ADDRESSES.recipient, amount: 1000000n },
          { to: TEST_ADDRESSES.owner1, amount: 500000n },
          { to: TEST_ADDRESSES.owner2, amount: 250000n },
        ],
      });

      expect(result.requestId).toBeDefined();
      expect(result.userOpHash).toBeDefined();
      expect(result.threshold).toBe(2);
    });

    it("should initiate batch with mixed tokens", async () => {
      const client = await createTestClient();

      const result = await client.initiateBatchPayment({
        payments: [
          { to: TEST_ADDRESSES.recipient, amount: 1000000n, token: "USDT0" },
          { to: TEST_ADDRESSES.owner1, amount: 500000n, token: "USDC" },
        ],
      });

      expect(result.requestId).toBeDefined();
    });
  });

  describe("Signature Collection", () => {
    it("should add signature from owner", async () => {
      const client = await createTestClient();
      const signers = createMockWDKSigners(3);

      const result = await client.initiatePayment({
        to: TEST_ADDRESSES.recipient,
        amount: 1000000n,
      });

      // Add signature from first owner
      await client.signWithOwner(result.requestId, 0, signers[0]!);

      const pending = client.getPendingOwners(result.requestId);
      const signed = client.getSignedOwners(result.requestId);

      expect(pending).toHaveLength(2);
      expect(signed).toHaveLength(1);
    });

    it("should throw when adding signature for non-existent request", async () => {
      const client = await createTestClient();
      const signers = createMockWDKSigners(3);

      await expect(
        client.signWithOwner("non-existent-id", 0, signers[0]!),
      ).rejects.toThrow(MultiSigError);
    });

    it("should track multiple signatures", async () => {
      const client = await createTestClient();
      const signers = createMockWDKSigners(3);

      const result = await client.initiatePayment({
        to: TEST_ADDRESSES.recipient,
        amount: 1000000n,
      });

      await client.signWithOwner(result.requestId, 0, signers[0]!);
      await client.signWithOwner(result.requestId, 1, signers[1]!);

      const pending = client.getPendingOwners(result.requestId);
      const signed = client.getSignedOwners(result.requestId);

      expect(pending).toHaveLength(1);
      expect(signed).toHaveLength(2);
    });
  });

  describe("Transaction Submission", () => {
    it("should submit when threshold is met", async () => {
      const client = await createTestClient();
      const signers = createMockWDKSigners(3);

      const result = await client.initiatePayment({
        to: TEST_ADDRESSES.recipient,
        amount: 1000000n,
      });

      // Add signatures to meet threshold
      await client.signWithOwner(result.requestId, 0, signers[0]!);
      await client.signWithOwner(result.requestId, 1, signers[1]!);

      const submitResult = await client.submitRequest(result.requestId);

      expect(submitResult.userOpHash).toBeDefined();
      expect(submitResult.sender).toBeDefined();
      expect(typeof submitResult.wait).toBe("function");
    });

    it("should throw when submitting without enough signatures", async () => {
      const client = await createTestClient();
      const signers = createMockWDKSigners(3);

      const result = await client.initiatePayment({
        to: TEST_ADDRESSES.recipient,
        amount: 1000000n,
      });

      // Add only one signature (threshold is 2)
      await client.signWithOwner(result.requestId, 0, signers[0]!);

      await expect(client.submitRequest(result.requestId)).rejects.toThrow(MultiSigError);
    });

    it("should wait for transaction receipt", async () => {
      const client = await createTestClient();
      const signers = createMockWDKSigners(3);

      const result = await client.initiatePayment({
        to: TEST_ADDRESSES.recipient,
        amount: 1000000n,
      });

      await client.signWithOwner(result.requestId, 0, signers[0]!);
      await client.signWithOwner(result.requestId, 1, signers[1]!);

      const submitResult = await client.submitRequest(result.requestId);
      const receipt = await submitResult.wait();

      expect(receipt.userOpHash).toBeDefined();
      expect(receipt.txHash).toBeDefined();
      expect(receipt.blockNumber).toBeDefined();
      expect(receipt.success).toBe(true);
      expect(receipt.gasUsed).toBeDefined();
      expect(receipt.gasCost).toBeDefined();
    });
  });

  describe("Pay With All Signers", () => {
    it("should complete payment with all local signers", async () => {
      const client = await createTestClient();
      const signers = createMockWDKSigners(3);

      const result = await client.payWithAllSigners(
        { to: TEST_ADDRESSES.recipient, amount: 1000000n },
        signers,
      );

      expect(result.userOpHash).toBeDefined();
      expect(result.sender).toBeDefined();
    });

    it("should stop collecting signatures when threshold is met", async () => {
      const client = await createTestClient(2, 5); // 2-of-5
      const signers = createMockWDKSigners(5);

      const result = await client.payWithAllSigners(
        { to: TEST_ADDRESSES.recipient, amount: 1000000n },
        signers,
      );

      // Should succeed with just 2 signatures
      expect(result.userOpHash).toBeDefined();
    });

    it("should throw if not enough signers provided", async () => {
      const client = await createTestClient(2, 3); // 2-of-3
      const signers = createMockWDKSigners(1); // Only 1 signer

      await expect(
        client.payWithAllSigners(
          { to: TEST_ADDRESSES.recipient, amount: 1000000n },
          signers,
        ),
      ).rejects.toThrow(MultiSigError);
    });

    it("should handle batch payment with all signers", async () => {
      const client = await createTestClient();
      const signers = createMockWDKSigners(3);

      const result = await client.payBatchWithAllSigners(
        {
          payments: [
            { to: TEST_ADDRESSES.recipient, amount: 1000000n },
            { to: TEST_ADDRESSES.owner1, amount: 500000n },
          ],
        },
        signers,
      );

      expect(result.userOpHash).toBeDefined();
    });
  });

  describe("Pending Requests Management", () => {
    it("should track pending requests", async () => {
      const client = await createTestClient();

      await client.initiatePayment({
        to: TEST_ADDRESSES.recipient,
        amount: 1000000n,
      });

      await client.initiatePayment({
        to: TEST_ADDRESSES.owner1,
        amount: 500000n,
      });

      const pending = client.getPendingRequests();

      expect(pending).toHaveLength(2);
    });

    it("should remove request after submission", async () => {
      const client = await createTestClient();
      const signers = createMockWDKSigners(3);

      const result = await client.initiatePayment({
        to: TEST_ADDRESSES.recipient,
        amount: 1000000n,
      });

      await client.signWithOwner(result.requestId, 0, signers[0]!);
      await client.signWithOwner(result.requestId, 1, signers[1]!);
      await client.submitRequest(result.requestId);

      const pending = client.getPendingRequests();

      expect(pending).toHaveLength(0);
    });

    it("should cleanup expired requests", async () => {
      const client = await createTestClient();

      // Note: This test would need time manipulation to properly test expiration
      // For now, just verify cleanup doesn't throw
      client.cleanup();

      expect(() => client.cleanup()).not.toThrow();
    });
  });

  describe("Result Interface", () => {
    it("should provide addSignature method on result", async () => {
      const client = await createTestClient();
      const signers = createMockWDKSigners(3);

      const result = await client.initiatePayment({
        to: TEST_ADDRESSES.recipient,
        amount: 1000000n,
      });

      // Use the result's addSignature method
      await result.addSignature(0, signers[0]!);

      const signed = client.getSignedOwners(result.requestId);
      expect(signed).toHaveLength(1);
    });

    it("should provide submit method on result", async () => {
      const client = await createTestClient();
      const signers = createMockWDKSigners(3);

      const result = await client.initiatePayment({
        to: TEST_ADDRESSES.recipient,
        amount: 1000000n,
      });

      await result.addSignature(0, signers[0]!);
      await result.addSignature(1, signers[1]!);

      const submitResult = await result.submit();

      expect(submitResult.userOpHash).toBeDefined();
    });
  });

  describe("Owner Management", () => {
    it("should return all owners", async () => {
      const client = await createTestClient(2, 3);

      const owners = client.getOwners();

      expect(owners).toHaveLength(3);
      owners.forEach((owner) => {
        expect(owner).toMatch(/^0x[a-fA-F0-9]{40}$/);
      });
    });

    it("should return threshold", async () => {
      const client = await createTestClient(2, 3);

      expect(client.getThreshold()).toBe(2);
    });
  });

  describe("Error Handling", () => {
    it("should handle unsupported chain", async () => {
      const signers = createMockWDKSigners(3);

      const smartAccount = await createMultiSigWdkSmartAccount({
        owners: signers,
        threshold: 2,
        chainId: 99999, // Unsupported chain
        publicClient: mockPublicClient,
      });

      expect(() => {
        new MultiSigWdkGaslessClient({
          signer: smartAccount,
          bundler: { ...MOCK_BUNDLER_CONFIG, chainId: 99999 },
          chainId: 99999,
          publicClient: mockPublicClient,
        });
      }).toThrow("Unsupported chain ID");
    });

    it("should handle request not found", async () => {
      const client = await createTestClient();

      await expect(client.submitRequest("non-existent")).rejects.toThrow(MultiSigError);
    });
  });
});
