import { describe, it, expect } from "vitest";
import type {
  ExactDirectCosmosPayload,
  TokenConfig,
  NetworkConfig,
  TransactionResult,
  MsgSend,
  Coin,
} from "../../src/types";

describe("Cosmos Types", () => {
  describe("ExactDirectCosmosPayload", () => {
    it("should serialize and deserialize correctly", () => {
      const payload: ExactDirectCosmosPayload = {
        txHash: "ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890",
        from: "noble1sender123456789abcdef",
        to: "noble1recipient123456789abc",
        amount: "1000000",
        denom: "uusdc",
      };

      const json = JSON.stringify(payload);
      const parsed = JSON.parse(json) as ExactDirectCosmosPayload;

      expect(parsed.txHash).toBe(payload.txHash);
      expect(parsed.from).toBe(payload.from);
      expect(parsed.to).toBe(payload.to);
      expect(parsed.amount).toBe(payload.amount);
      expect(parsed.denom).toBe(payload.denom);
    });

    it("should allow optional denom field", () => {
      const payload: ExactDirectCosmosPayload = {
        txHash: "ABCDEF1234567890",
        from: "noble1sender123456789abcdef",
        to: "noble1recipient123456789abc",
        amount: "1000000",
      };

      expect(payload.denom).toBeUndefined();
    });
  });

  describe("TokenConfig", () => {
    it("should define token properties", () => {
      const token: TokenConfig = {
        denom: "uusdc",
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        priority: 1,
      };

      expect(token.denom).toBe("uusdc");
      expect(token.symbol).toBe("USDC");
      expect(token.decimals).toBe(6);
      expect(token.priority).toBe(1);
    });
  });

  describe("NetworkConfig", () => {
    it("should define network properties", () => {
      const config: NetworkConfig = {
        network: "cosmos:noble-1",
        bech32Prefix: "noble",
        rpcEndpoint: "https://noble-rpc.polkachu.com",
        restEndpoint: "https://noble-api.polkachu.com",
      };

      expect(config.network).toBe("cosmos:noble-1");
      expect(config.bech32Prefix).toBe("noble");
    });
  });

  describe("TransactionResult", () => {
    it("should represent a successful transaction", () => {
      const result: TransactionResult = {
        txHash: "ABC123",
        height: "12345",
        code: 0,
        rawLog: "[]",
        gasWanted: "200000",
        gasUsed: "150000",
        timestamp: "2026-01-01T00:00:00Z",
        tx: {
          body: {
            messages: [
              {
                "@type": "/cosmos.bank.v1beta1.MsgSend",
                fromAddress: "noble1sender",
                toAddress: "noble1receiver",
                amount: [{ denom: "uusdc", amount: "1000000" }],
              },
            ],
            memo: "",
          },
        },
      };

      expect(result.code).toBe(0);
      expect(result.tx.body.messages.length).toBe(1);
    });

    it("should represent a failed transaction", () => {
      const result: TransactionResult = {
        txHash: "FAILED123",
        height: "12346",
        code: 5,
        rawLog: "insufficient funds",
        gasWanted: "200000",
        gasUsed: "50000",
        timestamp: "2026-01-01T00:00:01Z",
        tx: {
          body: {
            messages: [],
            memo: "",
          },
        },
      };

      expect(result.code).not.toBe(0);
    });
  });

  describe("MsgSend", () => {
    it("should contain coins with denomination", () => {
      const msg: MsgSend = {
        "@type": "/cosmos.bank.v1beta1.MsgSend",
        fromAddress: "noble1sender123456789abcdef",
        toAddress: "noble1recipient123456789abc",
        amount: [
          { denom: "uusdc", amount: "1000000" },
          { denom: "uatom", amount: "500000" },
        ],
      };

      expect(msg.amount.length).toBe(2);
      expect(msg.amount[0].denom).toBe("uusdc");
    });
  });

  describe("Coin", () => {
    it("should have denom and amount", () => {
      const coin: Coin = {
        denom: "uusdc",
        amount: "1500000",
      };

      expect(coin.denom).toBe("uusdc");
      expect(coin.amount).toBe("1500000");
    });
  });
});
