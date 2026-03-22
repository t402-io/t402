import { test, expect } from "@playwright/test";

test.describe("Playground Page", () => {
  test.describe("Layout", () => {
    test("heading is visible", async ({ page }) => {
      await page.goto("/playground");

      await expect(
        page.getByRole("heading", { name: "Protocol Playground" })
      ).toBeVisible();
    });

    test("endpoint selector exists with aria-label", async ({ page }) => {
      await page.goto("/playground");

      const selector = page.getByLabel("Select API endpoint");
      await expect(selector).toBeVisible();
      await expect(selector).toHaveAttribute("aria-label", "Select API endpoint");
    });

    test("Execute button is visible", async ({ page }) => {
      await page.goto("/playground");

      await expect(
        page.getByRole("button", { name: /Execute Flow/i })
      ).toBeVisible();
    });
  });

  test.describe("Default endpoint", () => {
    test("first endpoint (AI Query) is selected by default", async ({ page }) => {
      await page.goto("/playground");

      const selector = page.getByLabel("Select API endpoint");
      await expect(selector).toHaveValue("0");

      // The first option text should contain AI Query
      const selectedText = await selector.locator("option:checked").textContent();
      expect(selectedText).toContain("AI Query");
    });
  });

  test.describe("Execute flow", () => {
    test("clicking Execute shows exchange panels with 402 and 200 statuses", async ({
      page,
    }) => {
      await page.goto("/playground");

      // Click Execute Flow
      await page.getByRole("button", { name: /Execute Flow/i }).click();

      // Wait for the initial exchange panel to appear (Step 1)
      // Panel title is "Step 1: Initial Request → 402 Payment Required"
      const step1Panel = page.getByText(/Step 1: Initial Request/);
      await expect(step1Panel).toBeVisible({ timeout: 15000 });

      // Should show 402 status code in the response section
      const status402 = page.locator(".glass-card .font-bold", { hasText: "402" });
      await expect(status402).toBeVisible({ timeout: 15000 });

      // Wait for retry exchange panel (Step 3)
      // Panel title is "Step 3: Retry with Payment → Resource Access"
      const step3Panel = page.getByText(/Step 3: Retry with Payment/);
      await expect(step3Panel).toBeVisible({ timeout: 15000 });

      // Should show 200 status code in the response section
      const status200 = page.locator(".glass-card .font-bold", { hasText: "200" });
      await expect(status200).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe("Reset button", () => {
    test("Reset button appears after execution and clears panels", async ({
      page,
    }) => {
      await page.goto("/playground");

      // Reset should not be visible initially
      await expect(
        page.getByRole("button", { name: /Reset/i })
      ).not.toBeVisible();

      // Execute flow
      await page.getByRole("button", { name: /Execute Flow/i }).click();

      // Wait for exchange panels to appear
      await expect(
        page.getByText(/Step 1: Initial Request/)
      ).toBeVisible({ timeout: 15000 });

      // Reset button should now be visible
      const resetButton = page.getByRole("button", { name: /Reset/i });
      await expect(resetButton).toBeVisible();

      // Click Reset
      await resetButton.click();

      // Exchange panels should be gone
      await expect(
        page.getByText(/Step 1: Initial Request/)
      ).not.toBeVisible();
    });
  });

  test.describe("Change endpoint", () => {
    test("can change endpoint via selector", async ({ page }) => {
      await page.goto("/playground");

      const selector = page.getByLabel("Select API endpoint");

      // Change to Content endpoint (index 1)
      await selector.selectOption("1");
      await expect(selector).toHaveValue("1");

      const selectedText = await selector.locator("option:checked").textContent();
      expect(selectedText).toContain("Content");

      // Change to Market Data endpoint (index 2)
      await selector.selectOption("2");
      await expect(selector).toHaveValue("2");

      const selectedText2 = await selector
        .locator("option:checked")
        .textContent();
      expect(selectedText2).toContain("Market Data");
    });
  });
});
