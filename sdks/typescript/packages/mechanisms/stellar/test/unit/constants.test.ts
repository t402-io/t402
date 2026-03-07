import { describe, it, expect } from 'vitest'
import {
  STELLAR_PUBNET_CAIP2,
  STELLAR_TESTNET_CAIP2,
  STELLAR_NETWORKS,
  STELLAR_PUBNET_PASSPHRASE,
  STELLAR_TESTNET_PASSPHRASE,
  NETWORK_PASSPHRASES,
  HORIZON_ENDPOINTS,
  SOROBAN_ENDPOINTS,
  SCHEME_EXACT,
  DEFAULT_TIMEOUT_SECONDS,
  LEDGER_TIME_SECONDS,
} from '../../src/constants'

describe('Stellar Constants', () => {
  describe('Network Identifiers', () => {
    it('should have correct pubnet CAIP-2 identifier', () => {
      expect(STELLAR_PUBNET_CAIP2).toBe('stellar:pubnet')
    })

    it('should have correct testnet CAIP-2 identifier', () => {
      expect(STELLAR_TESTNET_CAIP2).toBe('stellar:testnet')
    })

    it('should include both networks in STELLAR_NETWORKS', () => {
      expect(STELLAR_NETWORKS).toContain(STELLAR_PUBNET_CAIP2)
      expect(STELLAR_NETWORKS).toContain(STELLAR_TESTNET_CAIP2)
      expect(STELLAR_NETWORKS).toHaveLength(2)
    })
  })

  describe('Network Passphrases', () => {
    it('should have correct pubnet passphrase', () => {
      expect(STELLAR_PUBNET_PASSPHRASE).toBe(
        'Public Global Stellar Network ; September 2015',
      )
    })

    it('should have correct testnet passphrase', () => {
      expect(STELLAR_TESTNET_PASSPHRASE).toBe('Test SDF Network ; September 2015')
    })

    it('should have passphrase mappings for both networks', () => {
      expect(NETWORK_PASSPHRASES[STELLAR_PUBNET_CAIP2]).toBe(STELLAR_PUBNET_PASSPHRASE)
      expect(NETWORK_PASSPHRASES[STELLAR_TESTNET_CAIP2]).toBe(STELLAR_TESTNET_PASSPHRASE)
    })
  })

  describe('Endpoints', () => {
    it('should have Horizon endpoints for both networks', () => {
      expect(HORIZON_ENDPOINTS[STELLAR_PUBNET_CAIP2]).toBeDefined()
      expect(HORIZON_ENDPOINTS[STELLAR_TESTNET_CAIP2]).toBeDefined()
    })

    it('should have Soroban RPC endpoints for both networks', () => {
      expect(SOROBAN_ENDPOINTS[STELLAR_PUBNET_CAIP2]).toBeDefined()
      expect(SOROBAN_ENDPOINTS[STELLAR_TESTNET_CAIP2]).toBeDefined()
    })

    it('should use https for all endpoints', () => {
      for (const endpoint of Object.values(HORIZON_ENDPOINTS)) {
        expect(endpoint).toMatch(/^https:\/\//)
      }
      for (const endpoint of Object.values(SOROBAN_ENDPOINTS)) {
        expect(endpoint).toMatch(/^https:\/\//)
      }
    })
  })

  describe('Scheme', () => {
    it('should have correct scheme identifier', () => {
      expect(SCHEME_EXACT).toBe('exact')
    })
  })

  describe('Timing', () => {
    it('should have reasonable default timeout', () => {
      expect(DEFAULT_TIMEOUT_SECONDS).toBe(60)
    })

    it('should have correct ledger time', () => {
      expect(LEDGER_TIME_SECONDS).toBe(5)
    })
  })
})
