/**
 * WDK TON Gasless Client
 *
 * High-level client for executing gasless Jetton USDT0 payments on TON
 * using Tether WDK's gasless wallet module.
 *
 * Supports both the upstream @tetherto/wdk-wallet-ton-gasless module
 * and custom WDK instances with compatible method signatures.
 */

import type { TonGaslessConfig, TonGaslessPaymentParams, TonGaslessPaymentResult } from './types.js'
import { getJettonAddress, TON_JETTON_DECIMALS } from './constants.js'
import { adaptTonGaslessWallet, type TonGaslessWalletAdapter } from './adapter.js'

/**
 * TON Gasless Client
 *
 * Provides a simple API for executing gasless Jetton USDT0 payments
 * on TON using Tether WDK's gasless wallet module.
 */
export class TonGaslessClient {
  private readonly config: TonGaslessConfig
  private adapter?: TonGaslessWalletAdapter

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

    const wallet = this.getAdapter()
    const senderAddress = await wallet.getAddress()

    // Execute the gasless transfer via the adapter
    const result = await wallet.sendGaslessTransfer({
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
    const wallet = this.getAdapter()
    const address = await wallet.getAddress()

    const balance = await wallet.getJettonBalance(address, jettonAddress)
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
    const wallet = this.getAdapter()
    return wallet.getAddress()
  }

  /**
   * Get or create the wallet adapter.
   * Lazily wraps the WDK instance using the adapter layer.
   */
  private getAdapter(): TonGaslessWalletAdapter {
    if (this.adapter) {
      return this.adapter
    }

    if (!this.config.wdkInstance) {
      throw new Error('WDK instance not configured. Please provide a wdkInstance in the config.')
    }

    this.adapter = adaptTonGaslessWallet(this.config.wdkInstance)
    return this.adapter
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
export async function createTonGaslessClient(config: TonGaslessConfig): Promise<TonGaslessClient> {
  return new TonGaslessClient(config)
}
