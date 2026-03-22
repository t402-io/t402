import { test, expect } from "@playwright/test";

test.describe("Responsive Design", () => {
  test.describe("Mobile (375x812)", () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test("homepage has no horizontal overflow", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      // Check for page-level overflow, excluding intentionally scrollable containers
      const overflows = await page.evaluate(() => {
        const html = document.documentElement;
        const scrollables = document.querySelectorAll("*");
        const originals: Array<{ el: HTMLElement; val: string }> = [];
        scrollables.forEach((el) => {
          const style = getComputedStyle(el);
          if (style.overflowX === "auto" || style.overflowX === "scroll") {
            const htmlEl = el as HTMLElement;
            originals.push({ el: htmlEl, val: htmlEl.style.overflowX });
            htmlEl.style.overflowX = "hidden";
          }
        });
        const result = html.scrollWidth > html.clientWidth;
        originals.forEach(({ el, val }) => { el.style.overflowX = val; });
        return result;
      });
      expect(overflows).toBe(false);
    });

    test("scenario cards are visible on homepage", async ({ page }) => {
      await page.goto("/");

      // At least one scenario card should be present
      await expect(page.getByText("AI API Monetization")).toBeVisible();
      await expect(page.getByText("Content Paywall")).toBeVisible();
    });

    test("bottom nav is visible on scenario pages", async ({ page }) => {
      await page.goto("/ai-api");

      const bottomNav = page.locator('nav[aria-label="Scenario navigation"]');
      await expect(bottomNav).toBeVisible();
    });

    test("sidebar is NOT visible on mobile", async ({ page }) => {
      await page.goto("/ai-api");

      const sidebar = page.locator("aside");
      await expect(sidebar).not.toBeVisible();
    });
  });

  test.describe("Tablet (768x1024)", () => {
    test.use({ viewport: { width: 768, height: 1024 } });

    test("scenario cards display in grid", async ({ page }) => {
      await page.goto("/");

      // The grid container should exist with scenario cards
      const scenarioGrid = page.locator(
        ".grid.grid-cols-1.sm\\:grid-cols-2"
      );
      await expect(scenarioGrid.first()).toBeVisible();

      // Multiple scenario cards should be visible
      await expect(page.getByText("AI API Monetization")).toBeVisible();
      await expect(page.getByText("Content Paywall")).toBeVisible();
      await expect(page.getByText("Data Marketplace")).toBeVisible();
    });

    test("sidebar is NOT visible on tablet", async ({ page }) => {
      await page.goto("/ai-api");

      // lg:block means sidebar is hidden below 1024px
      const sidebar = page.locator("aside");
      await expect(sidebar).not.toBeVisible();
    });
  });

  test.describe("Desktop (1280x800)", () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test("sidebar is visible on scenario pages", async ({ page }) => {
      await page.goto("/ai-api");

      const sidebar = page.locator("aside");
      await expect(sidebar).toBeVisible();

      // Sidebar should contain scenario links
      const sidebarNav = page.locator('nav[aria-label="Scenarios"]');
      await expect(sidebarNav).toBeVisible();
      await expect(sidebarNav.getByText("AI API")).toBeVisible();
      await expect(sidebarNav.getByText("Paywall")).toBeVisible();
    });

    test("bottom nav is NOT visible on desktop", async ({ page }) => {
      await page.goto("/ai-api");

      const bottomNav = page.locator('nav[aria-label="Scenario navigation"]');
      await expect(bottomNav).not.toBeVisible();
    });
  });

  test.describe("No content overflow", () => {
    const viewports = [
      { name: "mobile", width: 375, height: 812 },
      { name: "tablet", width: 768, height: 1024 },
      { name: "desktop", width: 1280, height: 800 },
    ];

    // Check for page-level horizontal overflow, excluding elements that use
    // overflow-x: auto/scroll (e.g. chain selectors, code blocks, timelines).
    // Those are intentionally scrollable containers.
    const hasPageOverflow = () => {
      const html = document.documentElement;
      const body = document.body;
      // Check if the body itself causes page-level horizontal scroll
      const htmlOverflow = getComputedStyle(html).overflowX;
      const bodyOverflow = getComputedStyle(body).overflowX;
      // If html/body have overflow hidden/auto, there's no page-level scrollbar
      if (htmlOverflow === "hidden" || bodyOverflow === "hidden") return false;
      // Compare body's scrollWidth to viewport, but account for scrollable containers
      // by temporarily hiding overflow on all overflow-x:auto/scroll elements
      const scrollables = document.querySelectorAll("*");
      const originals: Array<{ el: HTMLElement; val: string }> = [];
      scrollables.forEach((el) => {
        const style = getComputedStyle(el);
        if (style.overflowX === "auto" || style.overflowX === "scroll") {
          const htmlEl = el as HTMLElement;
          originals.push({ el: htmlEl, val: htmlEl.style.overflowX });
          htmlEl.style.overflowX = "hidden";
        }
      });
      const overflows = html.scrollWidth > html.clientWidth;
      // Restore
      originals.forEach(({ el, val }) => { el.style.overflowX = val; });
      return overflows;
    };

    for (const vp of viewports) {
      test(`no horizontal overflow on ${vp.name} (${vp.width}x${vp.height}) — homepage`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto("/");
        await page.waitForLoadState("networkidle");

        const overflows = await page.evaluate(hasPageOverflow);
        expect(overflows).toBe(false);
      });

      test(`no horizontal overflow on ${vp.name} (${vp.width}x${vp.height}) — scenario page`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto("/ai-api");
        await page.waitForLoadState("networkidle");

        const overflows = await page.evaluate(hasPageOverflow);
        expect(overflows).toBe(false);
      });

      test(`no horizontal overflow on ${vp.name} (${vp.width}x${vp.height}) — playground`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto("/playground");
        await page.waitForLoadState("networkidle");

        const overflows = await page.evaluate(hasPageOverflow);
        expect(overflows).toBe(false);
      });
    }
  });
});
