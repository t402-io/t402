// Package erc20approvalgassponsor provides ERC-20 approve()-based gas sponsoring
// extension types and utilities for the t402 protocol. For tokens that do NOT
// support EIP-2612 permits, the client signs an offline approve() transaction
// and the facilitator broadcasts it on their behalf, paying gas fees.
package erc20approvalgassponsor

import (
	"encoding/json"
	"fmt"
	"math/big"
	"strings"
)

// ExtensionKey is the extension key for ERC-20 approval gas sponsoring in requirements/payload.
const ExtensionKey = "erc20ApprovalGasSponsoring"

// HeaderName is the HTTP header name for ERC-20 approval gas sponsor payload.
const HeaderName = "X-T402-ERC20-Approval-Gas-Sponsoring"

// ApproveFunctionSelector is the ERC-20 approve(address,uint256) function selector.
const ApproveFunctionSelector = "0x095ea7b3"

// ERC20ApprovalGasSponsorExtensionInfo represents the server-side gas sponsor declaration.
type ERC20ApprovalGasSponsorExtensionInfo struct {
	SponsoredNetworks  []string `json:"sponsoredNetworks"`
	MaxAmount          string   `json:"maxAmount"`
	SponsorAddress     string   `json:"sponsorAddress"`
	Permit2Address     string   `json:"permit2Address,omitempty"`
	RequiresAtomicBatch bool    `json:"requiresAtomicBatch"`
}

// ERC20ApprovalGasSponsorPayload represents the client-side gas sponsor response.
type ERC20ApprovalGasSponsorPayload struct {
	Network          string `json:"network"`
	From             string `json:"from"`
	Asset            string `json:"asset"`
	Amount           string `json:"amount"`
	SignedApprovalTx string `json:"signedApprovalTx"`
	ChainID          int    `json:"chainId"`
	Nonce            *int   `json:"nonce,omitempty"`
}

// ERC20ApprovalGasSponsorExtension is the full extension for requirements.
type ERC20ApprovalGasSponsorExtension struct {
	Info   ERC20ApprovalGasSponsorExtensionInfo `json:"info"`
	Schema map[string]interface{}               `json:"schema"`
}

// Option configures optional fields for DeclareERC20ApprovalGasSponsorExtension.
type Option func(*ERC20ApprovalGasSponsorExtensionInfo)

// WithPermit2Address sets a Permit2 proxy address.
func WithPermit2Address(address string) Option {
	return func(info *ERC20ApprovalGasSponsorExtensionInfo) {
		info.Permit2Address = address
	}
}

// WithAtomicBatch sets whether atomic batch execution is required.
func WithAtomicBatch(required bool) Option {
	return func(info *ERC20ApprovalGasSponsorExtensionInfo) {
		info.RequiresAtomicBatch = required
	}
}

// schema is the JSON Schema for ERC-20 approval gas sponsor payload validation.
var schema = map[string]interface{}{
	"type":     "object",
	"required": []string{"network", "from", "asset", "amount", "signedApprovalTx", "chainId"},
	"properties": map[string]interface{}{
		"network":          map[string]interface{}{"type": "string"},
		"from":             map[string]interface{}{"type": "string"},
		"asset":            map[string]interface{}{"type": "string"},
		"amount":           map[string]interface{}{"type": "string"},
		"signedApprovalTx": map[string]interface{}{"type": "string"},
		"chainId":          map[string]interface{}{"type": "number"},
		"nonce":            map[string]interface{}{"type": "number"},
	},
}

// DeclareERC20ApprovalGasSponsorExtension creates an ERC-20 approval gas sponsor extension for server responses.
func DeclareERC20ApprovalGasSponsorExtension(sponsoredNetworks []string, maxAmount, sponsorAddress string, opts ...Option) ERC20ApprovalGasSponsorExtension {
	info := ERC20ApprovalGasSponsorExtensionInfo{
		SponsoredNetworks:  sponsoredNetworks,
		MaxAmount:          maxAmount,
		SponsorAddress:     sponsorAddress,
		RequiresAtomicBatch: false,
	}

	for _, opt := range opts {
		opt(&info)
	}

	return ERC20ApprovalGasSponsorExtension{
		Info:   info,
		Schema: schema,
	}
}

// ParseERC20ApprovalGasSponsorPayload extracts an ERC-20 approval gas sponsor payload from extensions map.
func ParseERC20ApprovalGasSponsorPayload(extensions map[string]interface{}) (*ERC20ApprovalGasSponsorPayload, error) {
	raw, ok := extensions[ExtensionKey]
	if !ok {
		return nil, fmt.Errorf("missing %s extension", ExtensionKey)
	}

	data, err := json.Marshal(raw)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal erc20 approval gas sponsor extension: %w", err)
	}

	var payload ERC20ApprovalGasSponsorPayload
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, fmt.Errorf("failed to unmarshal erc20 approval gas sponsor payload: %w", err)
	}

	if payload.Network == "" || payload.From == "" || payload.SignedApprovalTx == "" {
		return nil, fmt.Errorf("invalid erc20 approval gas sponsor payload: missing required fields")
	}

	return &payload, nil
}

// ValidateERC20ApprovalGasSponsorPayload validates an ERC-20 approval gas sponsor payload against server extension info.
func ValidateERC20ApprovalGasSponsorPayload(payload *ERC20ApprovalGasSponsorPayload, info *ERC20ApprovalGasSponsorExtensionInfo) error {
	// Validate network is in sponsoredNetworks
	networkFound := false
	for _, n := range info.SponsoredNetworks {
		if n == payload.Network {
			networkFound = true
			break
		}
	}
	if !networkFound {
		return fmt.Errorf("network %s is not in sponsored networks: %v", payload.Network, info.SponsoredNetworks)
	}

	// Validate amount does not exceed maxAmount
	payloadAmount := new(big.Int)
	if _, ok := payloadAmount.SetString(payload.Amount, 10); !ok {
		return fmt.Errorf("invalid amount: %s", payload.Amount)
	}
	maxAmount := new(big.Int)
	if _, ok := maxAmount.SetString(info.MaxAmount, 10); !ok {
		return fmt.Errorf("invalid maxAmount: %s", info.MaxAmount)
	}
	if payloadAmount.Cmp(maxAmount) > 0 {
		return fmt.Errorf("amount %s exceeds maximum amount %s", payload.Amount, info.MaxAmount)
	}

	// Validate signedApprovalTx is non-empty hex
	txHex := strings.TrimPrefix(payload.SignedApprovalTx, "0x")
	if len(txHex) == 0 {
		return fmt.Errorf("signed approval transaction is empty")
	}
	for _, c := range txHex {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			return fmt.Errorf("signed approval transaction is not valid hex")
		}
	}

	// Validate from address format (40 hex chars)
	fromHex := strings.TrimPrefix(payload.From, "0x")
	if len(fromHex) != 40 {
		return fmt.Errorf("invalid from address: %s", payload.From)
	}
	for _, c := range fromHex {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			return fmt.Errorf("invalid from address: %s", payload.From)
		}
	}

	// Validate asset address format (40 hex chars)
	assetHex := strings.TrimPrefix(payload.Asset, "0x")
	if len(assetHex) != 40 {
		return fmt.Errorf("invalid asset address: %s", payload.Asset)
	}
	for _, c := range assetHex {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			return fmt.Errorf("invalid asset address: %s", payload.Asset)
		}
	}

	return nil
}

// ValidateERC20ApprovalGasSponsorPayloadWithChainID validates the payload with an expected chain ID.
func ValidateERC20ApprovalGasSponsorPayloadWithChainID(payload *ERC20ApprovalGasSponsorPayload, info *ERC20ApprovalGasSponsorExtensionInfo, expectedChainID int) error {
	if err := ValidateERC20ApprovalGasSponsorPayload(payload, info); err != nil {
		return err
	}

	if payload.ChainID != expectedChainID {
		return fmt.Errorf("chain ID %d does not match expected chain ID %d", payload.ChainID, expectedChainID)
	}

	return nil
}

// EncodeApproveCalldata encodes ERC-20 approve(address,uint256) calldata.
func EncodeApproveCalldata(spender string, amount string) string {
	spenderHex := strings.TrimPrefix(strings.ToLower(spender), "0x")
	paddedSpender := fmt.Sprintf("%064s", spenderHex)

	amountBig := new(big.Int)
	amountBig.SetString(amount, 10)
	amountHex := fmt.Sprintf("%064x", amountBig)

	return ApproveFunctionSelector + paddedSpender + amountHex
}

// DecodeApproveCalldata decodes approve() calldata to extract spender and amount.
// Returns empty strings if the calldata is not valid approve() data.
func DecodeApproveCalldata(calldata string) (spender string, amount string, ok bool) {
	hex := strings.TrimPrefix(calldata, "0x")

	// approve(address,uint256) = 4 byte selector + 32 byte address + 32 byte amount = 136 hex chars
	if len(hex) < 136 {
		return "", "", false
	}

	selector := "0x" + hex[:8]
	if selector != ApproveFunctionSelector {
		return "", "", false
	}

	// Extract spender address (last 20 bytes of the 32-byte word)
	spenderWord := hex[8:72]
	spender = "0x" + spenderWord[24:]

	// Extract amount
	amountHex := hex[72:136]
	amountBig := new(big.Int)
	amountBig.SetString(amountHex, 16)
	amount = amountBig.String()

	return spender, amount, true
}
