import type { PaymentMetrics } from "./types";

/**
 * Escape a Prometheus label value.
 * Backslashes, double quotes, and newlines must be escaped.
 */
function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

/**
 * Format a single Prometheus metric line.
 */
function formatMetric(name: string, labels: Record<string, string>, value: number | bigint): string {
  const labelParts = Object.entries(labels)
    .map(([k, v]) => `${k}="${escapeLabelValue(v)}"`)
    .join(",");

  const labelStr = labelParts ? `{${labelParts}}` : "";
  return `${name}${labelStr} ${value}`;
}

/**
 * Convert PaymentMetrics to Prometheus text exposition format.
 *
 * Generates the following metric families:
 * - `t402_payments_total` — counter by status and network
 * - `t402_payment_duration_seconds` — gauge for average phase durations
 * - `t402_payment_amount_total` — counter for total amount by network (smallest unit)
 *
 * @param metrics - The payment metrics to format
 * @returns Prometheus text format string
 */
export function toPrometheusMetrics(metrics: PaymentMetrics): string {
  const lines: string[] = [];

  // t402_payments_total
  lines.push("# HELP t402_payments_total Total number of payment flows by status and network.");
  lines.push("# TYPE t402_payments_total counter");
  lines.push(formatMetric("t402_payments_total", { status: "attempted" }, metrics.totalAttempted));
  lines.push(formatMetric("t402_payments_total", { status: "successful" }, metrics.totalSuccessful));
  lines.push(formatMetric("t402_payments_total", { status: "failed" }, metrics.totalFailed));

  // Per-network counts
  for (const [network, count] of Object.entries(metrics.countByNetwork)) {
    lines.push(formatMetric("t402_payments_total", { status: "successful", network }, count));
  }

  // t402_payment_duration_seconds
  lines.push("");
  lines.push(
    "# HELP t402_payment_duration_seconds Average payment phase duration in seconds.",
  );
  lines.push("# TYPE t402_payment_duration_seconds gauge");
  lines.push(
    formatMetric(
      "t402_payment_duration_seconds",
      { phase: "verify" },
      metrics.avgVerifyLatencyMs / 1000,
    ),
  );
  lines.push(
    formatMetric(
      "t402_payment_duration_seconds",
      { phase: "settle" },
      metrics.avgSettleLatencyMs / 1000,
    ),
  );

  // t402_payment_amount_total
  lines.push("");
  lines.push(
    "# HELP t402_payment_amount_total Total payment amount in smallest unit by network.",
  );
  lines.push("# TYPE t402_payment_amount_total counter");
  for (const [network, amount] of Object.entries(metrics.amountByNetwork)) {
    lines.push(formatMetric("t402_payment_amount_total", { network }, amount));
  }

  // Failure reasons
  if (Object.keys(metrics.failureReasons).length > 0) {
    lines.push("");
    lines.push("# HELP t402_payment_failures_total Payment failures by reason.");
    lines.push("# TYPE t402_payment_failures_total counter");
    for (const [reason, count] of Object.entries(metrics.failureReasons)) {
      lines.push(formatMetric("t402_payment_failures_total", { reason }, count));
    }
  }

  return lines.join("\n") + "\n";
}
