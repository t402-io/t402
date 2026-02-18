package permit2

// Permit2Address is the canonical Uniswap Permit2 contract address (same on all EVM chains)
const Permit2Address = "0x000000000022D473030F116dDEE9F6B43aC78BA3"

// SchemePermit2 is the scheme identifier for Permit2
const SchemePermit2 = "permit2"

// Permit2Payload represents the Permit2 payment payload
type Permit2Payload struct {
	Permit          PermitTransferFrom      `json:"permit"`
	TransferDetails SignatureTransferDetails `json:"transferDetails"`
	Signature       string                  `json:"signature"`
	Owner           string                  `json:"owner"`
}

// PermitTransferFrom represents the permit parameters
type PermitTransferFrom struct {
	Permitted TokenPermissions `json:"permitted"`
	Nonce     string           `json:"nonce"`
	Deadline  string           `json:"deadline"`
}

// TokenPermissions represents token and amount for the permit
type TokenPermissions struct {
	Token  string `json:"token"`
	Amount string `json:"amount"`
}

// SignatureTransferDetails represents transfer destination and amount
type SignatureTransferDetails struct {
	To              string `json:"to"`
	RequestedAmount string `json:"requestedAmount"`
}

// ToMap converts a Permit2Payload to a map for JSON marshaling
func (p *Permit2Payload) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"permit": map[string]interface{}{
			"permitted": map[string]interface{}{
				"token":  p.Permit.Permitted.Token,
				"amount": p.Permit.Permitted.Amount,
			},
			"nonce":    p.Permit.Nonce,
			"deadline": p.Permit.Deadline,
		},
		"transferDetails": map[string]interface{}{
			"to":              p.TransferDetails.To,
			"requestedAmount": p.TransferDetails.RequestedAmount,
		},
		"signature": p.Signature,
		"owner":     p.Owner,
	}
}

// PayloadFromMap creates a Permit2Payload from a map
func PayloadFromMap(data map[string]interface{}) (*Permit2Payload, error) {
	payload := &Permit2Payload{}

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

	if td, ok := data["transferDetails"].(map[string]interface{}); ok {
		if to, ok := td["to"].(string); ok {
			payload.TransferDetails.To = to
		}
		if ra, ok := td["requestedAmount"].(string); ok {
			payload.TransferDetails.RequestedAmount = ra
		}
	}

	return payload, nil
}
