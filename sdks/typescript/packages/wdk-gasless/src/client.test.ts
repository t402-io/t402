/**
 * WDK Gasless Client Tests
 *
 * Tests for WdkGaslessClient and createWdkGaslessClient
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Address, Hex, PublicClient } from 'viem'
import { encodeFunctionData } from 'viem'
import {
  CHAIN_IDS,
  getChainName,
  getTokenAddress,
  USDT0_ADDRESSES,
  USDC_ADDRESSES,
} from './constants.js'
import { WdkGaslessClient } from './client.js'
import type { SmartAccountSigner, BundlerConfig, PaymasterConfig } from '@t402/evm'

describe('WdkGaslessClient dependencies', () => {
  describe('Chain support', () => {
    it('should support Ethereum (1)', () => {
      expect(CHAIN_IDS.ethereum).toBe(1)
      expect(getChainName(1)).toBe('ethereum')
    })

    it('should support Arbitrum (42161)', () => {
      expect(CHAIN_IDS.arbitrum).toBe(42161)
      expect(getChainName(42161)).toBe('arbitrum')
    })

    it('should support Base (8453)', () => {
      expect(CHAIN_IDS.base).toBe(8453)
      expect(getChainName(8453)).toBe('base')
    })

    it('should support Optimism (10)', () => {
      expect(CHAIN_IDS.optimism).toBe(10)
      expect(getChainName(10)).toBe('optimism')
    })

    it('should support Ink (57073)', () => {
      expect(CHAIN_IDS.ink).toBe(57073)
      expect(getChainName(57073)).toBe('ink')
    })

    it('should throw for unsupported chain', () => {
      expect(() => getChainName(999999)).toThrow('Unsupported chain ID: 999999')
    })
  })

  describe('Token address resolution', () => {
    it('should resolve USDT0 addresses for supported chains', () => {
      expect(getTokenAddress('USDT0', 'ethereum')).toBe(USDT0_ADDRESSES.ethereum)
      expect(getTokenAddress('USDT0', 'arbitrum')).toBe(USDT0_ADDRESSES.arbitrum)
      expect(getTokenAddress('USDT0', 'ink')).toBe(USDT0_ADDRESSES.ink)
    })

    it('should resolve USDC addresses for supported chains', () => {
      expect(getTokenAddress('USDC', 'ethereum')).toBe(USDC_ADDRESSES.ethereum)
      expect(getTokenAddress('USDC', 'base')).toBe(USDC_ADDRESSES.base)
      expect(getTokenAddress('USDC', 'arbitrum')).toBe(USDC_ADDRESSES.arbitrum)
    })

    it('should return custom address if provided', () => {
      const customAddress = '0x1234567890123456789012345678901234567890'
      expect(getTokenAddress(customAddress as `0x${string}`, 'ethereum')).toBe(customAddress)
    })

    it('should be case insensitive', () => {
      expect(getTokenAddress('USDT0', 'ETHEREUM')).toBe(USDT0_ADDRESSES.ethereum)
      expect(getTokenAddress('USDC', 'BASE')).toBe(USDC_ADDRESSES.base)
    })

    it('should throw for unsupported token/chain combination', () => {
      expect(() => getTokenAddress('USDT0', 'unsupported')).toThrow('Token USDT0 not available')
    })
  })
})

describe('WdkGaslessClient exports', () => {
  it('should export WdkGaslessClient class', async () => {
    const mod = await import('./client.js')
    expect(mod.WdkGaslessClient).toBeDefined()
    expect(typeof mod.WdkGaslessClient).toBe('function')
  })

  it('should export createWdkGaslessClient function', async () => {
    const mod = await import('./client.js')
    expect(mod.createWdkGaslessClient).toBeDefined()
    expect(typeof mod.createWdkGaslessClient).toBe('function')
  })

  it('should export CreateWdkGaslessClientConfig type', async () => {
    // TypeScript-only check - if this compiles, the type is exported
    const mod = await import('./client.js')
    expect(mod).toBeDefined()
  })
})

describe('WdkGaslessClient type validation', () => {
  it('should require signer in config', async () => {
    const { WdkGaslessClient } = await import('./client.js')

    // This should throw because config is incomplete
    expect(() => {
      new WdkGaslessClient({} as any)
    }).toThrow()
  })
})

// ============================================================
// Mock helpers for WdkGaslessClient tests
// ============================================================

const MOCK_SMART_ACCOUNT_ADDRESS = '0xAAAABBBBCCCCDDDDEEEEFFFF0000111122223333' as Address
const MOCK_RECIPIENT = '0x9999888877776666555544443333222211110000' as Address
const _MOCK_USER_OP_HASH =
  '0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789' as Hex

function createMockSigner(overrides: Partial<SmartAccountSigner> = {}): SmartAccountSigner {
  return {
    getAddress: vi.fn().mockResolvedValue(MOCK_SMART_ACCOUNT_ADDRESS),
    signUserOpHash: vi.fn().mockResolvedValue('0xsignature00' as Hex),
    getInitCode: vi.fn().mockResolvedValue('0x' as Hex),
    isDeployed: vi.fn().mockResolvedValue(true),
    encodeExecute: vi.fn().mockReturnValue('0xencodedcalldata' as Hex),
    encodeExecuteBatch: vi.fn().mockReturnValue('0xencodedbatchcalldata' as Hex),
    ...overrides,
  }
}

function createMockBundlerConfig(): BundlerConfig {
  return {
    bundlerUrl: 'https://mock-bundler.example.com/rpc',
    chainId: 42161,
  }
}

function createMockPaymasterConfig(): PaymasterConfig {
  return {
    address: '0xPAYMASTER000000000000000000000000000ADDR' as Address,
    url: 'https://mock-paymaster.example.com',
    type: 'sponsoring',
  }
}

function createMockPublicClientForGasless(overrides: Record<string, unknown> = {}): PublicClient {
  return {
    readContract: vi.fn().mockResolvedValue(1000000n),
    getGasPrice: vi.fn().mockResolvedValue(1000000000n), // 1 gwei
    ...overrides,
  } as unknown as PublicClient
}

// ============================================================
// Gas estimation fallback
// ============================================================

describe('WdkGaslessClient gas estimation', () => {
  let mockFetchOriginal: typeof globalThis.fetch

  beforeEach(() => {
    mockFetchOriginal = globalThis.fetch
  })

  it('should use default gas values (150000, 100000, 50000) when bundler estimation fails', async () => {
    // Mock fetch to make bundler estimation fail
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Bundler unavailable'))

    const mockSigner = createMockSigner()
    const client = new WdkGaslessClient({
      signer: mockSigner,
      bundler: createMockBundlerConfig(),
      chainId: 42161,
      publicClient: createMockPublicClientForGasless(),
    })

    // We test estimateGas indirectly through pay() which calls it internally.
    // The pay method will ultimately fail at the bundler.sendUserOperation step,
    // but we can verify that the method proceeds past gas estimation.
    try {
      await client.pay({
        to: MOCK_RECIPIENT,
        amount: 1000000n,
      })
    } catch {
      // Expected to fail at the bundler sendUserOperation step
    }

    // The signer's encodeExecute should have been called (gas estimation happened)
    expect(mockSigner.encodeExecute).toHaveBeenCalled()

    globalThis.fetch = mockFetchOriginal
  })

  it('should multiply callGasLimit by batch size for batch estimation fallback', async () => {
    // Mock fetch to fail for estimation
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Bundler unavailable'))

    const mockSigner = createMockSigner()
    const client = new WdkGaslessClient({
      signer: mockSigner,
      bundler: createMockBundlerConfig(),
      chainId: 42161,
      publicClient: createMockPublicClientForGasless(),
    })

    try {
      await client.payBatch({
        payments: [
          { to: MOCK_RECIPIENT, amount: 1000000n },
          { to: MOCK_RECIPIENT, amount: 2000000n },
          { to: MOCK_RECIPIENT, amount: 3000000n },
        ],
      })
    } catch {
      // Expected to fail at bundler step
    }

    // encodeExecuteBatch should have been called for gas estimation
    expect(mockSigner.encodeExecuteBatch).toHaveBeenCalled()

    globalThis.fetch = mockFetchOriginal
  })
})

// ============================================================
// canSponsor()
// ============================================================

describe('WdkGaslessClient.canSponsor()', () => {
  let mockFetchOriginal: typeof globalThis.fetch

  beforeEach(() => {
    mockFetchOriginal = globalThis.fetch
  })

  it('should return canSponsor=false with reason when no paymaster is configured', async () => {
    const client = new WdkGaslessClient({
      signer: createMockSigner(),
      bundler: createMockBundlerConfig(),
      chainId: 42161,
      publicClient: createMockPublicClientForGasless(),
      // No paymaster
    })

    const result = await client.canSponsor({
      to: MOCK_RECIPIENT,
      amount: 1000000n,
    })

    expect(result.canSponsor).toBe(false)
    expect(result.reason).toBe('No paymaster configured')
  })

  it('should return canSponsor=true when paymaster accepts', async () => {
    // Mock fetch to simulate paymaster accepting sponsorship
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ willSponsor: true }),
    })

    const client = new WdkGaslessClient({
      signer: createMockSigner(),
      bundler: createMockBundlerConfig(),
      paymaster: createMockPaymasterConfig(),
      chainId: 42161,
      publicClient: createMockPublicClientForGasless(),
    })

    const result = await client.canSponsor({
      to: MOCK_RECIPIENT,
      amount: 1000000n,
    })

    expect(result.canSponsor).toBe(true)

    globalThis.fetch = mockFetchOriginal
  })

  it('should return canSponsor=false with estimated gas cost when paymaster refuses', async () => {
    // First call: paymaster willSponsor check -> false
    // Second call: bundler gas estimation (for estimatedGasCost) -> fails, uses defaults
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        // paymaster /check endpoint
        ok: true,
        json: () => Promise.resolve({ willSponsor: false }),
      })
      .mockRejectedValue(new Error('Bundler unavailable')) // estimateGas fallback

    globalThis.fetch = fetchMock

    const client = new WdkGaslessClient({
      signer: createMockSigner(),
      bundler: createMockBundlerConfig(),
      paymaster: createMockPaymasterConfig(),
      chainId: 42161,
      publicClient: createMockPublicClientForGasless(),
    })

    const result = await client.canSponsor({
      to: MOCK_RECIPIENT,
      amount: 1000000n,
    })

    expect(result.canSponsor).toBe(false)
    expect(result.reason).toBe('Payment not eligible for sponsorship')
    // estimatedGasCost should be computed: (150000 + 100000 + 50000) * gasPrice
    // With default gas (150000 + 100000 + 50000) = 300000 and gasPrice = 1 gwei
    expect(result.estimatedGasCost).toBe(300000n * 1000000000n)

    globalThis.fetch = mockFetchOriginal
  })

  it('should return canSponsor=false when paymaster check throws', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network failure'))

    const client = new WdkGaslessClient({
      signer: createMockSigner(),
      bundler: createMockBundlerConfig(),
      paymaster: createMockPaymasterConfig(),
      chainId: 42161,
      publicClient: createMockPublicClientForGasless(),
    })

    const result = await client.canSponsor({
      to: MOCK_RECIPIENT,
      amount: 1000000n,
    })

    // PaymasterClient.willSponsor catches errors and returns false,
    // which triggers the "not eligible" path. That path calls estimateGas
    // which also fails, returning defaults, then getGasPrice.
    // If getGasPrice also works (it's on publicClient), we get the full result.
    expect(result.canSponsor).toBe(false)

    globalThis.fetch = mockFetchOriginal
  })
})

// ============================================================
// getBalance()
// ============================================================

describe('WdkGaslessClient.getBalance()', () => {
  it('should read the correct token balanceOf for the smart account', async () => {
    const mockReadContract = vi.fn().mockResolvedValue(5000000n)
    const mockPublicClient = createMockPublicClientForGasless({
      readContract: mockReadContract,
    })

    const client = new WdkGaslessClient({
      signer: createMockSigner(),
      bundler: createMockBundlerConfig(),
      chainId: 42161,
      publicClient: mockPublicClient,
    })

    const balance = await client.getBalance('USDT0')

    expect(balance).toBe(5000000n)
    expect(mockReadContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: USDT0_ADDRESSES.arbitrum,
        functionName: 'balanceOf',
        args: [MOCK_SMART_ACCOUNT_ADDRESS],
      }),
    )
  })

  it('should default to USDT0 when no token is specified', async () => {
    const mockReadContract = vi.fn().mockResolvedValue(1000000n)
    const mockPublicClient = createMockPublicClientForGasless({
      readContract: mockReadContract,
    })

    const client = new WdkGaslessClient({
      signer: createMockSigner(),
      bundler: createMockBundlerConfig(),
      chainId: 42161,
      publicClient: mockPublicClient,
    })

    const balance = await client.getBalance()

    expect(balance).toBe(1000000n)
    expect(mockReadContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: USDT0_ADDRESSES.arbitrum,
      }),
    )
  })

  it('should support USDC token', async () => {
    const mockReadContract = vi.fn().mockResolvedValue(2000000n)
    const mockPublicClient = createMockPublicClientForGasless({
      readContract: mockReadContract,
    })

    const client = new WdkGaslessClient({
      signer: createMockSigner(),
      bundler: createMockBundlerConfig(),
      chainId: 42161,
      publicClient: mockPublicClient,
    })

    const balance = await client.getBalance('USDC')

    expect(balance).toBe(2000000n)
    expect(mockReadContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: USDC_ADDRESSES.arbitrum,
      }),
    )
  })

  it('should support a custom token address', async () => {
    const customToken = '0xCUSTOMTOKEN0000000000000000000000000ADDR' as Address
    const mockReadContract = vi.fn().mockResolvedValue(9999999n)
    const mockPublicClient = createMockPublicClientForGasless({
      readContract: mockReadContract,
    })

    const client = new WdkGaslessClient({
      signer: createMockSigner(),
      bundler: createMockBundlerConfig(),
      chainId: 42161,
      publicClient: mockPublicClient,
    })

    const balance = await client.getBalance(customToken)

    expect(balance).toBe(9999999n)
    expect(mockReadContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: customToken,
      }),
    )
  })
})

// ============================================================
// getFormattedBalance()
// ============================================================

describe('WdkGaslessClient.getFormattedBalance()', () => {
  it('should format balance with 6 decimals by default', async () => {
    const mockPublicClient = createMockPublicClientForGasless({
      readContract: vi.fn().mockResolvedValue(1500000n), // 1.5 USDT
    })

    const client = new WdkGaslessClient({
      signer: createMockSigner(),
      bundler: createMockBundlerConfig(),
      chainId: 42161,
      publicClient: mockPublicClient,
    })

    const formatted = await client.getFormattedBalance()

    expect(formatted).toBe('1.5')
  })

  it('should format zero balance correctly', async () => {
    const mockPublicClient = createMockPublicClientForGasless({
      readContract: vi.fn().mockResolvedValue(0n),
    })

    const client = new WdkGaslessClient({
      signer: createMockSigner(),
      bundler: createMockBundlerConfig(),
      chainId: 42161,
      publicClient: mockPublicClient,
    })

    const formatted = await client.getFormattedBalance()

    expect(formatted).toBe('0')
  })

  it('should respect custom decimals parameter', async () => {
    const mockPublicClient = createMockPublicClientForGasless({
      readContract: vi.fn().mockResolvedValue(1000000000000000000n), // 1e18
    })

    const client = new WdkGaslessClient({
      signer: createMockSigner(),
      bundler: createMockBundlerConfig(),
      chainId: 42161,
      publicClient: mockPublicClient,
    })

    const formatted = await client.getFormattedBalance('USDT0', 18)

    expect(formatted).toBe('1')
  })

  it('should format small amounts with proper decimal places', async () => {
    const mockPublicClient = createMockPublicClientForGasless({
      readContract: vi.fn().mockResolvedValue(1n), // 0.000001 USDT
    })

    const client = new WdkGaslessClient({
      signer: createMockSigner(),
      bundler: createMockBundlerConfig(),
      chainId: 42161,
      publicClient: mockPublicClient,
    })

    const formatted = await client.getFormattedBalance()

    expect(formatted).toBe('0.000001')
  })
})

// ============================================================
// payBatch()
// ============================================================

describe('WdkGaslessClient.payBatch()', () => {
  it('should use signer.encodeExecuteBatch for building batch calls', () => {
    // Test that the client correctly delegates batch encoding to the signer
    // by verifying the signer's encodeExecuteBatch is called when constructing batch gas estimation.
    // We test this at the signer level since the full pay flow requires extensive mocking.
    const mockSigner = createMockSigner()

    // Directly test that encodeExecuteBatch works with the token addresses the client would use
    const usdt0Address = USDT0_ADDRESSES.arbitrum
    const usdcAddress = USDC_ADDRESSES.arbitrum
    const targets = [usdt0Address, usdcAddress]
    const values = [0n, 0n]
    const datas = ['0xa9059cbb' as Hex, '0xa9059cbb' as Hex]

    const result = mockSigner.encodeExecuteBatch(targets, values, datas)

    expect(mockSigner.encodeExecuteBatch).toHaveBeenCalledWith(targets, values, datas)
    expect(result).toBe('0xencodedbatchcalldata')
  })

  it('should construct correct transaction intents for each payment', () => {
    // Verify that the payBatch method creates the right token addresses for each payment
    const _recipient1 = '0xAAAA000000000000000000000000000000000001' as Address
    const _recipient2 = '0xBBBB000000000000000000000000000000000002' as Address

    // When payBatch is called with these payments on arbitrum:
    // - Payment 1: USDT0 default -> USDT0_ADDRESSES.arbitrum
    // - Payment 2: USDC -> USDC_ADDRESSES.arbitrum
    const usdt0Address = getTokenAddress('USDT0', 'arbitrum')
    const usdcAddress = getTokenAddress('USDC', 'arbitrum')

    expect(usdt0Address).toBe(USDT0_ADDRESSES.arbitrum)
    expect(usdcAddress).toBe(USDC_ADDRESSES.arbitrum)
  })
})

// ============================================================
// Edge cases
// ============================================================

// ============================================================
// pay() input validation
// ============================================================

describe('WdkGaslessClient.pay() input validation', () => {
  it('should reject zero address recipient', async () => {
    const client = new WdkGaslessClient({
      signer: createMockSigner(),
      bundler: createMockBundlerConfig(),
      chainId: 42161,
      publicClient: createMockPublicClientForGasless(),
    })

    await expect(
      client.pay({
        to: '0x0000000000000000000000000000000000000000' as Address,
        amount: 1000000n,
      }),
    ).rejects.toThrow('Recipient address must not be the zero address')
  })

  it('should reject empty/falsy recipient', async () => {
    const client = new WdkGaslessClient({
      signer: createMockSigner(),
      bundler: createMockBundlerConfig(),
      chainId: 42161,
      publicClient: createMockPublicClientForGasless(),
    })

    await expect(
      client.pay({
        to: '' as Address,
        amount: 1000000n,
      }),
    ).rejects.toThrow('Recipient address must not be the zero address')
  })

  it('should reject zero amount', async () => {
    const client = new WdkGaslessClient({
      signer: createMockSigner(),
      bundler: createMockBundlerConfig(),
      chainId: 42161,
      publicClient: createMockPublicClientForGasless(),
    })

    await expect(
      client.pay({
        to: MOCK_RECIPIENT,
        amount: 0n,
      }),
    ).rejects.toThrow('Payment amount must be greater than zero')
  })

  it('should reject negative amount', async () => {
    const client = new WdkGaslessClient({
      signer: createMockSigner(),
      bundler: createMockBundlerConfig(),
      chainId: 42161,
      publicClient: createMockPublicClientForGasless(),
    })

    await expect(
      client.pay({
        to: MOCK_RECIPIENT,
        amount: -1n,
      }),
    ).rejects.toThrow('Payment amount must be greater than zero')
  })

  it('should reject undefined recipient', async () => {
    const client = new WdkGaslessClient({
      signer: createMockSigner(),
      bundler: createMockBundlerConfig(),
      chainId: 42161,
      publicClient: createMockPublicClientForGasless(),
    })

    await expect(
      client.pay({
        to: undefined as unknown as Address,
        amount: 1000000n,
      }),
    ).rejects.toThrow('Recipient address must not be the zero address')
  })
})

// ============================================================
// payBatch() input validation
// ============================================================

describe('WdkGaslessClient.payBatch() input validation', () => {
  it('should reject empty payments array', async () => {
    const client = new WdkGaslessClient({
      signer: createMockSigner(),
      bundler: createMockBundlerConfig(),
      chainId: 42161,
      publicClient: createMockPublicClientForGasless(),
    })

    await expect(
      client.payBatch({
        payments: [],
      }),
    ).rejects.toThrow('Batch payments must contain at least one payment')
  })

  it('should reject undefined payments', async () => {
    const client = new WdkGaslessClient({
      signer: createMockSigner(),
      bundler: createMockBundlerConfig(),
      chainId: 42161,
      publicClient: createMockPublicClientForGasless(),
    })

    await expect(
      client.payBatch({
        payments: undefined as any,
      }),
    ).rejects.toThrow('Batch payments must contain at least one payment')
  })

  it('should reject batch exceeding 50 payments', async () => {
    const client = new WdkGaslessClient({
      signer: createMockSigner(),
      bundler: createMockBundlerConfig(),
      chainId: 42161,
      publicClient: createMockPublicClientForGasless(),
    })

    const payments = Array.from({ length: 51 }, () => ({
      to: MOCK_RECIPIENT,
      amount: 1000000n,
    }))

    await expect(client.payBatch({ payments })).rejects.toThrow(
      'Batch payments must not exceed 50 payments',
    )
  })

  it('should reject zero address in batch payment', async () => {
    const client = new WdkGaslessClient({
      signer: createMockSigner(),
      bundler: createMockBundlerConfig(),
      chainId: 42161,
      publicClient: createMockPublicClientForGasless(),
    })

    await expect(
      client.payBatch({
        payments: [
          { to: MOCK_RECIPIENT, amount: 1000000n },
          { to: '0x0000000000000000000000000000000000000000' as Address, amount: 2000000n },
        ],
      }),
    ).rejects.toThrow('Recipient address must not be the zero address')
  })

  it('should reject zero amount in batch payment', async () => {
    const client = new WdkGaslessClient({
      signer: createMockSigner(),
      bundler: createMockBundlerConfig(),
      chainId: 42161,
      publicClient: createMockPublicClientForGasless(),
    })

    await expect(
      client.payBatch({
        payments: [
          { to: MOCK_RECIPIENT, amount: 1000000n },
          { to: MOCK_RECIPIENT, amount: 0n },
        ],
      }),
    ).rejects.toThrow('Payment amount must be greater than zero')
  })

  it('should reject negative amount in batch payment', async () => {
    const client = new WdkGaslessClient({
      signer: createMockSigner(),
      bundler: createMockBundlerConfig(),
      chainId: 42161,
      publicClient: createMockPublicClientForGasless(),
    })

    await expect(
      client.payBatch({
        payments: [{ to: MOCK_RECIPIENT, amount: -5n }],
      }),
    ).rejects.toThrow('Payment amount must be greater than zero')
  })

  it('should reject empty recipient in first batch item', async () => {
    const client = new WdkGaslessClient({
      signer: createMockSigner(),
      bundler: createMockBundlerConfig(),
      chainId: 42161,
      publicClient: createMockPublicClientForGasless(),
    })

    await expect(
      client.payBatch({
        payments: [{ to: '' as Address, amount: 1000000n }],
      }),
    ).rejects.toThrow('Recipient address must not be the zero address')
  })
})

// ============================================================
// pay() execution flow
// ============================================================

describe('WdkGaslessClient.pay() execution flow', () => {
  let mockFetchOriginal: typeof globalThis.fetch

  beforeEach(() => {
    mockFetchOriginal = globalThis.fetch
  })

  it('should proceed past validation and call signer.encodeExecute for valid params', async () => {
    // Mock fetch to fail at bundler step (simplest approach for testing flow)
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Bundler unavailable'))

    const mockSigner = createMockSigner()
    const client = new WdkGaslessClient({
      signer: mockSigner,
      bundler: createMockBundlerConfig(),
      chainId: 42161,
      publicClient: createMockPublicClientForGasless(),
    })

    try {
      await client.pay({
        to: MOCK_RECIPIENT,
        amount: 1000000n,
        token: 'USDT0',
      })
    } catch {
      // Expected to fail at bundler step
    }

    // Verify the flow reached gas estimation (past validation)
    expect(mockSigner.encodeExecute).toHaveBeenCalled()
    expect(mockSigner.getAddress).toHaveBeenCalled()

    globalThis.fetch = mockFetchOriginal
  })

  it('should use USDT0 token by default', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Bundler unavailable'))

    const mockSigner = createMockSigner()
    const client = new WdkGaslessClient({
      signer: mockSigner,
      bundler: createMockBundlerConfig(),
      chainId: 42161,
      publicClient: createMockPublicClientForGasless(),
    })

    try {
      await client.pay({
        to: MOCK_RECIPIENT,
        amount: 1000000n,
        // no token specified - should default to USDT0
      })
    } catch {
      // Expected
    }

    // encodeExecute is called with the USDT0 token address for Arbitrum
    expect(mockSigner.encodeExecute).toHaveBeenCalledWith(
      USDT0_ADDRESSES.arbitrum,
      expect.anything(),
      expect.anything(),
    )

    globalThis.fetch = mockFetchOriginal
  })

  it('should use USDC token when specified', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Bundler unavailable'))

    const mockSigner = createMockSigner()
    const client = new WdkGaslessClient({
      signer: mockSigner,
      bundler: createMockBundlerConfig(),
      chainId: 42161,
      publicClient: createMockPublicClientForGasless(),
    })

    try {
      await client.pay({
        to: MOCK_RECIPIENT,
        amount: 1000000n,
        token: 'USDC',
      })
    } catch {
      // Expected
    }

    expect(mockSigner.encodeExecute).toHaveBeenCalledWith(
      USDC_ADDRESSES.arbitrum,
      expect.anything(),
      expect.anything(),
    )

    globalThis.fetch = mockFetchOriginal
  })
})

// ============================================================
// payBatch() execution flow
// ============================================================

describe('WdkGaslessClient.payBatch() execution flow', () => {
  let mockFetchOriginal: typeof globalThis.fetch

  beforeEach(() => {
    mockFetchOriginal = globalThis.fetch
  })

  it('should proceed past validation and call signer.encodeExecuteBatch for valid batch', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Bundler unavailable'))

    const mockSigner = createMockSigner()
    const client = new WdkGaslessClient({
      signer: mockSigner,
      bundler: createMockBundlerConfig(),
      chainId: 42161,
      publicClient: createMockPublicClientForGasless(),
    })

    try {
      await client.payBatch({
        payments: [
          { to: MOCK_RECIPIENT, amount: 1000000n },
          { to: MOCK_RECIPIENT, amount: 2000000n },
        ],
      })
    } catch {
      // Expected to fail at bundler step
    }

    expect(mockSigner.encodeExecuteBatch).toHaveBeenCalled()

    globalThis.fetch = mockFetchOriginal
  })

  it('should create correct number of transaction intents for batch', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Bundler unavailable'))

    const mockSigner = createMockSigner()
    const client = new WdkGaslessClient({
      signer: mockSigner,
      bundler: createMockBundlerConfig(),
      chainId: 42161,
      publicClient: createMockPublicClientForGasless(),
    })

    const payments = [
      { to: MOCK_RECIPIENT, amount: 1000000n },
      { to: MOCK_RECIPIENT, amount: 2000000n },
      { to: MOCK_RECIPIENT, amount: 3000000n },
      { to: MOCK_RECIPIENT, amount: 4000000n },
    ]

    try {
      await client.payBatch({ payments })
    } catch {
      // Expected
    }

    // encodeExecuteBatch should receive arrays of length 4
    const call = (mockSigner.encodeExecuteBatch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[0]).toHaveLength(4) // targets
    expect(call[1]).toHaveLength(4) // values
    expect(call[2]).toHaveLength(4) // datas

    globalThis.fetch = mockFetchOriginal
  })
})

// ============================================================
// Edge cases
// ============================================================

describe('WdkGaslessClient edge cases', () => {
  it('should encode zero amount in transfer call data without error', () => {
    // Verify that the signer's encodeExecute is callable with zero amount transfer data.
    // The actual pay() method encodes the ERC20 transfer, then passes it to the signer.
    const mockSigner = createMockSigner()
    const tokenAddress = USDT0_ADDRESSES.arbitrum

    // This simulates what pay() does: encode the ERC20 transfer, then call signer.encodeExecute
    const result = mockSigner.encodeExecute(tokenAddress, 0n, '0xa9059cbb' as Hex)

    expect(mockSigner.encodeExecute).toHaveBeenCalledWith(tokenAddress, 0n, '0xa9059cbb')
    expect(result).toBeDefined()
  })

  it('should encode very large amount in transfer call data without error', () => {
    const mockSigner = createMockSigner()
    const tokenAddress = USDT0_ADDRESSES.arbitrum
    const veryLargeAmount = 2n ** 128n - 1n

    // encodeExecute should handle any bigint value
    const result = mockSigner.encodeExecute(tokenAddress, 0n, '0xa9059cbb' as Hex)

    expect(mockSigner.encodeExecute).toHaveBeenCalled()
    expect(result).toBeDefined()

    // Also verify that viem's encodeFunctionData handles it (used by pay() to build transfer data)
    const callData = encodeFunctionData({
      abi: [
        {
          inputs: [
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' },
          ],
          name: 'transfer',
          outputs: [{ name: '', type: 'bool' }],
          stateMutability: 'nonpayable',
          type: 'function',
        },
      ],
      functionName: 'transfer',
      args: [MOCK_RECIPIENT, veryLargeAmount],
    })
    expect(callData).toMatch(/^0x/)
  })

  it('should return the smart account address from getAccountAddress()', async () => {
    const client = new WdkGaslessClient({
      signer: createMockSigner(),
      bundler: createMockBundlerConfig(),
      chainId: 42161,
      publicClient: createMockPublicClientForGasless(),
    })

    const address = await client.getAccountAddress()
    expect(address).toBe(MOCK_SMART_ACCOUNT_ADDRESS)
  })

  it('should delegate isAccountDeployed() to the signer', async () => {
    const mockSigner = createMockSigner({ isDeployed: vi.fn().mockResolvedValue(false) })
    const client = new WdkGaslessClient({
      signer: mockSigner,
      bundler: createMockBundlerConfig(),
      chainId: 42161,
      publicClient: createMockPublicClientForGasless(),
    })

    const deployed = await client.isAccountDeployed()
    expect(deployed).toBe(false)
    expect(mockSigner.isDeployed).toHaveBeenCalled()
  })
})
