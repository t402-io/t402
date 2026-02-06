import { describe, it, expect } from 'vitest'
import type { UptoTonAuthorization, UptoTonPayload, UptoTonExtra } from '../../../src/upto/types'
import { isUptoTonPayload } from '../../../src/upto/types'

describe('Upto TON Types', () => {
  // Sample TON addresses
  const SAMPLE_SENDER = 'EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2'
  const SAMPLE_FACILITATOR = 'EQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkEUe'
  const SAMPLE_JETTON_MASTER = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs'

  describe('UptoTonAuthorization', () => {
    it('should have correct structure', () => {
      const authorization: UptoTonAuthorization = {
        from: SAMPLE_SENDER,
        facilitator: SAMPLE_FACILITATOR,
        jettonMaster: SAMPLE_JETTON_MASTER,
        maxAmount: '5000000',
        tonAmount: '100000000',
        validUntil: 1740675689,
        seqno: 42,
        queryId: '12345678901234567890',
      }

      expect(authorization.from).toBe(SAMPLE_SENDER)
      expect(authorization.facilitator).toBe(SAMPLE_FACILITATOR)
      expect(authorization.jettonMaster).toBe(SAMPLE_JETTON_MASTER)
      expect(authorization.maxAmount).toBe('5000000')
      expect(authorization.tonAmount).toBe('100000000')
      expect(authorization.validUntil).toBe(1740675689)
      expect(authorization.seqno).toBe(42)
      expect(authorization.queryId).toBe('12345678901234567890')
    })
  })

  describe('UptoTonPayload', () => {
    it('should have correct structure', () => {
      const payload: UptoTonPayload = {
        signedBoc: 'te6cckEBAQEAJAAAQ4AXxx6CuYAlGP8P//+2bLUQ6w94Zv8nEiZ+lBvGKVo+8BA=',
        authorization: {
          from: SAMPLE_SENDER,
          facilitator: SAMPLE_FACILITATOR,
          jettonMaster: SAMPLE_JETTON_MASTER,
          maxAmount: '5000000',
          tonAmount: '100000000',
          validUntil: 1740675689,
          seqno: 42,
          queryId: '12345678901234567890',
        },
        paymentNonce: '0xf3746613c2d920b5fdabc0856f2aeb2d4f88ee6037b8cc5d04a71a4462f13480',
      }

      expect(payload.signedBoc).toBeDefined()
      expect(payload.authorization).toBeDefined()
      expect(payload.authorization.from).toBe(SAMPLE_SENDER)
      expect(payload.authorization.facilitator).toBe(SAMPLE_FACILITATOR)
      expect(payload.paymentNonce).toMatch(/^0x[0-9a-f]{64}$/)
    })

    it('should use string amounts for large numbers', () => {
      const payload: UptoTonPayload = {
        signedBoc: 'dGVzdC1ib2M=',
        authorization: {
          from: SAMPLE_SENDER,
          facilitator: SAMPLE_FACILITATOR,
          jettonMaster: SAMPLE_JETTON_MASTER,
          maxAmount: '999999999999',
          tonAmount: '500000000',
          validUntil: 1740675689,
          seqno: 0,
          queryId: '18446744073709551615',
        },
        paymentNonce: '0xabc123',
      }

      expect(payload.authorization.maxAmount).toBe('999999999999')
      expect(payload.authorization.queryId).toBe('18446744073709551615')
    })
  })

  describe('UptoTonExtra', () => {
    it('should have full upto parameters', () => {
      const extra: UptoTonExtra = {
        facilitator: SAMPLE_FACILITATOR,
        maxAmount: '10000000',
        minAmount: '100000',
        unit: 'token',
        unitPrice: '100',
      }

      expect(extra.facilitator).toBe(SAMPLE_FACILITATOR)
      expect(extra.maxAmount).toBe('10000000')
      expect(extra.minAmount).toBe('100000')
      expect(extra.unit).toBe('token')
      expect(extra.unitPrice).toBe('100')
    })

    it('should work with minimal fields', () => {
      const extra: UptoTonExtra = {}

      expect(extra.facilitator).toBeUndefined()
      expect(extra.maxAmount).toBeUndefined()
      expect(extra.minAmount).toBeUndefined()
      expect(extra.unit).toBeUndefined()
      expect(extra.unitPrice).toBeUndefined()
    })

    it('should work with only facilitator', () => {
      const extra: UptoTonExtra = {
        facilitator: SAMPLE_FACILITATOR,
      }

      expect(extra.facilitator).toBe(SAMPLE_FACILITATOR)
      expect(extra.unit).toBeUndefined()
    })
  })

  describe('isUptoTonPayload', () => {
    const validPayload = {
      signedBoc: 'te6cckEBAQEAJAAAQ4AXxx6CuYAlGP8P//+2bLUQ6w94Zv8nEiZ+lBvGKVo+8BA=',
      authorization: {
        from: SAMPLE_SENDER,
        facilitator: SAMPLE_FACILITATOR,
        jettonMaster: SAMPLE_JETTON_MASTER,
        maxAmount: '5000000',
        tonAmount: '100000000',
        validUntil: 1740675689,
        seqno: 42,
        queryId: '12345678901234567890',
      },
      paymentNonce: '0xf374661300000000',
    }

    it('should return true for valid payload', () => {
      expect(isUptoTonPayload(validPayload)).toBe(true)
    })

    it('should return false for null/undefined', () => {
      expect(isUptoTonPayload(null)).toBe(false)
      expect(isUptoTonPayload(undefined)).toBe(false)
    })

    it('should return false for empty object', () => {
      expect(isUptoTonPayload({})).toBe(false)
    })

    it('should return false for missing signedBoc', () => {
      const { signedBoc: _, ...payload } = validPayload
      expect(isUptoTonPayload(payload)).toBe(false)
    })

    it('should return false for empty signedBoc', () => {
      expect(isUptoTonPayload({ ...validPayload, signedBoc: '' })).toBe(false)
    })

    it('should return false for missing paymentNonce', () => {
      const { paymentNonce: _, ...payload } = validPayload
      expect(isUptoTonPayload(payload)).toBe(false)
    })

    it('should return false for empty paymentNonce', () => {
      expect(isUptoTonPayload({ ...validPayload, paymentNonce: '' })).toBe(false)
    })

    it('should return false for missing authorization', () => {
      const { authorization: _, ...payload } = validPayload
      expect(isUptoTonPayload(payload)).toBe(false)
    })

    it('should return false for missing authorization.from', () => {
      const payload = {
        ...validPayload,
        authorization: { ...validPayload.authorization, from: '' },
      }
      expect(isUptoTonPayload(payload)).toBe(false)
    })

    it('should return false for missing authorization.facilitator', () => {
      const payload = {
        ...validPayload,
        authorization: { ...validPayload.authorization, facilitator: '' },
      }
      expect(isUptoTonPayload(payload)).toBe(false)
    })

    it('should return false for wrong authorization field types', () => {
      const payload = {
        ...validPayload,
        authorization: { ...validPayload.authorization, maxAmount: 5000000 },
      }
      expect(isUptoTonPayload(payload)).toBe(false)
    })

    it('should return false for exact scheme payload', () => {
      // Exact TON payloads have different authorization fields (to, jettonAmount)
      const exactPayload = {
        signedBoc: 'dGVzdA==',
        authorization: {
          from: SAMPLE_SENDER,
          to: 'EQSomeRecipient',
          jettonMaster: SAMPLE_JETTON_MASTER,
          jettonAmount: '1000000',
          tonAmount: '100000000',
          validUntil: 1740675689,
          seqno: 42,
          queryId: '12345',
        },
      }
      expect(isUptoTonPayload(exactPayload)).toBe(false)
    })

    it('should return false for non-object types', () => {
      expect(isUptoTonPayload('string')).toBe(false)
      expect(isUptoTonPayload(42)).toBe(false)
      expect(isUptoTonPayload(true)).toBe(false)
      expect(isUptoTonPayload([])).toBe(false)
    })
  })
})
