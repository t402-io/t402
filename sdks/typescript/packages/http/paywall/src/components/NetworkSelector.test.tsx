import { describe, expect, it } from "vitest";
import React from "react";
import ReactDOMServer from "react-dom/server";
import type { PaymentRequirements } from "@t402/core/types";
import { NetworkSelector } from "./NetworkSelector";

function renderToHtml(element: React.ReactElement): string {
  return ReactDOMServer.renderToStaticMarkup(element);
}

const baseRequirement: PaymentRequirements = {
  scheme: "exact",
  network: "eip155:8453",
  maxAmountRequired: "1000000",
  resource: "https://example.com/protected",
  description: "Test resource",
  mimeType: "application/json",
  payTo: "0x0000000000000000000000000000000000000001",
  maxTimeoutSeconds: 60,
  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
};

const solanaRequirement: PaymentRequirements = {
  scheme: "exact",
  network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  amount: "500000",
  resource: "https://example.com/solana",
  description: "Solana resource",
  mimeType: "application/json",
  payTo: "2Zt8RZ8kW1nWcJ6YyqHq9kTjY8QpM2R2t1xXUQ1e1VQa",
  maxTimeoutSeconds: 60,
  asset: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
};

describe("NetworkSelector", () => {
  it("renders a button for each item in accepts array", () => {
    const html = renderToHtml(
      <NetworkSelector accepts={[baseRequirement, solanaRequirement]} onSelect={() => {}} />,
    );
    const buttonCount = (html.match(/<button/g) || []).length;
    expect(buttonCount).toBe(2);
  });

  it("formats amount correctly (divide by 10^6, show 2 decimals)", () => {
    const html = renderToHtml(
      <NetworkSelector accepts={[{ ...baseRequirement, amount: "1500000" }]} onSelect={() => {}} />,
    );
    expect(html).toContain("1.50");
  });

  it("shows network display name", () => {
    const html = renderToHtml(<NetworkSelector accepts={[baseRequirement]} onSelect={() => {}} />);
    expect(html).toContain("Base");
  });

  it("shows Solana Mainnet display name", () => {
    const html = renderToHtml(
      <NetworkSelector accepts={[solanaRequirement]} onSelect={() => {}} />,
    );
    expect(html).toContain("Solana Mainnet");
  });

  it("empty accepts array renders no buttons", () => {
    const html = renderToHtml(<NetworkSelector accepts={[]} onSelect={() => {}} />);
    expect(html).not.toContain("<button");
  });

  it("uses maxAmountRequired when amount is absent", () => {
    const req: PaymentRequirements = {
      ...baseRequirement,
      amount: undefined,
      maxAmountRequired: "2000000",
    };
    const html = renderToHtml(<NetworkSelector accepts={[req]} onSelect={() => {}} />);
    expect(html).toContain("2.00");
  });

  it("buttons have correct aria-labels", () => {
    const html = renderToHtml(
      <NetworkSelector accepts={[{ ...baseRequirement, amount: "1000000" }]} onSelect={() => {}} />,
    );
    expect(html).toContain('aria-label="Pay 1.00 on Base"');
  });
});
