import { describe, it, expect } from "vitest";
import {
  isValidPrincipal,
  isValidTxId,
  comparePrincipals,
  formatAmount,
  parseAmount,
  extractTokenTransfer,
  extractTokenTransferFromPostConditions,
} from "../../src/utils";
import type { StacksTransactionResult } from "../../src/types";

describe("Stacks Utils", () => {
  // Valid Stacks mainnet address for testing
  const validMainnetAddress = "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K";
  // Valid Stacks testnet address
  const validTestnetAddress = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
  // Valid contract principal
  const validContractPrincipal = "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc";
  // Valid transaction ID (0x + 64 hex chars)
  const validTxId = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

  describe("isValidPrincipal", () => {
    it("should validate correct mainnet addresses", () => {
      expect(isValidPrincipal(validMainnetAddress)).toBe(true);
    });

    it("should validate correct testnet addresses", () => {
      expect(isValidPrincipal(validTestnetAddress)).toBe(true);
    });

    it("should validate correct contract principals", () => {
      expect(isValidPrincipal(validContractPrincipal)).toBe(true);
    });

    it("should reject invalid addresses", () => {
      expect(isValidPrincipal("")).toBe(false);
      expect(isValidPrincipal("invalid")).toBe(false);
      expect(isValidPrincipal("0x1234567890abcdef")).toBe(false);
      expect(isValidPrincipal("short")).toBe(false);
    });

    it("should reject null/undefined", () => {
      expect(isValidPrincipal(null as unknown as string)).toBe(false);
      expect(isValidPrincipal(undefined as unknown as string)).toBe(false);
    });

    it("should reject addresses with wrong prefix", () => {
      expect(isValidPrincipal("XX3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K")).toBe(false);
      expect(isValidPrincipal("AB1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM")).toBe(false);
    });

    it("should reject contract principals with invalid contract name", () => {
      // Contract name starting with number
      expect(isValidPrincipal(`${validMainnetAddress}.123invalid`)).toBe(false);
      // Contract name with invalid chars
      expect(isValidPrincipal(`${validMainnetAddress}.invalid@name`)).toBe(false);
    });

    it("should reject principals with too many dots", () => {
      expect(isValidPrincipal(`${validMainnetAddress}.contract.extra`)).toBe(false);
    });
  });

  describe("isValidTxId", () => {
    it("should validate correct transaction IDs", () => {
      expect(isValidTxId(validTxId)).toBe(true);
    });

    it("should reject invalid transaction IDs", () => {
      expect(isValidTxId("")).toBe(false);
      expect(isValidTxId("0x1234")).toBe(false); // Too short
      expect(isValidTxId("1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef")).toBe(false); // Missing 0x
      expect(isValidTxId("0xGGGG567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef")).toBe(false); // Invalid hex
    });

    it("should reject null/undefined", () => {
      expect(isValidTxId(null as unknown as string)).toBe(false);
      expect(isValidTxId(undefined as unknown as string)).toBe(false);
    });
  });

  describe("comparePrincipals", () => {
    it("should return true for identical principals", () => {
      expect(comparePrincipals(validMainnetAddress, validMainnetAddress)).toBe(true);
    });

    it("should return false for different principals", () => {
      expect(comparePrincipals(validMainnetAddress, validTestnetAddress)).toBe(false);
    });

    it("should be case-sensitive", () => {
      expect(comparePrincipals(validMainnetAddress, validMainnetAddress.toLowerCase())).toBe(false);
    });
  });

  describe("formatAmount", () => {
    it("should format whole amounts correctly", () => {
      expect(formatAmount("1000000", 6)).toBe("1");
      expect(formatAmount("100000000", 6)).toBe("100");
    });

    it("should format decimal amounts correctly", () => {
      expect(formatAmount("1500000", 6)).toBe("1.5");
      expect(formatAmount("1234567", 6)).toBe("1.234567");
    });

    it("should trim trailing zeros", () => {
      expect(formatAmount("1100000", 6)).toBe("1.1");
      expect(formatAmount("1010000", 6)).toBe("1.01");
    });

    it("should handle zero", () => {
      expect(formatAmount("0", 6)).toBe("0");
    });

    it("should handle small amounts", () => {
      expect(formatAmount("1", 6)).toBe("0.000001");
      expect(formatAmount("10", 6)).toBe("0.00001");
    });
  });

  describe("parseAmount", () => {
    it("should parse whole amounts correctly", () => {
      expect(parseAmount("1", 6)).toBe("1000000");
      expect(parseAmount("100", 6)).toBe("100000000");
    });

    it("should parse decimal amounts correctly", () => {
      expect(parseAmount("1.5", 6)).toBe("1500000");
      expect(parseAmount("1.234567", 6)).toBe("1234567");
    });

    it("should handle amounts with fewer decimals", () => {
      expect(parseAmount("1.1", 6)).toBe("1100000");
      expect(parseAmount("1.01", 6)).toBe("1010000");
    });

    it("should handle zero", () => {
      expect(parseAmount("0", 6)).toBe("0");
    });

    it("should truncate extra decimal places", () => {
      expect(parseAmount("1.12345678", 6)).toBe("1123456");
    });
  });

  describe("formatAmount and parseAmount roundtrip", () => {
    it("should be reversible for whole amounts", () => {
      const amount = "1000000";
      expect(parseAmount(formatAmount(amount, 6), 6)).toBe(amount);
    });

    it("should be reversible for decimal amounts", () => {
      const amount = "1234567";
      expect(parseAmount(formatAmount(amount, 6), 6)).toBe(amount);
    });
  });

  describe("extractTokenTransfer", () => {
    const baseTxResult: StacksTransactionResult = {
      txId: validTxId,
      txType: "contract_call",
      txStatus: "success",
      blockHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      blockHeight: 12345,
      burnBlockTime: Math.floor(Date.now() / 1000),
      senderAddress: validMainnetAddress,
      contractCall: {
        contractId: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
        functionName: "transfer",
        functionArgs: [],
      },
      postConditionMode: "deny",
      postConditions: [],
      events: [
        {
          eventType: "fungible_token_asset",
          eventIndex: 0,
          asset: {
            assetEventType: "transfer",
            assetId: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc::sUSDC",
            sender: validMainnetAddress,
            recipient: "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
            amount: "1000000",
          },
        },
      ],
    };

    it("should extract transfer details from valid transaction", () => {
      const transfer = extractTokenTransfer(baseTxResult);
      expect(transfer).not.toBeNull();
      expect(transfer?.contractAddress).toBe("SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc");
      expect(transfer?.from).toBe(validMainnetAddress);
      expect(transfer?.to).toBe("SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7");
      expect(transfer?.amount).toBe("1000000");
      expect(transfer?.success).toBe(true);
    });

    it("should filter by contract address when specified", () => {
      const transfer = extractTokenTransfer(
        baseTxResult,
        "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
      );
      expect(transfer).not.toBeNull();

      const noMatch = extractTokenTransfer(
        baseTxResult,
        "SP_OTHER_CONTRACT.different-token",
      );
      expect(noMatch).toBeNull();
    });

    it("should return null for failed transaction", () => {
      const failedTx: StacksTransactionResult = {
        ...baseTxResult,
        txStatus: "abort_by_response",
      };
      expect(extractTokenTransfer(failedTx)).toBeNull();
    });

    it("should return null for non-contract-call transaction", () => {
      const tokenTransfer: StacksTransactionResult = {
        ...baseTxResult,
        txType: "token_transfer",
      };
      expect(extractTokenTransfer(tokenTransfer)).toBeNull();
    });

    it("should return null for non-transfer function call", () => {
      const mintTx: StacksTransactionResult = {
        ...baseTxResult,
        contractCall: {
          contractId: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
          functionName: "mint",
          functionArgs: [],
        },
      };
      expect(extractTokenTransfer(mintTx)).toBeNull();
    });

    it("should return null when no matching events", () => {
      const noEvents: StacksTransactionResult = {
        ...baseTxResult,
        events: [],
      };
      expect(extractTokenTransfer(noEvents)).toBeNull();
    });
  });

  describe("extractTokenTransferFromPostConditions", () => {
    it("should extract transfer from post conditions with matching events", () => {
      const txResult: StacksTransactionResult = {
        txId: validTxId,
        txType: "contract_call",
        txStatus: "success",
        blockHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        blockHeight: 12345,
        burnBlockTime: Math.floor(Date.now() / 1000),
        senderAddress: validMainnetAddress,
        postConditionMode: "deny",
        postConditions: [
          {
            principal: {
              type_id: "principal_standard",
              address: validMainnetAddress,
            },
            conditionCode: "sent_greater_than_or_equal_to",
            amount: "1000000",
            asset: {
              contractAddress: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
              contractName: "token-susdc",
              assetName: "sUSDC",
            },
          },
        ],
        events: [
          {
            eventType: "fungible_token_asset",
            eventIndex: 0,
            asset: {
              assetEventType: "transfer",
              assetId: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc::sUSDC",
              sender: validMainnetAddress,
              recipient: "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
              amount: "1000000",
            },
          },
        ],
      };

      const transfer = extractTokenTransferFromPostConditions(txResult);
      expect(transfer).not.toBeNull();
      expect(transfer?.from).toBe(validMainnetAddress);
      expect(transfer?.to).toBe("SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7");
      expect(transfer?.amount).toBe("1000000");
    });

    it("should return null for failed transaction", () => {
      const failedTx: StacksTransactionResult = {
        txId: validTxId,
        txType: "contract_call",
        txStatus: "abort_by_post_condition",
        blockHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        blockHeight: 12345,
        burnBlockTime: Math.floor(Date.now() / 1000),
        senderAddress: validMainnetAddress,
        postConditionMode: "deny",
        postConditions: [],
        events: [],
      };
      expect(extractTokenTransferFromPostConditions(failedTx)).toBeNull();
    });

    it("should return null when no post conditions", () => {
      const noPc: StacksTransactionResult = {
        txId: validTxId,
        txType: "contract_call",
        txStatus: "success",
        blockHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        blockHeight: 12345,
        burnBlockTime: Math.floor(Date.now() / 1000),
        senderAddress: validMainnetAddress,
        postConditionMode: "allow",
        postConditions: [],
        events: [],
      };
      expect(extractTokenTransferFromPostConditions(noPc)).toBeNull();
    });
  });
});
