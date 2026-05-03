import type {
  VerifyResponse,
  SettleResponse,
  PaymentPayload,
  PaymentRequirements,
} from '@t402/core/types'
import type { EmbeddedFacilitatorConfig, SchemeHandler } from './types'

/**
 * Embedded facilitator that runs in-process alongside a resource server,
 * eliminating the need for a separate facilitator service.
 *
 * Routes verify/settle calls to registered SchemeHandler instances
 * based on the scheme and network in payment requirements.
 */
export class EmbeddedFacilitator {
  private readonly schemes: Map<string, SchemeHandler>
  private readonly apiKey: string | undefined

  /**
   * Create a new EmbeddedFacilitator.
   *
   * @param config - Configuration including scheme handlers and optional API key
   */
  constructor(config: EmbeddedFacilitatorConfig) {
    this.schemes = new Map(config.schemes)
    this.apiKey = config.apiKey
  }

  /**
   * Verify a payment in-process without any HTTP call.
   * Matches the payment's scheme and network to a registered handler.
   *
   * @param payload - The payment payload to verify
   * @param requirements - The payment requirements to verify against
   * @returns Promise resolving to the verification response
   */
  async verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<VerifyResponse> {
    const handler = this.findHandler(requirements.scheme, requirements.network)
    if (!handler) {
      return {
        isValid: false,
        invalidReason: `No handler registered for scheme "${requirements.scheme}" on network "${requirements.network}"`,
      }
    }
    return handler.verify(payload, requirements)
  }

  /**
   * Settle a payment in-process without any HTTP call.
   * Matches the payment's scheme and network to a registered handler.
   *
   * @param payload - The payment payload to settle
   * @param requirements - The payment requirements for settlement
   * @returns Promise resolving to the settlement response
   */
  async settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<SettleResponse> {
    const handler = this.findHandler(requirements.scheme, requirements.network)
    if (!handler) {
      return {
        success: false,
        errorReason: `No handler registered for scheme "${requirements.scheme}" on network "${requirements.network}"`,
        transaction: '',
        network: requirements.network,
      }
    }
    return handler.settle(payload, requirements)
  }

  /**
   * Get all supported scheme:network kinds registered with this facilitator.
   *
   * @returns Object containing an array of supported kind strings
   */
  supported(): { kinds: string[] } {
    return {
      kinds: Array.from(this.schemes.keys()),
    }
  }

  /**
   * Register a scheme handler for a given pattern.
   * Patterns follow the format "scheme:network" or "scheme:family:*" for wildcards.
   *
   * @param pattern - The scheme:network pattern (e.g. "exact:eip155:8453" or "exact:eip155:*")
   * @param handler - The scheme handler to register
   */
  register(pattern: string, handler: SchemeHandler): void {
    this.schemes.set(pattern, handler)
  }

  /**
   * Remove a previously registered scheme handler.
   *
   * @param pattern - The scheme:network pattern to unregister
   * @returns True if a handler was removed, false if none was found
   */
  unregister(pattern: string): boolean {
    return this.schemes.delete(pattern)
  }

  /**
   * Validate an API key against the configured key.
   * Returns true if no API key is configured (open access).
   *
   * @param key - The API key to validate
   * @returns True if the key is valid or no key is required
   */
  validateApiKey(key: string | undefined): boolean {
    if (!this.apiKey) return true
    return key === this.apiKey
  }

  /**
   * Find the appropriate handler for a given scheme and network.
   * First attempts an exact match, then falls back to wildcard patterns.
   *
   * @param scheme - The payment scheme (e.g. "exact")
   * @param network - The network identifier (e.g. "eip155:8453")
   * @returns The matching SchemeHandler, or undefined if none found
   */
  private findHandler(scheme: string, network: string): SchemeHandler | undefined {
    // Exact match: "scheme:network"
    const exactKey = `${scheme}:${network}`
    const exact = this.schemes.get(exactKey)
    if (exact) return exact

    // Wildcard match: "scheme:family:*"
    const family = network.split(':')[0]
    const wildcardKey = `${scheme}:${family}:*`
    const wildcard = this.schemes.get(wildcardKey)
    if (wildcard) return wildcard

    return undefined
  }
}
