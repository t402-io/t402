/**
 * WDK Smart Account Tests
 *
 * Tests for WdkSmartAccount and createWdkSmartAccount
 */

import { describe, it, expect } from "vitest";
import { SAFE_4337_ADDRESSES } from "./account.js";

describe("SAFE_4337_ADDRESSES", () => {
  it("should have all required addresses", () => {
    expect(SAFE_4337_ADDRESSES.module).toBeDefined();
    expect(SAFE_4337_ADDRESSES.moduleSetup).toBeDefined();
    expect(SAFE_4337_ADDRESSES.singleton).toBeDefined();
    expect(SAFE_4337_ADDRESSES.proxyFactory).toBeDefined();
    expect(SAFE_4337_ADDRESSES.fallbackHandler).toBeDefined();
    expect(SAFE_4337_ADDRESSES.addModulesLib).toBeDefined();
  });

  it("should have valid Ethereum addresses", () => {
    Object.values(SAFE_4337_ADDRESSES).forEach((address) => {
      expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });
  });

  it("should have correct module address (Safe 4337 v0.3.0)", () => {
    expect(SAFE_4337_ADDRESSES.module).toBe("0xa581c4A4DB7175302464fF3C06380BC3270b4037");
  });

  it("should have correct proxy factory address", () => {
    expect(SAFE_4337_ADDRESSES.proxyFactory).toBe("0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67");
  });

  it("should have correct singleton address", () => {
    expect(SAFE_4337_ADDRESSES.singleton).toBe("0x29fcB43b46531BcA003ddC8FCB67FFE91900C762");
  });

  it("should have correct module setup address", () => {
    expect(SAFE_4337_ADDRESSES.moduleSetup).toBe("0x2dd68b007B46fBe91B9A7c3EDa5A7a1063cB5b47");
  });

  it("should have correct fallback handler address", () => {
    expect(SAFE_4337_ADDRESSES.fallbackHandler).toBe("0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99");
  });

  it("should have correct add modules lib address", () => {
    expect(SAFE_4337_ADDRESSES.addModulesLib).toBe("0x8EcD4ec46D4D2a6B64fE960B3D64e8B94B2234eb");
  });
});

describe("WdkSmartAccount exports", () => {
  it("should export WdkSmartAccount class", async () => {
    const mod = await import("./account.js");
    expect(mod.WdkSmartAccount).toBeDefined();
    expect(typeof mod.WdkSmartAccount).toBe("function");
  });

  it("should export createWdkSmartAccount function", async () => {
    const mod = await import("./account.js");
    expect(mod.createWdkSmartAccount).toBeDefined();
    expect(typeof mod.createWdkSmartAccount).toBe("function");
  });

  it("should export SAFE_4337_ADDRESSES constant", async () => {
    const mod = await import("./account.js");
    expect(mod.SAFE_4337_ADDRESSES).toBeDefined();
    expect(typeof mod.SAFE_4337_ADDRESSES).toBe("object");
  });
});

describe("WdkSmartAccount class structure", () => {
  it("should be a class with expected methods", async () => {
    const { WdkSmartAccount } = await import("./account.js");

    // Check that expected methods exist on the prototype
    expect(WdkSmartAccount.prototype.initialize).toBeDefined();
    expect(WdkSmartAccount.prototype.getOwnerAddress).toBeDefined();
    expect(WdkSmartAccount.prototype.getAddress).toBeDefined();
    expect(WdkSmartAccount.prototype.signUserOpHash).toBeDefined();
    expect(WdkSmartAccount.prototype.getInitCode).toBeDefined();
    expect(WdkSmartAccount.prototype.isDeployed).toBeDefined();
    expect(WdkSmartAccount.prototype.encodeExecute).toBeDefined();
    expect(WdkSmartAccount.prototype.encodeExecuteBatch).toBeDefined();
    expect(WdkSmartAccount.prototype.getOwners).toBeDefined();
    expect(WdkSmartAccount.prototype.getThreshold).toBeDefined();
    expect(WdkSmartAccount.prototype.clearCache).toBeDefined();
  });
});
