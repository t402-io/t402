/**
 * Ambient type declarations for optional @t402/wdk and @t402/wdk-protocol packages.
 * These packages are premium/private and may not be available in all environments.
 * The MCP server conditionally loads WDK tools at runtime via dynamic import.
 */

declare module '@t402/wdk' {
  export class T402WDK {
    constructor(seedPhrase: string, rpcUrls?: Record<string, string>)
    getSigner(chain: string): Promise<WDKSigner>
    getConfiguredChains(): string[]
    getAggregatedBalances(): Promise<AggregatedBalance>
    getSwapQuote(
      chain: string,
      fromToken: string,
      amount: bigint,
    ): Promise<{ expectedOutput: bigint; outputAmount: bigint; route: unknown }>
    swapAndPay(params: {
      chain: string
      fromToken: string
      amount: bigint
      recipient?: string
    }): Promise<{ hash: string; txHash: string; outputAmount: bigint }>
    findBestChainForPayment(amount: bigint): Promise<{ chain: string; balance: bigint } | null>
  }

  export interface WDKSigner {
    address: string
    sendTransaction(tx: { to: string; [key: string]: unknown }): Promise<{ hash: string }>
  }

  export interface ChainBalance {
    chain: string
    tokens: Array<{ symbol: string; formatted: string }>
    native: bigint
  }

  export interface AggregatedBalance {
    totalUsdt0: bigint
    totalUsdc: bigint
    chains: ChainBalance[]
  }
}

declare module '@t402/wdk-protocol' {
  import type { T402WDK } from '@t402/wdk'

  export interface ProtocolReceipt {
    amount: string
    network: string
    scheme: string
    payTo: string
    txHash?: string
    [key: string]: unknown
  }

  export interface ProtocolFetchResult {
    response: Response
    receipt?: ProtocolReceipt
  }

  export class T402Protocol {
    static create(wdk: T402WDK, options?: { chains?: string[] }): Promise<T402Protocol>
    fetch(url: string, init?: RequestInit): Promise<ProtocolFetchResult>
    signPayment(requirements: unknown): Promise<unknown>
    submitPayment(url: string, payload: unknown): Promise<Response>
  }
}
