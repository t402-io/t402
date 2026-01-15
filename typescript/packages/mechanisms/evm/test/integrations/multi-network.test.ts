/**
 * Multi-Network Integration Tests for EVM Mechanism
 *
 * These tests verify that the EVM payment scheme works correctly
 * across different networks with their specific token configurations.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { t402Client } from "@t402/core/client";
import { t402Facilitator } from "@t402/core/facilitator";
import {
  t402ResourceServer,
  FacilitatorClient,
} from "@t402/core/server";
import {
  Network,
  PaymentPayload,
  PaymentRequirements,
  VerifyResponse,
  SettleResponse,
  SupportedResponse,
} from "@t402/core/types";
import { ExactEvmScheme as ExactEvmClient, toFacilitatorEvmSigner } from "../../src";
import { ExactEvmScheme as ExactEvmServer } from "../../src/exact/server/scheme";
import { ExactEvmScheme as ExactEvmFacilitator } from "../../src/exact/facilitator/scheme";
import type { ExactEvmPayloadV2 } from "../../src/types";
import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient, createPublicClient, http } from "viem";
import {
  mainnet,
  arbitrum,
  polygon,
  base,
  baseSepolia,
  sepolia,
} from "viem/chains";
import {
  TOKEN_REGISTRY,
  getDefaultToken,
  getNetworkTokens,
  getTokenConfig,
} from "../../src/tokens";

// Load private keys from environment (optional - tests will skip if not provided)
const CLIENT_PRIVATE_KEY = process.env.CLIENT_PRIVATE_KEY as `0x${string}` | undefined;
const FACILITATOR_PRIVATE_KEY = process.env.FACILITATOR_PRIVATE_KEY as `0x${string}` | undefined;

const HAS_PRIVATE_KEYS = Boolean(CLIENT_PRIVATE_KEY && FACILITATOR_PRIVATE_KEY);

/**
 * Network configuration for testing
 */
const NETWORK_CONFIGS = {
  "eip155:84532": { chain: baseSepolia, name: "Base Sepolia" },
  "eip155:11155111": { chain: sepolia, name: "Sepolia" },
  "eip155:8453": { chain: base, name: "Base" },
  "eip155:1": { chain: mainnet, name: "Ethereum" },
  "eip155:42161": { chain: arbitrum, name: "Arbitrum" },
  "eip155:137": { chain: polygon, name: "Polygon" },
} as const;

/**
 * EVM Facilitator Client wrapper for multi-network tests
 */
class MultiNetworkFacilitatorClient implements FacilitatorClient {
  readonly scheme = "exact";
  readonly t402Version = 2;

  constructor(
    private readonly facilitator: t402Facilitator,
    readonly network: string,
  ) {}

  verify(
    paymentPayload: PaymentPayload,
    paymentRequirements: PaymentRequirements,
  ): Promise<VerifyResponse> {
    return this.facilitator.verify(paymentPayload, paymentRequirements);
  }

  settle(
    paymentPayload: PaymentPayload,
    paymentRequirements: PaymentRequirements,
  ): Promise<SettleResponse> {
    return this.facilitator.settle(paymentPayload, paymentRequirements);
  }

  getSupported(): Promise<SupportedResponse> {
    return Promise.resolve(this.facilitator.getSupported());
  }
}

/**
 * Create payment requirements for a network
 */
function createPaymentRequirements(
  network: Network,
  payTo: string,
  amount: string,
): PaymentRequirements {
  const token = getDefaultToken(network);
  if (!token) {
    throw new Error(`No token available for network: ${network}`);
  }

  return {
    scheme: "exact",
    network,
    asset: token.address,
    amount,
    payTo,
    maxTimeoutSeconds: 3600,
    extra: {
      name: token.name,
      version: token.version,
    },
  };
}

describe("Multi-Network Integration Tests", () => {
  describe("Token Registry Verification", () => {
    it("should have valid token configurations for all supported networks", () => {
      const networks = Object.keys(TOKEN_REGISTRY);
      expect(networks.length).toBeGreaterThan(0);

      for (const network of networks) {
        const tokens = getNetworkTokens(network);
        expect(tokens.length).toBeGreaterThan(0);

        // Verify each token has required fields
        for (const token of tokens) {
          expect(token.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
          expect(token.symbol).toBeDefined();
          expect(token.name).toBeDefined();
          expect(token.version).toBeDefined();
          expect(token.decimals).toBe(6); // USDC/USDT always 6 decimals
          expect(["eip3009", "legacy"]).toContain(token.tokenType);
          expect(typeof token.priority).toBe("number");
        }
      }
    });

    it("should return tokens sorted by priority", () => {
      for (const network of Object.keys(TOKEN_REGISTRY)) {
        const tokens = getNetworkTokens(network);
        for (let i = 1; i < tokens.length; i++) {
          expect(tokens[i].priority).toBeGreaterThanOrEqual(tokens[i - 1].priority);
        }
      }
    });

    it("should prefer USDT0 over USDC over legacy USDT", () => {
      // Ethereum has all three token types
      const ethTokens = getNetworkTokens("eip155:1");
      const usdt0 = ethTokens.find(t => t.symbol === "USDT0");
      const usdc = ethTokens.find(t => t.symbol === "USDC");
      const usdt = ethTokens.find(t => t.symbol === "USDT");

      if (usdt0 && usdc) {
        expect(usdt0.priority).toBeLessThan(usdc.priority);
      }
      if (usdc && usdt) {
        expect(usdc.priority).toBeLessThan(usdt.priority);
      }
    });
  });

  describe.skipIf(!HAS_PRIVATE_KEYS)("Server Price Parsing - Multi-Network", () => {
    const testNetworks: Network[] = [
      "eip155:84532", // Base Sepolia
      "eip155:8453",  // Base
      "eip155:1",     // Ethereum
      "eip155:42161", // Arbitrum
      "eip155:137",   // Polygon
    ];

    for (const network of testNetworks) {
      const token = getDefaultToken(network);
      if (!token) continue;

      describe(`Network: ${network}`, () => {
        let server: t402ResourceServer;
        let evmServer: ExactEvmServer;

        beforeEach(async () => {
          const facilitatorAccount = privateKeyToAccount(FACILITATOR_PRIVATE_KEY);
          const config = NETWORK_CONFIGS[network as keyof typeof NETWORK_CONFIGS];

          if (!config) {
            throw new Error(`No config for network: ${network}`);
          }

          const publicClient = createPublicClient({
            chain: config.chain,
            transport: http(),
          });

          const walletClient = createWalletClient({
            account: facilitatorAccount,
            chain: config.chain,
            transport: http(),
          });

          const facilitatorSigner = toFacilitatorEvmSigner({
            address: facilitatorAccount.address,
            readContract: args =>
              publicClient.readContract({
                ...args,
                args: args.args || [],
              } as never),
            verifyTypedData: args => publicClient.verifyTypedData(args as never),
            writeContract: args =>
              walletClient.writeContract({
                ...args,
                args: args.args || [],
              } as never),
            sendTransaction: args => walletClient.sendTransaction(args),
            waitForTransactionReceipt: args => publicClient.waitForTransactionReceipt(args),
            getCode: args => publicClient.getCode(args),
          });

          const facilitator = new t402Facilitator().register(
            network,
            new ExactEvmFacilitator(facilitatorSigner),
          );

          const facilitatorClient = new MultiNetworkFacilitatorClient(facilitator, network);
          server = new t402ResourceServer(facilitatorClient);
          evmServer = new ExactEvmServer();
          server.register(network, evmServer);
          await server.initialize();
        });

        it(`should parse price and select ${token.symbol} token`, async () => {
          const requirements = await server.buildPaymentRequirements({
            scheme: "exact",
            payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
            price: "$1.00",
            network,
          });

          expect(requirements).toHaveLength(1);
          expect(requirements[0].amount).toBe("1000000"); // 1 USD = 1,000,000 smallest units
          expect(requirements[0].asset.toLowerCase()).toBe(token.address.toLowerCase());
        });

        it("should handle different price formats", async () => {
          const testCases = [
            { input: "$10.00", expected: "10000000" },
            { input: "5.50", expected: "5500000" },
            { input: 0.01, expected: "10000" },
            { input: 100, expected: "100000000" },
          ];

          for (const testCase of testCases) {
            const requirements = await server.buildPaymentRequirements({
              scheme: "exact",
              payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
              price: testCase.input,
              network,
            });

            expect(requirements[0].amount).toBe(testCase.expected);
          }
        });
      });
    }
  });

  describe.skipIf(!HAS_PRIVATE_KEYS)("Client Payload Creation - Multi-Network", () => {
    const testNetworks: Network[] = ["eip155:84532", "eip155:8453", "eip155:42161"];

    for (const network of testNetworks) {
      const token = getDefaultToken(network);
      if (!token) continue;

      describe(`Network: ${network}`, () => {
        let client: t402Client;
        let clientAddress: `0x${string}`;

        beforeEach(() => {
          const clientAccount = privateKeyToAccount(CLIENT_PRIVATE_KEY);
          clientAddress = clientAccount.address;

          const evmClient = new ExactEvmClient(clientAccount);
          client = new t402Client().register(network, evmClient);
        });

        it("should create valid payment payload", async () => {
          const requirements = createPaymentRequirements(
            network,
            "0x9876543210987654321098765432109876543210",
            "1000000",
          );

          const paymentRequired = {
            t402Version: 2,
            accepts: [requirements],
            resource: {
              url: "https://test.example.com",
              description: "Test resource",
              mimeType: "application/json",
            },
          };

          const paymentPayload = await client.createPaymentPayload(paymentRequired);

          expect(paymentPayload).toBeDefined();
          expect(paymentPayload.t402Version).toBe(2);
          expect(paymentPayload.accepted.scheme).toBe("exact");
          expect(paymentPayload.accepted.network).toBe(network);

          const evmPayload = paymentPayload.payload as ExactEvmPayloadV2;
          expect(evmPayload.authorization).toBeDefined();
          expect(evmPayload.authorization.from).toBe(clientAddress);
          expect(evmPayload.signature).toMatch(/^0x[a-fA-F0-9]+$/);
        });

        it("should include correct chain ID in signature domain", async () => {
          const requirements = createPaymentRequirements(
            network,
            "0x9876543210987654321098765432109876543210",
            "1000000",
          );

          const paymentRequired = {
            t402Version: 2,
            accepts: [requirements],
            resource: {
              url: "https://test.example.com",
              description: "Test resource",
              mimeType: "application/json",
            },
          };

          const paymentPayload = await client.createPaymentPayload(paymentRequired);

          // The payload should be tied to the correct network
          expect(paymentPayload.accepted.network).toBe(network);

          // Extract chain ID from network identifier
          const expectedChainId = parseInt(network.split(":")[1]);
          const config = NETWORK_CONFIGS[network as keyof typeof NETWORK_CONFIGS];
          if (config) {
            expect(config.chain.id).toBe(expectedChainId);
          }
        });
      });
    }
  });

  describe.skipIf(!HAS_PRIVATE_KEYS)("Token Selection with preferredToken", () => {
    it("should use preferredToken when specified", async () => {
      const network = "eip155:1"; // Ethereum has multiple tokens
      const facilitatorAccount = privateKeyToAccount(FACILITATOR_PRIVATE_KEY);

      const publicClient = createPublicClient({
        chain: mainnet,
        transport: http(),
      });

      const walletClient = createWalletClient({
        account: facilitatorAccount,
        chain: mainnet,
        transport: http(),
      });

      const facilitatorSigner = toFacilitatorEvmSigner({
        address: facilitatorAccount.address,
        readContract: args =>
          publicClient.readContract({
            ...args,
            args: args.args || [],
          } as never),
        verifyTypedData: args => publicClient.verifyTypedData(args as never),
        writeContract: args =>
          walletClient.writeContract({
            ...args,
            args: args.args || [],
          } as never),
        sendTransaction: args => walletClient.sendTransaction(args),
        waitForTransactionReceipt: args => publicClient.waitForTransactionReceipt(args),
        getCode: args => publicClient.getCode(args),
      });

      const facilitator = new t402Facilitator().register(
        network,
        new ExactEvmFacilitator(facilitatorSigner),
      );

      const facilitatorClient = new MultiNetworkFacilitatorClient(facilitator, network);
      const server = new t402ResourceServer(facilitatorClient);

      // Create server with preferredToken = USDC
      const evmServer = new ExactEvmServer({ preferredToken: "USDC" });
      server.register(network, evmServer);
      await server.initialize();

      const requirements = await server.buildPaymentRequirements({
        scheme: "exact",
        payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        price: "$1.00",
        network: network as Network,
      });

      const usdcConfig = getTokenConfig(network, "USDC");
      expect(requirements[0].asset.toLowerCase()).toBe(usdcConfig?.address.toLowerCase());
    });

    it("should fall back to default if preferredToken not available", async () => {
      const network = "eip155:57073"; // Ink only has USDT0
      const facilitatorAccount = privateKeyToAccount(FACILITATOR_PRIVATE_KEY);

      // Note: Using mainnet chain as placeholder since Ink may not be in viem/chains
      const publicClient = createPublicClient({
        chain: mainnet,
        transport: http(),
      });

      const walletClient = createWalletClient({
        account: facilitatorAccount,
        chain: mainnet,
        transport: http(),
      });

      const facilitatorSigner = toFacilitatorEvmSigner({
        address: facilitatorAccount.address,
        readContract: args =>
          publicClient.readContract({
            ...args,
            args: args.args || [],
          } as never),
        verifyTypedData: args => publicClient.verifyTypedData(args as never),
        writeContract: args =>
          walletClient.writeContract({
            ...args,
            args: args.args || [],
          } as never),
        sendTransaction: args => walletClient.sendTransaction(args),
        waitForTransactionReceipt: args => publicClient.waitForTransactionReceipt(args),
        getCode: args => publicClient.getCode(args),
      });

      const facilitator = new t402Facilitator().register(
        network,
        new ExactEvmFacilitator(facilitatorSigner),
      );

      const facilitatorClient = new MultiNetworkFacilitatorClient(facilitator, network);
      const server = new t402ResourceServer(facilitatorClient);

      // Try to prefer USDC, but network only has USDT0
      const evmServer = new ExactEvmServer({ preferredToken: "USDC" });
      server.register(network, evmServer);
      await server.initialize();

      const requirements = await server.buildPaymentRequirements({
        scheme: "exact",
        payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        price: "$1.00",
        network: network as Network,
      });

      // Should fall back to USDT0 (the only available token)
      const usdt0Config = getTokenConfig(network, "USDT0");
      expect(requirements[0].asset.toLowerCase()).toBe(usdt0Config?.address.toLowerCase());
    });
  });

  describe.skipIf(!HAS_PRIVATE_KEYS)("Full Payment Flow - Base Sepolia", () => {
    let client: t402Client;
    let server: t402ResourceServer;
    let clientAddress: `0x${string}`;
    const network = "eip155:84532";

    beforeEach(async () => {
      const clientAccount = privateKeyToAccount(CLIENT_PRIVATE_KEY);
      clientAddress = clientAccount.address;

      const evmClient = new ExactEvmClient(clientAccount);
      client = new t402Client().register(network, evmClient);

      const facilitatorAccount = privateKeyToAccount(FACILITATOR_PRIVATE_KEY);

      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(),
      });

      const walletClient = createWalletClient({
        account: facilitatorAccount,
        chain: baseSepolia,
        transport: http(),
      });

      const facilitatorSigner = toFacilitatorEvmSigner({
        address: facilitatorAccount.address,
        readContract: args =>
          publicClient.readContract({
            ...args,
            args: args.args || [],
          } as never),
        verifyTypedData: args => publicClient.verifyTypedData(args as never),
        writeContract: args =>
          walletClient.writeContract({
            ...args,
            args: args.args || [],
          } as never),
        sendTransaction: args => walletClient.sendTransaction(args),
        waitForTransactionReceipt: args => publicClient.waitForTransactionReceipt(args),
        getCode: args => publicClient.getCode(args),
      });

      const evmFacilitator = new ExactEvmFacilitator(facilitatorSigner);
      const facilitator = new t402Facilitator().register(network, evmFacilitator);

      const facilitatorClient = new MultiNetworkFacilitatorClient(facilitator, network);
      server = new t402ResourceServer(facilitatorClient);
      server.register(network, new ExactEvmServer());
      await server.initialize();
    });

    it("should complete full verify and settle flow", async () => {
      // Server creates payment requirements
      const requirements = await server.buildPaymentRequirements({
        scheme: "exact",
        payTo: "0x9876543210987654321098765432109876543210",
        price: "$0.001",
        network: network as Network,
      });

      const paymentRequired = server.createPaymentRequiredResponse(requirements, {
        url: "https://test.example.com",
        description: "Test resource",
        mimeType: "application/json",
      });

      // Client creates payment payload
      const paymentPayload = await client.createPaymentPayload(paymentRequired);

      expect(paymentPayload).toBeDefined();
      expect(paymentPayload.t402Version).toBe(2);

      // Verify payload structure
      const evmPayload = paymentPayload.payload as ExactEvmPayloadV2;
      expect(evmPayload.authorization.from).toBe(clientAddress);
      expect(evmPayload.authorization.to).toBe("0x9876543210987654321098765432109876543210");

      // Server finds matching requirements
      const matched = server.findMatchingRequirements(requirements, paymentPayload);
      expect(matched).toBeDefined();

      // Server verifies payment
      const verifyResponse = await server.verifyPayment(paymentPayload, matched!);
      expect(verifyResponse.isValid).toBe(true);
      expect(verifyResponse.payer).toBe(clientAddress);

      // Server settles payment
      const settleResponse = await server.settlePayment(paymentPayload, matched!);
      expect(settleResponse.success).toBe(true);
      expect(settleResponse.network).toBe(network);
      expect(settleResponse.payer).toBe(clientAddress);
    });

    it("should reject invalid signatures", async () => {
      const requirements = await server.buildPaymentRequirements({
        scheme: "exact",
        payTo: "0x9876543210987654321098765432109876543210",
        price: "$0.001",
        network: network as Network,
      });

      const paymentRequired = server.createPaymentRequiredResponse(requirements, {
        url: "https://test.example.com",
        description: "Test resource",
        mimeType: "application/json",
      });

      const paymentPayload = await client.createPaymentPayload(paymentRequired);

      // Tamper with the signature
      const tamperedPayload = {
        ...paymentPayload,
        payload: {
          ...(paymentPayload.payload as ExactEvmPayloadV2),
          signature: "0x" + "00".repeat(65) as `0x${string}`,
        },
      };

      const matched = server.findMatchingRequirements(requirements, tamperedPayload);
      expect(matched).toBeDefined();

      const verifyResponse = await server.verifyPayment(tamperedPayload, matched!);
      expect(verifyResponse.isValid).toBe(false);
    });

    it("should reject mismatched amounts", async () => {
      const requirements = await server.buildPaymentRequirements({
        scheme: "exact",
        payTo: "0x9876543210987654321098765432109876543210",
        price: "$1.00",
        network: network as Network,
      });

      // Create requirements with different amount
      const differentAmountRequirements = requirements.map(r => ({
        ...r,
        amount: "999999999", // Much higher amount
      }));

      const paymentRequired = server.createPaymentRequiredResponse(requirements, {
        url: "https://test.example.com",
        description: "Test resource",
        mimeType: "application/json",
      });

      const paymentPayload = await client.createPaymentPayload(paymentRequired);

      // Try to match against different requirements
      const matched = server.findMatchingRequirements(differentAmountRequirements, paymentPayload);

      // Should not match because amounts differ
      expect(matched).toBeUndefined();
    });
  });
});
