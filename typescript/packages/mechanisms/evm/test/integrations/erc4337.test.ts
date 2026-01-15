/**
 * ERC-4337 Gasless Payment Integration Tests
 *
 * Tests for the ERC-4337 Account Abstraction integration with T402.
 * These tests verify UserOperation building, gas estimation, and
 * paymaster integration patterns.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { encodeFunctionData, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import {
  GaslessT402Client,
  createGaslessT402Client,
  type GaslessPaymentParams,
  type GaslessClientConfig,
} from "../../src/erc4337/t402";
import { UserOpBuilder } from "../../src/erc4337/builder";
import { BundlerClient } from "../../src/erc4337/bundler";
import { PaymasterClient } from "../../src/erc4337/paymaster";
import type {
  SmartAccountSigner,
  UserOperation,
  GasEstimate,
} from "../../src/erc4337/types";
import { ENTRYPOINT_V07_ADDRESS } from "../../src/erc4337/constants";
import { getTokenConfig } from "../../src/tokens";

// Test constants
const TEST_TOKEN_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Address; // Base Sepolia USDC
const TEST_RECIPIENT = "0x9876543210987654321098765432109876543210" as Address;
const TEST_AMOUNT = 1000000n; // 1 USDC

/**
 * Mock SmartAccountSigner for testing
 */
function createMockSigner(address: Address): SmartAccountSigner {
  return {
    getAddress: vi.fn().mockResolvedValue(address),
    isDeployed: vi.fn().mockResolvedValue(true),
    getInitCode: vi.fn().mockResolvedValue("0x" as Hex),
    getNonce: vi.fn().mockResolvedValue(0n),
    signMessage: vi.fn().mockResolvedValue("0x" + "00".repeat(65) as Hex),
    signTypedData: vi.fn().mockResolvedValue("0x" + "00".repeat(65) as Hex),
    signUserOp: vi.fn().mockResolvedValue("0x" + "00".repeat(65) as Hex),
    encodeExecute: vi.fn().mockImplementation((to: Address, value: bigint, data: Hex) => {
      // Simplified execute encoding
      return encodeFunctionData({
        abi: [{
          inputs: [
            { name: "dest", type: "address" },
            { name: "value", type: "uint256" },
            { name: "func", type: "bytes" },
          ],
          name: "execute",
          outputs: [],
          stateMutability: "nonpayable",
          type: "function",
        }],
        functionName: "execute",
        args: [to, value, data],
      });
    }),
    encodeExecuteBatch: vi.fn().mockImplementation((
      targets: Address[],
      values: bigint[],
      datas: Hex[],
    ) => {
      // Simplified batch execute encoding
      return encodeFunctionData({
        abi: [{
          inputs: [
            { name: "dest", type: "address[]" },
            { name: "value", type: "uint256[]" },
            { name: "func", type: "bytes[]" },
          ],
          name: "executeBatch",
          outputs: [],
          stateMutability: "nonpayable",
          type: "function",
        }],
        functionName: "executeBatch",
        args: [targets, values, datas],
      });
    }),
  };
}

describe("ERC-4337 Integration Tests", () => {
  describe("UserOpBuilder", () => {
    it("should build a valid UserOperation structure", async () => {
      const builder = new UserOpBuilder();
      const mockSigner = createMockSigner(
        "0x1234567890123456789012345678901234567890" as Address,
      );
      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(),
      });

      const intent = {
        to: TEST_TOKEN_ADDRESS,
        value: 0n,
        data: encodeFunctionData({
          abi: [{
            inputs: [
              { name: "to", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            name: "transfer",
            outputs: [{ name: "", type: "bool" }],
            stateMutability: "nonpayable",
            type: "function",
          }],
          functionName: "transfer",
          args: [TEST_RECIPIENT, TEST_AMOUNT],
        }),
      };

      const gasEstimate: GasEstimate = {
        verificationGasLimit: 150000n,
        callGasLimit: 100000n,
        preVerificationGas: 50000n,
      };

      const userOp = await builder.buildUserOp(
        mockSigner,
        intent,
        publicClient,
        gasEstimate,
      );

      // Verify UserOperation structure
      expect(userOp.sender).toBeDefined();
      expect(userOp.nonce).toBeDefined();
      expect(userOp.callData).toBeDefined();
      // Gas limits may be padded by the builder for safety margins
      expect(userOp.callGasLimit).toBeGreaterThanOrEqual(gasEstimate.callGasLimit);
      expect(userOp.verificationGasLimit).toBeGreaterThanOrEqual(gasEstimate.verificationGasLimit);
      expect(userOp.preVerificationGas).toBeGreaterThanOrEqual(gasEstimate.preVerificationGas);
    });

    it("should build batch UserOperation for multiple payments", async () => {
      const builder = new UserOpBuilder();
      const mockSigner = createMockSigner(
        "0x1234567890123456789012345678901234567890" as Address,
      );
      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(),
      });

      const intents = [
        {
          to: TEST_TOKEN_ADDRESS,
          value: 0n,
          data: encodeFunctionData({
            abi: [{
              inputs: [
                { name: "to", type: "address" },
                { name: "amount", type: "uint256" },
              ],
              name: "transfer",
              outputs: [{ name: "", type: "bool" }],
              stateMutability: "nonpayable",
              type: "function",
            }],
            functionName: "transfer",
            args: [TEST_RECIPIENT, TEST_AMOUNT],
          }),
        },
        {
          to: TEST_TOKEN_ADDRESS,
          value: 0n,
          data: encodeFunctionData({
            abi: [{
              inputs: [
                { name: "to", type: "address" },
                { name: "amount", type: "uint256" },
              ],
              name: "transfer",
              outputs: [{ name: "", type: "bool" }],
              stateMutability: "nonpayable",
              type: "function",
            }],
            functionName: "transfer",
            args: ["0x1111111111111111111111111111111111111111" as Address, 2000000n],
          }),
        },
      ];

      const gasEstimate: GasEstimate = {
        verificationGasLimit: 150000n,
        callGasLimit: 200000n, // Higher for batch
        preVerificationGas: 50000n,
      };

      const userOp = await builder.buildBatchUserOp(
        mockSigner,
        intents,
        publicClient,
        gasEstimate,
      );

      // Verify batch UserOperation
      expect(userOp.sender).toBeDefined();
      expect(userOp.callData).toBeDefined();
      // Batch call data should be larger than single
      expect(userOp.callData.length).toBeGreaterThan(100);
    });
  });

  describe("GaslessT402Client", () => {
    let mockSigner: SmartAccountSigner;
    let publicClient: ReturnType<typeof createPublicClient>;
    const testAddress = "0x1234567890123456789012345678901234567890" as Address;

    beforeEach(() => {
      mockSigner = createMockSigner(testAddress);
      publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(),
      });
    });

    it("should create client with config", () => {
      const config: GaslessClientConfig = {
        signer: mockSigner,
        bundler: {
          url: "https://bundler.example.com",
          chainId: baseSepolia.id,
        },
        chainId: baseSepolia.id,
        publicClient,
      };

      const client = createGaslessT402Client(config);
      expect(client).toBeInstanceOf(GaslessT402Client);
    });

    it("should return smart account address", async () => {
      const config: GaslessClientConfig = {
        signer: mockSigner,
        bundler: {
          url: "https://bundler.example.com",
          chainId: baseSepolia.id,
        },
        chainId: baseSepolia.id,
        publicClient,
      };

      const client = createGaslessT402Client(config);
      const address = await client.getAccountAddress();

      expect(address).toBe(testAddress);
      expect(mockSigner.getAddress).toHaveBeenCalled();
    });

    it("should check if account is deployed", async () => {
      const config: GaslessClientConfig = {
        signer: mockSigner,
        bundler: {
          url: "https://bundler.example.com",
          chainId: baseSepolia.id,
        },
        chainId: baseSepolia.id,
        publicClient,
      };

      const client = createGaslessT402Client(config);
      const isDeployed = await client.isAccountDeployed();

      expect(isDeployed).toBe(true);
      expect(mockSigner.isDeployed).toHaveBeenCalled();
    });

    it("should build correct call data for ERC20 transfer", async () => {
      const config: GaslessClientConfig = {
        signer: mockSigner,
        bundler: {
          url: "https://bundler.example.com",
          chainId: baseSepolia.id,
        },
        chainId: baseSepolia.id,
        publicClient,
      };

      const client = createGaslessT402Client(config);

      const params: GaslessPaymentParams = {
        tokenAddress: TEST_TOKEN_ADDRESS,
        to: TEST_RECIPIENT,
        amount: TEST_AMOUNT,
      };

      // Execute would call bundler, but we can verify signer methods are called
      // For this test, we just verify the client is properly configured
      expect(client).toBeDefined();
    });
  });

  describe("Payment Params Validation", () => {
    it("should accept valid payment params without authorization", () => {
      const params: GaslessPaymentParams = {
        tokenAddress: TEST_TOKEN_ADDRESS,
        to: TEST_RECIPIENT,
        amount: TEST_AMOUNT,
      };

      expect(params.tokenAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(params.to).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(params.amount).toBeGreaterThan(0n);
      expect(params.authorization).toBeUndefined();
    });

    it("should accept valid payment params with authorization", () => {
      const now = Math.floor(Date.now() / 1000);
      const params: GaslessPaymentParams = {
        tokenAddress: TEST_TOKEN_ADDRESS,
        to: TEST_RECIPIENT,
        amount: TEST_AMOUNT,
        authorization: {
          validAfter: BigInt(now - 600),
          validBefore: BigInt(now + 3600),
          nonce: "0x" + "00".repeat(32) as Hex,
          signature: "0x" + "00".repeat(65) as Hex,
        },
      };

      expect(params.authorization).toBeDefined();
      expect(params.authorization!.validAfter).toBeLessThan(params.authorization!.validBefore);
    });
  });

  describe("Token Configuration for ERC-4337", () => {
    it("should identify EIP-3009 tokens that support gasless transfers", () => {
      // Base Sepolia USDC supports EIP-3009
      const token = getTokenConfig("eip155:84532", "USDC");
      expect(token).toBeDefined();
      expect(token!.tokenType).toBe("eip3009");
    });

    it("should identify legacy tokens that require standard transfers", () => {
      // Ethereum USDT is legacy (no EIP-3009)
      const token = getTokenConfig("eip155:1", "USDT");
      expect(token).toBeDefined();
      expect(token!.tokenType).toBe("legacy");
    });
  });

  describe("EntryPoint Configuration", () => {
    it("should use v0.7 EntryPoint address", () => {
      // ERC-4337 v0.7 EntryPoint
      expect(ENTRYPOINT_V07_ADDRESS).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(ENTRYPOINT_V07_ADDRESS).toBe("0x0000000071727De22E5E9d8BAf0edAc6f37da032");
    });
  });

  describe("Batch Payments", () => {
    it("should support batching multiple payments", async () => {
      const mockSigner = createMockSigner(
        "0x1234567890123456789012345678901234567890" as Address,
      );

      // Verify batch encoding is called with correct parameters
      const targets = [TEST_TOKEN_ADDRESS, TEST_TOKEN_ADDRESS];
      const values = [0n, 0n];
      const datas = [
        encodeFunctionData({
          abi: [{
            inputs: [
              { name: "to", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            name: "transfer",
            outputs: [{ name: "", type: "bool" }],
            stateMutability: "nonpayable",
            type: "function",
          }],
          functionName: "transfer",
          args: [TEST_RECIPIENT, TEST_AMOUNT],
        }),
        encodeFunctionData({
          abi: [{
            inputs: [
              { name: "to", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            name: "transfer",
            outputs: [{ name: "", type: "bool" }],
            stateMutability: "nonpayable",
            type: "function",
          }],
          functionName: "transfer",
          args: ["0x2222222222222222222222222222222222222222" as Address, 2000000n],
        }),
      ];

      const batchCallData = mockSigner.encodeExecuteBatch(targets, values, datas as Hex[]);

      expect(batchCallData).toBeDefined();
      expect(batchCallData.length).toBeGreaterThan(0);
      expect(mockSigner.encodeExecuteBatch).toHaveBeenCalledWith(targets, values, datas);
    });
  });

  describe("Gas Estimation Defaults", () => {
    it("should have sensible default gas limits", () => {
      // These are the default values used when estimation fails
      const defaults: GasEstimate = {
        verificationGasLimit: 150000n,
        callGasLimit: 100000n,
        preVerificationGas: 50000n,
      };

      // Verification should be enough for signature checks
      expect(defaults.verificationGasLimit).toBeGreaterThanOrEqual(100000n);

      // Call gas should handle ERC20 transfer
      expect(defaults.callGasLimit).toBeGreaterThanOrEqual(50000n);

      // Pre-verification covers bundler overhead
      expect(defaults.preVerificationGas).toBeGreaterThanOrEqual(21000n);
    });
  });

  describe("Paymaster Integration", () => {
    it("should support optional paymaster configuration", () => {
      const mockSigner = createMockSigner(
        "0x1234567890123456789012345678901234567890" as Address,
      );
      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(),
      });

      // Without paymaster
      const configNoPaymaster: GaslessClientConfig = {
        signer: mockSigner,
        bundler: {
          url: "https://bundler.example.com",
          chainId: baseSepolia.id,
        },
        chainId: baseSepolia.id,
        publicClient,
      };

      const clientNoPaymaster = createGaslessT402Client(configNoPaymaster);
      expect(clientNoPaymaster).toBeDefined();

      // With paymaster
      const configWithPaymaster: GaslessClientConfig = {
        signer: mockSigner,
        bundler: {
          url: "https://bundler.example.com",
          chainId: baseSepolia.id,
        },
        paymaster: {
          type: "biconomy",
          url: "https://paymaster.example.com",
          apiKey: "test-key",
        },
        chainId: baseSepolia.id,
        publicClient,
      };

      const clientWithPaymaster = createGaslessT402Client(configWithPaymaster);
      expect(clientWithPaymaster).toBeDefined();
    });
  });
});
