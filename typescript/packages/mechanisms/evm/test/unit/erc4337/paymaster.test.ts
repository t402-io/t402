import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  PaymasterClient,
  createPaymasterClient,
  encodePaymasterAndData,
  decodePaymasterAndData,
} from "../../../src/erc4337/paymaster";
import type { PaymasterConfig, PaymasterData } from "../../../src/erc4337/types";
import { DEFAULT_GAS_LIMITS } from "../../../src/erc4337/constants";

describe("PaymasterClient", () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("constructor", () => {
    it("should create paymaster client with config", () => {
      const config: PaymasterConfig = {
        address: "0x1234567890123456789012345678901234567890",
        type: "verifying",
      };
      const client = new PaymasterClient(config);
      expect(client).toBeDefined();
    });
  });

  describe("createPaymasterClient", () => {
    it("should create a paymaster client instance", () => {
      const config: PaymasterConfig = {
        address: "0x1234567890123456789012345678901234567890",
        type: "sponsoring",
        url: "https://paymaster.example.com",
      };
      const client = createPaymasterClient(config);
      expect(client).toBeInstanceOf(PaymasterClient);
    });
  });

  describe("getPaymasterData", () => {
    it("should return local verifying paymaster data without URL", async () => {
      const config: PaymasterConfig = {
        address: "0x1234567890123456789012345678901234567890",
        type: "verifying",
      };
      const client = new PaymasterClient(config);

      const data = await client.getPaymasterData(
        { sender: "0x2222222222222222222222222222222222222222" },
        42161,
        "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
      );

      expect(data.paymaster).toBe("0x1234567890123456789012345678901234567890");
      expect(data.paymasterVerificationGasLimit).toBe(
        DEFAULT_GAS_LIMITS.paymasterVerificationGasLimit,
      );
    });

    it("should call service for verifying paymaster with URL", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            paymaster: "0x1234567890123456789012345678901234567890",
            paymasterData: "0xpaymasterdata",
            paymasterVerificationGasLimit: "50000",
            paymasterPostOpGasLimit: "30000",
          }),
      });

      const config: PaymasterConfig = {
        address: "0x1234567890123456789012345678901234567890",
        type: "verifying",
        url: "https://paymaster.example.com",
      };
      const client = new PaymasterClient(config);

      const data = await client.getPaymasterData(
        { sender: "0x2222222222222222222222222222222222222222" },
        42161,
        "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://paymaster.example.com/getPaymasterData",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    it("should throw for sponsoring paymaster without URL", async () => {
      const config: PaymasterConfig = {
        address: "0x1234567890123456789012345678901234567890",
        type: "sponsoring",
      };
      const client = new PaymasterClient(config);

      await expect(
        client.getPaymasterData(
          { sender: "0x2222222222222222222222222222222222222222" },
          42161,
          "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
        ),
      ).rejects.toThrow("Sponsoring paymaster requires a service URL");
    });

    it("should call sponsor API for sponsoring paymaster", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            paymaster: "0x1234567890123456789012345678901234567890",
            paymasterData: "0xsponsored",
            paymasterVerificationGasLimit: 50000n,
            paymasterPostOpGasLimit: 30000n,
          }),
      });

      const config: PaymasterConfig = {
        address: "0x1234567890123456789012345678901234567890",
        type: "sponsoring",
        url: "https://paymaster.example.com",
      };
      const client = new PaymasterClient(config);

      await client.getPaymasterData(
        { sender: "0x2222222222222222222222222222222222222222" },
        42161,
        "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://paymaster.example.com/sponsor",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    it("should throw for token paymaster without tokenAddress", async () => {
      const config: PaymasterConfig = {
        address: "0x1234567890123456789012345678901234567890",
        type: "token",
      };
      const client = new PaymasterClient(config);

      await expect(
        client.getPaymasterData(
          { sender: "0x2222222222222222222222222222222222222222" },
          42161,
          "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
        ),
      ).rejects.toThrow("Token paymaster requires tokenAddress in options");
    });

    it("should return token paymaster data with tokenAddress", async () => {
      const config: PaymasterConfig = {
        address: "0x1234567890123456789012345678901234567890",
        type: "token",
        options: {
          tokenAddress: "0x3333333333333333333333333333333333333333",
        },
      };
      const client = new PaymasterClient(config);

      const data = await client.getPaymasterData(
        { sender: "0x2222222222222222222222222222222222222222" },
        42161,
        "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
      );

      expect(data.paymaster).toBe("0x1234567890123456789012345678901234567890");
      expect(data.paymasterData).toBe(
        "0x3333333333333333333333333333333333333333",
      );
    });
  });

  describe("willSponsor", () => {
    it("should return true for local paymaster", async () => {
      const config: PaymasterConfig = {
        address: "0x1234567890123456789012345678901234567890",
        type: "verifying",
      };
      const client = new PaymasterClient(config);

      const willSponsor = await client.willSponsor(
        { sender: "0x2222222222222222222222222222222222222222" },
        42161,
        "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
      );

      expect(willSponsor).toBe(true);
    });

    it("should call check endpoint for service paymaster", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ willSponsor: true }),
      });

      const config: PaymasterConfig = {
        address: "0x1234567890123456789012345678901234567890",
        type: "sponsoring",
        url: "https://paymaster.example.com",
      };
      const client = new PaymasterClient(config);

      const willSponsor = await client.willSponsor(
        { sender: "0x2222222222222222222222222222222222222222" },
        42161,
        "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
      );

      expect(willSponsor).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://paymaster.example.com/check",
        expect.any(Object),
      );
    });

    it("should return false if check fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const config: PaymasterConfig = {
        address: "0x1234567890123456789012345678901234567890",
        type: "sponsoring",
        url: "https://paymaster.example.com",
      };
      const client = new PaymasterClient(config);

      const willSponsor = await client.willSponsor(
        { sender: "0x2222222222222222222222222222222222222222" },
        42161,
        "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
      );

      expect(willSponsor).toBe(false);
    });
  });
});

describe("encodePaymasterAndData", () => {
  it("should encode paymaster data correctly", () => {
    const data: PaymasterData = {
      paymaster: "0x1234567890123456789012345678901234567890",
      paymasterVerificationGasLimit: 50000n,
      paymasterPostOpGasLimit: 30000n,
      paymasterData: "0xabcd",
    };

    const encoded = encodePaymasterAndData(data);

    // Should start with paymaster address
    expect(encoded.slice(0, 42)).toBe("0x1234567890123456789012345678901234567890");
    // Should be longer than just the address (has gas limits and data)
    expect(encoded.length).toBeGreaterThan(42);
  });
});

describe("decodePaymasterAndData", () => {
  it("should return null for empty data", () => {
    const decoded = decodePaymasterAndData("0x");
    expect(decoded).toBeNull();
  });

  it("should return null for data too short", () => {
    const decoded = decodePaymasterAndData("0x1234");
    expect(decoded).toBeNull();
  });

  it("should decode encoded paymaster data", () => {
    const original: PaymasterData = {
      paymaster: "0x1234567890123456789012345678901234567890",
      paymasterVerificationGasLimit: 50000n,
      paymasterPostOpGasLimit: 30000n,
      paymasterData: "0xabcd",
    };

    const encoded = encodePaymasterAndData(original);
    const decoded = decodePaymasterAndData(encoded);

    expect(decoded).not.toBeNull();
    expect(decoded!.paymaster.toLowerCase()).toBe(original.paymaster.toLowerCase());
    expect(decoded!.paymasterVerificationGasLimit).toBe(
      original.paymasterVerificationGasLimit,
    );
    expect(decoded!.paymasterPostOpGasLimit).toBe(original.paymasterPostOpGasLimit);
  });
});
