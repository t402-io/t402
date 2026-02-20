/**
 * A2A + WDK Adapter
 *
 * Bridges T402WDK wallets with the A2A (Agent-to-Agent) payment transport,
 * enabling AI agents to make payments using WDK-managed wallets.
 */

import type { T402WDK } from '../t402wdk.js'
import type { SignerEntry } from '../types.js'

/**
 * Payment requirements received from an A2A server (402 response).
 * Matches the core PaymentRequired type shape.
 */
export interface A2APaymentRequired {
  t402Version: number
  resource: { url: string; description?: string; mimeType?: string }
  accepts: Array<{
    scheme: string
    network: string
    asset: string
    amount: string
    payTo: string
    maxTimeoutSeconds: number
    extra: Record<string, unknown>
  }>
  extensions?: Record<string, unknown>
}

/**
 * Payment payload to submit to an A2A server.
 * Matches the core PaymentPayload type shape.
 */
export interface A2APaymentPayload {
  t402Version: number
  resource?: { url: string; description?: string; mimeType?: string }
  accepted: A2APaymentRequired['accepts'][0]
  payload: Record<string, unknown>
  extensions?: Record<string, unknown>
}

/**
 * Options for the WDK A2A payment client adapter.
 */
export interface WdkA2AOptions {
  /** Maximum spending limit per payment (in atomic units) */
  spendingLimit?: bigint
  /** Callback when manual approval is required */
  onApprovalRequired?: (payment: { amount: bigint; network: string }) => Promise<boolean>
  /** Auto-check balance before payment */
  autoBalance?: boolean
  /** Auto-bridge if insufficient balance on target chain */
  autoBridge?: boolean
  /** Preferred payment scheme (default: "exact") */
  preferredScheme?: string
}

/**
 * Result of createWdkA2APaymentClient.
 */
export interface WdkA2APaymentClient {
  /** Signer entries from WDK for all configured chains */
  signers: SignerEntry[]
  /** Handle a 402 payment required response */
  paymentHandler: (req: A2APaymentRequired) => Promise<A2APaymentPayload>
}

/**
 * Find the best matching payment option for the available signers.
 */
function findBestOption(
  accepts: A2APaymentRequired['accepts'],
  signers: SignerEntry[],
  preferredScheme: string,
): A2APaymentRequired['accepts'][0] | undefined {
  const signerNetworks = new Set(signers.map((s) => s.network))

  // Prefer matching both scheme and network
  const exactMatch = accepts.find(
    (a) => a.scheme === preferredScheme && signerNetworks.has(a.network),
  )
  if (exactMatch) return exactMatch

  // Match by network only
  const networkMatch = accepts.find((a) => signerNetworks.has(a.network))
  if (networkMatch) return networkMatch

  // Match by scheme only
  const schemeMatch = accepts.find((a) => a.scheme === preferredScheme)
  if (schemeMatch) return schemeMatch

  return accepts[0]
}

/**
 * Create a WDK-backed A2A payment client.
 *
 * Extracts all configured chain signers from WDK and wraps them for A2A use.
 * The returned `paymentHandler` selects the best signer for the payment
 * requirements, optionally checks balance, and creates a signed payment payload.
 *
 * @param wdk - An initialized T402WDK instance
 * @param options - Configuration options
 * @returns Object with signers and a paymentHandler function
 *
 * @example
 * ```typescript
 * const { signers, paymentHandler } = await createWdkA2APaymentClient(wdk, {
 *   spendingLimit: 10_000_000n, // 10 USDT0
 *   autoBalance: true,
 * });
 *
 * // When the A2A agent receives a 402 response:
 * const payload = await paymentHandler(paymentRequired);
 * // Submit payload back to the A2A server
 * ```
 */
export async function createWdkA2APaymentClient(
  wdk: T402WDK,
  options?: WdkA2AOptions,
): Promise<WdkA2APaymentClient> {
  const preferredScheme = options?.preferredScheme ?? 'exact'

  // Get all signers from WDK
  const signers = await wdk.getAllSigners({ schemes: [preferredScheme] })

  const paymentHandler = async (req: A2APaymentRequired): Promise<A2APaymentPayload> => {
    if (!req.accepts || req.accepts.length === 0) {
      throw new Error('No payment options in requirements')
    }

    // Find the best option
    const selected = findBestOption(req.accepts, signers, preferredScheme)
    if (!selected) {
      throw new Error('No compatible payment option found for available signers')
    }

    // Check spending limit
    if (options?.spendingLimit !== undefined) {
      const amount = BigInt(selected.amount)
      if (amount > options.spendingLimit) {
        throw new Error(`Payment amount ${amount} exceeds spending limit ${options.spendingLimit}`)
      }
    }

    // Request approval if callback provided
    if (options?.onApprovalRequired) {
      const approved = await options.onApprovalRequired({
        amount: BigInt(selected.amount),
        network: selected.network,
      })
      if (!approved) {
        throw new Error('Payment rejected by approval callback')
      }
    }

    // Find the matching signer
    const signerEntry =
      signers.find((s) => s.network === selected.network && s.scheme === selected.scheme) ??
      signers.find((s) => s.network === selected.network)

    if (!signerEntry) {
      throw new Error(`No signer available for network ${selected.network}`)
    }

    // Auto-balance check
    if (options?.autoBalance) {
      const chainName = getChainNameFromNetwork(wdk, selected.network)
      if (chainName) {
        const balance = await wdk.getUsdt0Balance(chainName)
        const requiredAmount = BigInt(selected.amount)
        if (balance < requiredAmount && options.autoBridge) {
          // Try to find a chain with enough balance and bridge
          const best = await wdk.findBestChainForPayment(requiredAmount)
          if (best && best.chain !== chainName) {
            await wdk.bridgeUsdt0({
              fromChain: best.chain,
              toChain: chainName,
              amount: requiredAmount,
            })
          }
        }
      }
    }

    // Sign the payment using the WDK signer
    const signer = signerEntry.signer as {
      signTypedData: (params: Record<string, unknown>) => Promise<string>
      address: string
    }

    // Create EIP-3009 transferWithAuthorization typed data
    const now = Math.floor(Date.now() / 1000)
    const deadline = now + selected.maxTimeoutSeconds
    const nonce =
      '0x' +
      Array.from(globalThis.crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')

    const chainId = parseInt(selected.network.split(':')[1] || '0')

    const signature = await signer.signTypedData({
      domain: {
        name: 'USD₮0',
        version: '1',
        chainId,
        verifyingContract: selected.asset,
      },
      types: {
        TransferWithAuthorization: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'validAfter', type: 'uint256' },
          { name: 'validBefore', type: 'uint256' },
          { name: 'nonce', type: 'bytes32' },
        ],
      },
      primaryType: 'TransferWithAuthorization',
      message: {
        from: signer.address,
        to: selected.payTo,
        value: BigInt(selected.amount),
        validAfter: 0n,
        validBefore: BigInt(deadline),
        nonce,
      },
    })

    return {
      t402Version: req.t402Version,
      resource: req.resource,
      accepted: selected,
      payload: {
        signature,
        from: signer.address,
        validAfter: '0',
        validBefore: deadline.toString(),
        nonce,
      },
    }
  }

  return { signers, paymentHandler }
}

/**
 * Get chain name from CAIP-2 network identifier.
 */
function getChainNameFromNetwork(wdk: T402WDK, network: string): string | undefined {
  for (const chain of wdk.getConfiguredChains()) {
    const config = wdk.getChainConfig(chain)
    if (config && config.network === network) {
      return chain
    }
  }
  return undefined
}
