/**
 * WDK Failover Provider
 *
 * Automatic RPC failover support with health checking and
 * configurable failure thresholds.
 */

export interface FailoverConfig {
  /** RPC URLs in priority order */
  urls: string[]
  /** Health check interval in ms (default: 30000) */
  healthCheckInterval?: number
  /** Request timeout in ms (default: 5000) */
  requestTimeout?: number
  /** Max consecutive failures before marking unhealthy (default: 3) */
  maxFailures?: number
}

export interface ProviderStatus {
  url: string
  healthy: boolean
  lastChecked: number
  consecutiveFailures: number
}

const DEFAULT_HEALTH_CHECK_INTERVAL = 30_000
const DEFAULT_REQUEST_TIMEOUT = 5_000
const DEFAULT_MAX_FAILURES = 3

/**
 * RPC failover provider with automatic health checking and failover.
 *
 * Manages a list of RPC URLs in priority order, automatically switching
 * to the next healthy provider when failures exceed the threshold.
 *
 * @example
 * ```typescript
 * const provider = new FailoverProvider({
 *   urls: ['https://arb1.arbitrum.io/rpc', 'https://arb-fallback.example.com'],
 *   maxFailures: 3,
 * })
 *
 * const url = provider.getCurrentUrl()
 * try {
 *   await fetch(url)
 *   provider.reportSuccess()
 * } catch {
 *   provider.reportFailure()
 * }
 * ```
 */
export class FailoverProvider {
  private providers: ProviderStatus[]
  private currentIndex: number = 0
  private healthCheckTimer?: ReturnType<typeof setInterval>
  private readonly maxFailures: number
  private readonly requestTimeout: number

  constructor(config: FailoverConfig) {
    if (!config.urls || config.urls.length === 0) {
      throw new Error('FailoverProvider requires at least one URL')
    }

    this.maxFailures = config.maxFailures ?? DEFAULT_MAX_FAILURES
    this.requestTimeout = config.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT

    this.providers = config.urls.map((url) => ({
      url,
      healthy: true,
      lastChecked: Date.now(),
      consecutiveFailures: 0,
    }))

    const interval = config.healthCheckInterval ?? DEFAULT_HEALTH_CHECK_INTERVAL
    if (interval > 0) {
      this.startHealthChecks(interval)
    }
  }

  /**
   * Get current active RPC URL
   */
  getCurrentUrl(): string {
    return this.providers[this.currentIndex].url
  }

  /**
   * Report a failure on the current URL.
   * Auto-switches to next healthy provider if failure threshold is reached.
   *
   * @returns The new URL if switched, or null if no switch occurred
   */
  reportFailure(): string | null {
    const provider = this.providers[this.currentIndex]
    provider.consecutiveFailures++
    provider.lastChecked = Date.now()

    if (provider.consecutiveFailures >= this.maxFailures) {
      provider.healthy = false
      return this.switchToNext()
    }

    return null
  }

  /**
   * Report success on the current URL, reset failure counter.
   */
  reportSuccess(): void {
    const provider = this.providers[this.currentIndex]
    provider.consecutiveFailures = 0
    provider.healthy = true
    provider.lastChecked = Date.now()
  }

  /**
   * Get all provider statuses
   */
  getStatus(): ProviderStatus[] {
    return this.providers.map((p) => ({ ...p }))
  }

  /**
   * Force switch to next healthy provider.
   *
   * @returns The new URL, or null if no healthy providers available
   */
  switchToNext(): string | null {
    const startIndex = this.currentIndex

    for (let i = 1; i <= this.providers.length; i++) {
      const nextIndex = (startIndex + i) % this.providers.length
      if (this.providers[nextIndex].healthy) {
        this.currentIndex = nextIndex
        return this.providers[nextIndex].url
      }
    }

    // No healthy providers found
    return null
  }

  /**
   * Get the request timeout in milliseconds
   */
  getRequestTimeout(): number {
    return this.requestTimeout
  }

  /**
   * Stop health checks and clean up resources
   */
  dispose(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = undefined
    }
  }

  private startHealthChecks(interval: number): void {
    this.healthCheckTimer = setInterval(() => {
      for (const provider of this.providers) {
        if (!provider.healthy) {
          this.checkHealth(provider)
        }
      }
    }, interval)

    // Don't prevent process from exiting
    if (this.healthCheckTimer.unref) {
      this.healthCheckTimer.unref()
    }
  }

  private async checkHealth(provider: ProviderStatus): Promise<boolean> {
    try {
      // Simple JSON-RPC health check (eth_chainId)
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.requestTimeout)

      const response = await fetch(provider.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_chainId',
          params: [],
          id: 1,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (response.ok) {
        provider.healthy = true
        provider.consecutiveFailures = 0
        provider.lastChecked = Date.now()
        return true
      }
    } catch {
      // Health check failed, keep unhealthy
    }

    provider.lastChecked = Date.now()
    return false
  }
}

/**
 * Normalize chain config that may contain failover arrays.
 * Backward compatible: single string URL still works.
 *
 * @example
 * ```typescript
 * // Single URL (backward compatible)
 * const provider = createFailoverProvider('https://arb1.arbitrum.io/rpc')
 * // Returns null — no failover needed
 *
 * // Multiple URLs with failover
 * const provider = createFailoverProvider(['https://arb1.arbitrum.io/rpc', 'https://fallback.example.com'])
 * // Returns FailoverProvider
 *
 * // Full config
 * const provider = createFailoverProvider({
 *   urls: ['https://arb1.arbitrum.io/rpc', 'https://fallback.example.com'],
 *   healthCheckInterval: 15000,
 * })
 * ```
 */
export function createFailoverProvider(
  config: string | string[] | FailoverConfig,
): FailoverProvider | null {
  if (typeof config === 'string') return null // Single URL, no failover needed
  if (Array.isArray(config)) return new FailoverProvider({ urls: config })
  return new FailoverProvider(config)
}

/**
 * Resolve the primary RPC URL from a config that may be a string, array, or FailoverConfig.
 */
export function resolveRpcUrl(config: string | string[] | FailoverConfig): string {
  if (typeof config === 'string') return config
  if (Array.isArray(config)) return config[0]
  return config.urls[0]
}
