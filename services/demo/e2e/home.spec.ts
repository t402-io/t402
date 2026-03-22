import { test, expect } from "@playwright/test";

test.describe("Hero Section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("displays hero title and subtitle", async ({ page }) => {
    await expect(page.getByText("Your API should accept payments.")).toBeVisible();
    await expect(page.getByText("Without Stripe. Without API keys.")).toBeVisible();
  });

  test("displays protocol badge", async ({ page }) => {
    await expect(page.getByText("HTTP 402 PAYMENT PROTOCOL")).toBeVisible();
  });

  test("displays subtitle description", async ({ page }) => {
    await expect(
      page.getByText("T402 turns any HTTP endpoint into a paid resource")
    ).toBeVisible();
  });

  test("displays flow summary", async ({ page }) => {
    // The flow summary uses &rarr; which renders as arrows
    const flowText = page.getByText(/Request.*402.*Sign.*Settle.*Access/);
    await expect(flowText).toBeVisible();
  });
});

test.describe("CTA Buttons", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("Try a Scenario links to /ai-api", async ({ page }) => {
    const tryBtn = page.getByRole("link", { name: /Try a Scenario/i });
    await expect(tryBtn).toBeVisible();
    await expect(tryBtn).toHaveAttribute("href", "/ai-api");
  });

  test("Playground links to /playground", async ({ page }) => {
    const playgroundLink = page.getByRole("link", { name: /Playground/i });
    await expect(playgroundLink).toBeVisible();
    await expect(playgroundLink).toHaveAttribute("href", "/playground");
  });

  test("Read Docs is external link with target _blank", async ({ page }) => {
    const docsLink = page.getByRole("link", { name: "Read Docs" });
    await expect(docsLink).toBeVisible();
    await expect(docsLink).toHaveAttribute("href", "https://docs.t402.io");
    await expect(docsLink).toHaveAttribute("target", "_blank");
  });
});

test.describe("Testnet Banner", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("displays testnet warning text", async ({ page }) => {
    await expect(page.getByText("Testnet Demo")).toBeVisible();
    await expect(page.getByText("No real funds required")).toBeVisible();
  });
});

test.describe("Inline Demo", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("shows trigger button initially", async ({ page }) => {
    const triggerBtn = page.getByRole("button", {
      name: /See a live 402 handshake/i,
    });
    await expect(triggerBtn).toBeVisible();
  });

  test("runs through 5 steps and shows completion", async ({ page }) => {
    const triggerBtn = page.getByRole("button", {
      name: /See a live 402 handshake/i,
    });
    await triggerBtn.click();

    // Wait for all 5 step labels to appear
    await expect(
      page.getByText("GET /api/demo/content")
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("HTTP 402")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Sign payment")).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByText("Retry with Payment-Signature")
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("HTTP 200")).toBeVisible({ timeout: 15000 });

    // Wait for completion
    await expect(page.getByText(/Paid in/)).toBeVisible({ timeout: 15000 });
  });

  test("Run again button resets to idle state", async ({ page }) => {
    const triggerBtn = page.getByRole("button", {
      name: /See a live 402 handshake/i,
    });
    await triggerBtn.click();

    // Wait for completion
    await expect(page.getByText(/Paid in/)).toBeVisible({ timeout: 15000 });

    // Click Run again
    const runAgainBtn = page.getByRole("button", { name: /Run again/i });
    await expect(runAgainBtn).toBeVisible();
    await runAgainBtn.click();

    // Should return to idle — trigger button visible again
    await expect(
      page.getByRole("button", { name: /See a live 402 handshake/i })
    ).toBeVisible();
  });
});

test.describe("Why T402 Section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("displays section heading", async ({ page }) => {
    await expect(page.getByText("Payment Without Friction")).toBeVisible();
  });

  test("displays all 4 feature cards", async ({ page }) => {
    await expect(page.getByText("No API Keys")).toBeVisible();
    await expect(page.getByText("Micropayments")).toBeVisible();
    await expect(page.getByText("Machine-Native")).toBeVisible();
    await expect(page.getByText("Any Chain")).toBeVisible();
  });

  test("feature cards have descriptions", async ({ page }) => {
    await expect(
      page.getByText("No accounts, no dashboards, no API key management")
    ).toBeVisible();
    await expect(
      page.getByText("Sub-cent payments with no minimum")
    ).toBeVisible();
    await expect(
      page.getByText("AI agents and IoT devices pay autonomously")
    ).toBeVisible();
    await expect(
      page.getByText("10 blockchain families, 44 networks")
    ).toBeVisible();
  });
});

test.describe("Comparison Table", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("displays table column headers", async ({ page }) => {
    const table = page.locator("table");
    await expect(table).toBeVisible();
    await expect(table.getByText("T402")).toBeVisible();
    await expect(table.getByText("Stripe")).toBeVisible();
    await expect(table.getByText("x402")).toBeVisible();
  });

  test("displays comparison data rows", async ({ page }) => {
    const table = page.locator("table");

    // Verify at least a few key rows
    await expect(table.getByText("Minimum payment")).toBeVisible();
    await expect(table.getByText("$0.0001")).toBeVisible();
    await expect(table.getByText("Transaction fee")).toBeVisible();
    await expect(table.getByText("Gas only").first()).toBeVisible();
    await expect(table.getByText("Setup required")).toBeVisible();
    await expect(table.getByText("Chains supported")).toBeVisible();
    await expect(table.getByText("Machine-to-machine")).toBeVisible();
    await expect(table.getByText("Protocol")).toBeVisible();
  });
});

test.describe("Live Stats Section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("displays all 4 stat cards", async ({ page }) => {
    await expect(page.getByText("Networks")).toBeVisible();
    await expect(page.getByText("Payment Kinds")).toBeVisible();
    await expect(page.getByText("Mechanisms")).toBeVisible();
    await expect(page.getByText("SDKs")).toBeVisible();
  });

  test("displays static stat values", async ({ page }) => {
    // Networks = 44, Mechanisms = 13, SDKs = 4 are hardcoded
    const statsSection = page.locator(".grid.grid-cols-2.sm\\:grid-cols-4");
    await expect(statsSection.getByText("44")).toBeVisible();
    await expect(statsSection.getByText("13")).toBeVisible();
    await expect(statsSection.getByText("4")).toBeVisible();
  });
});

test.describe("How It Works Section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("displays section heading", async ({ page }) => {
    await expect(page.getByText("How T402 Works")).toBeVisible();
  });

  test("displays 3 protocol steps", async ({ page }) => {
    // Step titles
    await expect(
      page.getByRole("heading", { name: "Request" })
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sign" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Settle" })
    ).toBeVisible();
  });

  test("displays step descriptions", async ({ page }) => {
    await expect(
      page.getByText("Client requests a protected resource")
    ).toBeVisible();
    await expect(
      page.getByText("Client signs a USDT authorization off-chain")
    ).toBeVisible();
    await expect(
      page.getByText("Facilitator verifies and settles on-chain")
    ).toBeVisible();
  });
});

test.describe("Scenario Grid", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("displays Interactive Scenarios heading", async ({ page }) => {
    await expect(page.getByText("Interactive Scenarios")).toBeVisible();
  });

  test("displays all 9 scenario titles", async ({ page }) => {
    const scenarios = [
      "AI API Monetization",
      "Content Paywall",
      "Data Marketplace",
      "Agent-to-Agent",
      "IoT Micropayments",
      "Streaming Media",
      "MCP AI Agent",
      "Cross-Chain Bridge",
      "Gasless Payment",
    ];
    for (const title of scenarios) {
      await expect(page.getByText(title)).toBeVisible();
    }
  });

  test("scenario cards link to correct pages", async ({ page }) => {
    const scenarioLinks = [
      { name: "AI API Monetization", href: "/ai-api" },
      { name: "Content Paywall", href: "/content-paywall" },
      { name: "Data Marketplace", href: "/data-marketplace" },
      { name: "Agent-to-Agent", href: "/agent-to-agent" },
      { name: "IoT Micropayments", href: "/iot-micropayments" },
      { name: "Streaming Media", href: "/streaming-media" },
      { name: "MCP AI Agent", href: "/mcp-ai-agent" },
      { name: "Cross-Chain Bridge", href: "/cross-chain-bridge" },
      { name: "Gasless Payment", href: "/gasless-payment" },
    ];
    for (const { name, href } of scenarioLinks) {
      const link = page.getByRole("link", { name: new RegExp(name) });
      await expect(link).toHaveAttribute("href", href);
    }
  });
});

test.describe("Code Tabs (Developer Quick Start)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("displays section heading", async ({ page }) => {
    await expect(page.getByText("Integrate in Minutes")).toBeVisible();
  });

  test("shows Server tab by default with @t402/express", async ({ page }) => {
    const serverTab = page.getByRole("button", { name: "Server" });
    await expect(serverTab).toBeVisible();
    await expect(page.getByText("@t402/express")).toBeVisible();
  });

  test("clicking Client tab shows Payment-Signature code", async ({
    page,
  }) => {
    const clientTab = page.getByRole("button", { name: "Client" });
    await clientTab.click();
    await expect(page.getByText("Payment-Signature")).toBeVisible();
  });

  test("clicking curl tab shows curl command", async ({ page }) => {
    const curlTab = page.getByRole("button", { name: "curl" });
    await curlTab.click();
    await expect(page.getByText("curl")).toBeVisible();
    await expect(page.getByText("api.example.com/premium")).toBeVisible();
  });
});

test.describe("Footer", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("displays MIT License", async ({ page }) => {
    const footer = page.locator("footer");
    await expect(footer.getByText("MIT License")).toBeVisible();
  });

  test("displays T402 branding", async ({ page }) => {
    const footer = page.locator("footer");
    await expect(footer.getByText("T402")).toBeVisible();
    await expect(
      footer.getByText("The Official Payment Protocol for USDT")
    ).toBeVisible();
  });

  test("displays copyright", async ({ page }) => {
    const footer = page.locator("footer");
    await expect(footer.getByText(/T402 Protocol/)).toBeVisible();
    await expect(
      footer.getByText("HTTP-native stablecoin payments")
    ).toBeVisible();
  });

  test("external links have target _blank", async ({ page }) => {
    const footer = page.locator("footer");

    const websiteLink = footer.getByRole("link", { name: "Website" });
    await expect(websiteLink).toHaveAttribute("target", "_blank");
    await expect(websiteLink).toHaveAttribute("href", "https://t402.io");

    const docsLink = footer.getByRole("link", { name: "Docs" });
    await expect(docsLink).toHaveAttribute("target", "_blank");
    await expect(docsLink).toHaveAttribute("href", "https://docs.t402.io");

    const githubLink = footer.getByRole("link", { name: "GitHub" });
    await expect(githubLink).toHaveAttribute("target", "_blank");
    await expect(githubLink).toHaveAttribute(
      "href",
      "https://github.com/t402-io/t402"
    );

    const apiLink = footer.getByRole("link", { name: "API" });
    await expect(apiLink).toHaveAttribute("target", "_blank");
    await expect(apiLink).toHaveAttribute(
      "href",
      "https://facilitator.t402.io"
    );
  });
});
