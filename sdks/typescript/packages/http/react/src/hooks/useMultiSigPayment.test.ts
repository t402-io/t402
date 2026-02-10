import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMultiSigPayment } from './useMultiSigPayment'

function mockInitiateResult(overrides: Record<string, unknown> = {}) {
  return {
    requestId: 'req-001',
    userOpHash: '0xop123',
    threshold: 3,
    collectedCount: 1,
    isReady: false,
    ...overrides,
  }
}

function mockSubmitResult(overrides: Record<string, unknown> = {}) {
  return {
    userOpHash: '0xsubmit456',
    wait: vi.fn().mockResolvedValue({ txHash: '0xtx789', success: true }),
    ...overrides,
  }
}

describe('useMultiSigPayment', () => {
  const initiateParams = { to: '0xrecipient', amount: 1000000n }

  function defaultOptions(overrides: Record<string, unknown> = {}) {
    return {
      initiateFn: vi.fn().mockResolvedValue(mockInitiateResult()),
      submitFn: vi.fn().mockResolvedValue(mockSubmitResult()),
      ...overrides,
    }
  }

  it('starts with idle state', () => {
    const { result } = renderHook(() => useMultiSigPayment(defaultOptions()))

    expect(result.current.status).toBe('idle')
    expect(result.current.requestId).toBeNull()
    expect(result.current.userOpHash).toBeNull()
    expect(result.current.txHash).toBeNull()
    expect(result.current.threshold).toBe(0)
    expect(result.current.collectedCount).toBe(0)
    expect(result.current.isReady).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isSuccess).toBe(false)
    expect(result.current.isError).toBe(false)
  })

  it('initiate succeeds and moves to collecting', async () => {
    const initiateFn = vi
      .fn()
      .mockResolvedValue(mockInitiateResult({ threshold: 3, collectedCount: 1, isReady: false }))
    const { result } = renderHook(() => useMultiSigPayment(defaultOptions({ initiateFn })))

    await act(async () => {
      await result.current.initiate(initiateParams)
    })

    expect(initiateFn).toHaveBeenCalledWith(initiateParams)
    expect(result.current.status).toBe('collecting')
    expect(result.current.requestId).toBe('req-001')
    expect(result.current.userOpHash).toBe('0xop123')
    expect(result.current.threshold).toBe(3)
    expect(result.current.collectedCount).toBe(1)
    expect(result.current.isReady).toBe(false)
  })

  it('submit succeeds with autoWait=true', async () => {
    const waitFn = vi.fn().mockResolvedValue({ txHash: '0xtx789', success: true })
    const submitFn = vi.fn().mockResolvedValue(mockSubmitResult({ wait: waitFn }))
    const onSuccess = vi.fn()
    const opts = defaultOptions({ submitFn, onSuccess, autoWait: true })

    const { result } = renderHook(() => useMultiSigPayment(opts))

    // First initiate to get a requestId
    await act(async () => {
      await result.current.initiate(initiateParams)
    })

    expect(result.current.status).toBe('collecting')

    // Now submit
    await act(async () => {
      await result.current.submit()
    })

    expect(submitFn).toHaveBeenCalledWith('req-001')
    expect(waitFn).toHaveBeenCalled()
    expect(result.current.status).toBe('success')
    expect(result.current.txHash).toBe('0xtx789')
    expect(result.current.isSuccess).toBe(true)
    expect(onSuccess).toHaveBeenCalledWith({ txHash: '0xtx789', success: true })
  })

  it('submit succeeds with autoWait=false', async () => {
    const waitFn = vi.fn()
    const submitFn = vi
      .fn()
      .mockResolvedValue(mockSubmitResult({ userOpHash: '0xopSub', wait: waitFn }))
    const onSuccess = vi.fn()
    const opts = defaultOptions({ submitFn, onSuccess, autoWait: false })

    const { result } = renderHook(() => useMultiSigPayment(opts))

    await act(async () => {
      await result.current.initiate(initiateParams)
    })

    await act(async () => {
      await result.current.submit()
    })

    expect(waitFn).not.toHaveBeenCalled()
    expect(result.current.status).toBe('success')
    expect(onSuccess).toHaveBeenCalledWith({ txHash: '0xopSub', success: true })
  })

  it('submit without initiate sets error', async () => {
    const onError = vi.fn()
    const opts = defaultOptions({ onError })

    const { result } = renderHook(() => useMultiSigPayment(opts))

    await act(async () => {
      await result.current.submit()
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('No active request to submit')
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'No active request to submit' }),
    )
  })

  it('handles initiate error', async () => {
    const initiateFn = vi.fn().mockRejectedValue(new Error('Safe not deployed'))
    const onError = vi.fn()
    const opts = defaultOptions({ initiateFn, onError })

    const { result } = renderHook(() => useMultiSigPayment(opts))

    await act(async () => {
      await result.current.initiate(initiateParams)
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('Safe not deployed')
    expect(result.current.isError).toBe(true)
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Safe not deployed' }))
  })

  it('handles submit error', async () => {
    const submitFn = vi.fn().mockRejectedValue(new Error('Execution reverted'))
    const onError = vi.fn()
    const opts = defaultOptions({ submitFn, onError })

    const { result } = renderHook(() => useMultiSigPayment(opts))

    await act(async () => {
      await result.current.initiate(initiateParams)
    })

    await act(async () => {
      await result.current.submit()
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('Execution reverted')
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Execution reverted' }))
  })

  it('isLoading is true for initiating and submitting', async () => {
    let resolveInitiate: (value: unknown) => void
    const initiatePromise = new Promise((resolve) => {
      resolveInitiate = resolve
    })
    const initiateFn = vi.fn().mockReturnValue(initiatePromise)
    const opts = defaultOptions({ initiateFn })

    const { result } = renderHook(() => useMultiSigPayment(opts))

    act(() => {
      result.current.initiate(initiateParams)
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.status).toBe('initiating')

    await act(async () => {
      resolveInitiate!(mockInitiateResult())
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.status).toBe('collecting')
  })

  it('tracks isReady from initiate result', async () => {
    const initiateFn = vi
      .fn()
      .mockResolvedValue(mockInitiateResult({ threshold: 2, collectedCount: 2, isReady: true }))
    const opts = defaultOptions({ initiateFn })

    const { result } = renderHook(() => useMultiSigPayment(opts))

    await act(async () => {
      await result.current.initiate(initiateParams)
    })

    expect(result.current.isReady).toBe(true)
    expect(result.current.threshold).toBe(2)
    expect(result.current.collectedCount).toBe(2)
  })

  it('resets all state', async () => {
    const opts = defaultOptions()

    const { result } = renderHook(() => useMultiSigPayment(opts))

    await act(async () => {
      await result.current.initiate(initiateParams)
    })

    expect(result.current.status).toBe('collecting')

    act(() => {
      result.current.reset()
    })

    expect(result.current.status).toBe('idle')
    expect(result.current.requestId).toBeNull()
    expect(result.current.userOpHash).toBeNull()
    expect(result.current.txHash).toBeNull()
    expect(result.current.threshold).toBe(0)
    expect(result.current.collectedCount).toBe(0)
    expect(result.current.isReady).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isSuccess).toBe(false)
  })

  it('handles non-Error thrown values', async () => {
    const initiateFn = vi.fn().mockRejectedValue('string error')
    const opts = defaultOptions({ initiateFn })

    const { result } = renderHook(() => useMultiSigPayment(opts))

    await act(async () => {
      await result.current.initiate(initiateParams)
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('Failed to initiate multi-sig payment')
  })
})
