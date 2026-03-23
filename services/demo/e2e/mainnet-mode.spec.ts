import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3001";

test.describe("Mainnet Mode Toggle", () => {
  test("testnet mode returns testnet networks in 402 response", async ({ request }) => {
    const res = await request.get(`${BASE}/api/demo/content`, {
      headers: { "x-network-mode": "testnet" },
    });
    expect(res.status()).toBe(402);
    const body = await res.json();
    expect(body.accepts).toHaveLength(10);
    // First EVM entry should be Base Sepolia testnet
    const evm = body.accepts.find((a: { network: string }) => a.network.startsWith("eip155:"));
    expect(evm.network).toBe("eip155:84532");
  });

  test("mainnet mode returns mainnet networks in 402 response", async ({ request }) => {
    const res = await request.get(`${BASE}/api/demo/content`, {
      headers: { "x-network-mode": "mainnet" },
    });
    expect(res.status()).toBe(402);
    const body = await res.json();
    expect(body.accepts).toHaveLength(10);
    // First EVM entry should be Arbitrum mainnet (USDT0 — native ERC-20)
    const evm = body.accepts.find((a: { network: string }) => a.network.startsWith("eip155:"));
    expect(evm.network).toBe("eip155:42161");
    expect(evm.asset).toBe("0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9");
  });

  test("mainnet mode uses correct TRON mainnet address", async ({ request }) => {
    const res = await request.get(`${BASE}/api/demo/content`, {
      headers: { "x-network-mode": "mainnet" },
    });
    const body = await res.json();
    const tron = body.accepts.find((a: { network: string }) => a.network === "tron:mainnet");
    expect(tron).toBeTruthy();
    expect(tron.asset).toBe("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t");
  });

  test("preferred EVM chain in mainnet mode", async ({ request }) => {
    const res = await request.get(`${BASE}/api/demo/content`, {
      headers: {
        "x-network-mode": "mainnet",
        "x-preferred-chain": "evm",
        "x-preferred-network": "eip155:42161", // Arbitrum
      },
    });
    const body = await res.json();
    // Arbitrum should be first
    expect(body.accepts[0].network).toBe("eip155:42161");
    expect(body.accepts[0].extra.name).toBe("TetherToken");
  });

  test("mainnet/testnet toggle is visible on scenario page", async ({ page }) => {
    await page.goto(`${BASE}/ai-api`);
    // Both toggles should be visible
    const testnetBtn = page.getByRole("button", { name: "Testnet" });
    const mainnetBtn = page.getByRole("button", { name: "Mainnet" });
    await expect(testnetBtn).toBeVisible();
    await expect(mainnetBtn).toBeVisible();
    // Testnet is active by default
    await expect(testnetBtn).toHaveAttribute("aria-pressed", "true");
  });

  test("switching to mainnet shows warning in live mode", async ({ page }) => {
    await page.goto(`${BASE}/ai-api`);
    // Switch to Live mode
    const liveBtn = page.getByRole("button", { name: "Live" });
    await liveBtn.click();
    // Switch to Mainnet
    const mainnetBtn = page.getByRole("button", { name: "Mainnet" });
    await mainnetBtn.click();
    // Should show mainnet warning
    await expect(page.getByText("real funds")).toBeVisible();
  });
});
