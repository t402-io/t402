// Package algorand implements the Algorand payment mechanism for t402.
//
// Algorand uses Pure PoS with Algorand Standard Assets (ASA).
// Network: algorand:mainnet, algorand:testnet
package algorand

const (
	SchemeExact    = "exact"
	NetworkMainnet = "algorand:mainnet"
	NetworkTestnet = "algorand:testnet"
)

// AlgorandPayload represents an Algorand payment proof.
type AlgorandPayload struct {
	// Signed transaction bytes (msgpack-encoded)
	Transaction string `json:"transaction"`
	// Transaction ID after submission
	TxID string `json:"txId,omitempty"`
	// Sender address
	Sender string `json:"sender"`
}

// AlgorandPayloadFromMap creates an AlgorandPayload from a map.
func AlgorandPayloadFromMap(data map[string]interface{}) (*AlgorandPayload, error) {
	p := &AlgorandPayload{}
	if v, ok := data["transaction"].(string); ok {
		p.Transaction = v
	}
	if v, ok := data["txId"].(string); ok {
		p.TxID = v
	}
	if v, ok := data["sender"].(string); ok {
		p.Sender = v
	}
	return p, nil
}

// ToMap converts to a map.
func (p *AlgorandPayload) ToMap() map[string]interface{} {
	m := map[string]interface{}{"sender": p.Sender}
	if p.Transaction != "" {
		m["transaction"] = p.Transaction
	}
	if p.TxID != "" {
		m["txId"] = p.TxID
	}
	return m
}

// Well-known USDC ASA IDs on Algorand
var USDCAssetIDs = map[string]int64{
	NetworkMainnet: 31566704, // Circle USDC on Algorand mainnet
}
