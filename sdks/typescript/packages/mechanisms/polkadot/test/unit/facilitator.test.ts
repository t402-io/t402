import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExactDirectPolkadotFacilitator } from "../../src/exact-direct/facilitator/scheme";
import type { FacilitatorPolkadotSigner, PolkadotExtrinsicResult } from "../../src/types";
import type { PaymentPayload, PaymentRequirements } from "@t402/core/types";
import { POLKADOT_ASSET_HUB_CAIP2, SCHEME_EXACT_DIRECT } from "../../src/constants";

const MOCK_EXTRINSIC_HASH =
  "0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1";
const MOCK_BLOCK_HASH =
  "0xdef456abc123def456abc123def456abc123def456abc123def456abc123def4";
const VALID_FROM = "15oF4uVJwmo4TdGW7VfQxNLavjCXviqWrztPu6TRSPQnQVkR";
const VALID_PAYTO = "14E5nqKAp3oAJcg6ymCbet8zoYGBnP4y54P3LJ3RhMhQXt2R";

function buildMockExtrinsic(overrides?: Partial<{
  success: boolean;
  signer: string;
  assetId: number;
  to: string;
  amount: string;
  module: string;
  call: string;
}>): PolkadotExtrinsicResult {
  const opts = {
    success: true,
    signer: VALID_FROM,
    assetId: 1984,
    to: VALID_PAYTO,
    amount: "1000000",
    module: "assets",
    call: "transfer",
    ...overrides,
  };

  return {
    extrinsicHash: MOCK_EXTRINSIC_HASH,
    blockHash: MOCK_BLOCK_HASH,
    blockNumber: 12345,
    extrinsicIndex: 2,
    timestamp: new Date().toISOString(),
    signer: opts.signer,
    success: opts.success,
    module: opts.module,
    call: opts.call,
    args: {
      id: opts.assetId,
      target: opts.to,
      amount: opts.amount,
    },
    events: [
      {
        module: "assets",
        name: "Transferred",
        data: {
          assetId: opts.assetId,
          from: opts.signer,
          to: opts.to,
          amount: opts.amount,
        },
      },
    ],
  };
}

describe("ExactDirectPolkadotFacilitator", () => {
  let mockSigner: FacilitatorPolkadotSigner;

  beforeEach(() => {
    mockSigner = {
      getAddresses: vi.fn().mockReturnValue(["15FacilitatorAddressXXXXXXXXXXXXXXXXXXXXXXXXXX"]),
      queryExtrinsic: vi.fn().mockResolvedValue(buildMockExtrinsic()),
      getBalance: vi.fn().mockResolvedValue("10000000"),
    };
  });

  const makePayload = (overrides?: Partial<{
    scheme: string;
    network: string;
    extrinsicHash: string;
    from: string;
  }>): PaymentPayload => ({
    t402Version: 2,
    accepted: {
      scheme: overrides?.scheme ?? SCHEME_EXACT_DIRECT,
      network: overrides?.network ?? POLKADOT_ASSET_HUB_CAIP2,
    },
    payload: {
      extrinsicHash: overrides?.extrinsicHash ?? MOCK_EXTRINSIC_HASH,
      blockHash: MOCK_BLOCK_HASH,
      extrinsicIndex: 2,
      from: overrides?.from ?? VALID_FROM,
      to: VALID_PAYTO,
      amount: "1000000",
      assetId: 1984,
    },
  });

  const makeRequirements = (overrides?: Partial<PaymentRequirements>): PaymentRequirements => ({
    scheme: SCHEME_EXACT_DIRECT,
    network: POLKADOT_ASSET_HUB_CAIP2,
    asset: "USDT",
    amount: "1000000",
    payTo: VALID_PAYTO,
    maxTimeoutSeconds: 3600,
    extra: { assetId: 1984 },
    ...overrides,
  });

  describe("constructor", () => {
    it("should create instance with correct scheme", () => {
      const facilitator = new ExactDirectPolkadotFacilitator(mockSigner);
      expect(facilitator.scheme).toBe(SCHEME_EXACT_DIRECT);
    });

    it("should have correct caipFamily", () => {
      const facilitator = new ExactDirectPolkadotFacilitator(mockSigner);
      expect(facilitator.caipFamily).toBe("polkadot:*");
    });
  });

  describe("getSigners", () => {
    it("should return signer addresses for a network", () => {
      const facilitator = new ExactDirectPolkadotFacilitator(mockSigner);
      const signers = facilitator.getSigners(POLKADOT_ASSET_HUB_CAIP2);
      expect(signers).toHaveLength(1);
    });
  });

  describe("verify", () => {
    it("should verify a valid extrinsic", async () => {
      const facilitator = new ExactDirectPolkadotFacilitator(mockSigner, {
        maxExtrinsicAge: 0, // Disable age check
      });

      const result = await facilitator.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(true);
      expect(result.payer).toBe(VALID_FROM);
    });

    it("should reject invalid scheme", async () => {
      const facilitator = new ExactDirectPolkadotFacilitator(mockSigner);

      const result = await facilitator.verify(
        makePayload({ scheme: "wrong" }),
        makeRequirements(),
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toContain("invalid_scheme");
    });

    it("should reject network mismatch", async () => {
      const facilitator = new ExactDirectPolkadotFacilitator(mockSigner);

      const result = await facilitator.verify(
        makePayload({ network: "polkadot:e143f23803ac50e8f6f8e62695d1ce9e" }),
        makeRequirements(),
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toContain("network_mismatch");
    });

    it("should reject invalid extrinsic hash format", async () => {
      const facilitator = new ExactDirectPolkadotFacilitator(mockSigner);

      const result = await facilitator.verify(
        makePayload({ extrinsicHash: "not-valid" }),
        makeRequirements(),
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("invalid_extrinsic_hash_format");
    });

    it("should reject missing from address", async () => {
      const facilitator = new ExactDirectPolkadotFacilitator(mockSigner);

      const payload: PaymentPayload = {
        t402Version: 2,
        accepted: {
          scheme: SCHEME_EXACT_DIRECT,
          network: POLKADOT_ASSET_HUB_CAIP2,
        },
        payload: {
          extrinsicHash: MOCK_EXTRINSIC_HASH,
          blockHash: MOCK_BLOCK_HASH,
          extrinsicIndex: 2,
          from: "",
          to: VALID_PAYTO,
          amount: "1000000",
          assetId: 1984,
        },
      };

      const result = await facilitator.verify(payload, makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("missing_from_address");
    });

    it("should reject extrinsic not found", async () => {
      (mockSigner.queryExtrinsic as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const facilitator = new ExactDirectPolkadotFacilitator(mockSigner);

      const result = await facilitator.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("extrinsic_not_found");
    });

    it("should reject failed extrinsic", async () => {
      (mockSigner.queryExtrinsic as ReturnType<typeof vi.fn>).mockResolvedValue(
        buildMockExtrinsic({ success: false }),
      );
      const facilitator = new ExactDirectPolkadotFacilitator(mockSigner);

      const result = await facilitator.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("extrinsic_failed");
    });

    it("should reject wrong asset ID", async () => {
      (mockSigner.queryExtrinsic as ReturnType<typeof vi.fn>).mockResolvedValue(
        buildMockExtrinsic({ assetId: 9999 }),
      );
      const facilitator = new ExactDirectPolkadotFacilitator(mockSigner, {
        maxExtrinsicAge: 0,
      });

      const result = await facilitator.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toContain("asset_mismatch");
    });

    it("should reject wrong recipient", async () => {
      (mockSigner.queryExtrinsic as ReturnType<typeof vi.fn>).mockResolvedValue(
        buildMockExtrinsic({ to: "16WrongRecipientAddressXXXXXXXXXXXXXXXXXXXXXXXXX" }),
      );
      const facilitator = new ExactDirectPolkadotFacilitator(mockSigner, {
        maxExtrinsicAge: 0,
      });

      const result = await facilitator.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toContain("recipient_mismatch");
    });

    it("should reject insufficient amount", async () => {
      (mockSigner.queryExtrinsic as ReturnType<typeof vi.fn>).mockResolvedValue(
        buildMockExtrinsic({ amount: "500000" }),
      );
      const facilitator = new ExactDirectPolkadotFacilitator(mockSigner, {
        maxExtrinsicAge: 0,
      });

      const result = await facilitator.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toContain("insufficient_amount");
    });

    it("should accept amount greater than required", async () => {
      (mockSigner.queryExtrinsic as ReturnType<typeof vi.fn>).mockResolvedValue(
        buildMockExtrinsic({ amount: "2000000" }),
      );
      const facilitator = new ExactDirectPolkadotFacilitator(mockSigner, {
        maxExtrinsicAge: 0,
      });

      const result = await facilitator.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(true);
    });

    it("should reject replayed extrinsic", async () => {
      const facilitator = new ExactDirectPolkadotFacilitator(mockSigner, {
        maxExtrinsicAge: 0,
      });

      const first = await facilitator.verify(makePayload(), makeRequirements());
      expect(first.isValid).toBe(true);

      const second = await facilitator.verify(makePayload(), makeRequirements());
      expect(second.isValid).toBe(false);
      expect(second.invalidReason).toBe("extrinsic_already_used");
    });

    it("should reject non-asset-transfer extrinsic", async () => {
      const nonAssetExtrinsic = buildMockExtrinsic({ module: "balances", call: "transferKeepAlive" });
      // Remove the assets.Transferred event so the fallback also fails
      nonAssetExtrinsic.events = [
        { module: "balances", name: "Transfer", data: { from: VALID_FROM, to: VALID_PAYTO, amount: "1000000" } },
      ];
      (mockSigner.queryExtrinsic as ReturnType<typeof vi.fn>).mockResolvedValue(nonAssetExtrinsic);
      const facilitator = new ExactDirectPolkadotFacilitator(mockSigner, {
        maxExtrinsicAge: 0,
      });

      const result = await facilitator.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("not_asset_transfer");
    });
  });

  describe("settle", () => {
    it("should settle a valid extrinsic", async () => {
      const facilitator = new ExactDirectPolkadotFacilitator(mockSigner, {
        maxExtrinsicAge: 0,
      });

      const result = await facilitator.settle(makePayload(), makeRequirements());

      expect(result.success).toBe(true);
      expect(result.transaction).toBe(MOCK_EXTRINSIC_HASH);
      expect(result.network).toBe(POLKADOT_ASSET_HUB_CAIP2);
      expect(result.payer).toBe(VALID_FROM);
    });

    it("should fail settlement if verification fails", async () => {
      const facilitator = new ExactDirectPolkadotFacilitator(mockSigner);

      const result = await facilitator.settle(
        makePayload({ scheme: "wrong" }),
        makeRequirements(),
      );

      expect(result.success).toBe(false);
      expect(result.errorReason).toContain("invalid_scheme");
      expect(result.transaction).toBe("");
    });
  });
});
