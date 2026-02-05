import { ref, computed, type Ref, type ComputedRef } from 'vue'
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

interface GaslessPaymentReturn {
  /** Execute a gasless payment */
  pay: (params: { to: string; amount: bigint; token?: string }) => Promise<void>
  /** Current payment status */
  status: Ref<PaymentStatus>
  /** UserOperation hash after submission */
  userOpHash: Ref<string | null>
  /** Transaction hash after confirmation */
  txHash: Ref<string | null>
  /** Whether gas was sponsored */
  sponsored: Ref<boolean | null>
  /** Error message if failed */
  error: Ref<string | null>
  /** Whether payment is in progress */
  isLoading: ComputedRef<boolean>
  /** Whether payment succeeded */
  isSuccess: ComputedRef<boolean>
  /** Whether payment failed */
  isError: ComputedRef<boolean>
  /** Reset state */
  reset: () => void
}

/**
 * Composable for gasless ERC-4337 payments via WDK.
 *
 * @param options - Configuration including the gasless payment function and callbacks.
 * @returns State and methods for managing gasless payments.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useGaslessPayment } from "@t402/vue";
 *
 * const { pay, isLoading, isSuccess, txHash, sponsored, error } = useGaslessPayment({
 *   payFn: (params) => gaslessClient.pay(params),
 *   onSuccess: (receipt) => console.log("Confirmed:", receipt.txHash),
 *   autoWait: true,
 * });
 * </script>
 *
 * <template>
 *   <button @click="pay({ to: '0x...', amount: 1000000n })" :disabled="isLoading">
 *     {{ isLoading ? "Processing..." : "Pay Gasless" }}
 *   </button>
 * </template>
 * ```
 */
export function useGaslessPayment(options: GaslessPaymentOptions): GaslessPaymentReturn {
  const { payFn, onSuccess, onError, autoWait = true } = options

  const status = ref<PaymentStatus>('idle')
  const userOpHash = ref<string | null>(null)
  const txHash = ref<string | null>(null)
  const sponsored = ref<boolean | null>(null)
  const error = ref<string | null>(null)

  const isLoading = computed(() => status.value === 'loading')
  const isSuccess = computed(() => status.value === 'success')
  const isError = computed(() => status.value === 'error')

  const pay = async (params: { to: string; amount: bigint; token?: string }) => {
    status.value = 'loading'
    error.value = null
    userOpHash.value = null
    txHash.value = null
    sponsored.value = null

    try {
      const result = await payFn(params)
      userOpHash.value = result.userOpHash
      sponsored.value = result.sponsored

      if (autoWait) {
        const receipt = await result.wait()
        txHash.value = receipt.txHash
        status.value = 'success'
        onSuccess?.(receipt)
      } else {
        status.value = 'success'
        onSuccess?.({ txHash: result.userOpHash, success: true })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Gasless payment failed'
      error.value = errorMessage
      status.value = 'error'
      onError?.(err instanceof Error ? err : new Error(errorMessage))
    }
  }

  const reset = () => {
    status.value = 'idle'
    userOpHash.value = null
    txHash.value = null
    sponsored.value = null
    error.value = null
  }

  return {
    pay,
    status,
    userOpHash,
    txHash,
    sponsored,
    error,
    isLoading,
    isSuccess,
    isError,
    reset,
  }
}
