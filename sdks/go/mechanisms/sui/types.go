// Package sui implements the Sui payment mechanism for t402.
//
// Sui is a Move-based L1 with object-centric transaction model.
// Network: sui:mainnet, sui:testnet, sui:devnet
package sui

const (
	SchemeExact    = "exact"
	NetworkMainnet = "sui:mainnet"
	NetworkTestnet = "sui:testnet"
	NetworkDevnet  = "sui:devnet"
)

// SuiPayload represents a Sui payment proof.
type SuiPayload struct {
	// Signed transaction bytes (BCS-encoded)
	Transaction string `json:"transaction"`
	// Transaction digest after submission
	Digest string `json:"digest,omitempty"`
	// Sender address
	Sender string `json:"sender"`
}

// SuiPayloadFromMap creates a SuiPayload from a map.
func SuiPayloadFromMap(data map[string]interface{}) (*SuiPayload, error) {
	p := &SuiPayload{}
	if v, ok := data["transaction"].(string); ok {
		p.Transaction = v
	}
	if v, ok := data["digest"].(string); ok {
		p.Digest = v
	}
	if v, ok := data["sender"].(string); ok {
		p.Sender = v
	}
	return p, nil
}

// ToMap converts to a map.
func (p *SuiPayload) ToMap() map[string]interface{} {
	m := map[string]interface{}{"sender": p.Sender}
	if p.Transaction != "" {
		m["transaction"] = p.Transaction
	}
	if p.Digest != "" {
		m["digest"] = p.Digest
	}
	return m
}

// Well-known USDC addresses on Sui
var USDCAddresses = map[string]string{
	NetworkMainnet: "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN",
}
