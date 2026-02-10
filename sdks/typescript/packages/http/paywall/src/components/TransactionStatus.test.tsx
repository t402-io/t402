import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { TransactionStatus } from "./TransactionStatus";

function renderToHtml(element: React.ReactElement): string {
  return ReactDOMServer.renderToStaticMarkup(element);
}

// We test getExplorerUrl and truncateHash by observing the rendered output.
// Since these are module-private, we test them through the component output.

describe("TransactionStatus", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("getExplorerUrl", () => {
    it("returns Ethereum mainnet explorer URL", () => {
      const html = renderToHtml(<TransactionStatus txHash="0xabc123" network="eip155:1" />);
      expect(html).toContain("https://etherscan.io/tx/0xabc123");
    });

    it("returns Base explorer URL", () => {
      const html = renderToHtml(<TransactionStatus txHash="0xdef456" network="eip155:8453" />);
      expect(html).toContain("https://basescan.org/tx/0xdef456");
    });

    it("returns Arbitrum explorer URL", () => {
      const html = renderToHtml(<TransactionStatus txHash="0x789ghi" network="eip155:42161" />);
      expect(html).toContain("https://arbiscan.io/tx/0x789ghi");
    });

    it("returns Solana mainnet explorer URL", () => {
      const html = renderToHtml(
        <TransactionStatus txHash="abc123sig" network="solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" />,
      );
      expect(html).toContain("https://solscan.io/tx/abc123sig");
      // Mainnet should not have cluster param
      expect(html).not.toContain("cluster=devnet");
    });

    it("returns Solana devnet explorer URL with cluster param", () => {
      const html = renderToHtml(
        <TransactionStatus txHash="devsig" network="solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1" />,
      );
      expect(html).toContain("https://solscan.io/tx/devsig?cluster=devnet");
    });

    it("returns TON mainnet explorer URL", () => {
      const html = renderToHtml(<TransactionStatus txHash="tonhash123" network="ton:mainnet" />);
      expect(html).toContain("https://tonscan.org/tx/tonhash123");
    });

    it("returns TRON mainnet explorer URL", () => {
      const html = renderToHtml(<TransactionStatus txHash="tronhash" network="tron:mainnet" />);
      expect(html).toContain("https://tronscan.org/#/transaction/tronhash");
    });

    it("returns Stacks mainnet explorer URL", () => {
      const html = renderToHtml(<TransactionStatus txHash="stxhash" network="stacks:1" />);
      expect(html).toContain("https://explorer.hiro.so/txid/stxhash");
      expect(html).not.toContain("chain=testnet");
    });

    it("returns Cosmos noble-1 explorer URL", () => {
      const html = renderToHtml(<TransactionStatus txHash="cosmoshash" network="cosmos:noble-1" />);
      expect(html).toContain("https://www.mintscan.io/noble/tx/cosmoshash");
    });

    it("returns NEAR mainnet explorer URL", () => {
      const html = renderToHtml(<TransactionStatus txHash="nearhash" network="near:mainnet" />);
      expect(html).toContain("https://nearblocks.io/txns/nearhash");
    });

    it("does not render explorer link for unknown network", () => {
      const html = renderToHtml(<TransactionStatus txHash="hash123" network="unknown:network" />);
      // Should not have an anchor tag for explorer
      expect(html).not.toContain("View transaction on block explorer");
    });
  });

  describe("truncateHash", () => {
    it("shows full hash when hash is short (<=16 chars)", () => {
      const html = renderToHtml(<TransactionStatus txHash="0x1234567890" network="eip155:1" />);
      expect(html).toContain("0x1234567890");
    });

    it("truncates long hashes to first 8 + ... + last 6", () => {
      const longHash = "0xabcdef1234567890abcdef1234567890abcdef12";
      const html = renderToHtml(<TransactionStatus txHash={longHash} network="eip155:1" />);
      // First 8: "0xabcdef" -> actually slice(0,8) = "0xabcdef"
      // Last 6: "def12" -> slice(-6) = "cdef12"
      expect(html).toContain("0xabcdef...cdef12");
    });
  });

  describe("accessibility", () => {
    it('has role="status" and aria-live="polite" on container', () => {
      const html = renderToHtml(<TransactionStatus txHash="0xabc" network="eip155:1" />);
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-live="polite"');
    });

    it('explorer link has target="_blank" and rel="noopener noreferrer"', () => {
      const html = renderToHtml(<TransactionStatus txHash="0xabc" network="eip155:1" />);
      expect(html).toContain('target="_blank"');
      expect(html).toContain('rel="noopener noreferrer"');
    });
  });
});
