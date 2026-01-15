/**
 * Cross-Scheme Integration Tests for EVM Mechanism
 *
 * Tests for compatibility between exact (EIP-3009) and exact-legacy schemes,
 * token fallback chains, and scheme selection based on token capabilities.
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
import {
  ExactEvmScheme as ExactEvmClient,
  toFacilitatorEvmSigner,
} from "../../src";
import { ExactEvmScheme as ExactEvmServer } from "../../src/exact/server/scheme";
import { ExactEvmScheme as ExactEvmFacilitator } from "../../src/exact/facilitator/scheme";
import { ExactLegacyEvmScheme as ExactLegacyEvmClient } from "../../src/exact-legacy/client/scheme";
import { ExactLegacyEvmScheme as ExactLegacyEvmServer } from "../../src/exact-legacy/server/scheme";
import { ExactLegacyEvmScheme as ExactLegacyEvmFacilitator } from "../../src/exact-legacy/facilitator/scheme";
import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient, createPublicClient, http } from "viem";
import { mainnet, polygon, baseSepolia } from "viem/chains";
import {
  TOKEN_REGISTRY,
  getTokenConfig,
  getNetworkTokens,
  supportsEIP3009,
  USDT_LEGACY_ADDRESSES,
} from "../../src/tokens";

// Load private keys from environment (optional - tests will skip if not provided)
const CLIENT_PRIVATE_KEY = process.env.CLIENT_PRIVATE_KEY as `0x${string}` | undefined;
const FACILITATOR_PRIVATE_KEY = process.env.FACILITATOR_PRIVATE_KEY as `0x${string}` | undefined;

const HAS_PRIVATE_KEYS = Boolean(CLIENT_PRIVATE_KEY && FACILITATOR_PRIVATE_KEY);

/**
 * Multi-scheme facilitator client
 */
class MultiSchemeFacilitatorClient implements FacilitatorClient {
  readonly t402Version = 2;

  constructor(
    private readonly facilitator: t402Facilitator,
    readonly scheme: string,
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

describe("Cross-Scheme Integration Tests", () => {
  describe("Token Type Classification", () => {
    it("should correctly identify EIP-3009 vs legacy tokens", () => {
      // USDT0 and USDC should support EIP-3009
      expect(supportsEIP3009("eip155:1", "USDT0")).toBe(true);
      expect(supportsEIP3009("eip155:1", "USDC")).toBe(true);

      // Legacy USDT should not support EIP-3009
      expect(supportsEIP3009("eip155:1", "USDT")).toBe(false);
      expect(supportsEIP3009("eip155:137", "USDT")).toBe(false);
    });

    it("should identify networks with mixed token support", () => {
      // Ethereum has both EIP-3009 and legacy tokens
      const ethTokens = getNetworkTokens("eip155:1");
      const eip3009Tokens = ethTokens.filter(t => t.tokenType === "eip3009");
      const legacyTokens = ethTokens.filter(t => t.tokenType === "legacy");

      expect(eip3009Tokens.length).toBeGreaterThan(0);
      expect(legacyTokens.length).toBeGreaterThan(0);

      // Polygon also has both types
      const polygonTokens = getNetworkTokens("eip155:137");
      const polygonEip3009 = polygonTokens.filter(t => t.tokenType === "eip3009");
      const polygonLegacy = polygonTokens.filter(t => t.tokenType === "legacy");

      expect(polygonEip3009.length).toBeGreaterThan(0);
      expect(polygonLegacy.length).toBeGreaterThan(0);
    });

    it("should have correct legacy USDT addresses", () => {
      // Verify legacy USDT is mapped correctly
      expect(USDT_LEGACY_ADDRESSES["eip155:1"]).toBe(
        "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      );
      expect(USDT_LEGACY_ADDRESSES["eip155:137"]).toBe(
        "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
      );
    });
  });

  describe("Scheme Selection Based on Token", () => {
    it("should select exact scheme for EIP-3009 tokens", () => {
      const network = "eip155:84532"; // Base Sepolia
      const token = getTokenConfig(network, "USDC");

      expect(token).toBeDefined();
      expect(token!.tokenType).toBe("eip3009");

      // For EIP-3009 tokens, use exact scheme
      const schemeType = token!.tokenType === "eip3009" ? "exact" : "exact-legacy";
      expect(schemeType).toBe("exact");
    });

    it("should select exact-legacy scheme for legacy tokens", () => {
      const network = "eip155:1"; // Ethereum
      const token = getTokenConfig(network, "USDT");

      expect(token).toBeDefined();
      expect(token!.tokenType).toBe("legacy");

      // For legacy tokens, use exact-legacy scheme
      const schemeType = token!.tokenType === "eip3009" ? "exact" : "exact-legacy";
      expect(schemeType).toBe("exact-legacy");
    });
  });

  describe.skipIf(!HAS_PRIVATE_KEYS)("Exact Scheme Payment Flow", () => {
    let client: t402Client;
    let server: t402ResourceServer;
    const network = "eip155:84532";

    beforeEach(async () => {
      const clientAccount = privateKeyToAccount(CLIENT_PRIVATE_KEY);
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

      const facilitator = new t402Facilitator().register(
        network,
        new ExactEvmFacilitator(facilitatorSigner),
      );

      const facilitatorClient = new MultiSchemeFacilitatorClient(facilitator, "exact", network);
      server = new t402ResourceServer(facilitatorClient);
      server.register(network, new ExactEvmServer());
      await server.initialize();
    });

    it("should create payload using transferWithAuthorization format", async () => {
      const requirements = await server.buildPaymentRequirements({
        scheme: "exact",
        payTo: "0x9876543210987654321098765432109876543210",
        price: "$0.001",
        network: network as Network,
      });

      const paymentRequired = server.createPaymentRequiredResponse(requirements, {
        url: "https://test.example.com",
        description: "Test",
        mimeType: "application/json",
      });

      const payload = await client.createPaymentPayload(paymentRequired);

      // Exact scheme uses authorization with from/to/value/validAfter/validBefore/nonce
      const evmPayload = payload.payload as {
        authorization: {
          from: string;
          to: string;
          value: string;
          validAfter: string;
          validBefore: string;
          nonce: `0x${string}`;
        };
        signature: string;
      };

      expect(evmPayload.authorization).toBeDefined();
      expect(evmPayload.authorization.from).toBeDefined();
      expect(evmPayload.authorization.to).toBeDefined();
      expect(evmPayload.authorization.value).toBeDefined();
      expect(evmPayload.authorization.validAfter).toBeDefined();
      expect(evmPayload.authorization.validBefore).toBeDefined();
      expect(evmPayload.authorization.nonce).toBeDefined();
      expect(evmPayload.signature).toBeDefined();

      // Should NOT have spender field (that's for legacy scheme)
      expect((evmPayload.authorization as Record<string, unknown>).spender).toBeUndefined();
    });
  });

  describe.skipIf(!HAS_PRIVATE_KEYS)("Exact-Legacy Scheme Payment Flow", () => {
    let client: t402Client;
    let server: t402ResourceServer;
    const network = "eip155:1"; // Ethereum with legacy USDT

    beforeEach(async () => {
      const clientAccount = privateKeyToAccount(CLIENT_PRIVATE_KEY);
      const legacyClient = new ExactLegacyEvmClient(clientAccount);
      client = new t402Client().register(network, legacyClient);

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
        new ExactLegacyEvmFacilitator(facilitatorSigner),
      );

      const facilitatorClient = new MultiSchemeFacilitatorClient(
        facilitator,
        "exact-legacy",
        network,
      );
      server = new t402ResourceServer(facilitatorClient);
      server.register(network, new ExactLegacyEvmServer());
      await server.initialize();
    });

    it("should create payload using legacy authorization format with spender", async () => {
      const legacyToken = getTokenConfig(network, "USDT");

      const requirements: PaymentRequirements[] = [
        {
          scheme: "exact-legacy",
          network: network as Network,
          asset: legacyToken!.address,
          amount: "1000000",
          payTo: "0x9876543210987654321098765432109876543210",
          maxTimeoutSeconds: 3600,
          extra: {
            name: legacyToken!.name,
            version: legacyToken!.version,
            spender: FACILITATOR_PRIVATE_KEY
              ? privateKeyToAccount(FACILITATOR_PRIVATE_KEY).address
              : "0x0000000000000000000000000000000000000001",
          },
        },
      ];

      const paymentRequired = {
        t402Version: 2,
        accepts: requirements,
        resource: {
          url: "https://test.example.com",
          description: "Test",
          mimeType: "application/json",
        },
      };

      const payload = await client.createPaymentPayload(paymentRequired);

      // Legacy scheme uses authorization with spender field
      const legacyPayload = payload.payload as {
        authorization: {
          from: string;
          to: string;
          value: string;
          validAfter: string;
          validBefore: string;
          nonce: `0x${string}`;
          spender: string;
        };
        signature: string;
      };

      expect(legacyPayload.authorization).toBeDefined();
      expect(legacyPayload.authorization.spender).toBeDefined();
      expect(legacyPayload.signature).toBeDefined();
    });
  });

  describe("Token Fallback Chain", () => {
    it("should fall back through token priority on network with multiple tokens", () => {
      // Test that token priority is respected
      const network = "eip155:1";
      const tokens = getNetworkTokens(network);

      // Verify order: USDT0 (priority 1) < USDC (priority 2) < USDT (priority 10)
      const priorities = tokens.map(t => ({ symbol: t.symbol, priority: t.priority }));

      const usdt0Index = priorities.findIndex(p => p.symbol === "USDT0");
      const usdcIndex = priorities.findIndex(p => p.symbol === "USDC");
      const usdtIndex = priorities.findIndex(p => p.symbol === "USDT");

      if (usdt0Index !== -1 && usdcIndex !== -1) {
        expect(usdt0Index).toBeLessThan(usdcIndex);
      }
      if (usdcIndex !== -1 && usdtIndex !== -1) {
        expect(usdcIndex).toBeLessThan(usdtIndex);
      }
    });

    it("should use EIP-3009 tokens before legacy tokens", () => {
      const network = "eip155:1";
      const tokens = getNetworkTokens(network);

      // EIP-3009 tokens should have lower priority numbers (higher priority)
      const eip3009Tokens = tokens.filter(t => t.tokenType === "eip3009");
      const legacyTokens = tokens.filter(t => t.tokenType === "legacy");

      if (eip3009Tokens.length > 0 && legacyTokens.length > 0) {
        const maxEip3009Priority = Math.max(...eip3009Tokens.map(t => t.priority));
        const minLegacyPriority = Math.min(...legacyTokens.map(t => t.priority));

        expect(maxEip3009Priority).toBeLessThan(minLegacyPriority);
      }
    });
  });

  describe.skipIf(!HAS_PRIVATE_KEYS)("Multi-Scheme Registration", () => {
    it("should support both schemes on same network", async () => {
      const network = "eip155:1";
      const clientAccount = privateKeyToAccount(CLIENT_PRIVATE_KEY);

      // Register both scheme clients
      const exactClient = new ExactEvmClient(clientAccount);
      const legacyClient = new ExactLegacyEvmClient(clientAccount);

      // Can register both under different scheme identifiers
      const client = new t402Client()
        .register(network, exactClient)
        .register(network, legacyClient);

      // Client should be able to handle requirements for either scheme
      expect(client).toBeDefined();
    });

    it("should create correct payload type based on scheme", async () => {
      const network = "eip155:84532";
      const clientAccount = privateKeyToAccount(CLIENT_PRIVATE_KEY);

      // Test exact scheme
      const exactClient = new ExactEvmClient(clientAccount);
      const exactT402 = new t402Client().register(network, exactClient);

      const token = getTokenConfig(network, "USDC");

      const exactRequirements: PaymentRequirements[] = [
        {
          scheme: "exact",
          network: network as Network,
          asset: token!.address,
          amount: "1000000",
          payTo: "0x9876543210987654321098765432109876543210",
          maxTimeoutSeconds: 3600,
          extra: {
            name: token!.name,
            version: token!.version,
          },
        },
      ];

      const exactRequired = {
        t402Version: 2,
        accepts: exactRequirements,
        resource: {
          url: "https://test.example.com",
          description: "Test",
          mimeType: "application/json",
        },
      };

      const exactPayload = await exactT402.createPaymentPayload(exactRequired);
      expect(exactPayload.accepted.scheme).toBe("exact");

      // Exact payload should NOT have spender
      const exactAuth = (exactPayload.payload as Record<string, unknown>).authorization as Record<string, unknown>;
      expect(exactAuth.spender).toBeUndefined();
    });
  });
});
