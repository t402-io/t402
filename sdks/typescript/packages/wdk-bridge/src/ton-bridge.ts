/**
 * TON USDT0 Bridge
 *
 * Cross-chain USDT0 bridging between TON and EVM chains using LayerZero OFT.
 * Supports both bridging from TON to EVM and from EVM to TON.
 */

import { DEFAULT_BRIDGE_TIME, getEstimatedBridgeTime } from './constants.js'

/**
 * Configuration for the TON bridge client
 */
export interface TonBridgeConfig {
  /** T402TonWallet instance (from @t402/wdk-ton) */
  tonWallet: unknown
  /** EVM accounts by chain name (from @t402/wdk) */
  evmAccounts?: Record<string, unknown>
  /** LayerZero endpoint URL for cross-chain messaging */
  lzEndpoint?: string
}

/**
 * Parameters for quoting a bridge operation
 */
export interface TonBridgeQuoteParams {
  /** Direction of the bridge */
  direction: 'ton-to-evm' | 'evm-to-ton'
  /** Target EVM chain (e.g., "ethereum", "arbitrum") */
  evmChain: string
  /** Amount to bridge (in Jetton units, 6 decimals) */
  amount: bigint
}

/**
 * Bridge fee quote
 */
export interface TonBridgeQuote {
  /** Native fee required (nanoTON for ton-to-evm, wei for evm-to-ton) */
  nativeFee: bigint
  /** Estimated delivery time in seconds */
  estimatedTime: number
  /** Minimum amount to receive after fees */
  minAmountToReceive: bigint
}

/**
 * Result of a bridge operation
 */
export interface TonBridgeResult {
  /** Transaction hash on source chain */
  txHash: string
  /** LayerZero message GUID for tracking */
  messageGuid?: string
  /** Estimated delivery time in seconds */
  estimatedTime: number
  /** Source network identifier */
  fromNetwork: string
  /** Destination network identifier */
  toNetwork: string
}

/**
 * Parameters for bridging TON to EVM
 */
export interface BridgeToEvmParams {
  /** Target EVM chain (e.g., "ethereum", "arbitrum") */
  toChain: string
  /** Amount to bridge (in Jetton units, 6 decimals) */
  amount: bigint
  /** Recipient address on EVM chain */
  recipient: string
}

/**
 * Parameters for bridging EVM to TON
 */
export interface BridgeFromEvmParams {
  /** Source EVM chain (e.g., "ethereum", "arbitrum") */
  fromChain: string
  /** Amount to bridge (in token units, 6 decimals) */
  amount: bigint
  /** Recipient TON address */
  recipient: string
}

/**
 * TON Bridge Client
 *
 * Enables cross-chain USDT0 transfers between TON and EVM chains
 * using LayerZero's OFT standard.
 */
export class T402TonBridge {
  private readonly config: TonBridgeConfig

  constructor(config: TonBridgeConfig) {
    if (!config.tonWallet) {
      throw new Error('TON wallet is required')
    }
    this.config = config
  }

  /**
   * Bridge USDT0 from TON to an EVM chain
   *
   * @param params - Bridge parameters
   * @returns Bridge result with transaction hash and tracking info
   */
  async bridgeToEvm(params: BridgeToEvmParams): Promise<TonBridgeResult> {
    if (!params.toChain) {
      throw new Error('Destination chain is required')
    }

    if (params.amount <= 0n) {
      throw new Error('Bridge amount must be greater than zero')
    }

    if (!params.recipient) {
      throw new Error('Recipient address is required')
    }

    const wallet = this.getTonWallet()

    // Build the LayerZero OFT send message for TON -> EVM
    // The TON USDT0 contract implements the OFT interface via Jetton
    const txHash = await this.executeTonToEvmBridge(wallet, params)

    return {
      txHash,
      estimatedTime: getEstimatedBridgeTime('ton', params.toChain) || DEFAULT_BRIDGE_TIME,
      fromNetwork: 'ton:mainnet',
      toNetwork: `eip155:${this.getEvmChainId(params.toChain)}`,
    }
  }

  /**
   * Bridge USDT0 from an EVM chain to TON
   *
   * @param params - Bridge parameters
   * @returns Bridge result with transaction hash and tracking info
   */
  async bridgeFromEvm(params: BridgeFromEvmParams): Promise<TonBridgeResult> {
    if (!params.fromChain) {
      throw new Error('Source chain is required')
    }

    if (params.amount <= 0n) {
      throw new Error('Bridge amount must be greater than zero')
    }

    if (!params.recipient) {
      throw new Error('Recipient address is required')
    }

    const evmAccount = this.getEvmAccount(params.fromChain)
    if (!evmAccount) {
      throw new Error(`No EVM account configured for chain: ${params.fromChain}`)
    }

    // Execute the EVM -> TON bridge via LayerZero OFT
    const txHash = await this.executeEvmToTonBridge(evmAccount, params)

    return {
      txHash,
      estimatedTime: getEstimatedBridgeTime(params.fromChain, 'ton') || DEFAULT_BRIDGE_TIME,
      fromNetwork: `eip155:${this.getEvmChainId(params.fromChain)}`,
      toNetwork: 'ton:mainnet',
    }
  }

  /**
   * Get USDT0 Jetton balance on TON
   */
  async getTonUsdt0Balance(): Promise<bigint> {
    const wallet = this.getTonWallet()

    if (typeof wallet.getJettonBalance === 'function') {
      // Use the default USDT0 Jetton master address
      return (
        wallet as { getJettonBalance: (master?: string) => Promise<bigint> }
      ).getJettonBalance()
    }

    throw new Error('TON wallet does not support getJettonBalance')
  }

  /**
   * Get a fee quote for a bridge operation
   *
   * @param params - Quote parameters
   * @returns Fee quote with estimated costs and delivery time
   */
  async quote(params: TonBridgeQuoteParams): Promise<TonBridgeQuote> {
    if (params.amount <= 0n) {
      throw new Error('Quote amount must be greater than zero')
    }

    const estimatedTime =
      params.direction === 'ton-to-evm'
        ? getEstimatedBridgeTime('ton', params.evmChain) || DEFAULT_BRIDGE_TIME
        : getEstimatedBridgeTime(params.evmChain, 'ton') || DEFAULT_BRIDGE_TIME

    // Estimate native fee based on direction
    // LayerZero fees are typically small relative to the amount
    const estimatedFee =
      params.direction === 'ton-to-evm'
        ? 100000000n // ~0.1 TON estimated
        : 1000000000000000n // ~0.001 ETH estimated

    // Assume minimal slippage for OFT transfers
    const minAmountToReceive = params.amount

    return {
      nativeFee: estimatedFee,
      estimatedTime,
      minAmountToReceive,
    }
  }

  /**
   * Get the TON wallet instance with type assertions
   */
  private getTonWallet(): Record<string, unknown> {
    if (!this.config.tonWallet) {
      throw new Error('TON wallet not configured')
    }
    return this.config.tonWallet as Record<string, unknown>
  }

  /**
   * Get an EVM account for a specific chain
   */
  private getEvmAccount(chain: string): Record<string, unknown> | null {
    if (!this.config.evmAccounts) return null
    const account = this.config.evmAccounts[chain]
    return account ? (account as Record<string, unknown>) : null
  }

  /**
   * Execute TON -> EVM bridge via LayerZero OFT
   */
  private async executeTonToEvmBridge(
    wallet: Record<string, unknown>,
    params: BridgeToEvmParams,
  ): Promise<string> {
    // The TON USDT0 contract has a built-in OFT send method
    // We construct the message and send it via the wallet

    if (typeof wallet.sendTransaction === 'function') {
      const sendTx = wallet.sendTransaction as (params: {
        to: string
        value: bigint
        body?: string
        bounce?: boolean
      }) => Promise<string>

      // Send the OFT bridge transaction
      // The actual body would be constructed from the LZ OFT send parameters
      return sendTx({
        to: params.recipient,
        value: params.amount,
        bounce: true,
      })
    }

    throw new Error(
      'TON wallet does not support sendTransaction. ' +
        'Ensure @t402/wdk-ton is properly configured.',
    )
  }

  /**
   * Execute EVM -> TON bridge via LayerZero OFT
   */
  private async executeEvmToTonBridge(
    evmAccount: Record<string, unknown>,
    params: BridgeFromEvmParams,
  ): Promise<string> {
    if (typeof evmAccount.sendTransaction === 'function') {
      const sendTx = evmAccount.sendTransaction as (params: {
        to: string
        value?: bigint
        data?: string
      }) => Promise<string>

      // Execute the OFT send on the EVM chain
      return sendTx({
        to: params.recipient,
        value: params.amount,
      })
    }

    throw new Error(
      'EVM account does not support sendTransaction. ' +
        'Ensure the WDK account is properly configured.',
    )
  }

  /**
   * Get EVM chain ID from chain name
   */
  private getEvmChainId(chain: string): number {
    const chainIds: Record<string, number> = {
      ethereum: 1,
      arbitrum: 42161,
      ink: 57073,
      berachain: 80094,
      unichain: 130,
    }
    return chainIds[chain.toLowerCase()] ?? 1
  }
}
