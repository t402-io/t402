import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { T402Protocol } from '../src/protocol.js'
import {
  detectChainFamily,
  getEvmChainName,
  isEvmNetwork,
  EVM_CHAIN_MAP,
} from '../src/signer-factory.js'
import { extractPaymentRequired } from '../src/http-client.js'

// ---- Mock WDK ----

function createMockWDK() {
  return {
    getSigner: vi.fn().mockResolvedValue({
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

function createPaymentRequiredHeader(accepts: Array<Record<string, unknown>>) {
  const paymentRequired = {
    t402Version: 2,
    resource: { url: 'https://api.example.com/premium' },
    accepts,
  }
  return Buffer.from(JSON.stringify(paymentRequired)).toString('base64')
}

function create402Response(accepts: Array<Record<string, unknown>>) {
  const headerValue = createPaymentRequiredHeader(accepts)
  return new Response('Payment Required', {
    status: 402,
    headers: { 'payment-required': headerValue },
  })
}

function createOkResponse(body = 'Success') {
  return new Response(body, { status: 200 })
}

// ---- T402Protocol Tests ----

describe('T402Protocol', () => {
  describe('create()', () => {
    it('should create with default config', async () => {
      const wdk = createMockWDK()
      const protocol = await T402Protocol.create(wdk as never)

      expect(protocol.getFacilitator()).toBe('https://facilitator.t402.io')
      expect(protocol.getChains()).toEqual([])
      expect(wdk.getSigner).toHaveBeenCalledWith('ethereum')
    })

    it('should create with custom config', async () => {
      const wdk = createMockWDK()
      const protocol = await T402Protocol.create(wdk as never, {
        facilitator: 'https://custom-facilitator.example.com',
        chains: ['arbitrum', 'base'],
      })

      expect(protocol.getFacilitator()).toBe('https://custom-facilitator.example.com')
      expect(protocol.getChains()).toEqual(['arbitrum', 'base'])
      // Should use first chain for signer
      expect(wdk.getSigner).toHaveBeenCalledWith('arbitrum')
    })

    it('should return a copy of chains array', async () => {
      const wdk = createMockWDK()
      const protocol = await T402Protocol.create(wdk as never, { chains: ['ethereum'] })
      const chains = protocol.getChains()
      chains.push('base')
      expect(protocol.getChains()).toEqual(['ethereum'])
    })

    it('should expose WDK instance', async () => {
      const wdk = createMockWDK()
      const protocol = await T402Protocol.create(wdk as never)
      expect(protocol.getWdk()).toBe(wdk)
    })

    it('should expose HTTP client', async () => {
      const wdk = createMockWDK()
      const protocol = await T402Protocol.create(wdk as never)
      expect(protocol.getHttpClient()).toBeDefined()
    })
  })

  describe('fetch()', () => {
    let originalFetch: typeof globalThis.fetch

    beforeEach(() => {
      originalFetch = globalThis.fetch
    })

    afterEach(() => {
      globalThis.fetch = originalFetch
    })

    it('should pass through non-402 responses', async () => {
      const wdk = createMockWDK()
      const protocol = await T402Protocol.create(wdk as never)

      globalThis.fetch = vi.fn().mockResolvedValue(createOkResponse('Hello'))

      const { response, receipt } = await protocol.fetch('https://api.example.com/free')

      expect(response.status).toBe(200)
      expect(receipt).toBeUndefined()
      expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('getRequirements()', () => {
    let originalFetch: typeof globalThis.fetch

    beforeEach(() => {
      originalFetch = globalThis.fetch
    })

    afterEach(() => {
      globalThis.fetch = originalFetch
    })

    it('should extract requirements from 402 response', async () => {
      const wdk = createMockWDK()
      const protocol = await T402Protocol.create(wdk as never)

      const accepts = [
        {
          scheme: 'exact',
          network: 'eip155:1',
          asset: 'USDT0',
          amount: '1000000',
          payTo: '0xC88f67e776f16DcFBf42e6bDda1B82604448899B',
          maxTimeoutSeconds: 300,
          extra: {},
        },
      ]

      globalThis.fetch = vi.fn().mockResolvedValue(create402Response(accepts))

      const paymentRequired = await protocol.getRequirements('https://api.example.com/premium')

      expect(paymentRequired.t402Version).toBe(2)
      expect(paymentRequired.accepts).toHaveLength(1)
      expect(paymentRequired.accepts[0].network).toBe('eip155:1')
    })

    it('should throw for non-402 responses', async () => {
      const wdk = createMockWDK()
      const protocol = await T402Protocol.create(wdk as never)

      globalThis.fetch = vi.fn().mockResolvedValue(createOkResponse())

      await expect(protocol.getRequirements('https://api.example.com/free')).rejects.toThrow(
        'Expected 402 response, got 200',
      )
    })
  })
})

// ---- Chain Detection Tests ----

describe('detectChainFamily', () => {
  it('should detect EVM chains', () => {
    expect(detectChainFamily('eip155:1')).toBe('evm')
    expect(detectChainFamily('eip155:42161')).toBe('evm')
    expect(detectChainFamily('eip155:8453')).toBe('evm')
  })

  it('should detect TON', () => {
    expect(detectChainFamily('ton:mainnet')).toBe('ton')
    expect(detectChainFamily('ton:testnet')).toBe('ton')
  })

  it('should detect Solana', () => {
    expect(detectChainFamily('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp')).toBe('solana')
  })

  it('should detect TRON', () => {
    expect(detectChainFamily('tron:mainnet')).toBe('tron')
  })

  it('should detect NEAR', () => {
    expect(detectChainFamily('near:mainnet')).toBe('near')
  })

  it('should detect Aptos', () => {
    expect(detectChainFamily('aptos:1')).toBe('aptos')
  })

  it('should detect Tezos', () => {
    expect(detectChainFamily('tezos:NetXdQprcVkpaWU')).toBe('tezos')
  })

  it('should detect Polkadot', () => {
    expect(detectChainFamily('polkadot:68d56f15f85d3136970ec16946040bc1')).toBe('polkadot')
  })

  it('should detect Stacks', () => {
    expect(detectChainFamily('stacks:1')).toBe('stacks')
  })

  it('should detect Cosmos', () => {
    expect(detectChainFamily('cosmos:noble-1')).toBe('cosmos')
  })

  it('should throw for unknown networks', () => {
    expect(() => detectChainFamily('unknown:1')).toThrow('Unsupported network')
  })
})

describe('getEvmChainName', () => {
  it('should map CAIP-2 to chain names', () => {
    expect(getEvmChainName('eip155:1')).toBe('ethereum')
    expect(getEvmChainName('eip155:42161')).toBe('arbitrum')
    expect(getEvmChainName('eip155:8453')).toBe('base')
    expect(getEvmChainName('eip155:10')).toBe('optimism')
    expect(getEvmChainName('eip155:80094')).toBe('berachain')
  })

  it('should return undefined for unknown EVM networks', () => {
    expect(getEvmChainName('eip155:99999')).toBeUndefined()
  })
})

describe('isEvmNetwork', () => {
  it('should return true for EVM networks', () => {
    expect(isEvmNetwork('eip155:1')).toBe(true)
    expect(isEvmNetwork('eip155:42161')).toBe(true)
  })

  it('should return false for non-EVM networks', () => {
    expect(isEvmNetwork('ton:mainnet')).toBe(false)
    expect(isEvmNetwork('solana:mainnet')).toBe(false)
  })
})

describe('EVM_CHAIN_MAP', () => {
  it('should have correct chain IDs', () => {
    expect(EVM_CHAIN_MAP['ethereum']).toBe('eip155:1')
    expect(EVM_CHAIN_MAP['arbitrum']).toBe('eip155:42161')
    expect(EVM_CHAIN_MAP['base']).toBe('eip155:8453')
    expect(EVM_CHAIN_MAP['berachain']).toBe('eip155:80094')
    expect(EVM_CHAIN_MAP['ink']).toBe('eip155:57073')
  })
})

// ---- HTTP Client Tests ----

describe('extractPaymentRequired', () => {
  it('should extract from V2 header', () => {
    const paymentRequired = {
      t402Version: 2,
      resource: { url: 'https://example.com' },
      accepts: [
        {
          scheme: 'exact',
          network: 'eip155:1',
          asset: 'USDT0',
          amount: '100',
          payTo: '0xC88f67e776f16DcFBf42e6bDda1B82604448899B',
          maxTimeoutSeconds: 300,
          extra: {},
        },
      ],
    }
    const encoded = Buffer.from(JSON.stringify(paymentRequired)).toString('base64')
    const response = new Response('', {
      status: 402,
      headers: { 'payment-required': encoded },
    })

    const result = extractPaymentRequired(response)
    expect(result.t402Version).toBe(2)
    expect(result.accepts).toHaveLength(1)
  })

  it('should fall back to V1 x-payment header', () => {
    const paymentRequired = {
      t402Version: 2,
      resource: { url: 'https://example.com' },
      accepts: [
        {
          scheme: 'exact',
          network: 'eip155:1',
          asset: 'USDT0',
          amount: '100',
          payTo: '0xC88f67e776f16DcFBf42e6bDda1B82604448899B',
          maxTimeoutSeconds: 300,
          extra: {},
        },
      ],
    }
    const encoded = Buffer.from(JSON.stringify(paymentRequired)).toString('base64')
    const response = new Response('', {
      status: 402,
      headers: { 'x-payment': encoded },
    })

    const result = extractPaymentRequired(response)
    expect(result.t402Version).toBe(2)
  })

  it('should throw when no payment header found', () => {
    const response = new Response('', { status: 402 })
    expect(() => extractPaymentRequired(response)).toThrow('No payment requirements found')
  })
})
