import { describe, it, expect, vi, beforeEach } from "vitest";
import { WDKSigner, createWDKSigner, MockWDKSigner } from "../../src/signer";
import { SignerError, SigningError, BalanceError, TransactionError, WDKErrorCode } from "../../src/errors";
import type { WDKInstance, WDKAccount } from "../../src/types";

// Create mock account
function createMockAccount(address: string): WDKAccount {
  return {
    getAddress: vi.fn().mockResolvedValue(address),
    getBalance: vi.fn().mockResolvedValue(1000000000000000000n),
    getTokenBalance: vi.fn().mockResolvedValue(1000000n),
    signMessage: vi.fn().mockResolvedValue("0xsignature1234"),
    signTypedData: vi.fn().mockResolvedValue("0xtypedSignature5678"),
    sendTransaction: vi.fn().mockResolvedValue("0xtxhash9012"),
    estimateGas: vi.fn().mockResolvedValue(21000n),
  };
}

// Create mock WDK instance
function createMockWDK(account?: WDKAccount): WDKInstance {
  const mockAccount = account ?? createMockAccount("0x1234567890123456789012345678901234567890");
  return {
    registerWallet: vi.fn().mockReturnThis(),
    registerProtocol: vi.fn().mockReturnThis(),
    getAccount: vi.fn().mockResolvedValue(mockAccount),
    executeProtocol: vi.fn().mockResolvedValue({ txHash: "0xbridgehash" }),
  };
}

describe("WDKSigner", () => {
  describe("Constructor validation", () => {
    it("should throw if WDK instance is null", () => {
      expect(() => new WDKSigner(null as unknown as WDKInstance, "arbitrum")).toThrow(SignerError);
      expect(() => new WDKSigner(null as unknown as WDKInstance, "arbitrum")).toThrow("WDK instance is required");
    });

    it("should throw if WDK instance is undefined", () => {
      expect(() => new WDKSigner(undefined as unknown as WDKInstance, "arbitrum")).toThrow(SignerError);
    });

    it("should throw if chain is empty", () => {
      const wdk = createMockWDK();
      expect(() => new WDKSigner(wdk, "")).toThrow(SignerError);
      expect(() => new WDKSigner(wdk, "")).toThrow("Chain name is required");
    });

    it("should throw if chain is not a string", () => {
      const wdk = createMockWDK();
      expect(() => new WDKSigner(wdk, null as unknown as string)).toThrow(SignerError);
      expect(() => new WDKSigner(wdk, 123 as unknown as string)).toThrow(SignerError);
    });

    it("should throw if account index is negative", () => {
      const wdk = createMockWDK();
      expect(() => new WDKSigner(wdk, "arbitrum", -1)).toThrow(SignerError);
      expect(() => new WDKSigner(wdk, "arbitrum", -1)).toThrow("Account index must be a non-negative integer");
    });

    it("should throw if account index is not an integer", () => {
      const wdk = createMockWDK();
      expect(() => new WDKSigner(wdk, "arbitrum", 1.5)).toThrow(SignerError);
    });

    it("should create signer with valid parameters", () => {
      const wdk = createMockWDK();
      const signer = new WDKSigner(wdk, "arbitrum", 0);
      expect(signer).toBeDefined();
      expect(signer.isInitialized).toBe(false);
    });

    it("should accept custom timeout", () => {
      const wdk = createMockWDK();
      const signer = new WDKSigner(wdk, "arbitrum", 0, 60000);
      expect(signer).toBeDefined();
    });
  });

  describe("address getter", () => {
    it("should throw if not initialized", () => {
      const wdk = createMockWDK();
      const signer = new WDKSigner(wdk, "arbitrum");
      expect(() => signer.address).toThrow(SignerError);
      expect(() => signer.address).toThrow("Signer not initialized");
    });

    it("should return address after initialization", async () => {
      const wdk = createMockWDK();
      const signer = new WDKSigner(wdk, "arbitrum");
      await signer.initialize();
      expect(signer.address).toBe("0x1234567890123456789012345678901234567890");
    });
  });

  describe("isInitialized", () => {
    it("should return false before initialization", () => {
      const wdk = createMockWDK();
      const signer = new WDKSigner(wdk, "arbitrum");
      expect(signer.isInitialized).toBe(false);
    });

    it("should return true after initialization", async () => {
      const wdk = createMockWDK();
      const signer = new WDKSigner(wdk, "arbitrum");
      await signer.initialize();
      expect(signer.isInitialized).toBe(true);
    });
  });

  describe("initialize", () => {
    it("should initialize successfully", async () => {
      const wdk = createMockWDK();
      const signer = new WDKSigner(wdk, "arbitrum");
      await signer.initialize();
      expect(signer.isInitialized).toBe(true);
      expect(wdk.getAccount).toHaveBeenCalledWith("arbitrum", 0);
    });

    it("should not re-initialize if already initialized", async () => {
      const wdk = createMockWDK();
      const signer = new WDKSigner(wdk, "arbitrum");
      await signer.initialize();
      await signer.initialize();
      expect(wdk.getAccount).toHaveBeenCalledTimes(1);
    });

    it("should throw on invalid address format", async () => {
      const account = createMockAccount("invalid-address");
      const wdk = createMockWDK(account);
      const signer = new WDKSigner(wdk, "arbitrum");
      await expect(signer.initialize()).rejects.toThrow(SignerError);
      await expect(signer.initialize()).rejects.toThrow("Invalid address format");
    });

    it("should throw on getAccount failure", async () => {
      const wdk = createMockWDK();
      (wdk.getAccount as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Account fetch failed"));
      const signer = new WDKSigner(wdk, "arbitrum");
      await expect(signer.initialize()).rejects.toThrow(SignerError);
      expect(signer.isInitialized).toBe(false);
    });
  });

  describe("signTypedData", () => {
    let signer: WDKSigner;
    let mockAccount: WDKAccount;

    beforeEach(async () => {
      mockAccount = createMockAccount("0x1234567890123456789012345678901234567890");
      const wdk = createMockWDK(mockAccount);
      signer = new WDKSigner(wdk, "arbitrum");
      await signer.initialize();
    });

    it("should sign typed data successfully", async () => {
      const message = {
        domain: { name: "Test", version: "1", chainId: 42161 },
        types: { Test: [{ name: "value", type: "string" }] },
        primaryType: "Test",
        message: { value: "hello" },
      };
      const signature = await signer.signTypedData(message);
      expect(signature).toBe("0xtypedSignature5678");
      expect(mockAccount.signTypedData).toHaveBeenCalledWith(message);
    });

    it("should throw if message is null", async () => {
      await expect(signer.signTypedData(null as unknown as Parameters<typeof signer.signTypedData>[0])).rejects.toThrow(SigningError);
      await expect(signer.signTypedData(null as unknown as Parameters<typeof signer.signTypedData>[0])).rejects.toThrow("Invalid typed data");
    });

    it("should throw if domain is missing", async () => {
      const message = {
        domain: undefined as unknown as Record<string, unknown>,
        types: { Test: [{ name: "value", type: "string" }] },
        primaryType: "Test",
        message: { value: "hello" },
      };
      await expect(signer.signTypedData(message)).rejects.toThrow(SigningError);
    });

    it("should throw if types is missing", async () => {
      const message = {
        domain: { name: "Test" },
        types: undefined as unknown as Record<string, unknown>,
        primaryType: "Test",
        message: { value: "hello" },
      };
      await expect(signer.signTypedData(message)).rejects.toThrow(SigningError);
    });

    it("should throw if primaryType is missing", async () => {
      const message = {
        domain: { name: "Test" },
        types: { Test: [{ name: "value", type: "string" }] },
        primaryType: undefined as unknown as string,
        message: { value: "hello" },
      };
      await expect(signer.signTypedData(message)).rejects.toThrow(SigningError);
    });

    it("should throw if message field is missing", async () => {
      const data = {
        domain: { name: "Test" },
        types: { Test: [{ name: "value", type: "string" }] },
        primaryType: "Test",
        message: undefined as unknown as Record<string, unknown>,
      };
      await expect(signer.signTypedData(data)).rejects.toThrow(SigningError);
    });

    it("should throw on invalid signature format", async () => {
      (mockAccount.signTypedData as ReturnType<typeof vi.fn>).mockResolvedValue("invalid");
      const message = {
        domain: { name: "Test" },
        types: { Test: [] },
        primaryType: "Test",
        message: {},
      };
      await expect(signer.signTypedData(message)).rejects.toThrow(SigningError);
      await expect(signer.signTypedData(message)).rejects.toThrow("Invalid signature format");
    });

    it("should wrap signing errors", async () => {
      (mockAccount.signTypedData as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("User rejected"));
      const message = {
        domain: { name: "Test" },
        types: { Test: [] },
        primaryType: "Test",
        message: {},
      };
      await expect(signer.signTypedData(message)).rejects.toThrow(SigningError);
    });
  });

  describe("signMessage", () => {
    let signer: WDKSigner;
    let mockAccount: WDKAccount;

    beforeEach(async () => {
      mockAccount = createMockAccount("0x1234567890123456789012345678901234567890");
      const wdk = createMockWDK(mockAccount);
      signer = new WDKSigner(wdk, "arbitrum");
      await signer.initialize();
    });

    it("should sign string message", async () => {
      const signature = await signer.signMessage("Hello, World!");
      expect(signature).toBe("0xsignature1234");
      expect(mockAccount.signMessage).toHaveBeenCalledWith("Hello, World!");
    });

    it("should sign Uint8Array message", async () => {
      const message = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      const signature = await signer.signMessage(message);
      expect(signature).toBe("0xsignature1234");
    });

    it("should throw if message is null", async () => {
      await expect(signer.signMessage(null as unknown as string)).rejects.toThrow(SigningError);
      await expect(signer.signMessage(null as unknown as string)).rejects.toThrow("Message is required");
    });

    it("should throw if message is undefined", async () => {
      await expect(signer.signMessage(undefined as unknown as string)).rejects.toThrow(SigningError);
    });

    it("should throw if message is invalid type", async () => {
      await expect(signer.signMessage(123 as unknown as string)).rejects.toThrow(SigningError);
      await expect(signer.signMessage(123 as unknown as string)).rejects.toThrow("must be a string or Uint8Array");
    });

    it("should throw on invalid signature format", async () => {
      (mockAccount.signMessage as ReturnType<typeof vi.fn>).mockResolvedValue("invalid");
      await expect(signer.signMessage("test")).rejects.toThrow(SigningError);
    });

    it("should wrap signing errors", async () => {
      (mockAccount.signMessage as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Failed"));
      await expect(signer.signMessage("test")).rejects.toThrow(SigningError);
    });
  });

  describe("getChain, getChainId, getAccountIndex", () => {
    it("should return chain name", () => {
      const wdk = createMockWDK();
      const signer = new WDKSigner(wdk, "arbitrum", 5);
      expect(signer.getChain()).toBe("arbitrum");
    });

    it("should return chain ID", () => {
      const wdk = createMockWDK();
      const signer = new WDKSigner(wdk, "arbitrum");
      expect(signer.getChainId()).toBe(42161);
    });

    it("should return account index", () => {
      const wdk = createMockWDK();
      const signer = new WDKSigner(wdk, "arbitrum", 5);
      expect(signer.getAccountIndex()).toBe(5);
    });
  });

  describe("getBalance", () => {
    let signer: WDKSigner;
    let mockAccount: WDKAccount;

    beforeEach(async () => {
      mockAccount = createMockAccount("0x1234567890123456789012345678901234567890");
      const wdk = createMockWDK(mockAccount);
      signer = new WDKSigner(wdk, "arbitrum");
      await signer.initialize();
    });

    it("should return native balance", async () => {
      const balance = await signer.getBalance();
      expect(balance).toBe(1000000000000000000n);
      expect(mockAccount.getBalance).toHaveBeenCalled();
    });

    it("should throw on balance fetch failure", async () => {
      (mockAccount.getBalance as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("RPC error"));
      await expect(signer.getBalance()).rejects.toThrow(BalanceError);
    });
  });

  describe("getTokenBalance", () => {
    let signer: WDKSigner;
    let mockAccount: WDKAccount;

    beforeEach(async () => {
      mockAccount = createMockAccount("0x1234567890123456789012345678901234567890");
      const wdk = createMockWDK(mockAccount);
      signer = new WDKSigner(wdk, "arbitrum");
      await signer.initialize();
    });

    it("should return token balance", async () => {
      const balance = await signer.getTokenBalance("0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9");
      expect(balance).toBe(1000000n);
      expect(mockAccount.getTokenBalance).toHaveBeenCalledWith("0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9");
    });

    it("should throw on invalid token address", async () => {
      await expect(signer.getTokenBalance("invalid")).rejects.toThrow(BalanceError);
      await expect(signer.getTokenBalance("invalid")).rejects.toThrow("Invalid token address");
    });

    it("should throw on empty token address", async () => {
      await expect(signer.getTokenBalance("" as `0x${string}`)).rejects.toThrow(BalanceError);
    });

    it("should throw on balance fetch failure", async () => {
      (mockAccount.getTokenBalance as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("RPC error"));
      await expect(signer.getTokenBalance("0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9")).rejects.toThrow(BalanceError);
    });
  });

  describe("estimateGas", () => {
    let signer: WDKSigner;
    let mockAccount: WDKAccount;

    beforeEach(async () => {
      mockAccount = createMockAccount("0x1234567890123456789012345678901234567890");
      const wdk = createMockWDK(mockAccount);
      signer = new WDKSigner(wdk, "arbitrum");
      await signer.initialize();
    });

    it("should estimate gas", async () => {
      const gas = await signer.estimateGas({
        to: "0x1234567890123456789012345678901234567890",
        value: 1000n,
      });
      expect(gas).toBe(21000n);
    });

    it("should throw on invalid to address", async () => {
      await expect(signer.estimateGas({ to: "invalid" as `0x${string}` })).rejects.toThrow(TransactionError);
      await expect(signer.estimateGas({ to: "invalid" as `0x${string}` })).rejects.toThrow("Invalid 'to' address");
    });

    it("should throw on empty to address", async () => {
      await expect(signer.estimateGas({ to: "" as `0x${string}` })).rejects.toThrow(TransactionError);
    });

    it("should throw on estimation failure", async () => {
      (mockAccount.estimateGas as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Estimation failed"));
      await expect(signer.estimateGas({ to: "0x1234567890123456789012345678901234567890" })).rejects.toThrow(TransactionError);
    });
  });

  describe("sendTransaction", () => {
    let signer: WDKSigner;
    let mockAccount: WDKAccount;

    beforeEach(async () => {
      mockAccount = createMockAccount("0x1234567890123456789012345678901234567890");
      const wdk = createMockWDK(mockAccount);
      signer = new WDKSigner(wdk, "arbitrum");
      await signer.initialize();
    });

    it("should send transaction", async () => {
      const result = await signer.sendTransaction({
        to: "0x1234567890123456789012345678901234567890",
        value: 1000n,
      });
      expect(result.hash).toBe("0xtxhash9012");
    });

    it("should throw on invalid to address", async () => {
      await expect(signer.sendTransaction({ to: "invalid" as `0x${string}` })).rejects.toThrow(TransactionError);
    });

    it("should throw on empty to address", async () => {
      await expect(signer.sendTransaction({ to: "" as `0x${string}` })).rejects.toThrow(TransactionError);
    });

    it("should throw on invalid hash format", async () => {
      (mockAccount.sendTransaction as ReturnType<typeof vi.fn>).mockResolvedValue("invalid");
      await expect(signer.sendTransaction({ to: "0x1234567890123456789012345678901234567890" })).rejects.toThrow(TransactionError);
      await expect(signer.sendTransaction({ to: "0x1234567890123456789012345678901234567890" })).rejects.toThrow("Invalid transaction hash");
    });

    it("should throw on transaction failure", async () => {
      (mockAccount.sendTransaction as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Tx failed"));
      await expect(signer.sendTransaction({ to: "0x1234567890123456789012345678901234567890" })).rejects.toThrow(TransactionError);
    });

    it("should wrap reverted transaction error", async () => {
      (mockAccount.sendTransaction as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Transaction reverted"));
      await expect(signer.sendTransaction({ to: "0x1234567890123456789012345678901234567890" })).rejects.toThrow(TransactionError);
    });
  });
});

describe("createWDKSigner", () => {
  it("should create and initialize signer", async () => {
    const wdk = createMockWDK();
    const signer = await createWDKSigner(wdk, "arbitrum");
    expect(signer.isInitialized).toBe(true);
    expect(signer.address).toBe("0x1234567890123456789012345678901234567890");
  });

  it("should use custom account index", async () => {
    const wdk = createMockWDK();
    const signer = await createWDKSigner(wdk, "arbitrum", 5);
    expect(signer.getAccountIndex()).toBe(5);
    expect(wdk.getAccount).toHaveBeenCalledWith("arbitrum", 5);
  });

  it("should use custom timeout", async () => {
    const wdk = createMockWDK();
    const signer = await createWDKSigner(wdk, "base", 0, 60000);
    expect(signer.isInitialized).toBe(true);
  });

  it("should throw on initialization failure", async () => {
    const wdk = createMockWDK();
    (wdk.getAccount as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Failed"));
    await expect(createWDKSigner(wdk, "arbitrum")).rejects.toThrow(SignerError);
  });
});

describe("MockWDKSigner", () => {
  it("should create mock signer with address", () => {
    const signer = new MockWDKSigner(
      "0x1234567890123456789012345678901234567890",
      "0xprivatekey1234567890123456789012345678901234567890123456789012345678"
    );
    expect(signer.address).toBe("0x1234567890123456789012345678901234567890");
  });

  it("should return mock signature for signTypedData", async () => {
    const signer = new MockWDKSigner(
      "0x1234567890123456789012345678901234567890",
      "0xprivatekey1234567890123456789012345678901234567890123456789012345678"
    );
    const signature = await signer.signTypedData({
      domain: {},
      types: {},
      primaryType: "Test",
      message: {},
    });
    expect(signature).toMatch(/^0x/);
    expect(signature.length).toBeGreaterThan(2);
  });

  it("should return mock signature for signMessage", async () => {
    const signer = new MockWDKSigner(
      "0x1234567890123456789012345678901234567890",
      "0xprivatekey1234567890123456789012345678901234567890123456789012345678"
    );
    const signature = await signer.signMessage("Hello");
    expect(signature).toMatch(/^0x/);
  });
});
