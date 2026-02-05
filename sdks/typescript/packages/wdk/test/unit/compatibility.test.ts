import { describe, it, expect } from 'vitest'
import {
  WDK_COMPATIBILITY,
  checkWdkCompatibility,
  checkWalletEvmCompatibility,
  getWalletModuleMinVersion,
} from '../../src/compatibility'

describe('WDK Compatibility', () => {
  describe('WDK_COMPATIBILITY constant', () => {
    it('should have correct minimum version', () => {
      expect(WDK_COMPATIBILITY.minVersion).toBe('1.0.0-beta.0')
    })

    it('should include beta.5 in tested versions', () => {
      expect(WDK_COMPATIBILITY.testedVersions).toContain('1.0.0-beta.5')
    })

    it('should include all tested versions', () => {
      expect(WDK_COMPATIBILITY.testedVersions).toEqual([
        '1.0.0-beta.3',
        '1.0.0-beta.4',
        '1.0.0-beta.5',
      ])
    })

    it('should include wallet-evm versions', () => {
      expect(WDK_COMPATIBILITY.walletEvmVersions).toEqual(['1.0.0-beta.5', '2.0.0-rc.1'])
    })

    it('should include swap feature', () => {
      expect(WDK_COMPATIBILITY.features.swapProtocol).toBe('1.0.0-beta.4')
    })

    it('should include wallet module versions', () => {
      expect(WDK_COMPATIBILITY.walletModuleVersions.evm).toBe('1.0.0-beta.5')
      expect(WDK_COMPATIBILITY.walletModuleVersions.ton).toBe('1.0.0-beta.7')
      expect(WDK_COMPATIBILITY.walletModuleVersions.solana).toBe('1.0.0-beta.5')
      expect(WDK_COMPATIBILITY.walletModuleVersions.tron).toBe('1.0.0-beta.4')
      expect(WDK_COMPATIBILITY.walletModuleVersions.btc).toBe('1.0.0-beta.5')
      expect(WDK_COMPATIBILITY.walletModuleVersions.spark).toBe('1.0.0-beta.6')
    })
  })

  describe('checkWdkCompatibility()', () => {
    it('should accept tested version without warnings', () => {
      const result = checkWdkCompatibility('1.0.0-beta.5')
      expect(result.compatible).toBe(true)
      expect(result.warnings).toEqual([])
    })

    it('should accept older tested versions without warnings', () => {
      const result = checkWdkCompatibility('1.0.0-beta.4')
      expect(result.compatible).toBe(true)
      // beta.4 has all core features available
      expect(result.warnings).toEqual([])
    })

    it('should reject below minimum version', () => {
      const result = checkWdkCompatibility('0.9.0')
      expect(result.compatible).toBe(false)
      expect(result.warnings[0]).toContain('below minimum supported version')
    })

    it('should warn for untested version', () => {
      const result = checkWdkCompatibility('1.0.0-beta.6')
      expect(result.compatible).toBe(true)
      expect(result.warnings.some((w) => w.includes('has not been explicitly tested'))).toBe(true)
    })

    it('should warn about feature requirements for old versions', () => {
      const result = checkWdkCompatibility('1.0.0-beta.1')
      expect(result.compatible).toBe(true)
      expect(result.warnings.some((w) => w.includes("Feature 'estimateGas'"))).toBe(true)
    })

    it('should warn about swap feature for versions before beta.4', () => {
      const result = checkWdkCompatibility('1.0.0-beta.3')
      expect(result.compatible).toBe(true)
      expect(result.warnings.some((w) => w.includes("Feature 'swapProtocol'"))).toBe(true)
    })
  })

  describe('checkWalletEvmCompatibility()', () => {
    it('should accept tested wallet-evm version', () => {
      const result = checkWalletEvmCompatibility('1.0.0-beta.5')
      expect(result.compatible).toBe(true)
      expect(result.warnings).toEqual([])
    })

    it('should accept 2.0.0-rc.1', () => {
      const result = checkWalletEvmCompatibility('2.0.0-rc.1')
      expect(result.compatible).toBe(true)
      expect(result.warnings).toEqual([])
    })

    it('should warn for untested wallet-evm version', () => {
      const result = checkWalletEvmCompatibility('2.0.0')
      expect(result.compatible).toBe(true)
      expect(result.warnings.some((w) => w.includes('has not been explicitly tested'))).toBe(true)
    })
  })

  describe('getWalletModuleMinVersion()', () => {
    it('should return EVM module min version', () => {
      expect(getWalletModuleMinVersion('evm')).toBe('1.0.0-beta.5')
    })

    it('should return TON module min version', () => {
      expect(getWalletModuleMinVersion('ton')).toBe('1.0.0-beta.7')
    })

    it('should return Solana module min version', () => {
      expect(getWalletModuleMinVersion('solana')).toBe('1.0.0-beta.5')
    })
  })
})
