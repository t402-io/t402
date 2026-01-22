import { describe, it, expect, vi } from "vitest";
import { ExactTronScheme } from "../src/exact/client/scheme";
import type { ClientTronSigner } from "../src/signer";
import {
  TRON_MAINNET_CAIP2,
  TRON_NILE_CAIP2,
  USDT_ADDRESSES,
  DEFAULT_FEE_LIMIT,
} from "../src/constants";

/**
 * Create a mock TRON signer for testing
 */
function createMockSigner(address: string = "TJYPgMHqGBqbjmgcDxBQEL1PPxbRvnLBKY"): ClientTronSigner {
  return {
    address,
    signTransaction: vi.fn().mockResolvedValue("0x" + "a".repeat(128)),
    getBlockInfo: vi.fn().mockResolvedValue({
      refBlockBytes: "abcd",
      refBlockHash: "1234567890abcdef",
      expiration: Date.now() + 60000,
    }),
  };
}

describe("ExactTronScheme (Client)", () => {
  describe("constructor", () => {
    it("should create instance with signer", () => {
      const signer = createMockSigner();
      const scheme = new ExactTronScheme(signer);
      expect(scheme.scheme).toBe("exact");
    });

    it("should create instance with custom config", () => {
      const signer = createMockSigner();
      const scheme = new ExactTronScheme(signer, { feeLimit: 50_000_000 });
      expect(scheme.scheme).toBe("exact");
    });
  });

  describe("createPaymentPayload", () => {
    it("should create valid payment payload", async () => {
      const signer = createMockSigner();
      const scheme = new ExactTronScheme(signer);

      const requirements = {
        scheme: "exact",
        network: TRON_MAINNET_CAIP2,
        asset: USDT_ADDRESSES[TRON_MAINNET_CAIP2],
        amount: "1000000",
        payTo: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
        maxTimeoutSeconds: 3600,
        extra: {},
      };

      const result = await scheme.createPaymentPayload(2, requirements);

      expect(result.t402Version).toBe(2);
      expect(result.payload).toBeDefined();
      expect(result.payload.signedTransaction).toMatch(/^0x[a-f0-9]+$/);
      expect(result.payload.authorization.from).toBe(signer.address);
      expect(result.payload.authorization.to).toBe(requirements.payTo);
      expect(result.payload.authorization.contractAddress).toBe(requirements.asset);
      expect(result.payload.authorization.amount).toBe(requirements.amount);
    });

    it("should call signer with correct parameters", async () => {
      const signer = createMockSigner();
      const scheme = new ExactTronScheme(signer);

      const requirements = {
        scheme: "exact",
        network: TRON_MAINNET_CAIP2,
        asset: USDT_ADDRESSES[TRON_MAINNET_CAIP2],
        amount: "5000000",
        payTo: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
        maxTimeoutSeconds: 3600,
        extra: {},
      };

      await scheme.createPaymentPayload(2, requirements);

      expect(signer.getBlockInfo).toHaveBeenCalled();
      expect(signer.signTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          contractAddress: requirements.asset,
          to: requirements.payTo,
          amount: requirements.amount,
          feeLimit: DEFAULT_FEE_LIMIT,
        }),
      );
    });

    it("should use custom fee limit from config", async () => {
      const signer = createMockSigner();
      const customFeeLimit = 50_000_000;
      const scheme = new ExactTronScheme(signer, { feeLimit: customFeeLimit });

      const requirements = {
        scheme: "exact",
        network: TRON_MAINNET_CAIP2,
        asset: USDT_ADDRESSES[TRON_MAINNET_CAIP2],
        amount: "1000000",
        payTo: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
        maxTimeoutSeconds: 3600,
        extra: {},
      };

      await scheme.createPaymentPayload(2, requirements);

      expect(signer.signTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          feeLimit: customFeeLimit,
        }),
      );
    });

    it("should include block info in authorization", async () => {
      const signer = createMockSigner();
      const blockInfo = {
        refBlockBytes: "test1234",
        refBlockHash: "hash0000deadbeef",
        expiration: 1700000000000,
      };
      (signer.getBlockInfo as any).mockResolvedValue(blockInfo);

      const scheme = new ExactTronScheme(signer);

      const requirements = {
        scheme: "exact",
        network: TRON_MAINNET_CAIP2,
        asset: USDT_ADDRESSES[TRON_MAINNET_CAIP2],
        amount: "1000000",
        payTo: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
        maxTimeoutSeconds: 3600,
        extra: {},
      };

      const result = await scheme.createPaymentPayload(2, requirements);

      expect(result.payload.authorization.refBlockBytes).toBe(blockInfo.refBlockBytes);
      expect(result.payload.authorization.refBlockHash).toBe(blockInfo.refBlockHash);
      expect(result.payload.authorization.expiration).toBe(blockInfo.expiration);
    });

    it("should throw when asset is missing", async () => {
      const signer = createMockSigner();
      const scheme = new ExactTronScheme(signer);

      const requirements = {
        scheme: "exact",
        network: TRON_MAINNET_CAIP2,
        amount: "1000000",
        payTo: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
        maxTimeoutSeconds: 3600,
        extra: {},
      };

      await expect(scheme.createPaymentPayload(2, requirements as any)).rejects.toThrow(
        "Asset (TRC20 contract address) is required",
      );
    });

    it("should throw when payTo is missing", async () => {
      const signer = createMockSigner();
      const scheme = new ExactTronScheme(signer);

      const requirements = {
        scheme: "exact",
        network: TRON_MAINNET_CAIP2,
        asset: USDT_ADDRESSES[TRON_MAINNET_CAIP2],
        amount: "1000000",
        maxTimeoutSeconds: 3600,
        extra: {},
      };

      await expect(scheme.createPaymentPayload(2, requirements as any)).rejects.toThrow(
        "PayTo address is required",
      );
    });

    it("should throw when amount is missing", async () => {
      const signer = createMockSigner();
      const scheme = new ExactTronScheme(signer);

      const requirements = {
        scheme: "exact",
        network: TRON_MAINNET_CAIP2,
        asset: USDT_ADDRESSES[TRON_MAINNET_CAIP2],
        payTo: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
        maxTimeoutSeconds: 3600,
        extra: {},
      };

      await expect(scheme.createPaymentPayload(2, requirements as any)).rejects.toThrow(
        "Amount is required",
      );
    });

    it("should throw for invalid contract address", async () => {
      const signer = createMockSigner();
      const scheme = new ExactTronScheme(signer);

      const requirements = {
        scheme: "exact",
        network: TRON_MAINNET_CAIP2,
        asset: "InvalidAddress",
        amount: "1000000",
        payTo: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
        maxTimeoutSeconds: 3600,
        extra: {},
      };

      await expect(scheme.createPaymentPayload(2, requirements)).rejects.toThrow(
        "Invalid TRC20 contract address",
      );
    });

    it("should throw for invalid payTo address", async () => {
      const signer = createMockSigner();
      const scheme = new ExactTronScheme(signer);

      const requirements = {
        scheme: "exact",
        network: TRON_MAINNET_CAIP2,
        asset: USDT_ADDRESSES[TRON_MAINNET_CAIP2],
        amount: "1000000",
        payTo: "InvalidPayToAddress",
        maxTimeoutSeconds: 3600,
        extra: {},
      };

      await expect(scheme.createPaymentPayload(2, requirements)).rejects.toThrow(
        "Invalid payTo address",
      );
    });

    it("should throw for invalid signer address", async () => {
      const signer = createMockSigner("InvalidSignerAddress");
      const scheme = new ExactTronScheme(signer);

      const requirements = {
        scheme: "exact",
        network: TRON_MAINNET_CAIP2,
        asset: USDT_ADDRESSES[TRON_MAINNET_CAIP2],
        amount: "1000000",
        payTo: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
        maxTimeoutSeconds: 3600,
        extra: {},
      };

      await expect(scheme.createPaymentPayload(2, requirements)).rejects.toThrow(
        "Invalid signer address",
      );
    });

    it("should work with nile testnet", async () => {
      const signer = createMockSigner();
      const scheme = new ExactTronScheme(signer);

      const requirements = {
        scheme: "exact",
        network: TRON_NILE_CAIP2,
        asset: USDT_ADDRESSES[TRON_NILE_CAIP2],
        amount: "1000000",
        payTo: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
        maxTimeoutSeconds: 3600,
        extra: {},
      };

      const result = await scheme.createPaymentPayload(2, requirements);

      expect(result.t402Version).toBe(2);
      expect(result.payload.authorization.contractAddress).toBe(USDT_ADDRESSES[TRON_NILE_CAIP2]);
    });

    it("should include timestamp in authorization", async () => {
      const signer = createMockSigner();
      const scheme = new ExactTronScheme(signer);

      const before = Date.now();

      const requirements = {
        scheme: "exact",
        network: TRON_MAINNET_CAIP2,
        asset: USDT_ADDRESSES[TRON_MAINNET_CAIP2],
        amount: "1000000",
        payTo: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
        maxTimeoutSeconds: 3600,
        extra: {},
      };

      const result = await scheme.createPaymentPayload(2, requirements);
      const after = Date.now();

      expect(result.payload.authorization.timestamp).toBeGreaterThanOrEqual(before);
      expect(result.payload.authorization.timestamp).toBeLessThanOrEqual(after);
    });
  });
});
