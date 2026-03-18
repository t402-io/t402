package observability

import (
	"math/big"
	"strings"
	"sync"
	"testing"
	"time"
)

// --- Collector tests ---

func TestCollectorRecord(t *testing.T) {
	c := NewCollector(10)
	c.Record(PaymentEvent{Type: EventRequested, PaymentID: "p1"})
	if c.Len() != 1 {
		t.Fatalf("expected 1, got %d", c.Len())
	}
}

func TestCollectorRecordSetsTimestamp(t *testing.T) {
	c := NewCollector(10)
	c.Record(PaymentEvent{Type: EventRequested, PaymentID: "p1"})
	events := c.GetEvents(EventFilter{})
	if events[0].Timestamp.IsZero() {
		t.Error("expected timestamp to be set")
	}
}

func TestCollectorRecordPreservesTimestamp(t *testing.T) {
	c := NewCollector(10)
	ts := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	c.Record(PaymentEvent{Type: EventRequested, PaymentID: "p1", Timestamp: ts})
	events := c.GetEvents(EventFilter{})
	if !events[0].Timestamp.Equal(ts) {
		t.Errorf("expected %v, got %v", ts, events[0].Timestamp)
	}
}

func TestCollectorRingBufferOverflow(t *testing.T) {
	c := NewCollector(3)
	for i := 0; i < 5; i++ {
		c.Record(PaymentEvent{Type: EventRequested, PaymentID: string(rune('a' + i))})
	}
	if c.Len() != 3 {
		t.Fatalf("expected 3, got %d", c.Len())
	}
	events := c.GetEvents(EventFilter{})
	// Oldest two (a,b) should be evicted; remaining c,d,e
	if events[0].PaymentID != "c" {
		t.Errorf("expected oldest='c', got %q", events[0].PaymentID)
	}
	if events[2].PaymentID != "e" {
		t.Errorf("expected newest='e', got %q", events[2].PaymentID)
	}
}

func TestCollectorGetEventsFilterByType(t *testing.T) {
	c := NewCollector(10)
	c.Record(PaymentEvent{Type: EventRequested, PaymentID: "p1"})
	c.Record(PaymentEvent{Type: EventFailed, PaymentID: "p1", Error: "timeout"})
	c.Record(PaymentEvent{Type: EventRequested, PaymentID: "p2"})

	events := c.GetEvents(EventFilter{Type: EventFailed})
	if len(events) != 1 {
		t.Fatalf("expected 1, got %d", len(events))
	}
	if events[0].PaymentID != "p1" {
		t.Errorf("expected p1, got %s", events[0].PaymentID)
	}
}

func TestCollectorGetEventsFilterByPaymentID(t *testing.T) {
	c := NewCollector(10)
	c.Record(PaymentEvent{Type: EventRequested, PaymentID: "p1"})
	c.Record(PaymentEvent{Type: EventRequested, PaymentID: "p2"})

	events := c.GetEvents(EventFilter{PaymentID: "p2"})
	if len(events) != 1 {
		t.Fatalf("expected 1, got %d", len(events))
	}
}

func TestCollectorGetEventsFilterByNetwork(t *testing.T) {
	c := NewCollector(10)
	c.Record(PaymentEvent{Type: EventCompleted, PaymentID: "p1", Network: "eip155:8453"})
	c.Record(PaymentEvent{Type: EventCompleted, PaymentID: "p2", Network: "eip155:1"})

	events := c.GetEvents(EventFilter{Network: "eip155:1"})
	if len(events) != 1 || events[0].PaymentID != "p2" {
		t.Error("filter by network failed")
	}
}

func TestCollectorGetEventsFilterBySince(t *testing.T) {
	c := NewCollector(10)
	old := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	recent := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	c.Record(PaymentEvent{Type: EventRequested, PaymentID: "old", Timestamp: old})
	c.Record(PaymentEvent{Type: EventRequested, PaymentID: "new", Timestamp: recent})

	events := c.GetEvents(EventFilter{Since: time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)})
	if len(events) != 1 || events[0].PaymentID != "new" {
		t.Error("filter by Since failed")
	}
}

func TestCollectorGetEventsFilterLimit(t *testing.T) {
	c := NewCollector(10)
	for i := 0; i < 5; i++ {
		c.Record(PaymentEvent{Type: EventRequested, PaymentID: "p"})
	}
	events := c.GetEvents(EventFilter{Limit: 2})
	if len(events) != 2 {
		t.Fatalf("expected 2, got %d", len(events))
	}
}

func TestCollectorGetMetricsEmpty(t *testing.T) {
	c := NewCollector(10)
	m := c.GetMetrics()
	if m.TotalAttempted != 0 || m.TotalSuccessful != 0 || m.TotalFailed != 0 {
		t.Error("empty collector should have zero metrics")
	}
	if m.AvgVerifyLatencyMs != 0 || m.AvgSettleLatencyMs != 0 {
		t.Error("empty collector should have zero latencies")
	}
}

func TestCollectorGetMetrics(t *testing.T) {
	c := NewCollector(100)
	// Payment 1: success
	c.Record(PaymentEvent{Type: EventRequested, PaymentID: "p1"})
	c.Record(PaymentEvent{Type: EventVerified, PaymentID: "p1", DurationMs: 100})
	c.Record(PaymentEvent{Type: EventSettled, PaymentID: "p1", DurationMs: 200})
	c.Record(PaymentEvent{Type: EventCompleted, PaymentID: "p1", Network: "eip155:8453", Amount: "10000"})

	// Payment 2: failure
	c.Record(PaymentEvent{Type: EventRequested, PaymentID: "p2"})
	c.Record(PaymentEvent{Type: EventFailed, PaymentID: "p2", Error: "insufficient_funds"})

	m := c.GetMetrics()
	if m.TotalAttempted != 2 {
		t.Errorf("expected 2 attempted, got %d", m.TotalAttempted)
	}
	if m.TotalSuccessful != 1 {
		t.Errorf("expected 1 successful, got %d", m.TotalSuccessful)
	}
	if m.TotalFailed != 1 {
		t.Errorf("expected 1 failed, got %d", m.TotalFailed)
	}
	if m.AvgVerifyLatencyMs != 100 {
		t.Errorf("expected verify latency 100, got %.2f", m.AvgVerifyLatencyMs)
	}
	if m.AvgSettleLatencyMs != 200 {
		t.Errorf("expected settle latency 200, got %.2f", m.AvgSettleLatencyMs)
	}
	if m.AmountByNetwork["eip155:8453"].Cmp(big.NewInt(10000)) != 0 {
		t.Errorf("wrong amount: %s", m.AmountByNetwork["eip155:8453"])
	}
	if m.CountByNetwork["eip155:8453"] != 1 {
		t.Errorf("wrong count: %d", m.CountByNetwork["eip155:8453"])
	}
	if m.FailureReasons["insufficient_funds"] != 1 {
		t.Errorf("wrong failure reason count: %d", m.FailureReasons["insufficient_funds"])
	}
}

func TestCollectorClear(t *testing.T) {
	c := NewCollector(10)
	c.Record(PaymentEvent{Type: EventRequested, PaymentID: "p1"})
	c.Clear()
	if c.Len() != 0 {
		t.Fatalf("expected 0 after clear, got %d", c.Len())
	}
	events := c.GetEvents(EventFilter{})
	if len(events) != 0 {
		t.Error("expected no events after clear")
	}
}

func TestCollectorDefaultCapacity(t *testing.T) {
	c := NewCollector(0)
	if c.capacity != DefaultBufferSize {
		t.Errorf("expected %d, got %d", DefaultBufferSize, c.capacity)
	}
}

func TestCollectorConcurrency(t *testing.T) {
	c := NewCollector(100)
	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			c.Record(PaymentEvent{Type: EventRequested, PaymentID: "concurrent"})
		}()
	}
	wg.Wait()
	if c.Len() != 50 {
		t.Errorf("expected 50, got %d", c.Len())
	}
}

// --- Tracer tests ---

func TestTracerStartFlow(t *testing.T) {
	c := NewCollector(100)
	tr := NewTracer(c)
	if err := tr.StartFlow("pay1"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if tr.ActiveFlows() != 1 {
		t.Errorf("expected 1 active flow, got %d", tr.ActiveFlows())
	}
}

func TestTracerStartFlowDuplicate(t *testing.T) {
	tr := NewTracer(nil)
	_ = tr.StartFlow("pay1")
	if err := tr.StartFlow("pay1"); err == nil {
		t.Error("expected error for duplicate flow")
	}
}

func TestTracerStartFlowEmptyID(t *testing.T) {
	tr := NewTracer(nil)
	if err := tr.StartFlow(""); err == nil {
		t.Error("expected error for empty paymentID")
	}
}

func TestTracerRecordStep(t *testing.T) {
	c := NewCollector(100)
	tr := NewTracer(c)
	_ = tr.StartFlow("pay1")

	err := tr.RecordStep("pay1", EventVerified, PaymentEvent{
		Network:    "eip155:8453",
		DurationMs: 150,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	flow := tr.GetFlow("pay1")
	if len(flow.Events) != 2 { // StartFlow + RecordStep
		t.Errorf("expected 2 events, got %d", len(flow.Events))
	}
	if flow.Events[1].Type != EventVerified {
		t.Errorf("expected verified, got %s", flow.Events[1].Type)
	}
	if c.Len() != 2 {
		t.Errorf("expected 2 events in collector, got %d", c.Len())
	}
}

func TestTracerRecordStepMissingFlow(t *testing.T) {
	tr := NewTracer(nil)
	if err := tr.RecordStep("nonexistent", EventVerified, PaymentEvent{}); err == nil {
		t.Error("expected error for missing flow")
	}
}

func TestTracerRecordStepOnEndedFlow(t *testing.T) {
	tr := NewTracer(nil)
	_ = tr.StartFlow("pay1")
	_, _ = tr.EndFlow("pay1", true, "")
	if err := tr.RecordStep("pay1", EventVerified, PaymentEvent{}); err == nil {
		t.Error("expected error for ended flow")
	}
}

func TestTracerEndFlowSuccess(t *testing.T) {
	c := NewCollector(100)
	tr := NewTracer(c)
	_ = tr.StartFlow("pay1")
	time.Sleep(time.Millisecond) // ensure nonzero duration

	flow, err := tr.EndFlow("pay1", true, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !flow.Success {
		t.Error("expected success")
	}
	if flow.DurationMs() <= 0 {
		t.Error("expected positive duration")
	}
	if tr.ActiveFlows() != 0 {
		t.Errorf("expected 0 active flows, got %d", tr.ActiveFlows())
	}

	// Collector should have Requested + Completed
	events := c.GetEvents(EventFilter{Type: EventCompleted})
	if len(events) != 1 {
		t.Errorf("expected 1 completed event, got %d", len(events))
	}
}

func TestTracerEndFlowFailure(t *testing.T) {
	c := NewCollector(100)
	tr := NewTracer(c)
	_ = tr.StartFlow("pay1")

	flow, err := tr.EndFlow("pay1", false, "timeout")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if flow.Success {
		t.Error("expected failure")
	}
	if flow.Error != "timeout" {
		t.Errorf("expected 'timeout', got %q", flow.Error)
	}

	events := c.GetEvents(EventFilter{Type: EventFailed})
	if len(events) != 1 || events[0].Error != "timeout" {
		t.Error("failed event not recorded correctly")
	}
}

func TestTracerEndFlowMissing(t *testing.T) {
	tr := NewTracer(nil)
	if _, err := tr.EndFlow("nonexistent", true, ""); err == nil {
		t.Error("expected error for missing flow")
	}
}

func TestTracerEndFlowTwice(t *testing.T) {
	tr := NewTracer(nil)
	_ = tr.StartFlow("pay1")
	_, _ = tr.EndFlow("pay1", true, "")
	if _, err := tr.EndFlow("pay1", true, ""); err == nil {
		t.Error("expected error for double end")
	}
}

func TestTracerGetFlowNil(t *testing.T) {
	tr := NewTracer(nil)
	if flow := tr.GetFlow("nonexistent"); flow != nil {
		t.Error("expected nil")
	}
}

func TestTracerGetFlowCopy(t *testing.T) {
	tr := NewTracer(nil)
	_ = tr.StartFlow("pay1")
	flow := tr.GetFlow("pay1")
	flow.Events = append(flow.Events, PaymentEvent{Type: EventFailed})
	original := tr.GetFlow("pay1")
	if len(original.Events) != 1 {
		t.Error("GetFlow should return a copy")
	}
}

func TestTracerNilCollector(t *testing.T) {
	tr := NewTracer(nil)
	_ = tr.StartFlow("pay1")
	_ = tr.RecordStep("pay1", EventVerified, PaymentEvent{})
	_, err := tr.EndFlow("pay1", true, "")
	if err != nil {
		t.Fatalf("tracer with nil collector should work: %v", err)
	}
}

func TestTracerFullLifecycle(t *testing.T) {
	c := NewCollector(100)
	tr := NewTracer(c)

	_ = tr.StartFlow("full")
	_ = tr.RecordStep("full", EventRequirements, PaymentEvent{Network: "eip155:8453", Scheme: "exact"})
	_ = tr.RecordStep("full", EventSigned, PaymentEvent{Payer: "0xabc"})
	_ = tr.RecordStep("full", EventSubmitted, PaymentEvent{Transaction: "0xtx"})
	_ = tr.RecordStep("full", EventVerified, PaymentEvent{DurationMs: 50})
	_ = tr.RecordStep("full", EventSettled, PaymentEvent{DurationMs: 120})
	flow, _ := tr.EndFlow("full", true, "")

	if len(flow.Events) != 7 { // requested + 5 steps + completed
		t.Errorf("expected 7 events, got %d", len(flow.Events))
	}
	if c.Len() != 7 {
		t.Errorf("expected 7 in collector, got %d", c.Len())
	}
}

// --- Prometheus tests ---

func TestPrometheusMetricsFormat(t *testing.T) {
	m := PaymentMetrics{
		TotalAttempted:     5,
		TotalSuccessful:    3,
		TotalFailed:        2,
		AvgVerifyLatencyMs: 123.45,
		AvgSettleLatencyMs: 456.78,
		AmountByNetwork:    map[string]*big.Int{"eip155:8453": big.NewInt(50000)},
		CountByNetwork:     map[string]int{"eip155:8453": 3},
		FailureReasons:     map[string]int{"timeout": 1, "insufficient_funds": 1},
	}

	output := ToPrometheusMetrics(m)

	// Check HELP/TYPE for main counters
	if !strings.Contains(output, "# HELP t402_payments_attempted_total") {
		t.Error("missing HELP for attempted")
	}
	if !strings.Contains(output, "# TYPE t402_payments_attempted_total counter") {
		t.Error("missing TYPE for attempted")
	}
	if !strings.Contains(output, "t402_payments_attempted_total 5") {
		t.Error("wrong attempted value")
	}
	if !strings.Contains(output, "t402_payments_successful_total 3") {
		t.Error("wrong successful value")
	}
	if !strings.Contains(output, "t402_payments_failed_total 2") {
		t.Error("wrong failed value")
	}

	// Latencies
	if !strings.Contains(output, "t402_verify_latency_ms 123.45") {
		t.Error("wrong verify latency")
	}
	if !strings.Contains(output, "t402_settle_latency_ms 456.78") {
		t.Error("wrong settle latency")
	}

	// Network labels
	if !strings.Contains(output, `t402_payments_by_network{network="eip155:8453"} 3`) {
		t.Error("wrong network count")
	}
	if !strings.Contains(output, `t402_amount_by_network{network="eip155:8453"} 50000`) {
		t.Error("wrong network amount")
	}

	// Failure reasons
	if !strings.Contains(output, `t402_failure_reasons{reason="timeout"} 1`) {
		t.Error("missing timeout reason")
	}
	if !strings.Contains(output, `t402_failure_reasons{reason="insufficient_funds"} 1`) {
		t.Error("missing insufficient_funds reason")
	}
}

func TestPrometheusMetricsEmpty(t *testing.T) {
	m := PaymentMetrics{
		AmountByNetwork: map[string]*big.Int{},
		CountByNetwork:  map[string]int{},
		FailureReasons:  map[string]int{},
	}
	output := ToPrometheusMetrics(m)
	if !strings.Contains(output, "t402_payments_attempted_total 0") {
		t.Error("empty metrics should show 0")
	}
	// Should not contain per-network lines
	if strings.Contains(output, "t402_payments_by_network") {
		t.Error("empty metrics should not have network lines")
	}
}

func TestPrometheusMetricsMultipleNetworks(t *testing.T) {
	m := PaymentMetrics{
		AmountByNetwork: map[string]*big.Int{
			"eip155:1":    big.NewInt(100),
			"eip155:8453": big.NewInt(200),
		},
		CountByNetwork: map[string]int{
			"eip155:1":    1,
			"eip155:8453": 2,
		},
		FailureReasons: map[string]int{},
	}
	output := ToPrometheusMetrics(m)
	// Verify sorted order: eip155:1 before eip155:8453
	idx1 := strings.Index(output, `network="eip155:1"`)
	idx2 := strings.Index(output, `network="eip155:8453"`)
	if idx1 >= idx2 {
		t.Error("networks should be sorted alphabetically")
	}
}

// --- Type tests ---

func TestAllEventTypes(t *testing.T) {
	types := AllEventTypes()
	if len(types) != 8 {
		t.Errorf("expected 8 event types, got %d", len(types))
	}
}

func TestPaymentEventDefaults(t *testing.T) {
	ev := PaymentEvent{}
	if ev.Type != "" {
		t.Error("zero-value type should be empty")
	}
	if ev.Metadata != nil {
		t.Error("zero-value metadata should be nil")
	}
}

func TestFlowDurationMsZero(t *testing.T) {
	f := Flow{}
	if f.DurationMs() != 0 {
		t.Error("zero-value flow should have 0 duration")
	}
}

func TestEventFilterZeroValue(t *testing.T) {
	c := NewCollector(10)
	c.Record(PaymentEvent{Type: EventRequested, PaymentID: "p1"})
	events := c.GetEvents(EventFilter{})
	if len(events) != 1 {
		t.Error("zero-value filter should match everything")
	}
}
