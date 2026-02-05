/**
 * WDK Smart Account Tests
 *
 * Tests for WdkSmartAccount and createWdkSmartAccount
 */

import { describe, it, expect, vi, beforeAll as _beforeAll } from 'vitest'

// ============================================================
// Mock viem at module level to avoid loading the real library
// (which consumes too much memory in forked vitest processes).
// ============================================================

const MOCK_COMPUTED_ADDRESS = '0x00000000000000000000000000000000DeAdBeEf'
let _encodeFunctionDataCallCount = 0
let _encodeFunctionDataLastArgs: unknown = undefined

vi.mock('viem', () => {
  // Lightweight mock counter
  let callCount = 0

  return {
    encodeFunctionData: (args: unknown) => {
      callCount++
      _encodeFunctionDataCallCount = callCount
      _encodeFunctionDataLastArgs = args
      const a = args as { functionName: string }
      // Return different selectors based on function name
      if (a.functionName === 'executeUserOp') return '0x7bb37428' + '00'.repeat(128)
      if (a.functionName === 'executeUserOpBatch') return '0xbatch428' + '00'.repeat(128)
      if (a.functionName === 'enableModules') return '0xenablemod' + '00'.repeat(64)
      if (a.functionName === 'setup') return '0xsetup000' + '00'.repeat(128)
      if (a.functionName === 'createProxyWithNonce') return '0xfactory0' + '00'.repeat(64)
      return '0xdeadbeef'
    },
    encodeAbiParameters: () => '0x' + 'ab'.repeat(32),
    concat: (parts: string[]) => {
      // Simple concatenation of hex strings (strip 0x prefix from subsequent parts)
      let result = parts[0]
      for (let i = 1; i < parts.length; i++) {
        const part = parts[i]
        result += part.startsWith('0x') ? part.slice(2) : part
      }
      return result
    },
    keccak256: (_data: string) => '0x' + 'ff'.repeat(32),
    getContractAddress: () => MOCK_COMPUTED_ADDRESS,
  }
})

// Now import the module – it will use the mocked viem
import { WdkSmartAccount, createWdkSmartAccount, SAFE_4337_ADDRESSES } from './account.js'

// ============================================================
// Mock helpers
// ============================================================

const MOCK_OWNER = '0xABCDEF0123456789ABCDEF0123456789ABCDEF01'
const MOCK_OWNER_2 = '0x1111111111111111111111111111111111111111'
const MOCK_OWNER_3 = '0x2222222222222222222222222222222222222222'
const MOCK_SIG =
  '0xaabbccdd00000000000000000000000000000000000000000000000000000000001111111111111111111111111111111111111111111111111111111111111111ab'
const MOCK_CODE = '0x608060405234801561001057600080fd5b506040516101e63803806101e68339818101604052'

function mkWdk(overrides: Record<string, unknown> = {}) {
  return {
    getAddress: vi.fn().mockResolvedValue(MOCK_OWNER),
    getBalance: vi.fn().mockResolvedValue(0n),
    getTokenBalance: vi.fn().mockResolvedValue(0n),
    signMessage: vi.fn().mockResolvedValue(MOCK_SIG),
    signTypedData: vi.fn().mockResolvedValue(MOCK_SIG),
    sendTransaction: vi.fn().mockResolvedValue('0xtx'),
    ...overrides,
  }
}

function mkClient(overrides: Record<string, unknown> = {}) {
  return {
    readContract: vi.fn().mockResolvedValue(MOCK_CODE),
    getCode: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

// ============================================================
// SAFE_4337_ADDRESSES constant tests
// ============================================================

describe('SAFE_4337_ADDRESSES', () => {
  it('should have all required addresses', () => {
    expect(SAFE_4337_ADDRESSES.module).toBeDefined()
    expect(SAFE_4337_ADDRESSES.moduleSetup).toBeDefined()
    expect(SAFE_4337_ADDRESSES.singleton).toBeDefined()
    expect(SAFE_4337_ADDRESSES.proxyFactory).toBeDefined()
    expect(SAFE_4337_ADDRESSES.fallbackHandler).toBeDefined()
    expect(SAFE_4337_ADDRESSES.addModulesLib).toBeDefined()
  })

  it('should have valid Ethereum addresses', () => {
    Object.values(SAFE_4337_ADDRESSES).forEach((address) => {
      expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/)
    })
  })

  it('should have correct module address (Safe 4337 v0.3.0)', () => {
    expect(SAFE_4337_ADDRESSES.module).toBe('0xa581c4A4DB7175302464fF3C06380BC3270b4037')
  })

  it('should have correct proxy factory address', () => {
    expect(SAFE_4337_ADDRESSES.proxyFactory).toBe('0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67')
  })

  it('should have correct singleton address', () => {
    expect(SAFE_4337_ADDRESSES.singleton).toBe('0x29fcB43b46531BcA003ddC8FCB67FFE91900C762')
  })

  it('should have correct module setup address', () => {
    expect(SAFE_4337_ADDRESSES.moduleSetup).toBe('0x2dd68b007B46fBe91B9A7c3EDa5A7a1063cB5b47')
  })

  it('should have correct fallback handler address', () => {
    expect(SAFE_4337_ADDRESSES.fallbackHandler).toBe('0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99')
  })

  it('should have correct add modules lib address', () => {
    expect(SAFE_4337_ADDRESSES.addModulesLib).toBe('0x8EcD4ec46D4D2a6B64fE960B3D64e8B94B2234eb')
  })
})

// ============================================================
// Exports check
// ============================================================

describe('WdkSmartAccount exports', () => {
  it('should export WdkSmartAccount class', () => {
    expect(WdkSmartAccount).toBeDefined()
    expect(typeof WdkSmartAccount).toBe('function')
  })

  it('should export createWdkSmartAccount function', () => {
    expect(createWdkSmartAccount).toBeDefined()
    expect(typeof createWdkSmartAccount).toBe('function')
  })

  it('should export SAFE_4337_ADDRESSES constant', () => {
    expect(SAFE_4337_ADDRESSES).toBeDefined()
    expect(typeof SAFE_4337_ADDRESSES).toBe('object')
  })
})

// ============================================================
// Class structure check
// ============================================================

describe('WdkSmartAccount class structure', () => {
  it('should be a class with expected methods', () => {
    expect(WdkSmartAccount.prototype.initialize).toBeDefined()
    expect(WdkSmartAccount.prototype.getOwnerAddress).toBeDefined()
    expect(WdkSmartAccount.prototype.getAddress).toBeDefined()
    expect(WdkSmartAccount.prototype.signUserOpHash).toBeDefined()
    expect(WdkSmartAccount.prototype.getInitCode).toBeDefined()
    expect(WdkSmartAccount.prototype.isDeployed).toBeDefined()
    expect(WdkSmartAccount.prototype.encodeExecute).toBeDefined()
    expect(WdkSmartAccount.prototype.encodeExecuteBatch).toBeDefined()
    expect(WdkSmartAccount.prototype.getOwners).toBeDefined()
    expect(WdkSmartAccount.prototype.getThreshold).toBeDefined()
    expect(WdkSmartAccount.prototype.clearCache).toBeDefined()
  })
})

// ============================================================
// Instance behavior tests (using mocked viem)
// ============================================================

describe('WdkSmartAccount constructor', () => {
  it('should construct with minimal config and correct defaults', () => {
    const a = new WdkSmartAccount({
      wdkAccount: mkWdk() as any,
      publicClient: mkClient() as any,
      chainId: 1,
    })
    expect(a).toBeInstanceOf(WdkSmartAccount)
    expect(a.getChainId()).toBe(1)
    expect(a.getThreshold()).toBe(1)
  })

  it('should respect custom threshold and saltNonce', () => {
    const a = new WdkSmartAccount({
      wdkAccount: mkWdk() as any,
      publicClient: mkClient() as any,
      chainId: 42161,
      threshold: 2,
      saltNonce: 42n,
    })
    expect(a.getThreshold()).toBe(2)
  })

  it('should accept additionalOwners before init', () => {
    const a = new WdkSmartAccount({
      wdkAccount: mkWdk() as any,
      publicClient: mkClient() as any,
      chainId: 1,
      additionalOwners: [MOCK_OWNER_2 as any],
    })
    expect(a.getOwners()).toContain(MOCK_OWNER_2)
  })
})

describe('WdkSmartAccount.initialize()', () => {
  it('should fetch WDK address on initialize and add as first owner', async () => {
    const wdk = mkWdk()
    const a = new WdkSmartAccount({
      wdkAccount: wdk as any,
      publicClient: mkClient() as any,
      chainId: 1,
    })
    await a.initialize()
    expect(wdk.getAddress).toHaveBeenCalledTimes(1)
    expect(a.getOwners()[0]).toBe(MOCK_OWNER)
  })

  it('should be idempotent on double init', async () => {
    const wdk = mkWdk()
    const a = new WdkSmartAccount({
      wdkAccount: wdk as any,
      publicClient: mkClient() as any,
      chainId: 1,
    })
    await a.initialize()
    await a.initialize()
    expect(wdk.getAddress).toHaveBeenCalledTimes(1)
  })

  it('should propagate init errors', async () => {
    const a = new WdkSmartAccount({
      wdkAccount: mkWdk({
        getAddress: vi.fn().mockRejectedValue(new Error('WDK fail')),
      }) as any,
      publicClient: mkClient() as any,
      chainId: 1,
    })
    await expect(a.initialize()).rejects.toThrow('WDK fail')
  })
})

describe('WdkSmartAccount.getOwnerAddress()', () => {
  it('should return owner EOA and auto-initialize', async () => {
    const wdk = mkWdk()
    const a = new WdkSmartAccount({
      wdkAccount: wdk as any,
      publicClient: mkClient() as any,
      chainId: 1,
    })
    const addr = await a.getOwnerAddress()
    expect(addr).toBe(MOCK_OWNER)
    expect(wdk.getAddress).toHaveBeenCalled()
  })
})

describe('WdkSmartAccount.getAddress()', () => {
  it('should compute and cache counterfactual address', async () => {
    const client = mkClient()
    const a = new WdkSmartAccount({
      wdkAccount: mkWdk() as any,
      publicClient: client as any,
      chainId: 1,
    })
    const addr1 = await a.getAddress()
    expect(addr1).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(client.readContract).toHaveBeenCalled()
    const addr2 = await a.getAddress()
    expect(addr1).toBe(addr2)
  })

  it('should recompute after clearCache', async () => {
    const a = new WdkSmartAccount({
      wdkAccount: mkWdk() as any,
      publicClient: mkClient() as any,
      chainId: 1,
    })
    await a.getAddress()
    a.clearCache()
    const addr = await a.getAddress()
    expect(addr).toMatch(/^0x[a-fA-F0-9]{40}$/)
  })
})

describe('WdkSmartAccount.signUserOpHash()', () => {
  it('should sign with 0x00 suffix and call signMessage', async () => {
    const wdk = mkWdk()
    const a = new WdkSmartAccount({
      wdkAccount: wdk as any,
      publicClient: mkClient() as any,
      chainId: 1,
    })
    const hash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
    const sig = await a.signUserOpHash(hash as any)
    expect(sig.endsWith('00')).toBe(true)
    expect(sig.startsWith('0x')).toBe(true)
    expect(wdk.signMessage).toHaveBeenCalledWith(hash)
  })

  it('should propagate signMessage errors', async () => {
    const a = new WdkSmartAccount({
      wdkAccount: mkWdk({
        signMessage: vi.fn().mockRejectedValue(new Error('sign fail')),
      }) as any,
      publicClient: mkClient() as any,
      chainId: 1,
    })
    await expect(a.signUserOpHash('0xdeadbeef' as any)).rejects.toThrow('sign fail')
  })
})

describe('WdkSmartAccount.getInitCode()', () => {
  it('should return init code with factory when not deployed', async () => {
    const a = new WdkSmartAccount({
      wdkAccount: mkWdk() as any,
      publicClient: mkClient() as any,
      chainId: 1,
    })
    const initCode = await a.getInitCode()
    expect(initCode).not.toBe('0x')
    const factoryLower = SAFE_4337_ADDRESSES.proxyFactory.toLowerCase().slice(2)
    expect(initCode.toLowerCase().includes(factoryLower)).toBe(true)
  })

  it('should return 0x when deployed', async () => {
    const a = new WdkSmartAccount({
      wdkAccount: mkWdk() as any,
      publicClient: mkClient({
        getCode: vi.fn().mockResolvedValue('0x600160015560016000f3'),
      }) as any,
      chainId: 1,
    })
    expect(await a.getInitCode()).toBe('0x')
  })

  it('should cache init code', async () => {
    const a = new WdkSmartAccount({
      wdkAccount: mkWdk() as any,
      publicClient: mkClient() as any,
      chainId: 1,
    })
    const c1 = await a.getInitCode()
    const c2 = await a.getInitCode()
    expect(c1).toBe(c2)
  })
})

describe('WdkSmartAccount.isDeployed()', () => {
  it('should return false when no code/0x, true when code exists', async () => {
    const a1 = new WdkSmartAccount({
      wdkAccount: mkWdk() as any,
      publicClient: mkClient({ getCode: vi.fn().mockResolvedValue(undefined) }) as any,
      chainId: 1,
    })
    expect(await a1.isDeployed()).toBe(false)

    const a2 = new WdkSmartAccount({
      wdkAccount: mkWdk() as any,
      publicClient: mkClient({ getCode: vi.fn().mockResolvedValue('0x') }) as any,
      chainId: 1,
    })
    expect(await a2.isDeployed()).toBe(false)

    const a3 = new WdkSmartAccount({
      wdkAccount: mkWdk() as any,
      publicClient: mkClient({
        getCode: vi.fn().mockResolvedValue('0x600160015560016000f3'),
      }) as any,
      chainId: 1,
    })
    expect(await a3.isDeployed()).toBe(true)
  })

  it('should cache isDeployed and re-check after clearCache', async () => {
    const mockGetCode = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce('0x600160015560016000f3')
    const a = new WdkSmartAccount({
      wdkAccount: mkWdk() as any,
      publicClient: mkClient({ getCode: mockGetCode }) as any,
      chainId: 1,
    })
    expect(await a.isDeployed()).toBe(false)
    await a.isDeployed()
    expect(mockGetCode).toHaveBeenCalledTimes(1) // cached
    a.clearCache()
    expect(await a.isDeployed()).toBe(true)
    expect(mockGetCode).toHaveBeenCalledTimes(2)
  })
})

describe('WdkSmartAccount.encodeExecute()', () => {
  it('should encode single call with executeUserOp selector', () => {
    const a = new WdkSmartAccount({
      wdkAccount: mkWdk() as any,
      publicClient: mkClient() as any,
      chainId: 1,
    })
    const enc = a.encodeExecute(
      '0xDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF' as any,
      0n,
      '0x' as any,
    )
    expect(enc.slice(0, 10)).toBe('0x7bb37428')
    // Also test with non-zero value
    const enc2 = a.encodeExecute(
      '0xDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF' as any,
      1000000n,
      '0xa9059cbb' as any,
    )
    expect(enc2.startsWith('0x7bb37428')).toBe(true)
    expect(enc2.length).toBeGreaterThan(10)
  })
})

describe('WdkSmartAccount.encodeExecuteBatch()', () => {
  it('should encode batch correctly', () => {
    const a = new WdkSmartAccount({
      wdkAccount: mkWdk() as any,
      publicClient: mkClient() as any,
      chainId: 1,
    })
    const enc = a.encodeExecuteBatch(
      ['0xDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF' as any, MOCK_OWNER_2 as any],
      [0n, 0n],
      ['0x' as any, '0x' as any],
    )
    expect(enc).toMatch(/^0x/)
    expect(enc.length).toBeGreaterThan(10)
  })

  it('should throw on mismatch targets vs values', () => {
    const a = new WdkSmartAccount({
      wdkAccount: mkWdk() as any,
      publicClient: mkClient() as any,
      chainId: 1,
    })
    expect(() =>
      a.encodeExecuteBatch(
        ['0xDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF' as any],
        [0n, 0n],
        ['0x' as any],
      ),
    ).toThrow('Array lengths must match')
  })

  it('should throw on mismatch targets vs datas', () => {
    const a = new WdkSmartAccount({
      wdkAccount: mkWdk() as any,
      publicClient: mkClient() as any,
      chainId: 1,
    })
    expect(() =>
      a.encodeExecuteBatch(
        ['0xDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF' as any, MOCK_OWNER_2 as any],
        [0n, 0n],
        ['0x' as any],
      ),
    ).toThrow('Array lengths must match')
  })

  it('should encode single-element batch', () => {
    const a = new WdkSmartAccount({
      wdkAccount: mkWdk() as any,
      publicClient: mkClient() as any,
      chainId: 1,
    })
    const enc = a.encodeExecuteBatch(
      ['0xDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF' as any],
      [0n],
      ['0x' as any],
    )
    expect(enc).toMatch(/^0x/)
  })
})

describe('WdkSmartAccount buildInitializer (via getInitCode)', () => {
  it('should include module address in init code setup data', async () => {
    const a = new WdkSmartAccount({
      wdkAccount: mkWdk() as any,
      publicClient: mkClient() as any,
      chainId: 1,
    })
    const initCode = await a.getInitCode()
    expect(initCode.length).toBeGreaterThan(42)
    // The factory address should be present (via concat)
    const factoryLower = SAFE_4337_ADDRESSES.proxyFactory.toLowerCase().slice(2)
    expect(initCode.toLowerCase().includes(factoryLower)).toBe(true)
  })
})

describe('WdkSmartAccount multi-owner', () => {
  it('should manage multiple owners correctly', async () => {
    const a = new WdkSmartAccount({
      wdkAccount: mkWdk() as any,
      publicClient: mkClient() as any,
      chainId: 1,
      additionalOwners: [MOCK_OWNER_2 as any, MOCK_OWNER_3 as any],
      threshold: 2,
    })
    await a.initialize()
    const owners = a.getOwners()
    expect(owners).toHaveLength(3)
    expect(owners[0]).toBe(MOCK_OWNER)
    expect(owners).toContain(MOCK_OWNER_2)
    expect(owners).toContain(MOCK_OWNER_3)
    expect(a.getThreshold()).toBe(2)
    // getOwners returns a copy
    expect(a.getOwners()).not.toBe(a.getOwners())
    expect(a.getOwners()).toEqual(a.getOwners())
  })

  it('should not duplicate WDK owner when also in additionalOwners', async () => {
    const a = new WdkSmartAccount({
      wdkAccount: mkWdk() as any,
      publicClient: mkClient() as any,
      chainId: 1,
      additionalOwners: [MOCK_OWNER as any],
    })
    await a.initialize()
    const owners = a.getOwners()
    const unique = [...new Set(owners)]
    expect(owners).toHaveLength(unique.length)
  })
})

describe('createWdkSmartAccount factory', () => {
  it('should create and initialize via factory', async () => {
    const wdk = mkWdk()
    const a = await createWdkSmartAccount({
      wdkAccount: wdk as any,
      publicClient: mkClient() as any,
      chainId: 1,
    })
    expect(a).toBeInstanceOf(WdkSmartAccount)
    expect(wdk.getAddress).toHaveBeenCalledTimes(1)
    expect(a.getOwners()).toContain(MOCK_OWNER)
  })

  it('should propagate factory init errors', async () => {
    await expect(
      createWdkSmartAccount({
        wdkAccount: mkWdk({
          getAddress: vi.fn().mockRejectedValue(new Error('WDK error')),
        }) as any,
        publicClient: mkClient() as any,
        chainId: 1,
      }),
    ).rejects.toThrow('WDK error')
  })
})

describe('WdkSmartAccount.clearCache()', () => {
  it('should reset all cached state via clearCache', async () => {
    const mockGetCode = vi.fn().mockResolvedValue(undefined)
    const a = new WdkSmartAccount({
      wdkAccount: mkWdk() as any,
      publicClient: mkClient({ getCode: mockGetCode }) as any,
      chainId: 1,
    })
    await a.getAddress()
    await a.isDeployed()
    a.clearCache()
    await a.isDeployed()
    expect(mockGetCode).toHaveBeenCalledTimes(2)
  })
})
