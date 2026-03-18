package observability

import (
	"fmt"
	"sync"
	"time"
)

// Flow represents an end-to-end payment flow comprising multiple events.
type Flow struct {
	PaymentID string
	StartTime time.Time
	EndTime   time.Time
	Events    []PaymentEvent
	Success   bool
	Error     string
}

// DurationMs returns the total flow duration in milliseconds, or 0 if incomplete.
func (f *Flow) DurationMs() int64 {
	if f.EndTime.IsZero() || f.StartTime.IsZero() {
		return 0
	}
	return f.EndTime.Sub(f.StartTime).Milliseconds()
}

// Tracer tracks payment flows across multiple steps and records events into a Collector.
type Tracer struct {
	mu        sync.RWMutex
	flows     map[string]*Flow
	collector *Collector
}

// NewTracer creates a Tracer backed by the given Collector.
// If collector is nil, events are tracked but not recorded to a Collector.
func NewTracer(collector *Collector) *Tracer {
	return &Tracer{
		flows:     make(map[string]*Flow),
		collector: collector,
	}
}

// StartFlow begins tracking a new payment flow.
// Returns an error if a flow with the same paymentID already exists.
func (t *Tracer) StartFlow(paymentID string) error {
	if paymentID == "" {
		return fmt.Errorf("observability: paymentID must not be empty")
	}

	t.mu.Lock()
	defer t.mu.Unlock()

	if _, exists := t.flows[paymentID]; exists {
		return fmt.Errorf("observability: flow %q already exists", paymentID)
	}

	now := time.Now()
	flow := &Flow{
		PaymentID: paymentID,
		StartTime: now,
	}
	t.flows[paymentID] = flow

	event := PaymentEvent{
		Type:      EventRequested,
		Timestamp: now,
		PaymentID: paymentID,
	}
	flow.Events = append(flow.Events, event)

	if t.collector != nil {
		t.collector.Record(event)
	}

	return nil
}

// RecordStep adds an intermediate event to an existing flow.
// Returns an error if the flow does not exist or has already ended.
func (t *Tracer) RecordStep(paymentID string, eventType PaymentEventType, data PaymentEvent) error {
	t.mu.Lock()
	defer t.mu.Unlock()

	flow, exists := t.flows[paymentID]
	if !exists {
		return fmt.Errorf("observability: flow %q not found", paymentID)
	}
	if !flow.EndTime.IsZero() {
		return fmt.Errorf("observability: flow %q already ended", paymentID)
	}

	data.Type = eventType
	data.PaymentID = paymentID
	if data.Timestamp.IsZero() {
		data.Timestamp = time.Now()
	}

	flow.Events = append(flow.Events, data)

	if t.collector != nil {
		t.collector.Record(data)
	}

	return nil
}

// EndFlow marks a payment flow as completed or failed.
// Returns the final flow state.
func (t *Tracer) EndFlow(paymentID string, success bool, errMsg string) (*Flow, error) {
	t.mu.Lock()
	defer t.mu.Unlock()

	flow, exists := t.flows[paymentID]
	if !exists {
		return nil, fmt.Errorf("observability: flow %q not found", paymentID)
	}
	if !flow.EndTime.IsZero() {
		return nil, fmt.Errorf("observability: flow %q already ended", paymentID)
	}

	now := time.Now()
	flow.EndTime = now
	flow.Success = success
	flow.Error = errMsg

	eventType := EventCompleted
	if !success {
		eventType = EventFailed
	}

	event := PaymentEvent{
		Type:       eventType,
		Timestamp:  now,
		PaymentID:  paymentID,
		DurationMs: flow.DurationMs(),
		Error:      errMsg,
	}
	flow.Events = append(flow.Events, event)

	if t.collector != nil {
		t.collector.Record(event)
	}

	return flow, nil
}

// GetFlow returns a copy of the flow for the given paymentID.
// Returns nil if the flow does not exist.
func (t *Tracer) GetFlow(paymentID string) *Flow {
	t.mu.RLock()
	defer t.mu.RUnlock()

	flow, exists := t.flows[paymentID]
	if !exists {
		return nil
	}

	// Return a copy to avoid races.
	cp := *flow
	cp.Events = make([]PaymentEvent, len(flow.Events))
	copy(cp.Events, flow.Events)
	return &cp
}

// ActiveFlows returns the number of flows that have not yet ended.
func (t *Tracer) ActiveFlows() int {
	t.mu.RLock()
	defer t.mu.RUnlock()

	count := 0
	for _, f := range t.flows {
		if f.EndTime.IsZero() {
			count++
		}
	}
	return count
}
