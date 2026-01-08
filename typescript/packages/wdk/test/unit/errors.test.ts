import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  WDKError,
  WDKInitializationError,
  ChainError,
  SignerError,
  SigningError,
  BalanceError,
  TransactionError,
  BridgeError,
  RPCError,
  WDKErrorCode,
  wrapError,
  isWDKError,
  hasErrorCode,
  withRetry,
  withTimeout,
} from "../../src/errors";

describe("Error Classes", () => {
  describe("WDKError", () => {
    it("should create error with code and message", () => {
      const error = new WDKError(WDKErrorCode.UNKNOWN_ERROR, "Test error");
      expect(error.code).toBe(WDKErrorCode.UNKNOWN_ERROR);
      expect(error.message).toBe("Test error");
      expect(error.name).toBe("WDKError");
    });

    it("should include cause if provided", () => {
      const cause = new Error("Original error");
      const error = new WDKError(WDKErrorCode.UNKNOWN_ERROR, "Test error", { cause });
      expect(error.cause).toBe(cause);
    });

    it("should include context if provided", () => {
      const context = { chain: "arbitrum", amount: "1000" };
      const error = new WDKError(WDKErrorCode.UNKNOWN_ERROR, "Test error", { context });
      expect(error.context).toEqual(context);
    });

    it("should serialize to JSON", () => {
      const error = new WDKError(WDKErrorCode.UNKNOWN_ERROR, "Test error", {
        context: { foo: "bar" },
      });
      const json = error.toJSON();
      expect(json.code).toBe(WDKErrorCode.UNKNOWN_ERROR);
      expect(json.message).toBe("Test error");
      expect(json.context).toEqual({ foo: "bar" });
    });

    it("should identify retryable errors", () => {
      const retryableError = new WDKError(WDKErrorCode.RPC_TIMEOUT, "Timeout");
      const nonRetryableError = new WDKError(WDKErrorCode.INVALID_TYPED_DATA, "Invalid");

      expect(retryableError.isRetryable()).toBe(true);
      expect(nonRetryableError.isRetryable()).toBe(false);
    });
  });

  describe("WDKInitializationError", () => {
    it("should have correct name and code", () => {
      const error = new WDKInitializationError("Init failed");
      expect(error.name).toBe("WDKInitializationError");
      expect(error.code).toBe(WDKErrorCode.WDK_NOT_INITIALIZED);
    });
  });

  describe("ChainError", () => {
    it("should include chain in context", () => {
      const error = new ChainError(
        WDKErrorCode.CHAIN_NOT_CONFIGURED,
        "Chain not configured",
        { chain: "polygon" },
      );
      expect(error.chain).toBe("polygon");
      expect(error.context?.chain).toBe("polygon");
    });
  });

  describe("SignerError", () => {
    it("should include chain and address", () => {
      const error = new SignerError(
        WDKErrorCode.SIGNER_NOT_INITIALIZED,
        "Signer failed",
        { chain: "arbitrum", address: "0x1234" },
      );
      expect(error.chain).toBe("arbitrum");
      expect(error.address).toBe("0x1234");
    });
  });

  describe("SigningError", () => {
    it("should include operation type", () => {
      const error = new SigningError(
        WDKErrorCode.SIGN_TYPED_DATA_FAILED,
        "Signing failed",
        { operation: "signTypedData" },
      );
      expect(error.operation).toBe("signTypedData");
    });
  });

  describe("BalanceError", () => {
    it("should include chain and token", () => {
      const error = new BalanceError(
        WDKErrorCode.TOKEN_BALANCE_FETCH_FAILED,
        "Balance fetch failed",
        { chain: "ethereum", token: "0xUSDT" },
      );
      expect(error.chain).toBe("ethereum");
      expect(error.token).toBe("0xUSDT");
    });
  });

  describe("TransactionError", () => {
    it("should include chain and txHash", () => {
      const error = new TransactionError(
        WDKErrorCode.TRANSACTION_FAILED,
        "Transaction failed",
        { chain: "base", txHash: "0xabc123" },
      );
      expect(error.chain).toBe("base");
      expect(error.txHash).toBe("0xabc123");
    });
  });

  describe("BridgeError", () => {
    it("should include fromChain and toChain", () => {
      const error = new BridgeError(
        WDKErrorCode.BRIDGE_FAILED,
        "Bridge failed",
        { fromChain: "ethereum", toChain: "arbitrum" },
      );
      expect(error.fromChain).toBe("ethereum");
      expect(error.toChain).toBe("arbitrum");
    });
  });

  describe("RPCError", () => {
    it("should include endpoint and rpcCode", () => {
      const error = new RPCError(
        WDKErrorCode.RPC_ERROR,
        "RPC error",
        { endpoint: "https://rpc.example.com", rpcCode: -32000 },
      );
      expect(error.endpoint).toBe("https://rpc.example.com");
      expect(error.rpcCode).toBe(-32000);
    });
  });
});

describe("Error Utilities", () => {
  describe("wrapError", () => {
    it("should return WDKError as-is", () => {
      const original = new WDKError(WDKErrorCode.UNKNOWN_ERROR, "Test");
      const wrapped = wrapError(original);
      expect(wrapped).toBe(original);
    });

    it("should wrap standard Error", () => {
      const original = new Error("Standard error");
      const wrapped = wrapError(original, WDKErrorCode.UNKNOWN_ERROR, "Default message");
      expect(wrapped).toBeInstanceOf(WDKError);
      expect(wrapped.message).toBe("Standard error");
      expect(wrapped.cause).toBe(original);
    });

    it("should detect timeout errors", () => {
      const original = new Error("Request timed out");
      const wrapped = wrapError(original);
      expect(wrapped.code).toBe(WDKErrorCode.RPC_TIMEOUT);
    });

    it("should detect rate limit errors", () => {
      const original = new Error("Rate limit exceeded");
      const wrapped = wrapError(original);
      expect(wrapped.code).toBe(WDKErrorCode.RPC_RATE_LIMITED);
    });

    it("should detect connection errors", () => {
      const original = new Error("ECONNREFUSED");
      const wrapped = wrapError(original);
      expect(wrapped.code).toBe(WDKErrorCode.RPC_CONNECTION_FAILED);
    });

    it("should detect insufficient balance errors", () => {
      const original = new Error("Insufficient funds for gas");
      const wrapped = wrapError(original);
      expect(wrapped.code).toBe(WDKErrorCode.INSUFFICIENT_BALANCE);
    });

    it("should detect user rejection", () => {
      const original = new Error("User rejected the request");
      const wrapped = wrapError(original);
      expect(wrapped.code).toBe(WDKErrorCode.USER_REJECTED_SIGNATURE);
    });

    it("should detect reverted transactions", () => {
      const original = new Error("Transaction reverted without reason");
      const wrapped = wrapError(original);
      expect(wrapped.code).toBe(WDKErrorCode.TRANSACTION_REVERTED);
    });

    it("should handle non-Error values", () => {
      const wrapped = wrapError("string error", WDKErrorCode.UNKNOWN_ERROR, "Default");
      expect(wrapped).toBeInstanceOf(WDKError);
      expect(wrapped.message).toBe("string error");
    });
  });

  describe("isWDKError", () => {
    it("should return true for WDKError instances", () => {
      expect(isWDKError(new WDKError(WDKErrorCode.UNKNOWN_ERROR, "Test"))).toBe(true);
      expect(isWDKError(new ChainError(WDKErrorCode.CHAIN_NOT_CONFIGURED, "Test"))).toBe(true);
    });

    it("should return false for non-WDKError", () => {
      expect(isWDKError(new Error("Test"))).toBe(false);
      expect(isWDKError(null)).toBe(false);
      expect(isWDKError(undefined)).toBe(false);
      expect(isWDKError("string")).toBe(false);
    });
  });

  describe("hasErrorCode", () => {
    it("should return true when error has matching code", () => {
      const error = new WDKError(WDKErrorCode.CHAIN_NOT_CONFIGURED, "Test");
      expect(hasErrorCode(error, WDKErrorCode.CHAIN_NOT_CONFIGURED)).toBe(true);
    });

    it("should return false when code does not match", () => {
      const error = new WDKError(WDKErrorCode.CHAIN_NOT_CONFIGURED, "Test");
      expect(hasErrorCode(error, WDKErrorCode.UNKNOWN_ERROR)).toBe(false);
    });

    it("should return false for non-WDKError", () => {
      expect(hasErrorCode(new Error("Test"), WDKErrorCode.UNKNOWN_ERROR)).toBe(false);
    });
  });

  describe("withRetry", () => {
    it("should return result on first success", async () => {
      const fn = vi.fn().mockResolvedValue("success");
      const result = await withRetry(fn, { maxRetries: 3, baseDelay: 10 });
      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should retry on retryable errors", async () => {
      const error = new RPCError(WDKErrorCode.RPC_TIMEOUT, "Timeout");
      const fn = vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValue("success");

      const result = await withRetry(fn, { maxRetries: 3, baseDelay: 10, exponentialBackoff: false });
      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("should not retry on non-retryable errors", async () => {
      const error = new SigningError(
        WDKErrorCode.INVALID_TYPED_DATA,
        "Invalid data",
        { operation: "signTypedData" },
      );
      const fn = vi.fn().mockRejectedValue(error);

      await expect(withRetry(fn, { maxRetries: 3, baseDelay: 10 })).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should throw after max retries", async () => {
      const error = new RPCError(WDKErrorCode.RPC_TIMEOUT, "Timeout");
      const fn = vi.fn().mockRejectedValue(error);

      await expect(withRetry(fn, { maxRetries: 2, baseDelay: 10 })).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe("withTimeout", () => {
    it("should return result when within timeout", async () => {
      const promise = Promise.resolve("success");
      const result = await withTimeout(promise, 1000, "Test operation");
      expect(result).toBe("success");
    });

    it("should throw on timeout", async () => {
      const promise = new Promise((resolve) => setTimeout(() => resolve("success"), 100));
      await expect(withTimeout(promise, 10, "Test operation")).rejects.toThrow(
        "Test operation timed out after 10ms",
      );
    });

    it("should clear timeout on success", async () => {
      vi.useFakeTimers();
      const promise = Promise.resolve("success");
      const resultPromise = withTimeout(promise, 1000, "Test");
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      expect(result).toBe("success");
      vi.useRealTimers();
    });
  });
});
