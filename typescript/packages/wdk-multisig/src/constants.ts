/**
 * WDK Multi-sig Constants
 *
 * Safe 4337 module addresses and other constants.
 */

import type { Address } from "viem";

/**
 * Safe 4337 module addresses (v0.3.0)
 * Deployed on all major EVM chains at the same addresses
 */
export const SAFE_4337_ADDRESSES = {
  /** Safe 4337 Module */
  module: "0xa581c4A4DB7175302464fF3C06380BC3270b4037" as Address,
  /** Safe Module Setup */
  moduleSetup: "0x2dd68b007B46fBe91B9A7c3EDa5A7a1063cB5b47" as Address,
  /** Safe Singleton */
  singleton: "0x29fcB43b46531BcA003ddC8FCB67FFE91900C762" as Address,
  /** Safe Proxy Factory */
  proxyFactory: "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67" as Address,
  /** Safe Fallback Handler */
  fallbackHandler: "0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99" as Address,
  /** Add Modules Lib */
  addModulesLib: "0x8EcD4ec46D4D2a6B64fE960B3D64e8B94B2234eb" as Address,
  /** MultiSend library */
  multiSend: "0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526" as Address,
} as const;

/**
 * Safe signature types
 */
export const SIGNATURE_TYPES = {
  /** EOA signature (most common) */
  EOA: "0x00",
  /** Contract signature */
  CONTRACT: "0x01",
  /** Approved hash */
  APPROVED_HASH: "0x04",
} as const;

/**
 * Default configuration values
 */
export const DEFAULTS = {
  /** Default request expiration (1 hour) */
  REQUEST_EXPIRATION_MS: 60 * 60 * 1000,
  /** Default salt nonce */
  SALT_NONCE: 0n,
  /** Maximum owners allowed */
  MAX_OWNERS: 10,
  /** Minimum threshold */
  MIN_THRESHOLD: 1,
} as const;

/**
 * EntryPoint v0.7 address
 */
export const ENTRYPOINT_V07_ADDRESS =
  "0x0000000071727De22E5E9d8BAf0edAc6f37da032" as Address;
