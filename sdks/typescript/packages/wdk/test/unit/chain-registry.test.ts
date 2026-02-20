import { describe, it, expect } from 'vitest'
import {
  CHAIN_REGISTRY,
  getRegistryByCaip2,
  getChainsByFamily,
  getChainFromNetwork,
  DEFAULT_CHAINS,
  CHAIN_TOKENS,
} from '../../src/chains'

describe('CHAIN_REGISTRY', () => {
  it('should contain all EVM chains from DEFAULT_CHAINS', () => {
    for (const chain of Object.keys(DEFAULT_CHAINS)) {
      expect(CHAIN_REGISTRY).toHaveProperty(chain)
      expect(CHAIN_REGISTRY[chain].family).toBe('evm')
      expect(CHAIN_REGISTRY[chain].caip2).toBe(DEFAULT_CHAINS[chain].network)
    }
  })

  it('should contain non-EVM chains', () => {
    expect(CHAIN_REGISTRY).toHaveProperty('ton')
    expect(CHAIN_REGISTRY).toHaveProperty('tron')
    expect(CHAIN_REGISTRY).toHaveProperty('solana')
  })

  it('should have correct family for non-EVM chains', () => {
    expect(CHAIN_REGISTRY.ton.family).toBe('ton')
    expect(CHAIN_REGISTRY.tron.family).toBe('tron')
    expect(CHAIN_REGISTRY.solana.family).toBe('svm')
  })

  it('should have valid CAIP-2 identifiers', () => {
    for (const [, entry] of Object.entries(CHAIN_REGISTRY)) {
      expect(entry.caip2).toMatch(/^[a-z0-9]+:.+/)
    }
  })

  it('should have tokens for each chain', () => {
    // EVM chains with CHAIN_TOKENS should have matching token count
    for (const chain of Object.keys(CHAIN_TOKENS)) {
      if (CHAIN_REGISTRY[chain]) {
        expect(CHAIN_REGISTRY[chain].tokens.length).toBe(CHAIN_TOKENS[chain].length)
      }
    }
  })

  it('should have rpcEndpoints as arrays', () => {
    for (const [, entry] of Object.entries(CHAIN_REGISTRY)) {
      expect(Array.isArray(entry.rpcEndpoints)).toBe(true)
    }
  })

  it('should have chainId for EVM chains', () => {
    for (const [name, entry] of Object.entries(CHAIN_REGISTRY)) {
      if (entry.family === 'evm') {
        expect(entry.chainId).toBeDefined()
        expect(typeof entry.chainId).toBe('number')
        expect(entry.chainId).toBe(DEFAULT_CHAINS[name]?.chainId)
      }
    }
  })

  it('non-EVM chains should not have chainId', () => {
    expect(CHAIN_REGISTRY.ton.chainId).toBeUndefined()
    expect(CHAIN_REGISTRY.tron.chainId).toBeUndefined()
    expect(CHAIN_REGISTRY.solana.chainId).toBeUndefined()
  })

  it('TON should have USDT token', () => {
    const tonTokens = CHAIN_REGISTRY.ton.tokens
    expect(tonTokens.length).toBeGreaterThan(0)
    expect(tonTokens[0].symbol).toBe('USDT')
    expect(tonTokens[0].decimals).toBe(6)
  })

  it('TRON should have USDT token', () => {
    const tronTokens = CHAIN_REGISTRY.tron.tokens
    expect(tronTokens.length).toBeGreaterThan(0)
    expect(tronTokens[0].symbol).toBe('USDT')
    expect(tronTokens[0].address).toBe('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t')
  })

  it('Solana should have USDT token', () => {
    const solTokens = CHAIN_REGISTRY.solana.tokens
    expect(solTokens.length).toBeGreaterThan(0)
    expect(solTokens[0].symbol).toBe('USDT')
  })
})

describe('getRegistryByCaip2', () => {
  it('should find EVM chain by CAIP-2', () => {
    const entry = getRegistryByCaip2('eip155:42161')
    expect(entry).toBeDefined()
    expect(entry!.family).toBe('evm')
    expect(entry!.chainId).toBe(42161)
  })

  it('should find TON by CAIP-2', () => {
    const entry = getRegistryByCaip2('ton:mainnet')
    expect(entry).toBeDefined()
    expect(entry!.family).toBe('ton')
  })

  it('should find TRON by CAIP-2', () => {
    const entry = getRegistryByCaip2('tron:mainnet')
    expect(entry).toBeDefined()
    expect(entry!.family).toBe('tron')
  })

  it('should find Solana by CAIP-2', () => {
    const entry = getRegistryByCaip2('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp')
    expect(entry).toBeDefined()
    expect(entry!.family).toBe('svm')
  })

  it('should return undefined for unknown CAIP-2', () => {
    expect(getRegistryByCaip2('unknown:chain')).toBeUndefined()
  })
})

describe('getChainsByFamily', () => {
  it('should return EVM chains', () => {
    const evmChains = getChainsByFamily('evm')
    expect(evmChains).toContain('ethereum')
    expect(evmChains).toContain('arbitrum')
    expect(evmChains).toContain('base')
    expect(evmChains).not.toContain('ton')
    expect(evmChains).not.toContain('tron')
    expect(evmChains).not.toContain('solana')
  })

  it('should return TON chains', () => {
    const tonChains = getChainsByFamily('ton')
    expect(tonChains).toEqual(['ton'])
  })

  it('should return SVM chains', () => {
    const svmChains = getChainsByFamily('svm')
    expect(svmChains).toEqual(['solana'])
  })

  it('should return TRON chains', () => {
    const tronChains = getChainsByFamily('tron')
    expect(tronChains).toEqual(['tron'])
  })

  it('should return empty for unknown family', () => {
    expect(getChainsByFamily('unknown' as any)).toEqual([])
  })
})

describe('getChainFromNetwork (with registry)', () => {
  it('should find EVM chain by network', () => {
    expect(getChainFromNetwork('eip155:42161')).toBe('arbitrum')
  })

  it('should find non-EVM chain by CAIP-2', () => {
    expect(getChainFromNetwork('ton:mainnet')).toBe('ton')
    expect(getChainFromNetwork('tron:mainnet')).toBe('tron')
    expect(getChainFromNetwork('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp')).toBe('solana')
  })

  it('should return undefined for unknown network', () => {
    expect(getChainFromNetwork('unknown:network')).toBeUndefined()
  })
})
