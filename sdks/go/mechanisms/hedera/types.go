// Package hedera implements the Hedera payment mechanism for t402.
//
// Hedera uses Hashgraph consensus with a native Token Service (HTS).
// Network: hedera:mainnet, hedera:testnet
package hedera

const (
	SchemeExact    = "exact"
	NetworkMainnet = "hedera:mainnet"
	NetworkTestnet = "hedera:testnet"
)

// HederaPayload represents a Hedera payment proof.
type HederaPayload struct {
	// Signed transaction bytes
	Transaction string `json:"transaction"`
	// Transaction ID after submission
	TransactionID string `json:"transactionId,omitempty"`
	// Payer account ID (0.0.xxxxx format)
	Payer string `json:"payer"`
}

// HederaPayloadFromMap creates a HederaPayload from a map.
func HederaPayloadFromMap(data map[string]interface{}) (*HederaPayload, error) {
	p := &HederaPayload{}
	if v, ok := data["transaction"].(string); ok {
		p.Transaction = v
	}
	if v, ok := data["transactionId"].(string); ok {
		p.TransactionID = v
	}
	if v, ok := data["payer"].(string); ok {
		p.Payer = v
	}
	return p, nil
}

// ToMap converts to a map.
func (p *HederaPayload) ToMap() map[string]interface{} {
	m := map[string]interface{}{"payer": p.Payer}
	if p.Transaction != "" {
		m["transaction"] = p.Transaction
	}
	if p.TransactionID != "" {
		m["transactionId"] = p.TransactionID
	}
	return m
}

// Well-known USDC token IDs on Hedera
var USDCTokenIDs = map[string]string{
	NetworkMainnet: "0.0.456858", // Circle USDC on Hedera mainnet
}
