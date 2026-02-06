import { describe, it, expect } from 'vitest'
import type { UptoTronAuthorization, UptoTronPayload, UptoTronExtra } from '../../../src/upto/types'
import { isUptoTronPayload, isUptoTronExtra } from '../../../src/upto/types'

describe('UptoTronAuthorization', () => {
  it('should have correct structure', () => {
    const auth: UptoTronAuthorization = {
      owner: 'TXyz1234567890123456789012345678ab',
      spender: 'TAbcdefghijklmnopqrstuvwxyz123456',
      contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
      maxAmount: '10000000',
      expiration: 1740675689000,
      refBlockBytes: 'abcd',
      refBlockHash: '1234567890abcdef',
      timestamp: 1740672089000,
    }

    expect(auth.owner).toMatch(/^T/)
    expect(auth.spender).toMatch(/^T/)
    expect(auth.contractAddress).toBe('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t')
    expect(auth.maxAmount).toBe('10000000')
    expect(auth.expiration).toBe(1740675689000)
    expect(auth.refBlockBytes).toBe('abcd')
    expect(auth.refBlockHash).toBe('1234567890abcdef')
    expect(auth.timestamp).toBe(1740672089000)
  })
})

describe('UptoTronPayload', () => {
  const validPayload: UptoTronPayload = {
    signedTransaction: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6',
    authorization: {
      owner: 'TXyz1234567890123456789012345678ab',
      spender: 'TAbcdefghijklmnopqrstuvwxyz123456',
      contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
      maxAmount: '10000000',
      expiration: 1740675689000,
      refBlockBytes: 'abcd',
      refBlockHash: '1234567890abcdef',
      timestamp: 1740672089000,
    },
    paymentNonce: '0xf3746613c2d920b5fdabc0856f2aeb2d4f88ee6037b8cc5d04a71a4462f13480',
  }

  it('should have correct structure', () => {
    expect(validPayload.signedTransaction).toBeTruthy()
    expect(validPayload.authorization.owner).toMatch(/^T/)
    expect(validPayload.authorization.spender).toMatch(/^T/)
    expect(validPayload.authorization.maxAmount).toBe('10000000')
    expect(validPayload.paymentNonce).toMatch(/^0x/)
  })

  it('should contain all authorization fields', () => {
    const { authorization } = validPayload
    expect(authorization).toHaveProperty('owner')
    expect(authorization).toHaveProperty('spender')
    expect(authorization).toHaveProperty('contractAddress')
    expect(authorization).toHaveProperty('maxAmount')
    expect(authorization).toHaveProperty('expiration')
    expect(authorization).toHaveProperty('refBlockBytes')
    expect(authorization).toHaveProperty('refBlockHash')
    expect(authorization).toHaveProperty('timestamp')
  })
})

describe('UptoTronExtra', () => {
  it('should work with all fields', () => {
    const extra: UptoTronExtra = {
      maxAmount: '10000000',
      minAmount: '100000',
      unit: 'request',
      unitPrice: '50000',
      spenderAddress: 'TAbcdefghijklmnopqrstuvwxyz123456',
    }

    expect(extra.maxAmount).toBe('10000000')
    expect(extra.minAmount).toBe('100000')
    expect(extra.unit).toBe('request')
    expect(extra.unitPrice).toBe('50000')
    expect(extra.spenderAddress).toMatch(/^T/)
  })

  it('should work with minimal fields (all optional)', () => {
    const extra: UptoTronExtra = {}

    expect(extra.maxAmount).toBeUndefined()
    expect(extra.minAmount).toBeUndefined()
    expect(extra.unit).toBeUndefined()
    expect(extra.unitPrice).toBeUndefined()
    expect(extra.spenderAddress).toBeUndefined()
  })
})

describe('isUptoTronPayload', () => {
  const validPayload = {
    signedTransaction: 'a1b2c3d4e5f6',
    authorization: {
      owner: 'TOwnerAddress123',
      spender: 'TSpenderAddress456',
      contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
      maxAmount: '10000000',
      expiration: 1740675689000,
      refBlockBytes: 'abcd',
      refBlockHash: '1234567890abcdef',
      timestamp: 1740672089000,
    },
    paymentNonce: '0xabc123',
  }

  it('should return true for valid payload', () => {
    expect(isUptoTronPayload(validPayload)).toBe(true)
  })

  it('should return false for null', () => {
    expect(isUptoTronPayload(null)).toBe(false)
  })

  it('should return false for undefined', () => {
    expect(isUptoTronPayload(undefined)).toBe(false)
  })

  it('should return false for non-object', () => {
    expect(isUptoTronPayload('not an object')).toBe(false)
    expect(isUptoTronPayload(42)).toBe(false)
  })

  it('should return false for empty object', () => {
    expect(isUptoTronPayload({})).toBe(false)
  })

  it('should return false when missing signedTransaction', () => {
    const { signedTransaction: _, ...rest } = validPayload
    expect(isUptoTronPayload(rest)).toBe(false)
  })

  it('should return false when signedTransaction is empty string', () => {
    expect(isUptoTronPayload({ ...validPayload, signedTransaction: '' })).toBe(false)
  })

  it('should return false when missing paymentNonce', () => {
    const { paymentNonce: _, ...rest } = validPayload
    expect(isUptoTronPayload(rest)).toBe(false)
  })

  it('should return false when paymentNonce is empty string', () => {
    expect(isUptoTronPayload({ ...validPayload, paymentNonce: '' })).toBe(false)
  })

  it('should return false when missing authorization', () => {
    const { authorization: _, ...rest } = validPayload
    expect(isUptoTronPayload(rest)).toBe(false)
  })

  it('should return false when authorization is not an object', () => {
    expect(isUptoTronPayload({ ...validPayload, authorization: 'string' })).toBe(false)
  })

  it('should return false when authorization.owner is missing', () => {
    const payload = {
      ...validPayload,
      authorization: { ...validPayload.authorization, owner: '' },
    }
    expect(isUptoTronPayload(payload)).toBe(false)
  })

  it('should return false when authorization.spender is missing', () => {
    const payload = {
      ...validPayload,
      authorization: { ...validPayload.authorization, spender: '' },
    }
    expect(isUptoTronPayload(payload)).toBe(false)
  })

  it('should return false when authorization.contractAddress is missing', () => {
    const payload = {
      ...validPayload,
      authorization: { ...validPayload.authorization, contractAddress: '' },
    }
    expect(isUptoTronPayload(payload)).toBe(false)
  })

  it('should return false when authorization.maxAmount is missing', () => {
    const payload = {
      ...validPayload,
      authorization: { ...validPayload.authorization, maxAmount: '' },
    }
    expect(isUptoTronPayload(payload)).toBe(false)
  })

  it('should return false when authorization.expiration is not a number', () => {
    const payload = {
      ...validPayload,
      authorization: { ...validPayload.authorization, expiration: '1740675689000' },
    }
    expect(isUptoTronPayload(payload)).toBe(false)
  })

  it('should return false when authorization.timestamp is not a number', () => {
    const payload = {
      ...validPayload,
      authorization: { ...validPayload.authorization, timestamp: '1740672089000' },
    }
    expect(isUptoTronPayload(payload)).toBe(false)
  })

  it('should reject exact scheme payload structure', () => {
    const exactPayload = {
      signedTransaction: 'a1b2c3d4',
      authorization: {
        from: 'TOwnerAddress123',
        to: 'TRecipient456',
        contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        amount: '1000000',
        expiration: 1740675689000,
        refBlockBytes: 'abcd',
        refBlockHash: '12345678',
        timestamp: 1740672089000,
      },
    }
    // Exact scheme uses "from/to/amount" not "owner/spender/maxAmount"
    expect(isUptoTronPayload(exactPayload)).toBe(false)
  })
})

describe('isUptoTronExtra', () => {
  it('should return true for valid extra with all fields', () => {
    const extra = {
      maxAmount: '10000000',
      minAmount: '100000',
      unit: 'request',
      unitPrice: '50000',
      spenderAddress: 'TSpender123',
    }
    expect(isUptoTronExtra(extra)).toBe(true)
  })

  it('should return true for empty object (all optional)', () => {
    expect(isUptoTronExtra({})).toBe(true)
  })

  it('should return true for partial fields', () => {
    expect(isUptoTronExtra({ maxAmount: '10000000' })).toBe(true)
    expect(isUptoTronExtra({ unit: 'token', unitPrice: '100' })).toBe(true)
  })

  it('should return false for null', () => {
    expect(isUptoTronExtra(null)).toBe(false)
  })

  it('should return false for undefined', () => {
    expect(isUptoTronExtra(undefined)).toBe(false)
  })

  it('should return false for non-object', () => {
    expect(isUptoTronExtra('not an object')).toBe(false)
  })

  it('should return false when string fields are not strings', () => {
    expect(isUptoTronExtra({ maxAmount: 10000000 })).toBe(false)
    expect(isUptoTronExtra({ unit: 123 })).toBe(false)
    expect(isUptoTronExtra({ unitPrice: true })).toBe(false)
    expect(isUptoTronExtra({ spenderAddress: 42 })).toBe(false)
  })
})
