import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PaymentRequired } from "./types";

const MOCK_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
  <title>Test Paywall</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>`;

// Mock all template loaders before importing the paywall modules
vi.mock("./evm/template-loader", () => ({
  getEvmTemplate: vi.fn(() => MOCK_TEMPLATE),
}));

vi.mock("./svm/template-loader", () => ({
  getSvmTemplate: vi.fn(() => MOCK_TEMPLATE),
}));

vi.mock("./ton/template-loader", () => ({
  getTonTemplate: vi.fn(() => MOCK_TEMPLATE),
}));

import { getEvmPaywallHtml } from "./evm/paywall";
import { getSvmPaywallHtml } from "./svm/paywall";
import { getTonPaywallHtml } from "./ton/paywall";
import { getEvmTemplate } from "./evm/template-loader";
import { getSvmTemplate } from "./svm/template-loader";
import { getTonTemplate } from "./ton/template-loader";

const mockPaymentRequired: PaymentRequired = {
  t402Version: 2,
  resource: {
    url: "https://example.com/api/data",
    description: "Test Resource",
    mimeType: "application/json",
  },
  accepts: [
    {
      scheme: "exact",
      network: "eip155:84532",
      asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      amount: "100000",
      payTo: "0x209693Bc6afc0C5328bA36FaF04C514EF312287C",
      maxTimeoutSeconds: 60,
    },
  ],
};

describe("Network Paywall HTML Generators", () => {
  beforeEach(() => {
    vi.mocked(getEvmTemplate).mockReturnValue(MOCK_TEMPLATE);
    vi.mocked(getSvmTemplate).mockReturnValue(MOCK_TEMPLATE);
    vi.mocked(getTonTemplate).mockReturnValue(MOCK_TEMPLATE);
  });

  describe("getEvmPaywallHtml", () => {
    it("returns fallback HTML when template loader returns null", () => {
      vi.mocked(getEvmTemplate).mockReturnValue(null);
      const html = getEvmPaywallHtml({
        amount: 0.1,
        paymentRequired: mockPaymentRequired,
        currentUrl: "https://example.com/api/data",
        testnet: true,
      });
      expect(html).toContain("EVM Paywall");
      expect(html).toContain("run pnpm build:paywall");
    });

    it("injects amount into config script", () => {
      const html = getEvmPaywallHtml({
        amount: 0.1,
        paymentRequired: mockPaymentRequired,
        currentUrl: "https://example.com/api/data",
        testnet: true,
      });
      expect(html).toContain("amount: 0.1");
    });

    it("includes walletConnect config only when projectId is provided", () => {
      const htmlWithout = getEvmPaywallHtml({
        amount: 0.1,
        paymentRequired: mockPaymentRequired,
        currentUrl: "https://example.com/api/data",
        testnet: true,
      });
      expect(htmlWithout).not.toContain("walletConnectProjectId");

      const htmlWith = getEvmPaywallHtml({
        amount: 0.1,
        paymentRequired: mockPaymentRequired,
        currentUrl: "https://example.com/api/data",
        testnet: true,
        walletConnectProjectId: "abc123",
      });
      expect(htmlWith).toContain('walletConnectProjectId: "abc123"');
    });

    it("injects appName and appLogo into config", () => {
      const html = getEvmPaywallHtml({
        amount: 0.5,
        paymentRequired: mockPaymentRequired,
        currentUrl: "https://example.com",
        testnet: false,
        appName: "My App",
        appLogo: "/logo.png",
      });
      expect(html).toContain("My App");
      expect(html).toContain("/logo.png");
    });

    it("escapes special characters in config values", () => {
      const html = getEvmPaywallHtml({
        amount: 0.1,
        paymentRequired: mockPaymentRequired,
        currentUrl: 'https://example.com/path"with"quotes',
        testnet: true,
        appName: 'App "with" quotes',
      });
      expect(html).toContain('\\"with\\"');
    });

    it("injects theme script before </head>", () => {
      const html = getEvmPaywallHtml({
        amount: 0.1,
        paymentRequired: mockPaymentRequired,
        currentUrl: "https://example.com",
        testnet: true,
        theme: { mode: "dark" },
      });
      // Theme script should appear before </head>
      const headCloseIndex = html.indexOf("</head>");
      const themeIndex = html.indexOf("dark");
      expect(themeIndex).toBeLessThan(headCloseIndex);
      expect(themeIndex).toBeGreaterThan(-1);
    });

    it("detects testnet mode correctly", () => {
      const testnetHtml = getEvmPaywallHtml({
        amount: 0.1,
        paymentRequired: mockPaymentRequired,
        currentUrl: "https://example.com",
        testnet: true,
      });
      expect(testnetHtml).toContain("testnet: true");
      expect(testnetHtml).toContain("console.log");

      const mainnetHtml = getEvmPaywallHtml({
        amount: 0.1,
        paymentRequired: mockPaymentRequired,
        currentUrl: "https://example.com",
        testnet: false,
      });
      expect(mainnetHtml).toContain("testnet: false");
      expect(mainnetHtml).not.toContain("console.log");
    });
  });

  describe("getSvmPaywallHtml", () => {
    it("returns fallback HTML when template loader returns null", () => {
      vi.mocked(getSvmTemplate).mockReturnValue(null);
      const html = getSvmPaywallHtml({
        amount: 0.5,
        paymentRequired: mockPaymentRequired,
        currentUrl: "https://example.com",
        testnet: true,
      });
      expect(html).toContain("SVM Paywall");
      expect(html).toContain("run pnpm build:paywall");
    });

    it("injects amount and currentUrl", () => {
      const html = getSvmPaywallHtml({
        amount: 1.5,
        paymentRequired: mockPaymentRequired,
        currentUrl: "https://example.com/solana",
        testnet: false,
      });
      expect(html).toContain("amount: 1.5");
      expect(html).toContain("https://example.com/solana");
    });
  });

  describe("getTonPaywallHtml", () => {
    it("returns fallback HTML when template loader returns null", () => {
      vi.mocked(getTonTemplate).mockReturnValue(null);
      const html = getTonPaywallHtml({
        amount: 0.1,
        paymentRequired: mockPaymentRequired,
        currentUrl: "https://example.com",
        testnet: true,
      });
      expect(html).toContain("TON Paywall");
      expect(html).toContain("run pnpm build:paywall");
    });

    it("includes default manifest URL when custom not provided", () => {
      const html = getTonPaywallHtml({
        amount: 0.1,
        paymentRequired: mockPaymentRequired,
        currentUrl: "https://example.com",
        testnet: true,
      });
      expect(html).toContain("https://t402.io/tonconnect-manifest.json");
    });

    it("includes custom manifest URL when provided", () => {
      const html = getTonPaywallHtml({
        amount: 0.1,
        paymentRequired: mockPaymentRequired,
        currentUrl: "https://example.com",
        testnet: true,
        tonConnectManifestUrl: "https://myapp.com/manifest.json",
      });
      expect(html).toContain("https://myapp.com/manifest.json");
      expect(html).not.toContain("https://t402.io/tonconnect-manifest.json");
    });
  });
});
