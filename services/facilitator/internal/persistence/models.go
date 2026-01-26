// Package persistence provides database persistence for the facilitator service.
package persistence

import (
	"encoding/json"
	"time"
)

// SettlementStatus represents the status of a settlement
type SettlementStatus string

const (
	SettlementStatusPending   SettlementStatus = "pending"
	SettlementStatusConfirmed SettlementStatus = "confirmed"
	SettlementStatusFailed    SettlementStatus = "failed"
)

// Settlement represents a payment settlement record
type Settlement struct {
	ID           string           `json:"id" db:"id"`
	Network      string           `json:"network" db:"network"`
	Scheme       string           `json:"scheme" db:"scheme"`
	TxHash       string           `json:"txHash,omitempty" db:"tx_hash"`
	FromAddress  string           `json:"fromAddress" db:"from_address"`
	ToAddress    string           `json:"toAddress" db:"to_address"`
	Amount       string           `json:"amount" db:"amount"`
	Asset        string           `json:"asset" db:"asset"`
	Status       SettlementStatus `json:"status" db:"status"`
	CreatedAt    time.Time        `json:"createdAt" db:"created_at"`
	ConfirmedAt  *time.Time       `json:"confirmedAt,omitempty" db:"confirmed_at"`
	ErrorMessage string           `json:"errorMessage,omitempty" db:"error_message"`
	GasUsed      *int64           `json:"gasUsed,omitempty" db:"gas_used"`
	GasPrice     *int64           `json:"gasPrice,omitempty" db:"gas_price"`
	Metadata     json.RawMessage  `json:"metadata,omitempty" db:"metadata"`
}

// AuditAction represents the type of audit action
type AuditAction string

const (
	AuditActionVerify  AuditAction = "verify"
	AuditActionSettle  AuditAction = "settle"
	AuditActionError   AuditAction = "error"
	AuditActionHealth  AuditAction = "health"
	AuditActionSupport AuditAction = "supported"
)

// AuditEntry represents an audit log entry
type AuditEntry struct {
	ID           string          `json:"id" db:"id"`
	Timestamp    time.Time       `json:"timestamp" db:"timestamp"`
	Action       AuditAction     `json:"action" db:"action"`
	Network      string          `json:"network,omitempty" db:"network"`
	RequestID    string          `json:"requestId,omitempty" db:"request_id"`
	IPAddress    string          `json:"ipAddress,omitempty" db:"ip_address"`
	APIKeyID     string          `json:"apiKeyId,omitempty" db:"api_key_id"`
	RequestBody  json.RawMessage `json:"requestBody,omitempty" db:"request_body"`
	ResponseBody json.RawMessage `json:"responseBody,omitempty" db:"response_body"`
	DurationMs   int             `json:"durationMs" db:"duration_ms"`
	StatusCode   int             `json:"statusCode" db:"status_code"`
}

// AuditFilter defines filter criteria for querying audit logs
type AuditFilter struct {
	// Action filters by action type
	Action AuditAction
	// Network filters by network
	Network string
	// StartTime filters entries after this time
	StartTime *time.Time
	// EndTime filters entries before this time
	EndTime *time.Time
	// IPAddress filters by IP address
	IPAddress string
	// APIKeyID filters by API key
	APIKeyID string
	// Limit is the maximum number of entries to return
	Limit int
	// Offset is the number of entries to skip
	Offset int
}

// SettlementFilter defines filter criteria for querying settlements
type SettlementFilter struct {
	// Network filters by network
	Network string
	// Scheme filters by scheme
	Scheme string
	// Status filters by status
	Status SettlementStatus
	// FromAddress filters by sender address
	FromAddress string
	// ToAddress filters by recipient address
	ToAddress string
	// StartTime filters entries after this time
	StartTime *time.Time
	// EndTime filters entries before this time
	EndTime *time.Time
	// Limit is the maximum number of entries to return
	Limit int
	// Offset is the number of entries to skip
	Offset int
}
