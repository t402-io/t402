import { describe, it, expect, beforeEach } from "vitest";

import { PaymentPolicyEngine } from "../src/engine";
import { withPolicy, PolicyViolationError } from "../src/middleware";
import type { PaymentPolicy, PolicyDecision } from "../src/types";

const BASE_REQ = {
  scheme: "exact",
  network: "eip155:8453",
  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  amount: "1000000",
  payTo: "0xRecipient1234567890abcdef1234567890abcdef",
};

function makeReq(overrides: Partial<typeof BASE_REQ> = {}) {
  return { ...BASE_REQ, ...overrides };
}

describe("PaymentPolicyEngine", () => {
  let now: number;
  let engine: PaymentPolicyEngine;

  function createEngine(policy: PaymentPolicy) {
    engine = new PaymentPolicyEngine(policy, { now: () => now });
    return engine;
  }

  beforeEach(() => {
    now = 1700000000000; // fixed timestamp
  });

  // ── maxAmountPerPayment ──────────────────────────────────────────

  describe("maxAmountPerPayment", () => {
    it("allows payment at exactly the limit", async () => {
      createEngine({ maxAmountPerPayment: "1000000" });
      const result = await engine.evaluate(makeReq({ amount: "1000000" }));
      expect(result.allowed).toBe(true);
    });

    it("rejects payment exceeding the limit", async () => {
      createEngine({ maxAmountPerPayment: "1000000" });
      const result = await engine.evaluate(makeReq({ amount: "1000001" }));
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toContain("max per payment");
      }
    });

    it("allows payment below the limit", async () => {
      createEngine({ maxAmountPerPayment: "1000000" });
      const result = await engine.evaluate(makeReq({ amount: "500000" }));
      expect(result.allowed).toBe(true);
    });

    it("handles very large amounts correctly", async () => {
      createEngine({ maxAmountPerPayment: "999999999999999999999" });
      const result = await engine.evaluate(makeReq({ amount: "999999999999999999999" }));
      expect(result.allowed).toBe(true);

      const result2 = await engine.evaluate(makeReq({ amount: "1000000000000000000000" }));
      expect(result2.allowed).toBe(false);
    });
  });

  // ── maxAmountPerSession ──────────────────────────────────────────

  describe("maxAmountPerSession", () => {
    it("allows first payment within session limit", async () => {
      createEngine({ maxAmountPerSession: "5000000" });
      const result = await engine.evaluate(makeReq({ amount: "3000000" }));
      expect(result.allowed).toBe(true);
    });

    it("rejects when cumulative amount would exceed session limit", async () => {
      createEngine({ maxAmountPerSession: "5000000" });
      engine.recordPayment("3000000");

      const result = await engine.evaluate(makeReq({ amount: "3000000" }));
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toContain("session amount");
      }
    });

    it("allows when cumulative amount exactly hits session limit", async () => {
      createEngine({ maxAmountPerSession: "5000000" });
      engine.recordPayment("3000000");

      const result = await engine.evaluate(makeReq({ amount: "2000000" }));
      expect(result.allowed).toBe(true);
    });

    it("tracks multiple payments cumulatively", async () => {
      createEngine({ maxAmountPerSession: "10000000" });
      engine.recordPayment("3000000");
      engine.recordPayment("3000000");
      engine.recordPayment("3000000");

      const result = await engine.evaluate(makeReq({ amount: "2000000" }));
      expect(result.allowed).toBe(false);
    });
  });

  // ── maxAmountPerDay ──────────────────────────────────────────────

  describe("maxAmountPerDay", () => {
    it("rejects when daily amount would be exceeded", async () => {
      createEngine({ maxAmountPerDay: "5000000" });
      engine.recordPayment("4000000");

      const result = await engine.evaluate(makeReq({ amount: "2000000" }));
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toContain("Daily amount");
      }
    });

    it("excludes payments older than 24 hours from daily total", async () => {
      createEngine({ maxAmountPerDay: "5000000" });

      // Record payment 25 hours ago
      now = 1700000000000;
      engine.recordPayment("4000000");

      // Move time forward 25 hours
      now = 1700000000000 + 25 * 60 * 60 * 1000;

      const result = await engine.evaluate(makeReq({ amount: "4000000" }));
      expect(result.allowed).toBe(true);
    });

    it("includes payments within the 24h window", async () => {
      createEngine({ maxAmountPerDay: "5000000" });

      // Record payment 23 hours ago
      now = 1700000000000;
      engine.recordPayment("4000000");

      // Move time forward 23 hours
      now = 1700000000000 + 23 * 60 * 60 * 1000;

      const result = await engine.evaluate(makeReq({ amount: "2000000" }));
      expect(result.allowed).toBe(false);
    });
  });

  // ── maxPaymentsPerHour ───────────────────────────────────────────

  describe("maxPaymentsPerHour", () => {
    it("allows payment when under the hourly limit", async () => {
      createEngine({ maxPaymentsPerHour: 3 });
      engine.recordPayment("1000");
      engine.recordPayment("1000");

      const result = await engine.evaluate(makeReq());
      expect(result.allowed).toBe(true);
    });

    it("rejects when hourly limit is reached", async () => {
      createEngine({ maxPaymentsPerHour: 3 });
      engine.recordPayment("1000");
      engine.recordPayment("1000");
      engine.recordPayment("1000");

      const result = await engine.evaluate(makeReq());
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toContain("Payments this hour");
      }
    });

    it("excludes payments older than 1 hour", async () => {
      createEngine({ maxPaymentsPerHour: 2 });

      now = 1700000000000;
      engine.recordPayment("1000");
      engine.recordPayment("1000");

      // Move forward 61 minutes
      now = 1700000000000 + 61 * 60 * 1000;

      const result = await engine.evaluate(makeReq());
      expect(result.allowed).toBe(true);
    });

    it("rejects when maxPaymentsPerHour is 0", async () => {
      createEngine({ maxPaymentsPerHour: 0 });
      const result = await engine.evaluate(makeReq());
      expect(result.allowed).toBe(false);
    });
  });

  // ── allowedRecipients ────────────────────────────────────────────

  describe("allowedRecipients", () => {
    it("allows payment to an allowed recipient", async () => {
      createEngine({ allowedRecipients: [BASE_REQ.payTo] });
      const result = await engine.evaluate(makeReq());
      expect(result.allowed).toBe(true);
    });

    it("rejects payment to a non-allowed recipient", async () => {
      createEngine({ allowedRecipients: ["0xAllowedAddress"] });
      const result = await engine.evaluate(makeReq());
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toContain("not in the allowed list");
      }
    });

    it("performs case-insensitive comparison", async () => {
      createEngine({ allowedRecipients: [BASE_REQ.payTo.toUpperCase()] });
      const result = await engine.evaluate(makeReq({ payTo: BASE_REQ.payTo.toLowerCase() }));
      expect(result.allowed).toBe(true);
    });

    it("does not restrict when allowedRecipients is empty array", async () => {
      createEngine({ allowedRecipients: [] });
      const result = await engine.evaluate(makeReq());
      expect(result.allowed).toBe(true);
    });
  });

  // ── blockedRecipients ────────────────────────────────────────────

  describe("blockedRecipients", () => {
    it("rejects payment to a blocked recipient", async () => {
      createEngine({ blockedRecipients: [BASE_REQ.payTo] });
      const result = await engine.evaluate(makeReq());
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toContain("blocked");
      }
    });

    it("allows payment to a non-blocked recipient", async () => {
      createEngine({ blockedRecipients: ["0xBlockedAddress"] });
      const result = await engine.evaluate(makeReq());
      expect(result.allowed).toBe(true);
    });

    it("performs case-insensitive comparison", async () => {
      createEngine({ blockedRecipients: [BASE_REQ.payTo.toUpperCase()] });
      const result = await engine.evaluate(makeReq({ payTo: BASE_REQ.payTo.toLowerCase() }));
      expect(result.allowed).toBe(false);
    });

    it("does not restrict when blockedRecipients is empty array", async () => {
      createEngine({ blockedRecipients: [] });
      const result = await engine.evaluate(makeReq());
      expect(result.allowed).toBe(true);
    });
  });

  // ── allowedNetworks ──────────────────────────────────────────────

  describe("allowedNetworks", () => {
    it("allows payment on an allowed network", async () => {
      createEngine({ allowedNetworks: ["eip155:8453", "eip155:1"] });
      const result = await engine.evaluate(makeReq({ network: "eip155:8453" }));
      expect(result.allowed).toBe(true);
    });

    it("rejects payment on a non-allowed network", async () => {
      createEngine({ allowedNetworks: ["eip155:1"] });
      const result = await engine.evaluate(makeReq({ network: "eip155:8453" }));
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toContain("Network");
        expect(result.reason).toContain("not in the allowed list");
      }
    });

    it("does not restrict when allowedNetworks is empty", async () => {
      createEngine({ allowedNetworks: [] });
      const result = await engine.evaluate(makeReq());
      expect(result.allowed).toBe(true);
    });
  });

  // ── allowedSchemes ───────────────────────────────────────────────

  describe("allowedSchemes", () => {
    it("allows payment with an allowed scheme", async () => {
      createEngine({ allowedSchemes: ["exact", "exact-legacy"] });
      const result = await engine.evaluate(makeReq({ scheme: "exact" }));
      expect(result.allowed).toBe(true);
    });

    it("rejects payment with a non-allowed scheme", async () => {
      createEngine({ allowedSchemes: ["exact-legacy"] });
      const result = await engine.evaluate(makeReq({ scheme: "exact" }));
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toContain("Scheme");
      }
    });
  });

  // ── allowedAssets ────────────────────────────────────────────────

  describe("allowedAssets", () => {
    it("allows payment with an allowed asset", async () => {
      createEngine({ allowedAssets: [BASE_REQ.asset] });
      const result = await engine.evaluate(makeReq());
      expect(result.allowed).toBe(true);
    });

    it("rejects payment with a non-allowed asset", async () => {
      createEngine({ allowedAssets: ["0xOtherAsset"] });
      const result = await engine.evaluate(makeReq());
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toContain("Asset");
      }
    });

    it("performs case-insensitive comparison", async () => {
      createEngine({ allowedAssets: [BASE_REQ.asset.toUpperCase()] });
      const result = await engine.evaluate(makeReq({ asset: BASE_REQ.asset.toLowerCase() }));
      expect(result.allowed).toBe(true);
    });
  });

  // ── Custom rules ─────────────────────────────────────────────────

  describe("custom rules", () => {
    it("allows when sync custom rule passes", async () => {
      createEngine({
        customRules: [
          {
            name: "always-allow",
            validate: () => ({ allowed: true }),
          },
        ],
      });
      const result = await engine.evaluate(makeReq());
      expect(result.allowed).toBe(true);
    });

    it("rejects when sync custom rule fails", async () => {
      createEngine({
        customRules: [
          {
            name: "always-deny",
            validate: () => ({ allowed: false, reason: "denied by custom rule" }),
          },
        ],
      });
      const result = await engine.evaluate(makeReq());
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toContain("always-deny");
        expect(result.reason).toContain("denied by custom rule");
      }
    });

    it("allows when async custom rule passes", async () => {
      createEngine({
        customRules: [
          {
            name: "async-allow",
            validate: async () => ({ allowed: true as const }),
          },
        ],
      });
      const result = await engine.evaluate(makeReq());
      expect(result.allowed).toBe(true);
    });

    it("rejects when async custom rule fails", async () => {
      createEngine({
        customRules: [
          {
            name: "async-deny",
            validate: async () => ({ allowed: false as const, reason: "async denied" }),
          },
        ],
      });
      const result = await engine.evaluate(makeReq());
      expect(result.allowed).toBe(false);
    });

    it("receives correct context in custom rule", async () => {
      let capturedContext: unknown;
      createEngine({
        customRules: [
          {
            name: "capture-context",
            validate: (ctx) => {
              capturedContext = ctx;
              return { allowed: true };
            },
          },
        ],
      });
      engine.recordPayment("500");
      await engine.evaluate(makeReq({ amount: "1000" }));

      const ctx = capturedContext as { requirements: typeof BASE_REQ; session: { totalAmountPaid: bigint } };
      expect(ctx.requirements.amount).toBe("1000");
      expect(ctx.session.totalAmountPaid).toBe(500n);
    });

    it("stops at first failing custom rule", async () => {
      const calls: string[] = [];
      createEngine({
        customRules: [
          {
            name: "rule-1",
            validate: () => {
              calls.push("rule-1");
              return { allowed: false, reason: "nope" };
            },
          },
          {
            name: "rule-2",
            validate: () => {
              calls.push("rule-2");
              return { allowed: true };
            },
          },
        ],
      });
      await engine.evaluate(makeReq());
      expect(calls).toEqual(["rule-1"]);
    });
  });

  // ── Multiple rules combined ──────────────────────────────────────

  describe("multiple rules combined", () => {
    it("checks all built-in rules in order — first failing wins", async () => {
      createEngine({
        maxAmountPerPayment: "500000",
        allowedNetworks: ["eip155:1"],
      });
      // Amount exceeds limit AND wrong network — amount check comes first
      const result = await engine.evaluate(makeReq({ amount: "600000", network: "eip155:8453" }));
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toContain("max per payment");
      }
    });

    it("checks built-in rules before custom rules", async () => {
      const customCalled: boolean[] = [];
      createEngine({
        maxAmountPerPayment: "100",
        customRules: [
          {
            name: "spy",
            validate: () => {
              customCalled.push(true);
              return { allowed: true };
            },
          },
        ],
      });
      await engine.evaluate(makeReq({ amount: "200" }));
      expect(customCalled).toEqual([]);
    });

    it("passes when all rules pass", async () => {
      createEngine({
        maxAmountPerPayment: "2000000",
        maxAmountPerSession: "10000000",
        maxPaymentsPerHour: 10,
        allowedNetworks: ["eip155:8453"],
        allowedSchemes: ["exact"],
        allowedRecipients: [BASE_REQ.payTo],
        customRules: [
          { name: "custom-pass", validate: () => ({ allowed: true }) },
        ],
      });
      const result = await engine.evaluate(makeReq());
      expect(result.allowed).toBe(true);
    });
  });

  // ── Session stats tracking ───────────────────────────────────────

  describe("session stats", () => {
    it("starts with zero stats", () => {
      createEngine({});
      const stats = engine.getStats();
      expect(stats.totalAmountPaid).toBe(0n);
      expect(stats.paymentCount).toBe(0);
      expect(stats.paymentsThisHour).toBe(0);
      expect(stats.amountPaidToday).toBe(0n);
      expect(stats.startTime).toBe(now);
    });

    it("updates after recording a payment", () => {
      createEngine({});
      engine.recordPayment("1000000");
      const stats = engine.getStats();
      expect(stats.totalAmountPaid).toBe(1000000n);
      expect(stats.paymentCount).toBe(1);
      expect(stats.paymentsThisHour).toBe(1);
      expect(stats.amountPaidToday).toBe(1000000n);
    });

    it("accumulates multiple payments", () => {
      createEngine({});
      engine.recordPayment("1000000");
      engine.recordPayment("2000000");
      engine.recordPayment("3000000");
      const stats = engine.getStats();
      expect(stats.totalAmountPaid).toBe(6000000n);
      expect(stats.paymentCount).toBe(3);
    });

    it("correctly computes rolling hourly window", () => {
      createEngine({});

      now = 1700000000000;
      engine.recordPayment("100");
      now = 1700000000000 + 30 * 60 * 1000; // +30 min
      engine.recordPayment("200");
      now = 1700000000000 + 70 * 60 * 1000; // +70 min (first payment is >1h ago)

      const stats = engine.getStats();
      expect(stats.paymentCount).toBe(2); // total stays
      expect(stats.paymentsThisHour).toBe(1); // only second payment in window
    });

    it("correctly computes rolling daily window", () => {
      createEngine({});

      now = 1700000000000;
      engine.recordPayment("100");
      now = 1700000000000 + 25 * 60 * 60 * 1000; // +25 hours

      const stats = engine.getStats();
      expect(stats.totalAmountPaid).toBe(100n); // total stays forever
      expect(stats.amountPaidToday).toBe(0n); // outside 24h window
    });
  });

  // ── Reset ────────────────────────────────────────────────────────

  describe("reset", () => {
    it("clears all session stats", () => {
      createEngine({});
      engine.recordPayment("1000000");
      engine.recordPayment("2000000");

      engine.reset();
      const stats = engine.getStats();
      expect(stats.totalAmountPaid).toBe(0n);
      expect(stats.paymentCount).toBe(0);
      expect(stats.paymentsThisHour).toBe(0);
      expect(stats.amountPaidToday).toBe(0n);
    });

    it("resets session start time", () => {
      now = 1700000000000;
      createEngine({});

      now = 1700001000000;
      engine.reset();

      const stats = engine.getStats();
      expect(stats.startTime).toBe(1700001000000);
    });

    it("allows payments again after reset", async () => {
      createEngine({ maxAmountPerSession: "1000000" });
      engine.recordPayment("1000000");

      const result1 = await engine.evaluate(makeReq({ amount: "1" }));
      expect(result1.allowed).toBe(false);

      engine.reset();

      const result2 = await engine.evaluate(makeReq({ amount: "1000000" }));
      expect(result2.allowed).toBe(true);
    });
  });

  // ── Empty policy ─────────────────────────────────────────────────

  describe("empty policy", () => {
    it("allows all payments when no rules are configured", async () => {
      createEngine({});
      const result = await engine.evaluate(makeReq());
      expect(result.allowed).toBe(true);
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles zero amount", async () => {
      createEngine({ maxAmountPerPayment: "0" });
      const result = await engine.evaluate(makeReq({ amount: "0" }));
      expect(result.allowed).toBe(true);
    });

    it("rejects amount of 1 when max is 0", async () => {
      createEngine({ maxAmountPerPayment: "0" });
      const result = await engine.evaluate(makeReq({ amount: "1" }));
      expect(result.allowed).toBe(false);
    });

    it("handles allowedRecipients and blockedRecipients together", async () => {
      // Recipient is in both allowed and blocked — allowed check passes, blocked check rejects
      const addr = "0xDualAddr";
      createEngine({
        allowedRecipients: [addr],
        blockedRecipients: [addr],
      });
      const result = await engine.evaluate(makeReq({ payTo: addr }));
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toContain("blocked");
      }
    });
  });
});

// ── Middleware tests ──────────────────────────────────────────────

describe("withPolicy middleware", () => {
  const MOCK_REQ = {
    ...BASE_REQ,
    maxTimeoutSeconds: 60,
    extra: {},
  };

  function mockClient(accepted = MOCK_REQ) {
    return {
      handlePaymentRequired: async (accepts: typeof MOCK_REQ[]) => ({
        accepted: accepts[0],
        payload: { signature: "0xabc" },
      }),
    };
  }

  it("passes allowed requirements to the underlying client", async () => {
    const client = mockClient();
    const wrapped = withPolicy(client, { allowedNetworks: ["eip155:8453"] });

    const result = await wrapped.handlePaymentRequired([MOCK_REQ]);
    expect(result.accepted.network).toBe("eip155:8453");
    expect(result.payload).toEqual({ signature: "0xabc" });
  });

  it("filters out disallowed requirements", async () => {
    const passedAccepts: typeof MOCK_REQ[][] = [];
    const client = {
      handlePaymentRequired: async (accepts: typeof MOCK_REQ[]) => {
        passedAccepts.push(accepts);
        return { accepted: accepts[0], payload: {} };
      },
    };

    const wrapped = withPolicy(client, { allowedNetworks: ["eip155:1"] });

    const req1 = { ...MOCK_REQ, network: "eip155:1" };
    const req2 = { ...MOCK_REQ, network: "eip155:8453" };

    await wrapped.handlePaymentRequired([req1, req2]);
    expect(passedAccepts[0]).toHaveLength(1);
    expect(passedAccepts[0][0].network).toBe("eip155:1");
  });

  it("throws PolicyViolationError when no options pass", async () => {
    const client = mockClient();
    const wrapped = withPolicy(client, { allowedNetworks: ["eip155:1"] });

    await expect(
      wrapped.handlePaymentRequired([MOCK_REQ]),
    ).rejects.toThrow(PolicyViolationError);
  });

  it("records payment in engine after successful payment", async () => {
    const client = mockClient();
    const wrapped = withPolicy(client, {});

    await wrapped.handlePaymentRequired([MOCK_REQ]);

    const stats = wrapped.policyEngine.getStats();
    expect(stats.paymentCount).toBe(1);
    expect(stats.totalAmountPaid).toBe(BigInt(MOCK_REQ.amount));
  });

  it("exposes policyEngine for stats and reset", async () => {
    const client = mockClient();
    const wrapped = withPolicy(client, { maxAmountPerSession: "10000000" });

    await wrapped.handlePaymentRequired([MOCK_REQ]);
    expect(wrapped.policyEngine.getStats().paymentCount).toBe(1);

    wrapped.policyEngine.reset();
    expect(wrapped.policyEngine.getStats().paymentCount).toBe(0);
  });

  it("error message includes rejection reasons", async () => {
    const client = mockClient();
    const wrapped = withPolicy(client, { maxAmountPerPayment: "1" });

    try {
      await wrapped.handlePaymentRequired([MOCK_REQ]);
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(PolicyViolationError);
      expect((e as Error).message).toContain("max per payment");
    }
  });
});
