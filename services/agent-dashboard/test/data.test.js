/**
 * Unit tests for data.js — deterministic data generators.
 */
import { describe, it, before } from "node:test";
import assert from "node:assert";
import {
  generatePaymentHistory,
  generateBalances,
  generateBudget,
  generateStats,
  generateAlerts,
  exportPaymentsCsv,
  generateGlobalNetworkStats,
  generateGlobalTrendData,
} from "../src/data.js";

describe("generatePaymentHistory", () => {
  it("returns non-empty array for any address", () => {
    const payments = generatePaymentHistory("0xTest");
    assert.ok(Array.isArray(payments));
    assert.ok(payments.length >= 15);
  });

  it("is deterministic — same address yields same output", () => {
    const a = generatePaymentHistory("0xABC");
    const b = generatePaymentHistory("0xABC");
    assert.strictEqual(a.length, b.length);
    assert.strictEqual(a[0].id, b[0].id);
    assert.strictEqual(a[0].txHash, b[0].txHash);
    assert.strictEqual(a[0].service, b[0].service);
    assert.strictEqual(a[0].amount, b[0].amount);
  });

  it("different addresses yield different output", () => {
    const a = generatePaymentHistory("0xAAA");
    const b = generatePaymentHistory("0xBBB");
    // Extremely unlikely to match
    assert.notStrictEqual(a[0].txHash, b[0].txHash);
  });

  it("returns sorted by timestamp descending", () => {
    const payments = generatePaymentHistory("0xSort");
    for (let i = 1; i < payments.length; i++) {
      assert.ok(new Date(payments[i - 1].timestamp) >= new Date(payments[i].timestamp));
    }
  });

  it("each payment has required fields", () => {
    const payments = generatePaymentHistory("0xFields");
    for (const p of payments) {
      assert.ok(p.id);
      assert.ok(p.txHash);
      assert.ok(p.network);
      assert.ok(p.networkLabel);
      assert.ok(p.token);
      assert.ok(p.amount);
      assert.ok(p.amountFormatted);
      assert.ok(p.to);
      assert.ok(p.service);
      assert.ok(["settled", "pending", "failed"].includes(p.status));
      assert.ok(p.timestamp);
    }
  });

  it("amounts are in realistic range ($0.01-$5.00)", () => {
    const payments = generatePaymentHistory("0xRange");
    for (const p of payments) {
      const raw = Number(p.amount);
      assert.ok(raw >= 10000, `amount ${raw} < 10000`);
      assert.ok(raw <= 5000000, `amount ${raw} > 5000000`);
    }
  });

  it("respects days parameter", () => {
    const payments1d = generatePaymentHistory("0xDays", 1);
    // baseTime is start of today (UTC), payments spread back `days` days from there
    const startOfToday = Math.floor(Date.now() / 86400000) * 86400000;
    for (const p of payments1d) {
      const ts = new Date(p.timestamp).getTime();
      assert.ok(ts <= startOfToday, "payment should not be after start of today");
      assert.ok(startOfToday - ts <= 86400 * 1000, "payment outside 1-day window from start of today");
    }
  });

  it("includes all supported networks across enough payments", () => {
    // Generate many payments to cover all networks
    const payments = generatePaymentHistory("0xNetworkCoverage", 30);
    const networks = new Set(payments.map((p) => p.network));
    assert.ok(networks.size >= 4, `Only ${networks.size} networks represented`);
  });
});

describe("generateBalances", () => {
  it("returns balances for all networks", () => {
    const { balances, totalUsd } = generateBalances("0xBal");
    assert.ok(balances.length >= 6); // At least 6 networks
    assert.ok(parseFloat(totalUsd) > 0);
  });

  it("is deterministic", () => {
    const a = generateBalances("0xBalDet");
    const b = generateBalances("0xBalDet");
    assert.strictEqual(a.totalUsd, b.totalUsd);
    assert.strictEqual(a.balances.length, b.balances.length);
    for (let i = 0; i < a.balances.length; i++) {
      assert.strictEqual(a.balances[i].balance, b.balances[i].balance);
    }
  });

  it("each balance has required fields", () => {
    const { balances } = generateBalances("0xBalFields");
    for (const b of balances) {
      assert.ok(b.network);
      assert.ok(b.networkLabel);
      assert.ok(b.token);
      assert.ok(b.balance);
      assert.ok(b.balanceFormatted);
    }
  });

  it("totalUsd matches sum of individual balances", () => {
    const { balances, totalUsd } = generateBalances("0xBalSum");
    const sum = balances.reduce((s, b) => s + Number(b.balance), 0);
    assert.strictEqual(totalUsd, (sum / 1e6).toFixed(2));
  });
});

describe("generateBudget", () => {
  it("returns policy and usage", () => {
    const budget = generateBudget("0xBudget");
    assert.ok(budget.policy);
    assert.ok(budget.usage);
    assert.ok(Array.isArray(budget.policy.allowedNetworks));
  });

  it("is deterministic", () => {
    const a = generateBudget("0xBudgetDet");
    const b = generateBudget("0xBudgetDet");
    assert.strictEqual(a.usage.sessionSpent, b.usage.sessionSpent);
    assert.strictEqual(a.usage.todaySpent, b.usage.todaySpent);
    assert.strictEqual(a.usage.sessionPercentage, b.usage.sessionPercentage);
  });

  it("percentages are calculated correctly", () => {
    const budget = generateBudget("0xBudgetPct");
    const sessionPct = (Number(budget.usage.sessionSpent) / Number(budget.usage.sessionLimit)) * 100;
    assert.strictEqual(budget.usage.sessionPercentage, +sessionPct.toFixed(1));
  });

  it("session can exceed 100% (by design)", () => {
    // The session uses maxPerSession * 1.1 as upper bound, so some addresses should exceed
    let found = false;
    for (let i = 0; i < 50; i++) {
      const b = generateBudget(`0xExceed${i}`);
      if (b.usage.sessionPercentage > 100) {
        found = true;
        break;
      }
    }
    assert.ok(found, "No address produced session > 100% in 50 attempts");
  });
});

describe("generateStats", () => {
  it("returns expected fields", () => {
    const stats = generateStats("0xStats");
    assert.ok(stats.period);
    assert.strictEqual(typeof stats.totalPayments, "number");
    assert.ok(stats.totalSpent);
    assert.ok(stats.totalSpentUsd);
    assert.ok(stats.avgPaymentSize);
    assert.ok(stats.avgPaymentUsd);
    assert.ok(Array.isArray(stats.topServices));
    assert.ok(stats.byNetwork);
  });

  it("is deterministic", () => {
    const a = generateStats("0xStatsDet");
    const b = generateStats("0xStatsDet");
    assert.strictEqual(a.totalPayments, b.totalPayments);
    assert.strictEqual(a.totalSpent, b.totalSpent);
  });

  it("accepts pre-computed payments", () => {
    const payments = generatePaymentHistory("0xStatsPre", 7);
    const stats = generateStats("0xStatsPre", 7, payments);
    assert.ok(stats.totalPayments > 0);
  });

  it("topServices has at most 5 entries", () => {
    const stats = generateStats("0xStatsTop");
    assert.ok(stats.topServices.length <= 5);
  });

  it("only counts settled payments", () => {
    const payments = generatePaymentHistory("0xStatsSettled", 7);
    const settled = payments.filter((p) => p.status === "settled");
    const stats = generateStats("0xStatsSettled", 7, payments);
    assert.strictEqual(stats.totalPayments, settled.length);
  });
});

describe("generateAlerts", () => {
  it("returns an array", () => {
    const alerts = generateAlerts("0xAlert");
    assert.ok(Array.isArray(alerts));
  });

  it("is deterministic within the same hour", () => {
    const a = generateAlerts("0xAlertDet");
    const b = generateAlerts("0xAlertDet");
    assert.strictEqual(a.length, b.length);
    for (let i = 0; i < a.length; i++) {
      assert.strictEqual(a[i].id, b[i].id);
      assert.strictEqual(a[i].level, b[i].level);
      assert.strictEqual(a[i].message, b[i].message);
      assert.strictEqual(a[i].timestamp, b[i].timestamp);
    }
  });

  it("alert levels are warning or critical", () => {
    // Test many addresses to find alerts
    for (let i = 0; i < 20; i++) {
      const alerts = generateAlerts(`0xAlertLevel${i}`);
      for (const a of alerts) {
        assert.ok(["warning", "critical"].includes(a.level));
        assert.ok(a.message);
        assert.ok(a.id);
        assert.strictEqual(typeof a.percentage, "number");
      }
    }
  });

  it("critical alerts have percentage >= 100", () => {
    for (let i = 0; i < 50; i++) {
      const alerts = generateAlerts(`0xCrit${i}`);
      for (const a of alerts) {
        if (a.level === "critical") {
          assert.ok(a.percentage >= 100, `Critical alert at ${a.percentage}%`);
        }
      }
    }
  });

  it("warning alerts have percentage between 80 and 100", () => {
    for (let i = 0; i < 50; i++) {
      const alerts = generateAlerts(`0xWarn${i}`);
      for (const a of alerts) {
        if (a.level === "warning") {
          assert.ok(a.percentage >= 80, `Warning alert at ${a.percentage}%`);
          assert.ok(a.percentage < 100, `Warning alert at ${a.percentage}% should be < 100`);
        }
      }
    }
  });
});

describe("exportPaymentsCsv", () => {
  it("returns valid CSV with header", () => {
    const csv = exportPaymentsCsv("0xCsv");
    const lines = csv.split("\n");
    assert.ok(lines.length > 1);
    assert.strictEqual(lines[0], "id,timestamp,service,network,token,amount,amount_formatted,to,txHash,status");
  });

  it("each data row has 10 columns", () => {
    const csv = exportPaymentsCsv("0xCsvCols");
    const lines = csv.split("\n");
    for (let i = 1; i < lines.length; i++) {
      // Simple split may not work perfectly with quoted fields, but our test data is clean
      const cols = lines[i].split(",");
      assert.ok(cols.length >= 10, `Row ${i}: expected >=10 columns, got ${cols.length}`);
    }
  });

  it("is deterministic", () => {
    const a = exportPaymentsCsv("0xCsvDet");
    const b = exportPaymentsCsv("0xCsvDet");
    assert.strictEqual(a, b);
  });
});

describe("csvField (from utils.js)", () => {
  // Import directly to test edge cases
  let csvField;
  before(async () => {
    const mod = await import("../src/utils.js");
    csvField = mod.csvField;
  });

  it("returns plain string unchanged", () => {
    assert.strictEqual(csvField("hello"), "hello");
  });

  it("quotes strings with commas", () => {
    assert.strictEqual(csvField("a,b"), '"a,b"');
  });

  it("escapes double quotes inside", () => {
    assert.strictEqual(csvField('say "hi"'), '"say ""hi"""');
  });

  it("quotes strings with newlines", () => {
    assert.ok(csvField("line1\nline2").startsWith('"'));
  });

  it("guards formula injection with = prefix", () => {
    const result = csvField("=SUM(A1:A10)");
    assert.ok(!result.startsWith("="), "Should not start with =");
    assert.ok(result.includes("'="), "Should prefix with single quote");
  });

  it("guards formula injection with + prefix", () => {
    assert.ok(csvField("+cmd").includes("'+"));
  });

  it("guards formula injection with - prefix", () => {
    assert.ok(csvField("-1+1").includes("'-"));
  });

  it("guards formula injection with @ prefix", () => {
    assert.ok(csvField("@SUM").includes("'@"));
  });

  it("handles empty string", () => {
    assert.strictEqual(csvField(""), "");
  });

  it("handles null/undefined via String coercion", () => {
    assert.strictEqual(csvField(null), "null");
    assert.strictEqual(csvField(undefined), "undefined");
  });

  it("handles numbers", () => {
    assert.strictEqual(csvField(42), "42");
  });
});

describe("escapeHtml (from utils.js)", () => {
  let escapeHtml;
  before(async () => {
    const mod = await import("../src/utils.js");
    escapeHtml = mod.escapeHtml;
  });

  it("escapes all five HTML special chars", () => {
    assert.strictEqual(escapeHtml('&<>"\''), "&amp;&lt;&gt;&quot;&#39;");
  });

  it("handles null input", () => {
    assert.strictEqual(escapeHtml(null), "");
  });

  it("handles undefined input", () => {
    assert.strictEqual(escapeHtml(undefined), "");
  });

  it("handles numeric input", () => {
    assert.strictEqual(escapeHtml(42), "42");
  });

  it("returns safe string unchanged", () => {
    assert.strictEqual(escapeHtml("hello world"), "hello world");
  });
});

describe("generateGlobalNetworkStats", () => {
  it("returns array with network distribution", () => {
    const stats = generateGlobalNetworkStats(7);
    assert.ok(Array.isArray(stats));
    assert.ok(stats.length > 0);
    const net = stats[0];
    assert.ok(net.network);
    assert.ok(net.networkLabel);
    assert.ok(net.volumeUsd);
    assert.strictEqual(typeof net.count, "number");
  });

  it("is deterministic", () => {
    const a = generateGlobalNetworkStats(7);
    const b = generateGlobalNetworkStats(7);
    assert.deepStrictEqual(a, b);
  });
});

describe("generateGlobalTrendData", () => {
  it("returns array with correct length", () => {
    const trend = generateGlobalTrendData(7);
    assert.strictEqual(trend.length, 7);
    const day = trend[0];
    assert.ok(day.date);
    assert.strictEqual(typeof day.count, "number");
    assert.ok(day.amountUsd);
  });

  it("is deterministic", () => {
    const a = generateGlobalTrendData(7);
    const b = generateGlobalTrendData(7);
    assert.deepStrictEqual(a, b);
  });
});
