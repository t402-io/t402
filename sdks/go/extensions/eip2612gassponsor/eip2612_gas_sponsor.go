// Package eip2612gassponsor provides EIP-2612 permit-based gas sponsoring extension
// types and utilities for the t402 protocol. It allows facilitators to sponsor
// gas fees by having clients sign off-chain permits instead of submitting
// on-chain approval transactions. The facilitator submits the permit on-chain
// followed by settlement via Permit2.
package eip2612gassponsor

import (
	"encoding/json"
	"fmt"
	"math/big"
	"strings"
	"time"
)

// ExtensionKey is the extension key for EIP-2612 gas sponsoring in requirements/payload.
const ExtensionKey = "eip2612GasSponsoring"

// HeaderName is the HTTP header name for EIP-2612 gas sponsor payload.
const HeaderName = "X-T402-EIP2612-Gas-Sponsoring"

// Eip2612GasSponsorExtensionInfo represents the server-side gas sponsor declaration.
type Eip2612GasSponsorExtensionInfo struct {
	SponsoredNetworks []string `json:"sponsoredNetworks"`
	MaxAmount         string   `json:"maxAmount"`
	PermitDeadline    int64    `json:"permitDeadline"`
	SponsorAddress    string   `json:"sponsorAddress"`
}

// Eip2612GasSponsorPayload represents the client-side gas sponsor response.
type Eip2612GasSponsorPayload struct {
	Network         string `json:"network"`
	PermitSignature string `json:"permitSignature"`
	Owner           string `json:"owner"`
	Spender         string `json:"spender"`
	Value           string `json:"value"`
	Deadline        int64  `json:"deadline"`
	V               int    `json:"v"`
	R               string `json:"r"`
	S               string `json:"s"`
}

// Eip2612GasSponsorExtension is the full extension for requirements.
type Eip2612GasSponsorExtension struct {
	Info   Eip2612GasSponsorExtensionInfo `json:"info"`
	Schema map[string]interface{}         `json:"schema"`
}

// Option configures optional fields for DeclareEip2612GasSponsorExtension.
type Option func(*Eip2612GasSponsorExtensionInfo)

// WithPermitDeadline sets a custom permit deadline in seconds.
func WithPermitDeadline(seconds int64) Option {
	return func(info *Eip2612GasSponsorExtensionInfo) {
		info.PermitDeadline = seconds
	}
}

// schema is the JSON Schema for EIP-2612 gas sponsor payload validation.
var schema = map[string]interface{}{
	"type":     "object",
	"required": []string{"network", "permitSignature", "owner", "spender", "value", "deadline", "v", "r", "s"},
	"properties": map[string]interface{}{
		"network":         map[string]interface{}{"type": "string"},
		"permitSignature": map[string]interface{}{"type": "string"},
		"owner":           map[string]interface{}{"type": "string"},
		"spender":         map[string]interface{}{"type": "string"},
		"value":           map[string]interface{}{"type": "string"},
		"deadline":        map[string]interface{}{"type": "number"},
		"v":               map[string]interface{}{"type": "number"},
		"r":               map[string]interface{}{"type": "string"},
		"s":               map[string]interface{}{"type": "string"},
	},
}

// DeclareEip2612GasSponsorExtension creates an EIP-2612 gas sponsor extension for server responses.
func DeclareEip2612GasSponsorExtension(sponsoredNetworks []string, maxAmount, sponsorAddress string, opts ...Option) Eip2612GasSponsorExtension {
	info := Eip2612GasSponsorExtensionInfo{
		SponsoredNetworks: sponsoredNetworks,
		MaxAmount:         maxAmount,
		PermitDeadline:    300,
		SponsorAddress:    sponsorAddress,
	}

	for _, opt := range opts {
		opt(&info)
	}

	return Eip2612GasSponsorExtension{
		Info:   info,
		Schema: schema,
	}
}

// ParseEip2612GasSponsorPayload extracts an EIP-2612 gas sponsor payload from extensions map.
func ParseEip2612GasSponsorPayload(extensions map[string]interface{}) (*Eip2612GasSponsorPayload, error) {
	raw, ok := extensions[ExtensionKey]
	if !ok {
		return nil, fmt.Errorf("missing %s extension", ExtensionKey)
	}

	data, err := json.Marshal(raw)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal eip2612 gas sponsor extension: %w", err)
	}

	var payload Eip2612GasSponsorPayload
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, fmt.Errorf("failed to unmarshal eip2612 gas sponsor payload: %w", err)
	}

	if payload.Network == "" || payload.Owner == "" || payload.PermitSignature == "" {
		return nil, fmt.Errorf("invalid eip2612 gas sponsor payload: missing required fields")
	}

	return &payload, nil
}

// ValidateEip2612GasSponsorPayload validates an EIP-2612 gas sponsor payload against server extension info.
func ValidateEip2612GasSponsorPayload(payload *Eip2612GasSponsorPayload, info *Eip2612GasSponsorExtensionInfo) error {
	return ValidateEip2612GasSponsorPayloadAt(payload, info, time.Now())
}

// ValidateEip2612GasSponsorPayloadAt validates an EIP-2612 gas sponsor payload at a specific time (for testing).
func ValidateEip2612GasSponsorPayloadAt(payload *Eip2612GasSponsorPayload, info *Eip2612GasSponsorExtensionInfo, now time.Time) error {
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
	payloadValue := new(big.Int)
	if _, ok := payloadValue.SetString(payload.Value, 10); !ok {
		return fmt.Errorf("invalid value: %s", payload.Value)
	}
	maxAmount := new(big.Int)
	if _, ok := maxAmount.SetString(info.MaxAmount, 10); !ok {
		return fmt.Errorf("invalid maxAmount: %s", info.MaxAmount)
	}
	if payloadValue.Cmp(maxAmount) > 0 {
		return fmt.Errorf("value %s exceeds maximum amount %s", payload.Value, info.MaxAmount)
	}

	nowUnix := now.Unix()

	// Validate deadline is in the future
	if payload.Deadline <= nowUnix {
		return fmt.Errorf("permit deadline has expired")
	}

	// Validate deadline does not exceed permitDeadline seconds from now
	maxDeadline := nowUnix + info.PermitDeadline
	if payload.Deadline > maxDeadline {
		return fmt.Errorf("permit deadline %d exceeds maximum allowed deadline %d", payload.Deadline, maxDeadline)
	}

	// Validate spender matches sponsorAddress (case-insensitive)
	if !strings.EqualFold(payload.Spender, info.SponsorAddress) {
		return fmt.Errorf("spender %s does not match sponsor address %s", payload.Spender, info.SponsorAddress)
	}

	// Validate permitSignature format (65 bytes = 130 hex chars)
	sigHex := strings.TrimPrefix(payload.PermitSignature, "0x")
	if len(sigHex) != 130 {
		return fmt.Errorf("invalid permit signature length: expected 130 hex chars, got %d", len(sigHex))
	}

	// Validate v is 27 or 28
	if payload.V != 27 && payload.V != 28 {
		return fmt.Errorf("invalid v value: expected 27 or 28, got %d", payload.V)
	}

	// Validate r format (32 bytes = 64 hex chars)
	rHex := strings.TrimPrefix(payload.R, "0x")
	if len(rHex) != 64 {
		return fmt.Errorf("invalid r length: expected 64 hex chars, got %d", len(rHex))
	}

	// Validate s format (32 bytes = 64 hex chars)
	sHex := strings.TrimPrefix(payload.S, "0x")
	if len(sHex) != 64 {
		return fmt.Errorf("invalid s length: expected 64 hex chars, got %d", len(sHex))
	}

	return nil
}

// BuildPermitCallData returns the parameters needed to call permit() on the token contract.
func BuildPermitCallData(payload *Eip2612GasSponsorPayload) (owner, spender, value string, deadline int64, v int, r, s string) {
	return payload.Owner, payload.Spender, payload.Value, payload.Deadline, payload.V, payload.R, payload.S
}
