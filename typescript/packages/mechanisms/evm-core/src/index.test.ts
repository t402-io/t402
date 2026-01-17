import { describe, it, expect } from 'vitest';
import {
  authorizationTypes,
  eip3009ABI,
  erc20LegacyABI,
  getEvmChainId,
  createNonce,
  bytesToHex,
  hexToBytes,
} from './index';

describe('@t402/evm-core', () => {
  describe('constants', () => {
    it('should export EIP-712 authorization types', () => {
      expect(authorizationTypes).toBeDefined();
      expect(authorizationTypes.TransferWithAuthorization).toHaveLength(6);
    });

    it('should export EIP-3009 ABI', () => {
      expect(eip3009ABI).toBeDefined();
      expect(Array.isArray(eip3009ABI)).toBe(true);
    });

    it('should export ERC-20 legacy ABI', () => {
      expect(erc20LegacyABI).toBeDefined();
      expect(Array.isArray(erc20LegacyABI)).toBe(true);
    });
  });

  describe('utils', () => {
    it('should get EVM chain ID from network', () => {
      expect(getEvmChainId('base')).toBe(8453);
      expect(getEvmChainId('ethereum')).toBe(1);
      expect(getEvmChainId('polygon')).toBe(137);
    });

    it('should create random nonces', () => {
      const nonce1 = createNonce();
      const nonce2 = createNonce();

      expect(nonce1).toMatch(/^0x[a-f0-9]{64}$/);
      expect(nonce2).toMatch(/^0x[a-f0-9]{64}$/);
      expect(nonce1).not.toBe(nonce2);
    });
  });

  describe('primitives', () => {
    it('should convert bytes to hex', () => {
      const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
      expect(bytesToHex(bytes)).toBe('0xdeadbeef');
    });

    it('should convert hex to bytes', () => {
      const hex = '0xdeadbeef';
      const bytes = hexToBytes(hex);
      expect(bytes).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
    });
  });
});
