import { describe, it, expect, vi } from 'vitest'
import { ExactBtcScheme } from '../../../src/exact/client/scheme'
import type { ClientBtcSigner } from '../../../src/signer'
import type { PaymentRequirements } from '@t402/core/types'
import { BTC_MAINNET } from '../../../src/constants'

function createMockSigner(): ClientBtcSigner {
  return {
    signPsbt: vi.fn().mockResolvedValue('signed-psbt-base64'),
    getAddress: vi.fn().mockReturnValue('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'),
    getPublicKey: vi
      .fn()
      .mockReturnValue('02b4632d08485ff1df2db55b9dafd23347d1c47a457072a1e87be26896549a8737'),
  }
}

function createRequirements(overrides?: Partial<PaymentRequirements>): PaymentRequirements {
  return {
    scheme: 'exact',
    network: BTC_MAINNET,
    amount: '100000', // 0.001 BTC in satoshis
    asset: 'BTC',
    payTo: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
    maxTimeoutSeconds: 3600,
    extra: {},
    ...overrides,
  }
}

describe('ExactBtcScheme (Client)', () => {
  it('should have scheme set to exact', () => {
    const signer = createMockSigner()
    const scheme = new ExactBtcScheme(signer)
    expect(scheme.scheme).toBe('exact')
  })

  it('should create payment payload', async () => {
    const signer = createMockSigner()
    const scheme = new ExactBtcScheme(signer)
    const requirements = createRequirements()

    const result = await scheme.createPaymentPayload(2, requirements)

    expect(result.t402Version).toBe(2)
    expect(result.payload).toBeDefined()
    expect((result.payload as { signedPsbt: string }).signedPsbt).toBe('signed-psbt-base64')
    expect(signer.signPsbt).toHaveBeenCalledOnce()
  })

  it('should throw if payTo is missing', async () => {
    const signer = createMockSigner()
    const scheme = new ExactBtcScheme(signer)
    const requirements = createRequirements({ payTo: '' })

    await expect(scheme.createPaymentPayload(2, requirements)).rejects.toThrow(
      'PayTo address is required',
    )
  })

  it('should throw if amount is missing', async () => {
    const signer = createMockSigner()
    const scheme = new ExactBtcScheme(signer)
    const requirements = createRequirements({ amount: '' })

    await expect(scheme.createPaymentPayload(2, requirements)).rejects.toThrow('Amount is required')
  })

  it('should throw if address is invalid', async () => {
    const signer = createMockSigner()
    const scheme = new ExactBtcScheme(signer)
    const requirements = createRequirements({ payTo: 'invalid-address' })

    await expect(scheme.createPaymentPayload(2, requirements)).rejects.toThrow(
      'Invalid Bitcoin address',
    )
  })

  it('should throw if amount is below dust limit', async () => {
    const signer = createMockSigner()
    const scheme = new ExactBtcScheme(signer)
    const requirements = createRequirements({ amount: '100' }) // below 546 dust limit

    await expect(scheme.createPaymentPayload(2, requirements)).rejects.toThrow('below dust limit')
  })

  it('should pass unsigned PSBT to signer', async () => {
    const signer = createMockSigner()
    const scheme = new ExactBtcScheme(signer)
    const requirements = createRequirements()

    await scheme.createPaymentPayload(2, requirements)

    // Verify signer was called with a base64 string
    const psbtArg = (signer.signPsbt as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(typeof psbtArg).toBe('string')

    // Decode and verify PSBT content
    const decoded = JSON.parse(Buffer.from(psbtArg, 'base64').toString())
    expect(decoded.outputs[0].address).toBe(requirements.payTo)
    expect(decoded.outputs[0].value).toBe(requirements.amount)
  })
})
