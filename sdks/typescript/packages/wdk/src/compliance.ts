/**
 * Transaction Screening / Compliance
 *
 * Provides a pluggable compliance framework for screening transactions
 * before execution. Supports multiple providers and maintains an audit trail.
 */

/**
 * Parameters for a compliance check
 */
export interface ComplianceCheckParams {
  from: string
  to: string
  chain: string
  amount: bigint
  asset: string
}

/**
 * Result of a compliance check
 */
export interface ComplianceResult {
  allowed: boolean
  reason?: string
}

/**
 * A provider that performs compliance checks
 */
export interface ComplianceProvider {
  check(params: ComplianceCheckParams): Promise<ComplianceResult>
}

/**
 * An audit trail entry for a compliance check
 */
export interface ComplianceEvent {
  timestamp: number
  action: 'payment' | 'bridge' | 'swap'
  params: ComplianceCheckParams
  result: ComplianceResult
}

/**
 * Manages compliance checks across multiple providers
 *
 * All registered providers are checked in order. If any provider
 * returns `allowed: false`, the transaction is blocked.
 *
 * @example
 * ```typescript
 * const manager = new ComplianceManager();
 * manager.registerProvider(new BlacklistProvider(new Set(['0xbad...'])));
 *
 * const result = await manager.check({
 *   from: '0xsender...',
 *   to: '0xreceiver...',
 *   chain: 'eip155:42161',
 *   amount: 1000000n,
 *   asset: 'USDT0',
 * });
 *
 * if (!result.allowed) {
 *   console.log('Blocked:', result.reason);
 * }
 * ```
 */
export class ComplianceManager {
  private _providers: ComplianceProvider[] = []
  private _auditTrail: ComplianceEvent[] = []

  /**
   * Register a compliance provider
   */
  registerProvider(provider: ComplianceProvider): void {
    this._providers.push(provider)
  }

  /**
   * Run all registered providers against the given parameters.
   * Returns the first rejection, or `{ allowed: true }` if all pass.
   *
   * @param params - The transaction parameters to check
   * @param action - The type of action being performed (default: 'payment')
   */
  async check(
    params: ComplianceCheckParams,
    action: 'payment' | 'bridge' | 'swap' = 'payment',
  ): Promise<ComplianceResult> {
    // If no providers registered, allow by default
    if (this._providers.length === 0) {
      const result: ComplianceResult = { allowed: true }
      this._recordEvent(action, params, result)
      return result
    }

    for (const provider of this._providers) {
      const result = await provider.check(params)
      if (!result.allowed) {
        this._recordEvent(action, params, result)
        return result
      }
    }

    const result: ComplianceResult = { allowed: true }
    this._recordEvent(action, params, result)
    return result
  }

  /**
   * Get the full audit trail of compliance checks
   */
  getAuditTrail(): ComplianceEvent[] {
    return [...this._auditTrail]
  }

  /**
   * Clear the audit trail
   */
  clearAuditTrail(): void {
    this._auditTrail = []
  }

  /**
   * Get the number of registered providers
   */
  get providerCount(): number {
    return this._providers.length
  }

  private _recordEvent(
    action: 'payment' | 'bridge' | 'swap',
    params: ComplianceCheckParams,
    result: ComplianceResult,
  ): void {
    this._auditTrail.push({
      timestamp: Date.now(),
      action,
      params,
      result,
    })
  }
}

/**
 * Built-in blacklist compliance provider
 *
 * Blocks transactions involving addresses in the blacklist.
 * Checks both `from` and `to` addresses.
 */
export class BlacklistProvider implements ComplianceProvider {
  private _addresses: Set<string>

  constructor(addresses?: Set<string>) {
    this._addresses = new Set()
    if (addresses) {
      for (const addr of addresses) {
        this._addresses.add(addr.toLowerCase())
      }
    }
  }

  async check(params: ComplianceCheckParams): Promise<ComplianceResult> {
    const fromLower = params.from.toLowerCase()
    const toLower = params.to.toLowerCase()

    if (this._addresses.has(fromLower)) {
      return { allowed: false, reason: `Address ${params.from} is blacklisted (sender)` }
    }

    if (this._addresses.has(toLower)) {
      return { allowed: false, reason: `Address ${params.to} is blacklisted (recipient)` }
    }

    return { allowed: true }
  }

  /**
   * Add an address to the blacklist
   */
  addAddress(address: string): void {
    this._addresses.add(address.toLowerCase())
  }

  /**
   * Remove an address from the blacklist
   */
  removeAddress(address: string): void {
    this._addresses.delete(address.toLowerCase())
  }

  /**
   * Check if an address is blacklisted
   */
  hasAddress(address: string): boolean {
    return this._addresses.has(address.toLowerCase())
  }

  /**
   * Get the number of blacklisted addresses
   */
  get size(): number {
    return this._addresses.size
  }
}

/**
 * Amount limit compliance provider
 *
 * Blocks transactions that exceed a configurable per-transaction or
 * cumulative amount limit.
 */
export class AmountLimitProvider implements ComplianceProvider {
  private _maxPerTransaction: bigint
  private _cumulativeAmounts = new Map<string, bigint>()
  private _maxCumulative: bigint | undefined

  /**
   * @param maxPerTransaction - Maximum amount per single transaction
   * @param maxCumulative - Optional maximum cumulative amount per address
   */
  constructor(maxPerTransaction: bigint, maxCumulative?: bigint) {
    this._maxPerTransaction = maxPerTransaction
    this._maxCumulative = maxCumulative
  }

  async check(params: ComplianceCheckParams): Promise<ComplianceResult> {
    if (params.amount > this._maxPerTransaction) {
      return {
        allowed: false,
        reason: `Amount ${params.amount} exceeds per-transaction limit of ${this._maxPerTransaction}`,
      }
    }

    if (this._maxCumulative !== undefined) {
      const key = params.from.toLowerCase()
      const cumulative = (this._cumulativeAmounts.get(key) ?? 0n) + params.amount
      if (cumulative > this._maxCumulative) {
        return {
          allowed: false,
          reason: `Cumulative amount ${cumulative} would exceed limit of ${this._maxCumulative}`,
        }
      }
      // Record the cumulative amount
      this._cumulativeAmounts.set(key, cumulative)
    }

    return { allowed: true }
  }

  /**
   * Reset cumulative tracking for an address
   */
  resetCumulative(address: string): void {
    this._cumulativeAmounts.delete(address.toLowerCase())
  }

  /**
   * Reset all cumulative tracking
   */
  resetAllCumulative(): void {
    this._cumulativeAmounts.clear()
  }
}
