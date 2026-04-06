package permit2proxy

import (
	"github.com/t402-io/t402/sdks/go/mechanisms/evm/permit2"
)

// SchemePermit2Proxy is the scheme identifier for Permit2 Proxy
const SchemePermit2Proxy = "permit2-proxy"

// Contract addresses for T402 Permit2 Proxy contracts (TBD - not yet deployed)
// WARNING: These are zero addresses. The Permit2Proxy scheme will reject all
// requests until these are updated with deployed contract addresses.
const (
	ExactProxyAddress = "0x0000000000000000000000000000000000000000"
	UptoProxyAddress  = "0x0000000000000000000000000000000000000000"
)

// IsProxyDeployed returns false if proxy addresses are still zero (not deployed).
func IsProxyDeployed() bool {
	return ExactProxyAddress != "0x0000000000000000000000000000000000000000" ||
		UptoProxyAddress != "0x0000000000000000000000000000000000000000"
}

// WitnessTypeHash is the EIP-712 typehash for the Witness struct
// keccak256("Witness(address to,address facilitator,uint256 validAfter)")
const WitnessTypeHash = "Witness(address to,address facilitator,uint256 validAfter)"

// WitnessTypeString is the witness type string for Permit2's permitWitnessTransferFrom
// Format: "Witness witness)TokenPermissions(...)Witness(...)" - types listed alphabetically
const WitnessTypeString = "Witness witness)TokenPermissions(address token,uint256 amount)Witness(address to,address facilitator,uint256 validAfter)"

// T402Witness represents the witness data bound into the payer's EIP-712 signature
type T402Witness struct {
	To          string `json:"to"`
	Facilitator string `json:"facilitator"`
	ValidAfter  string `json:"validAfter"`
}

// Permit2ProxyPayload represents the Permit2 Proxy payment payload
type Permit2ProxyPayload struct {
	Permit    permit2.PermitTransferFrom `json:"permit"`
	Witness   T402Witness                `json:"witness"`
	Signature string                     `json:"signature"`
	Owner     string                     `json:"owner"`
}

// ToMap converts a Permit2ProxyPayload to a map for JSON marshaling
func (p *Permit2ProxyPayload) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"permit": map[string]interface{}{
			"permitted": map[string]interface{}{
				"token":  p.Permit.Permitted.Token,
				"amount": p.Permit.Permitted.Amount,
			},
			"nonce":    p.Permit.Nonce,
			"deadline": p.Permit.Deadline,
		},
		"witness": map[string]interface{}{
			"to":          p.Witness.To,
			"facilitator": p.Witness.Facilitator,
			"validAfter":  p.Witness.ValidAfter,
		},
		"signature": p.Signature,
		"owner":     p.Owner,
	}
}

// PayloadFromMap creates a Permit2ProxyPayload from a map
func PayloadFromMap(data map[string]interface{}) (*Permit2ProxyPayload, error) {
	payload := &Permit2ProxyPayload{}

	if sig, ok := data["signature"].(string); ok {
		payload.Signature = sig
	}
	if owner, ok := data["owner"].(string); ok {
		payload.Owner = owner
	}

	if permit, ok := data["permit"].(map[string]interface{}); ok {
		if permitted, ok := permit["permitted"].(map[string]interface{}); ok {
			if token, ok := permitted["token"].(string); ok {
				payload.Permit.Permitted.Token = token
			}
			if amount, ok := permitted["amount"].(string); ok {
				payload.Permit.Permitted.Amount = amount
			}
		}
		if nonce, ok := permit["nonce"].(string); ok {
			payload.Permit.Nonce = nonce
		}
		if deadline, ok := permit["deadline"].(string); ok {
			payload.Permit.Deadline = deadline
		}
	}

	if witness, ok := data["witness"].(map[string]interface{}); ok {
		if to, ok := witness["to"].(string); ok {
			payload.Witness.To = to
		}
		if facilitator, ok := witness["facilitator"].(string); ok {
			payload.Witness.Facilitator = facilitator
		}
		if validAfter, ok := witness["validAfter"].(string); ok {
			payload.Witness.ValidAfter = validAfter
		}
	}

	return payload, nil
}
