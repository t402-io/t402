import { describe, it, expect, vi } from 'vitest'
import { useGaslessPayment } from './useGaslessPayment'

const mockParams = { to: '0x1234', amount: 1000000n }

function createMockPayFn(overrides?: {
  sponsored?: boolean
  waitResult?: { txHash: string; success: boolean }
}) {
  const waitResult = overrides?.waitResult ?? { txHash: '0xabc', success: true }
  const waitFn = vi.fn().mockResolvedValue(waitResult)
  const payFn = vi.fn().mockResolvedValue({
    userOpHash: '0xop1',
    sender: '0xsender',
    sponsored: overrides?.sponsored ?? false,
    wait: waitFn,
  })
  return { payFn, waitFn }
}

describe('useGaslessPayment', () => {
  it('starts with idle state', () => {
    const { payFn } = createMockPayFn()
    const { status, userOpHash, txHash, sponsored, error, isLoading, isSuccess, isError } =
      useGaslessPayment({ payFn })

    expect(status.value).toBe('idle')
    expect(userOpHash.value).toBeNull()
    expect(txHash.value).toBeNull()
    expect(sponsored.value).toBeNull()
    expect(error.value).toBeNull()
    expect(isLoading.value).toBe(false)
    expect(isSuccess.value).toBe(false)
    expect(isError.value).toBe(false)
  })

  it('succeeds with autoWait=true', async () => {
    const { payFn, waitFn } = createMockPayFn()
    const onSuccess = vi.fn()
    const { pay, status, userOpHash, txHash } = useGaslessPayment({
      payFn,
      onSuccess,
      autoWait: true,
    })

    await pay(mockParams)

    expect(payFn).toHaveBeenCalledWith(mockParams)
    expect(waitFn).toHaveBeenCalled()
    expect(status.value).toBe('success')
    expect(userOpHash.value).toBe('0xop1')
    expect(txHash.value).toBe('0xabc')
    expect(onSuccess).toHaveBeenCalledWith({ txHash: '0xabc', success: true })
  })

  it('succeeds with autoWait=false', async () => {
    const { payFn, waitFn } = createMockPayFn()
    const onSuccess = vi.fn()
    const { pay, status, userOpHash, txHash } = useGaslessPayment({
      payFn,
      onSuccess,
      autoWait: false,
    })

    await pay(mockParams)

    expect(waitFn).not.toHaveBeenCalled()
    expect(status.value).toBe('success')
    expect(userOpHash.value).toBe('0xop1')
    expect(txHash.value).toBeNull()
    expect(onSuccess).toHaveBeenCalledWith({ txHash: '0xop1', success: true })
  })

  it('handles payment error', async () => {
    const payFn = vi.fn().mockRejectedValue(new Error('Bundler rejected'))
    const onError = vi.fn()
    const { pay, status, error, isError } = useGaslessPayment({ payFn, onError })

    await pay(mockParams)

    expect(status.value).toBe('error')
    expect(isError.value).toBe(true)
    expect(error.value).toBe('Bundler rejected')
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Bundler rejected' }))
  })

  it('propagates sponsored flag', async () => {
    const { payFn } = createMockPayFn({ sponsored: true })
    const { pay, sponsored } = useGaslessPayment({ payFn })

    await pay(mockParams)

    expect(sponsored.value).toBe(true)
  })

  it('resets state after payment', async () => {
    const { payFn } = createMockPayFn()
    const { pay, reset, status, userOpHash, txHash, sponsored, error } = useGaslessPayment({
      payFn,
    })

    await pay(mockParams)
    expect(status.value).toBe('success')

    reset()
    expect(status.value).toBe('idle')
    expect(userOpHash.value).toBeNull()
    expect(txHash.value).toBeNull()
    expect(sponsored.value).toBeNull()
    expect(error.value).toBeNull()
  })

  it('handles wait() rejection', async () => {
    const waitFn = vi.fn().mockRejectedValue(new Error('Receipt timeout'))
    const payFn = vi.fn().mockResolvedValue({
      userOpHash: '0xop1',
      sender: '0xsender',
      sponsored: false,
      wait: waitFn,
    })
    const onError = vi.fn()
    const { pay, status, error } = useGaslessPayment({ payFn, onError, autoWait: true })

    await pay(mockParams)

    expect(status.value).toBe('error')
    expect(error.value).toBe('Receipt timeout')
    expect(onError).toHaveBeenCalled()
  })

  it('shows loading state during execution', async () => {
    let resolvePayment: (value: unknown) => void
    const payFn = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolvePayment = resolve
      }),
    )
    const { pay, isLoading, status } = useGaslessPayment({ payFn, autoWait: false })

    const promise = pay(mockParams)
    expect(isLoading.value).toBe(true)
    expect(status.value).toBe('loading')

    resolvePayment!({ userOpHash: '0xop1', sender: '0x', sponsored: false, wait: vi.fn() })
    await promise

    expect(isLoading.value).toBe(false)
    expect(status.value).toBe('success')
  })

  it('handles multiple sequential calls', async () => {
    const { payFn } = createMockPayFn()
    const { pay, status, txHash } = useGaslessPayment({ payFn })

    await pay(mockParams)
    expect(status.value).toBe('success')
    expect(txHash.value).toBe('0xabc')

    const payFn2Result = {
      userOpHash: '0xop2',
      sender: '0xsender2',
      sponsored: true,
      wait: vi.fn().mockResolvedValue({ txHash: '0xdef', success: true }),
    }
    payFn.mockResolvedValueOnce(payFn2Result)

    await pay(mockParams)
    expect(status.value).toBe('success')
    expect(txHash.value).toBe('0xdef')
  })
})
