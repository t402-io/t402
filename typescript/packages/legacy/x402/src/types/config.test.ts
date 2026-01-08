import { describe, it, expect } from "vitest";
import { T402Config, SvmConfig } from "./config";

describe("T402Config Types", () => {
  describe("SvmConfig", () => {
    it("should accept valid SvmConfig with rpcUrl", () => {
      const config: SvmConfig = {
        rpcUrl: "http://localhost:8899",
      };

      expect(config.rpcUrl).toBe("http://localhost:8899");
    });

    it("should accept empty SvmConfig", () => {
      const config: SvmConfig = {};

      expect(config.rpcUrl).toBeUndefined();
    });
  });

  describe("T402Config", () => {
    it("should accept valid T402Config with svmConfig", () => {
      const config: T402Config = {
        svmConfig: {
          rpcUrl: "https://api.mainnet-beta.solana.com",
        },
      };

      expect(config.svmConfig?.rpcUrl).toBe("https://api.mainnet-beta.solana.com");
    });

    it("should accept empty T402Config", () => {
      const config: T402Config = {};

      expect(config.svmConfig).toBeUndefined();
    });

    it("should accept T402Config with empty svmConfig", () => {
      const config: T402Config = {
        svmConfig: {},
      };

      expect(config.svmConfig).toBeDefined();
      expect(config.svmConfig?.rpcUrl).toBeUndefined();
    });

    it("should handle optional chaining correctly", () => {
      const config1: T402Config = {};
      const config2: T402Config = { svmConfig: {} };
      const config3: T402Config = { svmConfig: { rpcUrl: "http://localhost:8899" } };

      expect(config1.svmConfig?.rpcUrl).toBeUndefined();
      expect(config2.svmConfig?.rpcUrl).toBeUndefined();
      expect(config3.svmConfig?.rpcUrl).toBe("http://localhost:8899");
    });
  });
});
