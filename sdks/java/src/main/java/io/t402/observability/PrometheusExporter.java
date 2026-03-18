package io.t402.observability;

import java.math.BigInteger;
import java.util.Map;
import java.util.TreeMap;

/**
 * Exports {@link PaymentMetrics} in Prometheus text exposition format.
 */
public final class PrometheusExporter {

    private PrometheusExporter() {}

    public static String toPrometheusMetrics(PaymentMetrics m) {
        StringBuilder sb = new StringBuilder();

        sb.append("# HELP t402_payments_total Total payment attempts by status\n");
        sb.append("# TYPE t402_payments_total counter\n");
        sb.append("t402_payments_total{status=\"attempted\"} ").append(m.totalAttempted()).append('\n');
        sb.append("t402_payments_total{status=\"successful\"} ").append(m.totalSuccessful()).append('\n');
        sb.append("t402_payments_total{status=\"failed\"} ").append(m.totalFailed()).append('\n');

        sb.append("# HELP t402_payment_duration_seconds Average payment phase duration\n");
        sb.append("# TYPE t402_payment_duration_seconds gauge\n");
        sb.append(String.format("t402_payment_duration_seconds{phase=\"verify\"} %.6f%n", m.avgVerifyLatencyMs() / 1000));
        sb.append(String.format("t402_payment_duration_seconds{phase=\"settle\"} %.6f%n", m.avgSettleLatencyMs() / 1000));

        if (m.countByNetwork() != null && !m.countByNetwork().isEmpty()) {
            sb.append("# HELP t402_payments_by_network_total Payments by network\n");
            sb.append("# TYPE t402_payments_by_network_total counter\n");
            new TreeMap<>(m.countByNetwork()).forEach((net, count) ->
                sb.append("t402_payments_by_network_total{network=\"").append(net).append("\"} ").append(count).append('\n'));
        }

        if (m.amountByNetwork() != null && !m.amountByNetwork().isEmpty()) {
            sb.append("# HELP t402_payment_amount_total Total payment amount by network\n");
            sb.append("# TYPE t402_payment_amount_total counter\n");
            new TreeMap<>(m.amountByNetwork()).forEach((net, amt) ->
                sb.append("t402_payment_amount_total{network=\"").append(net).append("\"} ").append(amt).append('\n'));
        }

        if (m.failureReasons() != null && !m.failureReasons().isEmpty()) {
            sb.append("# HELP t402_payment_failures_total Payment failures by reason\n");
            sb.append("# TYPE t402_payment_failures_total counter\n");
            new TreeMap<>(m.failureReasons()).forEach((reason, count) ->
                sb.append("t402_payment_failures_total{reason=\"").append(reason).append("\"} ").append(count).append('\n'));
        }

        return sb.toString();
    }
}
