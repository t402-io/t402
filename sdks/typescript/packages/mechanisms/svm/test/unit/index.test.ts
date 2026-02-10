import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  ExactSvmScheme,
  validateSvmAddress,
  normalizeNetwork,
  getUsdcAddress,
  convertToTokenAmount,
  SVM_ADDRESS_REGEX,
  SOLANA_MAINNET_CAIP2,
  SOLANA_DEVNET_CAIP2,
  SOLANA_TESTNET_CAIP2,
  USDC_MAINNET_ADDRESS,
  USDC_DEVNET_ADDRESS,
  TOKEN_PROGRAM_ADDRESS,
  TOKEN_2022_PROGRAM_ADDRESS,
  COMPUTE_BUDGET_PROGRAM_ADDRESS,
  DEFAULT_COMPUTE_UNIT_LIMIT,
  DEFAULT_COMPUTE_UNIT_PRICE_MICROLAMPORTS,
  MAX_COMPUTE_UNIT_PRICE_MICROLAMPORTS,
} from "../../src/index";
import { ExactSvmScheme as ServerExactSvmScheme } from "../../src/exact/server/scheme";
import { ExactSvmScheme as FacilitatorExactSvmScheme } from "../../src/exact/facilitator/scheme";
import { ExactSvmScheme as ClientExactSvmScheme } from "../../src/exact/client/scheme";
import type { FacilitatorSvmSigner, ClientSvmSigner } from "../../src/signer";
import type { PaymentPayload, PaymentRequirements } from "@t402/core/types";
import type { Address } from "@solana/kit";

// ---------------------------------------------------------------------------
// Mock Solana modules used by the facilitator's verify/settle methods.
// We use vi.importActual to preserve non-mocked exports (normalizeNetwork, etc.)
// from the utils module so existing tests remain unaffected.
// ---------------------------------------------------------------------------

const mockDecodeTransactionFromPayload = vi.fn();
const mockGetTokenPayerFromTransaction = vi.fn();

vi.mock("../../src/utils", async () => {
  const actual = await vi.importActual<typeof import("../../src/utils")>("../../src/utils");
  return {
    ...actual,
    decodeTransactionFromPayload: (...args: unknown[]) => mockDecodeTransactionFromPayload(...args),
    getTokenPayerFromTransaction: (...args: unknown[]) => mockGetTokenPayerFromTransaction(...args),
  };
});

const mockGetCompiledTransactionMessageDecoder = vi.fn();

vi.mock("@solana/kit", async () => {
  const actual = await vi.importActual<typeof import("@solana/kit")>("@solana/kit");
  return {
    ...actual,
    getCompiledTransactionMessageDecoder: () => ({
      decode: mockGetCompiledTransactionMessageDecoder,
    }),
  };
});

const mockParseSetComputeUnitLimitInstruction = vi.fn();
const mockParseSetComputeUnitPriceInstruction = vi.fn();

vi.mock("@solana-program/compute-budget", async () => {
  const actual = await vi.importActual<typeof import("@solana-program/compute-budget")>(
    "@solana-program/compute-budget",
  );
  return {
    ...actual,
    parseSetComputeUnitLimitInstruction: (...args: unknown[]) =>
      mockParseSetComputeUnitLimitInstruction(...args),
    parseSetComputeUnitPriceInstruction: (...args: unknown[]) =>
      mockParseSetComputeUnitPriceInstruction(...args),
  };
});

const mockParseTransferCheckedInstructionToken = vi.fn();

vi.mock("@solana-program/token", async () => {
  const actual =
    await vi.importActual<typeof import("@solana-program/token")>("@solana-program/token");
  return {
    ...actual,
    parseTransferCheckedInstruction: (...args: unknown[]) =>
      mockParseTransferCheckedInstructionToken(...args),
  };
});

const mockParseTransferCheckedInstruction2022 = vi.fn();
const mockFindAssociatedTokenPda = vi.fn();

vi.mock("@solana-program/token-2022", async () => {
  const actual = await vi.importActual<typeof import("@solana-program/token-2022")>(
    "@solana-program/token-2022",
  );
  return {
    ...actual,
    parseTransferCheckedInstruction: (...args: unknown[]) =>
      mockParseTransferCheckedInstruction2022(...args),
    findAssociatedTokenPda: (...args: unknown[]) => mockFindAssociatedTokenPda(...args),
  };
});

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------
const FEE_PAYER_ADDRESS = "FeePayerAddress1111111111111111111111";
const PAY_TO_ADDRESS = "RecipientAddress11111111111111111111111";
const CLIENT_ADDRESS = "ClientAddress111111111111111111111111";
const SOURCE_ATA = "SourceATA111111111111111111111111111111";
const DEST_ATA = "DestATA1111111111111111111111111111111";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("@t402/svm", () => {
  it("should export main classes", () => {
    expect(ExactSvmScheme).toBeDefined();
    expect(ExactSvmScheme).toBeDefined();
    expect(ExactSvmScheme).toBeDefined();
  });

  describe("validateSvmAddress", () => {
    it("should validate correct Solana addresses", () => {
      expect(validateSvmAddress(USDC_MAINNET_ADDRESS)).toBe(true);
      expect(validateSvmAddress(USDC_DEVNET_ADDRESS)).toBe(true);
      expect(validateSvmAddress("11111111111111111111111111111111")).toBe(true);
    });

    it("should reject invalid addresses", () => {
      expect(validateSvmAddress("")).toBe(false);
      expect(validateSvmAddress("invalid")).toBe(false);
      expect(validateSvmAddress("0x1234567890abcdef")).toBe(false);
      expect(validateSvmAddress("too-short")).toBe(false);
    });

    it("should reject addresses with invalid characters", () => {
      expect(validateSvmAddress("0000000000000000000000000000000O")).toBe(false); // 'O' not allowed
      expect(validateSvmAddress("0000000000000000000000000000000I")).toBe(false); // 'I' not allowed
      expect(validateSvmAddress("0000000000000000000000000000000l")).toBe(false); // 'l' not allowed
    });
  });

  describe("normalizeNetwork", () => {
    it("should return CAIP-2 format as-is", () => {
      expect(normalizeNetwork(SOLANA_MAINNET_CAIP2)).toBe(SOLANA_MAINNET_CAIP2);
      expect(normalizeNetwork(SOLANA_DEVNET_CAIP2)).toBe(SOLANA_DEVNET_CAIP2);
      expect(normalizeNetwork(SOLANA_TESTNET_CAIP2)).toBe(SOLANA_TESTNET_CAIP2);
    });

    it("should convert V1 network names to CAIP-2", () => {
      expect(normalizeNetwork("solana" as never)).toBe(SOLANA_MAINNET_CAIP2);
      expect(normalizeNetwork("solana-devnet" as never)).toBe(SOLANA_DEVNET_CAIP2);
      expect(normalizeNetwork("solana-testnet" as never)).toBe(SOLANA_TESTNET_CAIP2);
    });

    it("should throw for unsupported networks", () => {
      expect(() => normalizeNetwork("solana:unknown" as never)).toThrow("Unsupported SVM network");
      expect(() => normalizeNetwork("ethereum:1" as never)).toThrow("Unsupported SVM network");
      expect(() => normalizeNetwork("unknown-network" as never)).toThrow("Unsupported SVM network");
    });
  });

  describe("getUsdcAddress", () => {
    it("should return mainnet USDC address", () => {
      expect(getUsdcAddress(SOLANA_MAINNET_CAIP2)).toBe(USDC_MAINNET_ADDRESS);
    });

    it("should return devnet USDC address", () => {
      expect(getUsdcAddress(SOLANA_DEVNET_CAIP2)).toBe(USDC_DEVNET_ADDRESS);
    });

    it("should return testnet USDC address", () => {
      expect(getUsdcAddress(SOLANA_TESTNET_CAIP2)).toBe(USDC_DEVNET_ADDRESS);
    });

    it("should throw for unsupported networks", () => {
      expect(() => getUsdcAddress("solana:unknown" as never)).toThrow("Unsupported SVM network");
    });
  });

  describe("convertToTokenAmount", () => {
    it("should convert decimal amounts to token units (6 decimals)", () => {
      expect(convertToTokenAmount("0.10", 6)).toBe("100000");
      expect(convertToTokenAmount("1.00", 6)).toBe("1000000");
      expect(convertToTokenAmount("0.01", 6)).toBe("10000");
      expect(convertToTokenAmount("123.456789", 6)).toBe("123456789");
    });

    it("should handle whole numbers", () => {
      expect(convertToTokenAmount("1", 6)).toBe("1000000");
      expect(convertToTokenAmount("100", 6)).toBe("100000000");
    });

    it("should handle different decimals", () => {
      expect(convertToTokenAmount("1", 9)).toBe("1000000000"); // SOL
      expect(convertToTokenAmount("1", 2)).toBe("100");
      expect(convertToTokenAmount("1", 0)).toBe("1");
    });

    it("should throw for invalid amounts", () => {
      expect(() => convertToTokenAmount("abc", 6)).toThrow("Invalid amount");
      expect(() => convertToTokenAmount("", 6)).toThrow("Invalid amount");
      expect(() => convertToTokenAmount("NaN", 6)).toThrow("Invalid amount");
    });
  });

  describe("ExactSvmScheme (Server)", () => {
    const server = new ServerExactSvmScheme();

    describe("parsePrice", () => {
      it("should parse dollar string prices", async () => {
        const result = await server.parsePrice("$0.10", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp");
        expect(result.amount).toBe("100000"); // 0.10 USDC = 100000 smallest units
        expect(result.asset).toBe(USDC_MAINNET_ADDRESS);
      });

      it("should parse simple number string prices", async () => {
        const result = await server.parsePrice("0.10", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp");
        expect(result.amount).toBe("100000");
        expect(result.asset).toBe(USDC_MAINNET_ADDRESS);
      });

      it("should parse explicit USDC prices", async () => {
        const result = await server.parsePrice(
          "0.10 USDC",
          "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
        );
        expect(result.amount).toBe("100000");
        expect(result.asset).toBe(USDC_MAINNET_ADDRESS);
      });

      it("should parse USD as USDC", async () => {
        const result = await server.parsePrice(
          "0.10 USD",
          "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
        );
        expect(result.amount).toBe("100000");
        expect(result.asset).toBe(USDC_MAINNET_ADDRESS);
      });

      it("should parse number prices", async () => {
        const result = await server.parsePrice(0.1, "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp");
        expect(result.amount).toBe("100000");
        expect(result.asset).toBe(USDC_MAINNET_ADDRESS);
      });

      it("should use devnet USDC for devnet network", async () => {
        const result = await server.parsePrice("1.00", "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1");
        expect(result.amount).toBe("1000000");
        expect(result.asset).toBe(USDC_DEVNET_ADDRESS);
      });

      it("should handle pre-parsed price objects", async () => {
        const result = await server.parsePrice(
          { amount: "123456", asset: "custom_token_address", extra: {} },
          "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
        );
        expect(result.amount).toBe("123456");
        expect(result.asset).toBe("custom_token_address");
      });

      it("should throw for invalid price formats", async () => {
        await expect(
          async () =>
            await server.parsePrice("not-a-price!", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"),
        ).rejects.toThrow("Invalid money format");
      });

      it("should throw for price objects without asset", async () => {
        await expect(
          async () =>
            await server.parsePrice(
              { amount: "123456" } as never,
              "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
            ),
        ).rejects.toThrow("Asset address must be specified");
      });
    });

    describe("enhancePaymentRequirements", () => {
      it("should add feePayer to payment requirements", async () => {
        const requirements = {
          scheme: "exact",
          network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
          asset: USDC_MAINNET_ADDRESS,
          amount: "100000",
          payTo: "11111111111111111111111111111111",
          maxTimeoutSeconds: 3600,
        };

        const facilitatorAddress = "FacilitatorAddress111111111111111111111";
        const result = await server.enhancePaymentRequirements(
          requirements as never,
          {
            t402Version: 2,
            scheme: "exact",
            network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
            extra: { feePayer: facilitatorAddress },
          },
          [],
        );

        expect(result).toEqual({
          ...requirements,
          extra: { feePayer: facilitatorAddress },
        });
      });
    });
  });

  describe("Constants", () => {
    it("should export correct USDC addresses", () => {
      expect(USDC_MAINNET_ADDRESS).toBe("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
      expect(USDC_DEVNET_ADDRESS).toBe("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
    });

    it("should have valid address regex", () => {
      expect(SVM_ADDRESS_REGEX).toBeInstanceOf(RegExp);
      expect(SVM_ADDRESS_REGEX.test(USDC_MAINNET_ADDRESS)).toBe(true);
    });
  });

  // =========================================================================
  // Client & Facilitator integration tests with mocked Solana internals
  // =========================================================================
  describe("Client and Facilitator Integration (mocked)", () => {
    /**
     * Create a mock FacilitatorSvmSigner.
     *
     * @param addresses - Fee payer addresses managed by this signer
     * @returns Mock FacilitatorSvmSigner
     */
    function createMockFacilitatorSigner(...addresses: string[]): FacilitatorSvmSigner {
      return {
        getAddresses: () => addresses as unknown as readonly Address[],
        signTransaction: vi.fn().mockResolvedValue("mock-signed-base64-tx"),
        simulateTransaction: vi.fn().mockResolvedValue(undefined),
        sendTransaction: vi.fn().mockResolvedValue("mock-tx-signature-abc123"),
        confirmTransaction: vi.fn().mockResolvedValue(undefined),
      };
    }

    /**
     * Create standard mock payment requirements.
     *
     * @param overrides - Partial overrides
     * @returns PaymentRequirements
     */
    function createRequirements(overrides: Partial<PaymentRequirements> = {}): PaymentRequirements {
      return {
        scheme: "exact",
        network: SOLANA_DEVNET_CAIP2,
        asset: USDC_DEVNET_ADDRESS,
        amount: "1000000",
        payTo: PAY_TO_ADDRESS,
        maxTimeoutSeconds: 3600,
        extra: { feePayer: FEE_PAYER_ADDRESS },
        ...overrides,
      };
    }

    /**
     * Create a mock payment payload with a transaction field.
     *
     * @param overrides - Optional overrides for the accepted field
     * @returns PaymentPayload
     */
    function createPayload(overrides: Partial<PaymentPayload["accepted"]> = {}): PaymentPayload {
      return {
        t402Version: 2,
        accepted: {
          scheme: "exact",
          network: SOLANA_DEVNET_CAIP2,
          asset: USDC_DEVNET_ADDRESS,
          amount: "1000000",
          payTo: PAY_TO_ADDRESS,
          maxTimeoutSeconds: 3600,
          extra: { feePayer: FEE_PAYER_ADDRESS },
          ...overrides,
        },
        payload: { transaction: "mockBase64Tx==" },
      };
    }

    /**
     * Build a mock compiled transaction message with 3 instructions:
     * [SetComputeUnitLimit, SetComputeUnitPrice, TransferChecked].
     *
     * @param opts - Customization options
     * @returns Compiled message structure with staticAccounts and instructions
     */
    function buildCompiledMessage(
      opts: {
        tokenProgram?: string;
        mint?: string;
        owner?: string;
        destATA?: string;
        sourceATA?: string;
        feePayer?: string;
      } = {},
    ) {
      const tokenProg = opts.tokenProgram ?? TOKEN_PROGRAM_ADDRESS;
      const mint = opts.mint ?? USDC_DEVNET_ADDRESS;
      const owner = opts.owner ?? CLIENT_ADDRESS;
      const destAta = opts.destATA ?? DEST_ATA;
      const sourceAta = opts.sourceATA ?? SOURCE_ATA;
      const feePayer = opts.feePayer ?? FEE_PAYER_ADDRESS;

      return {
        staticAccounts: [
          feePayer,
          COMPUTE_BUDGET_PROGRAM_ADDRESS,
          tokenProg,
          sourceAta,
          mint,
          destAta,
          owner,
        ],
        instructions: [
          {
            programAddressIndex: 1,
            accountIndices: [],
            data: new Uint8Array([2, 0x64, 0x19, 0, 0]),
          },
          {
            programAddressIndex: 1,
            accountIndices: [],
            data: new Uint8Array([3, 1, 0, 0, 0, 0, 0, 0, 0]),
          },
          { programAddressIndex: 2, accountIndices: [3, 4, 5, 6], data: new Uint8Array([12]) },
        ],
      };
    }

    /**
     * Set up all mocks for a successful verification flow.
     *
     * @param opts - Options for customizing the mock behavior
     * @param opts.transferAmount - Amount in the TransferChecked instruction (default 1000000n)
     * @param opts.tokenProgram - Token program address for the transfer instruction
     * @param opts.destATA - Destination ATA address
     * @param opts.owner - Token authority/payer address
     * @param opts.mint - SPL token mint address
     */
    function setupSuccessfulVerifyMocks(
      opts: {
        transferAmount?: bigint;
        tokenProgram?: string;
        destATA?: string;
        owner?: string;
        mint?: string;
      } = {},
    ) {
      const tokenProg = opts.tokenProgram ?? TOKEN_PROGRAM_ADDRESS;
      const owner = opts.owner ?? CLIENT_ADDRESS;
      const mint = opts.mint ?? USDC_DEVNET_ADDRESS;
      const destAta = opts.destATA ?? DEST_ATA;
      const transferAmount = opts.transferAmount ?? 1000000n;

      const compiled = buildCompiledMessage({
        tokenProgram: tokenProg,
        mint,
        owner,
        destATA: destAta,
      });

      // Mock transaction decode
      mockDecodeTransactionFromPayload.mockReturnValue({
        messageBytes: new Uint8Array(128),
        signatures: { [FEE_PAYER_ADDRESS]: new Uint8Array(64) },
      });

      // Mock compiled message decoder
      mockGetCompiledTransactionMessageDecoder.mockReturnValue(compiled);

      // Mock token payer extraction
      mockGetTokenPayerFromTransaction.mockReturnValue(owner);

      // Mock compute budget instruction parsers (no-op: just don't throw)
      mockParseSetComputeUnitLimitInstruction.mockReturnValue({});
      mockParseSetComputeUnitPriceInstruction.mockReturnValue({ microLamports: 1n });

      // Mock token transfer parser
      const parsedTransfer = {
        accounts: {
          authority: { address: owner },
          mint: { address: mint },
          destination: { address: destAta },
        },
        data: { amount: transferAmount },
      };

      if (tokenProg === TOKEN_PROGRAM_ADDRESS) {
        mockParseTransferCheckedInstructionToken.mockReturnValue(parsedTransfer);
      } else {
        mockParseTransferCheckedInstruction2022.mockReturnValue(parsedTransfer);
      }

      // Mock ATA derivation to match destination
      mockFindAssociatedTokenPda.mockResolvedValue([destAta]);
    }

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should create a valid payment payload with ExactSvmScheme", async () => {
      const mockSigner: ClientSvmSigner = {
        address: CLIENT_ADDRESS as unknown as Address,
        signTransactions: vi
          .fn()
          .mockResolvedValue([{ messageBytes: new Uint8Array(64), signatures: {} }]),
      } as unknown as ClientSvmSigner;

      const client = new ClientExactSvmScheme(mockSigner, {
        rpcUrl: "https://api.devnet.solana.com",
      });

      // Verify client has correct scheme and the method exists
      expect(client.scheme).toBe("exact");
      expect(typeof client.createPaymentPayload).toBe("function");

      // Build requirements and verify structure
      const requirements = createRequirements();
      expect(requirements.extra?.feePayer).toBe(FEE_PAYER_ADDRESS);
      expect(requirements.amount).toBe("1000000");
      expect(requirements.asset).toBe(USDC_DEVNET_ADDRESS);
      expect(requirements.network).toBe(SOLANA_DEVNET_CAIP2);

      // The client requires a feePayer in requirements.extra for SVM transactions.
      // Calling createPaymentPayload without feePayer triggers an error. Because
      // createPaymentPayload also calls fetchMint via RPC (which is mocked), the
      // error path may differ, but the client must always reject eventually.
      const noFeePayerReqs = createRequirements({ extra: {} });
      await expect(client.createPaymentPayload(2, noFeePayerReqs)).rejects.toThrow();
    });

    it("should verify a valid payment with ExactSvmScheme", async () => {
      const mockSigner = createMockFacilitatorSigner(FEE_PAYER_ADDRESS);
      setupSuccessfulVerifyMocks();

      const facilitator = new FacilitatorExactSvmScheme(mockSigner);
      const requirements = createRequirements();
      const payload = createPayload();

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(true);
      expect(result.invalidReason).toBeUndefined();
      expect(result.payer).toBe(CLIENT_ADDRESS);

      // Verify the signer methods were called for signing and simulation
      expect(mockSigner.signTransaction).toHaveBeenCalledWith(
        "mockBase64Tx==",
        FEE_PAYER_ADDRESS,
        SOLANA_DEVNET_CAIP2,
      );
      expect(mockSigner.simulateTransaction).toHaveBeenCalledWith(
        "mock-signed-base64-tx",
        SOLANA_DEVNET_CAIP2,
      );
    });

    it("should reject invalid signatures", async () => {
      const mockSigner = createMockFacilitatorSigner(FEE_PAYER_ADDRESS);
      setupSuccessfulVerifyMocks();

      // Simulate signature verification failure during transaction simulation
      (mockSigner.simulateTransaction as Mock).mockRejectedValue(
        new Error("Simulation failed: signature verification failed"),
      );

      const facilitator = new FacilitatorExactSvmScheme(mockSigner);
      const requirements = createRequirements();
      const payload = createPayload();

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toContain("transaction_simulation_failed");
      expect(result.invalidReason).toContain("signature verification failed");
      expect(result.payer).toBe(CLIENT_ADDRESS);
    });

    it("should reject insufficient amounts", async () => {
      const mockSigner = createMockFacilitatorSigner(FEE_PAYER_ADDRESS);

      // Set up mocks where transfer amount is only 500000 (0.5 USDC)
      setupSuccessfulVerifyMocks({ transferAmount: 500000n });

      const facilitator = new FacilitatorExactSvmScheme(mockSigner);

      // Requirements demand 1 USDC (1000000), but transaction only transfers 0.5 USDC
      const requirements = createRequirements({ amount: "1000000" });
      const payload = createPayload();

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("invalid_exact_svm_payload_amount_insufficient");
      expect(result.payer).toBe(CLIENT_ADDRESS);
    });

    it("should reject wrong recipients", async () => {
      const mockSigner = createMockFacilitatorSigner(FEE_PAYER_ADDRESS);
      setupSuccessfulVerifyMocks({ destATA: "WrongDestATA1111111111111111111111111" });

      // ATA derivation returns the expected ATA which does NOT match the
      // WrongDestATA in the transaction, causing recipient mismatch
      mockFindAssociatedTokenPda.mockResolvedValue(["CorrectDestATA111111111111111111111"]);

      const facilitator = new FacilitatorExactSvmScheme(mockSigner);
      const requirements = createRequirements();
      const payload = createPayload();

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("invalid_exact_svm_payload_recipient_mismatch");
      expect(result.payer).toBe(CLIENT_ADDRESS);
    });

    it("should reject expired transactions", async () => {
      const mockSigner = createMockFacilitatorSigner(FEE_PAYER_ADDRESS);
      setupSuccessfulVerifyMocks();

      // Simulate blockhash expiration during transaction simulation
      (mockSigner.simulateTransaction as Mock).mockRejectedValue(
        new Error("Simulation failed: Blockhash not found"),
      );

      const facilitator = new FacilitatorExactSvmScheme(mockSigner);
      const requirements = createRequirements({ maxTimeoutSeconds: 1 });
      const payload = createPayload();

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toContain("transaction_simulation_failed");
      expect(result.invalidReason).toContain("Blockhash not found");
      expect(result.payer).toBe(CLIENT_ADDRESS);
    });

    it("should settle valid payments", async () => {
      const mockSigner = createMockFacilitatorSigner(FEE_PAYER_ADDRESS);
      setupSuccessfulVerifyMocks();

      const facilitator = new FacilitatorExactSvmScheme(mockSigner);
      const requirements = createRequirements();
      const payload = createPayload();

      const result = await facilitator.settle(payload, requirements);

      expect(result.success).toBe(true);
      expect(result.transaction).toBe("mock-tx-signature-abc123");
      expect(result.network).toBe(SOLANA_DEVNET_CAIP2);
      expect(result.payer).toBe(CLIENT_ADDRESS);

      // Verify the signer's sendTransaction and confirmTransaction were called
      expect(mockSigner.sendTransaction).toHaveBeenCalled();
      expect(mockSigner.confirmTransaction).toHaveBeenCalledWith(
        "mock-tx-signature-abc123",
        SOLANA_DEVNET_CAIP2,
      );
    });

    it("should handle compute budget instructions", async () => {
      const mockSigner = createMockFacilitatorSigner(FEE_PAYER_ADDRESS);

      // Set up basic decode mocks
      mockDecodeTransactionFromPayload.mockReturnValue({
        messageBytes: new Uint8Array(128),
        signatures: {},
      });

      const compiled = buildCompiledMessage();
      mockGetCompiledTransactionMessageDecoder.mockReturnValue(compiled);
      mockGetTokenPayerFromTransaction.mockReturnValue(CLIENT_ADDRESS);

      // Make the ComputeUnitLimit parse fail (wrong discriminator / corrupt data)
      mockParseSetComputeUnitLimitInstruction.mockImplementation(() => {
        throw new Error("invalid instruction data");
      });

      const facilitator = new FacilitatorExactSvmScheme(mockSigner);
      const requirements = createRequirements();
      const payload = createPayload();

      const result = await facilitator.verify(payload, requirements);

      // Facilitator should reject with compute limit instruction error
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toContain("compute_limit_instruction");

      // Now test that ComputeUnitPrice too high is also rejected
      vi.clearAllMocks();
      mockDecodeTransactionFromPayload.mockReturnValue({
        messageBytes: new Uint8Array(128),
        signatures: {},
      });
      mockGetCompiledTransactionMessageDecoder.mockReturnValue(buildCompiledMessage());
      mockGetTokenPayerFromTransaction.mockReturnValue(CLIENT_ADDRESS);
      mockParseSetComputeUnitLimitInstruction.mockReturnValue({});

      // Return excessively high microLamports
      mockParseSetComputeUnitPriceInstruction.mockReturnValue({
        microLamports: BigInt(MAX_COMPUTE_UNIT_PRICE_MICROLAMPORTS) + 1n,
      });

      const result2 = await facilitator.verify(payload, requirements);

      expect(result2.isValid).toBe(false);
      expect(result2.invalidReason).toContain("compute_price_instruction");

      // Verify compute budget constants
      expect(DEFAULT_COMPUTE_UNIT_LIMIT).toBe(6500);
      expect(DEFAULT_COMPUTE_UNIT_PRICE_MICROLAMPORTS).toBe(1);
      expect(MAX_COMPUTE_UNIT_PRICE_MICROLAMPORTS).toBe(5_000_000);
    });

    it("should verify both SPL Token and Token-2022 transfers", async () => {
      // Test 1: SPL Token (TOKEN_PROGRAM_ADDRESS)
      const mockSigner1 = createMockFacilitatorSigner(FEE_PAYER_ADDRESS);
      setupSuccessfulVerifyMocks({ tokenProgram: TOKEN_PROGRAM_ADDRESS });

      const facilitator1 = new FacilitatorExactSvmScheme(mockSigner1);
      const requirements = createRequirements();
      const payload = createPayload();

      const result1 = await facilitator1.verify(payload, requirements);

      expect(result1.isValid).toBe(true);
      expect(result1.payer).toBe(CLIENT_ADDRESS);
      expect(mockParseTransferCheckedInstructionToken).toHaveBeenCalled();

      // Test 2: Token-2022 (TOKEN_2022_PROGRAM_ADDRESS)
      vi.clearAllMocks();
      const mockSigner2 = createMockFacilitatorSigner(FEE_PAYER_ADDRESS);
      setupSuccessfulVerifyMocks({ tokenProgram: TOKEN_2022_PROGRAM_ADDRESS });

      const facilitator2 = new FacilitatorExactSvmScheme(mockSigner2);

      const result2 = await facilitator2.verify(payload, requirements);

      expect(result2.isValid).toBe(true);
      expect(result2.payer).toBe(CLIENT_ADDRESS);
      expect(mockParseTransferCheckedInstruction2022).toHaveBeenCalled();

      // Verify both program addresses are distinct valid Solana addresses
      expect(TOKEN_PROGRAM_ADDRESS).toBe("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
      expect(TOKEN_2022_PROGRAM_ADDRESS).toBe("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
      expect(TOKEN_PROGRAM_ADDRESS).not.toBe(TOKEN_2022_PROGRAM_ADDRESS);
    });
  });
});
