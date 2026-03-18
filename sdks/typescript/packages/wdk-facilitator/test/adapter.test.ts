import { describe, it, expect, vi } from "vitest";
import { WdkFacilitatorAdapter } from "../src/adapter";
import type { WdkWalletAccount } from "../src/types";

function createMockAccount(overrides?: Partial<WdkWalletAccount>): WdkWalletAccount {
  return {
    address: "0x1234567890abcdef1234567890abcdef12345678",
    signTypedData: vi.fn().mockResolvedValue("0xsignature"),
    readContract: vi.fn().mockResolvedValue("1000000"),
    writeContract: vi.fn().mockResolvedValue("0xtxhash"),
    waitForTransactionReceipt: vi.fn().mockResolvedValue({
      status: "success",
      blockNumber: 12345n,
      transactionHash: "0xtxhash",
    }),
    ...overrides,
  };
}

describe("WdkFacilitatorAdapter", () => {
  it("should throw if account is null", () => {
    expect(() => new WdkFacilitatorAdapter(null as any)).toThrow();
  });

  it("should return address from getAddresses", () => {
    const adapter = new WdkFacilitatorAdapter(createMockAccount());
    expect(adapter.getAddresses()).toEqual(["0x1234567890abcdef1234567890abcdef12345678"]);
  });

  it("should delegate readContract to WDK account", async () => {
    const account = createMockAccount();
    const adapter = new WdkFacilitatorAdapter(account);
    const result = await adapter.readContract("0xtoken", [], "balanceOf", "0xaddr");
    expect(account.readContract).toHaveBeenCalledWith({
      address: "0xtoken",
      abi: [],
      functionName: "balanceOf",
      args: ["0xaddr"],
    });
    expect(result).toBe("1000000");
  });

  it("should delegate writeContract to WDK account", async () => {
    const account = createMockAccount();
    const adapter = new WdkFacilitatorAdapter(account);
    const result = await adapter.writeContract("0xtoken", [], "transfer", "0xto", "1000");
    expect(account.writeContract).toHaveBeenCalled();
    expect(result).toBe("0xtxhash");
  });

  it("should convert receipt format in waitForTransactionReceipt", async () => {
    const adapter = new WdkFacilitatorAdapter(createMockAccount());
    const receipt = await adapter.waitForTransactionReceipt("0xtx");
    expect(receipt.status).toBe(1);
    expect(receipt.blockNumber).toBe(12345);
    expect(receipt.transactionHash).toBe("0xtxhash");
  });

  it("should handle reverted transaction receipt", async () => {
    const account = createMockAccount({
      waitForTransactionReceipt: vi.fn().mockResolvedValue({
        status: "reverted",
        blockNumber: 12345n,
        transactionHash: "0xtx",
      }),
    });
    const adapter = new WdkFacilitatorAdapter(account);
    const receipt = await adapter.waitForTransactionReceipt("0xtx");
    expect(receipt.status).toBe(0);
  });

  it("should use getTokenBalance when available", async () => {
    const account = createMockAccount({
      getTokenBalance: vi.fn().mockResolvedValue(5000000n),
    });
    const adapter = new WdkFacilitatorAdapter(account);
    const balance = await adapter.getBalance("0xaddr", "0xtoken");
    expect(balance).toBe(5000000n);
    expect(account.getTokenBalance).toHaveBeenCalledWith("0xtoken");
  });

  it("should fallback to readContract for balance", async () => {
    const adapter = new WdkFacilitatorAdapter(createMockAccount());
    const balance = await adapter.getBalance("0xaddr", "0xtoken");
    expect(balance).toBe(1000000n);
  });

  it("should use getCode when available", async () => {
    const account = createMockAccount({
      getCode: vi.fn().mockResolvedValue("0xabcd"),
    });
    const adapter = new WdkFacilitatorAdapter(account);
    const code = await adapter.getCode("0xaddr");
    expect(code).toEqual(new Uint8Array([0xab, 0xcd]));
  });

  it("should return empty bytes when getCode not available", async () => {
    const adapter = new WdkFacilitatorAdapter(createMockAccount());
    const code = await adapter.getCode("0xaddr");
    expect(code).toEqual(new Uint8Array(0));
  });

  it("should cache chainId", async () => {
    const account = createMockAccount({
      readContract: vi.fn()
        .mockResolvedValueOnce("8453")
        .mockResolvedValueOnce("should not be called"),
    });
    const adapter = new WdkFacilitatorAdapter(account);
    const id1 = await adapter.getChainID();
    const id2 = await adapter.getChainID();
    expect(id1).toBe(8453n);
    expect(id2).toBe(8453n);
    expect(account.readContract).toHaveBeenCalledTimes(1);
  });

  it("should default to chainId 1 on error", async () => {
    const account = createMockAccount({
      readContract: vi.fn().mockRejectedValue(new Error("fail")),
    });
    const adapter = new WdkFacilitatorAdapter(account);
    const id = await adapter.getChainID();
    expect(id).toBe(1n);
  });
});
