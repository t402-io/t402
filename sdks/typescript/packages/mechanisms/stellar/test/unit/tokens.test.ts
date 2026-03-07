import { describe, it, expect } from 'vitest'
import {
  USDC_ADDRESSES,
  TOKEN_REGISTRY,
  getTokenConfig,
  getNetworkTokens,
  getDefaultToken,
  getTokenByAddress,
  getNetworksForToken,
  getUsdcNetworks,
  isNetworkSupported,
  getSupportedNetworks,
} from '../../src/tokens'
import { STELLAR_PUBNET_CAIP2, STELLAR_TESTNET_CAIP2 } from '../../src/constants'

describe('Stellar Tokens', () => {
  describe('USDC Addresses', () => {
    it('should have pubnet USDC address', () => {
      expect(USDC_ADDRESSES[STELLAR_PUBNET_CAIP2]).toBeDefined()
      expect(USDC_ADDRESSES[STELLAR_PUBNET_CAIP2]).toMatch(/^C/)
    })

    it('should have testnet USDC address', () => {
      expect(USDC_ADDRESSES[STELLAR_TESTNET_CAIP2]).toBeDefined()
      expect(USDC_ADDRESSES[STELLAR_TESTNET_CAIP2]).toMatch(/^C/)
    })

    it('should have valid C-account addresses', () => {
      expect(USDC_ADDRESSES[STELLAR_PUBNET_CAIP2].length).toBeGreaterThanOrEqual(50)
      expect(USDC_ADDRESSES[STELLAR_TESTNET_CAIP2].length).toBeGreaterThanOrEqual(50)
    })
  })

  describe('Token Registry', () => {
    it('should have pubnet configuration', () => {
      expect(TOKEN_REGISTRY[STELLAR_PUBNET_CAIP2]).toBeDefined()
      expect(TOKEN_REGISTRY[STELLAR_PUBNET_CAIP2].USDC).toBeDefined()
    })

    it('should have correct USDC configuration', () => {
      const usdc = TOKEN_REGISTRY[STELLAR_PUBNET_CAIP2].USDC
      expect(usdc.symbol).toBe('USDC')
      expect(usdc.decimals).toBe(7)
      expect(usdc.priority).toBe(1)
    })
  })

  describe('getTokenConfig', () => {
    it('should return USDC config for pubnet', () => {
      const config = getTokenConfig(STELLAR_PUBNET_CAIP2, 'USDC')
      expect(config).toBeDefined()
      expect(config?.symbol).toBe('USDC')
      expect(config?.decimals).toBe(7)
    })

    it('should return undefined for unknown token', () => {
      const config = getTokenConfig(STELLAR_PUBNET_CAIP2, 'UNKNOWN')
      expect(config).toBeUndefined()
    })

    it('should be case-insensitive', () => {
      const config1 = getTokenConfig(STELLAR_PUBNET_CAIP2, 'usdc')
      const config2 = getTokenConfig(STELLAR_PUBNET_CAIP2, 'USDC')
      expect(config1).toEqual(config2)
    })
  })

  describe('getNetworkTokens', () => {
    it('should return all tokens for pubnet sorted by priority', () => {
      const tokens = getNetworkTokens(STELLAR_PUBNET_CAIP2)
      expect(tokens.length).toBeGreaterThan(0)
      expect(tokens[0].symbol).toBe('USDC')
    })

    it('should return empty array for unknown network', () => {
      const tokens = getNetworkTokens('unknown:network')
      expect(tokens).toEqual([])
    })
  })

  describe('getDefaultToken', () => {
    it('should return USDC as default for pubnet', () => {
      const defaultToken = getDefaultToken(STELLAR_PUBNET_CAIP2)
      expect(defaultToken).toBeDefined()
      expect(defaultToken?.symbol).toBe('USDC')
    })

    it('should return undefined for unknown network', () => {
      const defaultToken = getDefaultToken('unknown:network')
      expect(defaultToken).toBeUndefined()
    })
  })

  describe('getTokenByAddress', () => {
    it('should find USDC by address', () => {
      const usdcAddress = USDC_ADDRESSES[STELLAR_PUBNET_CAIP2]
      const token = getTokenByAddress(STELLAR_PUBNET_CAIP2, usdcAddress)
      expect(token).toBeDefined()
      expect(token?.symbol).toBe('USDC')
    })

    it('should return undefined for unknown address', () => {
      const token = getTokenByAddress(
        STELLAR_PUBNET_CAIP2,
        'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      )
      expect(token).toBeUndefined()
    })
  })

  describe('getNetworksForToken', () => {
    it('should return networks supporting USDC', () => {
      const networks = getNetworksForToken('USDC')
      expect(networks).toContain(STELLAR_PUBNET_CAIP2)
      expect(networks).toContain(STELLAR_TESTNET_CAIP2)
    })

    it('should return empty array for unknown token', () => {
      const networks = getNetworksForToken('UNKNOWN')
      expect(networks).toEqual([])
    })
  })

  describe('getUsdcNetworks', () => {
    it('should return USDC networks', () => {
      const networks = getUsdcNetworks()
      expect(networks).toContain(STELLAR_PUBNET_CAIP2)
      expect(networks).toContain(STELLAR_TESTNET_CAIP2)
    })
  })

  describe('isNetworkSupported', () => {
    it('should return true for pubnet', () => {
      expect(isNetworkSupported(STELLAR_PUBNET_CAIP2)).toBe(true)
    })

    it('should return true for testnet', () => {
      expect(isNetworkSupported(STELLAR_TESTNET_CAIP2)).toBe(true)
    })

    it('should return false for unknown network', () => {
      expect(isNetworkSupported('unknown:network')).toBe(false)
    })
  })

  describe('getSupportedNetworks', () => {
    it('should return all supported networks', () => {
      const networks = getSupportedNetworks()
      expect(networks).toContain(STELLAR_PUBNET_CAIP2)
      expect(networks).toContain(STELLAR_TESTNET_CAIP2)
    })
  })
})
