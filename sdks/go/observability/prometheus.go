package observability

import (
	"fmt"
	"math/big"
	"sort"
	"strings"
)

// ToPrometheusMetrics formats PaymentMetrics as Prometheus text exposition format.
func ToPrometheusMetrics(m PaymentMetrics) string {
	var b strings.Builder

	// Counters
	writeHelp(&b, "t402_payments_attempted_total", "Total payment attempts")
	writeType(&b, "t402_payments_attempted_total", "counter")
	fmt.Fprintf(&b, "t402_payments_attempted_total %d\n", m.TotalAttempted)

	writeHelp(&b, "t402_payments_successful_total", "Total successful payments")
	writeType(&b, "t402_payments_successful_total", "counter")
	fmt.Fprintf(&b, "t402_payments_successful_total %d\n", m.TotalSuccessful)

	writeHelp(&b, "t402_payments_failed_total", "Total failed payments")
	writeType(&b, "t402_payments_failed_total", "counter")
	fmt.Fprintf(&b, "t402_payments_failed_total %d\n", m.TotalFailed)

	// Latencies
	writeHelp(&b, "t402_verify_latency_ms", "Average verification latency in milliseconds")
	writeType(&b, "t402_verify_latency_ms", "gauge")
	fmt.Fprintf(&b, "t402_verify_latency_ms %.2f\n", m.AvgVerifyLatencyMs)

	writeHelp(&b, "t402_settle_latency_ms", "Average settlement latency in milliseconds")
	writeType(&b, "t402_settle_latency_ms", "gauge")
	fmt.Fprintf(&b, "t402_settle_latency_ms %.2f\n", m.AvgSettleLatencyMs)

	// Per-network counts
	if len(m.CountByNetwork) > 0 {
		writeHelp(&b, "t402_payments_by_network", "Payment count by network")
		writeType(&b, "t402_payments_by_network", "gauge")
		for _, network := range sortedKeys(m.CountByNetwork) {
			fmt.Fprintf(&b, "t402_payments_by_network{network=%q} %d\n", network, m.CountByNetwork[network])
		}
	}

	// Per-network amounts
	if len(m.AmountByNetwork) > 0 {
		writeHelp(&b, "t402_amount_by_network", "Total payment amount by network (smallest unit)")
		writeType(&b, "t402_amount_by_network", "gauge")
		for _, network := range sortedBigIntKeys(m.AmountByNetwork) {
			fmt.Fprintf(&b, "t402_amount_by_network{network=%q} %s\n", network, m.AmountByNetwork[network].String())
		}
	}

	// Failure reasons
	if len(m.FailureReasons) > 0 {
		writeHelp(&b, "t402_failure_reasons", "Payment failure count by reason")
		writeType(&b, "t402_failure_reasons", "gauge")
		for _, reason := range sortedKeys(m.FailureReasons) {
			fmt.Fprintf(&b, "t402_failure_reasons{reason=%q} %d\n", reason, m.FailureReasons[reason])
		}
	}

	return b.String()
}

func writeHelp(b *strings.Builder, name, help string) {
	fmt.Fprintf(b, "# HELP %s %s\n", name, help)
}

func writeType(b *strings.Builder, name, metricType string) {
	fmt.Fprintf(b, "# TYPE %s %s\n", name, metricType)
}

func sortedKeys(m map[string]int) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

func sortedBigIntKeys(m map[string]*big.Int) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}
