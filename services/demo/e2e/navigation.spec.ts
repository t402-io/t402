import { test, expect } from "@playwright/test";

const SCENARIO_CARDS = [
  { title: "AI API Monetization", path: "/ai-api" },
  { title: "Content Paywall", path: "/content-paywall" },
  { title: "Data Marketplace", path: "/data-marketplace" },
  { title: "Agent-to-Agent", path: "/agent-to-agent" },
  { title: "IoT Micropayments", path: "/iot-micropayments" },
  { title: "Streaming Media", path: "/streaming-media" },
  { title: "MCP AI Agent", path: "/mcp-ai-agent" },
  { title: "Cross-Chain Bridge", path: "/cross-chain-bridge" },
  { title: "Gasless Payment", path: "/gasless-payment" },
];

test.describe("Scenario Card Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("click scenario card on homepage navigates to correct page", async ({ page }) => {
    // Click the AI API card link
    const card = page.locator(`a[href="/ai-api"]`).filter({ hasText: "AI API Monetization" });
    await card.first().click();

    // Should navigate to the AI API page
    await expect(page).toHaveURL(/\/ai-api$/);
    await expect(page.getByRole("heading", { name: "AI API Monetization", level: 1 })).toBeVisible();
  });

  test("all 9 scenario cards are visible on homepage", async ({ page }) => {
    for (const scenario of SCENARIO_CARDS) {
      await expect(page.locator(`a[href="${scenario.path}"]`).filter({ hasText: scenario.title }).first()).toBeVisible();
    }
  });
});

test.describe("Back Navigation", () => {
  test("back button from scenario returns to homepage", async ({ page }) => {
    await page.goto("/ai-api");

    // Click the back/home link (ArrowLeft + T402 logo)
    const backLink = page.getByLabel("Back to home");
    await expect(backLink).toBeVisible();
    await backLink.click();

    // Should be on the homepage
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe("Desktop Sidebar", () => {
  test("sidebar visible on desktop (1280px viewport), shows all 9 scenarios", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/ai-api");

    // Sidebar nav should be visible
    const sidebar = page.getByRole("navigation", { name: "Scenarios" });
    await expect(sidebar).toBeVisible();

    // Should contain all 9 scenario links
    const sidebarLinks = [
      "AI API", "Paywall", "Data Market", "Agent-to-Agent",
      "IoT", "Streaming", "MCP Agent", "Bridge", "Gasless",
    ];
    for (const linkText of sidebarLinks) {
      await expect(sidebar.getByText(linkText, { exact: true })).toBeVisible();
    }
  });

  test("active scenario has aria-current=page", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/ai-api");

    const sidebar = page.getByRole("navigation", { name: "Scenarios" });

    // AI API link should have aria-current="page"
    const activeLink = sidebar.locator('a[aria-current="page"]');
    await expect(activeLink).toBeVisible();
    await expect(activeLink).toHaveText("AI API");
  });

  test("active scenario updates when navigating", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/content-paywall");

    const sidebar = page.getByRole("navigation", { name: "Scenarios" });

    // Paywall link should be active
    const activeLink = sidebar.locator('a[aria-current="page"]');
    await expect(activeLink).toBeVisible();
    await expect(activeLink).toHaveText("Paywall");

    // AI API should NOT have aria-current
    const aiLink = sidebar.locator('a[href="/ai-api"]');
    await expect(aiLink).not.toHaveAttribute("aria-current", "page");
  });
});

test.describe("Mobile Bottom Navigation", () => {
  test("bottom nav visible on 375px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/ai-api");

    // Mobile bottom nav should be visible
    const bottomNav = page.getByRole("navigation", { name: "Scenario navigation" });
    await expect(bottomNav).toBeVisible();

    // Should contain scenario links
    await expect(bottomNav.getByText("AI API")).toBeVisible();
    await expect(bottomNav.getByText("Paywall")).toBeVisible();
  });

  test("desktop sidebar hidden on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/ai-api");

    // Sidebar should be hidden on mobile (lg:block means hidden below 1024px)
    const sidebar = page.getByRole("navigation", { name: "Scenarios" });
    await expect(sidebar).not.toBeVisible();
  });
});

test.describe("404 Page", () => {
  test("404 page for unknown routes", async ({ page }) => {
    await page.goto("/this-page-does-not-exist");

    // Should show custom 404 content
    await expect(page.getByText("Page Not Found")).toBeVisible();
    await expect(page.getByText("404")).toBeVisible();

    // Should have navigation links back
    await expect(page.getByRole("link", { name: "Go home" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Try a scenario" })).toBeVisible();
  });
});

test.describe("External Links", () => {
  test("all external links have target=_blank and rel=noopener noreferrer", async ({ page }) => {
    await page.goto("/");

    // Get all links with href starting with http (external links)
    const externalLinks = page.locator('a[href^="http"]');
    const count = await externalLinks.count();

    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const link = externalLinks.nth(i);
      const href = await link.getAttribute("href");

      // Skip internal links (localhost, same-origin)
      if (href?.includes("localhost")) continue;

      await expect(link).toHaveAttribute("target", "_blank");
      const rel = await link.getAttribute("rel");
      expect(rel).toContain("noopener");
      expect(rel).toContain("noreferrer");
    }
  });
});
