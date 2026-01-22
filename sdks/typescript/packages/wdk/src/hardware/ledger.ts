/**
 * Ledger Hardware Wallet Signer for T402 WDK
 *
 * Provides T402-compatible signing using Ledger hardware wallets.
 * Supports Nano S, Nano S Plus, Nano X, and Stax devices.
 *
 * @example
 * ```typescript
 * import { LedgerSigner } from '@t402/wdk';
 *
 * const ledger = new LedgerSigner({ accountIndex: 0 });
 * await ledger.connect();
 *
 * // Get address
 * console.log('Address:', ledger.address);
 *
 * // Sign typed data for T402 payment
 * const signature = await ledger.signTypedData(typedData);
 * ```
 */

import type { Address } from "viem";
import {
  type HardwareWalletSigner,
  type HardwareWalletDeviceInfo,
  type LedgerOptions,
  type DeviceStatus,
  HardwareWalletError,
  HardwareWalletErrorCode,
} from "./types.js";

/**
 * Default derivation path for Ethereum
 */
const DEFAULT_DERIVATION_PATH = "m/44'/60'/0'/0";

/**
 * Ledger hardware wallet signer
 */
export class LedgerSigner implements HardwareWalletSigner {
  readonly walletType = "ledger" as const;

  private _address: Address | null = null;
  private _transport: unknown = null;
  private _eth: unknown = null;
  private _options: Required<LedgerOptions>;
  private _status: DeviceStatus = "disconnected";
  private _deviceInfo: HardwareWalletDeviceInfo;

  constructor(options: LedgerOptions = {}) {
    this._options = {
      transport: options.transport ?? "webusb",
      accountIndex: options.accountIndex ?? 0,
      derivationPath:
        options.derivationPath ?? `${DEFAULT_DERIVATION_PATH}/${options.accountIndex ?? 0}`,
      timeout: options.timeout ?? 30000,
      scrambleKey: options.scrambleKey ?? true,
      appName: options.appName ?? "Ethereum",
    };

    this._deviceInfo = {
      type: "ledger",
      isLocked: true,
      status: "disconnected",
    };
  }

  /**
   * Get the wallet address
   */
  get address(): Address {
    if (!this._address) {
      throw new HardwareWalletError(
        HardwareWalletErrorCode.CONNECTION_FAILED,
        "Ledger not connected. Call connect() first.",
        "ledger",
      );
    }
    return this._address;
  }

  /**
   * Get device info
   */
  get deviceInfo(): HardwareWalletDeviceInfo {
    return { ...this._deviceInfo };
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this._status === "ready" && this._transport !== null;
  }

  /**
   * Get the derivation path
   */
  get derivationPath(): string {
    return this._options.derivationPath;
  }

  /**
   * Connect to the Ledger device
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    this._status = "connecting";
    this._deviceInfo.status = "connecting";

    try {
      // Dynamic import to avoid bundling issues
      const TransportModule = await this._getTransportModule();
      const EthModule = await import("@ledgerhq/hw-app-eth");

      // Create transport
      this._transport = await TransportModule.default.create();
      this._status = "connected";
      this._deviceInfo.status = "connected";

      // Create Ethereum app instance
      this._eth = new EthModule.default(this._transport as never);

      // Get device info
      try {
        const appConfig = await (this._eth as { getAppConfiguration: () => Promise<{ version: string }> }).getAppConfiguration();
        this._deviceInfo.firmwareVersion = appConfig.version;
      } catch {
        // App config not available, continue
      }

      // Get address
      const result = await (this._eth as {
        getAddress: (path: string, display?: boolean) => Promise<{ address: string }>;
      }).getAddress(this._options.derivationPath, false);

      this._address = result.address as Address;
      this._status = "ready";
      this._deviceInfo.status = "ready";
      this._deviceInfo.isLocked = false;
    } catch (error) {
      this._status = "disconnected";
      this._deviceInfo.status = "disconnected";
      this._transport = null;
      this._eth = null;

      throw this._wrapError(error);
    }
  }

  /**
   * Disconnect from the Ledger device
   */
  async disconnect(): Promise<void> {
    if (this._transport) {
      try {
        await (this._transport as { close: () => Promise<void> }).close();
      } catch {
        // Ignore close errors
      }
    }

    this._transport = null;
    this._eth = null;
    this._address = null;
    this._status = "disconnected";
    this._deviceInfo.status = "disconnected";
    this._deviceInfo.isLocked = true;
  }

  /**
   * Sign EIP-712 typed data
   *
   * Note: Requires Ethereum app version 1.6.0+ for EIP-712 support
   */
  async signTypedData(params: {
    domain: Record<string, unknown>;
    types: Record<string, unknown>;
    primaryType: string;
    message: Record<string, unknown>;
  }): Promise<`0x${string}`> {
    if (!this.isConnected || !this._eth) {
      throw new HardwareWalletError(
        HardwareWalletErrorCode.CONNECTION_FAILED,
        "Ledger not connected",
        "ledger",
      );
    }

    try {
      // Ledger uses signEIP712Message for typed data
      const result = await (this._eth as {
        signEIP712Message: (
          path: string,
          message: {
            domain: Record<string, unknown>;
            types: Record<string, unknown>;
            primaryType: string;
            message: Record<string, unknown>;
          },
        ) => Promise<{ v: number; r: string; s: string }>;
      }).signEIP712Message(this._options.derivationPath, {
        domain: params.domain,
        types: params.types,
        primaryType: params.primaryType,
        message: params.message,
      });

      // Construct signature from r, s, v
      const r = result.r.padStart(64, "0");
      const s = result.s.padStart(64, "0");
      const v = result.v.toString(16).padStart(2, "0");

      return `0x${r}${s}${v}` as `0x${string}`;
    } catch (error) {
      throw this._wrapError(error);
    }
  }

  /**
   * Sign a personal message
   */
  async signMessage(message: string | Uint8Array): Promise<`0x${string}`> {
    if (!this.isConnected || !this._eth) {
      throw new HardwareWalletError(
        HardwareWalletErrorCode.CONNECTION_FAILED,
        "Ledger not connected",
        "ledger",
      );
    }

    try {
      // Convert message to hex if needed
      const messageHex =
        typeof message === "string"
          ? Buffer.from(message).toString("hex")
          : Buffer.from(message).toString("hex");

      const result = await (this._eth as {
        signPersonalMessage: (
          path: string,
          messageHex: string,
        ) => Promise<{ v: number; r: string; s: string }>;
      }).signPersonalMessage(this._options.derivationPath, messageHex);

      // Construct signature from r, s, v
      const r = result.r.padStart(64, "0");
      const s = result.s.padStart(64, "0");
      const v = result.v.toString(16).padStart(2, "0");

      return `0x${r}${s}${v}` as `0x${string}`;
    } catch (error) {
      throw this._wrapError(error);
    }
  }

  /**
   * Get multiple addresses for account selection
   */
  async getAddresses(count: number = 5, startIndex: number = 0): Promise<Address[]> {
    if (!this.isConnected || !this._eth) {
      throw new HardwareWalletError(
        HardwareWalletErrorCode.CONNECTION_FAILED,
        "Ledger not connected",
        "ledger",
      );
    }

    const addresses: Address[] = [];

    for (let i = startIndex; i < startIndex + count; i++) {
      const path = `${DEFAULT_DERIVATION_PATH}/${i}`;
      const result = await (this._eth as {
        getAddress: (path: string, display?: boolean) => Promise<{ address: string }>;
      }).getAddress(path, false);
      addresses.push(result.address as Address);
    }

    return addresses;
  }

  /**
   * Get the appropriate transport module based on options
   */
  private async _getTransportModule(): Promise<{ default: { create: () => Promise<unknown> } }> {
    switch (this._options.transport) {
      case "webhid":
        return import("@ledgerhq/hw-transport-webhid");
      case "bluetooth":
        return import("@ledgerhq/hw-transport-web-ble");
      case "webusb":
      default:
        return import("@ledgerhq/hw-transport-webusb");
    }
  }

  /**
   * Wrap errors in HardwareWalletError
   */
  private _wrapError(error: unknown): HardwareWalletError {
    const err = error instanceof Error ? error : new Error(String(error));
    const message = err.message.toLowerCase();

    // Map common Ledger errors
    if (message.includes("denied") || message.includes("rejected")) {
      return new HardwareWalletError(
        HardwareWalletErrorCode.USER_REJECTED,
        "User rejected the action on the Ledger device",
        "ledger",
        err,
      );
    }

    if (message.includes("locked")) {
      return new HardwareWalletError(
        HardwareWalletErrorCode.DEVICE_LOCKED,
        "Ledger device is locked. Please unlock it.",
        "ledger",
        err,
      );
    }

    if (message.includes("no device") || message.includes("not found")) {
      return new HardwareWalletError(
        HardwareWalletErrorCode.DEVICE_NOT_FOUND,
        "Ledger device not found. Please connect your device.",
        "ledger",
        err,
      );
    }

    if (message.includes("app") || message.includes("ethereum")) {
      return new HardwareWalletError(
        HardwareWalletErrorCode.APP_NOT_OPEN,
        "Please open the Ethereum app on your Ledger device.",
        "ledger",
        err,
      );
    }

    if (message.includes("timeout")) {
      return new HardwareWalletError(
        HardwareWalletErrorCode.TIMEOUT,
        "Connection timed out",
        "ledger",
        err,
      );
    }

    return new HardwareWalletError(
      HardwareWalletErrorCode.UNKNOWN_ERROR,
      err.message,
      "ledger",
      err,
    );
  }
}

/**
 * Create a Ledger signer and connect
 */
export async function createLedgerSigner(options?: LedgerOptions): Promise<LedgerSigner> {
  const signer = new LedgerSigner(options);
  await signer.connect();
  return signer;
}
