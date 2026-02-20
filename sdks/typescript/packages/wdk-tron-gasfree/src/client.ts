/**
 * WDK TRON Gas-Free Client
 *
 * High-level client for executing gas-free TRC20 USDT payments on TRON
 * using Tether WDK's gas-free wallet.
 *
 * Supports both the upstream @tetherto/wdk-wallet-tron-gasfree module
 * and custom WDK instances with compatible method signatures.
 */

import type { WdkTronGasfreeConfig, GasfreePaymentParams, GasfreePaymentResult } from './types.js'
import { getTokenAddress, TRON_USDT_DECIMALS } from './constants.js'
import { adaptTronGasfreeWallet, type TronGasfreeWalletAdapter } from './adapter.js'

/**
 * WDK TRON Gas-Free Client
 *
 * Provides a simple API for executing gas-free TRC20 USDT payments
 * on TRON using Tether WDK's gas-free wallet module.
 */
export class WdkTronGasfreeClient {
  private readonly config: WdkTronGasfreeConfig
  private adapter?: TronGasfreeWalletAdapter

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

    const wallet = this.getAdapter()
    const senderAddress = await wallet.getAddress()

    // Execute the gas-free transfer via the adapter
    const result = await wallet.sendGasfreeTransfer({
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
    const wallet = this.getAdapter()
    const address = await wallet.getAddress()

    const balance = await wallet.getBalance(address, tokenAddress)
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
    const wallet = this.getAdapter()
    return wallet.getAddress()
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
   * Get or create the wallet adapter.
   * Lazily wraps the WDK instance using the adapter layer.
   */
  private getAdapter(): TronGasfreeWalletAdapter {
    if (this.adapter) {
      return this.adapter
    }

    if (!this.config.wdkInstance) {
      throw new Error('WDK instance not configured. Please provide a wdkInstance in the config.')
    }

    this.adapter = adaptTronGasfreeWallet(this.config.wdkInstance)
    return this.adapter
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
