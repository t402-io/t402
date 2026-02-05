import { ref, computed, type Ref, type ComputedRef } from 'vue'

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

interface MultiSigPaymentReturn {
  /** Initiate a multi-sig payment */
  initiate: (params: { to: string; amount: bigint; token?: string }) => Promise<void>
  /** Submit the transaction (when enough signatures are collected) */
  submit: () => Promise<void>
  /** Current status */
  status: Ref<MultiSigStatus>
  /** Active request ID */
  requestId: Ref<string | null>
  /** UserOperation hash */
  userOpHash: Ref<string | null>
  /** Transaction hash after confirmation */
  txHash: Ref<string | null>
  /** Required signature threshold */
  threshold: Ref<number>
  /** Number of collected signatures */
  collectedCount: Ref<number>
  /** Whether enough signatures are collected */
  isReady: Ref<boolean>
  /** Error message if failed */
  error: Ref<string | null>
  /** Whether operation is in progress */
  isLoading: ComputedRef<boolean>
  /** Whether operation succeeded */
  isSuccess: ComputedRef<boolean>
  /** Whether operation failed */
  isError: ComputedRef<boolean>
  /** Reset state */
  reset: () => void
}

/**
 * Composable for multi-sig Safe payments via WDK.
 *
 * @param options - Configuration including initiate/submit functions and callbacks.
 * @returns State and methods for managing multi-sig payment lifecycle.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useMultiSigPayment } from "@t402/vue";
 *
 * const { initiate, submit, status, isReady, threshold, collectedCount, error } =
 *   useMultiSigPayment({
 *     initiateFn: (params) => multiSigClient.initiatePayment(params),
 *     submitFn: (requestId) => multiSigClient.submitRequest(requestId),
 *     onSuccess: (receipt) => console.log("Confirmed:", receipt.txHash),
 *     autoWait: true,
 *   });
 * </script>
 *
 * <template>
 *   <div>
 *     <button v-if="status === 'idle'" @click="initiate({ to: '0x...', amount: 1000000n })">
 *       Initiate Payment
 *     </button>
 *     <p v-if="status === 'collecting'">Collecting: {{ collectedCount }}/{{ threshold }}</p>
 *     <button v-if="isReady" @click="submit">Submit Transaction</button>
 *     <p v-if="error">Error: {{ error }}</p>
 *   </div>
 * </template>
 * ```
 */
export function useMultiSigPayment(options: MultiSigPaymentOptions): MultiSigPaymentReturn {
  const { initiateFn, submitFn, onSuccess, onError, autoWait = true } = options

  const status = ref<MultiSigStatus>('idle')
  const requestId = ref<string | null>(null)
  const userOpHash = ref<string | null>(null)
  const txHash = ref<string | null>(null)
  const threshold = ref(0)
  const collectedCount = ref(0)
  const isReady = ref(false)
  const error = ref<string | null>(null)

  const isLoading = computed(() => status.value === 'initiating' || status.value === 'submitting')
  const isSuccess = computed(() => status.value === 'success')
  const isError = computed(() => status.value === 'error')

  const initiate = async (params: { to: string; amount: bigint; token?: string }) => {
    status.value = 'initiating'
    error.value = null
    requestId.value = null
    userOpHash.value = null
    txHash.value = null

    try {
      const result = await initiateFn(params)
      requestId.value = result.requestId
      userOpHash.value = result.userOpHash
      threshold.value = result.threshold
      collectedCount.value = result.collectedCount
      isReady.value = result.isReady
      status.value = 'collecting'
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to initiate multi-sig payment'
      error.value = errorMessage
      status.value = 'error'
      onError?.(err instanceof Error ? err : new Error(errorMessage))
    }
  }

  const submit = async () => {
    if (!requestId.value) {
      const err = new Error('No active request to submit')
      error.value = err.message
      status.value = 'error'
      onError?.(err)
      return
    }

    status.value = 'submitting'
    error.value = null

    try {
      const result = await submitFn(requestId.value)

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
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to submit multi-sig transaction'
      error.value = errorMessage
      status.value = 'error'
      onError?.(err instanceof Error ? err : new Error(errorMessage))
    }
  }

  const reset = () => {
    status.value = 'idle'
    requestId.value = null
    userOpHash.value = null
    txHash.value = null
    threshold.value = 0
    collectedCount.value = 0
    isReady.value = false
    error.value = null
  }

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
    isLoading,
    isSuccess,
    isError,
    reset,
  }
}
