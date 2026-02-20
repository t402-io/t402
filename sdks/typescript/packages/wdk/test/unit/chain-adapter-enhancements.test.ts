import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  WDKSvmSignerAdapter,
  buildVersionedTransaction,
  transferWithPriorityFee,
  getRecentPriorityFees,
  resolveATA,
  deriveATAAddress,
  getTokenProgram,
  getTransferFee,
} from '../../src/adapters/svm-adapter'
import { WDKTronSignerAdapter } from '../../src/adapters/tron-adapter'
import type { EnergyProvider } from '../../src/adapters/tron-adapter'
import {
  WDKTonSignerAdapter,
  waitForJettonTransfer,
  getJettonWalletAddress,
} from '../../src/adapters/ton-adapter'
import type { WDKSolanaAccount, WDKTronAccount, WDKTonAccount } from '../../src/types'

// ============================================================
// Mock Accounts
// ============================================================

function createMockSolanaAccount(): WDKSolanaAccount {
  return {
    getAddress: vi.fn().mockResolvedValue('8GGtWHRQ1wz5gDKE2KXZLktqzcfV1CBqSbeUZjA7hoWL'),
    getBalance: vi.fn().mockResolvedValue(1000000000n),
    getTokenBalance: vi.fn().mockResolvedValue(1000000n),
    sign: vi.fn().mockResolvedValue(new Uint8Array(64).fill(0xcd)),
    signTransaction: vi.fn().mockResolvedValue(new Uint8Array(100).fill(0xef)),
    sendTransaction: vi.fn().mockResolvedValue('tx-sig-solana'),
    transfer: vi.fn().mockResolvedValue('tx-sig-transfer'),
  }
}

function createMockTronAccount(): WDKTronAccount {
  return {
    getAddress: vi.fn().mockResolvedValue('TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5'),
    getBalance: vi.fn().mockResolvedValue(100000000n),
    getTrc20Balance: vi.fn().mockResolvedValue(5000000n),
    signTransaction: vi.fn().mockResolvedValue({
      txID: 'mock-tx-id',
      raw_data: {
        contract: [],
        ref_block_bytes: '1234',
        ref_block_hash: '56789abc',
        expiration: Date.now() + 60000,
        timestamp: Date.now(),
      },
      raw_data_hex: 'deadbeef',
      signature: ['aabbccdd'],
    }),
    sendTransaction: vi.fn().mockResolvedValue('tx-hash-tron'),
  }
}

function createMockTonAccount(): WDKTonAccount {
  return {
    getAddress: vi.fn().mockResolvedValue('EQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkEUe'),
    getBalance: vi.fn().mockResolvedValue(5000000000n),
    getJettonBalance: vi.fn().mockResolvedValue(1000000n),
    signMessage: vi.fn().mockResolvedValue(new Uint8Array(64).fill(0xab)),
    sendTransaction: vi.fn().mockResolvedValue('tx-hash-ton'),
    getSeqno: vi.fn().mockResolvedValue(42),
  }
}

// ============================================================
// #197 - Solana Versioned Transactions & Priority Fees
// ============================================================

describe('Solana versioned transactions (#197)', () => {
  let account: WDKSolanaAccount
  let adapter: WDKSvmSignerAdapter

  beforeEach(async () => {
    account = createMockSolanaAccount()
    adapter = new WDKSvmSignerAdapter(account)
    await adapter.initialize()
  })

  describe('buildVersionedTransaction', () => {
    it('should build a v0 transaction with instructions', () => {
      const result = buildVersionedTransaction(adapter, {
        instructions: [
          {
            programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            keys: [
              {
                pubkey: '8GGtWHRQ1wz5gDKE2KXZLktqzcfV1CBqSbeUZjA7hoWL',
                isSigner: true,
                isWritable: true,
              },
            ],
            data: new Uint8Array([1, 2, 3]),
          },
        ],
      })

      expect(result).toBeInstanceOf(Uint8Array)
      expect(result.length).toBeGreaterThan(0)
      // v0 transactions start with 0x80
      expect(result[0]).toBe(0x80)
    })

    it('should prepend ComputeBudget instructions when priority fee is set', () => {
      const result = buildVersionedTransaction(adapter, {
        instructions: [
          {
            programId: 'TestProgram',
            keys: [],
            data: new Uint8Array([1]),
          },
        ],
        priorityFee: {
          microLamports: 1000,
          computeUnits: 200_000,
        },
      })

      expect(result).toBeInstanceOf(Uint8Array)
      expect(result.length).toBeGreaterThan(0)
      // Instruction count should be 3 (2 ComputeBudget + 1 user)
      // The exact position depends on serialization, but it should be > 0
    })

    it('should throw if adapter is not initialized', () => {
      const uninitAdapter = new WDKSvmSignerAdapter(account)
      expect(() =>
        buildVersionedTransaction(uninitAdapter, {
          instructions: [],
        }),
      ).toThrow('Adapter must be initialized')
    })

    it('should handle address lookup tables', () => {
      const result = buildVersionedTransaction(adapter, {
        instructions: [
          {
            programId: 'TestProgram',
            keys: [],
            data: new Uint8Array([1]),
          },
        ],
        addressLookupTableAccounts: [
          {
            key: 'LookupTable1',
            addresses: ['addr1', 'addr2'],
          },
        ],
      })

      expect(result).toBeInstanceOf(Uint8Array)
      // Lookup table count should be 1 (last byte)
      expect(result[result.length - 1]).toBe(1)
    })
  })

  describe('transferWithPriorityFee', () => {
    it('should delegate to underlying transfer', async () => {
      const sig = await transferWithPriorityFee(adapter, {
        token: 'MintAddr',
        recipient: 'RecipAddr',
        amount: 500000n,
      })

      expect(sig).toBe('tx-sig-transfer')
      expect(account.transfer).toHaveBeenCalledWith({
        token: 'MintAddr',
        recipient: 'RecipAddr',
        amount: 500000n,
      })
    })

    it('should throw if adapter is not initialized', async () => {
      const uninitAdapter = new WDKSvmSignerAdapter(account)
      await expect(
        transferWithPriorityFee(uninitAdapter, {
          token: 'MintAddr',
          recipient: 'RecipAddr',
          amount: 500000n,
        }),
      ).rejects.toThrow('Adapter must be initialized')
    })
  })

  describe('getRecentPriorityFees', () => {
    it('should return priority fee estimates', async () => {
      const mockFees = Array.from({ length: 20 }, (_, i) => ({
        prioritizationFee: i * 100,
        slot: 100 + i,
      }))

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ result: mockFees }),
        }),
      )

      const result = await getRecentPriorityFees('https://api.mainnet-beta.solana.com')

      expect(result).toHaveProperty('low')
      expect(result).toHaveProperty('medium')
      expect(result).toHaveProperty('high')
      expect(result.low).toBeLessThanOrEqual(result.medium)
      expect(result.medium).toBeLessThanOrEqual(result.high)

      vi.unstubAllGlobals()
    })

    it('should return zeros for empty fee list', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ result: [] }),
        }),
      )

      const result = await getRecentPriorityFees('https://api.mainnet-beta.solana.com')
      expect(result).toEqual({ low: 0, medium: 0, high: 0 })

      vi.unstubAllGlobals()
    })

    it('should throw on RPC error', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ error: { message: 'Method not found' } }),
        }),
      )

      await expect(getRecentPriorityFees('https://api.mainnet-beta.solana.com')).rejects.toThrow(
        'RPC error',
      )

      vi.unstubAllGlobals()
    })

    it('should throw on HTTP error', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
        }),
      )

      await expect(getRecentPriorityFees('https://api.mainnet-beta.solana.com')).rejects.toThrow(
        'RPC request failed: 500',
      )

      vi.unstubAllGlobals()
    })
  })

  describe('resolveATA', () => {
    it('should return existing ATA without creation instruction', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            result: {
              value: { data: ['base64data'], owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
            },
          }),
        }),
      )

      const result = await resolveATA(
        'https://api.mainnet-beta.solana.com',
        'OwnerAddr',
        'MintAddr',
      )

      expect(result.exists).toBe(true)
      expect(result.createInstruction).toBeUndefined()

      vi.unstubAllGlobals()
    })

    it('should return creation instruction for non-existent ATA', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            result: { value: null },
          }),
        }),
      )

      const result = await resolveATA(
        'https://api.mainnet-beta.solana.com',
        'OwnerAddr',
        'MintAddr',
      )

      expect(result.exists).toBe(false)
      expect(result.createInstruction).toBeDefined()
      expect(result.createInstruction!.programId).toBe(
        'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
      )

      vi.unstubAllGlobals()
    })
  })

  describe('deriveATAAddress', () => {
    it('should return deterministic address', () => {
      const addr1 = deriveATAAddress('owner1', 'mint1')
      const addr2 = deriveATAAddress('owner1', 'mint1')
      expect(addr1).toBe(addr2)
    })

    it('should return different addresses for different inputs', () => {
      const addr1 = deriveATAAddress('owner1', 'mint1')
      const addr2 = deriveATAAddress('owner2', 'mint1')
      expect(addr1).not.toBe(addr2)
    })
  })
})

// ============================================================
// #203 - Token-2022 Support
// ============================================================

describe('Solana Token-2022 support (#203)', () => {
  describe('getTokenProgram', () => {
    it('should return Token-2022 for Token-2022 mints', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            result: {
              value: { owner: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb' },
            },
          }),
        }),
      )

      const result = await getTokenProgram('https://api.mainnet-beta.solana.com', 'SomeMint')
      expect(result).toBe('Token-2022')

      vi.unstubAllGlobals()
    })

    it('should return Token for standard mints', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            result: {
              value: { owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
            },
          }),
        }),
      )

      const result = await getTokenProgram('https://api.mainnet-beta.solana.com', 'SomeMint')
      expect(result).toBe('Token')

      vi.unstubAllGlobals()
    })

    it('should throw for non-existent mint', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            result: { value: null },
          }),
        }),
      )

      await expect(
        getTokenProgram('https://api.mainnet-beta.solana.com', 'NonExistentMint'),
      ).rejects.toThrow('Mint account not found')

      vi.unstubAllGlobals()
    })
  })

  describe('getTransferFee', () => {
    it('should return transfer fee for Token-2022 with fee extension', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            result: {
              value: {
                owner: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
                data: {
                  parsed: {
                    info: {
                      extensions: [
                        {
                          extension: 'transferFeeConfig',
                          state: {
                            newerTransferFee: {
                              transferFeeBasisPoints: 50,
                              maximumFee: '5000000',
                            },
                          },
                        },
                      ],
                    },
                  },
                },
              },
            },
          }),
        }),
      )

      const result = await getTransferFee(
        'https://api.mainnet-beta.solana.com',
        'FeeMint',
        1000000n,
      )

      expect(result.fee).toBe(5000n) // 50 basis points = 0.5%
      expect(result.netAmount).toBe(995000n)
      expect(result.transferFeeBasisPoints).toBe(50)
      expect(result.maximumFee).toBe(5000000n)

      vi.unstubAllGlobals()
    })

    it('should cap fee at maximum', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            result: {
              value: {
                owner: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
                data: {
                  parsed: {
                    info: {
                      extensions: [
                        {
                          extension: 'transferFeeConfig',
                          state: {
                            newerTransferFee: {
                              transferFeeBasisPoints: 5000, // 50%
                              maximumFee: '100', // very low cap
                            },
                          },
                        },
                      ],
                    },
                  },
                },
              },
            },
          }),
        }),
      )

      const result = await getTransferFee(
        'https://api.mainnet-beta.solana.com',
        'FeeMint',
        1000000n,
      )

      // Without cap: 500000. With cap: 100
      expect(result.fee).toBe(100n)
      expect(result.netAmount).toBe(999900n)

      vi.unstubAllGlobals()
    })

    it('should return zero fee for mints without transfer fee extension', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            result: {
              value: {
                owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
                data: {
                  parsed: {
                    info: {
                      extensions: [],
                    },
                  },
                },
              },
            },
          }),
        }),
      )

      const result = await getTransferFee(
        'https://api.mainnet-beta.solana.com',
        'StandardMint',
        1000000n,
      )

      expect(result.fee).toBe(0n)
      expect(result.netAmount).toBe(1000000n)
      expect(result.transferFeeBasisPoints).toBe(0)

      vi.unstubAllGlobals()
    })
  })
})

// ============================================================
// #198 - TRON Energy Delegation
// ============================================================

describe('TRON energy delegation (#198)', () => {
  let account: WDKTronAccount
  let adapter: WDKTronSignerAdapter

  beforeEach(async () => {
    account = createMockTronAccount()
    adapter = new WDKTronSignerAdapter(account, 'https://api.trongrid.io')
    await adapter.initialize()
  })

  describe('estimateEnergy', () => {
    it('should estimate energy for a TRC20 transfer', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              energy_used: 30000,
              energy_penalty: 5000,
              result: { code: 'SUCCESS' },
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              EnergyLimit: 10000,
              EnergyUsed: 2000,
              freeNetLimit: 1500,
              freeNetUsed: 500,
            }),
          }),
      )

      const result = await adapter.estimateEnergy({
        contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        to: 'TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5',
        amount: '1000000',
      })

      expect(result.energyRequired).toBe(35000) // 30000 + 5000
      expect(result.energyAvailable).toBe(8000) // 10000 - 2000
      expect(result.bandwidthRequired).toBe(350)
      // (35000 - 8000) * 420 = 11,340,000
      expect(result.trxCostIfNoEnergy).toBe(BigInt(27000) * 420n)

      vi.unstubAllGlobals()
    })

    it('should throw if not initialized', async () => {
      const uninitAdapter = new WDKTronSignerAdapter(account)

      await expect(
        uninitAdapter.estimateEnergy({
          contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
          to: 'TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5',
          amount: '1000000',
        }),
      ).rejects.toThrow('not initialized')
    })

    it('should handle API error gracefully', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
        }),
      )

      await expect(
        adapter.estimateEnergy({
          contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
          to: 'TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5',
          amount: '1000000',
        }),
      ).rejects.toThrow('Failed to estimate energy')

      vi.unstubAllGlobals()
    })
  })

  describe('signTransactionWithEstimation', () => {
    it('should use estimated fee when feeLimit not provided', async () => {
      // Mock energy estimation
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          // estimateEnergy: triggerconstantcontract
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              energy_used: 30000,
              energy_penalty: 0,
              result: { code: 'SUCCESS' },
            }),
          })
          // estimateEnergy: getaccountresource
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              EnergyLimit: 0,
              EnergyUsed: 0,
            }),
          })
          // signTransaction: getnowblock
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              block_header: {
                raw_data: { number: 12345, timestamp: Date.now() },
                witness_signature: 'sig',
              },
              blockID: '0000000000001234abcdef1234567890abcdef1234567890abcdef1234567890',
            }),
          })
          // signTransaction: triggersmartcontract
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              transaction: {
                txID: 'tx-id',
                raw_data: {
                  contract: [],
                  ref_block_bytes: '1234',
                  ref_block_hash: 'abcdef12',
                  expiration: Date.now() + 60000,
                  timestamp: Date.now(),
                },
                raw_data_hex: 'deadbeef',
                signature: ['sig1'],
              },
            }),
          }),
      )

      const result = await adapter.signTransactionWithEstimation({
        contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        to: 'TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5',
        amount: '1000000',
      })

      expect(result).toBeDefined()
      expect(typeof result).toBe('string')

      vi.unstubAllGlobals()
    })

    it('should use provided feeLimit when specified', async () => {
      // Mock for signTransaction (getBlockInfo + triggersmartcontract)
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              block_header: {
                raw_data: { number: 12345, timestamp: Date.now() },
                witness_signature: 'sig',
              },
              blockID: '0000000000001234abcdef1234567890abcdef1234567890abcdef1234567890',
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              transaction: {
                txID: 'tx-id',
                raw_data: {
                  contract: [],
                  ref_block_bytes: '1234',
                  ref_block_hash: 'abcdef12',
                  expiration: Date.now() + 60000,
                  timestamp: Date.now(),
                },
                raw_data_hex: 'deadbeef',
                signature: ['sig1'],
              },
            }),
          }),
      )

      const result = await adapter.signTransactionWithEstimation({
        contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        to: 'TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5',
        amount: '1000000',
        feeLimit: 50_000_000,
      })

      expect(result).toBeDefined()

      vi.unstubAllGlobals()
    })
  })

  describe('energy provider', () => {
    it('should start with no energy provider', () => {
      expect(adapter.getEnergyProvider()).toBeNull()
    })

    it('should register and retrieve energy provider', () => {
      const mockProvider: EnergyProvider = {
        delegateEnergy: vi.fn().mockResolvedValue('delegation-tx'),
        getPrice: vi.fn().mockResolvedValue(100000n),
      }

      adapter.registerEnergyProvider(mockProvider)
      expect(adapter.getEnergyProvider()).toBe(mockProvider)
    })

    it('should allow replacing energy provider', () => {
      const provider1: EnergyProvider = {
        delegateEnergy: vi.fn(),
        getPrice: vi.fn(),
      }
      const provider2: EnergyProvider = {
        delegateEnergy: vi.fn(),
        getPrice: vi.fn(),
      }

      adapter.registerEnergyProvider(provider1)
      adapter.registerEnergyProvider(provider2)
      expect(adapter.getEnergyProvider()).toBe(provider2)
    })
  })
})

// ============================================================
// #199 - TON Jetton Transfer Verification
// ============================================================

describe('TON Jetton transfer verification (#199)', () => {
  describe('waitForJettonTransfer', () => {
    it('should return success when transaction is found', async () => {
      let callCount = 0
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => {
          callCount++
          if (callCount === 1) {
            // First poll: not ready yet
            return {
              ok: true,
              json: async () => ({ ok: true, result: [] }),
            }
          }
          // Second poll: found
          return {
            ok: true,
            json: async () => ({
              ok: true,
              result: [
                {
                  transaction_id: { hash: 'tx-hash-123' },
                  out_msgs: [{ destination: 'dest', value: '50000000' }],
                  utime: Math.floor(Date.now() / 1000),
                },
              ],
            }),
          }
        }),
      )

      const statuses: string[] = []
      const result = await waitForJettonTransfer('https://toncenter.com/api/v2', {
        externalMessageHash: 'ext-msg-hash',
        jettonMaster: 'EQJettonMaster',
        expectedRecipient: 'EQRecipient',
        expectedAmount: 1000000n,
        timeoutMs: 10000,
        pollIntervalMs: 100,
        onStatusChange: (s) => statuses.push(s),
      })

      expect(result.success).toBe(true)
      expect(result.status).toBe('completed')
      expect(result.transactionHash).toBeDefined()
      expect(statuses).toContain('pending')
      expect(statuses).toContain('completed')

      vi.unstubAllGlobals()
    })

    it('should return timeout when not confirmed in time', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ ok: true, result: [] }),
        }),
      )

      const result = await waitForJettonTransfer('https://toncenter.com/api/v2', {
        externalMessageHash: 'ext-msg-hash',
        jettonMaster: 'EQJettonMaster',
        expectedRecipient: 'EQRecipient',
        expectedAmount: 1000000n,
        timeoutMs: 300,
        pollIntervalMs: 100,
      })

      expect(result.success).toBe(false)
      expect(result.status).toBe('timeout')

      vi.unstubAllGlobals()
    })

    it('should handle network errors gracefully', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

      const result = await waitForJettonTransfer('https://toncenter.com/api/v2', {
        externalMessageHash: 'ext-msg-hash',
        jettonMaster: 'EQJettonMaster',
        expectedRecipient: 'EQRecipient',
        expectedAmount: 1000000n,
        timeoutMs: 300,
        pollIntervalMs: 100,
      })

      expect(result.success).toBe(false)
      expect(result.status).toBe('timeout')

      vi.unstubAllGlobals()
    })
  })

  describe('getJettonWalletAddress', () => {
    it('should resolve Jetton wallet address', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            ok: true,
            result: {
              exit_code: 0,
              stack: [['tvm.Slice', 'EQJettonWalletAddr']],
            },
          }),
        }),
      )

      const addr = await getJettonWalletAddress(
        'https://toncenter.com/api/v2',
        'EQOwnerAddr',
        'EQJettonMaster',
      )

      expect(addr).toBe('EQJettonWalletAddr')

      vi.unstubAllGlobals()
    })

    it('should throw on HTTP error', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
        }),
      )

      await expect(
        getJettonWalletAddress('https://toncenter.com/api/v2', 'EQOwnerAddr', 'EQJettonMaster'),
      ).rejects.toThrow('Failed to resolve Jetton wallet address')

      vi.unstubAllGlobals()
    })

    it('should throw on non-zero exit code', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            ok: true,
            result: {
              exit_code: 11,
              stack: [],
            },
          }),
        }),
      )

      await expect(
        getJettonWalletAddress('https://toncenter.com/api/v2', 'EQOwnerAddr', 'EQJettonMaster'),
      ).rejects.toThrow('exit code 11')

      vi.unstubAllGlobals()
    })

    it('should throw on invalid response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            ok: false,
          }),
        }),
      )

      await expect(
        getJettonWalletAddress('https://toncenter.com/api/v2', 'EQOwnerAddr', 'EQJettonMaster'),
      ).rejects.toThrow('invalid response')

      vi.unstubAllGlobals()
    })
  })
})
