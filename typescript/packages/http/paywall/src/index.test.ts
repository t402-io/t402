import { describe, it, expect } from "vitest";
import {
  createPaywall,
  PaywallBuilder,
  evmPaywall,
  svmPaywall,
} from "./index";

describe("@t402/paywall", () => {
  describe("exports", () => {
    it("exports createPaywall function", () => {
      expect(typeof createPaywall).toBe("function");
    });

    it("exports PaywallBuilder class", () => {
      expect(PaywallBuilder).toBeDefined();
      expect(createPaywall()).toBeInstanceOf(PaywallBuilder);
    });

    it("exports evmPaywall handler", () => {
      expect(evmPaywall).toBeDefined();
      expect(typeof evmPaywall.supports).toBe("function");
      expect(typeof evmPaywall.generateHtml).toBe("function");
    });

    it("exports svmPaywall handler", () => {
      expect(svmPaywall).toBeDefined();
      expect(typeof svmPaywall.supports).toBe("function");
      expect(typeof svmPaywall.generateHtml).toBe("function");
    });
  });

  describe("integration", () => {
    it("builds a working paywall with EVM support", () => {
      const paywall = createPaywall()
        .withNetwork(evmPaywall)
        .withConfig({ appName: "Test App" })
        .build();

      expect(paywall).toHaveProperty("generateHtml");
      expect(typeof paywall.generateHtml).toBe("function");
    });

    it("builds a multi-chain paywall", () => {
      const paywall = createPaywall()
        .withNetwork(evmPaywall)
        .withNetwork(svmPaywall)
        .build();

      expect(paywall).toHaveProperty("generateHtml");
    });
  });
});
