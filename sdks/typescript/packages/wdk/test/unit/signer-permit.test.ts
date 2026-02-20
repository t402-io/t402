import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WDKSigner } from '../../src/signer'
import { SigningError } from '../../src/errors'
import type { WDKInstance, WDKAccount } from '../../src/types'

// Create a mock account that returns a valid 65-byte signature
function createMockAccount(address: string): WDKAccount {
  // 65-byte signature: 32 bytes r + 32 bytes s + 1 byte v
  const mockSig =
    '0x' +
    'aa'.repeat(32) + // r
    'bb'.repeat(32) + // s
    '1b' // v = 27
  return {
    getAddress: vi.fn().mockResolvedValue(address),
    getBalance: vi.fn().mockResolvedValue(1000000000000000000n),
    getTokenBalance: vi.fn().mockResolvedValue(1000000n),
    signMessage: vi.fn().mockResolvedValue('0xsignature1234'),
    signTypedData: vi.fn().mockResolvedValue(mockSig),
    sendTransaction: vi.fn().mockResolvedValue('0xtxhash'),
    estimateGas: vi.fn().mockResolvedValue(21000n),
  }
}

function createMockWDK(account?: WDKAccount): WDKInstance {
  const mockAccount = account ?? createMockAccount('0x1234567890123456789012345678901234567890')
  return {
    registerWallet: vi.fn().mockReturnThis(),
    registerProtocol: vi.fn().mockReturnThis(),
    getAccount: vi.fn().mockResolvedValue(mockAccount),
    executeProtocol: vi.fn().mockResolvedValue({ txHash: '0xbridgehash' }),
  }
}

describe('WDKSigner.signPermit', () => {
  let signer: WDKSigner
  let mockAccount: WDKAccount

  beforeEach(async () => {
    mockAccount = createMockAccount('0x1234567890123456789012345678901234567890')
    const wdk = createMockWDK(mockAccount)
    signer = new WDKSigner(wdk, 'arbitrum')
    await signer.initialize()
  })

  it('should sign a permit with default parameters', async () => {
    const result = await signer.signPermit({
      token: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      spender: '0xC88f67e776f16DcFBf42e6bDda1B82604448899B',
      value: 1000000n,
      deadline: 1700000000,
    })

    expect(result.v).toBe(27)
    expect(result.r).toBe('0x' + 'aa'.repeat(32))
    expect(result.s).toBe('0x' + 'bb'.repeat(32))
  })

  it('should use default token name and version', async () => {
    await signer.signPermit({
      token: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      spender: '0xC88f67e776f16DcFBf42e6bDda1B82604448899B',
      value: 1000000n,
      deadline: 1700000000,
    })

    expect(mockAccount.signTypedData).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: expect.objectContaining({
          name: 'Tether USD',
          version: '1',
        }),
        primaryType: 'Permit',
      }),
    )
  })

  it('should accept custom token name and version', async () => {
    await signer.signPermit({
      token: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      spender: '0xC88f67e776f16DcFBf42e6bDda1B82604448899B',
      value: 1000000n,
      deadline: 1700000000,
      tokenName: 'USD Coin',
      tokenVersion: '2',
    })

    expect(mockAccount.signTypedData).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: expect.objectContaining({
          name: 'USD Coin',
          version: '2',
        }),
      }),
    )
  })

  it('should include correct chainId in domain', async () => {
    await signer.signPermit({
      token: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      spender: '0xC88f67e776f16DcFBf42e6bDda1B82604448899B',
      value: 1000000n,
      deadline: 1700000000,
    })

    expect(mockAccount.signTypedData).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: expect.objectContaining({
          chainId: 42161n, // arbitrum chain ID as bigint
          verifyingContract: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
        }),
      }),
    )
  })

  it('should include correct message fields', async () => {
    await signer.signPermit({
      token: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      spender: '0xC88f67e776f16DcFBf42e6bDda1B82604448899B',
      value: 5000000n,
      deadline: 1700000000,
      nonce: 3n,
    })

    expect(mockAccount.signTypedData).toHaveBeenCalledWith(
      expect.objectContaining({
        message: {
          owner: '0x1234567890123456789012345678901234567890',
          spender: '0xC88f67e776f16DcFBf42e6bDda1B82604448899B',
          value: '5000000',
          nonce: '3',
          deadline: '1700000000',
        },
      }),
    )
  })

  it('should default nonce to 0', async () => {
    await signer.signPermit({
      token: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      spender: '0xC88f67e776f16DcFBf42e6bDda1B82604448899B',
      value: 1000000n,
      deadline: 1700000000,
    })

    expect(mockAccount.signTypedData).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({
          nonce: '0',
        }),
      }),
    )
  })

  it('should normalize v < 27 to v + 27', async () => {
    // Signature with v = 0 (should be normalized to 27)
    const sigWithLowV = '0x' + 'cc'.repeat(32) + 'dd'.repeat(32) + '00' // v = 0
    ;(mockAccount.signTypedData as ReturnType<typeof vi.fn>).mockResolvedValue(sigWithLowV)

    const result = await signer.signPermit({
      token: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      spender: '0xC88f67e776f16DcFBf42e6bDda1B82604448899B',
      value: 1000000n,
      deadline: 1700000000,
    })

    expect(result.v).toBe(27)
    expect(result.r).toBe('0x' + 'cc'.repeat(32))
    expect(result.s).toBe('0x' + 'dd'.repeat(32))
  })

  it('should throw on invalid token address', async () => {
    await expect(
      signer.signPermit({
        token: 'invalid' as `0x${string}`,
        spender: '0xC88f67e776f16DcFBf42e6bDda1B82604448899B',
        value: 1000000n,
        deadline: 1700000000,
      }),
    ).rejects.toThrow(SigningError)
    await expect(
      signer.signPermit({
        token: 'invalid' as `0x${string}`,
        spender: '0xC88f67e776f16DcFBf42e6bDda1B82604448899B',
        value: 1000000n,
        deadline: 1700000000,
      }),
    ).rejects.toThrow('Invalid token address')
  })

  it('should throw on invalid spender address', async () => {
    await expect(
      signer.signPermit({
        token: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
        spender: 'notanaddress' as `0x${string}`,
        value: 1000000n,
        deadline: 1700000000,
      }),
    ).rejects.toThrow(SigningError)
    await expect(
      signer.signPermit({
        token: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
        spender: 'notanaddress' as `0x${string}`,
        value: 1000000n,
        deadline: 1700000000,
      }),
    ).rejects.toThrow('Invalid spender address')
  })

  it('should propagate signing errors from signTypedData', async () => {
    ;(mockAccount.signTypedData as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('User rejected'),
    )

    await expect(
      signer.signPermit({
        token: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
        spender: '0xC88f67e776f16DcFBf42e6bDda1B82604448899B',
        value: 1000000n,
        deadline: 1700000000,
      }),
    ).rejects.toThrow(SigningError)
  })

  it('should include correct EIP-712 types', async () => {
    await signer.signPermit({
      token: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      spender: '0xC88f67e776f16DcFBf42e6bDda1B82604448899B',
      value: 1000000n,
      deadline: 1700000000,
    })

    expect(mockAccount.signTypedData).toHaveBeenCalledWith(
      expect.objectContaining({
        types: {
          Permit: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
          ],
        },
      }),
    )
  })
})
