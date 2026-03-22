import { test, expect } from "@playwright/test";

test.describe("Accessibility", () => {
  test.describe("Skip-to-content link", () => {
    test("Tab on homepage focuses skip link targeting #main-content", async ({
      page,
    }) => {
      await page.goto("/");

      // Press Tab to focus skip link
      await page.keyboard.press("Tab");

      // The skip link should be focused
      const skipLink = page.getByText("Skip to content");
      await expect(skipLink).toBeFocused();

      // It should target #main-content
      await expect(skipLink).toHaveAttribute("href", "#main-content");
    });

    test("Skip-to-content on scenario page also works", async ({ page }) => {
      await page.goto("/ai-api");

      // Press Tab to focus skip link
      await page.keyboard.press("Tab");

      const skipLink = page.getByText("Skip to content");
      await expect(skipLink).toBeFocused();
      await expect(skipLink).toHaveAttribute("href", "#main-content");

      // Verify #main-content exists on the page
      await expect(page.locator("#main-content")).toBeAttached();
    });
  });

  test.describe("Sidebar navigation", () => {
    test('sidebar nav has aria-label="Scenarios" on desktop viewport', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto("/ai-api");

      const sidebarNav = page.locator('nav[aria-label="Scenarios"]');
      await expect(sidebarNav).toBeVisible();
    });
  });

  test.describe("Mobile bottom navigation", () => {
    test('bottom nav has aria-label="Scenario navigation"', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto("/ai-api");

      const bottomNav = page.locator('nav[aria-label="Scenario navigation"]');
      await expect(bottomNav).toBeVisible();
    });
  });

  test.describe("Active scenario link", () => {
    test("active scenario link has aria-current=page", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto("/ai-api");

      // In the sidebar, the AI API link should have aria-current="page"
      const sidebarNav = page.locator('nav[aria-label="Scenarios"]');
      const activeLink = sidebarNav.locator('[aria-current="page"]');
      await expect(activeLink).toBeVisible();
      await expect(activeLink).toHaveText(/AI API/);
    });

    test("non-active links do not have aria-current", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto("/ai-api");

      const sidebarNav = page.locator('nav[aria-label="Scenarios"]');

      // Other links should not have aria-current="page"
      const paywallLink = sidebarNav.getByText("Paywall");
      await expect(paywallLink).toBeVisible();
      await expect(paywallLink).not.toHaveAttribute("aria-current", "page");
    });

    test("aria-current updates when navigating to a different scenario", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto("/content-paywall");

      const sidebarNav = page.locator('nav[aria-label="Scenarios"]');
      const activeLink = sidebarNav.locator('[aria-current="page"]');
      await expect(activeLink).toHaveText(/Paywall/);
    });
  });

  test.describe("Mode toggle", () => {
    test("mode toggle buttons have aria-pressed", async ({ page }) => {
      await page.goto("/ai-api");

      // Find buttons with aria-pressed attribute
      const demoButton = page.getByRole("button", { name: /Demo/i });
      const liveButton = page.getByRole("button", { name: /Live/i });

      await expect(demoButton).toBeVisible();
      await expect(liveButton).toBeVisible();

      // Demo should be pressed by default
      await expect(demoButton).toHaveAttribute("aria-pressed", "true");
      await expect(liveButton).toHaveAttribute("aria-pressed", "false");

      // Click Live and verify aria-pressed changes
      await liveButton.click();
      await expect(liveButton).toHaveAttribute("aria-pressed", "true");
      await expect(demoButton).toHaveAttribute("aria-pressed", "false");
    });
  });

  test.describe("Endpoint selector", () => {
    test("endpoint selector has aria-label on playground page", async ({
      page,
    }) => {
      await page.goto("/playground");

      const selector = page.getByLabel("Select API endpoint");
      await expect(selector).toBeVisible();
      await expect(selector).toHaveAttribute(
        "aria-label",
        "Select API endpoint"
      );
    });
  });

  test.describe("Heading structure", () => {
    test("homepage has exactly one h1", async ({ page }) => {
      await page.goto("/");

      const h1Elements = page.locator("h1");
      await expect(h1Elements).toHaveCount(1);
    });
  });

  test.describe("Chain selector", () => {
    test('chain selector has role="tablist"', async ({ page }) => {
      await page.goto("/ai-api");

      const tablist = page.getByRole("tablist", {
        name: "Blockchain selection",
      });
      await expect(tablist).toBeAttached();

      // Individual chain buttons should have role="tab"
      const tabs = tablist.getByRole("tab");
      const count = await tabs.count();
      expect(count).toBeGreaterThan(0);

      // Active tab should have aria-selected="true"
      const selectedTab = tablist.locator('[aria-selected="true"]');
      await expect(selectedTab).toBeAttached();
    });
  });
});
