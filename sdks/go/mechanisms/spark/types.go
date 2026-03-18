// Package spark implements the Spark (Bitcoin L2) payment mechanism for t402.
//
// Spark is a Bitcoin L2 with instant transfers. This mechanism enables
// machine-to-machine payments over HTTP using Spark as the settlement layer.
//
// Supported payment types:
//   - SPARK: Direct Spark transfer, verified by transfer_id lookup
//   - LIGHTNING: Lightning Network payment routed through Spark,
//     verified by SHA256(preimage) === payment_hash
//
// Network identifier: spark:mainnet
package spark

// Scheme identifiers
const (
	SchemeExact = "exact"

	// CAIP-2 network identifiers
	NetworkMainnet = "spark:mainnet"
	NetworkTestnet = "spark:testnet"

	// Payment types
	PaymentTypeSpark    = "spark"
	PaymentTypeLightning = "lightning"
)

// SparkPayload represents a Spark payment proof.
type SparkPayload struct {
	// Type of payment: "spark" or "lightning"
	PaymentType string `json:"paymentType"`
	// Transfer ID (for Spark transfers)
	TransferID string `json:"transferId,omitempty"`
	// Lightning preimage (for Lightning payments)
	Preimage string `json:"preimage,omitempty"`
	// Lightning payment hash (for verification)
	PaymentHash string `json:"paymentHash,omitempty"`
}

// SparkPayloadFromMap creates a SparkPayload from a map.
func SparkPayloadFromMap(data map[string]interface{}) (*SparkPayload, error) {
	payload := &SparkPayload{}

	if pt, ok := data["paymentType"].(string); ok {
		payload.PaymentType = pt
	}
	if tid, ok := data["transferId"].(string); ok {
		payload.TransferID = tid
	}
	if pi, ok := data["preimage"].(string); ok {
		payload.Preimage = pi
	}
	if ph, ok := data["paymentHash"].(string); ok {
		payload.PaymentHash = ph
	}

	return payload, nil
}

// ToMap converts a SparkPayload to a map.
func (p *SparkPayload) ToMap() map[string]interface{} {
	m := map[string]interface{}{
		"paymentType": p.PaymentType,
	}
	if p.TransferID != "" {
		m["transferId"] = p.TransferID
	}
	if p.Preimage != "" {
		m["preimage"] = p.Preimage
	}
	if p.PaymentHash != "" {
		m["paymentHash"] = p.PaymentHash
	}
	return m
}

// SparkRequirementsExtra contains Spark-specific extra fields.
type SparkRequirementsExtra struct {
	// Server's Spark address
	SparkAddress string `json:"sparkAddress"`
	// Lightning invoice (BOLT11)
	LightningInvoice string `json:"lightningInvoice,omitempty"`
	// Unique payment ID for correlation
	PaymentID string `json:"paymentId"`
}

// SparkSigner defines the interface for Spark facilitator operations.
type SparkSigner interface {
	// GetTransfer looks up a Spark transfer by ID.
	// Returns the transfer details or error if not found.
	GetTransfer(transferID string) (*TransferInfo, error)

	// GetAddress returns the facilitator's Spark address.
	GetAddress() string
}

// TransferInfo contains details of a Spark transfer.
type TransferInfo struct {
	ID        string
	Amount    int64  // satoshis
	Sender    string
	Receiver  string
	Status    TransferStatus
}

// TransferStatus represents the state of a Spark transfer.
type TransferStatus int

const (
	TransferPending   TransferStatus = 0
	TransferCompleted TransferStatus = 5
	TransferFailed    TransferStatus = 9
)
