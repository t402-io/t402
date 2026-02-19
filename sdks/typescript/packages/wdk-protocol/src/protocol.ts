/**
 * T402Protocol - Main class for WDK apps to add T402 payment capability
 *
 * Uses the real t402 client infrastructure (t402Client + mechanism-specific
 * scheme clients) for proper payment payload creation and signing.
 *
 * @example
 * ```typescript
 * import { T402Protocol } from '@t402/wdk-protocol';
 * import { T402WDK } from '@t402/wdk';
 *
 * const wdk = new T402WDK(seedPhrase, { arbitrum: rpcUrl });
 * const t402 = await T402Protocol.create(wdk, {
 *   chains: ['ethereum', 'arbitrum'],
 * });
 *
 * // Auto-pay for HTTP 402 resources
 * const { response, receipt } = await t402.fetch('https://api.example.com/premium');
 * ```
 */

import { t402Client } from '@t402/core/client'
import { t402HTTPClient } from '@t402/core/http'
import type { PaymentRequired, PaymentPayload } from '@t402/core/types'
import { registerExactEvmScheme } from '@t402/evm/exact/client'
import type { T402WDK } from '@t402/wdk'

import { extractPaymentRequired } from './http-client.js'
import type { T402ProtocolConfig, T402FetchResult, PaymentReceipt } from './types.js'

const DEFAULT_FACILITATOR = 'https://facilitator.t402.io'

/**
 * T402Protocol enables any WDK wallet app to handle HTTP 402 payments.
 *
 * Uses the real t402 protocol client infrastructure with EVM mechanism support.
 * Payment payloads are properly signed using EIP-3009 authorization.
 */
export class T402Protocol {
  private httpClient: t402HTTPClient
  private wdk: T402WDK
  private facilitator: string
  private chains: string[]

  private constructor(wdk: T402WDK, httpClient: t402HTTPClient, config: T402ProtocolConfig) {
    this.wdk = wdk
    this.httpClient = httpClient
    this.facilitator = config.facilitator ?? DEFAULT_FACILITATOR
    this.chains = config.chains ?? []
  }

  /**
   * Create a new T402Protocol instance.
   *
   * This is async because it needs to initialize the WDK signer.
   *
   * @param wdk - An initialized T402WDK instance
   * @param config - Protocol configuration
   * @returns A configured T402Protocol instance
   */
  static async create(wdk: T402WDK, config: T402ProtocolConfig = {}): Promise<T402Protocol> {
    // Get an EVM signer from WDK for the first available chain
    const chainName = config.chains?.[0] ?? 'ethereum'
    const signer = await wdk.getSigner(chainName)

    // Create t402 client with EVM exact scheme
    const client = new t402Client()
    registerExactEvmScheme(client, { signer })

    const httpClient = new t402HTTPClient(client)

    return new T402Protocol(wdk, httpClient, config)
  }

  /**
   * Fetch a URL with automatic 402 payment handling.
   *
   * 1. Makes the initial request
   * 2. If 402, extracts payment requirements
   * 3. Creates a properly signed payment payload (EIP-3009 for EVM)
   * 4. Retries the request with the signed payment header
   *
   * @param url - URL to fetch
   * @param init - Standard fetch RequestInit options
   * @returns The final response and optional payment receipt
   */
  async fetch(url: string | URL, init?: RequestInit): Promise<T402FetchResult> {
    // Make initial request
    const response = await fetch(url, init)

    // If not 402, return as-is
    if (response.status !== 402) {
      return { response }
    }

    // Extract payment requirements from 402 response
    const paymentRequired = this.httpClient.getPaymentRequiredResponse((name: string) =>
      response.headers.get(name),
    )

    // Create signed payment payload using mechanism-specific logic
    const paymentPayload = await this.httpClient.createPaymentPayload(paymentRequired)

    // Build retry headers
    const paymentHeaders = this.httpClient.encodePaymentSignatureHeader(paymentPayload)
    const headers = new Headers(init?.headers)
    for (const [key, value] of Object.entries(paymentHeaders)) {
      headers.set(key, value)
    }

    // Retry with payment
    const retryResponse = await fetch(url, { ...init, headers })

    const receipt: PaymentReceipt = {
      success: retryResponse.status !== 402,
      network: paymentPayload.accepted.network,
      scheme: paymentPayload.accepted.scheme,
      amount: paymentPayload.accepted.amount,
      payTo: paymentPayload.accepted.payTo,
    }

    return { response: retryResponse, receipt }
  }

  /**
   * Extract payment requirements from a URL
   *
   * @param url - URL to check for payment requirements
   * @param init - Standard fetch RequestInit options
   * @returns The PaymentRequired object from the 402 response
   * @throws Error if the response is not 402
   */
  async getRequirements(url: string | URL, init?: RequestInit): Promise<PaymentRequired> {
    const response = await fetch(url, init)
    if (response.status !== 402) {
      throw new Error(`Expected 402 response, got ${response.status}`)
    }
    return extractPaymentRequired(response)
  }

  /**
   * Sign a payment for specific requirements using the t402 client infrastructure
   *
   * @param paymentRequired - The full PaymentRequired context
   * @returns A properly signed PaymentPayload (e.g., EIP-3009 for EVM)
   */
  async signPayment(paymentRequired: PaymentRequired): Promise<PaymentPayload> {
    return this.httpClient.createPaymentPayload(paymentRequired)
  }

  /**
   * Submit a request with a pre-signed payment payload
   *
   * @param url - URL to request
   * @param paymentPayload - The signed payment payload
   * @param init - Standard fetch RequestInit options
   * @returns The HTTP response
   */
  async submitPayment(
    url: string | URL,
    paymentPayload: PaymentPayload,
    init?: RequestInit,
  ): Promise<Response> {
    const paymentHeaders = this.httpClient.encodePaymentSignatureHeader(paymentPayload)
    const headers = new Headers(init?.headers)
    for (const [key, value] of Object.entries(paymentHeaders)) {
      headers.set(key, value)
    }

    return fetch(url, { ...init, headers })
  }

  /**
   * Get the underlying t402 HTTP client for advanced usage
   */
  getHttpClient(): t402HTTPClient {
    return this.httpClient
  }

  /**
   * Get the underlying WDK instance
   */
  getWdk(): T402WDK {
    return this.wdk
  }

  /**
   * Get the facilitator URL
   */
  getFacilitator(): string {
    return this.facilitator
  }

  /**
   * Get the configured chains
   */
  getChains(): string[] {
    return [...this.chains]
  }
}
