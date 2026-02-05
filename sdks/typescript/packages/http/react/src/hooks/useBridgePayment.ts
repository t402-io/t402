import { useState, useCallback, useRef } from 'react'

type BridgeStatus = 'idle' | 'quoting' | 'bridging' | 'waiting' | 'success' | 'error'

interface BridgePaymentOptions {
  /** Bridge function */
  bridgeFn: (params: {
    fromChain: string
    toChain: string
    amount: bigint
    recipient: string
    slippageTolerance?: number
  }) => Promise<{
    txHash: string
    messageGuid: string
    fromChain: string
    toChain: string
    amountSent: bigint
    waitForDelivery: (options?: { timeout?: number }) => Promise<{
      success: boolean
      status: string
      dstTxHash?: string
    }>
  }>
  /** Optional auto-bridge function for automatic source chain selection */
  autoBridgeFn?: (params: {
    toChain: string
    amount: bigint
    recipient: string
    preferredSourceChain?: string
    slippageTolerance?: number
  }) => Promise<{
    txHash: string
    messageGuid: string
    fromChain: string
    toChain: string
    amountSent: bigint
    waitForDelivery: (options?: { timeout?: number }) => Promise<{
      success: boolean
      status: string
      dstTxHash?: string
    }>
  }>
  /** Callback on successful delivery */
  onSuccess?: (result: {
    txHash: string
    dstTxHash?: string
    fromChain: string
    toChain: string
  }) => void
  /** Callback on error */
  onError?: (error: Error) => void
  /** Whether to automatically wait for delivery (default: false) */
  autoWaitForDelivery?: boolean
}

interface BridgePaymentResult {
  /** Execute a bridge from a specific chain */
  bridge: (params: {
    fromChain: string
    toChain: string
    amount: bigint
    recipient: string
    slippageTolerance?: number
  }) => Promise<void>
  /** Execute an auto-bridge with automatic source chain selection */
  autoBridge: (params: {
    toChain: string
    amount: bigint
    recipient: string
    preferredSourceChain?: string
    slippageTolerance?: number
  }) => Promise<void>
  /** Current status */
  status: BridgeStatus
  /** Source chain transaction hash */
  txHash: string | null
  /** LayerZero message GUID */
  messageGuid: string | null
  /** Destination chain transaction hash */
  dstTxHash: string | null
  /** Error message if failed */
  error: string | null
  /** Whether bridge is in progress */
  isLoading: boolean
  /** Whether bridge succeeded */
  isSuccess: boolean
  /** Whether bridge failed */
  isError: boolean
  /** Reset state */
  reset: () => void
}

/**
 * Hook for cross-chain USDT0 bridging via WDK.
 *
 * @param options - Configuration including bridge functions and callbacks.
 * @returns State and methods for managing bridge operations.
 *
 * @example
 * ```tsx
 * import { useBridgePayment } from "@t402/react";
 *
 * function BridgeButton({ bridgeClient }) {
 *   const { autoBridge, isLoading, isSuccess, txHash, error } = useBridgePayment({
 *     bridgeFn: (params) => bridgeClient.bridge(params),
 *     autoBridgeFn: (params) => bridgeClient.autoBridge(params),
 *     onSuccess: (result) => console.log("Bridged:", result),
 *   });
 *
 *   return (
 *     <button
 *       onClick={() => autoBridge({ toChain: "arbitrum", amount: 100_000000n, recipient: "0x..." })}
 *       disabled={isLoading}
 *     >
 *       {isLoading ? "Bridging..." : "Bridge USDT0"}
 *     </button>
 *   );
 * }
 * ```
 */
export function useBridgePayment(options: BridgePaymentOptions): BridgePaymentResult {
  const { bridgeFn, autoBridgeFn, onSuccess, onError, autoWaitForDelivery = false } = options

  const [status, setStatus] = useState<BridgeStatus>('idle')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [messageGuid, setMessageGuid] = useState<string | null>(null)
  const [dstTxHash, setDstTxHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isMountedRef = useRef(true)

  const executeBridge = useCallback(
    async (
      bridgeCall: () => Promise<{
        txHash: string
        messageGuid: string
        fromChain: string
        toChain: string
        amountSent: bigint
        waitForDelivery: (options?: { timeout?: number }) => Promise<{
          success: boolean
          status: string
          dstTxHash?: string
        }>
      }>,
    ) => {
      setStatus('bridging')
      setError(null)
      setTxHash(null)
      setMessageGuid(null)
      setDstTxHash(null)

      try {
        const result = await bridgeCall()

        if (isMountedRef.current) {
          setTxHash(result.txHash)
          setMessageGuid(result.messageGuid)
        }

        if (autoWaitForDelivery) {
          if (isMountedRef.current) setStatus('waiting')

          const delivery = await result.waitForDelivery()

          if (isMountedRef.current) {
            if (delivery.dstTxHash) setDstTxHash(delivery.dstTxHash)
            setStatus('success')
            onSuccess?.({
              txHash: result.txHash,
              dstTxHash: delivery.dstTxHash,
              fromChain: result.fromChain,
              toChain: result.toChain,
            })
          }
        } else {
          if (isMountedRef.current) {
            setStatus('success')
            onSuccess?.({
              txHash: result.txHash,
              fromChain: result.fromChain,
              toChain: result.toChain,
            })
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Bridge operation failed'

        if (isMountedRef.current) {
          setError(errorMessage)
          setStatus('error')
        }

        onError?.(err instanceof Error ? err : new Error(errorMessage))
      }
    },
    [onSuccess, onError, autoWaitForDelivery],
  )

  const bridge = useCallback(
    async (params: {
      fromChain: string
      toChain: string
      amount: bigint
      recipient: string
      slippageTolerance?: number
    }) => {
      await executeBridge(() => bridgeFn(params))
    },
    [bridgeFn, executeBridge],
  )

  const autoBridge = useCallback(
    async (params: {
      toChain: string
      amount: bigint
      recipient: string
      preferredSourceChain?: string
      slippageTolerance?: number
    }) => {
      const fn =
        autoBridgeFn ??
        (() => {
          throw new Error('autoBridgeFn not provided')
        })
      await executeBridge(() => fn(params))
    },
    [autoBridgeFn, executeBridge],
  )

  const reset = useCallback(() => {
    setStatus('idle')
    setTxHash(null)
    setMessageGuid(null)
    setDstTxHash(null)
    setError(null)
  }, [])

  return {
    bridge,
    autoBridge,
    status,
    txHash,
    messageGuid,
    dstTxHash,
    error,
    isLoading: status === 'bridging' || status === 'quoting' || status === 'waiting',
    isSuccess: status === 'success',
    isError: status === 'error',
    reset,
  }
}
