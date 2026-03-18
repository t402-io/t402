// Package observability implements payment event tracking and analytics for AI agent payments.
//
// It provides a Collector for recording payment events in a thread-safe ring buffer,
// a Tracer for tracking end-to-end payment flows, and helpers for exporting metrics
// in Prometheus exposition format.
package observability

import (
	"math/big"
	"time"
)

// PaymentEventType identifies the type of payment lifecycle event.
type PaymentEventType string

const (
	EventRequested    PaymentEventType = "payment.requested"
	EventRequirements PaymentEventType = "payment.requirements"
	EventSigned       PaymentEventType = "payment.signed"
	EventSubmitted    PaymentEventType = "payment.submitted"
	EventVerified     PaymentEventType = "payment.verified"
	EventSettled      PaymentEventType = "payment.settled"
	EventCompleted    PaymentEventType = "payment.completed"
	EventFailed       PaymentEventType = "payment.failed"
)

// AllEventTypes returns all defined payment event types.
func AllEventTypes() []PaymentEventType {
	return []PaymentEventType{
		EventRequested, EventRequirements, EventSigned, EventSubmitted,
		EventVerified, EventSettled, EventCompleted, EventFailed,
	}
}

// PaymentEvent represents a single event in the payment lifecycle.
type PaymentEvent struct {
	Type        PaymentEventType       `json:"type"`
	Timestamp   time.Time              `json:"timestamp"`
	PaymentID   string                 `json:"paymentId"`
	Network     string                 `json:"network,omitempty"`
	Scheme      string                 `json:"scheme,omitempty"`
	Amount      string                 `json:"amount,omitempty"`
	Payer       string                 `json:"payer,omitempty"`
	PayTo       string                 `json:"payTo,omitempty"`
	Transaction string                 `json:"transaction,omitempty"`
	DurationMs  int64                  `json:"durationMs,omitempty"`
	Error       string                 `json:"error,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// PaymentMetrics aggregates statistics across recorded payment events.
type PaymentMetrics struct {
	TotalAttempted     int                `json:"totalAttempted"`
	TotalSuccessful    int                `json:"totalSuccessful"`
	TotalFailed        int                `json:"totalFailed"`
	AvgVerifyLatencyMs float64            `json:"avgVerifyLatencyMs"`
	AvgSettleLatencyMs float64            `json:"avgSettleLatencyMs"`
	AmountByNetwork    map[string]*big.Int `json:"amountByNetwork"`
	CountByNetwork     map[string]int     `json:"countByNetwork"`
	FailureReasons     map[string]int     `json:"failureReasons"`
}

// EventFilter specifies criteria for querying events.
type EventFilter struct {
	PaymentID string
	Type      PaymentEventType
	Network   string
	Since     time.Time
	Limit     int
}
