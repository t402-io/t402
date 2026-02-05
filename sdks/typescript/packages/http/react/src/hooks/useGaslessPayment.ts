import { useState, useCallback, useRef } from 'react'
import type { PaymentStatus } from '../types/index.js'

interface GaslessPaymentOptions {
  /** Gasless payment function */
  payFn: (params: { to: string; amount: bigint; token?: string }) => Promise<{
    userOpHash: string
    sender: string
    sponsored: boolean
    wait: () => Promise<{ txHash: string; success: boolean }>
  }>
  /** Callback on successful payment confirmation */
  onSuccess?: (receipt: { txHash: string; success: boolean }) => void
  /** Callback on payment error */
  onError?: (error: Error) => void
  /** Whether to automatically wait for receipt after submission */
  autoWait?: boolean
}

interface GaslessPaymentResult {
  /** Execute a gasless payment */
  pay: (params: { to: string; amount: bigint; token?: string }) => Promise<void>
  /** Current payment status */
  status: PaymentStatus
  /** UserOperation hash after submission */
  userOpHash: string | null
  /** Transaction hash after confirmation */
  txHash: string | null
  /** Whether gas was sponsored */
  sponsored: boolean | null
  /** Error message if failed */
  error: string | null
  /** Whether payment is in progress */
  isLoading: boolean
  /** Whether payment succeeded */
  isSuccess: boolean
  /** Whether payment failed */
  isError: boolean
  /** Reset state */
  reset: () => void
}

/**
 * Hook for gasless ERC-4337 payments via WDK.
 *
 * @param options - Configuration including the gasless payment function and callbacks.
 * @returns State and methods for managing gasless payments.
 *
 * @example
 * ```tsx
 * import { useGaslessPayment } from "@t402/react";
 *
 * function GaslessPayButton({ client }) {
 *   const { pay, isLoading, isSuccess, txHash, sponsored, error } = useGaslessPayment({
 *     payFn: (params) => client.pay(params),
 *     onSuccess: (receipt) => console.log("Confirmed:", receipt.txHash),
 *     autoWait: true,
 *   });
 *
 *   return (
 *     <button onClick={() => pay({ to: "0x...", amount: 1000000n })} disabled={isLoading}>
 *       {isLoading ? "Processing..." : "Pay Gasless"}
 *     </button>
 *   );
 * }
 * ```
 */
export function useGaslessPayment(options: GaslessPaymentOptions): GaslessPaymentResult {
  const { payFn, onSuccess, onError, autoWait = true } = options

  const [status, setStatus] = useState<PaymentStatus>('idle')
  const [userOpHash, setUserOpHash] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [sponsored, setSponsored] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isMountedRef = useRef(true)

  const pay = useCallback(
    async (params: { to: string; amount: bigint; token?: string }) => {
      setStatus('loading')
      setError(null)
      setUserOpHash(null)
      setTxHash(null)
      setSponsored(null)

      try {
        const result = await payFn(params)

        if (isMountedRef.current) {
          setUserOpHash(result.userOpHash)
          setSponsored(result.sponsored)
        }

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
        const errorMessage = err instanceof Error ? err.message : 'Gasless payment failed'

        if (isMountedRef.current) {
          setError(errorMessage)
          setStatus('error')
        }

        onError?.(err instanceof Error ? err : new Error(errorMessage))
      }
    },
    [payFn, onSuccess, onError, autoWait],
  )

  const reset = useCallback(() => {
    setStatus('idle')
    setUserOpHash(null)
    setTxHash(null)
    setSponsored(null)
    setError(null)
  }, [])

  return {
    pay,
    status,
    userOpHash,
    txHash,
    sponsored,
    error,
    isLoading: status === 'loading',
    isSuccess: status === 'success',
    isError: status === 'error',
    reset,
  }
}
