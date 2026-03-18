import { describe, it, expect, vi, beforeEach } from "vitest";
import { JupiterClient } from "../src/client";
import { TOKEN_MINTS } from "../src/types";
import type { SolanaWallet, QuoteResponse } from "../src/types";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const mockWallet: SolanaWallet = {
  address: "7nYvPxP9FqVm9UYBiQoHsF4SEn53DyLtBBVMF8pZEXPV",
  signAndSendTransaction: vi.fn().mockResolvedValue("5xSignature123"),
};

const mockQuoteData = {
  inAmount: "1000000",
  outAmount: "5000000",
  otherAmountThreshold: "4950000",
  swapMode: "ExactIn",
  slippageBps: 50,
  priceImpactPct: "0.01",
  routePlan: [
    {
      swapInfo: { ammKey: "raydium-1", label: "Raydium", inputMint: TOKEN_MINTS.USDC, outputMint: TOKEN_MINTS.SOL },
      percent: 100,
    },
  ],
};

beforeEach(() => {
  mockFetch.mockReset();
});

describe("JupiterClient", () => {
  describe("getQuote", () => {
    it("should fetch a quote successfully", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockQuoteData,
      });

      const client = new JupiterClient();
      const quote = await client.getQuote({
        inputMint: TOKEN_MINTS.USDC,
        outputMint: TOKEN_MINTS.SOL,
        amount: "1000000",
      });

      expect(quote.inputAmount).toBe("1000000");
      expect(quote.outputAmount).toBe("5000000");
      expect(quote.swapMode).toBe("ExactIn");
      expect(quote.routePlan).toHaveLength(1);
      expect(quote.routePlan[0].label).toBe("Raydium");
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("/quote");
      expect(url).toContain(`inputMint=${TOKEN_MINTS.USDC}`);
    });

    it("should use custom slippage", async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => mockQuoteData });

      const client = new JupiterClient({ defaultSlippageBps: 100 });
      await client.getQuote({
        inputMint: TOKEN_MINTS.USDC,
        outputMint: TOKEN_MINTS.SOL,
        amount: "1000000",
      });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("slippageBps=100");
    });

    it("should override slippage per request", async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => mockQuoteData });

      const client = new JupiterClient();
      await client.getQuote({
        inputMint: TOKEN_MINTS.USDC,
        outputMint: TOKEN_MINTS.SOL,
        amount: "1000000",
        slippageBps: 200,
      });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("slippageBps=200");
    });

    it("should throw on API error", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => "Rate limited",
      });

      const client = new JupiterClient();
      await expect(
        client.getQuote({ inputMint: TOKEN_MINTS.USDC, outputMint: TOKEN_MINTS.SOL, amount: "1000000" }),
      ).rejects.toThrow("429");
    });

    it("should use custom API URL", async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => mockQuoteData });

      const client = new JupiterClient({ apiUrl: "https://custom-jup.example.com" });
      await client.getQuote({ inputMint: TOKEN_MINTS.USDC, outputMint: TOKEN_MINTS.SOL, amount: "1000000" });

      expect(mockFetch.mock.calls[0][0]).toContain("https://custom-jup.example.com");
    });

    it("should include API key header", async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => mockQuoteData });

      const client = new JupiterClient({ apiKey: "my-key" });
      await client.getQuote({ inputMint: TOKEN_MINTS.USDC, outputMint: TOKEN_MINTS.SOL, amount: "1000000" });

      const headers = (mockFetch.mock.calls[0][1] as any)?.headers;
      expect(headers?.Authorization).toBe("Bearer my-key");
    });

    it("should support ExactOut mode", async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ...mockQuoteData, swapMode: "ExactOut" }) });

      const client = new JupiterClient();
      const quote = await client.getQuote({
        inputMint: TOKEN_MINTS.USDC,
        outputMint: TOKEN_MINTS.SOL,
        amount: "5000000",
        swapMode: "ExactOut",
      });

      expect(quote.swapMode).toBe("ExactOut");
    });
  });

  describe("swap", () => {
    it("should execute swap successfully", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          swapTransaction: Buffer.from("mock-transaction").toString("base64"),
        }),
      });

      const client = new JupiterClient();
      const quote: QuoteResponse = {
        inputAmount: "1000000",
        outputAmount: "5000000",
        otherAmountThreshold: "4950000",
        swapMode: "ExactIn",
        slippageBps: 50,
        priceImpactPct: "0.01",
        routePlan: [],
        rawQuote: mockQuoteData,
      };

      const result = await client.swap(mockWallet, quote);
      expect(result.signature).toBe("5xSignature123");
      expect(result.inputAmount).toBe("1000000");
      expect(result.outputAmount).toBe("5000000");
      expect(mockWallet.signAndSendTransaction).toHaveBeenCalled();
    });

    it("should throw on swap API error", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => "Invalid quote",
      });

      const client = new JupiterClient();
      const quote = { rawQuote: {}, inputAmount: "0", outputAmount: "0" } as QuoteResponse;
      await expect(client.swap(mockWallet, quote)).rejects.toThrow("400");
    });
  });
});

describe("TOKEN_MINTS", () => {
  it("should have correct SOL mint", () => {
    expect(TOKEN_MINTS.SOL).toBe("So11111111111111111111111111111111111111112");
  });
  it("should have correct USDC mint", () => {
    expect(TOKEN_MINTS.USDC).toBe("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
  });
  it("should have correct USDT mint", () => {
    expect(TOKEN_MINTS.USDT).toBe("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB");
  });
});
