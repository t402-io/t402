import { describe, it, expect, beforeEach, vi } from "vitest";
import { DEFAULT_CONFIG } from "../types.js";

// Use vi.hoisted to ensure mockStore is available when vi.mock runs
const { mockStore, mockConfInstance } = vi.hoisted(() => {
  const store: Record<string, unknown> = {};
  const instance = {
    get: vi.fn((key: string) => store[key]),
    set: vi.fn((key: string, value: unknown) => {
      store[key] = value;
    }),
    delete: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach((key) => delete store[key]);
    }),
    store,
    path: "/mock/path/to/config.json",
  };
  return { mockStore: store, mockConfInstance: instance };
});

// Mock the Conf module
vi.mock("conf", () => ({
  default: vi.fn(() => mockConfInstance),
}));

// Import after mock is set up
import {
  getConfig,
  setConfig,
  getAllConfig,
  resetConfig,
  getConfigPath,
  hasSeedConfigured,
  storeSeed,
  getEncryptedSeed,
  clearSeed,
  setRpcEndpoint,
  getRpcEndpoint,
} from "./index.js";

describe("Config Module", () => {
  beforeEach(() => {
    // Reset mock store to defaults
    Object.keys(mockStore).forEach((key) => delete mockStore[key]);
    Object.assign(mockStore, { ...DEFAULT_CONFIG, rpcEndpoints: {} });
    vi.clearAllMocks();
  });

  describe("getConfig", () => {
    it("gets default network", () => {
      mockStore.defaultNetwork = "eip155:8453";
      const value = getConfig("defaultNetwork");
      expect(value).toBe("eip155:8453");
    });

    it("gets facilitator URL", () => {
      mockStore.facilitatorUrl = "https://facilitator.t402.io";
      const value = getConfig("facilitatorUrl");
      expect(value).toBe("https://facilitator.t402.io");
    });

    it("gets testnet mode", () => {
      mockStore.testnet = false;
      const value = getConfig("testnet");
      expect(value).toBe(false);
    });

    it("gets RPC endpoints", () => {
      mockStore.rpcEndpoints = { "eip155:8453": "https://custom.rpc.com" };
      const value = getConfig("rpcEndpoints");
      expect(value).toEqual({ "eip155:8453": "https://custom.rpc.com" });
    });
  });

  describe("setConfig", () => {
    it("sets default network", () => {
      setConfig("defaultNetwork", "eip155:1");
      expect(mockConfInstance.set).toHaveBeenCalledWith("defaultNetwork", "eip155:1");
    });

    it("sets facilitator URL", () => {
      setConfig("facilitatorUrl", "https://new.facilitator.io");
      expect(mockConfInstance.set).toHaveBeenCalledWith("facilitatorUrl", "https://new.facilitator.io");
    });

    it("sets testnet mode", () => {
      setConfig("testnet", true);
      expect(mockConfInstance.set).toHaveBeenCalledWith("testnet", true);
    });
  });

  describe("getAllConfig", () => {
    it("returns entire config store", () => {
      mockStore.defaultNetwork = "eip155:8453";
      mockStore.testnet = false;
      const cfg = getAllConfig();
      expect(cfg).toBe(mockStore);
    });
  });

  describe("resetConfig", () => {
    it("clears the config store", () => {
      mockStore.defaultNetwork = "eip155:1";
      mockStore.testnet = true;
      resetConfig();
      expect(mockConfInstance.clear).toHaveBeenCalled();
    });
  });

  describe("getConfigPath", () => {
    it("returns the config file path", () => {
      const path = getConfigPath();
      expect(path).toBe("/mock/path/to/config.json");
    });
  });

  describe("Seed Management", () => {
    describe("hasSeedConfigured", () => {
      it("returns false when no seed is stored", () => {
        mockStore.encryptedSeed = undefined;
        expect(hasSeedConfigured()).toBe(false);
      });

      it("returns true when seed is stored", () => {
        mockStore.encryptedSeed = "encrypted-seed-data";
        expect(hasSeedConfigured()).toBe(true);
      });

      it("returns false for empty string", () => {
        mockStore.encryptedSeed = "";
        expect(hasSeedConfigured()).toBe(false);
      });
    });

    describe("storeSeed", () => {
      it("stores encrypted seed", () => {
        storeSeed("encrypted-seed-data");
        expect(mockConfInstance.set).toHaveBeenCalledWith("encryptedSeed", "encrypted-seed-data");
      });
    });

    describe("getEncryptedSeed", () => {
      it("returns encrypted seed", () => {
        mockStore.encryptedSeed = "encrypted-seed-data";
        expect(getEncryptedSeed()).toBe("encrypted-seed-data");
      });

      it("returns undefined when no seed stored", () => {
        mockStore.encryptedSeed = undefined;
        expect(getEncryptedSeed()).toBeUndefined();
      });
    });

    describe("clearSeed", () => {
      it("deletes the encrypted seed", () => {
        clearSeed();
        expect(mockConfInstance.delete).toHaveBeenCalledWith("encryptedSeed");
      });
    });
  });

  describe("RPC Endpoint Management", () => {
    describe("setRpcEndpoint", () => {
      it("sets RPC endpoint for network", () => {
        mockStore.rpcEndpoints = {};
        setRpcEndpoint("eip155:8453", "https://custom.rpc.com");
        expect(mockConfInstance.set).toHaveBeenCalledWith("rpcEndpoints", {
          "eip155:8453": "https://custom.rpc.com",
        });
      });

      it("preserves existing endpoints when adding new one", () => {
        mockStore.rpcEndpoints = { "eip155:1": "https://eth.rpc.com" };
        setRpcEndpoint("eip155:8453", "https://base.rpc.com");
        expect(mockConfInstance.set).toHaveBeenCalledWith("rpcEndpoints", {
          "eip155:1": "https://eth.rpc.com",
          "eip155:8453": "https://base.rpc.com",
        });
      });

      it("overwrites existing endpoint for same network", () => {
        mockStore.rpcEndpoints = { "eip155:8453": "https://old.rpc.com" };
        setRpcEndpoint("eip155:8453", "https://new.rpc.com");
        expect(mockConfInstance.set).toHaveBeenCalledWith("rpcEndpoints", {
          "eip155:8453": "https://new.rpc.com",
        });
      });
    });

    describe("getRpcEndpoint", () => {
      it("returns RPC endpoint for network", () => {
        mockStore.rpcEndpoints = { "eip155:8453": "https://custom.rpc.com" };
        expect(getRpcEndpoint("eip155:8453")).toBe("https://custom.rpc.com");
      });

      it("returns undefined for unconfigured network", () => {
        mockStore.rpcEndpoints = {};
        expect(getRpcEndpoint("eip155:999")).toBeUndefined();
      });
    });
  });
});
