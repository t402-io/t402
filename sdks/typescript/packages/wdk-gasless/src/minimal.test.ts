import { describe, it, expect, vi } from 'vitest'

vi.mock('viem', () => ({
  encodeFunctionData: (args: any) => {
    if (args.functionName === 'executeUserOp') return '0x7bb37428' + '00'.repeat(128)
    if (args.functionName === 'executeUserOpBatch') return '0xbatch428' + '00'.repeat(128)
    if (args.functionName === 'enableModules') return '0xenablemod' + '00'.repeat(64)
    if (args.functionName === 'setup') return '0xsetup000' + '00'.repeat(128)
    if (args.functionName === 'createProxyWithNonce') return '0xfactory0' + '00'.repeat(64)
    return '0xdeadbeef'
  },
  encodeAbiParameters: () => '0x' + 'ab'.repeat(32),
  concat: (parts: string[]) => {
    let result = parts[0]
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i]
      result += part.startsWith('0x') ? part.slice(2) : part
    }
    return result
  },
  keccak256: () => '0x' + 'ff'.repeat(32),
  getContractAddress: () => '0x00000000000000000000000000000000DeAdBeEf',
}))

import { WdkSmartAccount, SAFE_4337_ADDRESSES } from './account.js'

const MOCK_OWNER = '0xABCDEF0123456789ABCDEF0123456789ABCDEF01'
const MOCK_SIG =
  '0xaabbccdd00000000000000000000000000000000000000000000000000000000001111111111111111111111111111111111111111111111111111111111111111ab'

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
    readContract: vi.fn().mockResolvedValue('0x608060'),
    getCode: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('test1', () => {
  it('constructor', () => {
    const a = new WdkSmartAccount({
      wdkAccount: mkWdk() as any,
      publicClient: mkClient() as any,
      chainId: 1,
    })
    expect(a).toBeInstanceOf(WdkSmartAccount)
  })

  it('initialize', async () => {
    const a = new WdkSmartAccount({
      wdkAccount: mkWdk() as any,
      publicClient: mkClient() as any,
      chainId: 1,
    })
    await a.initialize()
    expect(a.getOwners()[0]).toBe(MOCK_OWNER)
  })
})
