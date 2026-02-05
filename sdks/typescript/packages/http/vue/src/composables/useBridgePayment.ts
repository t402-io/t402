import { ref, computed, type Ref, type ComputedRef } from 'vue'

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

interface BridgePaymentReturn {
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
  status: Ref<BridgeStatus>
  /** Source chain transaction hash */
  txHash: Ref<string | null>
  /** LayerZero message GUID */
  messageGuid: Ref<string | null>
  /** Destination chain transaction hash */
  dstTxHash: Ref<string | null>
  /** Error message if failed */
  error: Ref<string | null>
  /** Whether bridge is in progress */
  isLoading: ComputedRef<boolean>
  /** Whether bridge succeeded */
  isSuccess: ComputedRef<boolean>
  /** Whether bridge failed */
  isError: ComputedRef<boolean>
  /** Reset state */
  reset: () => void
}

/**
 * Composable for cross-chain USDT0 bridging via WDK.
 *
 * @param options - Configuration including bridge functions and callbacks.
 * @returns State and methods for managing bridge operations.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useBridgePayment } from "@t402/vue";
 *
 * const { autoBridge, isLoading, isSuccess, txHash, error } = useBridgePayment({
 *   bridgeFn: (params) => bridgeClient.bridge(params),
 *   autoBridgeFn: (params) => bridgeClient.autoBridge(params),
 *   onSuccess: (result) => console.log("Bridged:", result),
 * });
 * </script>
 *
 * <template>
 *   <button
 *     @click="autoBridge({ toChain: 'arbitrum', amount: 100_000000n, recipient: '0x...' })"
 *     :disabled="isLoading"
 *   >
 *     {{ isLoading ? "Bridging..." : "Bridge USDT0" }}
 *   </button>
 * </template>
 * ```
 */
export function useBridgePayment(options: BridgePaymentOptions): BridgePaymentReturn {
  const { bridgeFn, autoBridgeFn, onSuccess, onError, autoWaitForDelivery = false } = options

  const status = ref<BridgeStatus>('idle')
  const txHash = ref<string | null>(null)
  const messageGuid = ref<string | null>(null)
  const dstTxHash = ref<string | null>(null)
  const error = ref<string | null>(null)

  const isLoading = computed(
    () => status.value === 'bridging' || status.value === 'quoting' || status.value === 'waiting',
  )
  const isSuccess = computed(() => status.value === 'success')
  const isError = computed(() => status.value === 'error')

  const executeBridge = async (
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
    status.value = 'bridging'
    error.value = null
    txHash.value = null
    messageGuid.value = null
    dstTxHash.value = null

    try {
      const result = await bridgeCall()
      txHash.value = result.txHash
      messageGuid.value = result.messageGuid

      if (autoWaitForDelivery) {
        status.value = 'waiting'
        const delivery = await result.waitForDelivery()
        if (delivery.dstTxHash) dstTxHash.value = delivery.dstTxHash
        status.value = 'success'
        onSuccess?.({
          txHash: result.txHash,
          dstTxHash: delivery.dstTxHash,
          fromChain: result.fromChain,
          toChain: result.toChain,
        })
      } else {
        status.value = 'success'
        onSuccess?.({
          txHash: result.txHash,
          fromChain: result.fromChain,
          toChain: result.toChain,
        })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Bridge operation failed'
      error.value = errorMessage
      status.value = 'error'
      onError?.(err instanceof Error ? err : new Error(errorMessage))
    }
  }

  const bridge = async (params: {
    fromChain: string
    toChain: string
    amount: bigint
    recipient: string
    slippageTolerance?: number
  }) => {
    await executeBridge(() => bridgeFn(params))
  }

  const autoBridge = async (params: {
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
  }

  const reset = () => {
    status.value = 'idle'
    txHash.value = null
    messageGuid.value = null
    dstTxHash.value = null
    error.value = null
  }

  return {
    bridge,
    autoBridge,
    status,
    txHash,
    messageGuid,
    dstTxHash,
    error,
    isLoading,
    isSuccess,
    isError,
    reset,
  }
}
