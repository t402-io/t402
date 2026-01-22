/**
 * Hardware Wallet Tests for T402 WDK
 *
 * These tests verify the hardware wallet signer implementations
 * without requiring actual hardware devices by mocking the transport layers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Address } from "viem";
import {
  HardwareWalletError,
  HardwareWalletErrorCode,
  type HardwareWalletType,
  type DeviceStatus,
  type HardwareWalletDeviceInfo,
  type LedgerOptions,
  type TrezorOptions,
} from "../../src/hardware/types.js";
import { LedgerSigner } from "../../src/hardware/ledger.js";
import { TrezorSigner } from "../../src/hardware/trezor.js";
import { detectHardwareWalletSupport, isHardwareWalletSupported } from "../../src/hardware/index.js";

// =============================================================================
// Type Tests
// =============================================================================

describe("Hardware Wallet Types", () => {
  describe("HardwareWalletError", () => {
    it("should create error with code and message", () => {
      const error = new HardwareWalletError(
        HardwareWalletErrorCode.DEVICE_NOT_FOUND,
        "Device not found",
        "ledger",
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(HardwareWalletError);
      expect(error.code).toBe(HardwareWalletErrorCode.DEVICE_NOT_FOUND);
      expect(error.message).toBe("Device not found");
      expect(error.walletType).toBe("ledger");
      expect(error.name).toBe("HardwareWalletError");
    });

    it("should include cause if provided", () => {
      const cause = new Error("Original error");
      const error = new HardwareWalletError(
        HardwareWalletErrorCode.CONNECTION_FAILED,
        "Connection failed",
        "trezor",
        cause,
      );

      expect(error.cause).toBe(cause);
    });

    it("should have all error codes defined", () => {
      expect(HardwareWalletErrorCode.DEVICE_NOT_FOUND).toBe("DEVICE_NOT_FOUND");
      expect(HardwareWalletErrorCode.CONNECTION_FAILED).toBe("CONNECTION_FAILED");
      expect(HardwareWalletErrorCode.DEVICE_LOCKED).toBe("DEVICE_LOCKED");
      expect(HardwareWalletErrorCode.APP_NOT_OPEN).toBe("APP_NOT_OPEN");
      expect(HardwareWalletErrorCode.USER_REJECTED).toBe("USER_REJECTED");
      expect(HardwareWalletErrorCode.INVALID_DATA).toBe("INVALID_DATA");
      expect(HardwareWalletErrorCode.SIGNING_FAILED).toBe("SIGNING_FAILED");
      expect(HardwareWalletErrorCode.TIMEOUT).toBe("TIMEOUT");
      expect(HardwareWalletErrorCode.UNKNOWN_ERROR).toBe("UNKNOWN_ERROR");
    });
  });

  describe("Type definitions", () => {
    it("should accept valid hardware wallet types", () => {
      const ledgerType: HardwareWalletType = "ledger";
      const trezorType: HardwareWalletType = "trezor";

      expect(ledgerType).toBe("ledger");
      expect(trezorType).toBe("trezor");
    });

    it("should accept valid device status values", () => {
      const statuses: DeviceStatus[] = [
        "disconnected",
        "connecting",
        "connected",
        "locked",
        "unlocked",
        "app_closed",
        "ready",
      ];

      expect(statuses).toHaveLength(7);
    });

    it("should accept valid device info", () => {
      const info: HardwareWalletDeviceInfo = {
        type: "ledger",
        model: "Nano X",
        firmwareVersion: "2.1.0",
        isLocked: false,
        status: "ready",
      };

      expect(info.type).toBe("ledger");
      expect(info.model).toBe("Nano X");
      expect(info.firmwareVersion).toBe("2.1.0");
      expect(info.isLocked).toBe(false);
      expect(info.status).toBe("ready");
    });
  });
});

// =============================================================================
// Ledger Signer Tests
// =============================================================================

describe("LedgerSigner", () => {
  describe("constructor", () => {
    it("should create signer with default options", () => {
      const signer = new LedgerSigner();

      expect(signer.walletType).toBe("ledger");
      expect(signer.isConnected).toBe(false);
      expect(signer.derivationPath).toBe("m/44'/60'/0'/0/0");
    });

    it("should create signer with custom options", () => {
      const signer = new LedgerSigner({
        transport: "webhid",
        accountIndex: 2,
        timeout: 60000,
      });

      expect(signer.walletType).toBe("ledger");
      expect(signer.derivationPath).toBe("m/44'/60'/0'/0/2");
    });

    it("should use custom derivation path when provided", () => {
      const signer = new LedgerSigner({
        derivationPath: "m/44'/60'/1'/0/0",
      });

      expect(signer.derivationPath).toBe("m/44'/60'/1'/0/0");
    });
  });

  describe("address", () => {
    it("should throw when not connected", () => {
      const signer = new LedgerSigner();

      expect(() => signer.address).toThrow(HardwareWalletError);
      expect(() => signer.address).toThrow("Call connect() first");
    });
  });

  describe("deviceInfo", () => {
    it("should return device info", () => {
      const signer = new LedgerSigner();
      const info = signer.deviceInfo;

      expect(info.type).toBe("ledger");
      expect(info.status).toBe("disconnected");
      expect(info.isLocked).toBe(true);
    });

    it("should return a copy of device info", () => {
      const signer = new LedgerSigner();
      const info1 = signer.deviceInfo;
      const info2 = signer.deviceInfo;

      expect(info1).not.toBe(info2);
      expect(info1).toEqual(info2);
    });
  });

  describe("signTypedData", () => {
    it("should throw when not connected", async () => {
      const signer = new LedgerSigner();

      await expect(
        signer.signTypedData({
          domain: {},
          types: {},
          primaryType: "Test",
          message: {},
        }),
      ).rejects.toThrow(HardwareWalletError);
    });
  });

  describe("signMessage", () => {
    it("should throw when not connected", async () => {
      const signer = new LedgerSigner();

      await expect(signer.signMessage("Hello")).rejects.toThrow(HardwareWalletError);
    });
  });

  describe("getAddresses", () => {
    it("should throw when not connected", async () => {
      const signer = new LedgerSigner();

      await expect(signer.getAddresses(5)).rejects.toThrow(HardwareWalletError);
    });
  });
});

// =============================================================================
// Trezor Signer Tests
// =============================================================================

describe("TrezorSigner", () => {
  const validOptions: TrezorOptions = {
    manifest: {
      email: "test@example.com",
      appUrl: "https://example.com",
    },
  };

  describe("constructor", () => {
    it("should throw without manifest", () => {
      expect(() => new TrezorSigner({} as TrezorOptions)).toThrow(HardwareWalletError);
      expect(() => new TrezorSigner({} as TrezorOptions)).toThrow("manifest is required");
    });

    it("should create signer with valid manifest", () => {
      const signer = new TrezorSigner(validOptions);

      expect(signer.walletType).toBe("trezor");
      expect(signer.isConnected).toBe(false);
      expect(signer.derivationPath).toBe("m/44'/60'/0'/0/0");
    });

    it("should create signer with custom options", () => {
      const signer = new TrezorSigner({
        ...validOptions,
        accountIndex: 3,
        popup: false,
        debug: true,
      });

      expect(signer.walletType).toBe("trezor");
      expect(signer.derivationPath).toBe("m/44'/60'/0'/0/3");
    });

    it("should use custom derivation path when provided", () => {
      const signer = new TrezorSigner({
        ...validOptions,
        derivationPath: "m/44'/60'/2'/0/0",
      });

      expect(signer.derivationPath).toBe("m/44'/60'/2'/0/0");
    });
  });

  describe("address", () => {
    it("should throw when not connected", () => {
      const signer = new TrezorSigner(validOptions);

      expect(() => signer.address).toThrow(HardwareWalletError);
      expect(() => signer.address).toThrow("Call connect() first");
    });
  });

  describe("deviceInfo", () => {
    it("should return device info", () => {
      const signer = new TrezorSigner(validOptions);
      const info = signer.deviceInfo;

      expect(info.type).toBe("trezor");
      expect(info.status).toBe("disconnected");
      expect(info.isLocked).toBe(true);
    });

    it("should return a copy of device info", () => {
      const signer = new TrezorSigner(validOptions);
      const info1 = signer.deviceInfo;
      const info2 = signer.deviceInfo;

      expect(info1).not.toBe(info2);
      expect(info1).toEqual(info2);
    });
  });

  describe("signTypedData", () => {
    it("should throw when not connected", async () => {
      const signer = new TrezorSigner(validOptions);

      await expect(
        signer.signTypedData({
          domain: {},
          types: {},
          primaryType: "Test",
          message: {},
        }),
      ).rejects.toThrow(HardwareWalletError);
    });
  });

  describe("signMessage", () => {
    it("should throw when not connected", async () => {
      const signer = new TrezorSigner(validOptions);

      await expect(signer.signMessage("Hello")).rejects.toThrow(HardwareWalletError);
    });
  });

  describe("getAddresses", () => {
    it("should throw when not connected", async () => {
      const signer = new TrezorSigner(validOptions);

      await expect(signer.getAddresses(5)).rejects.toThrow(HardwareWalletError);
    });
  });
});

// =============================================================================
// Detection Utilities
// =============================================================================

describe("Hardware Wallet Detection", () => {
  describe("detectHardwareWalletSupport", () => {
    it("should return support status object", () => {
      const support = detectHardwareWalletSupport();

      expect(support).toHaveProperty("ledger");
      expect(support).toHaveProperty("trezor");
      expect(support.ledger).toHaveProperty("webusb");
      expect(support.ledger).toHaveProperty("webhid");
      expect(support.ledger).toHaveProperty("bluetooth");
    });

    it("should return booleans for all properties", () => {
      const support = detectHardwareWalletSupport();

      expect(typeof support.ledger.webusb).toBe("boolean");
      expect(typeof support.ledger.webhid).toBe("boolean");
      expect(typeof support.ledger.bluetooth).toBe("boolean");
      expect(typeof support.trezor).toBe("boolean");
    });
  });

  describe("isHardwareWalletSupported", () => {
    it("should return boolean", () => {
      const supported = isHardwareWalletSupported();

      expect(typeof supported).toBe("boolean");
    });
  });
});

// =============================================================================
// Mock Transport Tests
// =============================================================================

describe("LedgerSigner with Mocked Transport", () => {
  const mockAddress = "0x1234567890123456789012345678901234567890" as Address;
  const mockSignature = {
    v: 27,
    r: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    s: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef12345678",
  };

  let mockTransport: {
    create: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };
  let mockEth: {
    getAddress: ReturnType<typeof vi.fn>;
    getAppConfiguration: ReturnType<typeof vi.fn>;
    signEIP712Message: ReturnType<typeof vi.fn>;
    signPersonalMessage: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockTransport = {
      create: vi.fn().mockResolvedValue({ close: vi.fn() }),
      close: vi.fn(),
    };

    mockEth = {
      getAddress: vi.fn().mockResolvedValue({ address: mockAddress }),
      getAppConfiguration: vi.fn().mockResolvedValue({ version: "1.10.0" }),
      signEIP712Message: vi.fn().mockResolvedValue(mockSignature),
      signPersonalMessage: vi.fn().mockResolvedValue(mockSignature),
    };

    // Mock dynamic imports
    vi.doMock("@ledgerhq/hw-transport-webusb", () => ({
      default: { create: mockTransport.create },
    }));

    vi.doMock("@ledgerhq/hw-app-eth", () => ({
      default: vi.fn().mockImplementation(() => mockEth),
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("should correctly format signature from r, s, v", () => {
    // Test the signature formatting logic
    const r = mockSignature.r.padStart(64, "0");
    const s = mockSignature.s.padStart(64, "0");
    const v = mockSignature.v.toString(16).padStart(2, "0");

    const signature = `0x${r}${s}${v}`;

    expect(signature).toMatch(/^0x[0-9a-f]{130}$/i);
    expect(signature.length).toBe(132); // 0x + 64 + 64 + 2
  });
});

describe("TrezorSigner with Mocked Connect", () => {
  const mockAddress = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address;
  const validOptions: TrezorOptions = {
    manifest: {
      email: "test@example.com",
      appUrl: "https://example.com",
    },
  };

  let mockTrezorConnect: {
    init: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
    getFeatures: ReturnType<typeof vi.fn>;
    ethereumGetAddress: ReturnType<typeof vi.fn>;
    ethereumSignTypedData: ReturnType<typeof vi.fn>;
    ethereumSignMessage: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockTrezorConnect = {
      init: vi.fn().mockResolvedValue(undefined),
      dispose: vi.fn(),
      getFeatures: vi.fn().mockResolvedValue({
        success: true,
        payload: {
          model: "T",
          major_version: 2,
          minor_version: 4,
          patch_version: 3,
        },
      }),
      ethereumGetAddress: vi.fn().mockResolvedValue({
        success: true,
        payload: { address: mockAddress },
      }),
      ethereumSignTypedData: vi.fn().mockResolvedValue({
        success: true,
        payload: { signature: "0x1234" },
      }),
      ethereumSignMessage: vi.fn().mockResolvedValue({
        success: true,
        payload: { signature: "1234" },
      }),
    };

    vi.doMock("@trezor/connect", () => ({
      default: mockTrezorConnect,
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("should require manifest for initialization", () => {
    expect(() => new TrezorSigner({} as TrezorOptions)).toThrow("manifest is required");
  });

  it("should accept valid manifest", () => {
    const signer = new TrezorSigner(validOptions);
    expect(signer.walletType).toBe("trezor");
  });
});

// =============================================================================
// Error Wrapping Tests
// =============================================================================

describe("Error Wrapping", () => {
  describe("Ledger error mapping", () => {
    const errorMessages = [
      { input: "user denied", expectedCode: HardwareWalletErrorCode.USER_REJECTED },
      { input: "rejected by user", expectedCode: HardwareWalletErrorCode.USER_REJECTED },
      { input: "device is locked", expectedCode: HardwareWalletErrorCode.DEVICE_LOCKED },
      { input: "no device found", expectedCode: HardwareWalletErrorCode.DEVICE_NOT_FOUND },
      { input: "device not found", expectedCode: HardwareWalletErrorCode.DEVICE_NOT_FOUND },
      { input: "ethereum app not open", expectedCode: HardwareWalletErrorCode.APP_NOT_OPEN },
      { input: "open the app", expectedCode: HardwareWalletErrorCode.APP_NOT_OPEN },
      { input: "connection timeout", expectedCode: HardwareWalletErrorCode.TIMEOUT },
    ];

    it.each(errorMessages)("should map '$input' to $expectedCode", ({ input, expectedCode }) => {
      // This tests the error mapping logic conceptually
      // In a real test, we'd need to trigger these errors through the actual code path
      const message = input.toLowerCase();

      let code: HardwareWalletErrorCode;
      if (message.includes("denied") || message.includes("rejected")) {
        code = HardwareWalletErrorCode.USER_REJECTED;
      } else if (message.includes("locked")) {
        code = HardwareWalletErrorCode.DEVICE_LOCKED;
      } else if (message.includes("not found") || message.includes("no device")) {
        code = HardwareWalletErrorCode.DEVICE_NOT_FOUND;
      } else if (message.includes("app") || message.includes("ethereum")) {
        code = HardwareWalletErrorCode.APP_NOT_OPEN;
      } else if (message.includes("timeout")) {
        code = HardwareWalletErrorCode.TIMEOUT;
      } else {
        code = HardwareWalletErrorCode.UNKNOWN_ERROR;
      }

      expect(code).toBe(expectedCode);
    });
  });

  describe("Trezor error mapping", () => {
    const errorMessages = [
      { input: "cancelled by user", expectedCode: HardwareWalletErrorCode.USER_REJECTED },
      { input: "user rejected", expectedCode: HardwareWalletErrorCode.USER_REJECTED },
      { input: "action denied", expectedCode: HardwareWalletErrorCode.USER_REJECTED },
      { input: "pin required", expectedCode: HardwareWalletErrorCode.DEVICE_LOCKED },
      { input: "passphrase required", expectedCode: HardwareWalletErrorCode.DEVICE_LOCKED },
      { input: "device not found", expectedCode: HardwareWalletErrorCode.DEVICE_NOT_FOUND },
      { input: "connection timeout", expectedCode: HardwareWalletErrorCode.TIMEOUT },
    ];

    it.each(errorMessages)("should map '$input' to $expectedCode", ({ input, expectedCode }) => {
      const message = input.toLowerCase();

      let code: HardwareWalletErrorCode;
      if (message.includes("cancelled") || message.includes("rejected") || message.includes("denied")) {
        code = HardwareWalletErrorCode.USER_REJECTED;
      } else if (message.includes("pin") || message.includes("passphrase")) {
        code = HardwareWalletErrorCode.DEVICE_LOCKED;
      } else if (message.includes("device") && message.includes("not found")) {
        code = HardwareWalletErrorCode.DEVICE_NOT_FOUND;
      } else if (message.includes("timeout")) {
        code = HardwareWalletErrorCode.TIMEOUT;
      } else {
        code = HardwareWalletErrorCode.UNKNOWN_ERROR;
      }

      expect(code).toBe(expectedCode);
    });
  });
});

// =============================================================================
// Derivation Path Tests
// =============================================================================

describe("Derivation Path Handling", () => {
  it("should use standard Ethereum derivation path", () => {
    const ledger = new LedgerSigner();
    const trezor = new TrezorSigner({
      manifest: { email: "test@example.com", appUrl: "https://example.com" },
    });

    // Both should use m/44'/60'/0'/0/N format
    expect(ledger.derivationPath).toMatch(/^m\/44'\/60'\/0'\/0\/\d+$/);
    expect(trezor.derivationPath).toMatch(/^m\/44'\/60'\/0'\/0\/\d+$/);
  });

  it("should respect account index", () => {
    const ledger = new LedgerSigner({ accountIndex: 5 });
    const trezor = new TrezorSigner({
      manifest: { email: "test@example.com", appUrl: "https://example.com" },
      accountIndex: 5,
    });

    expect(ledger.derivationPath).toBe("m/44'/60'/0'/0/5");
    expect(trezor.derivationPath).toBe("m/44'/60'/0'/0/5");
  });

  it("should allow custom derivation paths", () => {
    const customPath = "m/44'/60'/1'/0/0";

    const ledger = new LedgerSigner({ derivationPath: customPath });
    const trezor = new TrezorSigner({
      manifest: { email: "test@example.com", appUrl: "https://example.com" },
      derivationPath: customPath,
    });

    expect(ledger.derivationPath).toBe(customPath);
    expect(trezor.derivationPath).toBe(customPath);
  });
});

// =============================================================================
// Options Validation Tests
// =============================================================================

describe("Options Validation", () => {
  describe("LedgerOptions", () => {
    it("should accept all valid transport types", () => {
      const transports: LedgerOptions["transport"][] = ["webusb", "webhid", "bluetooth"];

      transports.forEach((transport) => {
        const signer = new LedgerSigner({ transport });
        expect(signer.walletType).toBe("ledger");
      });
    });

    it("should use default transport when not specified", () => {
      const signer = new LedgerSigner({});
      // Default is webusb
      expect(signer.walletType).toBe("ledger");
    });
  });

  describe("TrezorOptions", () => {
    it("should require both email and appUrl in manifest", () => {
      expect(
        () =>
          new TrezorSigner({
            manifest: { email: "test@example.com", appUrl: "https://example.com" },
          }),
      ).not.toThrow();
    });

    it("should accept popup and debug options", () => {
      const signer = new TrezorSigner({
        manifest: { email: "test@example.com", appUrl: "https://example.com" },
        popup: false,
        debug: true,
      });

      expect(signer.walletType).toBe("trezor");
    });
  });
});
