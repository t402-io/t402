/**
 * TRON Signer Adapter for WDK
 *
 * Wraps a Tether WDK TRON account to implement T402's ClientTronSigner interface.
 * This allows WDK-managed TRON wallets to be used for T402 payments.
 *
 * Includes support for:
 * - Energy estimation for dynamic fee limits
 * - External energy delegation providers
 * - Dynamic fee limit calculation with 20% margin
 */

import type { WDKTronAccount } from '../types.js'

/**
 * SignTransactionParams matching T402's @t402/tron interface
 */
export interface SignTransactionParams {
  /** TRC20 contract address */
  contractAddress: string
  /** Recipient address (T-prefix base58check) */
  to: string
  /** Amount to transfer (in smallest units) */
  amount: string
  /** Fee limit in SUN (optional, defaults to 100 TRX) */
  feeLimit?: number
  /** Transaction expiration time in milliseconds (optional) */
  expiration?: number
}

/**
 * Block info for transaction building
 */
export interface BlockInfo {
  /** Reference block bytes (hex) */
  refBlockBytes: string
  /** Reference block hash (hex) */
  refBlockHash: string
  /** Expiration timestamp in milliseconds */
  expiration: number
}

/**
 * ClientTronSigner interface matching T402's @t402/tron
 */
export interface ClientTronSigner {
  readonly address: string
  signTransaction(params: SignTransactionParams): Promise<string>
  getBlockInfo(): Promise<BlockInfo>
}

/**
 * Energy estimation result
 */
export interface EnergyEstimate {
  energyRequired: number
  energyAvailable: number
  trxCostIfNoEnergy: bigint
  bandwidthRequired: number
}

/**
 * Energy provider interface for external delegation services
 */
export interface EnergyProvider {
  delegateEnergy(to: string, amount: number): Promise<string>
  getPrice(amount: number): Promise<bigint>
}

// TronWeb-compatible types
interface TronWebTransaction {
  txID: string
  raw_data: {
    contract: unknown[]
    ref_block_bytes: string
    ref_block_hash: string
    expiration: number
    timestamp: number
  }
  raw_data_hex: string
  signature?: string[]
}

interface TronWebBlock {
  block_header: {
    raw_data: {
      number: number
      txTrieRoot: string
      witness_address: string
      parentHash: string
      version: number
      timestamp: number
    }
    witness_signature: string
  }
  blockID: string
}

/**
 * WDKTronSignerAdapter - Adapts a WDK TRON account to T402's ClientTronSigner
 *
 * @example
 * ```typescript
 * const adapter = await createWDKTronSigner(wdkTronAccount);
 * const signedTx = await adapter.signTransaction({
 *   contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
 *   to: 'TRecipientAddress...',
 *   amount: '1000000', // 1 USDT
 * });
 * ```
 */
export class WDKTronSignerAdapter implements ClientTronSigner {
  private _account: WDKTronAccount
  private _address: string | null = null
  private _initialized = false
  private _rpcUrl: string
  private _energyProvider: EnergyProvider | null = null

  constructor(account: WDKTronAccount, rpcUrl = 'https://api.trongrid.io') {
    if (!account) {
      throw new Error('WDK TRON account is required')
    }
    this._account = account
    this._rpcUrl = rpcUrl
  }

  /**
   * Get the wallet address (T-prefix base58check)
   * @throws Error if not initialized
   */
  get address(): string {
    if (!this._address) {
      throw new Error(
        'TRON signer not initialized. Call initialize() first or use createWDKTronSigner().',
      )
    }
    return this._address
  }

  /**
   * Check if the adapter is initialized
   */
  get isInitialized(): boolean {
    return this._initialized
  }

  /**
   * Initialize the adapter by fetching the address
   * Must be called before using the signer
   */
  async initialize(): Promise<void> {
    if (this._initialized) {
      return
    }

    this._address = await this._account.getAddress()
    this._initialized = true
  }

  /**
   * Sign a TRC20 transfer transaction
   *
   * This method:
   * 1. Builds a TRC20 transfer transaction
   * 2. Signs it using the WDK account
   * 3. Returns the hex-encoded signed transaction
   *
   * @param params - Transaction parameters
   * @returns Hex-encoded signed transaction
   */
  async signTransaction(params: SignTransactionParams): Promise<string> {
    if (!params.contractAddress) {
      throw new Error('contractAddress is required')
    }
    if (!params.to) {
      throw new Error('recipient address (to) is required')
    }
    if (!params.amount || BigInt(params.amount) <= 0n) {
      throw new Error('amount must be a positive value')
    }

    // Get block info for transaction
    const blockInfo = await this.getBlockInfo()

    // Default fee limit: 100 TRX = 100_000_000 SUN
    const feeLimit = params.feeLimit ?? 100_000_000

    // Build the TRC20 transfer transaction
    const transaction = await this.buildTrc20Transaction({
      contractAddress: params.contractAddress,
      to: params.to,
      amount: params.amount,
      feeLimit,
      refBlockBytes: blockInfo.refBlockBytes,
      refBlockHash: blockInfo.refBlockHash,
      expiration: params.expiration ?? blockInfo.expiration,
    })

    // Sign the transaction using WDK account
    const signedTx = await this._account.signTransaction(transaction)

    // Serialize to hex format
    return this.serializeTransaction(signedTx as TronWebTransaction)
  }

  /**
   * Get the current reference block info for transaction building
   * This is required for TRON's replay protection mechanism
   */
  async getBlockInfo(): Promise<BlockInfo> {
    try {
      const response = await fetch(`${this._rpcUrl}/wallet/getnowblock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (!response.ok) {
        throw new Error(`Failed to get block info: ${response.status}`)
      }

      const block = (await response.json()) as TronWebBlock

      // Extract reference block bytes (last 4 bytes of block number)
      const blockNum = block.block_header.raw_data.number
      const refBlockBytes = blockNum.toString(16).padStart(8, '0').slice(-4)

      // Reference block hash (first 8 bytes of block ID)
      const refBlockHash = block.blockID.slice(16, 32)

      // Expiration: block timestamp + 60 seconds
      const expiration = block.block_header.raw_data.timestamp + 60000

      return {
        refBlockBytes,
        refBlockHash,
        expiration,
      }
    } catch (error) {
      throw new Error(
        `Failed to get TRON block info: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /**
   * Estimate the energy required for a TRC20 transfer.
   *
   * Uses the `wallet/triggerconstantcontract` API to simulate the transfer
   * and return the energy/bandwidth requirements.
   *
   * @param params - Transaction parameters to simulate
   * @returns Energy estimation result
   */
  async estimateEnergy(params: SignTransactionParams): Promise<EnergyEstimate> {
    if (!this._address) {
      throw new Error('TRON signer not initialized. Call initialize() first.')
    }

    const functionSelector = 'transfer(address,uint256)'
    const toAddressHex = this.addressToHex(params.to).slice(2).padStart(64, '0')
    const amountHex = BigInt(params.amount).toString(16).padStart(64, '0')
    const parameter = toAddressHex + amountHex

    try {
      const response = await fetch(`${this._rpcUrl}/wallet/triggerconstantcontract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_address: this.addressToHex(this._address),
          contract_address: this.addressToHex(params.contractAddress),
          function_selector: functionSelector,
          parameter,
        }),
      })

      if (!response.ok) {
        throw new Error(`Energy estimation failed: ${response.status}`)
      }

      const result = (await response.json()) as {
        energy_used?: number
        energy_penalty?: number
        result?: { code?: string; message?: string }
      }

      if (result.result?.code && result.result.code !== 'SUCCESS') {
        throw new Error(`Energy estimation failed: ${result.result.message ?? result.result.code}`)
      }

      const energyRequired = (result.energy_used ?? 0) + (result.energy_penalty ?? 0)

      // Get account resources to check available energy
      const resourceResponse = await fetch(`${this._rpcUrl}/wallet/getaccountresource`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: this.addressToHex(this._address),
        }),
      })

      let energyAvailable = 0
      if (resourceResponse.ok) {
        const resources = (await resourceResponse.json()) as {
          EnergyLimit?: number
          EnergyUsed?: number
          freeNetLimit?: number
          freeNetUsed?: number
          NetLimit?: number
          NetUsed?: number
        }
        energyAvailable = (resources.EnergyLimit ?? 0) - (resources.EnergyUsed ?? 0)
      }

      // TRC20 transfer typically requires ~350 bytes of bandwidth
      const bandwidthRequired = 350

      // Energy costs 420 SUN each (approximate, varies with market)
      const trxCostIfNoEnergy = BigInt(Math.max(0, energyRequired - energyAvailable)) * 420n

      return {
        energyRequired,
        energyAvailable,
        trxCostIfNoEnergy,
        bandwidthRequired,
      }
    } catch (error) {
      throw new Error(
        `Failed to estimate energy: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /**
   * Sign a TRC20 transfer with dynamic fee limit estimation.
   *
   * Instead of using a hardcoded 100 TRX fee limit, estimates the actual
   * energy cost and adds a 20% margin.
   *
   * @param params - Transaction parameters
   * @returns Hex-encoded signed transaction
   */
  async signTransactionWithEstimation(params: SignTransactionParams): Promise<string> {
    if (!params.feeLimit) {
      const estimate = await this.estimateEnergy(params)
      // Convert energy cost to SUN with 20% margin
      const estimatedFee = estimate.trxCostIfNoEnergy
      const feeWithMargin = estimatedFee + (estimatedFee * 20n) / 100n
      // Minimum 10 TRX fee limit, max 150 TRX
      const feeLimitSun = Number(
        feeWithMargin < 10_000_000n
          ? 10_000_000n
          : feeWithMargin > 150_000_000n
            ? 150_000_000n
            : feeWithMargin,
      )
      return this.signTransaction({ ...params, feeLimit: feeLimitSun })
    }
    return this.signTransaction(params)
  }

  /**
   * Register an external energy delegation provider.
   *
   * Energy providers can delegate bandwidth and energy to this account
   * to reduce TRX costs for TRC20 transfers.
   *
   * @param provider - Energy delegation provider
   */
  registerEnergyProvider(provider: EnergyProvider): void {
    this._energyProvider = provider
  }

  /**
   * Get the registered energy provider, if any
   */
  getEnergyProvider(): EnergyProvider | null {
    return this._energyProvider
  }

  /**
   * Build a TRC20 transfer transaction
   */
  private async buildTrc20Transaction(params: {
    contractAddress: string
    to: string
    amount: string
    feeLimit: number
    refBlockBytes: string
    refBlockHash: string
    expiration: number
  }): Promise<TronWebTransaction> {
    // Build TRC20 transfer function call
    // transfer(address,uint256) = 0xa9059cbb
    const functionSelector = 'transfer(address,uint256)'

    // Encode parameters
    const toAddressHex = this.addressToHex(params.to).slice(2).padStart(64, '0')
    const amountHex = BigInt(params.amount).toString(16).padStart(64, '0')
    const parameter = toAddressHex + amountHex

    try {
      const response = await fetch(`${this._rpcUrl}/wallet/triggersmartcontract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_address: this.addressToHex(this._address!),
          contract_address: this.addressToHex(params.contractAddress),
          function_selector: functionSelector,
          parameter,
          fee_limit: params.feeLimit,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to build transaction: ${response.status}`)
      }

      const result = await response.json()

      if (result.result?.code) {
        throw new Error(`Transaction build failed: ${result.result.message}`)
      }

      return result.transaction as TronWebTransaction
    } catch (error) {
      throw new Error(
        `Failed to build TRC20 transaction: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /**
   * Serialize a signed transaction to hex format
   */
  private serializeTransaction(signedTx: TronWebTransaction): string {
    // Return the raw_data_hex with signature appended
    if (signedTx.signature && signedTx.signature.length > 0) {
      return JSON.stringify(signedTx)
    }
    return signedTx.raw_data_hex
  }

  /**
   * Convert TRON base58 address to hex format
   */
  private addressToHex(address: string): string {
    // If already hex, return as-is
    if (address.startsWith('41') || address.startsWith('0x')) {
      return address.startsWith('0x') ? '41' + address.slice(2) : address
    }

    // Convert base58 to hex using simple algorithm
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
    let num = BigInt(0)
    for (const char of address) {
      num = num * BigInt(58) + BigInt(ALPHABET.indexOf(char))
    }

    // Convert to hex and take first 42 chars (21 bytes)
    let hex = num.toString(16)
    // Handle leading zeros
    let leadingZeros = 0
    for (const char of address) {
      if (char === '1') leadingZeros++
      else break
    }
    hex = '00'.repeat(leadingZeros) + hex

    // TRON address is 21 bytes = 42 hex chars
    return hex.slice(0, 42)
  }

  /**
   * Get TRX balance in SUN
   */
  async getBalance(): Promise<bigint> {
    return this._account.getBalance()
  }

  /**
   * Get TRC20 token balance
   * @param contractAddress - TRC20 contract address
   */
  async getTrc20Balance(contractAddress: string): Promise<bigint> {
    return this._account.getTrc20Balance(contractAddress)
  }
}

/**
 * Create an initialized WDK TRON signer
 *
 * @param account - WDK TRON account from @tetherto/wdk-wallet-tron
 * @param rpcUrl - Optional custom RPC URL (default: https://api.trongrid.io)
 * @returns Initialized ClientTronSigner
 *
 * @example
 * ```typescript
 * import { T402WDK } from '@t402/wdk';
 *
 * const wallet = new T402WDK(seedPhrase, config);
 * const tronSigner = await wallet.getTronSigner();
 *
 * // Use with T402 client
 * const client = createT402HTTPClient({
 *   signers: [{ scheme: 'exact', network: 'tron:mainnet', signer: tronSigner }]
 * });
 * ```
 */
export async function createWDKTronSigner(
  account: WDKTronAccount,
  rpcUrl?: string,
): Promise<WDKTronSignerAdapter> {
  const adapter = new WDKTronSignerAdapter(account, rpcUrl)
  await adapter.initialize()
  return adapter
}
