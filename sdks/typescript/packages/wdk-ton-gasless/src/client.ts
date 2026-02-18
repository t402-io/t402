/**
 * WDK TON Gasless Client
 *
 * High-level client for executing gasless Jetton USDT0 payments on TON
 * using Tether WDK's gasless wallet module.
 */

import type {
  TonGaslessConfig,
  TonGaslessPaymentParams,
  TonGaslessPaymentResult,
} from './types.js'
import { getJettonAddress, TON_JETTON_DECIMALS } from './constants.js'

/**
 * TON Gasless Client
 *
 * Provides a simple API for executing gasless Jetton USDT0 payments
 * on TON using Tether WDK's gasless wallet module.
 */
export class TonGaslessClient {
  private readonly config: TonGaslessConfig

  constructor(config: TonGaslessConfig) {
    this.config = config
  }

  /**
   * Execute a gasless Jetton transfer
   *
   * The transaction is sent through the gasless relay, which sponsors
   * the TON gas costs so the sender pays no TON.
   */
  async pay(params: TonGaslessPaymentParams): Promise<TonGaslessPaymentResult> {
    if (!params.to || params.to.length < 20) {
      throw new Error('Invalid TON recipient address')
    }

    if (params.amount <= 0n) {
      throw new Error('Payment amount must be greater than zero')
    }

    const token = params.token ?? 'USDT0'
    const jettonAddress = getJettonAddress(token)

    const wdk = this.getWdkInstance()
    const senderAddress = await this.getAddress()

    // Execute the gasless transfer via the WDK module
    const result = await this.executeGaslessTransfer(wdk, {
      from: senderAddress,
      to: params.to,
      amount: params.amount.toString(),
      jettonAddress,
      memo: params.memo,
    })

    return {
      txHash: result.txHash,
      from: senderAddress,
      to: params.to,
      sponsored: true,
      token,
    }
  }

  /**
   * Check if gasless transfer is available for the given params
   */
  async canSponsor(params: TonGaslessPaymentParams): Promise<boolean> {
    // Check if relay is configured
    if (!this.config.relayConfig?.url && !this.config.wdkInstance) {
      return false
    }

    // Check if the token is supported
    const token = params.token ?? 'USDT0'
    try {
      getJettonAddress(token)
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
   * Get Jetton balance
   */
  async getBalance(token?: 'USDT0' | 'USDT'): Promise<bigint> {
    const tokenType = token ?? 'USDT0'
    const jettonAddress = getJettonAddress(tokenType)
    const address = await this.getAddress()

    const wdk = this.getWdkInstance()

    const balance = await this.queryJettonBalance(wdk, address, jettonAddress)
    return BigInt(balance)
  }

  /**
   * Get formatted balance (human-readable)
   */
  getFormattedBalance(balance: bigint, decimals: number = TON_JETTON_DECIMALS): string {
    const divisor = BigInt(10 ** decimals)
    const whole = balance / divisor
    const fraction = balance % divisor
    const fractionStr = fraction.toString().padStart(decimals, '0')
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
   * Execute a gasless Jetton transfer via the WDK module
   */
  private async executeGaslessTransfer(
    wdk: unknown,
    params: {
      from: string
      to: string
      amount: string
      jettonAddress: string
      memo?: string
    },
  ): Promise<{ txHash: string }> {
    if (typeof wdk === 'object' && wdk !== null) {
      const instance = wdk as Record<string, unknown>

      // Try the standard WDK gasless transfer method
      if (typeof instance.sendGaslessTransfer === 'function') {
        const fn = instance.sendGaslessTransfer as (
          params: Record<string, unknown>,
        ) => Promise<{ txHash: string }>
        return fn({
          to: params.to,
          amount: params.amount,
          jettonAddress: params.jettonAddress,
          memo: params.memo,
        })
      }

      // Try alternative method names
      if (typeof instance.transferJettonGasless === 'function') {
        const fn = instance.transferJettonGasless as (
          params: Record<string, unknown>,
        ) => Promise<{ txHash: string }>
        return fn({
          to: params.to,
          amount: params.amount,
          jettonAddress: params.jettonAddress,
        })
      }

      if (typeof instance.transfer === 'function') {
        const fn = instance.transfer as (
          params: Record<string, unknown>,
        ) => Promise<{ txHash: string }>
        return fn({
          to: params.to,
          amount: params.amount,
          jettonAddress: params.jettonAddress,
        })
      }
    }

    throw new Error(
      'WDK instance does not support gasless transfers. ' +
        'Ensure @tetherto/wdk-wallet-ton-gasless is properly configured.',
    )
  }

  /**
   * Query Jetton balance via the WDK module
   */
  private async queryJettonBalance(
    wdk: unknown,
    address: string,
    jettonAddress: string,
  ): Promise<string> {
    if (typeof wdk === 'object' && wdk !== null) {
      const instance = wdk as Record<string, unknown>

      if (typeof instance.getJettonBalance === 'function') {
        const fn = instance.getJettonBalance as (
          address: string,
          jettonAddress: string,
        ) => Promise<string>
        return fn(address, jettonAddress)
      }

      if (typeof instance.getBalance === 'function') {
        const fn = instance.getBalance as (
          address: string,
          jettonAddress: string,
        ) => Promise<string>
        return fn(address, jettonAddress)
      }
    }

    throw new Error('WDK instance does not support balance queries')
  }
}

/**
 * Create a TON gasless client
 *
 * @example
 * ```typescript
 * import { createTonGaslessClient } from '@t402/wdk-ton-gasless';
 *
 * const client = await createTonGaslessClient({
 *   wdkInstance: myTonGaslessWallet,
 * });
 *
 * const result = await client.pay({
 *   to: 'UQ...',
 *   amount: 1000000n, // 1 USDT0 (6 decimals)
 * });
 *
 * console.log('Transaction:', result.txHash);
 * console.log('Gasless:', result.sponsored);
 * ```
 */
export async function createTonGaslessClient(
  config: TonGaslessConfig,
): Promise<TonGaslessClient> {
  return new TonGaslessClient(config)
}
