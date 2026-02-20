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
import type { EnrichedReceipt } from '@t402/wdk'

import { extractPaymentRequired } from './http-client.js'
import { detectChainFamily, detectChainFamilyFromName } from './signer-factory.js'
import type { T402ProtocolConfig, T402FetchResult, PaymentReceipt } from './types.js'

const DEFAULT_FACILITATOR = 'https://facilitator.t402.io'

/**
 * T402Protocol enables any WDK wallet app to handle HTTP 402 payments.
 *
 * Uses the real t402 protocol client infrastructure with EVM mechanism support.
 * Payment payloads are properly signed using EIP-3009 authorization.
 * Supports multi-chain registration for EVM and non-EVM chain families.
 */
export class T402Protocol {
  private httpClient: t402HTTPClient
  private wdk: T402WDK
  private facilitator: string
  private chains: string[]
  private _registeredFamilies: Set<string> = new Set()

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
   * Registers the primary EVM signer plus detects additional chain families
   * from the configured chains list.
   *
   * @param wdk - An initialized T402WDK instance
   * @param config - Protocol configuration
   * @returns A configured T402Protocol instance
   */
  static async create(wdk: T402WDK, config: T402ProtocolConfig = {}): Promise<T402Protocol> {
    const client = new t402Client()
    const registeredFamilies = new Set<string>()

    // Register EVM (primary chain)
    const chainName = config.chains?.[0] ?? 'ethereum'
    try {
      const signer = await wdk.getSigner(chainName)
      registerExactEvmScheme(client, { signer })
      registeredFamilies.add('evm')
    } catch {
      // EVM not available — non-EVM-only config
    }

    // Detect additional chain families from configured chains
    if (config.chains) {
      for (const chain of config.chains) {
        const family = detectChainFamilyFromName(chain)
        if (family) {
          registeredFamilies.add(family)
        }
      }
    }

    const httpClient = new t402HTTPClient(client)
    const protocol = new T402Protocol(wdk, httpClient, config)
    protocol._registeredFamilies = registeredFamilies

    return protocol
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
    const urlStr = url.toString()

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

    const network = paymentRequired.accepts?.[0]?.network ?? ''
    const amount = paymentRequired.accepts?.[0]?.amount ?? ''

    // Emit payment:start
    this._emitOnWdk('payment:start', { url: urlStr, network, amount })

    // Create signed payment payload using mechanism-specific logic
    let paymentPayload: PaymentPayload
    try {
      paymentPayload = await this.httpClient.createPaymentPayload(paymentRequired)
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      this._emitOnWdk('payment:failed', { url: urlStr, error: errMsg })
      throw error
    }

    this._emitOnWdk('payment:signed', {
      url: urlStr,
      scheme: paymentPayload.accepted.scheme,
      network: paymentPayload.accepted.network,
    })

    // Build retry headers
    const paymentHeaders = this.httpClient.encodePaymentSignatureHeader(paymentPayload)
    const headers = new Headers(init?.headers)
    for (const [key, value] of Object.entries(paymentHeaders)) {
      headers.set(key, value)
    }

    // Retry with payment
    const retryResponse = await fetch(url, { ...init, headers })

    this._emitOnWdk('payment:submitted', { url: urlStr, statusCode: retryResponse.status })

    const success = retryResponse.status !== 402
    const receipt: PaymentReceipt = {
      success,
      network: paymentPayload.accepted.network,
      scheme: paymentPayload.accepted.scheme,
      amount: paymentPayload.accepted.amount,
      payTo: paymentPayload.accepted.payTo,
    }

    // Determine chain family for the enriched receipt
    let chainFamily = 'evm'
    try {
      chainFamily = detectChainFamily(paymentPayload.accepted.network)
    } catch {
      // default to 'evm' if detection fails
    }

    // Save enriched receipt to the WDK receipt store
    const enrichedReceipt: EnrichedReceipt = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      url: urlStr,
      network: paymentPayload.accepted.network,
      scheme: paymentPayload.accepted.scheme,
      amount: paymentPayload.accepted.amount,
      payTo: paymentPayload.accepted.payTo,
      success,
      chainFamily,
    }

    try {
      await this.wdk.getReceiptStore().save(enrichedReceipt)
    } catch {
      // Receipt save failure is non-fatal
    }

    if (success) {
      this._emitOnWdk('payment:complete', { url: urlStr, success: true, receipt })
    } else {
      this._emitOnWdk('payment:failed', { url: urlStr, error: 'Payment rejected (still 402)' })
    }

    return { response: retryResponse, receipt }
  }

  /**
   * Emit an event on the underlying WDK event system.
   * Silently no-ops if the WDK doesn't support events.
   */
  private _emitOnWdk(event: string, data: unknown): void {
    try {
      const wdk = this.wdk as unknown as {
        emit?(event: string, data: unknown): boolean
      }
      wdk.emit?.(event, data)
    } catch {
      // Non-fatal: WDK may not have events support
    }
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

  /**
   * Get the set of registered chain families (e.g., 'evm', 'ton', 'solana')
   */
  getRegisteredFamilies(): Set<string> {
    return new Set(this._registeredFamilies)
  }

  /**
   * Check if this protocol instance can handle a given CAIP-2 network.
   *
   * @param network - CAIP-2 network identifier (e.g., "eip155:42161", "ton:mainnet")
   * @returns True if the required chain family is registered
   */
  canHandleNetwork(network: string): boolean {
    try {
      const family = detectChainFamily(network)
      return this._registeredFamilies.has(family)
    } catch {
      return false
    }
  }
}
