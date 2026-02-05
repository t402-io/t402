import { useState, useCallback, useRef } from 'react'

type MultiSigStatus = 'idle' | 'initiating' | 'collecting' | 'submitting' | 'success' | 'error'

interface MultiSigPaymentOptions {
  /** Initiate a multi-sig payment requiring threshold signatures */
  initiateFn: (params: { to: string; amount: bigint; token?: string }) => Promise<{
    requestId: string
    userOpHash: string
    threshold: number
    collectedCount: number
    isReady: boolean
  }>
  /** Submit the transaction after collecting enough signatures */
  submitFn: (requestId: string) => Promise<{
    userOpHash: string
    wait: () => Promise<{ txHash: string; success: boolean }>
  }>
  /** Callback on successful submission and confirmation */
  onSuccess?: (receipt: { txHash: string; success: boolean }) => void
  /** Callback on error */
  onError?: (error: Error) => void
  /** Whether to automatically wait for receipt after submission */
  autoWait?: boolean
}

interface MultiSigPaymentResult {
  /** Initiate a multi-sig payment */
  initiate: (params: { to: string; amount: bigint; token?: string }) => Promise<void>
  /** Submit the transaction (when enough signatures are collected) */
  submit: () => Promise<void>
  /** Current status */
  status: MultiSigStatus
  /** Active request ID */
  requestId: string | null
  /** UserOperation hash */
  userOpHash: string | null
  /** Transaction hash after confirmation */
  txHash: string | null
  /** Required signature threshold */
  threshold: number
  /** Number of collected signatures */
  collectedCount: number
  /** Whether enough signatures are collected */
  isReady: boolean
  /** Error message if failed */
  error: string | null
  /** Whether operation is in progress */
  isLoading: boolean
  /** Whether operation succeeded */
  isSuccess: boolean
  /** Whether operation failed */
  isError: boolean
  /** Reset state */
  reset: () => void
}

/**
 * Hook for multi-sig Safe payments via WDK.
 *
 * @param options - Configuration including initiate/submit functions and callbacks.
 * @returns State and methods for managing multi-sig payment lifecycle.
 *
 * @example
 * ```tsx
 * import { useMultiSigPayment } from "@t402/react";
 *
 * function MultiSigPayButton({ multiSigClient }) {
 *   const { initiate, submit, status, isReady, threshold, collectedCount, error } =
 *     useMultiSigPayment({
 *       initiateFn: (params) => multiSigClient.initiatePayment(params),
 *       submitFn: (requestId) => multiSigClient.submitRequest(requestId),
 *       onSuccess: (receipt) => console.log("Confirmed:", receipt.txHash),
 *       autoWait: true,
 *     });
 *
 *   return (
 *     <div>
 *       {status === "idle" && (
 *         <button onClick={() => initiate({ to: "0x...", amount: 1000000n })}>
 *           Initiate Payment
 *         </button>
 *       )}
 *       {status === "collecting" && (
 *         <p>Collecting signatures: {collectedCount}/{threshold}</p>
 *       )}
 *       {isReady && <button onClick={submit}>Submit Transaction</button>}
 *       {error && <p>Error: {error}</p>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useMultiSigPayment(options: MultiSigPaymentOptions): MultiSigPaymentResult {
  const { initiateFn, submitFn, onSuccess, onError, autoWait = true } = options

  const [status, setStatus] = useState<MultiSigStatus>('idle')
  const [requestId, setRequestId] = useState<string | null>(null)
  const [userOpHash, setUserOpHash] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [threshold, setThreshold] = useState(0)
  const [collectedCount, setCollectedCount] = useState(0)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isMountedRef = useRef(true)

  const initiate = useCallback(
    async (params: { to: string; amount: bigint; token?: string }) => {
      setStatus('initiating')
      setError(null)
      setRequestId(null)
      setUserOpHash(null)
      setTxHash(null)

      try {
        const result = await initiateFn(params)

        if (isMountedRef.current) {
          setRequestId(result.requestId)
          setUserOpHash(result.userOpHash)
          setThreshold(result.threshold)
          setCollectedCount(result.collectedCount)
          setIsReady(result.isReady)
          setStatus('collecting')
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to initiate multi-sig payment'

        if (isMountedRef.current) {
          setError(errorMessage)
          setStatus('error')
        }

        onError?.(err instanceof Error ? err : new Error(errorMessage))
      }
    },
    [initiateFn, onError],
  )

  const submit = useCallback(async () => {
    if (!requestId) {
      const err = new Error('No active request to submit')
      setError(err.message)
      setStatus('error')
      onError?.(err)
      return
    }

    setStatus('submitting')
    setError(null)

    try {
      const result = await submitFn(requestId)

      if (autoWait) {
        const receipt = await result.wait()

        if (isMountedRef.current) {
          setTxHash(receipt.txHash)
          setStatus('success')
          onSuccess?.(receipt)
        }
      } else {
        if (isMountedRef.current) {
          setStatus('success')
          onSuccess?.({ txHash: result.userOpHash, success: true })
        }
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to submit multi-sig transaction'

      if (isMountedRef.current) {
        setError(errorMessage)
        setStatus('error')
      }

      onError?.(err instanceof Error ? err : new Error(errorMessage))
    }
  }, [requestId, submitFn, onSuccess, onError, autoWait])

  const reset = useCallback(() => {
    setStatus('idle')
    setRequestId(null)
    setUserOpHash(null)
    setTxHash(null)
    setThreshold(0)
    setCollectedCount(0)
    setIsReady(false)
    setError(null)
  }, [])

  return {
    initiate,
    submit,
    status,
    requestId,
    userOpHash,
    txHash,
    threshold,
    collectedCount,
    isReady,
    error,
    isLoading: status === 'initiating' || status === 'submitting',
    isSuccess: status === 'success',
    isError: status === 'error',
    reset,
  }
}
