import { test, expect } from "@playwright/test";

const SCENARIOS = [
  { path: "/ai-api", title: "AI API Monetization", cost: "0.001 USDT/query" },
  { path: "/content-paywall", title: "Content Paywall", cost: "0.01 USDT/article" },
  { path: "/data-marketplace", title: "Data Marketplace", cost: "0.001 USDT/request" },
  { path: "/agent-to-agent", title: "Agent-to-Agent", cost: "0.001 USDT/task" },
  { path: "/iot-micropayments", title: "IoT Micropayments", cost: "0.0001 USDT/reading" },
  { path: "/streaming-media", title: "Streaming Media", cost: "0.001 USDT/10s" },
  { path: "/mcp-ai-agent", title: "MCP AI Agent", cost: "0.001 USDT/tool" },
  { path: "/cross-chain-bridge", title: "Cross-Chain Bridge", cost: "0.01 USDT/bridge" },
  { path: "/gasless-payment", title: "Gasless Payment", cost: "0.001 USDT" },
];

test.describe("All 9 Scenario Pages Load", () => {
  for (const scenario of SCENARIOS) {
    test(`${scenario.title} page loads with content`, async ({ page }) => {
      await page.goto(scenario.path);

      // Page should not be 404
      await expect(page).not.toHaveTitle(/Not Found/i);

      // Body should have meaningful content
      const body = page.locator("body");
      await expect(body).not.toBeEmpty();

      // Main content area should exist
      await expect(page.locator("#main-content")).toBeVisible();
    });
  }
});

test.describe("Scenario Shell Elements", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/ai-api");
  });

  test("displays scenario title", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "AI API Monetization", level: 1 })).toBeVisible();
  });

  test("displays cost badge", async ({ page }) => {
    await expect(page.getByText("0.001 USDT/query")).toBeVisible();
  });

  test("has chain selector with tab roles", async ({ page }) => {
    const chainSelector = page.getByRole("tablist", { name: "Blockchain selection" });
    await expect(chainSelector).toBeVisible();

    // EVM tab should be selected by default
    const evmTab = chainSelector.getByRole("tab").first();
    await expect(evmTab).toHaveAttribute("aria-selected", "true");
  });

  test("shows demo mode banner", async ({ page }) => {
    await expect(page.getByText("Demo Mode — Payments are simulated")).toBeVisible();
  });
});

test.describe("AI API Deep Test", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/ai-api");
  });

  test("has textarea for queries", async ({ page }) => {
    const textarea = page.locator("textarea");
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveAttribute("placeholder", "Ask anything...");
  });

  test("shows example query buttons", async ({ page }) => {
    // All 4 example queries should be available as buttons (truncated text)
    const exampleButtons = page.locator("button").filter({ hasText: /What is HTTP 402/ });
    await expect(exampleButtons.first()).toBeVisible();
  });

  test("clicking example query updates textarea", async ({ page }) => {
    const textarea = page.locator("textarea");

    // Click a different example query
    const exampleBtn = page.locator("button").filter({ hasText: /Explain USDT0/ });
    await exampleBtn.first().click();

    await expect(textarea).toHaveValue("Explain USDT0 cross-chain transfers");
  });

  test("has Pay & Query button", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Pay & Query" })).toBeVisible();
  });

  test("shows cost per query badge", async ({ page }) => {
    await expect(page.getByText("0.001 USDT/query")).toBeVisible();
  });

  test("shows idle state placeholder before payment", async ({ page }) => {
    await expect(page.getByText("AI response will appear here after payment")).toBeVisible();
  });

  test("Pay & Query in demo mode triggers payment flow", async ({ page }) => {
    // Click Pay & Query
    await page.getByRole("button", { name: "Pay & Query" }).click();

    // Should show loading/payment state
    await expect(page.getByText(/Paying|Processing|Generating|Requesting/)).toBeVisible({ timeout: 5000 });

    // Wait for the flow to complete (demo mode is fast)
    await expect(page.getByText(/Paid|queries|error/i)).toBeVisible({ timeout: 15000 });
  });
});

test.describe("Content Paywall Deep Test", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/content-paywall");
  });

  test("shows locked state with article preview", async ({ page }) => {
    await expect(page.getByText("Premium Article")).toBeVisible();
    await expect(page.getByText("5 min read")).toBeVisible();
    await expect(page.getByText("The Future of Machine-to-Machine Payments")).toBeVisible();
  });

  test("shows paywall unlock prompt", async ({ page }) => {
    await expect(page.getByText(/Unlock this article for/)).toBeVisible();
    await expect(page.getByText("0.01 USDT")).toBeVisible();
  });

  test("has Pay & Read button", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Pay & Read" })).toBeVisible();
  });

  test("shows no-subscription messaging", async ({ page }) => {
    await expect(page.getByText("No subscription. No account. Just pay once.")).toBeVisible();
  });

  test("Pay & Read in demo mode unlocks article", async ({ page }) => {
    // Click Pay & Read
    await page.getByRole("button", { name: "Pay & Read" }).click();

    // Should show payment processing
    await expect(page.getByText(/Processing payment|Requesting/)).toBeVisible({ timeout: 5000 });

    // Wait for unlock — article content or success badge appears
    await expect(page.getByText(/Unlocked|Reset demo/i)).toBeVisible({ timeout: 15000 });

    // Paywall should be gone
    await expect(page.getByRole("button", { name: "Pay & Read" })).not.toBeVisible();
  });
});

test.describe("Gasless Payment Scenario", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/gasless-payment");
  });

  test("page loads with content", async ({ page }) => {
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("mentions gasless or account abstraction", async ({ page }) => {
    const pageContent = await page.textContent("body");
    expect(
      pageContent?.toLowerCase().includes("gasless") ||
        pageContent?.toLowerCase().includes("account abstraction") ||
        pageContent?.toLowerCase().includes("4337")
    ).toBeTruthy();
  });
});
