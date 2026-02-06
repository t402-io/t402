import { describe, expect, it } from "vitest";
import { generatePaymentURI } from "./PaymentQRCode";

describe("PaymentQRCode", () => {
  describe("generatePaymentURI", () => {
    it("generates Ethereum EIP-681 format URI", () => {
      const uri = generatePaymentURI({
        network: "ethereum",
        address: "0x1234567890abcdef1234567890abcdef12345678",
        amount: "1000000",
        asset: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      });
      expect(uri).toBe(
        "ethereum:0x1234567890abcdef1234567890abcdef12345678?value=1000000&token=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      );
    });

    it("generates Solana Pay URI", () => {
      const uri = generatePaymentURI({
        network: "solana",
        address: "2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHEBg4",
        amount: "500000",
        asset: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      });
      expect(uri).toBe(
        "solana:2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHEBg4?amount=500000&spl-token=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      );
    });

    it("generates TON transfer URI", () => {
      const uri = generatePaymentURI({
        network: "ton",
        address: "EQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkEUe",
        amount: "1000000",
      });
      expect(uri).toBe(
        "ton://transfer/EQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkEUe?amount=1000000",
      );
    });

    it("generates TRON URI", () => {
      const uri = generatePaymentURI({
        network: "tron",
        address: "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5",
        amount: "1000000",
      });
      expect(uri).toBe("tron:TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5?amount=1000000");
    });

    it("returns just the address for unknown network", () => {
      const uri = generatePaymentURI({
        network: "unknown" as "ethereum",
        address: "some-address",
      });
      expect(uri).toBe("some-address");
    });

    it("URL-encodes label parameter", () => {
      const uri = generatePaymentURI({
        network: "ethereum",
        address: "0x1234",
        label: "Pay for API Access & Data",
      });
      expect(uri).toContain("label=Pay%20for%20API%20Access%20%26%20Data");
    });

    it("generates URI without optional parameters", () => {
      const uri = generatePaymentURI({
        network: "ethereum",
        address: "0x1234",
      });
      expect(uri).toBe("ethereum:0x1234");
    });

    it("generates Solana URI with label", () => {
      const uri = generatePaymentURI({
        network: "solana",
        address: "ABC123",
        label: "Test Payment",
      });
      expect(uri).toContain("label=Test%20Payment");
    });

    it("generates TON URI with jetton and text", () => {
      const uri = generatePaymentURI({
        network: "ton",
        address: "EQ123",
        amount: "500",
        asset: "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
        label: "Test",
      });
      expect(uri).toContain("jetton=EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs");
      expect(uri).toContain("text=Test");
    });
  });
});
