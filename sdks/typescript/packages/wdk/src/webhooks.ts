/**
 * Webhook Notifications
 *
 * Sends payment event notifications to configured webhook endpoints
 * with HMAC-SHA256 signature verification and retry support.
 */

/**
 * Configuration for a webhook endpoint
 */
export interface WebhookConfig {
  /** The URL to send webhook payloads to */
  url: string
  /** Secret key for HMAC-SHA256 signing */
  secret: string
  /** Event types to subscribe to (default: all events) */
  events?: string[]
  /** Number of retry attempts on failure (default: 3) */
  retries?: number
}

/**
 * Webhook payload for payment events
 */
export interface PaymentWebhookPayload {
  event: 'payment.completed' | 'payment.failed'
  timestamp: string
  payment: {
    network: string
    txHash?: string
    amount: string
    asset: string
    payer: string
    resource: string
  }
  signature: string
}

/**
 * Result of a webhook delivery attempt
 */
export interface WebhookDeliveryResult {
  url: string
  success: boolean
  statusCode?: number
  error?: string
  attempts: number
}

/**
 * Manages webhook notifications for payment events
 *
 * @example
 * ```typescript
 * const webhooks = new WebhookManager([{
 *   url: 'https://example.com/webhooks',
 *   secret: 'whsec_...',
 *   events: ['payment.completed'],
 * }]);
 *
 * await webhooks.send('payment.completed', {
 *   network: 'eip155:42161',
 *   amount: '1000000',
 *   asset: 'USDT0',
 *   payer: '0x...',
 *   resource: '/api/premium',
 * });
 * ```
 */
export class WebhookManager {
  private _configs: WebhookConfig[]
  private _deliveryResults: WebhookDeliveryResult[] = []
  private _maxDeliveryHistory: number

  /**
   * @param configs - Array of webhook endpoint configurations
   * @param maxDeliveryHistory - Maximum number of delivery results to retain (default: 100)
   */
  constructor(configs: WebhookConfig[], maxDeliveryHistory = 100) {
    this._configs = configs
    this._maxDeliveryHistory = maxDeliveryHistory
  }

  /**
   * Send a webhook event to all subscribed endpoints
   *
   * @param event - Event type (e.g., 'payment.completed')
   * @param payload - Event payload data
   * @returns Array of delivery results for each endpoint
   */
  async send(event: string, payload: unknown): Promise<WebhookDeliveryResult[]> {
    const results: WebhookDeliveryResult[] = []

    for (const config of this._configs) {
      // Skip if this endpoint doesn't subscribe to this event
      if (config.events && config.events.length > 0 && !config.events.includes(event)) {
        continue
      }

      const result = await this._deliver(config, event, payload)
      results.push(result)
      this._recordResult(result)
    }

    return results
  }

  /**
   * Sign a payload with HMAC-SHA256
   *
   * @param payload - The payload to sign (will be JSON.stringify'd if not a string)
   * @param secret - The secret key
   * @returns Hex-encoded HMAC-SHA256 signature
   */
  signPayload(payload: unknown, secret: string): string {
    const crypto = require('crypto') as typeof import('crypto')
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload)
    return crypto.createHmac('sha256', secret).update(data).digest('hex')
  }

  /**
   * Verify an HMAC-SHA256 signature on a payload
   *
   * @param payload - The raw payload string
   * @param signature - The signature to verify
   * @param secret - The secret key
   * @returns True if the signature is valid
   */
  verifySignature(payload: string, signature: string, secret: string): boolean {
    const expected = this.signPayload(payload, secret)
    // Constant-time comparison
    if (expected.length !== signature.length) {
      return false
    }
    const crypto = require('crypto') as typeof import('crypto')
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))
  }

  /**
   * Get recent delivery results
   */
  getDeliveryResults(): WebhookDeliveryResult[] {
    return [...this._deliveryResults]
  }

  /**
   * Clear delivery history
   */
  clearDeliveryResults(): void {
    this._deliveryResults = []
  }

  /**
   * Get the number of configured webhook endpoints
   */
  get endpointCount(): number {
    return this._configs.length
  }

  private async _deliver(
    config: WebhookConfig,
    event: string,
    payload: unknown,
  ): Promise<WebhookDeliveryResult> {
    const maxRetries = config.retries ?? 3
    const body = JSON.stringify({ event, timestamp: new Date().toISOString(), data: payload })
    const signature = this.signPayload(body, config.secret)

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(config.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-Event': event,
          },
          body,
        })

        if (response.ok) {
          return {
            url: config.url,
            success: true,
            statusCode: response.status,
            attempts: attempt,
          }
        }

        // Non-retryable status codes
        if (response.status >= 400 && response.status < 500) {
          return {
            url: config.url,
            success: false,
            statusCode: response.status,
            error: `HTTP ${response.status}`,
            attempts: attempt,
          }
        }

        // Server error - retry
        if (attempt === maxRetries) {
          return {
            url: config.url,
            success: false,
            statusCode: response.status,
            error: `HTTP ${response.status} after ${maxRetries} attempts`,
            attempts: attempt,
          }
        }

        // Exponential backoff before retry
        await this._sleep(Math.min(1000 * Math.pow(2, attempt - 1), 10000))
      } catch (error) {
        if (attempt === maxRetries) {
          return {
            url: config.url,
            success: false,
            error: error instanceof Error ? error.message : String(error),
            attempts: attempt,
          }
        }

        // Exponential backoff before retry
        await this._sleep(Math.min(1000 * Math.pow(2, attempt - 1), 10000))
      }
    }

    // Should not reach here, but just in case
    return {
      url: config.url,
      success: false,
      error: 'Max retries exceeded',
      attempts: maxRetries,
    }
  }

  private _recordResult(result: WebhookDeliveryResult): void {
    this._deliveryResults.push(result)

    // Evict oldest entries if over capacity
    while (this._deliveryResults.length > this._maxDeliveryHistory) {
      this._deliveryResults.shift()
    }
  }

  private _sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
