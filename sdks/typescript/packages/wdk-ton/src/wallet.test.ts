import { describe, it, expect, vi } from 'vitest'
import { T402TonWallet, createT402TonWallet } from './wallet'
import type { T402TonWalletConfig } from './types'

// Mock wallet kit
function createMockWalletKit() {
  return {
    getAddress: vi.fn().mockResolvedValue('UQTestAddress1234567890123456789012345678901234'),
    getBalance: vi.fn().mockResolvedValue(5000000000n), // 5 TON
    getJettonBalance: vi.fn().mockResolvedValue(10000000n), // 10 USDT0
    signMessage: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4])),
    sendTransaction: vi.fn().mockResolvedValue('mock-tx-hash-123'),
    getSeqno: vi.fn().mockResolvedValue(42),
    transferJetton: vi.fn().mockResolvedValue('mock-jetton-tx-hash-456'),
    dispose: vi.fn(),
  }
}

// We need to mock the @ton/walletkit import to test the wallet class
vi.mock('@ton/walletkit', () => {
  const mockKit = createMockWalletKit()
  return {
    WalletKit: class {
      getAddress = mockKit.getAddress
      getBalance = mockKit.getBalance
      getJettonBalance = mockKit.getJettonBalance
      signMessage = mockKit.signMessage
      sendTransaction = mockKit.sendTransaction
      getSeqno = mockKit.getSeqno
      transferJetton = mockKit.transferJetton
      dispose = mockKit.dispose
    },
  }
})

describe('T402TonWallet', () => {
  const testMnemonic =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

  describe('fromMnemonic', () => {
    it('should create a wallet from a valid mnemonic', async () => {
      const wallet = await T402TonWallet.fromMnemonic(testMnemonic)
      expect(wallet).toBeInstanceOf(T402TonWallet)
    })

    it('should throw for an invalid mnemonic', async () => {
      await expect(T402TonWallet.fromMnemonic('too short')).rejects.toThrow('Invalid mnemonic')
    })

    it('should accept custom configuration', async () => {
      const config: T402TonWalletConfig = {
        walletVersion: 'v4r2',
        network: 'testnet',
        endpoint: 'https://custom-endpoint.example.com',
      }
      const wallet = await T402TonWallet.fromMnemonic(testMnemonic, config)
      expect(wallet).toBeInstanceOf(T402TonWallet)
    })
  })

  describe('createT402TonWallet', () => {
    it('should create a wallet instance', async () => {
      const wallet = await createT402TonWallet(testMnemonic)
      expect(wallet).toBeInstanceOf(T402TonWallet)
    })
  })

  describe('getAddress', () => {
    it('should return the wallet address', async () => {
      const wallet = await T402TonWallet.fromMnemonic(testMnemonic)
      const address = await wallet.getAddress()
      expect(typeof address).toBe('string')
      expect(address.length).toBeGreaterThan(0)
    })

    it('should cache the address', async () => {
      const wallet = await T402TonWallet.fromMnemonic(testMnemonic)
      const addr1 = await wallet.getAddress()
      const addr2 = await wallet.getAddress()
      expect(addr1).toBe(addr2)
    })
  })

  describe('getBalance', () => {
    it('should return the TON balance', async () => {
      const wallet = await T402TonWallet.fromMnemonic(testMnemonic)
      const balance = await wallet.getBalance()
      expect(typeof balance).toBe('bigint')
    })
  })

  describe('getJettonBalance', () => {
    it('should return the Jetton balance', async () => {
      const wallet = await T402TonWallet.fromMnemonic(testMnemonic)
      const balance = await wallet.getJettonBalance()
      expect(typeof balance).toBe('bigint')
    })

    it('should accept a custom Jetton master address', async () => {
      const wallet = await T402TonWallet.fromMnemonic(testMnemonic)
      const balance = await wallet.getJettonBalance('EQCustomJettonMaster1234567890')
      expect(typeof balance).toBe('bigint')
    })
  })

  describe('signMessage', () => {
    it('should sign a message', async () => {
      const wallet = await T402TonWallet.fromMnemonic(testMnemonic)
      const message = new Uint8Array([72, 101, 108, 108, 111])
      const signature = await wallet.signMessage(message)
      expect(signature).toBeInstanceOf(Uint8Array)
    })
  })

  describe('sendTransaction', () => {
    it('should send a transaction', async () => {
      const wallet = await T402TonWallet.fromMnemonic(testMnemonic)
      const txHash = await wallet.sendTransaction({
        to: 'UQRecipientAddress12345678901234567890',
        value: 1000000000n,
      })
      expect(typeof txHash).toBe('string')
    })

    it('should throw for missing recipient', async () => {
      const wallet = await T402TonWallet.fromMnemonic(testMnemonic)
      await expect(
        wallet.sendTransaction({
          to: '',
          value: 1000000000n,
        }),
      ).rejects.toThrow('Recipient address is required')
    })

    it('should throw for negative value', async () => {
      const wallet = await T402TonWallet.fromMnemonic(testMnemonic)
      await expect(
        wallet.sendTransaction({
          to: 'UQRecipientAddress12345678901234567890',
          value: -1n,
        }),
      ).rejects.toThrow('Transaction value must be non-negative')
    })
  })

  describe('getSeqno', () => {
    it('should return the sequence number', async () => {
      const wallet = await T402TonWallet.fromMnemonic(testMnemonic)
      const seqno = await wallet.getSeqno()
      expect(typeof seqno).toBe('number')
    })
  })

  describe('transferJetton', () => {
    it('should transfer Jettons', async () => {
      const wallet = await T402TonWallet.fromMnemonic(testMnemonic)
      const txHash = await wallet.transferJetton({
        jettonMaster: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
        to: 'UQRecipientAddress12345678901234567890',
        amount: 1000000n,
      })
      expect(typeof txHash).toBe('string')
    })

    it('should throw for missing recipient', async () => {
      const wallet = await T402TonWallet.fromMnemonic(testMnemonic)
      await expect(
        wallet.transferJetton({
          jettonMaster: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
          to: '',
          amount: 1000000n,
        }),
      ).rejects.toThrow('Recipient address is required')
    })

    it('should throw for zero amount', async () => {
      const wallet = await T402TonWallet.fromMnemonic(testMnemonic)
      await expect(
        wallet.transferJetton({
          jettonMaster: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
          to: 'UQRecipientAddress12345678901234567890',
          amount: 0n,
        }),
      ).rejects.toThrow('Transfer amount must be greater than zero')
    })
  })

  describe('getInfo', () => {
    it('should return wallet info', async () => {
      const wallet = await T402TonWallet.fromMnemonic(testMnemonic)
      const info = await wallet.getInfo()

      expect(info.address).toBeDefined()
      expect(typeof info.balance).toBe('bigint')
      expect(typeof info.isDeployed).toBe('boolean')
      expect(info.walletVersion).toBe('v5r1')
    })

    it('should use v4r2 when configured', async () => {
      const wallet = await T402TonWallet.fromMnemonic(testMnemonic, {
        walletVersion: 'v4r2',
      })
      const info = await wallet.getInfo()
      expect(info.walletVersion).toBe('v4r2')
    })
  })

  describe('dispose', () => {
    it('should clean up resources', async () => {
      const wallet = await T402TonWallet.fromMnemonic(testMnemonic)
      // Should not throw
      wallet.dispose()
    })
  })
})
