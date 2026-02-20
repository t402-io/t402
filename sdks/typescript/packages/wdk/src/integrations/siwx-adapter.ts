/**
 * SIWx + WDK Adapter
 *
 * Wraps a T402WDK wallet as a SIWx (Sign-In-With-X) signer, enabling
 * WDK wallets to sign CAIP-122 authentication messages.
 */

import type { T402WDK } from '../t402wdk.js'

/**
 * SIWx signer interface, compatible with the SIWxSigner from @t402/extensions.
 */
export interface SIWxSigner {
  /** Wallet address */
  address: string
  /** Sign a personal message (EIP-191) */
  signMessage(message: string): Promise<string>
  /** Sign EIP-712 typed data */
  signTypedData(data: {
    domain: unknown
    types: unknown
    primaryType: string
    message: unknown
  }): Promise<string>
}

/**
 * Convert a T402WDK instance into a SIWx-compatible signer for a given chain.
 *
 * The returned signer implements the `SIWxSigner` interface used by
 * `@t402/extensions` for CAIP-122 Sign-In-With-X authentication flows.
 *
 * @param wdk - An initialized T402WDK instance
 * @param chain - Chain name (e.g., "arbitrum", "base")
 * @returns A SIWx-compatible signer
 *
 * @example
 * ```typescript
 * import { toSIWxSigner } from '@t402/wdk';
 * import { createSIWxPayload, encodeSIWxHeader } from '@t402/extensions';
 *
 * const siwxSigner = await toSIWxSigner(wdk, 'arbitrum');
 *
 * // Create and sign SIWx payload
 * const payload = await createSIWxPayload(serverExtension, siwxSigner);
 * const header = encodeSIWxHeader(payload);
 *
 * // Include in request
 * fetch(url, { headers: { 'X-T402-SIWx': header } });
 * ```
 */
export async function toSIWxSigner(wdk: T402WDK, chain: string): Promise<SIWxSigner> {
  const wdkSigner = await wdk.getSigner(chain)

  return {
    address: wdkSigner.address,

    async signMessage(message: string): Promise<string> {
      return wdkSigner.signMessage(message)
    },

    async signTypedData(data: {
      domain: unknown
      types: unknown
      primaryType: string
      message: unknown
    }): Promise<string> {
      return wdkSigner.signTypedData({
        domain: data.domain as Record<string, unknown>,
        types: data.types as Record<string, unknown>,
        primaryType: data.primaryType,
        message: data.message as Record<string, unknown>,
      })
    },
  }
}

/**
 * Create SIWx signers for all configured WDK chains.
 *
 * @param wdk - An initialized T402WDK instance
 * @returns Map of chain name to SIWx signer
 *
 * @example
 * ```typescript
 * const signers = await createSIWxSigners(wdk);
 * const arbSigner = signers.get('arbitrum');
 * ```
 */
export async function createSIWxSigners(wdk: T402WDK): Promise<Map<string, SIWxSigner>> {
  const chains = wdk.getConfiguredChains()
  const signers = new Map<string, SIWxSigner>()

  const results = await Promise.allSettled(
    chains.map(async (chain) => {
      const signer = await toSIWxSigner(wdk, chain)
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
