import { test, expect } from "@playwright/test";

test.describe("Home Page", () => {
  test("loads and displays hero section", async ({ page }) => {
    await page.goto("/");

    // Check hero title
    await expect(page.getByText("32 Chains.")).toBeVisible();
    await expect(page.getByText("1 Header.")).toBeVisible();

    // Check tagline
    await expect(page.getByText("HTTP-native USDT payments")).toBeVisible();
  });

  test("displays chain logos", async ({ page }) => {
    await page.goto("/");

    // Check for chain labels
    await expect(page.getByText("EVM")).toBeVisible();
    await expect(page.getByText("TON")).toBeVisible();
    await expect(page.getByText("Solana")).toBeVisible();
  });

  test("has navigation to scenarios", async ({ page }) => {
    await page.goto("/");

    // Check CTA button
    const tryScenarioBtn = page.getByRole("link", { name: /Try a Scenario/i });
    await expect(tryScenarioBtn).toBeVisible();
  });

  test("has playground link", async ({ page }) => {
    await page.goto("/");

    const playgroundLink = page.getByRole("link", { name: /Playground/i });
    await expect(playgroundLink).toBeVisible();
  });

  test("displays all 9 scenario cards", async ({ page }) => {
    await page.goto("/");

    // Check scenario titles
    await expect(page.getByText("AI API Monetization")).toBeVisible();
    await expect(page.getByText("Content Paywall")).toBeVisible();
    await expect(page.getByText("Data Marketplace")).toBeVisible();
    await expect(page.getByText("Agent-to-Agent")).toBeVisible();
    await expect(page.getByText("IoT Micropayments")).toBeVisible();
    await expect(page.getByText("Streaming Media")).toBeVisible();
    await expect(page.getByText("MCP AI Agent")).toBeVisible();
    await expect(page.getByText("Cross-Chain Bridge")).toBeVisible();
    await expect(page.getByText("Gasless Payment")).toBeVisible();
  });

  test("scenario cards link to correct pages", async ({ page }) => {
    await page.goto("/");

    // Click AI API card
    const aiApiCard = page.getByText("AI API Monetization").locator("..");
    await aiApiCard.click();

    // Should navigate to /ai-api
    await expect(page).toHaveURL(/\/ai-api/);
  });

  test("has docs link in footer", async ({ page }) => {
    await page.goto("/");

    const docsLink = page.getByRole("link", { name: "Docs" });
    await expect(docsLink).toBeVisible();
    await expect(docsLink).toHaveAttribute("href", "https://docs.t402.io");
  });

  test("shows how it works section", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("How T402 Works")).toBeVisible();
    await expect(page.getByText("Request")).toBeVisible();
    await expect(page.getByText("Sign")).toBeVisible();
    await expect(page.getByText("Settle")).toBeVisible();
  });

  test("shows developer quick start code", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("Integrate in Minutes")).toBeVisible();
    await expect(page.getByText("@t402/express")).toBeVisible();
  });
});
