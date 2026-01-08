import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PublicClient } from "viem";
import { UserOpBuilder, createUserOpBuilder } from "../../../src/erc4337/builder";
import type { SmartAccountSigner, TransactionIntent } from "../../../src/erc4337/types";
import { DEFAULT_GAS_LIMITS } from "../../../src/erc4337/constants";

describe("UserOpBuilder", () => {
  let mockSigner: SmartAccountSigner;
  let mockClient: PublicClient;

  beforeEach(() => {
    mockSigner = {
      getAddress: vi.fn().mockResolvedValue("0x1234567890123456789012345678901234567890"),
      signUserOpHash: vi.fn().mockResolvedValue("0xsignature"),
      getInitCode: vi.fn().mockResolvedValue("0xfactory1234"),
      isDeployed: vi.fn().mockResolvedValue(true),
      encodeExecute: vi.fn().mockReturnValue("0xcalldata"),
      encodeExecuteBatch: vi.fn().mockReturnValue("0xbatchcalldata"),
    };

    mockClient = {
      readContract: vi.fn().mockResolvedValue(5n),
      getBlock: vi.fn().mockResolvedValue({ baseFeePerGas: 1000000000n }),
    } as unknown as PublicClient;
  });

  describe("constructor", () => {
    it("should create builder with default options", () => {
      const builder = new UserOpBuilder();
      expect(builder).toBeDefined();
    });

    it("should create builder with custom options", () => {
      const builder = new UserOpBuilder({
        entryPoint: "0xcustom",
        gasMultiplier: 1.5,
      });
      expect(builder).toBeDefined();
    });
  });

  describe("createUserOpBuilder", () => {
    it("should create a builder instance", () => {
      const builder = createUserOpBuilder();
      expect(builder).toBeInstanceOf(UserOpBuilder);
    });
  });

  describe("buildUserOp", () => {
    it("should build a UserOperation for deployed account", async () => {
      const builder = new UserOpBuilder();
      const intent: TransactionIntent = {
        to: "0x9999999999999999999999999999999999999999",
        value: 100n,
        data: "0x1234",
      };

      const userOp = await builder.buildUserOp(
        mockSigner,
        intent,
        mockClient,
      );

      expect(userOp.sender).toBe("0x1234567890123456789012345678901234567890");
      expect(userOp.nonce).toBe(5n);
      expect(userOp.initCode).toBe("0x"); // Deployed, no init code
      expect(userOp.callData).toBe("0xcalldata");
      expect(userOp.signature).toBe("0x"); // Not signed yet

      expect(mockSigner.encodeExecute).toHaveBeenCalledWith(
        "0x9999999999999999999999999999999999999999",
        100n,
        "0x1234",
      );
    });

    it("should include init code for undeployed account", async () => {
      mockSigner.isDeployed = vi.fn().mockResolvedValue(false);

      const builder = new UserOpBuilder();
      const intent: TransactionIntent = {
        to: "0x9999999999999999999999999999999999999999",
      };

      const userOp = await builder.buildUserOp(
        mockSigner,
        intent,
        mockClient,
      );

      expect(userOp.initCode).toBe("0xfactory1234");
    });

    it("should use provided gas estimate", async () => {
      const builder = new UserOpBuilder({ gasMultiplier: 1.0 });
      const intent: TransactionIntent = {
        to: "0x9999999999999999999999999999999999999999",
      };

      const gasEstimate = {
        verificationGasLimit: 200000n,
        callGasLimit: 150000n,
        preVerificationGas: 60000n,
      };

      const userOp = await builder.buildUserOp(
        mockSigner,
        intent,
        mockClient,
        gasEstimate,
      );

      expect(userOp.verificationGasLimit).toBe(200000n);
      expect(userOp.callGasLimit).toBe(150000n);
      expect(userOp.preVerificationGas).toBe(60000n);
    });

    it("should include paymaster data when provided", async () => {
      const builder = new UserOpBuilder();
      const intent: TransactionIntent = {
        to: "0x9999999999999999999999999999999999999999",
      };

      const paymasterData = {
        paymaster: "0xPaymaster1234567890123456789012345678" as `0x${string}`,
        paymasterVerificationGasLimit: 50000n,
        paymasterPostOpGasLimit: 30000n,
        paymasterData: "0xpaymasterdata" as `0x${string}`,
      };

      const userOp = await builder.buildUserOp(
        mockSigner,
        intent,
        mockClient,
        undefined,
        paymasterData,
      );

      expect(userOp.paymasterAndData).not.toBe("0x");
      expect(userOp.paymasterAndData.length).toBeGreaterThan(2);
    });
  });

  describe("buildBatchUserOp", () => {
    it("should build a batch UserOperation", async () => {
      const builder = new UserOpBuilder();
      const intents: TransactionIntent[] = [
        { to: "0x1111111111111111111111111111111111111111", value: 100n },
        { to: "0x2222222222222222222222222222222222222222", data: "0x1234" },
        { to: "0x3333333333333333333333333333333333333333" },
      ];

      const userOp = await builder.buildBatchUserOp(
        mockSigner,
        intents,
        mockClient,
      );

      expect(userOp.callData).toBe("0xbatchcalldata");
      expect(mockSigner.encodeExecuteBatch).toHaveBeenCalledWith(
        [
          "0x1111111111111111111111111111111111111111",
          "0x2222222222222222222222222222222222222222",
          "0x3333333333333333333333333333333333333333",
        ],
        [100n, 0n, 0n],
        ["0x", "0x1234", "0x"],
      );
    });
  });

  describe("packUserOp", () => {
    it("should pack UserOperation for on-chain submission", async () => {
      const builder = new UserOpBuilder();

      const userOp = {
        sender: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        nonce: 5n,
        initCode: "0x" as `0x${string}`,
        callData: "0xcalldata" as `0x${string}`,
        verificationGasLimit: 150000n,
        callGasLimit: 100000n,
        preVerificationGas: 50000n,
        maxPriorityFeePerGas: 1500000000n,
        maxFeePerGas: 30000000000n,
        paymasterAndData: "0x" as `0x${string}`,
        signature: "0xsig" as `0x${string}`,
      };

      const packed = builder.packUserOp(userOp);

      expect(packed.sender).toBe(userOp.sender);
      expect(packed.nonce).toBe(userOp.nonce);
      expect(packed.accountGasLimits).toHaveLength(66);
      expect(packed.gasFees).toHaveLength(66);
    });
  });
});
