import { describe, it, expect, vi } from 'vitest'
import { ExactBtcScheme } from '../../../src/exact/facilitator/scheme'
import type { FacilitatorBtcSigner } from '../../../src/exact/facilitator/scheme'
import type { PaymentPayload, PaymentRequirements } from '@t402/core/types'
import { BTC_MAINNET } from '../../../src/constants'

function createMockSigner(): FacilitatorBtcSigner {
  return {
    getAddresses: vi.fn().mockReturnValue(['bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4']),
    verifyPsbt: vi.fn().mockResolvedValue({
      valid: true,
      payer: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
    }),
    broadcastPsbt: vi.fn().mockResolvedValue('txid123abc'),
    waitForConfirmation: vi.fn().mockResolvedValue({
      confirmed: true,
      txId: 'txid123abc',
      blockHash: 'blockhash123',
      confirmations: 1,
    }),
  }
}

function createPayload(overrides?: Partial<PaymentPayload>): PaymentPayload {
  return {
    t402Version: 2,
    resource: {
      url: 'https://example.com/resource',
      description: 'Test resource',
      mimeType: 'application/json',
    },
    accepted: {
      scheme: 'exact',
      network: BTC_MAINNET,
      amount: '100000',
      asset: 'BTC',
      payTo: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
      maxTimeoutSeconds: 3600,
      extra: {},
    },
    payload: {
      signedPsbt: 'signed-psbt-base64',
    },
    ...overrides,
  }
}

function createRequirements(): PaymentRequirements {
  return {
    scheme: 'exact',
    network: BTC_MAINNET,
    amount: '100000',
    asset: 'BTC',
    payTo: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
    maxTimeoutSeconds: 3600,
    extra: {},
  }
}

describe('ExactBtcScheme (Facilitator)', () => {
  it('should have correct scheme and caipFamily', () => {
    const signer = createMockSigner()
    const scheme = new ExactBtcScheme(signer)

    expect(scheme.scheme).toBe('exact')
    expect(scheme.caipFamily).toBe('bip122:*')
  })

  it('should return signer addresses', () => {
    const signer = createMockSigner()
    const scheme = new ExactBtcScheme(signer)

    expect(scheme.getSigners(BTC_MAINNET)).toEqual([
      'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
    ])
  })

  it('should return undefined for getExtra', () => {
    const signer = createMockSigner()
    const scheme = new ExactBtcScheme(signer)

    expect(scheme.getExtra(BTC_MAINNET)).toBeUndefined()
  })

  describe('verify', () => {
    it('should verify valid payload', async () => {
      const signer = createMockSigner()
      const scheme = new ExactBtcScheme(signer)

      const result = await scheme.verify(createPayload(), createRequirements())

      expect(result.isValid).toBe(true)
      expect(result.payer).toBe('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq')
    })

    it('should reject missing signedPsbt', async () => {
      const signer = createMockSigner()
      const scheme = new ExactBtcScheme(signer)

      const payload = createPayload({ payload: {} })
      const result = await scheme.verify(payload, createRequirements())

      expect(result.isValid).toBe(false)
      expect(result.invalidReason).toBe('invalid_payload_structure')
    })

    it('should reject scheme mismatch', async () => {
      const signer = createMockSigner()
      const scheme = new ExactBtcScheme(signer)

      const payload = createPayload({
        accepted: { ...createPayload().accepted, scheme: 'upto' },
      })
      const result = await scheme.verify(payload, createRequirements())

      expect(result.isValid).toBe(false)
      expect(result.invalidReason).toBe('unsupported_scheme')
    })

    it('should reject network mismatch', async () => {
      const signer = createMockSigner()
      const scheme = new ExactBtcScheme(signer)

      const payload = createPayload({
        accepted: {
          ...createPayload().accepted,
          network: 'bip122:000000000933ea01ad0ee984209779ba',
        },
      })
      const result = await scheme.verify(payload, createRequirements())

      expect(result.isValid).toBe(false)
      expect(result.invalidReason).toBe('network_mismatch')
    })

    it('should reject when PSBT verification fails', async () => {
      const signer = createMockSigner()
      ;(signer.verifyPsbt as ReturnType<typeof vi.fn>).mockResolvedValue({
        valid: false,
        reason: 'invalid_signature',
      })
      const scheme = new ExactBtcScheme(signer)

      const result = await scheme.verify(createPayload(), createRequirements())

      expect(result.isValid).toBe(false)
      expect(result.invalidReason).toBe('invalid_signature')
    })

    it('should reject amount below dust limit', async () => {
      const signer = createMockSigner()
      const scheme = new ExactBtcScheme(signer)

      const requirements = { ...createRequirements(), amount: '100' }
      const result = await scheme.verify(createPayload(), requirements)

      expect(result.isValid).toBe(false)
      expect(result.invalidReason).toBe('amount_below_dust_limit')
    })
  })

  describe('settle', () => {
    it('should settle valid payload', async () => {
      const signer = createMockSigner()
      const scheme = new ExactBtcScheme(signer)

      const result = await scheme.settle(createPayload(), createRequirements())

      expect(result.success).toBe(true)
      expect(result.transaction).toBe('txid123abc')
      expect(result.network).toBe(BTC_MAINNET)
    })

    it('should fail if verification fails', async () => {
      const signer = createMockSigner()
      ;(signer.verifyPsbt as ReturnType<typeof vi.fn>).mockResolvedValue({
        valid: false,
        reason: 'invalid_output',
      })
      const scheme = new ExactBtcScheme(signer)

      const result = await scheme.settle(createPayload(), createRequirements())

      expect(result.success).toBe(false)
      expect(result.errorReason).toBe('invalid_output')
    })

    it('should fail if broadcast fails', async () => {
      const signer = createMockSigner()
      ;(signer.broadcastPsbt as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('network error'),
      )
      const scheme = new ExactBtcScheme(signer)

      const result = await scheme.settle(createPayload(), createRequirements())

      expect(result.success).toBe(false)
      expect(result.errorReason).toBe('transaction_failed')
    })

    it('should fail if confirmation fails', async () => {
      const signer = createMockSigner()
      ;(signer.waitForConfirmation as ReturnType<typeof vi.fn>).mockResolvedValue({
        confirmed: false,
        txId: 'txid123abc',
        confirmations: 0,
      })
      const scheme = new ExactBtcScheme(signer)

      const result = await scheme.settle(createPayload(), createRequirements())

      expect(result.success).toBe(false)
      expect(result.errorReason).toBe('transaction_not_confirmed')
    })
  })
})
