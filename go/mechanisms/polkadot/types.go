package polkadot

import (
	"context"
	"regexp"
	"strings"
)

// ExactDirectPayload represents the payment payload for exact-direct scheme
type ExactDirectPayload struct {
	ExtrinsicHash  string `json:"extrinsicHash"`
	BlockHash      string `json:"blockHash"`
	ExtrinsicIndex int    `json:"extrinsicIndex"`
	From           string `json:"from"`
	To             string `json:"to"`
	Amount         string `json:"amount"`
	AssetID        int    `json:"assetId"`
}

// PayloadFromMap creates an ExactDirectPayload from a map
func PayloadFromMap(data map[string]interface{}) (*ExactDirectPayload, error) {
	payload := &ExactDirectPayload{}

	if extrinsicHash, ok := data["extrinsicHash"].(string); ok {
		payload.ExtrinsicHash = extrinsicHash
	}
	if blockHash, ok := data["blockHash"].(string); ok {
		payload.BlockHash = blockHash
	}
	if extrinsicIndex, ok := data["extrinsicIndex"].(float64); ok {
		payload.ExtrinsicIndex = int(extrinsicIndex)
	} else if extrinsicIndex, ok := data["extrinsicIndex"].(int); ok {
		payload.ExtrinsicIndex = extrinsicIndex
	}
	if from, ok := data["from"].(string); ok {
		payload.From = from
	}
	if to, ok := data["to"].(string); ok {
		payload.To = to
	}
	if amount, ok := data["amount"].(string); ok {
		payload.Amount = amount
	}
	if assetID, ok := data["assetId"].(float64); ok {
		payload.AssetID = int(assetID)
	} else if assetID, ok := data["assetId"].(int); ok {
		payload.AssetID = assetID
	}

	return payload, nil
}

// ToMap converts the payload to a map
func (p *ExactDirectPayload) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"extrinsicHash":  p.ExtrinsicHash,
		"blockHash":      p.BlockHash,
		"extrinsicIndex": p.ExtrinsicIndex,
		"from":           p.From,
		"to":             p.To,
		"amount":         p.Amount,
		"assetId":        p.AssetID,
	}
}

// FacilitatorPolkadotSigner defines the interface for Polkadot facilitator operations
type FacilitatorPolkadotSigner interface {
	// GetAddresses returns the facilitator's addresses
	GetAddresses(ctx context.Context, network string) []string

	// QueryExtrinsic queries an extrinsic by hash or block hash + index
	QueryExtrinsic(ctx context.Context, extrinsicHash string, blockHash string, extrinsicIndex int) (*ExtrinsicResult, error)

	// GetBalance gets the asset balance for an address
	GetBalance(ctx context.Context, assetID int, address string) (string, error)
}

// ExtrinsicResult represents the result of an extrinsic query
type ExtrinsicResult struct {
	ExtrinsicHash  string           `json:"extrinsic_hash"`
	BlockHash      string           `json:"block_hash"`
	BlockNumber    int64            `json:"block_num"`
	ExtrinsicIndex int              `json:"extrinsic_index"`
	Timestamp      string           `json:"block_timestamp"`
	Signer         string           `json:"account_id"`
	Success        bool             `json:"success"`
	Module         string           `json:"call_module"`
	Call           string           `json:"call_module_function"`
	Params         []ExtrinsicParam `json:"params"`
	Events         []ExtrinsicEvent `json:"event"`
}

// ExtrinsicParam represents a parameter in an extrinsic
type ExtrinsicParam struct {
	Name     string      `json:"name"`
	Type     string      `json:"type"`
	TypeName string      `json:"type_name"`
	Value    interface{} `json:"value"`
}

// ExtrinsicEvent represents an event emitted by an extrinsic
type ExtrinsicEvent struct {
	EventIndex string      `json:"event_index"`
	Module     string      `json:"module_id"`
	EventName  string      `json:"event_id"`
	Params     interface{} `json:"params"`
}

// ParsedAssetTransfer represents a parsed asset transfer
type ParsedAssetTransfer struct {
	AssetID int
	From    string
	To      string
	Amount  string
	Success bool
}

// ExtractAssetTransfer extracts asset transfer details from an extrinsic
func ExtractAssetTransfer(result *ExtrinsicResult) *ParsedAssetTransfer {
	if result == nil || !result.Success {
		return nil
	}

	// Check for assets module
	if result.Module != "Assets" && result.Module != "assets" {
		return nil
	}

	// Check for transfer call
	call := strings.ToLower(result.Call)
	if call != "transfer" && call != "transfer_keep_alive" {
		return nil
	}

	var assetID int
	var to string
	var amount string

	// Extract parameters
	for _, param := range result.Params {
		switch param.Name {
		case "id", "asset_id":
			if v, ok := param.Value.(float64); ok {
				assetID = int(v)
			}
		case "target", "dest":
			if v, ok := param.Value.(string); ok {
				to = v
			} else if m, ok := param.Value.(map[string]interface{}); ok {
				if id, ok := m["Id"].(string); ok {
					to = id
				}
			}
		case "amount":
			if v, ok := param.Value.(string); ok {
				amount = v
			} else if v, ok := param.Value.(float64); ok {
				amount = strings.TrimRight(strings.TrimRight(
					strings.Replace(
						strings.TrimLeft(strings.Replace(
							string(rune(int(v))),
							"e+", "e", 1),
							"0"),
						".", "", 1),
					"0"),
					".")
			}
		}
	}

	if assetID == 0 || to == "" || amount == "" {
		return nil
	}

	return &ParsedAssetTransfer{
		AssetID: assetID,
		From:    result.Signer,
		To:      to,
		Amount:  amount,
		Success: true,
	}
}

// IsValidAddress checks if an address is a valid Polkadot SS58 address
func IsValidAddress(address string) bool {
	if address == "" {
		return false
	}
	// Basic SS58 format check - base58 characters, typical length
	ss58Regex := regexp.MustCompile(`^[1-9A-HJ-NP-Za-km-z]{45,50}$`)
	return ss58Regex.MatchString(address)
}

// IsValidExtrinsicHash checks if a hash is valid (0x prefixed 64 char hex)
func IsValidExtrinsicHash(hash string) bool {
	if hash == "" {
		return false
	}
	hashRegex := regexp.MustCompile(`^0x[a-fA-F0-9]{64}$`)
	return hashRegex.MatchString(hash)
}

// IsValidBlockHash checks if a block hash is valid
func IsValidBlockHash(hash string) bool {
	return IsValidExtrinsicHash(hash)
}

// CompareAddresses compares two Polkadot addresses
func CompareAddresses(addr1, addr2 string) bool {
	return addr1 == addr2
}

// IsPolkadotNetwork checks if a network identifier is a Polkadot network
func IsPolkadotNetwork(network string) bool {
	return strings.HasPrefix(network, "polkadot:")
}
