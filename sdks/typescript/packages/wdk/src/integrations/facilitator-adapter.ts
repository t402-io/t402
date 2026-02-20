/**
 * Facilitator + WDK Adapter
 *
 * Wraps a T402WDK wallet as a facilitator-compatible signer, enabling WDK
 * wallets to be used for on-chain settlement (verify + settle operations).
 */

import type { T402WDK } from '../t402wdk.js'
import type { WDKSigner } from '../signer.js'

/**
 * Options for the facilitator WDK signer adapter.
 */
export interface FacilitatorWdkSignerOptions {
  /** Automatically settle payments after verification */
  autoSettle?: boolean
  /** Auto-bridge received payments to this chain (CAIP-2 network or chain name) */
  bridgeToMainChain?: string
}

/**
 * Facilitator-compatible signer backed by WDK.
 */
export interface FacilitatorWdkSigner {
  /** Wallet address on the target chain */
  address: string
  /** Sign a transaction for on-chain settlement */
  signTransaction: (tx: unknown) => Promise<string>
  /** Sign typed data (EIP-712) */
  signTypedData: (data: {
    domain: Record<string, unknown>
    types: Record<string, unknown>
    primaryType: string
    message: Record<string, unknown>
  }) => Promise<string>
  /** Send a signed transaction */
  sendTransaction: (params: { to: string; value?: bigint; data?: string }) => Promise<string>
}

/**
 * Convert a T402WDK instance into a facilitator-compatible signer for a given chain.
 *
 * The returned signer can be used with `toFacilitatorEvmSigner()` or directly
 * with a `t402Facilitator` instance for on-chain payment verification and settlement.
 *
 * @param wdk - An initialized T402WDK instance
 * @param chain - Chain name (e.g., "arbitrum", "base")
 * @param options - Optional configuration
 * @returns A facilitator-compatible signer object
 *
 * @example
 * ```typescript
 * const signer = await toFacilitatorWdkSigner(wdk, 'arbitrum', {
 *   autoSettle: true,
 *   bridgeToMainChain: 'arbitrum',
 * });
 *
 * // Use the signer with the facilitator
 * console.log('Facilitator address:', signer.address);
 * ```
 */
export async function toFacilitatorWdkSigner(
  wdk: T402WDK,
  chain: string,
  options?: FacilitatorWdkSignerOptions,
): Promise<FacilitatorWdkSigner> {
  // Get the WDK signer for the specified chain
  const wdkSigner: WDKSigner = await wdk.getSigner(chain)
  const address = wdkSigner.address

  return {
    address,

    async signTransaction(tx: unknown): Promise<string> {
      // For EVM chains, sign typed data if the tx is structured as EIP-712
      if (tx && typeof tx === 'object' && 'domain' in tx) {
        const typedData = tx as {
          domain: Record<string, unknown>
          types: Record<string, unknown>
          primaryType: string
          message: Record<string, unknown>
        }
        return wdkSigner.signTypedData(typedData)
      }

      // For raw message signing, convert to string
      if (typeof tx === 'string') {
        return wdkSigner.signMessage(tx)
      }

      throw new Error('Unsupported transaction format for WDK facilitator signer')
    },

    async signTypedData(data: {
      domain: Record<string, unknown>
      types: Record<string, unknown>
      primaryType: string
      message: Record<string, unknown>
    }): Promise<string> {
      return wdkSigner.signTypedData(data)
    },

    async sendTransaction(params: { to: string; value?: bigint; data?: string }): Promise<string> {
      const result = await wdkSigner.sendTransaction({
        to: params.to as `0x${string}`,
        value: params.value,
        data: params.data,
      })

      // Auto-bridge if configured
      if (options?.bridgeToMainChain && options.bridgeToMainChain !== chain) {
        // Check balance on source chain
        const balance = await wdk.getUsdt0Balance(chain)
        if (balance > 0n) {
          try {
            await wdk.bridgeUsdt0({
              fromChain: chain,
              toChain: options.bridgeToMainChain,
              amount: balance,
            })
          } catch {
            // Bridge failure is non-fatal for the facilitator
          }
        }
      }

      return result.hash
    },
  }
}

/**
 * Create facilitator signers for all configured WDK chains.
 *
 * @param wdk - An initialized T402WDK instance
 * @param options - Optional configuration applied to all signers
 * @returns Map of chain name to facilitator signer
 *
 * @example
 * ```typescript
 * const signers = await createFacilitatorSigners(wdk, {
 *   bridgeToMainChain: 'arbitrum',
 * });
 *
 * for (const [chain, signer] of signers) {
 *   console.log(`${chain}: ${signer.address}`);
 * }
 * ```
 */
export async function createFacilitatorSigners(
  wdk: T402WDK,
  options?: FacilitatorWdkSignerOptions,
): Promise<Map<string, FacilitatorWdkSigner>> {
  const chains = wdk.getConfiguredChains()
  const signers = new Map<string, FacilitatorWdkSigner>()

  const results = await Promise.allSettled(
    chains.map(async (chain) => {
      const signer = await toFacilitatorWdkSigner(wdk, chain, options)
      return { chain, signer }
    }),
  )

  for (const result of results) {
    if (result.status === 'fulfilled') {
      signers.set(result.value.chain, result.value.signer)
    }
  }

  return signers
}
