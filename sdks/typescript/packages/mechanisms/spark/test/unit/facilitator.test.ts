import { describe, it, expect, vi } from "vitest";
import { SparkFacilitatorScheme } from "../../src/exact/facilitator/scheme";
import { TransferStatus } from "../../src/types";
import type { SparkSigner, TransferInfo } from "../../src/types";
import { createHash } from "crypto";

function mockSigner(transfers: Record<string, TransferInfo> = {}): SparkSigner {
  return {
    getTransfer: vi.fn(async (id: string) => {
      if (!(id in transfers)) throw new Error("not found");
      return transfers[id];
    }),
    getAddress: () => "spark:server123",
  };
}

const req = { network: "spark:mainnet", amount: "1000" };

describe("SparkFacilitatorScheme", () => {
  it("should have correct scheme and family", () => {
    const f = new SparkFacilitatorScheme(mockSigner());
    expect(f.scheme).toBe("exact");
    expect(f.caipFamily).toBe("spark:*");
  });

  describe("Spark transfer", () => {
    it("should verify valid transfer", async () => {
      const f = new SparkFacilitatorScheme(mockSigner({
        "tx-001": { id: "tx-001", amount: 1000, sender: "spark:sender", receiver: "spark:server123", status: TransferStatus.Completed },
      }));
      const r = await f.verify({ payload: { paymentType: "spark", transferId: "tx-001" } }, req);
      expect(r.isValid).toBe(true);
      expect(r.payer).toBe("spark:sender");
    });

    it("should reject insufficient amount", async () => {
      const f = new SparkFacilitatorScheme(mockSigner({
        "tx-001": { id: "tx-001", amount: 500, sender: "spark:sender", receiver: "spark:server123", status: TransferStatus.Completed },
      }));
      const r = await f.verify({ payload: { paymentType: "spark", transferId: "tx-001" } }, req);
      expect(r.isValid).toBe(false);
    });

    it("should reject wrong recipient", async () => {
      const f = new SparkFacilitatorScheme(mockSigner({
        "tx-001": { id: "tx-001", amount: 1000, sender: "spark:sender", receiver: "spark:wrong", status: TransferStatus.Completed },
      }));
      const r = await f.verify({ payload: { paymentType: "spark", transferId: "tx-001" } }, req);
      expect(r.isValid).toBe(false);
    });

    it("should reject pending transfer", async () => {
      const f = new SparkFacilitatorScheme(mockSigner({
        "tx-001": { id: "tx-001", amount: 1000, sender: "spark:sender", receiver: "spark:server123", status: TransferStatus.Pending },
      }));
      const r = await f.verify({ payload: { paymentType: "spark", transferId: "tx-001" } }, req);
      expect(r.isValid).toBe(false);
    });

    it("should reject not found", async () => {
      const f = new SparkFacilitatorScheme(mockSigner());
      const r = await f.verify({ payload: { paymentType: "spark", transferId: "tx-missing" } }, req);
      expect(r.isValid).toBe(false);
    });

    it("should detect replay", async () => {
      const f = new SparkFacilitatorScheme(mockSigner({
        "tx-001": { id: "tx-001", amount: 1000, sender: "spark:sender", receiver: "spark:server123", status: TransferStatus.Completed },
      }));
      await f.verify({ payload: { paymentType: "spark", transferId: "tx-001" } }, req);
      const r = await f.verify({ payload: { paymentType: "spark", transferId: "tx-001" } }, req);
      expect(r.isValid).toBe(false);
      expect(r.invalidReason).toBe("replay_detected");
    });

    it("should reject missing transferId", async () => {
      const f = new SparkFacilitatorScheme(mockSigner());
      const r = await f.verify({ payload: { paymentType: "spark" } }, req);
      expect(r.isValid).toBe(false);
    });
  });

  describe("Lightning", () => {
    const preimage = Buffer.from("secret-preimage-32bytes-padding!");
    const hash = createHash("sha256").update(preimage).digest("hex");

    it("should verify valid preimage", async () => {
      const f = new SparkFacilitatorScheme(mockSigner());
      const r = await f.verify({
        payload: { paymentType: "lightning", preimage: preimage.toString("hex"), paymentHash: hash },
      }, req);
      expect(r.isValid).toBe(true);
    });

    it("should reject bad preimage", async () => {
      const f = new SparkFacilitatorScheme(mockSigner());
      const r = await f.verify({
        payload: { paymentType: "lightning", preimage: "aabbccdd", paymentHash: "0".repeat(64) },
      }, req);
      expect(r.isValid).toBe(false);
    });

    it("should reject missing proof", async () => {
      const f = new SparkFacilitatorScheme(mockSigner());
      const r = await f.verify({ payload: { paymentType: "lightning" } }, req);
      expect(r.isValid).toBe(false);
    });
  });

  describe("Settle", () => {
    it("should settle valid payment", async () => {
      const f = new SparkFacilitatorScheme(mockSigner({
        "tx-001": { id: "tx-001", amount: 1000, sender: "spark:sender", receiver: "spark:server123", status: TransferStatus.Completed },
      }));
      const r = await f.settle({ payload: { paymentType: "spark", transferId: "tx-001" } }, req);
      expect(r.success).toBe(true);
      expect(r.transaction).toBe("tx-001");
    });

    it("should fail settle on invalid payment", async () => {
      const f = new SparkFacilitatorScheme(mockSigner());
      const r = await f.settle({ payload: { paymentType: "spark", transferId: "tx-missing" } }, req);
      expect(r.success).toBe(false);
    });
  });

  it("should reject unsupported payment type", async () => {
    const f = new SparkFacilitatorScheme(mockSigner());
    const r = await f.verify({ payload: { paymentType: "l1" } }, req);
    expect(r.isValid).toBe(false);
  });
});
