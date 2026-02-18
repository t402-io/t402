import { describe, it, expect, vi } from 'vitest'
import { LightningScheme } from '../../../src/lightning/client/scheme'
import type { ClientLightningSigner } from '../../../src/signer'
import type { PaymentRequirements } from '@t402/core/types'
import { LIGHTNING_MAINNET } from '../../../src/constants'

function createMockSigner(): ClientLightningSigner {
  return {
    payInvoice: vi.fn().mockResolvedValue({
      preimage: 'a'.repeat(64),
      paymentHash: 'b'.repeat(64),
    }),
    getNodePubKey: vi.fn().mockReturnValue('02' + 'c'.repeat(64)),
  }
}

function createRequirements(overrides?: Partial<PaymentRequirements>): PaymentRequirements {
  return {
    scheme: 'exact',
    network: LIGHTNING_MAINNET,
    amount: '100000',
    asset: 'BTC',
    payTo: '02' + 'd'.repeat(64),
    maxTimeoutSeconds: 3600,
    extra: {
      bolt11Invoice:
        'lnbc1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctn',
    },
    ...overrides,
  }
}

describe('LightningScheme (Client)', () => {
  it('should have scheme set to exact', () => {
    const signer = createMockSigner()
    const scheme = new LightningScheme(signer)
    expect(scheme.scheme).toBe('exact')
  })

  it('should create payment payload with preimage', async () => {
    const signer = createMockSigner()
    const scheme = new LightningScheme(signer)
    const requirements = createRequirements()

    const result = await scheme.createPaymentPayload(2, requirements)

    expect(result.t402Version).toBe(2)
    const payload = result.payload as {
      paymentHash: string
      preimage: string
      bolt11Invoice: string
    }
    expect(payload.preimage).toBe('a'.repeat(64))
    expect(payload.paymentHash).toBe('b'.repeat(64))
    expect(payload.bolt11Invoice).toBe(requirements.extra.bolt11Invoice)
    expect(signer.payInvoice).toHaveBeenCalledWith(requirements.extra.bolt11Invoice)
  })

  it('should throw if bolt11Invoice is missing', async () => {
    const signer = createMockSigner()
    const scheme = new LightningScheme(signer)
    const requirements = createRequirements({ extra: {} })

    await expect(scheme.createPaymentPayload(2, requirements)).rejects.toThrow(
      'BOLT11 invoice is required',
    )
  })

  it('should throw if bolt11Invoice format is invalid', async () => {
    const signer = createMockSigner()
    const scheme = new LightningScheme(signer)
    const requirements = createRequirements({
      extra: { bolt11Invoice: 'invalid-invoice' },
    })

    await expect(scheme.createPaymentPayload(2, requirements)).rejects.toThrow(
      'Invalid BOLT11 invoice format',
    )
  })
})
