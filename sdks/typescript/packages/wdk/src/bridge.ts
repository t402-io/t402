/**
 * USDT0 Bridge integration for T402 WDK
 *
 * Provides cross-chain USDT0 transfers using:
 * 1. Tether WDK bridge protocol (if available)
 * 2. Direct LayerZero OFT integration (fallback)
 */

import type { WDKSigner } from './signer.js'
import type { BridgeResult } from './types.js'
import {
  Usdt0Bridge,
  supportsBridging,
  getBridgeableChains,
  type BridgeSigner,
  type TransactionReceipt,
} from '@t402/evm'
import { BridgeTracker, type BridgeTrackerConfig } from './bridge-tracker.js'

/**
 * Extended bridge result with quote information
 */
export interface BridgeQuoteResult extends BridgeResult {
  /** Native fee in wei */
  nativeFee: bigint
  /** Minimum amount to receive */
  minAmountToReceive: bigint
}

// ============================================================================
// JSON-RPC Helpers
// ============================================================================

let jsonRpcId = 1

/**
 * Make a JSON-RPC call to an EVM node
 */
async function jsonRpcCall(rpcUrl: string, method: string, params: unknown[]): Promise<unknown> {
  const id = jsonRpcId++
  const body = JSON.stringify({ jsonrpc: '2.0', id, method, params })
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
  if (!res.ok) {
    throw new Error(`JSON-RPC request failed: ${res.status} ${res.statusText}`)
  }
  const json = (await res.json()) as { result?: unknown; error?: { code: number; message: string } }
  if (json.error) {
    throw new Error(`JSON-RPC error ${json.error.code}: ${json.error.message}`)
  }
  return json.result
}

/**
 * Known ERC-20 / OFT function selectors.
 * We only need to encode the functions used by Usdt0Bridge.
 */
const KNOWN_SELECTORS: Record<string, string> = {
  // ERC-20
  balanceOf: '0x70a08231',
  allowance: '0xdd62ed3e',
  approve: '0x095ea7b3',
  transfer: '0xa9059cbb',
  // OFT / LayerZero
  quoteSend: '0x0d35b415',
  send: '0xc7c7f5b3',
}

/**
 * ABI-encode a uint256 value (left-pad to 32 bytes)
 */
function encodeUint256(value: bigint): string {
  return value.toString(16).padStart(64, '0')
}

/**
 * ABI-encode an address (left-pad to 32 bytes)
 */
function encodeAddress(addr: string): string {
  const clean = addr.startsWith('0x') ? addr.slice(2) : addr
  return clean.toLowerCase().padStart(64, '0')
}

/**
 * Encode a function call with known ABI
 *
 * Handles the common function signatures used by the bridge:
 * - balanceOf(address)
 * - allowance(address,address)
 * - approve(address,uint256)
 * - transfer(address,uint256)
 *
 * For complex structs (quoteSend, send), falls back to pre-encoded
 * functionData passed through args if available.
 */
function encodeFunctionCall(args: {
  abi: readonly unknown[]
  functionName: string
  args?: readonly unknown[]
}): `0x${string}` {
  const selector = KNOWN_SELECTORS[args.functionName]
  if (!selector) {
    throw new Error(`Unknown function: ${args.functionName}. Cannot encode without full ABI codec.`)
  }
  const fnArgs = args.args ?? []
  let encoded = selector

  for (const arg of fnArgs) {
    if (typeof arg === 'bigint') {
      encoded += encodeUint256(arg)
    } else if (typeof arg === 'string' && arg.startsWith('0x') && arg.length === 42) {
      encoded += encodeAddress(arg)
    } else if (typeof arg === 'string' && arg.startsWith('0x')) {
      // bytes32 or other hex — pad to 32 bytes
      const clean = arg.slice(2)
      encoded += clean.padStart(64, '0')
    } else if (typeof arg === 'number') {
      encoded += BigInt(arg).toString(16).padStart(64, '0')
    } else if (typeof arg === 'object' && arg !== null) {
      // Struct — for quoteSend/send we need pre-encoded data.
      // This path handles tuple encoding by concatenating all fields.
      const obj = arg as Record<string, unknown>
      for (const val of Object.values(obj)) {
        if (typeof val === 'bigint') {
          encoded += encodeUint256(val)
        } else if (typeof val === 'string' && val.startsWith('0x')) {
          const clean = val.slice(2)
          encoded += clean.padStart(64, '0')
        } else if (typeof val === 'number') {
          encoded += BigInt(val).toString(16).padStart(64, '0')
        }
      }
    } else {
      throw new Error(`Cannot encode argument of type ${typeof arg}`)
    }
  }

  return encoded as `0x${string}`
}

/**
 * Decode basic return types from hex-encoded ABI data.
 *
 * Handles:
 * - Single uint256 (e.g., balanceOf, allowance) → bigint
 * - Single bool (e.g., approve, transfer) → boolean
 * - Single address → `0x${string}`
 *
 * For complex tuple returns, returns the raw hex string.
 */
function decodeFunctionResult(
  args: { functionName: string; abi: readonly unknown[] },
  hex: unknown,
): unknown {
  if (typeof hex !== 'string') return hex
  const data = hex.startsWith('0x') ? hex.slice(2) : hex
  if (data.length === 0) return undefined

  // Single-word returns (32 bytes = 64 hex chars)
  const word = data.slice(0, 64)
  const fnName = args.functionName

  // Functions that return uint256
  if (['balanceOf', 'allowance', 'totalSupply', 'decimals', 'nonces'].includes(fnName)) {
    return BigInt('0x' + word)
  }

  // Functions that return bool
  if (['approve', 'transfer', 'transferFrom'].includes(fnName)) {
    return BigInt('0x' + word) !== 0n
  }

  // For complex return types (quoteSend returns tuples), return raw hex
  return hex
}

/**
 * Poll for a transaction receipt via eth_getTransactionReceipt
 */
async function pollForReceipt(
  rpcUrl: string,
  hash: `0x${string}`,
  timeout: number,
): Promise<TransactionReceipt> {
  const pollInterval = 2000
  const deadline = Date.now() + timeout

  while (Date.now() < deadline) {
    const result = (await jsonRpcCall(rpcUrl, 'eth_getTransactionReceipt', [hash])) as {
      status: string
      transactionHash: `0x${string}`
      logs: readonly { address: string; topics: readonly `0x${string}`[]; data: `0x${string}` }[]
    } | null

    if (result) {
      return {
        status: result.status === '0x1' ? 'success' : 'reverted',
        transactionHash: result.transactionHash,
        logs: (result.logs ?? []).map((log) => ({
          address: log.address as `0x${string}`,
          topics: log.topics,
          data: log.data,
        })),
      }
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval))
  }

  throw new Error(`Transaction receipt not found after ${timeout}ms: ${hash}`)
}

// ============================================================================
// WdkBridge
// ============================================================================

/**
 * WDK Bridge wrapper for USDT0 cross-chain transfers
 *
 * This class provides a high-level API for bridging USDT0 between chains.
 * It automatically handles:
 * - Fee estimation
 * - Token approval
 * - Transaction execution
 * - Receipt handling
 */
export class WdkBridge {
  private bridges: Map<string, Usdt0Bridge> = new Map()
  readonly tracker: BridgeTracker

  constructor(trackerConfig?: BridgeTrackerConfig) {
    this.tracker = new BridgeTracker(trackerConfig)
  }

  /**
   * Create bridge signer adapter from WDK signer.
   *
   * Uses JSON-RPC calls for readContract / waitForTransactionReceipt,
   * and delegates writeContract to the WDK signer's sendTransaction.
   */
  private createBridgeSigner(signer: WDKSigner, rpcUrl: string): BridgeSigner {
    return {
      address: signer.address,

      readContract: async (args) => {
        const data = encodeFunctionCall(args)
        const result = await jsonRpcCall(rpcUrl, 'eth_call', [{ to: args.address, data }, 'latest'])
        return decodeFunctionResult(args, result)
      },

      writeContract: async (args) => {
        const data = encodeFunctionCall(args)
        const { hash } = await signer.sendTransaction({
          to: args.address as `0x${string}`,
          data,
          value: args.value,
        })
        return hash
      },

      waitForTransactionReceipt: async (args) => {
        return pollForReceipt(rpcUrl, args.hash, 60000)
      },
    }
  }

  /**
   * Get or create a bridge instance for a chain
   *
   * @param chain - Chain name (e.g., "arbitrum", "ethereum")
   * @param signer - WDK signer for the chain
   * @param rpcUrl - JSON-RPC endpoint URL for the chain
   */
  getBridge(chain: string, signer: WDKSigner, rpcUrl: string): Usdt0Bridge {
    const cached = this.bridges.get(chain)
    if (cached) {
      return cached
    }

    const bridgeSigner = this.createBridgeSigner(signer, rpcUrl)
    const bridge = new Usdt0Bridge(bridgeSigner, chain)
    this.bridges.set(chain, bridge)
    return bridge
  }

  /**
   * Check if a chain supports USDT0 bridging
   */
  static supportsBridging(chain: string): boolean {
    return supportsBridging(chain)
  }

  /**
   * Get all chains that support USDT0 bridging
   */
  static getBridgeableChains(): string[] {
    return getBridgeableChains()
  }

  /**
   * Get supported destinations from a source chain
   */
  static getSupportedDestinations(fromChain: string): string[] {
    return getBridgeableChains().filter((chain) => chain !== fromChain)
  }
}

/**
 * Bridge configuration for direct LayerZero OFT usage
 */
export interface DirectBridgeConfig {
  /** RPC URL for the source chain */
  rpcUrl: string
  /** Private key or signer */
  signer: BridgeSigner
}

/**
 * Create a direct USDT0 bridge (without WDK)
 *
 * Use this when you have a viem wallet client and want to bridge directly.
 *
 * @example
 * ```typescript
 * import { createDirectBridge } from '@t402/wdk';
 * import { createWalletClient, http } from 'viem';
 * import { arbitrum } from 'viem/chains';
 *
 * const walletClient = createWalletClient({
 *   chain: arbitrum,
 *   transport: http('https://arb1.arbitrum.io/rpc'),
 *   account: privateKeyToAccount(privateKey),
 * });
 *
 * const bridge = createDirectBridge(walletClient, 'arbitrum');
 *
 * const quote = await bridge.quote({
 *   fromChain: 'arbitrum',
 *   toChain: 'ethereum',
 *   amount: 100_000000n,
 *   recipient: walletClient.account.address,
 * });
 *
 * const result = await bridge.send({
 *   fromChain: 'arbitrum',
 *   toChain: 'ethereum',
 *   amount: 100_000000n,
 *   recipient: walletClient.account.address,
 * });
 * ```
 */
export function createDirectBridge(signer: BridgeSigner, chain: string): Usdt0Bridge {
  return new Usdt0Bridge(signer, chain)
}

// Re-export types from @t402/evm for convenience
export type { BridgeQuote, BridgeSigner } from '@t402/evm'
