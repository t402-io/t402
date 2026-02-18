import { describe, it, expect, vi } from 'vitest'
import { LightningScheme } from '../../../src/lightning/facilitator/scheme'
import type { FacilitatorLightningSigner } from '../../../src/lightning/facilitator/scheme'
import type { PaymentPayload, PaymentRequirements } from '@t402/core/types'
import { LIGHTNING_MAINNET } from '../../../src/constants'

// Real SHA-256: SHA-256 of preimage (32 zero bytes hex)
// We'll use a known pair: preimage = 00..00 (32 bytes), hash = 66687aadf862bd776c8fc18b8e9f8e20089714856ee233b3902a591d0d5f2925
const KNOWN_PREIMAGE = '0'.repeat(64)
const KNOWN_HASH = '66687aadf862bd776c8fc18b8e9f8e20089714856ee233b3902a591d0d5f2925'

function createMockSigner(): FacilitatorLightningSigner {
  return {
    getAddresses: vi.fn().mockReturnValue(['02' + 'a'.repeat(64)]),
    lookupPayment: vi.fn().mockResolvedValue({
      settled: true,
      amountSats: '100000',
      preimage: KNOWN_PREIMAGE,
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
      network: LIGHTNING_MAINNET,
      amount: '100000',
      asset: 'BTC',
      payTo: '02' + 'd'.repeat(64),
      maxTimeoutSeconds: 3600,
      extra: {},
    },
    payload: {
      paymentHash: KNOWN_HASH,
      preimage: KNOWN_PREIMAGE,
      bolt11Invoice: 'lnbc1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctn',
    },
    ...overrides,
  }
}

function createRequirements(): PaymentRequirements {
  return {
    scheme: 'exact',
    network: LIGHTNING_MAINNET,
    amount: '100000',
    asset: 'BTC',
    payTo: '02' + 'd'.repeat(64),
    maxTimeoutSeconds: 3600,
    extra: {},
  }
}

describe('LightningScheme (Facilitator)', () => {
  it('should have correct scheme and caipFamily', () => {
    const signer = createMockSigner()
    const scheme = new LightningScheme(signer)

    expect(scheme.scheme).toBe('exact')
    expect(scheme.caipFamily).toBe('lightning:*')
  })

  it('should return signer addresses', () => {
    const signer = createMockSigner()
    const scheme = new LightningScheme(signer)

    expect(scheme.getSigners(LIGHTNING_MAINNET)).toEqual(['02' + 'a'.repeat(64)])
  })

  it('should return undefined for getExtra', () => {
    const signer = createMockSigner()
    const scheme = new LightningScheme(signer)

    expect(scheme.getExtra(LIGHTNING_MAINNET)).toBeUndefined()
  })

  describe('verify', () => {
    it('should verify valid payload with correct preimage', async () => {
      const signer = createMockSigner()
      const scheme = new LightningScheme(signer)

      const result = await scheme.verify(createPayload(), createRequirements())

      expect(result.isValid).toBe(true)
    })

    it('should reject missing payload fields', async () => {
      const signer = createMockSigner()
      const scheme = new LightningScheme(signer)

      const payload = createPayload({ payload: {} })
      const result = await scheme.verify(payload, createRequirements())

      expect(result.isValid).toBe(false)
      expect(result.invalidReason).toBe('invalid_payload_structure')
    })

    it('should reject scheme mismatch', async () => {
      const signer = createMockSigner()
      const scheme = new LightningScheme(signer)

      const payload = createPayload({
        accepted: { ...createPayload().accepted, scheme: 'upto' },
      })
      const result = await scheme.verify(payload, createRequirements())

      expect(result.isValid).toBe(false)
      expect(result.invalidReason).toBe('unsupported_scheme')
    })

    it('should reject invalid preimage format', async () => {
      const signer = createMockSigner()
      const scheme = new LightningScheme(signer)

      const payload = createPayload({
        payload: {
          paymentHash: KNOWN_HASH,
          preimage: 'invalid-hex',
          bolt11Invoice: 'lnbc1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctn',
        },
      })
      const result = await scheme.verify(payload, createRequirements())

      expect(result.isValid).toBe(false)
      expect(result.invalidReason).toBe('invalid_preimage_format')
    })

    it('should reject preimage/hash mismatch', async () => {
      const signer = createMockSigner()
      const scheme = new LightningScheme(signer)

      const payload = createPayload({
        payload: {
          paymentHash: 'f'.repeat(64), // wrong hash
          preimage: KNOWN_PREIMAGE,
          bolt11Invoice: 'lnbc1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctn',
        },
      })
      const result = await scheme.verify(payload, createRequirements())

      expect(result.isValid).toBe(false)
      expect(result.invalidReason).toBe('preimage_hash_mismatch')
    })

    it('should reject unsettled payments from node', async () => {
      const signer = createMockSigner()
      ;(signer.lookupPayment as ReturnType<typeof vi.fn>).mockResolvedValue({
        settled: false,
      })
      const scheme = new LightningScheme(signer)

      const result = await scheme.verify(createPayload(), createRequirements())

      expect(result.isValid).toBe(false)
      expect(result.invalidReason).toBe('payment_not_settled')
    })

    it('should reject insufficient amount from node', async () => {
      const signer = createMockSigner()
      ;(signer.lookupPayment as ReturnType<typeof vi.fn>).mockResolvedValue({
        settled: true,
        amountSats: '50000', // less than required 100000
      })
      const scheme = new LightningScheme(signer)

      const result = await scheme.verify(createPayload(), createRequirements())

      expect(result.isValid).toBe(false)
      expect(result.invalidReason).toBe('insufficient_amount')
    })

    it('should still validate if node lookup fails (preimage is sufficient)', async () => {
      const signer = createMockSigner()
      ;(signer.lookupPayment as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('node unavailable'),
      )
      const scheme = new LightningScheme(signer)

      const result = await scheme.verify(createPayload(), createRequirements())

      // Should still be valid because preimage verification passed
      expect(result.isValid).toBe(true)
    })
  })

  describe('settle', () => {
    it('should settle with payment hash as transaction ID', async () => {
      const signer = createMockSigner()
      const scheme = new LightningScheme(signer)

      const result = await scheme.settle(createPayload(), createRequirements())

      expect(result.success).toBe(true)
      expect(result.transaction).toBe(KNOWN_HASH)
      expect(result.network).toBe(LIGHTNING_MAINNET)
    })

    it('should fail if verification fails', async () => {
      const signer = createMockSigner()
      ;(signer.lookupPayment as ReturnType<typeof vi.fn>).mockResolvedValue({
        settled: false,
      })
      const scheme = new LightningScheme(signer)

      const result = await scheme.settle(createPayload(), createRequirements())

      expect(result.success).toBe(false)
      expect(result.errorReason).toBe('payment_not_settled')
    })

    it('should fail with missing payload', async () => {
      const signer = createMockSigner()
      const scheme = new LightningScheme(signer)

      const payload = createPayload({ payload: {} })
      const result = await scheme.settle(payload, createRequirements())

      expect(result.success).toBe(false)
      expect(result.errorReason).toBe('invalid_payload_structure')
    })
  })
})
