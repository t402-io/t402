package streaming

import (
	"time"
)

// StreamStatus represents the current status of a payment stream
type StreamStatus string

const (
	StreamStatusPending   StreamStatus = "pending"   // Stream created, awaiting deposit
	StreamStatusActive    StreamStatus = "active"    // Stream is active and accepting updates
	StreamStatusPaused    StreamStatus = "paused"    // Stream is temporarily paused
	StreamStatusClosing   StreamStatus = "closing"   // Stream is being closed
	StreamStatusClosed    StreamStatus = "closed"    // Stream has been closed and settled
	StreamStatusCancelled StreamStatus = "cancelled" // Stream was cancelled before activation
	StreamStatusExpired   StreamStatus = "expired"   // Stream expired without being closed
)

// Stream represents a payment stream/channel
type Stream struct {
	ID              string       `json:"id"`
	Network         string       `json:"network"`          // CAIP-2 network identifier
	Scheme          string       `json:"scheme"`           // Payment scheme (exact, upto)
	Payer           string       `json:"payer"`            // Payer address
	Payee           string       `json:"payee"`            // Payee address
	Asset           string       `json:"asset"`            // Asset address
	MaxAmount       string       `json:"maxAmount"`        // Maximum authorized amount
	CurrentAmount   string       `json:"currentAmount"`    // Current streamed amount
	SettledAmount   string       `json:"settledAmount"`    // Amount already settled on-chain
	RatePerSecond   string       `json:"ratePerSecond"`    // Rate of streaming (optional, for time-based)
	Status          StreamStatus `json:"status"`           // Current status
	CreatedAt       time.Time    `json:"createdAt"`        // Creation timestamp
	ActivatedAt     *time.Time   `json:"activatedAt"`      // Activation timestamp
	LastUpdatedAt   time.Time    `json:"lastUpdatedAt"`    // Last update timestamp
	ExpiresAt       *time.Time   `json:"expiresAt"`        // Expiration timestamp
	ClosedAt        *time.Time   `json:"closedAt"`         // Closure timestamp
	DepositTxHash   string       `json:"depositTxHash"`    // Initial deposit transaction
	SettlementTxHash string      `json:"settlementTxHash"` // Final settlement transaction
	Metadata        Metadata     `json:"metadata"`         // Additional metadata
}

// Metadata holds optional stream metadata
type Metadata struct {
	ResourceID  string            `json:"resourceId,omitempty"`  // Associated resource
	Description string            `json:"description,omitempty"` // Stream description
	Tags        []string          `json:"tags,omitempty"`        // Tags for categorization
	Extra       map[string]string `json:"extra,omitempty"`       // Custom key-value pairs
}

// StreamUpdate represents an update to a stream
type StreamUpdate struct {
	ID            string    `json:"id"`
	StreamID      string    `json:"streamId"`
	Amount        string    `json:"amount"`        // New cumulative amount
	Signature     string    `json:"signature"`     // Payer signature for this update
	Timestamp     time.Time `json:"timestamp"`     // Update timestamp
	SequenceNum   uint64    `json:"sequenceNum"`   // Sequence number for ordering
	ResourceUnits int64     `json:"resourceUnits"` // Units consumed (optional)
}

// OpenStreamRequest is the request to open a new stream
type OpenStreamRequest struct {
	Network       string    `json:"network" binding:"required"`       // CAIP-2 network
	Scheme        string    `json:"scheme" binding:"required"`        // Payment scheme
	Payer         string    `json:"payer" binding:"required"`         // Payer address
	Payee         string    `json:"payee" binding:"required"`         // Payee address
	Asset         string    `json:"asset" binding:"required"`         // Asset address
	MaxAmount     string    `json:"maxAmount" binding:"required"`     // Maximum amount
	RatePerSecond string    `json:"ratePerSecond,omitempty"`          // Optional rate
	ExpiresAt     *time.Time `json:"expiresAt,omitempty"`             // Optional expiration
	Signature     string    `json:"signature" binding:"required"`     // Payer signature
	Metadata      *Metadata `json:"metadata,omitempty"`               // Optional metadata
}

// OpenStreamResponse is the response after opening a stream
type OpenStreamResponse struct {
	Stream        *Stream `json:"stream"`
	DepositAmount string  `json:"depositAmount,omitempty"` // Required deposit (if any)
	DepositTo     string  `json:"depositTo,omitempty"`     // Deposit address
}

// UpdateStreamRequest is the request to update a stream
type UpdateStreamRequest struct {
	StreamID      string `json:"streamId" binding:"required"`      // Stream ID
	Amount        string `json:"amount" binding:"required"`        // New cumulative amount
	Signature     string `json:"signature" binding:"required"`     // Payer signature
	ResourceUnits int64  `json:"resourceUnits,omitempty"`          // Units consumed
}

// UpdateStreamResponse is the response after updating a stream
type UpdateStreamResponse struct {
	Stream      *Stream       `json:"stream"`
	Update      *StreamUpdate `json:"update"`
	Remaining   string        `json:"remaining"`   // Remaining authorized amount
	CanContinue bool          `json:"canContinue"` // Whether stream can continue
}

// CloseStreamRequest is the request to close a stream
type CloseStreamRequest struct {
	StreamID      string `json:"streamId" binding:"required"`      // Stream ID
	FinalAmount   string `json:"finalAmount" binding:"required"`   // Final amount to settle
	PayerSignature string `json:"payerSignature" binding:"required"` // Payer signature
	PayeeSignature string `json:"payeeSignature,omitempty"`        // Payee signature (optional)
	Reason        string `json:"reason,omitempty"`                 // Closure reason
}

// CloseStreamResponse is the response after closing a stream
type CloseStreamResponse struct {
	Stream        *Stream `json:"stream"`
	SettledAmount string  `json:"settledAmount"` // Amount settled on-chain
	TxHash        string  `json:"txHash"`        // Settlement transaction hash
	RefundAmount  string  `json:"refundAmount"`  // Amount refunded to payer (if any)
}

// GetStreamResponse is the response for getting stream details
type GetStreamResponse struct {
	Stream   *Stream         `json:"stream"`
	Updates  []*StreamUpdate `json:"updates,omitempty"`  // Recent updates
	Stats    *StreamStats    `json:"stats,omitempty"`    // Stream statistics
}

// StreamStats contains statistics about a stream
type StreamStats struct {
	TotalUpdates     int64   `json:"totalUpdates"`     // Total number of updates
	AverageRate      string  `json:"averageRate"`      // Average streaming rate
	Duration         int64   `json:"duration"`         // Duration in seconds
	ResourcesUsed    int64   `json:"resourcesUsed"`    // Total resources consumed
	EfficiencyScore  float64 `json:"efficiencyScore"`  // Usage efficiency (0-1)
}

// ListStreamsRequest is the request to list streams
type ListStreamsRequest struct {
	Network   string         `form:"network"`   // Filter by network
	Payer     string         `form:"payer"`     // Filter by payer
	Payee     string         `form:"payee"`     // Filter by payee
	Status    []StreamStatus `form:"status"`    // Filter by status
	Limit     int            `form:"limit"`     // Max results
	Offset    int            `form:"offset"`    // Offset for pagination
	OrderBy   string         `form:"orderBy"`   // Order by field
	OrderDesc bool           `form:"orderDesc"` // Descending order
}

// ListStreamsResponse is the response for listing streams
type ListStreamsResponse struct {
	Streams    []*Stream `json:"streams"`
	Total      int64     `json:"total"`
	Limit      int       `json:"limit"`
	Offset     int       `json:"offset"`
	HasMore    bool      `json:"hasMore"`
}

// StreamEvent represents an event in the stream lifecycle
type StreamEvent struct {
	ID        string          `json:"id"`
	StreamID  string          `json:"streamId"`
	Type      StreamEventType `json:"type"`
	Data      interface{}     `json:"data,omitempty"`
	Timestamp time.Time       `json:"timestamp"`
}

// StreamEventType represents the type of stream event
type StreamEventType string

const (
	StreamEventOpened    StreamEventType = "opened"
	StreamEventActivated StreamEventType = "activated"
	StreamEventUpdated   StreamEventType = "updated"
	StreamEventPaused    StreamEventType = "paused"
	StreamEventResumed   StreamEventType = "resumed"
	StreamEventClosing   StreamEventType = "closing"
	StreamEventClosed    StreamEventType = "closed"
	StreamEventCancelled StreamEventType = "cancelled"
	StreamEventExpired   StreamEventType = "expired"
	StreamEventError     StreamEventType = "error"
)
