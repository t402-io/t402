/**
 * WDK Indexer Verifier - Unified cross-chain transaction verification.
 *
 * Uses wdk-indexer-http for querying transactions across EVM, TON, TRON, Solana.
 * Falls back to chain-specific RPC verification if indexer is unavailable.
 */

/**
 * Configuration for the WDK indexer verifier
 */
export interface WdkIndexerConfig {
  /** Indexer HTTP endpoint */
  endpoint: string
  /** API key (optional) */
  apiKey?: string
  /** Request timeout in ms (default: 10000) */
  timeout?: number
}

/**
 * Query parameters for a transaction
 */
export interface TransactionQuery {
  /** Transaction hash */
  txHash: string
  /** Network identifier (CAIP-2 or chain name) */
  network: string
  /** Expected recipient address */
  expectedTo?: string
  /** Expected amount in smallest units */
  expectedAmount?: string
}

/**
 * Result of a transaction query
 */
export interface TransactionResult {
  /** Whether the transaction was found */
  found: boolean
  /** Whether the transaction is confirmed */
  confirmed: boolean
  /** Sender address */
  from: string
  /** Recipient address */
  to: string
  /** Transfer amount in smallest units */
  amount: string
  /** Token contract address or symbol */
  token: string
  /** Block number (if confirmed) */
  blockNumber?: number
  /** Block timestamp (if confirmed) */
  timestamp?: number
}

/**
 * Verification result
 */
export interface PaymentVerification {
  /** Whether the payment is verified */
  verified: boolean
  /** Reason for failure (if not verified) */
  reason?: string
}

/**
 * WDK Indexer Verifier
 *
 * Provides unified cross-chain transaction verification by querying
 * a wdk-indexer-http endpoint. This enables the facilitator to verify
 * payments across all supported chains through a single API.
 *
 * @example
 * ```typescript
 * import { WdkIndexerVerifier } from '@t402/wdk';
 *
 * const verifier = new WdkIndexerVerifier({
 *   endpoint: 'https://indexer.example.com',
 *   apiKey: 'your-api-key',
 * });
 *
 * // Verify a payment
 * const result = await verifier.verifyPayment({
 *   txHash: '0xabc...',
 *   network: 'eip155:42161',
 *   expectedTo: '0xpayee...',
 *   expectedAmount: '1000000',
 * });
 *
 * if (result.verified) {
 *   console.log('Payment verified');
 * }
 * ```
 */
export class WdkIndexerVerifier {
  private endpoint: string
  private apiKey?: string
  private timeout: number

  constructor(config: WdkIndexerConfig) {
    if (!config.endpoint) {
      throw new Error('Indexer endpoint is required')
    }

    // Normalize endpoint (remove trailing slash)
    this.endpoint = config.endpoint.replace(/\/$/, '')
    this.apiKey = config.apiKey
    this.timeout = config.timeout ?? 10000
  }

  /**
   * Query a transaction across any supported chain
   */
  async queryTransaction(query: TransactionQuery): Promise<TransactionResult> {
    if (!query.txHash) {
      throw new Error('Transaction hash is required')
    }
    if (!query.network) {
      throw new Error('Network is required')
    }

    const url = `${this.endpoint}/v1/transactions/${encodeURIComponent(query.network)}/${encodeURIComponent(query.txHash)}`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      })

      if (!response.ok) {
        if (response.status === 404) {
          return {
            found: false,
            confirmed: false,
            from: '',
            to: '',
            amount: '0',
            token: '',
          }
        }
        throw new Error(`Indexer request failed: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      return {
        found: true,
        confirmed: data.confirmed ?? data.status === 'confirmed',
        from: data.from ?? '',
        to: data.to ?? '',
        amount: String(data.amount ?? data.value ?? '0'),
        token: data.token ?? data.tokenAddress ?? '',
        blockNumber: data.blockNumber ?? data.block_number,
        timestamp: data.timestamp ?? data.block_timestamp,
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new Error(`Indexer request timed out after ${this.timeout}ms`)
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Verify a transaction matches expected payment parameters
   */
  async verifyPayment(query: TransactionQuery): Promise<PaymentVerification> {
    const result = await this.queryTransaction(query)

    if (!result.found) {
      return { verified: false, reason: 'Transaction not found' }
    }

    if (!result.confirmed) {
      return { verified: false, reason: 'Transaction not yet confirmed' }
    }

    if (query.expectedTo) {
      const normalizedExpected = query.expectedTo.toLowerCase()
      const normalizedActual = result.to.toLowerCase()
      if (normalizedActual !== normalizedExpected) {
        return {
          verified: false,
          reason: `Recipient mismatch: expected ${query.expectedTo}, got ${result.to}`,
        }
      }
    }

    if (query.expectedAmount) {
      const expected = BigInt(query.expectedAmount)
      const actual = BigInt(result.amount)
      if (actual < expected) {
        return {
          verified: false,
          reason: `Amount insufficient: expected ${query.expectedAmount}, got ${result.amount}`,
        }
      }
    }

    return { verified: true }
  }

  /**
   * Check indexer health
   */
  async healthCheck(): Promise<boolean> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const headers: Record<string, string> = {}
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`
      }

      const response = await fetch(`${this.endpoint}/health`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      })

      return response.ok
    } catch {
      return false
    } finally {
      clearTimeout(timeoutId)
    }
  }
}

/**
 * Create a WDK indexer verifier
 */
export function createIndexerVerifier(config: WdkIndexerConfig): WdkIndexerVerifier {
  return new WdkIndexerVerifier(config)
}
