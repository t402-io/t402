import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  fetchTonWallets,
  getBundledWallets,
  resetWalletsCache,
  filterWalletsByPlatform,
  generateWalletDeepLink,
  parseWalletsList,
  type TonWalletInfo,
} from "./wallets";

describe("TON Wallet Registry", () => {
  beforeEach(() => {
    resetWalletsCache();
    vi.restoreAllMocks();
  });

  describe("getBundledWallets", () => {
    it("returns a non-empty array of wallets", () => {
      const wallets = getBundledWallets();
      expect(wallets.length).toBeGreaterThan(0);
    });

    it("includes Tonkeeper in the bundled list", () => {
      const wallets = getBundledWallets();
      const tonkeeper = wallets.find(w => w.appName === "tonkeeper");
      expect(tonkeeper).toBeDefined();
      expect(tonkeeper!.name).toBe("Tonkeeper");
      expect(tonkeeper!.platforms.length).toBeGreaterThan(0);
      expect(tonkeeper!.bridges.length).toBeGreaterThan(0);
    });

    it("all bundled wallets have required fields", () => {
      const wallets = getBundledWallets();
      for (const wallet of wallets) {
        expect(wallet.name).toBeTruthy();
        expect(wallet.appName).toBeTruthy();
        expect(wallet.imageUrl).toBeTruthy();
        expect(wallet.aboutUrl).toBeTruthy();
        expect(wallet.platforms.length).toBeGreaterThan(0);
        expect(wallet.bridges.length).toBeGreaterThan(0);
      }
    });
  });

  describe("fetchTonWallets", () => {
    it("returns wallets from cache on second call within TTL", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            name: "TestWallet",
            app_name: "testwallet",
            image: "https://example.com/icon.png",
            about_url: "https://example.com",
            platforms: ["ios"],
            bridge: [{ type: "sse", url: "https://bridge.example.com" }],
          },
        ],
      } as Response);

      const first = await fetchTonWallets();
      const second = await fetchTonWallets();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(first).toEqual(second);
      expect(first[0].name).toBe("TestWallet");
    });

    it("falls back to bundled wallets on fetch error", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"));

      const wallets = await fetchTonWallets();
      const bundled = getBundledWallets();
      expect(wallets).toEqual(bundled);
    });

    it("falls back to bundled wallets on non-ok response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const wallets = await fetchTonWallets();
      const bundled = getBundledWallets();
      expect(wallets).toEqual(bundled);
    });

    it("refetches after cache TTL expires", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            name: "First",
            app_name: "first",
            image: "https://example.com/1.png",
            about_url: "https://example.com",
            platforms: ["ios"],
            bridge: [{ type: "sse", url: "https://bridge.example.com" }],
          },
        ],
      } as Response);

      await fetchTonWallets(0); // TTL = 0 means always expired

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            name: "Second",
            app_name: "second",
            image: "https://example.com/2.png",
            about_url: "https://example.com",
            platforms: ["android"],
            bridge: [{ type: "sse", url: "https://bridge.example.com" }],
          },
        ],
      } as Response);

      const wallets = await fetchTonWallets(0);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(wallets[0].name).toBe("Second");
    });
  });

  describe("filterWalletsByPlatform", () => {
    const testWallets: TonWalletInfo[] = [
      {
        name: "iOS Only",
        appName: "ios-only",
        imageUrl: "",
        aboutUrl: "",
        platforms: ["ios"],
        bridges: [{ type: "sse", url: "https://bridge.example.com" }],
      },
      {
        name: "Android Only",
        appName: "android-only",
        imageUrl: "",
        aboutUrl: "",
        platforms: ["android"],
        bridges: [{ type: "sse", url: "https://bridge.example.com" }],
      },
      {
        name: "Chrome Extension",
        appName: "chrome-ext",
        imageUrl: "",
        aboutUrl: "",
        platforms: ["chrome"],
        bridges: [{ type: "js", key: "chromeext" }],
      },
      {
        name: "Desktop App",
        appName: "desktop-app",
        imageUrl: "",
        aboutUrl: "",
        platforms: ["windows", "macos", "linux"],
        bridges: [{ type: "sse", url: "https://bridge.example.com" }],
      },
      {
        name: "Multi Platform",
        appName: "multi",
        imageUrl: "",
        aboutUrl: "",
        platforms: ["ios", "android", "chrome", "windows"],
        bridges: [{ type: "sse", url: "https://bridge.example.com" }],
      },
    ];

    it("filters for iOS", () => {
      const result = filterWalletsByPlatform(testWallets, "ios");
      expect(result.map(w => w.appName)).toEqual(["ios-only", "multi"]);
    });

    it("filters for Android", () => {
      const result = filterWalletsByPlatform(testWallets, "android");
      expect(result.map(w => w.appName)).toEqual(["android-only", "multi"]);
    });

    it("filters for browser (chrome/firefox/safari)", () => {
      const result = filterWalletsByPlatform(testWallets, "browser");
      expect(result.map(w => w.appName)).toEqual(["chrome-ext", "multi"]);
    });

    it("filters for desktop (windows/macos/linux + browser extensions)", () => {
      const result = filterWalletsByPlatform(testWallets, "desktop");
      expect(result.map(w => w.appName)).toEqual(["chrome-ext", "desktop-app", "multi"]);
    });
  });

  describe("generateWalletDeepLink", () => {
    it("generates deep link when available", () => {
      const wallet: TonWalletInfo = {
        name: "Test",
        appName: "test",
        imageUrl: "",
        aboutUrl: "",
        platforms: ["ios"],
        bridges: [],
        deepLink: "testwallet-tc://",
        universalUrl: "https://test.com/connect",
      };

      const link = generateWalletDeepLink(wallet, "tc://session123");
      expect(link).toContain("testwallet-tc://");
      expect(link).toContain("tc%3A%2F%2Fsession123");
    });

    it("falls back to universal URL when no deep link", () => {
      const wallet: TonWalletInfo = {
        name: "Test",
        appName: "test",
        imageUrl: "",
        aboutUrl: "",
        platforms: ["ios"],
        bridges: [],
        universalUrl: "https://test.com/connect",
      };

      const link = generateWalletDeepLink(wallet, "session123");
      expect(link).toContain("https://test.com/connect");
      expect(link).toContain("session123");
    });

    it("handles universal URL with existing query params", () => {
      const wallet: TonWalletInfo = {
        name: "Test",
        appName: "test",
        imageUrl: "",
        aboutUrl: "",
        platforms: ["ios"],
        bridges: [],
        universalUrl: "https://test.com/connect?foo=bar",
      };

      const link = generateWalletDeepLink(wallet, "session123");
      expect(link).toContain("&v=2");
    });

    it("returns null when no links available", () => {
      const wallet: TonWalletInfo = {
        name: "Test",
        appName: "test",
        imageUrl: "",
        aboutUrl: "",
        platforms: ["chrome"],
        bridges: [{ type: "js", key: "test" }],
      };

      const link = generateWalletDeepLink(wallet, "session123");
      expect(link).toBeNull();
    });
  });

  describe("parseWalletsList", () => {
    it("parses valid wallet entries", () => {
      const data = [
        {
          name: "TestWallet",
          app_name: "testwallet",
          image: "https://example.com/icon.png",
          about_url: "https://example.com",
          platforms: ["ios", "android"],
          bridge: [
            { type: "sse", url: "https://bridge.example.com" },
            { type: "js", key: "testwallet" },
          ],
          universal_url: "https://test.com/connect",
          deepLink: "test://",
        },
      ];

      const wallets = parseWalletsList(data);
      expect(wallets).toHaveLength(1);
      expect(wallets[0].name).toBe("TestWallet");
      expect(wallets[0].appName).toBe("testwallet");
      expect(wallets[0].platforms).toEqual(["ios", "android"]);
      expect(wallets[0].bridges).toHaveLength(2);
      expect(wallets[0].universalUrl).toBe("https://test.com/connect");
      expect(wallets[0].deepLink).toBe("test://");
    });

    it("skips entries without name or app_name", () => {
      const data = [
        {
          name: "Valid",
          app_name: "valid",
          image: "",
          about_url: "",
          platforms: ["ios"],
          bridge: [{ type: "sse", url: "https://b.com" }],
        },
        { name: "", app_name: "invalid", image: "", about_url: "", platforms: [], bridge: [] },
        { name: "NoApp", image: "", about_url: "", platforms: [], bridge: [] },
      ];

      const wallets = parseWalletsList(data);
      expect(wallets).toHaveLength(1);
      expect(wallets[0].name).toBe("Valid");
    });

    it("returns bundled wallets for non-array input", () => {
      const bundled = getBundledWallets();
      expect(parseWalletsList(null)).toEqual(bundled);
      expect(parseWalletsList("string")).toEqual(bundled);
      expect(parseWalletsList(42)).toEqual(bundled);
    });

    it("returns bundled wallets when all entries are invalid", () => {
      const bundled = getBundledWallets();
      const result = parseWalletsList([null, undefined, { broken: true }]);
      expect(result).toEqual(bundled);
    });
  });
});
