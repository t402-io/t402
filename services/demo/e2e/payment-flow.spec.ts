import { test, expect } from "@playwright/test";

test.describe("Demo/Live Mode Toggle", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/ai-api");
  });

  test("demo mode is the default (Demo button has aria-pressed true)", async ({ page }) => {
    const demoButton = page.getByRole("button", { name: "Demo" });
    await expect(demoButton).toHaveAttribute("aria-pressed", "true");

    const liveButton = page.getByRole("button", { name: "Live" });
    await expect(liveButton).toHaveAttribute("aria-pressed", "false");
  });

  test("can switch to Live mode (Live button gets aria-pressed true)", async ({ page }) => {
    const liveButton = page.getByRole("button", { name: "Live" });
    await liveButton.click();

    await expect(liveButton).toHaveAttribute("aria-pressed", "true");

    const demoButton = page.getByRole("button", { name: "Demo" });
    await expect(demoButton).toHaveAttribute("aria-pressed", "false");
  });
});

test.describe("PaymentChecklist Visibility", () => {
  test("PaymentChecklist visible in Live mode (shows wallet warning)", async ({ page }) => {
    await page.goto("/ai-api");

    // Switch to Live mode
    await page.getByRole("button", { name: "Live" }).click();

    // PaymentChecklist should appear with wallet-not-connected warning
    await expect(page.getByText("Before you can pay")).toBeVisible();
    await expect(page.getByText("Wallet not connected")).toBeVisible();
  });

  test("PaymentChecklist hidden in Demo mode", async ({ page }) => {
    await page.goto("/ai-api");

    // In demo mode (default), PaymentChecklist should not render
    await expect(page.getByText("Before you can pay")).not.toBeVisible();
  });
});

test.describe("Demo Mode Banner", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/content-paywall");
  });

  test("demo mode banner visible on scenario page", async ({ page }) => {
    await expect(
      page.getByText("Demo Mode — Payments are simulated")
    ).toBeVisible();
  });

  test("demo mode banner disappears in Live mode", async ({ page }) => {
    await page.getByRole("button", { name: "Live" }).click();

    await expect(
      page.getByText("Demo Mode — Payments are simulated")
    ).not.toBeVisible();
  });
});

test.describe("Chain Selector", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/ai-api");
  });

  test("chain selector changes chain (click TON, verify badge updates)", async ({ page }) => {
    // Find the chain selector tablist within main content (not header)
    const mainContent = page.locator("#main-content");
    const chainSelector = mainContent.getByRole("tablist", { name: "Blockchain selection" });

    // Click the TON tab
    const tonTab = chainSelector.getByRole("tab", { name: /TON/i });
    await tonTab.click();

    // TON tab should now be selected
    await expect(tonTab).toHaveAttribute("aria-selected", "true");

    // Chain badge in the scenario shell should show TON
    await expect(mainContent.getByText("TON Testnet")).toBeVisible();
  });

  test("EVM is selected by default", async ({ page }) => {
    const mainContent = page.locator("#main-content");
    const chainSelector = mainContent.getByRole("tablist", { name: "Blockchain selection" });

    // First tab (EVM) should be selected
    const evmTab = chainSelector.getByRole("tab").first();
    await expect(evmTab).toHaveAttribute("aria-selected", "true");
  });
});

test.describe("Chain Preference Persistence", () => {
  test("chain preference persists across navigation", async ({ page }) => {
    await page.goto("/ai-api");

    // Select TON in the main content chain selector
    const mainContent = page.locator("#main-content");
    const chainSelector = mainContent.getByRole("tablist", { name: "Blockchain selection" });
    const tonTab = chainSelector.getByRole("tab", { name: /TON/i });
    await tonTab.click();
    await expect(tonTab).toHaveAttribute("aria-selected", "true");

    // Navigate to another scenario
    await page.goto("/content-paywall");

    // TON should still be selected
    const newMainContent = page.locator("#main-content");
    const newChainSelector = newMainContent.getByRole("tablist", { name: "Blockchain selection" });
    const newTonTab = newChainSelector.getByRole("tab", { name: /TON/i });
    await expect(newTonTab).toHaveAttribute("aria-selected", "true");
  });
});
