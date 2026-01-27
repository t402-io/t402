import { test, expect } from "@playwright/test";

const SCENARIOS = [
  { path: "/ai-api", title: "AI API", cost: "0.001" },
  { path: "/content-paywall", title: "Content Paywall", cost: "0.01" },
  { path: "/data-marketplace", title: "Data Marketplace", cost: "0.001" },
  { path: "/agent-to-agent", title: "Agent-to-Agent", cost: "0.001" },
  { path: "/iot-micropayments", title: "IoT Micropayments", cost: "0.0001" },
  { path: "/streaming-media", title: "Streaming Media", cost: "0.001" },
  { path: "/mcp-ai-agent", title: "MCP AI Agent", cost: "0.001" },
  { path: "/cross-chain-bridge", title: "Cross-Chain Bridge", cost: "0.01" },
  { path: "/gasless-payment", title: "Gasless Payment", cost: "0.001" },
];

test.describe("Scenario Pages", () => {
  for (const scenario of SCENARIOS) {
    test(`${scenario.title} page loads`, async ({ page }) => {
      await page.goto(scenario.path);

      // Page should load without errors
      await expect(page).not.toHaveTitle("404");

      // Should have some content related to the scenario
      await expect(page.locator("body")).not.toBeEmpty();
    });
  }
});

test.describe("AI API Scenario", () => {
  test("has input field for queries", async ({ page }) => {
    await page.goto("/ai-api");

    // Look for input or textarea for queries
    const input = page.locator("input, textarea").first();
    await expect(input).toBeVisible();
  });

  test("shows payment info", async ({ page }) => {
    await page.goto("/ai-api");

    // Should show cost somewhere
    await expect(page.getByText(/USDT/i)).toBeVisible();
  });
});

test.describe("Streaming Media Scenario", () => {
  test("page loads", async ({ page }) => {
    await page.goto("/streaming-media");

    await expect(page.locator("body")).not.toBeEmpty();
  });
});

test.describe("Cross-Chain Bridge Scenario", () => {
  test("page loads", async ({ page }) => {
    await page.goto("/cross-chain-bridge");

    await expect(page.locator("body")).not.toBeEmpty();
  });
});

test.describe("Gasless Payment Scenario", () => {
  test("page loads", async ({ page }) => {
    await page.goto("/gasless-payment");

    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("mentions ERC-4337 or Account Abstraction", async ({ page }) => {
    await page.goto("/gasless-payment");

    // Should mention gasless/AA somewhere
    const pageContent = await page.textContent("body");
    expect(
      pageContent?.toLowerCase().includes("gasless") ||
        pageContent?.toLowerCase().includes("account abstraction") ||
        pageContent?.toLowerCase().includes("4337")
    ).toBeTruthy();
  });
});
