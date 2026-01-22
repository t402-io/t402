/**
 * Hardware wallet type definitions for T402 WDK
 */

import type { Address } from "viem";

/**
 * Supported hardware wallet types
 */
export type HardwareWalletType = "ledger" | "trezor";

/**
 * Hardware wallet device status
 */
export type DeviceStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "locked"
  | "unlocked"
  | "app_closed"
  | "ready";

/**
 * Hardware wallet connection options
 */
export interface HardwareWalletConnectionOptions {
  /** Transport type for Ledger (default: "webusb") */
  transport?: "webusb" | "webhid" | "bluetooth";
  /** Account index for HD derivation (default: 0) */
  accountIndex?: number;
  /** Custom derivation path (default: m/44'/60'/0'/0/{accountIndex}) */
  derivationPath?: string;
  /** Timeout for connection in milliseconds (default: 30000) */
  timeout?: number;
}

/**
 * Hardware wallet device info
 */
export interface HardwareWalletDeviceInfo {
  /** Wallet type */
  type: HardwareWalletType;
  /** Device model (e.g., "Nano S", "Nano X", "Model T") */
  model?: string;
  /** Firmware version */
  firmwareVersion?: string;
  /** Whether the device is locked */
  isLocked: boolean;
  /** Current device status */
  status: DeviceStatus;
}

/**
 * Hardware wallet signer interface
 */
export interface HardwareWalletSigner {
  /** Get wallet address */
  readonly address: Address;
  /** Wallet type */
  readonly walletType: HardwareWalletType;
  /** Device info */
  readonly deviceInfo: HardwareWalletDeviceInfo;
  /** Whether the signer is connected */
  readonly isConnected: boolean;

  /**
   * Connect to the hardware wallet
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the hardware wallet
   */
  disconnect(): Promise<void>;

  /**
   * Sign EIP-712 typed data
   */
  signTypedData(params: {
    domain: Record<string, unknown>;
    types: Record<string, unknown>;
    primaryType: string;
    message: Record<string, unknown>;
  }): Promise<`0x${string}`>;

  /**
   * Sign a personal message
   */
  signMessage(message: string | Uint8Array): Promise<`0x${string}`>;

  /**
   * Get all available addresses (for account selection)
   * @param count Number of addresses to retrieve
   * @param startIndex Starting index
   */
  getAddresses?(count: number, startIndex?: number): Promise<Address[]>;
}

/**
 * Ledger-specific options
 */
export interface LedgerOptions extends HardwareWalletConnectionOptions {
  /** Whether to scramble key for privacy (default: true) */
  scrambleKey?: boolean;
  /** App name on the Ledger (default: "Ethereum") */
  appName?: string;
}

/**
 * Trezor-specific options
 */
export interface TrezorOptions extends HardwareWalletConnectionOptions {
  /** Manifest for Trezor Connect (required) */
  manifest: {
    email: string;
    appUrl: string;
  };
  /** Whether to use popup for interactions (default: true) */
  popup?: boolean;
  /** Debug mode */
  debug?: boolean;
}

/**
 * Error codes for hardware wallet operations
 */
export enum HardwareWalletErrorCode {
  // Connection errors
  DEVICE_NOT_FOUND = "DEVICE_NOT_FOUND",
  CONNECTION_FAILED = "CONNECTION_FAILED",
  DEVICE_LOCKED = "DEVICE_LOCKED",
  APP_NOT_OPEN = "APP_NOT_OPEN",
  TRANSPORT_ERROR = "TRANSPORT_ERROR",

  // Signing errors
  USER_REJECTED = "USER_REJECTED",
  SIGNING_FAILED = "SIGNING_FAILED",
  INVALID_DATA = "INVALID_DATA",

  // General errors
  NOT_SUPPORTED = "NOT_SUPPORTED",
  TIMEOUT = "TIMEOUT",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

/**
 * Hardware wallet error
 */
export class HardwareWalletError extends Error {
  readonly code: HardwareWalletErrorCode;
  readonly walletType: HardwareWalletType;
  readonly cause?: Error;

  constructor(
    code: HardwareWalletErrorCode,
    message: string,
    walletType: HardwareWalletType,
    cause?: Error,
  ) {
    super(message);
    this.name = "HardwareWalletError";
    this.code = code;
    this.walletType = walletType;
    this.cause = cause;
  }
}
