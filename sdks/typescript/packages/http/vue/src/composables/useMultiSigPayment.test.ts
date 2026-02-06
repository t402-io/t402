import { describe, it, expect, vi } from 'vitest'
import { useMultiSigPayment } from './useMultiSigPayment'

const initiateParams = { to: '0xrecipient', amount: 1000000n }

function createMockInitiateResult(overrides?: { isReady?: boolean }) {
  return {
    requestId: 'req-123',
    userOpHash: '0xop1',
    threshold: 3,
    collectedCount: 1,
    isReady: overrides?.isReady ?? false,
  }
}

function createMockSubmitResult() {
  const waitFn = vi.fn().mockResolvedValue({ txHash: '0xtx1', success: true })
  return {
    result: { userOpHash: '0xop-submit', wait: waitFn },
    waitFn,
  }
}

describe('useMultiSigPayment', () => {
  it('starts with idle state', () => {
    const initiateFn = vi.fn()
    const submitFn = vi.fn()
    const {
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
    } = useMultiSigPayment({ initiateFn, submitFn })

    expect(status.value).toBe('idle')
    expect(requestId.value).toBeNull()
    expect(userOpHash.value).toBeNull()
    expect(txHash.value).toBeNull()
    expect(threshold.value).toBe(0)
    expect(collectedCount.value).toBe(0)
    expect(isReady.value).toBe(false)
    expect(error.value).toBeNull()
    expect(isLoading.value).toBe(false)
    expect(isSuccess.value).toBe(false)
    expect(isError.value).toBe(false)
  })

  it('transitions to collecting state after initiate', async () => {
    const initiateFn = vi.fn().mockResolvedValue(createMockInitiateResult())
    const submitFn = vi.fn()
    const { initiate, status, requestId, threshold, collectedCount, isReady } =
      useMultiSigPayment({ initiateFn, submitFn })

    await initiate(initiateParams)

    expect(initiateFn).toHaveBeenCalledWith(initiateParams)
    expect(status.value).toBe('collecting')
    expect(requestId.value).toBe('req-123')
    expect(threshold.value).toBe(3)
    expect(collectedCount.value).toBe(1)
    expect(isReady.value).toBe(false)
  })

  it('submits with autoWait=true', async () => {
    const initiateFn = vi.fn().mockResolvedValue(createMockInitiateResult({ isReady: true }))
    const { result: submitResult, waitFn } = createMockSubmitResult()
    const submitFn = vi.fn().mockResolvedValue(submitResult)
    const onSuccess = vi.fn()
    const { initiate, submit, status, txHash } = useMultiSigPayment({
      initiateFn,
      submitFn,
      onSuccess,
      autoWait: true,
    })

    await initiate(initiateParams)
    await submit()

    expect(submitFn).toHaveBeenCalledWith('req-123')
    expect(waitFn).toHaveBeenCalled()
    expect(status.value).toBe('success')
    expect(txHash.value).toBe('0xtx1')
    expect(onSuccess).toHaveBeenCalledWith({ txHash: '0xtx1', success: true })
  })

  it('submits with autoWait=false', async () => {
    const initiateFn = vi.fn().mockResolvedValue(createMockInitiateResult({ isReady: true }))
    const { result: submitResult, waitFn } = createMockSubmitResult()
    const submitFn = vi.fn().mockResolvedValue(submitResult)
    const onSuccess = vi.fn()
    const { initiate, submit, status, txHash } = useMultiSigPayment({
      initiateFn,
      submitFn,
      onSuccess,
      autoWait: false,
    })

    await initiate(initiateParams)
    await submit()

    expect(waitFn).not.toHaveBeenCalled()
    expect(status.value).toBe('success')
    expect(txHash.value).toBeNull()
    expect(onSuccess).toHaveBeenCalledWith({ txHash: '0xop-submit', success: true })
  })

  it('errors when submit called without initiate', async () => {
    const initiateFn = vi.fn()
    const submitFn = vi.fn()
    const onError = vi.fn()
    const { submit, status, error } = useMultiSigPayment({ initiateFn, submitFn, onError })

    await submit()

    expect(status.value).toBe('error')
    expect(error.value).toBe('No active request to submit')
    expect(submitFn).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'No active request to submit' }),
    )
  })

  it('handles error during initiate', async () => {
    const initiateFn = vi.fn().mockRejectedValue(new Error('Safe not deployed'))
    const submitFn = vi.fn()
    const onError = vi.fn()
    const { initiate, status, error, isError } = useMultiSigPayment({
      initiateFn,
      submitFn,
      onError,
    })

    await initiate(initiateParams)

    expect(status.value).toBe('error')
    expect(isError.value).toBe(true)
    expect(error.value).toBe('Safe not deployed')
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Safe not deployed' }),
    )
  })

  it('handles error during submit', async () => {
    const initiateFn = vi.fn().mockResolvedValue(createMockInitiateResult())
    const submitFn = vi.fn().mockRejectedValue(new Error('Execution reverted'))
    const onError = vi.fn()
    const { initiate, submit, status, error } = useMultiSigPayment({
      initiateFn,
      submitFn,
      onError,
    })

    await initiate(initiateParams)
    await submit()

    expect(status.value).toBe('error')
    expect(error.value).toBe('Execution reverted')
    expect(onError).toHaveBeenCalled()
  })

  it('computes isLoading for initiating and submitting states', async () => {
    let resolveInitiate: (value: unknown) => void
    const initiateFn = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveInitiate = resolve
      }),
    )
    const submitFn = vi.fn()
    const { initiate, isLoading, status } = useMultiSigPayment({ initiateFn, submitFn })

    const promise = initiate(initiateParams)
    expect(isLoading.value).toBe(true)
    expect(status.value).toBe('initiating')

    resolveInitiate!(createMockInitiateResult())
    await promise

    expect(isLoading.value).toBe(false)
    expect(status.value).toBe('collecting')
  })

  it('tracks isReady from initiate result', async () => {
    const initiateFn = vi.fn().mockResolvedValue(createMockInitiateResult({ isReady: true }))
    const submitFn = vi.fn()
    const { initiate, isReady, threshold, collectedCount } = useMultiSigPayment({
      initiateFn,
      submitFn,
    })

    await initiate(initiateParams)

    expect(isReady.value).toBe(true)
    expect(threshold.value).toBe(3)
    expect(collectedCount.value).toBe(1)
  })

  it('resets state', async () => {
    const initiateFn = vi.fn().mockResolvedValue(createMockInitiateResult())
    const submitFn = vi.fn()
    const { initiate, reset, status, requestId, threshold, collectedCount, isReady, error } =
      useMultiSigPayment({ initiateFn, submitFn })

    await initiate(initiateParams)
    expect(status.value).toBe('collecting')

    reset()
    expect(status.value).toBe('idle')
    expect(requestId.value).toBeNull()
    expect(threshold.value).toBe(0)
    expect(collectedCount.value).toBe(0)
    expect(isReady.value).toBe(false)
    expect(error.value).toBeNull()
  })

  it('calls onSuccess and onError callbacks correctly', async () => {
    const onSuccess = vi.fn()
    const onError = vi.fn()
    const initiateFn = vi.fn().mockResolvedValue(createMockInitiateResult())
    const { result: submitResult } = createMockSubmitResult()
    const submitFn = vi.fn().mockResolvedValue(submitResult)
    const { initiate, submit } = useMultiSigPayment({
      initiateFn,
      submitFn,
      onSuccess,
      onError,
    })

    await initiate(initiateParams)
    await submit()

    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(onError).not.toHaveBeenCalled()
  })
})
