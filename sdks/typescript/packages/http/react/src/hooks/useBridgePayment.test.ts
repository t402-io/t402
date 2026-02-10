import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBridgePayment } from './useBridgePayment'

function mockBridgeResult(overrides: Record<string, unknown> = {}) {
  return {
    txHash: '0xsrc123',
    messageGuid: 'guid-abc',
    fromChain: 'ethereum',
    toChain: 'arbitrum',
    amountSent: 1000000n,
    waitForDelivery: vi.fn().mockResolvedValue({
      success: true,
      status: 'DELIVERED',
      dstTxHash: '0xdst789',
    }),
    ...overrides,
  }
}

describe('useBridgePayment', () => {
  const bridgeParams = {
    fromChain: 'ethereum',
    toChain: 'arbitrum',
    amount: 1000000n,
    recipient: '0xrecipient',
  }

  const autoBridgeParams = {
    toChain: 'arbitrum',
    amount: 1000000n,
    recipient: '0xrecipient',
  }

  it('starts with idle state', () => {
    const bridgeFn = vi.fn()
    const { result } = renderHook(() => useBridgePayment({ bridgeFn }))

    expect(result.current.status).toBe('idle')
    expect(result.current.txHash).toBeNull()
    expect(result.current.messageGuid).toBeNull()
    expect(result.current.dstTxHash).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isSuccess).toBe(false)
    expect(result.current.isError).toBe(false)
  })

  it('bridge succeeds without autoWaitForDelivery', async () => {
    const bridgeFn = vi.fn().mockResolvedValue(mockBridgeResult())
    const onSuccess = vi.fn()

    const { result } = renderHook(() =>
      useBridgePayment({ bridgeFn, onSuccess, autoWaitForDelivery: false }),
    )

    await act(async () => {
      await result.current.bridge(bridgeParams)
    })

    expect(bridgeFn).toHaveBeenCalledWith(bridgeParams)
    expect(result.current.status).toBe('success')
    expect(result.current.txHash).toBe('0xsrc123')
    expect(result.current.messageGuid).toBe('guid-abc')
    expect(result.current.dstTxHash).toBeNull()
    expect(result.current.isSuccess).toBe(true)
    expect(onSuccess).toHaveBeenCalledWith({
      txHash: '0xsrc123',
      fromChain: 'ethereum',
      toChain: 'arbitrum',
    })
  })

  it('autoBridge succeeds with autoBridgeFn', async () => {
    const bridgeFn = vi.fn()
    const autoBridgeFn = vi.fn().mockResolvedValue(mockBridgeResult())
    const onSuccess = vi.fn()

    const { result } = renderHook(() => useBridgePayment({ bridgeFn, autoBridgeFn, onSuccess }))

    await act(async () => {
      await result.current.autoBridge(autoBridgeParams)
    })

    expect(autoBridgeFn).toHaveBeenCalledWith(autoBridgeParams)
    expect(bridgeFn).not.toHaveBeenCalled()
    expect(result.current.status).toBe('success')
    expect(onSuccess).toHaveBeenCalled()
  })

  it('autoBridge throws without autoBridgeFn', async () => {
    const bridgeFn = vi.fn()
    const onError = vi.fn()

    const { result } = renderHook(() => useBridgePayment({ bridgeFn, onError }))

    await act(async () => {
      await result.current.autoBridge(autoBridgeParams)
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('autoBridgeFn not provided')
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'autoBridgeFn not provided' }),
    )
  })

  it('autoWaitForDelivery=true waits and sets dstTxHash', async () => {
    const waitForDelivery = vi.fn().mockResolvedValue({
      success: true,
      status: 'DELIVERED',
      dstTxHash: '0xdst789',
    })
    const bridgeFn = vi.fn().mockResolvedValue(mockBridgeResult({ waitForDelivery }))
    const onSuccess = vi.fn()

    const { result } = renderHook(() =>
      useBridgePayment({ bridgeFn, onSuccess, autoWaitForDelivery: true }),
    )

    await act(async () => {
      await result.current.bridge(bridgeParams)
    })

    expect(waitForDelivery).toHaveBeenCalled()
    expect(result.current.status).toBe('success')
    expect(result.current.dstTxHash).toBe('0xdst789')
    expect(onSuccess).toHaveBeenCalledWith({
      txHash: '0xsrc123',
      dstTxHash: '0xdst789',
      fromChain: 'ethereum',
      toChain: 'arbitrum',
    })
  })

  it('autoWaitForDelivery=false does not call waitForDelivery', async () => {
    const waitForDelivery = vi.fn()
    const bridgeFn = vi.fn().mockResolvedValue(mockBridgeResult({ waitForDelivery }))

    const { result } = renderHook(() => useBridgePayment({ bridgeFn, autoWaitForDelivery: false }))

    await act(async () => {
      await result.current.bridge(bridgeParams)
    })

    expect(waitForDelivery).not.toHaveBeenCalled()
    expect(result.current.dstTxHash).toBeNull()
  })

  it('handles bridgeFn rejection', async () => {
    const bridgeFn = vi.fn().mockRejectedValue(new Error('Insufficient balance'))
    const onError = vi.fn()

    const { result } = renderHook(() => useBridgePayment({ bridgeFn, onError }))

    await act(async () => {
      await result.current.bridge(bridgeParams)
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('Insufficient balance')
    expect(result.current.isError).toBe(true)
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Insufficient balance' }),
    )
  })

  it('isLoading is true for bridging and waiting statuses', async () => {
    let resolveBridge: (value: unknown) => void
    const bridgePromise = new Promise((resolve) => {
      resolveBridge = resolve
    })
    const bridgeFn = vi.fn().mockReturnValue(bridgePromise)

    const { result } = renderHook(() => useBridgePayment({ bridgeFn }))

    act(() => {
      result.current.bridge(bridgeParams)
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.status).toBe('bridging')

    await act(async () => {
      resolveBridge!(mockBridgeResult())
    })

    expect(result.current.isLoading).toBe(false)
  })

  it('handles waitForDelivery rejection', async () => {
    const waitForDelivery = vi.fn().mockRejectedValue(new Error('Delivery timeout'))
    const bridgeFn = vi.fn().mockResolvedValue(mockBridgeResult({ waitForDelivery }))
    const onError = vi.fn()

    const { result } = renderHook(() =>
      useBridgePayment({ bridgeFn, onError, autoWaitForDelivery: true }),
    )

    await act(async () => {
      await result.current.bridge(bridgeParams)
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('Delivery timeout')
    expect(onError).toHaveBeenCalled()
  })

  it('resets all state', async () => {
    const bridgeFn = vi.fn().mockResolvedValue(mockBridgeResult())

    const { result } = renderHook(() => useBridgePayment({ bridgeFn, autoWaitForDelivery: true }))

    await act(async () => {
      await result.current.bridge(bridgeParams)
    })

    expect(result.current.status).toBe('success')

    act(() => {
      result.current.reset()
    })

    expect(result.current.status).toBe('idle')
    expect(result.current.txHash).toBeNull()
    expect(result.current.messageGuid).toBeNull()
    expect(result.current.dstTxHash).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isSuccess).toBe(false)
  })

  it('onSuccess receives correct chain info', async () => {
    const customResult = mockBridgeResult({
      fromChain: 'base',
      toChain: 'optimism',
      txHash: '0xbase123',
    })
    const bridgeFn = vi.fn().mockResolvedValue(customResult)
    const onSuccess = vi.fn()

    const { result } = renderHook(() =>
      useBridgePayment({ bridgeFn, onSuccess, autoWaitForDelivery: false }),
    )

    await act(async () => {
      await result.current.bridge({
        ...bridgeParams,
        fromChain: 'base',
        toChain: 'optimism',
      })
    })

    expect(onSuccess).toHaveBeenCalledWith({
      txHash: '0xbase123',
      fromChain: 'base',
      toChain: 'optimism',
    })
  })
})
