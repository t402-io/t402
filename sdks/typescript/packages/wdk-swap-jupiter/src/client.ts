/**
 * Jupiter DEX aggregator client.
 *
 * Provides quoting and swap execution via the Jupiter V6 API.
 *
 * @example
 * ```ts
 * const jupiter = new JupiterClient();
 * const quote = await jupiter.getQuote({
 *   inputMint: TOKEN_MINTS.USDC,
 *   outputMint: TOKEN_MINTS.SOL,
 *   amount: "1000000", // 1 USDC
 * });
 * const result = await jupiter.swap(wallet, quote);
 * ```
 */

import type {
  JupiterConfig,
  QuoteRequest,
  QuoteResponse,
  RoutePlanStep,
  SwapResult,
  SolanaWallet,
} from "./types";

const DEFAULT_API_URL = "https://lite-api.jup.ag/v6";
const DEFAULT_SLIPPAGE_BPS = 50;

export class JupiterClient {
  private apiUrl: string;
  private apiKey?: string;
  private defaultSlippageBps: number;

  constructor(config?: JupiterConfig) {
    this.apiUrl = config?.apiUrl ?? DEFAULT_API_URL;
    this.apiKey = config?.apiKey;
    this.defaultSlippageBps = config?.defaultSlippageBps ?? DEFAULT_SLIPPAGE_BPS;
  }

  /**
   * Get a swap quote from Jupiter.
   */
  async getQuote(request: QuoteRequest): Promise<QuoteResponse> {
    const params = new URLSearchParams({
      inputMint: request.inputMint,
      outputMint: request.outputMint,
      amount: request.amount,
      swapMode: request.swapMode ?? "ExactIn",
      slippageBps: String(request.slippageBps ?? this.defaultSlippageBps),
    });

    const response = await this.fetch(`/quote?${params}`);

    if (!response.ok) {
      throw new Error(`Jupiter quote failed: ${response.status} ${await response.text()}`);
    }

    const data = await response.json() as Record<string, any>;

    const routePlan: RoutePlanStep[] = ((data.routePlan ?? []) as any[]).map((step: any) => ({
      ammKey: step.swapInfo?.ammKey ?? "",
      label: step.swapInfo?.label ?? "",
      inputMint: step.swapInfo?.inputMint ?? "",
      outputMint: step.swapInfo?.outputMint ?? "",
      percent: step.percent ?? 100,
    }));

    return {
      inputAmount: data.inAmount ?? request.amount,
      outputAmount: data.outAmount ?? "0",
      otherAmountThreshold: data.otherAmountThreshold ?? "0",
      swapMode: data.swapMode ?? "ExactIn",
      slippageBps: data.slippageBps ?? this.defaultSlippageBps,
      priceImpactPct: data.priceImpactPct ?? "0",
      routePlan,
      rawQuote: data,
    };
  }

  /**
   * Execute a swap using a previously obtained quote.
   */
  async swap(wallet: SolanaWallet, quote: QuoteResponse): Promise<SwapResult> {
    const response = await this.fetch("/swap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse: quote.rawQuote,
        userPublicKey: wallet.address,
        wrapAndUnwrapSol: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Jupiter swap failed: ${response.status} ${await response.text()}`);
    }

    const data = await response.json() as Record<string, any>;
    const txBytes = Buffer.from(data.swapTransaction as string, "base64");

    // Sign and send the transaction
    const signature = await wallet.signAndSendTransaction(txBytes);

    return {
      signature,
      inputAmount: quote.inputAmount,
      outputAmount: quote.outputAmount,
      fee: "5000", // Default Solana fee estimate
    };
  }

  private async fetch(path: string, init?: RequestInit): Promise<Response> {
    const headers: Record<string, string> = {
      ...(init?.headers as Record<string, string> ?? {}),
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }
    return globalThis.fetch(`${this.apiUrl}${path}`, { ...init, headers });
  }
}
