import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGaslessPayment } from './useGaslessPayment'

function mockPayFn(overrides: Record<string, unknown> = {}) {
  return vi.fn().mockResolvedValue({
    userOpHash: '0xop123',
    sender: '0xsender',
    sponsored: false,
    wait: vi.fn().mockResolvedValue({ txHash: '0xtx456', success: true }),
    ...overrides,
  })
}

describe('useGaslessPayment', () => {
  const payParams = { to: '0xrecipient', amount: 1000000n }

  it('starts with idle state', () => {
    const { result } = renderHook(() => useGaslessPayment({ payFn: mockPayFn() }))

    expect(result.current.status).toBe('idle')
    expect(result.current.userOpHash).toBeNull()
    expect(result.current.txHash).toBeNull()
    expect(result.current.sponsored).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isSuccess).toBe(false)
    expect(result.current.isError).toBe(false)
  })

  it('succeeds with autoWait=true', async () => {
    const waitFn = vi.fn().mockResolvedValue({ txHash: '0xtx456', success: true })
    const payFn = mockPayFn({ wait: waitFn })
    const onSuccess = vi.fn()

    const { result } = renderHook(() => useGaslessPayment({ payFn, onSuccess, autoWait: true }))

    await act(async () => {
      await result.current.pay(payParams)
    })

    expect(payFn).toHaveBeenCalledWith(payParams)
    expect(waitFn).toHaveBeenCalled()
    expect(result.current.status).toBe('success')
    expect(result.current.txHash).toBe('0xtx456')
    expect(result.current.userOpHash).toBe('0xop123')
    expect(result.current.isSuccess).toBe(true)
    expect(onSuccess).toHaveBeenCalledWith({ txHash: '0xtx456', success: true })
  })

  it('succeeds with autoWait=false (no wait call)', async () => {
    const waitFn = vi.fn()
    const payFn = mockPayFn({ wait: waitFn })
    const onSuccess = vi.fn()

    const { result } = renderHook(() => useGaslessPayment({ payFn, onSuccess, autoWait: false }))

    await act(async () => {
      await result.current.pay(payParams)
    })

    expect(waitFn).not.toHaveBeenCalled()
    expect(result.current.status).toBe('success')
    expect(result.current.userOpHash).toBe('0xop123')
    expect(result.current.txHash).toBeNull()
    expect(onSuccess).toHaveBeenCalledWith({ txHash: '0xop123', success: true })
  })

  it('handles payFn rejection', async () => {
    const payFn = vi.fn().mockRejectedValue(new Error('Bundler unavailable'))
    const onError = vi.fn()

    const { result } = renderHook(() => useGaslessPayment({ payFn, onError }))

    await act(async () => {
      await result.current.pay(payParams)
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('Bundler unavailable')
    expect(result.current.isError).toBe(true)
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Bundler unavailable' }),
    )
  })

  it('propagates sponsored flag', async () => {
    const payFn = mockPayFn({ sponsored: true })

    const { result } = renderHook(() => useGaslessPayment({ payFn, autoWait: true }))

    await act(async () => {
      await result.current.pay(payParams)
    })

    expect(result.current.sponsored).toBe(true)
  })

  it('resets state after success', async () => {
    const payFn = mockPayFn()

    const { result } = renderHook(() => useGaslessPayment({ payFn, autoWait: true }))

    await act(async () => {
      await result.current.pay(payParams)
    })

    expect(result.current.status).toBe('success')

    act(() => {
      result.current.reset()
    })

    expect(result.current.status).toBe('idle')
    expect(result.current.userOpHash).toBeNull()
    expect(result.current.txHash).toBeNull()
    expect(result.current.sponsored).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isSuccess).toBe(false)
  })

  it('handles wait() rejection', async () => {
    const waitFn = vi.fn().mockRejectedValue(new Error('Receipt timeout'))
    const payFn = mockPayFn({ wait: waitFn })
    const onError = vi.fn()

    const { result } = renderHook(() => useGaslessPayment({ payFn, onError, autoWait: true }))

    await act(async () => {
      await result.current.pay(payParams)
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('Receipt timeout')
    expect(onError).toHaveBeenCalled()
  })

  it('handles non-Error thrown values', async () => {
    const payFn = vi.fn().mockRejectedValue('string error')

    const { result } = renderHook(() => useGaslessPayment({ payFn }))

    await act(async () => {
      await result.current.pay(payParams)
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('Gasless payment failed')
  })

  it('resets state properly on sequential calls', async () => {
    const payFn = mockPayFn()

    const { result } = renderHook(() => useGaslessPayment({ payFn, autoWait: true }))

    await act(async () => {
      await result.current.pay(payParams)
    })

    expect(result.current.status).toBe('success')
    expect(result.current.txHash).toBe('0xtx456')

    // Second call should clear previous state while in-flight
    const payFn2 = mockPayFn({
      userOpHash: '0xop999',
      wait: vi.fn().mockResolvedValue({ txHash: '0xtx999', success: true }),
    })

    const { result: result2 } = renderHook(() =>
      useGaslessPayment({ payFn: payFn2, autoWait: true }),
    )

    await act(async () => {
      await result2.current.pay(payParams)
    })

    expect(result2.current.txHash).toBe('0xtx999')
    expect(result2.current.userOpHash).toBe('0xop999')
  })
})
