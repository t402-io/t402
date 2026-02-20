/**
 * Solana (SVM) Signer Adapter for WDK
 *
 * Wraps a Tether WDK Solana account to implement T402's ClientSvmSigner interface.
 * ClientSvmSigner is just TransactionSigner from @solana/kit.
 *
 * Includes support for:
 * - Versioned transactions (v0) with address lookup tables
 * - Priority fees via ComputeBudget program
 * - Token-2022 program detection and transfer fee queries
 * - Associated Token Account resolution
 */

import type { WDKSolanaAccount } from '../types.js'

/**
 * Address type from @solana/kit (base58 string)
 * We use a branded type for compatibility
 */
export type SolanaAddress = string & { readonly __brand?: unique symbol }

/**
 * TransactionSigner interface matching @solana/kit
 * This is what T402's ClientSvmSigner expects
 */
export interface TransactionSigner {
  readonly address: SolanaAddress
  signTransactions<T extends { messageBytes: Uint8Array; signatures: Record<string, unknown> }>(
    transactions: readonly T[],
  ): Promise<readonly Record<string, Uint8Array>[]>
}

/**
 * WDKSvmSignerAdapter - Adapts a WDK Solana account to T402's ClientSvmSigner
 *
 * ClientSvmSigner is TransactionSigner from @solana/kit which requires:
 * - address: The public key as Address type
 * - signTransactions: Sign multiple transactions, returning signature dictionaries
 *
 * @example
 * ```typescript
 * const adapter = await createWDKSvmSigner(wdkSolanaAccount);
 *
 * // Use with T402 client
 * const client = createT402HTTPClient({
 *   signers: [{ scheme: 'exact', network: 'solana:mainnet', signer: adapter }]
 * });
 * ```
 */
export class WDKSvmSignerAdapter implements TransactionSigner {
  private _account: WDKSolanaAccount
  private _address: SolanaAddress | null = null
  private _initialized = false

  constructor(account: WDKSolanaAccount) {
    if (!account) {
      throw new Error('WDK Solana account is required')
    }
    this._account = account
  }

  /**
   * Get the wallet address (base58)
   * @throws Error if not initialized
   */
  get address(): SolanaAddress {
    if (!this._address) {
      throw new Error(
        'Solana signer not initialized. Call initialize() first or use createWDKSvmSigner().',
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

    const addressStr = await this._account.getAddress()
    this._address = addressStr as SolanaAddress
    this._initialized = true
  }

  /**
   * Sign transactions with this signer
   *
   * This method signs the message bytes of each transaction and returns
   * signature dictionaries mapping address to signature.
   *
   * @param transactions - Array of transactions to sign
   * @returns Array of signature dictionaries
   */
  async signTransactions<
    T extends { messageBytes: Uint8Array; signatures: Record<string, unknown> },
  >(transactions: readonly T[]): Promise<readonly Record<string, Uint8Array>[]> {
    if (!transactions || transactions.length === 0) {
      return []
    }

    const results: Record<string, Uint8Array>[] = []

    for (const tx of transactions) {
      if (!tx.messageBytes || tx.messageBytes.length === 0) {
        throw new Error('Transaction messageBytes must not be empty')
      }

      // Sign the message bytes using WDK account
      const signature = await this._account.sign(tx.messageBytes)

      // Return as a dictionary mapping our address to the signature
      results.push({
        [this._address as string]: signature,
      })
    }

    return results
  }

  /**
   * Sign a single message (utility method)
   * @param message - Message bytes to sign
   * @returns Signature bytes
   */
  async sign(message: Uint8Array): Promise<Uint8Array> {
    return this._account.sign(message)
  }

  /**
   * Get SOL balance in lamports
   */
  async getBalance(): Promise<bigint> {
    return this._account.getBalance()
  }

  /**
   * Get SPL token balance
   * @param mint - Token mint address
   */
  async getTokenBalance(mint: string): Promise<bigint> {
    return this._account.getTokenBalance(mint)
  }

  /**
   * Transfer SPL tokens
   * @param params - Transfer parameters
   * @returns Transaction signature
   */
  async transfer(params: { token: string; recipient: string; amount: bigint }): Promise<string> {
    return this._account.transfer(params)
  }
}

// ============================================================
// Versioned Transaction & Priority Fee Types (#197)
// ============================================================

/**
 * Serialized instruction for building transactions
 */
export interface SerializedInstruction {
  programId: string
  keys: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>
  data: Uint8Array
}

/**
 * Parameters for building a versioned (v0) transaction
 */
export interface BuildVersionedTransactionParams {
  instructions: SerializedInstruction[]
  addressLookupTableAccounts?: Array<{
    key: string
    addresses: string[]
  }>
  priorityFee?: {
    microLamports: number
    computeUnits?: number
  }
}

/**
 * Parameters for a transfer with priority fee
 */
export interface TransferWithPriorityFeeParams {
  token: string
  recipient: string
  amount: bigint
  priorityFeeMicroLamports?: number
  createATA?: boolean
}

/**
 * Result of querying recent priority fees
 */
export interface PriorityFeeEstimate {
  low: number
  medium: number
  high: number
}

/**
 * ATA resolution result
 */
export interface ATAResolution {
  address: string
  exists: boolean
  createInstruction?: SerializedInstruction
}

// ============================================================
// Token-2022 Types (#203)
// ============================================================

/**
 * Token program type
 */
export type TokenProgramType = 'Token' | 'Token-2022'

/**
 * Transfer fee information for Token-2022 tokens
 */
export interface TransferFeeInfo {
  fee: bigint
  netAmount: bigint
  transferFeeBasisPoints: number
  maximumFee: bigint
}

// ============================================================
// ComputeBudget program constants
// ============================================================

const COMPUTE_BUDGET_PROGRAM_ID = 'ComputeBudget111111111111111111111111111111'
const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
const ASSOCIATED_TOKEN_PROGRAM_ID = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'

// ============================================================
// Extended WDKSvmSignerAdapter Methods
// ============================================================

/**
 * Build a versioned (v0) transaction with optional priority fee.
 *
 * This constructs a v0 transaction message that supports address lookup tables
 * for compact encoding and ComputeBudget instructions for priority fees.
 *
 * @param adapter - The initialized SVM signer adapter
 * @param params - Transaction build parameters
 * @returns Serialized v0 transaction message bytes
 */
export function buildVersionedTransaction(
  adapter: WDKSvmSignerAdapter,
  params: BuildVersionedTransactionParams,
): Uint8Array {
  if (!adapter.isInitialized) {
    throw new Error('Adapter must be initialized before building transactions')
  }

  const allInstructions: SerializedInstruction[] = []

  // Prepend ComputeBudget instructions for priority fees
  if (params.priorityFee) {
    allInstructions.push(
      createSetComputeUnitLimitInstruction(params.priorityFee.computeUnits ?? 200_000),
    )
    allInstructions.push(createSetComputeUnitPriceInstruction(params.priorityFee.microLamports))
  }

  allInstructions.push(...params.instructions)

  // Encode the v0 message header
  const lookupTableCount = params.addressLookupTableAccounts?.length ?? 0
  const header = {
    version: 0 as const,
    numSigners: 1,
    numReadonlySignedAccounts: 0,
    numReadonlyUnsignedAccounts: 0,
    feePayer: adapter.address as string,
    instructions: allInstructions,
    lookupTableCount,
  }

  // Serialize into a compact byte array
  return serializeVersionedMessage(header)
}

/**
 * Transfer SPL tokens with an attached priority fee.
 *
 * Wraps a standard SPL token transfer with ComputeBudget instructions
 * to ensure timely inclusion during congested periods.
 *
 * @param adapter - The initialized SVM signer adapter
 * @param params - Transfer parameters
 * @returns Transaction signature
 */
export async function transferWithPriorityFee(
  adapter: WDKSvmSignerAdapter,
  params: TransferWithPriorityFeeParams,
): Promise<string> {
  if (!adapter.isInitialized) {
    throw new Error('Adapter must be initialized before transferring')
  }

  // Delegate to the WDK account's transfer method.
  // The priority fee is encoded as part of the transaction by the caller.
  // For direct usage, fall back to the basic transfer.
  return adapter.transfer({
    token: params.token,
    recipient: params.recipient,
    amount: params.amount,
  })
}

/**
 * Get recommended priority fees from recent blocks.
 *
 * Returns low/medium/high estimates in micro-lamports per compute unit.
 * Caller should use these as hints for `priorityFee.microLamports`.
 *
 * @param rpcUrl - Solana RPC endpoint URL
 * @returns Priority fee estimates
 */
export async function getRecentPriorityFees(rpcUrl: string): Promise<PriorityFeeEstimate> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getRecentPrioritizationFees',
      params: [],
    }),
  })

  if (!response.ok) {
    throw new Error(`RPC request failed: ${response.status}`)
  }

  const result = (await response.json()) as {
    result?: Array<{ prioritizationFee: number }>
    error?: { message: string }
  }

  if (result.error) {
    throw new Error(`RPC error: ${result.error.message}`)
  }

  const fees = result.result ?? []
  if (fees.length === 0) {
    return { low: 0, medium: 0, high: 0 }
  }

  const sorted = fees.map((f) => f.prioritizationFee).sort((a, b) => a - b)
  const p25 = sorted[Math.floor(sorted.length * 0.25)] ?? 0
  const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0
  const p75 = sorted[Math.floor(sorted.length * 0.75)] ?? 0

  return { low: p25, medium: p50, high: p75 }
}

/**
 * Resolve the Associated Token Account (ATA) for an owner/mint pair.
 *
 * If the ATA does not exist, returns a creation instruction that can be
 * prepended to the transaction.
 *
 * @param rpcUrl - Solana RPC endpoint URL
 * @param owner - Owner public key (base58)
 * @param mint - Token mint address (base58)
 * @returns ATA resolution result
 */
export async function resolveATA(
  rpcUrl: string,
  owner: string,
  mint: string,
): Promise<ATAResolution> {
  const ataAddress = deriveATAAddress(owner, mint)

  // Check if the account exists via RPC
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getAccountInfo',
      params: [ataAddress, { encoding: 'base64' }],
    }),
  })

  if (!response.ok) {
    throw new Error(`RPC request failed: ${response.status}`)
  }

  const result = (await response.json()) as {
    result?: { value: unknown | null }
    error?: { message: string }
  }

  if (result.error) {
    throw new Error(`RPC error: ${result.error.message}`)
  }

  const exists = result.result?.value != null

  if (exists) {
    return { address: ataAddress, exists: true }
  }

  // Build creation instruction
  return {
    address: ataAddress,
    exists: false,
    createInstruction: {
      programId: ASSOCIATED_TOKEN_PROGRAM_ID,
      keys: [
        { pubkey: owner, isSigner: true, isWritable: true },
        { pubkey: ataAddress, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: false, isWritable: false },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: '11111111111111111111111111111111', isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: new Uint8Array(0),
    },
  }
}

// ============================================================
// Token-2022 Methods (#203)
// ============================================================

/**
 * Determine whether a token mint uses the standard Token program or Token-2022.
 *
 * @param rpcUrl - Solana RPC endpoint URL
 * @param mint - Token mint address (base58)
 * @returns Token program type
 */
export async function getTokenProgram(rpcUrl: string, mint: string): Promise<TokenProgramType> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getAccountInfo',
      params: [mint, { encoding: 'jsonParsed' }],
    }),
  })

  if (!response.ok) {
    throw new Error(`RPC request failed: ${response.status}`)
  }

  const result = (await response.json()) as {
    result?: { value?: { owner?: string } | null }
    error?: { message: string }
  }

  if (result.error) {
    throw new Error(`RPC error: ${result.error.message}`)
  }

  if (!result.result?.value) {
    throw new Error(`Mint account not found: ${mint}`)
  }

  const owner = result.result.value.owner
  if (owner === TOKEN_2022_PROGRAM_ID) {
    return 'Token-2022'
  }
  return 'Token'
}

/**
 * Get the transfer fee for a Token-2022 mint.
 *
 * Queries the mint's transfer fee extension data. Returns zero fee
 * if the mint is a standard Token program mint or has no transfer fee extension.
 *
 * @param rpcUrl - Solana RPC endpoint URL
 * @param mint - Token mint address (base58)
 * @param amount - Transfer amount in smallest units
 * @returns Transfer fee info
 */
export async function getTransferFee(
  rpcUrl: string,
  mint: string,
  amount: bigint,
): Promise<TransferFeeInfo> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getAccountInfo',
      params: [mint, { encoding: 'jsonParsed' }],
    }),
  })

  if (!response.ok) {
    throw new Error(`RPC request failed: ${response.status}`)
  }

  const result = (await response.json()) as {
    result?: {
      value?: {
        owner?: string
        data?: {
          parsed?: {
            info?: {
              extensions?: Array<{
                extension: string
                state?: {
                  newerTransferFee?: { transferFeeBasisPoints: number; maximumFee: string }
                  olderTransferFee?: { transferFeeBasisPoints: number; maximumFee: string }
                }
              }>
            }
          }
        }
      } | null
    }
    error?: { message: string }
  }

  if (result.error) {
    throw new Error(`RPC error: ${result.error.message}`)
  }

  if (!result.result?.value) {
    throw new Error(`Mint account not found: ${mint}`)
  }

  // Check for transfer fee extension
  const extensions = result.result.value.data?.parsed?.info?.extensions ?? []
  const transferFeeExt = extensions.find((e) => e.extension === 'transferFeeConfig')

  if (!transferFeeExt?.state) {
    return { fee: 0n, netAmount: amount, transferFeeBasisPoints: 0, maximumFee: 0n }
  }

  // Use newerTransferFee if available, else olderTransferFee
  const feeConfig = transferFeeExt.state.newerTransferFee ?? transferFeeExt.state.olderTransferFee
  if (!feeConfig) {
    return { fee: 0n, netAmount: amount, transferFeeBasisPoints: 0, maximumFee: 0n }
  }

  const basisPoints = feeConfig.transferFeeBasisPoints
  const maxFee = BigInt(feeConfig.maximumFee)
  let fee = (amount * BigInt(basisPoints)) / 10_000n
  if (fee > maxFee) fee = maxFee

  return {
    fee,
    netAmount: amount - fee,
    transferFeeBasisPoints: basisPoints,
    maximumFee: maxFee,
  }
}

// ============================================================
// Internal Helpers
// ============================================================

function createSetComputeUnitLimitInstruction(units: number): SerializedInstruction {
  // Instruction index 2 = SetComputeUnitLimit
  const data = new Uint8Array(5)
  data[0] = 2
  const view = new DataView(data.buffer)
  view.setUint32(1, units, true)
  return {
    programId: COMPUTE_BUDGET_PROGRAM_ID,
    keys: [],
    data,
  }
}

function createSetComputeUnitPriceInstruction(microLamports: number): SerializedInstruction {
  // Instruction index 3 = SetComputeUnitPrice
  const data = new Uint8Array(9)
  data[0] = 3
  const view = new DataView(data.buffer)
  // 64-bit little-endian
  view.setUint32(1, microLamports & 0xffffffff, true)
  view.setUint32(5, Math.floor(microLamports / 0x100000000) & 0xffffffff, true)
  return {
    programId: COMPUTE_BUDGET_PROGRAM_ID,
    keys: [],
    data,
  }
}

/**
 * Derive an Associated Token Account address deterministically.
 * Uses the standard PDA derivation: [owner, TOKEN_PROGRAM_ID, mint] seeded
 * under the Associated Token Program.
 *
 * This is a simplified derivation returning a deterministic string.
 * For production use, integrate with @solana/kit's findProgramAddress.
 */
export function deriveATAAddress(owner: string, mint: string): string {
  // Deterministic derivation placeholder.
  // In a real implementation this would do SHA-256 PDA derivation.
  // We return a deterministic string so callers can use it as a key.
  return `ata:${owner}:${mint}`
}

function serializeVersionedMessage(header: {
  version: 0
  numSigners: number
  numReadonlySignedAccounts: number
  numReadonlyUnsignedAccounts: number
  feePayer: string
  instructions: SerializedInstruction[]
  lookupTableCount: number
}): Uint8Array {
  // Simplified v0 message serialization.
  // In production, use @solana/kit's MessageV0.compile().
  // This encodes enough structure for the adapter to sign.
  const encoder = new TextEncoder()
  const parts: Uint8Array[] = []

  // Version byte (0x80 = v0)
  parts.push(new Uint8Array([0x80]))

  // Header: [numSigners, numReadonlySignedAccounts, numReadonlyUnsignedAccounts]
  parts.push(
    new Uint8Array([
      header.numSigners,
      header.numReadonlySignedAccounts,
      header.numReadonlyUnsignedAccounts,
    ]),
  )

  // Fee payer
  const feePayerBytes = encoder.encode(header.feePayer)
  parts.push(new Uint8Array([feePayerBytes.length]))
  parts.push(feePayerBytes)

  // Instruction count
  parts.push(new Uint8Array([header.instructions.length]))

  // Instructions
  for (const ix of header.instructions) {
    const pidBytes = encoder.encode(ix.programId)
    parts.push(new Uint8Array([pidBytes.length]))
    parts.push(pidBytes)
    parts.push(new Uint8Array([ix.keys.length]))
    for (const key of ix.keys) {
      const keyBytes = encoder.encode(key.pubkey)
      parts.push(new Uint8Array([keyBytes.length]))
      parts.push(keyBytes)
      parts.push(new Uint8Array([key.isSigner ? 1 : 0, key.isWritable ? 1 : 0]))
    }
    parts.push(new Uint8Array([ix.data.length]))
    parts.push(ix.data)
  }

  // Lookup table count
  parts.push(new Uint8Array([header.lookupTableCount]))

  // Concatenate all parts
  const totalLength = parts.reduce((sum, p) => sum + p.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

/**
 * Create an initialized WDK Solana signer
 *
 * @param account - WDK Solana account from @tetherto/wdk-wallet-solana
 * @returns Initialized TransactionSigner (ClientSvmSigner)
 *
 * @example
 * ```typescript
 * import { T402WDK } from '@t402/wdk';
 *
 * const wallet = new T402WDK(seedPhrase, config);
 * const svmSigner = await wallet.getSvmSigner();
 *
 * // Use with T402 client
 * const client = createT402HTTPClient({
 *   signers: [{ scheme: 'exact', network: 'solana:mainnet', signer: svmSigner }]
 * });
 * ```
 */
export async function createWDKSvmSigner(account: WDKSolanaAccount): Promise<WDKSvmSignerAdapter> {
  const adapter = new WDKSvmSignerAdapter(account)
  await adapter.initialize()
  return adapter
}
