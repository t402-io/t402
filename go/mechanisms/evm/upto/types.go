// Package upto provides EVM-specific types for the Up-To payment scheme.
//
// The EVM implementation uses EIP-2612 Permit for gasless token approvals,
// allowing clients to authorize up to a maximum amount that the server
// can later settle based on actual usage.
package upto

import (
	"math/big"

	"github.com/t402-io/t402/go/mechanisms/evm"
)

// Scheme identifier for upto on EVM
const Scheme = "upto"

// PermitSignature contains the EIP-2612 permit signature components.
type PermitSignature struct {
	// V is the recovery id
	V int `json:"v"`

	// R is the first 32 bytes of the signature
	R string `json:"r"`

	// S is the second 32 bytes of the signature
	S string `json:"s"`
}

// PermitAuthorization contains the EIP-2612 permit authorization parameters.
type PermitAuthorization struct {
	// Owner is the token owner address
	Owner string `json:"owner"`

	// Spender is the address authorized to spend (router contract)
	Spender string `json:"spender"`

	// Value is the maximum authorized value
	Value string `json:"value"`

	// Deadline is the permit deadline (unix timestamp)
	Deadline string `json:"deadline"`

	// Nonce is the permit nonce from the token contract
	Nonce int `json:"nonce"`
}

// EIP2612Payload represents the upto payment payload using EIP-2612 Permit.
type EIP2612Payload struct {
	// Signature contains the permit signature components
	Signature PermitSignature `json:"signature"`

	// Authorization contains the permit parameters
	Authorization PermitAuthorization `json:"authorization"`

	// PaymentNonce is a unique nonce to prevent replay attacks
	PaymentNonce string `json:"paymentNonce"`
}

// CompactPayload is an alternative payload with a combined signature.
type CompactPayload struct {
	// Signature is the combined EIP-2612 permit signature (65 bytes hex)
	Signature string `json:"signature"`

	// Authorization contains the permit parameters
	Authorization PermitAuthorization `json:"authorization"`

	// PaymentNonce is a unique nonce to prevent replay attacks
	PaymentNonce string `json:"paymentNonce"`
}

// Extra contains EVM-specific extra fields for the upto scheme.
type Extra struct {
	// Name is the EIP-712 domain name (token name)
	Name string `json:"name"`

	// Version is the EIP-712 domain version
	Version string `json:"version"`

	// RouterAddress is the upto router contract address
	RouterAddress string `json:"routerAddress,omitempty"`

	// Unit is the billing unit (e.g., "token", "request")
	Unit string `json:"unit,omitempty"`

	// UnitPrice is the price per unit in smallest denomination
	UnitPrice string `json:"unitPrice,omitempty"`
}

// Settlement represents an EVM-specific settlement request.
type Settlement struct {
	// SettleAmount is the actual amount to settle
	SettleAmount string `json:"settleAmount"`

	// UsageDetails contains optional usage information
	UsageDetails *UsageDetails `json:"usageDetails,omitempty"`
}

// UsageDetails contains usage information for settlement.
type UsageDetails struct {
	// UnitsConsumed is the number of units consumed
	UnitsConsumed int `json:"unitsConsumed,omitempty"`

	// UnitPrice is the price per unit used
	UnitPrice string `json:"unitPrice,omitempty"`

	// UnitType is the type of unit
	UnitType string `json:"unitType,omitempty"`

	// StartTime is the start timestamp
	StartTime int64 `json:"startTime,omitempty"`

	// EndTime is the end timestamp
	EndTime int64 `json:"endTime,omitempty"`
}

// PermitTypes returns the EIP-712 type definitions for Permit.
var PermitTypes = map[string][]evm.TypedDataField{
	"Permit": {
		{Name: "owner", Type: "address"},
		{Name: "spender", Type: "address"},
		{Name: "value", Type: "uint256"},
		{Name: "nonce", Type: "uint256"},
		{Name: "deadline", Type: "uint256"},
	},
}

// PermitDomainTypes returns the EIP-712 domain type definitions.
var PermitDomainTypes = []evm.TypedDataField{
	{Name: "name", Type: "string"},
	{Name: "version", Type: "string"},
	{Name: "chainId", Type: "uint256"},
	{Name: "verifyingContract", Type: "address"},
}

// ToMap converts an EIP2612Payload to a map for JSON marshaling.
func (p *EIP2612Payload) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"signature": map[string]interface{}{
			"v": p.Signature.V,
			"r": p.Signature.R,
			"s": p.Signature.S,
		},
		"authorization": map[string]interface{}{
			"owner":    p.Authorization.Owner,
			"spender":  p.Authorization.Spender,
			"value":    p.Authorization.Value,
			"deadline": p.Authorization.Deadline,
			"nonce":    p.Authorization.Nonce,
		},
		"paymentNonce": p.PaymentNonce,
	}
}

// PayloadFromMap creates an EIP2612Payload from a map.
func PayloadFromMap(data map[string]interface{}) (*EIP2612Payload, error) {
	payload := &EIP2612Payload{}

	if nonce, ok := data["paymentNonce"].(string); ok {
		payload.PaymentNonce = nonce
	}

	if sig, ok := data["signature"].(map[string]interface{}); ok {
		if v, ok := sig["v"].(float64); ok {
			payload.Signature.V = int(v)
		}
		if r, ok := sig["r"].(string); ok {
			payload.Signature.R = r
		}
		if s, ok := sig["s"].(string); ok {
			payload.Signature.S = s
		}
	}

	if auth, ok := data["authorization"].(map[string]interface{}); ok {
		if owner, ok := auth["owner"].(string); ok {
			payload.Authorization.Owner = owner
		}
		if spender, ok := auth["spender"].(string); ok {
			payload.Authorization.Spender = spender
		}
		if value, ok := auth["value"].(string); ok {
			payload.Authorization.Value = value
		}
		if deadline, ok := auth["deadline"].(string); ok {
			payload.Authorization.Deadline = deadline
		}
		if nonce, ok := auth["nonce"].(float64); ok {
			payload.Authorization.Nonce = int(nonce)
		}
	}

	return payload, nil
}

// IsEIP2612Payload checks if the given data represents an EIP-2612 permit payload.
func IsEIP2612Payload(data map[string]interface{}) bool {
	sig, hasSig := data["signature"]
	auth, hasAuth := data["authorization"]

	if !hasSig || !hasAuth {
		return false
	}

	// Check signature structure (should be object with v, r, s)
	sigMap, sigIsMap := sig.(map[string]interface{})
	if !sigIsMap {
		return false
	}
	_, hasV := sigMap["v"]
	_, hasR := sigMap["r"]
	_, hasS := sigMap["s"]
	if !hasV || !hasR || !hasS {
		return false
	}

	// Check authorization structure
	authMap, authIsMap := auth.(map[string]interface{})
	if !authIsMap {
		return false
	}
	_, hasOwner := authMap["owner"]
	_, hasSpender := authMap["spender"]
	_, hasValue := authMap["value"]
	_, hasDeadline := authMap["deadline"]

	return hasOwner && hasSpender && hasValue && hasDeadline
}

// CreatePermitDomain creates an EIP-712 domain for permit signing.
func CreatePermitDomain(name, version string, chainID *big.Int, tokenAddress string) evm.TypedDataDomain {
	return evm.TypedDataDomain{
		Name:              name,
		Version:           version,
		ChainID:           chainID,
		VerifyingContract: tokenAddress,
	}
}

// CreatePermitMessage creates an EIP-712 message for permit signing.
func CreatePermitMessage(auth PermitAuthorization) map[string]interface{} {
	value, _ := new(big.Int).SetString(auth.Value, 10)
	deadline, _ := new(big.Int).SetString(auth.Deadline, 10)

	return map[string]interface{}{
		"owner":    auth.Owner,
		"spender":  auth.Spender,
		"value":    value,
		"nonce":    big.NewInt(int64(auth.Nonce)),
		"deadline": deadline,
	}
}

// NewEIP2612Payload creates a new EIP2612Payload.
func NewEIP2612Payload(sig PermitSignature, auth PermitAuthorization, paymentNonce string) *EIP2612Payload {
	return &EIP2612Payload{
		Signature:     sig,
		Authorization: auth,
		PaymentNonce:  paymentNonce,
	}
}

// NewPermitSignature creates a new PermitSignature.
func NewPermitSignature(v int, r, s string) PermitSignature {
	return PermitSignature{V: v, R: r, S: s}
}

// NewPermitAuthorization creates a new PermitAuthorization.
func NewPermitAuthorization(owner, spender, value, deadline string, nonce int) PermitAuthorization {
	return PermitAuthorization{
		Owner:    owner,
		Spender:  spender,
		Value:    value,
		Deadline: deadline,
		Nonce:    nonce,
	}
}
