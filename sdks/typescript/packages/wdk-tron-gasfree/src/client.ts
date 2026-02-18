/**
 * WDK TRON Gas-Free Client
 *
 * High-level client for executing gas-free TRC20 USDT payments on TRON
 * using Tether WDK's gas-free wallet.
 */

import type {
  WdkTronGasfreeConfig,
  GasfreePaymentParams,
  GasfreePaymentResult,
} from './types.js'
import { getTokenAddress, TRON_USDT_DECIMALS } from './constants.js'

/**
 * WDK TRON Gas-Free Client
 *
 * Provides a simple API for executing gas-free TRC20 USDT payments
 * on TRON using Tether WDK's gas-free wallet module.
 */
export class WdkTronGasfreeClient {
  private readonly config: WdkTronGasfreeConfig

  constructor(config: WdkTronGasfreeConfig) {
    this.config = config
  }

  /**
   * Execute a gas-free TRC20 USDT transfer
   *
   * The transaction is sent through the gas-free relay, which sponsors
   * the bandwidth/energy costs so the sender pays no TRX.
   */
  async pay(params: GasfreePaymentParams): Promise<GasfreePaymentResult> {
    // Validate recipient address
    if (!params.to || params.to.length < 30) {
      throw new Error('Invalid TRON recipient address')
    }

    if (params.amount <= 0n) {
      throw new Error('Payment amount must be greater than zero')
    }

    const token = params.token ?? 'USDT'
    const tokenAddress = getTokenAddress(token)

    // Get the WDK instance
    const wdk = this.getWdkInstance()

    // Build the gas-free transfer
    const senderAddress = await this.getAddress()

    // Execute the gas-free transfer via the WDK module
    // The WDK tron-gasfree module handles relay submission internally
    const result = await this.executeGasfreeTransfer(wdk, {
      from: senderAddress,
      to: params.to,
      amount: params.amount.toString(),
      tokenAddress,
      memo: params.memo,
    })

    return {
      txId: result.txId,
      from: senderAddress,
      to: params.to,
      sponsored: true,
    }
  }

  /**
   * Check USDT balance
   */
  async getBalance(token?: 'USDT' | 'USDT0'): Promise<bigint> {
    const tokenType = token ?? 'USDT'
    const tokenAddress = getTokenAddress(tokenType)
    const address = await this.getAddress()

    const wdk = this.getWdkInstance()

    // Query TRC20 balance via WDK
    const balance = await this.queryTrc20Balance(wdk, address, tokenAddress)
    return BigInt(balance)
  }

  /**
   * Get formatted balance (human-readable)
   */
  getFormattedBalance(balance: bigint, decimals: number = TRON_USDT_DECIMALS): string {
    const divisor = BigInt(10 ** decimals)
    const whole = balance / divisor
    const fraction = balance % divisor
    const fractionStr = fraction.toString().padStart(decimals, '0')
    // Trim trailing zeros
    const trimmed = fractionStr.replace(/0+$/, '') || '0'
    return `${whole}.${trimmed}`
  }

  /**
   * Get wallet address
   */
  async getAddress(): Promise<string> {
    const wdk = this.getWdkInstance()
    if (!wdk) {
      throw new Error('WDK instance not configured')
    }

    // The WDK tron-gasfree module provides the address
    if (typeof wdk === 'object' && wdk !== null) {
      const instance = wdk as Record<string, unknown>
      if (typeof instance.getAddress === 'function') {
        return (instance as { getAddress: () => Promise<string> }).getAddress()
      }
      if (typeof instance.address === 'string') {
        return instance.address as string
      }
    }

    throw new Error('Unable to get address from WDK instance')
  }

  /**
   * Check if gas-free transfer is available for the given params
   */
  async canSponsor(params: GasfreePaymentParams): Promise<boolean> {
    // Check if relay is configured
    if (!this.config.relayConfig?.url && !this.config.wdkInstance) {
      return false
    }

    // Check if the token is supported
    const token = params.token ?? 'USDT'
    try {
      getTokenAddress(token)
    } catch {
      return false
    }

    // Verify amount is positive
    if (params.amount <= 0n) {
      return false
    }

    return true
  }

  /**
   * Get the WDK instance
   */
  private getWdkInstance(): unknown {
    if (!this.config.wdkInstance) {
      throw new Error(
        'WDK instance not configured. Please provide a wdkInstance in the config.',
      )
    }
    return this.config.wdkInstance
  }

  /**
   * Execute a gas-free TRC20 transfer via the WDK module
   */
  private async executeGasfreeTransfer(
    wdk: unknown,
    params: {
      from: string
      to: string
      amount: string
      tokenAddress: string
      memo?: string
    },
  ): Promise<{ txId: string }> {
    // Delegate to the WDK tron-gasfree module
    if (typeof wdk === 'object' && wdk !== null) {
      const instance = wdk as Record<string, unknown>

      // Try the standard WDK gas-free transfer method
      if (typeof instance.sendGasfreeTransfer === 'function') {
        const fn = instance.sendGasfreeTransfer as (
          params: Record<string, unknown>,
        ) => Promise<{ txId: string }>
        return fn({
          to: params.to,
          amount: params.amount,
          tokenAddress: params.tokenAddress,
          memo: params.memo,
        })
      }

      // Try alternative method name
      if (typeof instance.transfer === 'function') {
        const fn = instance.transfer as (
          params: Record<string, unknown>,
        ) => Promise<{ txId: string }>
        return fn({
          to: params.to,
          amount: params.amount,
          tokenAddress: params.tokenAddress,
        })
      }
    }

    throw new Error(
      'WDK instance does not support gas-free transfers. ' +
        'Ensure @tetherto/wdk-wallet-tron-gasfree is properly configured.',
    )
  }

  /**
   * Query TRC20 token balance via the WDK module
   */
  private async queryTrc20Balance(
    wdk: unknown,
    address: string,
    tokenAddress: string,
  ): Promise<string> {
    if (typeof wdk === 'object' && wdk !== null) {
      const instance = wdk as Record<string, unknown>

      if (typeof instance.getBalance === 'function') {
        const fn = instance.getBalance as (
          address: string,
          tokenAddress: string,
        ) => Promise<string>
        return fn(address, tokenAddress)
      }
    }

    throw new Error('WDK instance does not support balance queries')
  }
}

/**
 * Create a WDK TRON gas-free client
 *
 * @example
 * ```typescript
 * import { createWdkTronGasfreeClient } from '@t402/wdk-tron-gasfree';
 *
 * const client = await createWdkTronGasfreeClient({
 *   wdkInstance: myTronGasfreeWallet,
 * });
 *
 * // Execute gas-free payment
 * const result = await client.pay({
 *   to: 'TAddress...',
 *   amount: 1000000n, // 1 USDT (6 decimals)
 * });
 *
 * console.log('Transaction ID:', result.txId);
 * console.log('Gas-free:', result.sponsored);
 * ```
 */
export async function createWdkTronGasfreeClient(
  config: WdkTronGasfreeConfig,
): Promise<WdkTronGasfreeClient> {
  return new WdkTronGasfreeClient(config)
}
