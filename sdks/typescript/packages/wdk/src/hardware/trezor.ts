/**
 * Trezor Hardware Wallet Signer for T402 WDK
 *
 * Provides T402-compatible signing using Trezor hardware wallets.
 * Supports Trezor One, Model T, and Safe 3 devices.
 *
 * @example
 * ```typescript
 * import { TrezorSigner } from '@t402/wdk';
 *
 * const trezor = new TrezorSigner({
 *   manifest: {
 *     email: 'developer@example.com',
 *     appUrl: 'https://example.com'
 *   }
 * });
 * await trezor.connect();
 *
 * // Get address
 * console.log('Address:', trezor.address);
 *
 * // Sign typed data for T402 payment
 * const signature = await trezor.signTypedData(typedData);
 * ```
 */

import type { Address } from "viem";
import {
  type HardwareWalletSigner,
  type HardwareWalletDeviceInfo,
  type TrezorOptions,
  type DeviceStatus,
  HardwareWalletError,
  HardwareWalletErrorCode,
} from "./types.js";

/**
 * Default derivation path for Ethereum
 */
const DEFAULT_DERIVATION_PATH = "m/44'/60'/0'/0";

/**
 * Trezor Connect instance (dynamically imported)
 */
let TrezorConnect: typeof import("@trezor/connect").default | null = null;

/**
 * Trezor hardware wallet signer
 */
export class TrezorSigner implements HardwareWalletSigner {
  readonly walletType = "trezor" as const;

  private _address: Address | null = null;
  private _options: Required<Omit<TrezorOptions, "manifest">> & { manifest: TrezorOptions["manifest"] };
  private _status: DeviceStatus = "disconnected";
  private _deviceInfo: HardwareWalletDeviceInfo;
  private _initialized = false;

  constructor(options: TrezorOptions) {
    if (!options.manifest) {
      throw new HardwareWalletError(
        HardwareWalletErrorCode.INVALID_DATA,
        "Trezor manifest is required (email and appUrl)",
        "trezor",
      );
    }

    this._options = {
      manifest: options.manifest,
      transport: options.transport ?? "webusb",
      accountIndex: options.accountIndex ?? 0,
      derivationPath:
        options.derivationPath ?? `${DEFAULT_DERIVATION_PATH}/${options.accountIndex ?? 0}`,
      timeout: options.timeout ?? 30000,
      popup: options.popup ?? true,
      debug: options.debug ?? false,
    };

    this._deviceInfo = {
      type: "trezor",
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
        "Trezor not connected. Call connect() first.",
        "trezor",
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
    return this._status === "ready" && this._address !== null;
  }

  /**
   * Get the derivation path
   */
  get derivationPath(): string {
    return this._options.derivationPath;
  }

  /**
   * Initialize Trezor Connect
   */
  private async _initTrezorConnect(): Promise<void> {
    if (this._initialized && TrezorConnect) {
      return;
    }

    try {
      const module = await import("@trezor/connect");
      TrezorConnect = module.default;

      await TrezorConnect.init({
        manifest: {
          email: this._options.manifest.email,
          appUrl: this._options.manifest.appUrl,
          appName: "T402 WDK",
        },
        popup: this._options.popup,
        debug: this._options.debug,
      });

      this._initialized = true;
    } catch (error) {
      throw new HardwareWalletError(
        HardwareWalletErrorCode.CONNECTION_FAILED,
        `Failed to initialize Trezor Connect: ${error instanceof Error ? error.message : String(error)}`,
        "trezor",
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Connect to the Trezor device
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    this._status = "connecting";
    this._deviceInfo.status = "connecting";

    try {
      await this._initTrezorConnect();

      if (!TrezorConnect) {
        throw new Error("TrezorConnect not initialized");
      }

      // Get device features
      const featuresResult = await TrezorConnect.getFeatures();
      if (featuresResult.success) {
        const features = featuresResult.payload;
        this._deviceInfo.model = features.model;
        this._deviceInfo.firmwareVersion = `${features.major_version}.${features.minor_version}.${features.patch_version}`;
      }

      // Get address
      const result = await TrezorConnect.ethereumGetAddress({
        path: this._options.derivationPath,
        showOnTrezor: false,
      });

      if (!result.success) {
        throw new Error(result.payload.error || "Failed to get address");
      }

      this._address = result.payload.address as Address;
      this._status = "ready";
      this._deviceInfo.status = "ready";
      this._deviceInfo.isLocked = false;
    } catch (error) {
      this._status = "disconnected";
      this._deviceInfo.status = "disconnected";
      this._address = null;

      throw this._wrapError(error);
    }
  }

  /**
   * Disconnect from the Trezor device
   */
  async disconnect(): Promise<void> {
    if (TrezorConnect) {
      try {
        TrezorConnect.dispose();
      } catch {
        // Ignore dispose errors
      }
    }

    this._address = null;
    this._status = "disconnected";
    this._deviceInfo.status = "disconnected";
    this._deviceInfo.isLocked = true;
    this._initialized = false;
    TrezorConnect = null;
  }

  /**
   * Sign EIP-712 typed data
   */
  async signTypedData(params: {
    domain: Record<string, unknown>;
    types: Record<string, unknown>;
    primaryType: string;
    message: Record<string, unknown>;
  }): Promise<`0x${string}`> {
    if (!this.isConnected) {
      throw new HardwareWalletError(
        HardwareWalletErrorCode.CONNECTION_FAILED,
        "Trezor not connected",
        "trezor",
      );
    }

    await this._initTrezorConnect();

    if (!TrezorConnect) {
      throw new Error("TrezorConnect not initialized");
    }

    try {
      // Convert types to Trezor format
      const trezorTypes = this._convertTypesToTrezorFormat(params.types);

      // Ensure EIP712Domain is present (required by Trezor)
      if (!trezorTypes.EIP712Domain) {
        trezorTypes.EIP712Domain = [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" },
        ];
      }

      const result = await TrezorConnect.ethereumSignTypedData({
        path: this._options.derivationPath,
        data: {
          domain: params.domain as Record<string, string | number | boolean>,
          types: trezorTypes as Parameters<typeof TrezorConnect.ethereumSignTypedData>[0]["data"]["types"],
          primaryType: params.primaryType,
          message: params.message as Record<string, string | number | boolean>,
        },
        metamask_v4_compat: true,
      });

      if (!result.success) {
        throw new Error(result.payload.error || "Failed to sign typed data");
      }

      return result.payload.signature as `0x${string}`;
    } catch (error) {
      throw this._wrapError(error);
    }
  }

  /**
   * Sign a personal message
   */
  async signMessage(message: string | Uint8Array): Promise<`0x${string}`> {
    if (!this.isConnected) {
      throw new HardwareWalletError(
        HardwareWalletErrorCode.CONNECTION_FAILED,
        "Trezor not connected",
        "trezor",
      );
    }

    await this._initTrezorConnect();

    if (!TrezorConnect) {
      throw new Error("TrezorConnect not initialized");
    }

    try {
      // Convert message to hex
      const messageHex =
        typeof message === "string"
          ? `0x${Buffer.from(message).toString("hex")}`
          : `0x${Buffer.from(message).toString("hex")}`;

      const result = await TrezorConnect.ethereumSignMessage({
        path: this._options.derivationPath,
        message: messageHex,
        hex: true,
      });

      if (!result.success) {
        throw new Error(result.payload.error || "Failed to sign message");
      }

      return `0x${result.payload.signature}` as `0x${string}`;
    } catch (error) {
      throw this._wrapError(error);
    }
  }

  /**
   * Get multiple addresses for account selection
   */
  async getAddresses(count: number = 5, startIndex: number = 0): Promise<Address[]> {
    if (!this.isConnected) {
      throw new HardwareWalletError(
        HardwareWalletErrorCode.CONNECTION_FAILED,
        "Trezor not connected",
        "trezor",
      );
    }

    await this._initTrezorConnect();

    if (!TrezorConnect) {
      throw new Error("TrezorConnect not initialized");
    }

    const addresses: Address[] = [];

    // Get addresses in batch
    const bundle = [];
    for (let i = startIndex; i < startIndex + count; i++) {
      bundle.push({
        path: `${DEFAULT_DERIVATION_PATH}/${i}`,
        showOnTrezor: false,
      });
    }

    const result = await TrezorConnect.ethereumGetAddress({ bundle });

    if (!result.success) {
      throw this._wrapError(new Error(result.payload.error || "Failed to get addresses"));
    }

    for (const item of result.payload) {
      addresses.push(item.address as Address);
    }

    return addresses;
  }

  /**
   * Convert EIP-712 types to Trezor format
   */
  private _convertTypesToTrezorFormat(
    types: Record<string, unknown>,
  ): Record<string, Array<{ name: string; type: string }>> {
    const result: Record<string, Array<{ name: string; type: string }>> = {};

    for (const [typeName, fields] of Object.entries(types)) {
      if (Array.isArray(fields)) {
        result[typeName] = fields.map((field) => ({
          name: String(field.name),
          type: String(field.type),
        }));
      }
    }

    return result;
  }

  /**
   * Wrap errors in HardwareWalletError
   */
  private _wrapError(error: unknown): HardwareWalletError {
    const err = error instanceof Error ? error : new Error(String(error));
    const message = err.message.toLowerCase();

    // Map common Trezor errors
    if (message.includes("cancelled") || message.includes("rejected") || message.includes("denied")) {
      return new HardwareWalletError(
        HardwareWalletErrorCode.USER_REJECTED,
        "User cancelled the action on the Trezor device",
        "trezor",
        err,
      );
    }

    if (message.includes("pin")) {
      return new HardwareWalletError(
        HardwareWalletErrorCode.DEVICE_LOCKED,
        "Trezor device requires PIN entry",
        "trezor",
        err,
      );
    }

    if (message.includes("passphrase")) {
      return new HardwareWalletError(
        HardwareWalletErrorCode.DEVICE_LOCKED,
        "Trezor device requires passphrase entry",
        "trezor",
        err,
      );
    }

    if (message.includes("device") && message.includes("not found")) {
      return new HardwareWalletError(
        HardwareWalletErrorCode.DEVICE_NOT_FOUND,
        "Trezor device not found. Please connect your device.",
        "trezor",
        err,
      );
    }

    if (message.includes("timeout")) {
      return new HardwareWalletError(
        HardwareWalletErrorCode.TIMEOUT,
        "Connection timed out",
        "trezor",
        err,
      );
    }

    return new HardwareWalletError(
      HardwareWalletErrorCode.UNKNOWN_ERROR,
      err.message,
      "trezor",
      err,
    );
  }
}

/**
 * Create a Trezor signer and connect
 */
export async function createTrezorSigner(options: TrezorOptions): Promise<TrezorSigner> {
  const signer = new TrezorSigner(options);
  await signer.connect();
  return signer;
}
