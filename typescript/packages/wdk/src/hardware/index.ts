/**
 * Hardware Wallet Support for T402 WDK
 *
 * This module provides hardware wallet integration for T402 payments,
 * supporting Ledger and Trezor devices.
 *
 * @example Ledger
 * ```typescript
 * import { LedgerSigner, createLedgerSigner } from '@t402/wdk';
 *
 * // Create and connect
 * const ledger = await createLedgerSigner({ accountIndex: 0 });
 * console.log('Address:', ledger.address);
 *
 * // Sign T402 payment
 * const signature = await ledger.signTypedData(paymentData);
 *
 * // Disconnect when done
 * await ledger.disconnect();
 * ```
 *
 * @example Trezor
 * ```typescript
 * import { TrezorSigner, createTrezorSigner } from '@t402/wdk';
 *
 * // Create and connect (manifest required)
 * const trezor = await createTrezorSigner({
 *   manifest: {
 *     email: 'developer@example.com',
 *     appUrl: 'https://example.com'
 *   }
 * });
 * console.log('Address:', trezor.address);
 *
 * // Sign T402 payment
 * const signature = await trezor.signTypedData(paymentData);
 *
 * // Disconnect when done
 * await trezor.disconnect();
 * ```
 */

// Types
export {
  type HardwareWalletType,
  type DeviceStatus,
  type HardwareWalletConnectionOptions,
  type HardwareWalletDeviceInfo,
  type HardwareWalletSigner,
  type LedgerOptions,
  type TrezorOptions,
  HardwareWalletErrorCode,
  HardwareWalletError,
} from "./types.js";

// Ledger
export { LedgerSigner, createLedgerSigner } from "./ledger.js";

// Trezor
export { TrezorSigner, createTrezorSigner } from "./trezor.js";

/**
 * Detect available hardware wallets
 *
 * Note: This function checks for WebUSB/WebHID support and
 * doesn't actually probe for devices.
 */
export function detectHardwareWalletSupport(): {
  ledger: { webusb: boolean; webhid: boolean; bluetooth: boolean };
  trezor: boolean;
} {
  const hasNavigator = typeof navigator !== "undefined";

  return {
    ledger: {
      webusb: hasNavigator && "usb" in navigator,
      webhid: hasNavigator && "hid" in navigator,
      bluetooth: hasNavigator && "bluetooth" in navigator,
    },
    trezor: hasNavigator && "usb" in navigator,
  };
}

/**
 * Check if hardware wallet signing is supported in the current environment
 */
export function isHardwareWalletSupported(): boolean {
  const support = detectHardwareWalletSupport();
  return (
    support.ledger.webusb ||
    support.ledger.webhid ||
    support.ledger.bluetooth ||
    support.trezor
  );
}
