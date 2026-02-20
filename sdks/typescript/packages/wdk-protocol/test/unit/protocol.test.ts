import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { T402Protocol } from '../../src/protocol.js'
import { detectChainFamilyFromName } from '../../src/signer-factory.js'

// ---- Mock dependencies ----

vi.mock('@t402/core/client', () => ({
  t402Client: vi.fn().mockImplementation(() => ({
    registerScheme: vi.fn(),
  })),
}))

vi.mock('@t402/core/http', () => ({
  t402HTTPClient: vi.fn().mockImplementation(() => ({
    getPaymentRequiredResponse: vi.fn(),
    createPaymentPayload: vi.fn(),
    encodePaymentSignatureHeader: vi.fn().mockReturnValue({}),
  })),
}))

vi.mock('@t402/evm/exact/client', () => ({
  registerExactEvmScheme: vi.fn(),
}))

function createMockWDK(signerError = false) {
  return {
    getSigner: signerError
      ? vi.fn().mockRejectedValue(new Error('EVM not available'))
      : vi.fn().mockResolvedValue({
          address: '0x1234567890abcdef1234567890abcdef12345678',
          signTypedData: vi.fn().mockResolvedValue('0xmocksignature'),
          signMessage: vi.fn().mockResolvedValue('0xmocksignature'),
        }),
    getTonSigner: vi.fn().mockResolvedValue({
      address: { toString: () => 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs' },
    }),
    getSvmSigner: vi.fn().mockResolvedValue({
      address: 'So11111111111111111111111111111111111111112',
    }),
    getTronSigner: vi.fn().mockResolvedValue({
      address: 'TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5',
    }),
  }
}

// ---- Multi-chain Tests ----

describe('T402Protocol multi-chain', () => {
  describe('create() with chain family detection', () => {
    it('should register EVM family by default', async () => {
      const wdk = createMockWDK()
      const protocol = await T402Protocol.create(wdk as never)
      const families = protocol.getRegisteredFamilies()
      expect(families.has('evm')).toBe(true)
    })

    it('should detect multiple chain families from config', async () => {
      const wdk = createMockWDK()
      const protocol = await T402Protocol.create(wdk as never, {
        chains: ['ethereum', 'arbitrum', 'ton', 'solana'],
      })
      const families = protocol.getRegisteredFamilies()
      expect(families.has('evm')).toBe(true)
      expect(families.has('ton')).toBe(true)
      expect(families.has('solana')).toBe(true)
    })

    it('should handle EVM signer failure gracefully', async () => {
      const wdk = createMockWDK(true)
      const protocol = await T402Protocol.create(wdk as never, {
        chains: ['ton'],
      })
      const families = protocol.getRegisteredFamilies()
      // EVM registration failed, but ton should still be detected
      expect(families.has('evm')).toBe(false)
      expect(families.has('ton')).toBe(true)
    })

    it('should de-duplicate chain families', async () => {
      const wdk = createMockWDK()
      const protocol = await T402Protocol.create(wdk as never, {
        chains: ['ethereum', 'arbitrum', 'base', 'polygon'],
      })
      const families = protocol.getRegisteredFamilies()
      // All EVM chains should collapse to one 'evm' entry
      expect(families.size).toBe(1)
      expect(families.has('evm')).toBe(true)
    })

    it('should return a copy of families set', async () => {
      const wdk = createMockWDK()
      const protocol = await T402Protocol.create(wdk as never, {
        chains: ['ethereum'],
      })
      const families = protocol.getRegisteredFamilies()
      families.add('fake')
      expect(protocol.getRegisteredFamilies().has('fake')).toBe(false)
    })
  })

  describe('canHandleNetwork()', () => {
    it('should return true for registered EVM networks', async () => {
      const wdk = createMockWDK()
      const protocol = await T402Protocol.create(wdk as never, {
        chains: ['ethereum'],
      })
      expect(protocol.canHandleNetwork('eip155:1')).toBe(true)
      expect(protocol.canHandleNetwork('eip155:42161')).toBe(true)
    })

    it('should return false for unregistered chain families', async () => {
      const wdk = createMockWDK()
      const protocol = await T402Protocol.create(wdk as never, {
        chains: ['ethereum'],
      })
      expect(protocol.canHandleNetwork('ton:mainnet')).toBe(false)
      expect(protocol.canHandleNetwork('solana:mainnet')).toBe(false)
    })

    it('should return true for TON when configured', async () => {
      const wdk = createMockWDK()
      const protocol = await T402Protocol.create(wdk as never, {
        chains: ['ethereum', 'ton'],
      })
      expect(protocol.canHandleNetwork('ton:mainnet')).toBe(true)
      expect(protocol.canHandleNetwork('eip155:1')).toBe(true)
    })

    it('should return false for unknown network prefixes', async () => {
      const wdk = createMockWDK()
      const protocol = await T402Protocol.create(wdk as never, {
        chains: ['ethereum'],
      })
      expect(protocol.canHandleNetwork('unknown:1')).toBe(false)
    })
  })
})

// ---- detectChainFamilyFromName Tests ----

describe('detectChainFamilyFromName', () => {
  it('should detect EVM chain names', () => {
    expect(detectChainFamilyFromName('ethereum')).toBe('evm')
    expect(detectChainFamilyFromName('arbitrum')).toBe('evm')
    expect(detectChainFamilyFromName('base')).toBe('evm')
    expect(detectChainFamilyFromName('polygon')).toBe('evm')
    expect(detectChainFamilyFromName('optimism')).toBe('evm')
    expect(detectChainFamilyFromName('ink')).toBe('evm')
    expect(detectChainFamilyFromName('berachain')).toBe('evm')
    expect(detectChainFamilyFromName('unichain')).toBe('evm')
  })

  it('should detect non-EVM chain names', () => {
    expect(detectChainFamilyFromName('ton')).toBe('ton')
    expect(detectChainFamilyFromName('solana')).toBe('solana')
    expect(detectChainFamilyFromName('tron')).toBe('tron')
    expect(detectChainFamilyFromName('near')).toBe('near')
    expect(detectChainFamilyFromName('aptos')).toBe('aptos')
    expect(detectChainFamilyFromName('cosmos')).toBe('cosmos')
  })

  it('should return undefined for unknown chain names', () => {
    expect(detectChainFamilyFromName('unknown')).toBeUndefined()
    expect(detectChainFamilyFromName('foobar')).toBeUndefined()
  })

  it('should be case-insensitive', () => {
    expect(detectChainFamilyFromName('Ethereum')).toBe('evm')
    expect(detectChainFamilyFromName('ARBITRUM')).toBe('evm')
    expect(detectChainFamilyFromName('Ton')).toBe('ton')
  })
})
