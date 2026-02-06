import { describe, it, expect, vi } from 'vitest'
import { useBridgePayment } from './useBridgePayment'

const bridgeParams = {
  fromChain: 'eip155:1',
  toChain: 'eip155:42161',
  amount: 100_000000n,
  recipient: '0xrecipient',
}

const autoBridgeParams = {
  toChain: 'eip155:42161',
  amount: 100_000000n,
  recipient: '0xrecipient',
}

function createMockBridgeResult(overrides?: { dstTxHash?: string }) {
  const deliveryResult = {
    success: true,
    status: 'DELIVERED',
    dstTxHash: overrides?.dstTxHash ?? '0xdst123',
  }
  const waitForDelivery = vi.fn().mockResolvedValue(deliveryResult)
  return {
    result: {
      txHash: '0xsrc456',
      messageGuid: 'guid-abc',
      fromChain: 'eip155:1',
      toChain: 'eip155:42161',
      amountSent: 100_000000n,
      waitForDelivery,
    },
    waitForDelivery,
    deliveryResult,
  }
}

describe('useBridgePayment', () => {
  it('starts with idle state', () => {
    const bridgeFn = vi.fn()
    const { status, txHash, messageGuid, dstTxHash, error, isLoading, isSuccess, isError } =
      useBridgePayment({ bridgeFn })

    expect(status.value).toBe('idle')
    expect(txHash.value).toBeNull()
    expect(messageGuid.value).toBeNull()
    expect(dstTxHash.value).toBeNull()
    expect(error.value).toBeNull()
    expect(isLoading.value).toBe(false)
    expect(isSuccess.value).toBe(false)
    expect(isError.value).toBe(false)
  })

  it('bridges successfully', async () => {
    const { result, waitForDelivery } = createMockBridgeResult()
    const bridgeFn = vi.fn().mockResolvedValue(result)
    const onSuccess = vi.fn()
    const { bridge, status, txHash, messageGuid } = useBridgePayment({
      bridgeFn,
      onSuccess,
    })

    await bridge(bridgeParams)

    expect(bridgeFn).toHaveBeenCalledWith(bridgeParams)
    expect(waitForDelivery).not.toHaveBeenCalled()
    expect(status.value).toBe('success')
    expect(txHash.value).toBe('0xsrc456')
    expect(messageGuid.value).toBe('guid-abc')
    expect(onSuccess).toHaveBeenCalledWith({
      txHash: '0xsrc456',
      fromChain: 'eip155:1',
      toChain: 'eip155:42161',
    })
  })

  it('auto-bridges with autoBridgeFn', async () => {
    const { result } = createMockBridgeResult()
    const bridgeFn = vi.fn()
    const autoBridgeFn = vi.fn().mockResolvedValue(result)
    const { autoBridge, status } = useBridgePayment({ bridgeFn, autoBridgeFn })

    await autoBridge(autoBridgeParams)

    expect(autoBridgeFn).toHaveBeenCalledWith(autoBridgeParams)
    expect(bridgeFn).not.toHaveBeenCalled()
    expect(status.value).toBe('success')
  })

  it('errors when autoBridge called without autoBridgeFn', async () => {
    const bridgeFn = vi.fn()
    const onError = vi.fn()
    const { autoBridge, status, error } = useBridgePayment({ bridgeFn, onError })

    await autoBridge(autoBridgeParams)

    expect(status.value).toBe('error')
    expect(error.value).toBe('autoBridgeFn not provided')
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'autoBridgeFn not provided' }),
    )
  })

  it('waits for delivery with autoWaitForDelivery=true', async () => {
    const { result, waitForDelivery } = createMockBridgeResult()
    const bridgeFn = vi.fn().mockResolvedValue(result)
    const onSuccess = vi.fn()
    const { bridge, status, dstTxHash } = useBridgePayment({
      bridgeFn,
      onSuccess,
      autoWaitForDelivery: true,
    })

    await bridge(bridgeParams)

    expect(waitForDelivery).toHaveBeenCalled()
    expect(status.value).toBe('success')
    expect(dstTxHash.value).toBe('0xdst123')
    expect(onSuccess).toHaveBeenCalledWith({
      txHash: '0xsrc456',
      dstTxHash: '0xdst123',
      fromChain: 'eip155:1',
      toChain: 'eip155:42161',
    })
  })

  it('does not wait for delivery with autoWaitForDelivery=false', async () => {
    const { result, waitForDelivery } = createMockBridgeResult()
    const bridgeFn = vi.fn().mockResolvedValue(result)
    const { bridge, status, dstTxHash } = useBridgePayment({
      bridgeFn,
      autoWaitForDelivery: false,
    })

    await bridge(bridgeParams)

    expect(waitForDelivery).not.toHaveBeenCalled()
    expect(status.value).toBe('success')
    expect(dstTxHash.value).toBeNull()
  })

  it('handles bridge error', async () => {
    const bridgeFn = vi.fn().mockRejectedValue(new Error('Insufficient balance'))
    const onError = vi.fn()
    const { bridge, status, error, isError } = useBridgePayment({ bridgeFn, onError })

    await bridge(bridgeParams)

    expect(status.value).toBe('error')
    expect(isError.value).toBe(true)
    expect(error.value).toBe('Insufficient balance')
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Insufficient balance' }),
    )
  })

  it('computes isLoading for bridging and waiting states', async () => {
    let resolveBridge: (value: unknown) => void
    const bridgeFn = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveBridge = resolve
      }),
    )
    const { bridge, isLoading, status } = useBridgePayment({ bridgeFn })

    const promise = bridge(bridgeParams)
    expect(isLoading.value).toBe(true)
    expect(status.value).toBe('bridging')

    const { result } = createMockBridgeResult()
    resolveBridge!(result)
    await promise

    expect(isLoading.value).toBe(false)
  })

  it('handles delivery wait failure', async () => {
    const waitForDelivery = vi.fn().mockRejectedValue(new Error('Delivery timeout'))
    const bridgeFn = vi.fn().mockResolvedValue({
      txHash: '0xsrc',
      messageGuid: 'guid',
      fromChain: 'eip155:1',
      toChain: 'eip155:42161',
      amountSent: 100n,
      waitForDelivery,
    })
    const onError = vi.fn()
    const { bridge, status, error } = useBridgePayment({
      bridgeFn,
      onError,
      autoWaitForDelivery: true,
    })

    await bridge(bridgeParams)

    expect(status.value).toBe('error')
    expect(error.value).toBe('Delivery timeout')
    expect(onError).toHaveBeenCalled()
  })

  it('resets state', async () => {
    const { result } = createMockBridgeResult()
    const bridgeFn = vi.fn().mockResolvedValue(result)
    const { bridge, reset, status, txHash, messageGuid, dstTxHash, error } = useBridgePayment({
      bridgeFn,
    })

    await bridge(bridgeParams)
    expect(status.value).toBe('success')

    reset()
    expect(status.value).toBe('idle')
    expect(txHash.value).toBeNull()
    expect(messageGuid.value).toBeNull()
    expect(dstTxHash.value).toBeNull()
    expect(error.value).toBeNull()
  })

  it('calls onSuccess and onError callbacks correctly', async () => {
    const onSuccess = vi.fn()
    const onError = vi.fn()
    const { result } = createMockBridgeResult()
    const bridgeFn = vi.fn().mockResolvedValue(result)
    const { bridge } = useBridgePayment({ bridgeFn, onSuccess, onError })

    await bridge(bridgeParams)
    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(onError).not.toHaveBeenCalled()
  })
})
