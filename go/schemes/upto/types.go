// Package upto provides types and utilities for the Up-To payment scheme.
//
// The upto scheme authorizes transfer of up to a maximum amount,
// enabling usage-based billing where the final settlement amount
// is determined by actual usage.
//
// Example usage:
//
//	requirements := &upto.PaymentRequirements{
//	    Scheme:            "upto",
//	    Network:           "eip155:8453",
//	    MaxAmount:         "1000000",  // $1.00 in USDC
//	    MinAmount:         "10000",    // $0.01 minimum
//	    Asset:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
//	    PayTo:             "0x...",
//	    MaxTimeoutSeconds: 300,
//	    Extra: upto.Extra{
//	        Unit:      "token",
//	        UnitPrice: "100",
//	    },
//	}
package upto

import "encoding/json"

// Scheme identifier constant
const Scheme = "upto"

// Default values for the upto scheme
const (
	// DefaultMinAmount is the default minimum settlement amount (prevents dust)
	DefaultMinAmount = "1000"

	// DefaultMaxTimeoutSeconds is the default maximum timeout (5 minutes)
	DefaultMaxTimeoutSeconds = 300
)

// SupportedUnits are the supported billing unit types
var SupportedUnits = []string{
	"token",
	"request",
	"second",
	"minute",
	"byte",
	"kb",
	"mb",
}

// PaymentRequirements represents extended payment requirements for the upto scheme.
// It uses maxAmount instead of amount to indicate a maximum authorization.
type PaymentRequirements struct {
	// Scheme is always "upto"
	Scheme string `json:"scheme"`

	// Network is the blockchain network identifier (CAIP-2 format)
	Network string `json:"network"`

	// MaxAmount is the maximum amount the client authorizes (in smallest denomination)
	MaxAmount string `json:"maxAmount"`

	// MinAmount is the minimum settlement amount (prevents dust payments)
	MinAmount string `json:"minAmount,omitempty"`

	// Asset is the token contract address or identifier
	Asset string `json:"asset"`

	// PayTo is the recipient address
	PayTo string `json:"payTo"`

	// MaxTimeoutSeconds is the maximum time before payment expires
	MaxTimeoutSeconds int `json:"maxTimeoutSeconds"`

	// Extra contains additional scheme-specific data
	Extra Extra `json:"extra"`
}

// Extra contains additional fields specific to the upto scheme.
type Extra struct {
	// Unit is the billing unit (e.g., "token", "request", "second", "byte")
	Unit string `json:"unit,omitempty"`

	// UnitPrice is the price per unit in smallest denomination
	UnitPrice string `json:"unitPrice,omitempty"`

	// Name is the EIP-712 domain name (for EVM)
	Name string `json:"name,omitempty"`

	// Version is the EIP-712 domain version (for EVM)
	Version string `json:"version,omitempty"`

	// RouterAddress is the router contract address (for EVM)
	RouterAddress string `json:"routerAddress,omitempty"`

	// Additional fields can be added via embedding or custom unmarshal
	Additional map[string]interface{} `json:"-"`
}

// MarshalJSON implements custom JSON marshaling for Extra to include additional fields
func (e Extra) MarshalJSON() ([]byte, error) {
	type ExtraAlias Extra
	base, err := json.Marshal(ExtraAlias(e))
	if err != nil {
		return nil, err
	}

	if len(e.Additional) == 0 {
		return base, nil
	}

	// Merge additional fields
	var baseMap map[string]interface{}
	if err := json.Unmarshal(base, &baseMap); err != nil {
		return nil, err
	}

	for k, v := range e.Additional {
		if _, exists := baseMap[k]; !exists {
			baseMap[k] = v
		}
	}

	return json.Marshal(baseMap)
}

// UnmarshalJSON implements custom JSON unmarshaling for Extra to capture additional fields
func (e *Extra) UnmarshalJSON(data []byte) error {
	type ExtraAlias Extra
	var alias ExtraAlias
	if err := json.Unmarshal(data, &alias); err != nil {
		return err
	}
	*e = Extra(alias)

	// Capture additional fields
	var allFields map[string]interface{}
	if err := json.Unmarshal(data, &allFields); err != nil {
		return err
	}

	knownFields := map[string]bool{
		"unit": true, "unitPrice": true, "name": true,
		"version": true, "routerAddress": true,
	}

	e.Additional = make(map[string]interface{})
	for k, v := range allFields {
		if !knownFields[k] {
			e.Additional[k] = v
		}
	}

	return nil
}

// Settlement represents a settlement request for the upto scheme.
type Settlement struct {
	// SettleAmount is the actual amount to settle (must be <= maxAmount)
	SettleAmount string `json:"settleAmount"`

	// UsageDetails contains optional usage details for auditing
	UsageDetails *UsageDetails `json:"usageDetails,omitempty"`
}

// UsageDetails contains usage information for settlement auditing.
type UsageDetails struct {
	// UnitsConsumed is the number of units consumed
	UnitsConsumed int `json:"unitsConsumed,omitempty"`

	// UnitPrice is the price per unit used
	UnitPrice string `json:"unitPrice,omitempty"`

	// UnitType is the type of unit
	UnitType string `json:"unitType,omitempty"`

	// StartTime is the start timestamp of the usage period
	StartTime int64 `json:"startTime,omitempty"`

	// EndTime is the end timestamp of the usage period
	EndTime int64 `json:"endTime,omitempty"`

	// Metadata contains additional usage metadata
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// SettlementResponse contains the result of a settlement operation.
type SettlementResponse struct {
	// Success indicates whether settlement was successful
	Success bool `json:"success"`

	// TransactionHash is the on-chain transaction hash (if applicable)
	TransactionHash string `json:"transactionHash,omitempty"`

	// SettledAmount is the actual amount that was settled
	SettledAmount string `json:"settledAmount"`

	// MaxAmount is the maximum amount that was authorized
	MaxAmount string `json:"maxAmount"`

	// BlockNumber is the block number of the transaction (if on-chain)
	BlockNumber uint64 `json:"blockNumber,omitempty"`

	// GasUsed is the gas consumed by the transaction (if on-chain)
	GasUsed string `json:"gasUsed,omitempty"`

	// Error contains an error message if settlement failed
	Error string `json:"error,omitempty"`
}

// ValidationResult contains the result of payment validation.
type ValidationResult struct {
	// IsValid indicates whether the payment is valid
	IsValid bool `json:"isValid"`

	// InvalidReason explains why the payment is invalid (if applicable)
	InvalidReason string `json:"invalidReason,omitempty"`

	// ValidatedMaxAmount is the validated maximum amount
	ValidatedMaxAmount string `json:"validatedMaxAmount,omitempty"`

	// Payer is the address of the payer
	Payer string `json:"payer,omitempty"`

	// ExpiresAt is the expiration timestamp
	ExpiresAt int64 `json:"expiresAt,omitempty"`
}

// IsUptoPaymentRequirements checks if the given data represents upto payment requirements.
func IsUptoPaymentRequirements(data map[string]interface{}) bool {
	scheme, ok := data["scheme"].(string)
	if !ok {
		return false
	}
	_, hasMaxAmount := data["maxAmount"]
	return scheme == Scheme && hasMaxAmount
}

// IsValidUnit checks if the given unit is a supported billing unit.
func IsValidUnit(unit string) bool {
	for _, u := range SupportedUnits {
		if u == unit {
			return true
		}
	}
	return false
}

// NewPaymentRequirements creates a new PaymentRequirements with default values.
func NewPaymentRequirements(network, maxAmount, asset, payTo string) *PaymentRequirements {
	return &PaymentRequirements{
		Scheme:            Scheme,
		Network:           network,
		MaxAmount:         maxAmount,
		MinAmount:         DefaultMinAmount,
		Asset:             asset,
		PayTo:             payTo,
		MaxTimeoutSeconds: DefaultMaxTimeoutSeconds,
		Extra:             Extra{},
	}
}

// NewSettlement creates a new Settlement with the given amount.
func NewSettlement(settleAmount string) *Settlement {
	return &Settlement{
		SettleAmount: settleAmount,
	}
}

// WithUsageDetails adds usage details to the settlement.
func (s *Settlement) WithUsageDetails(details *UsageDetails) *Settlement {
	s.UsageDetails = details
	return s
}

// NewUsageDetails creates a new UsageDetails.
func NewUsageDetails(unitsConsumed int, unitPrice, unitType string) *UsageDetails {
	return &UsageDetails{
		UnitsConsumed: unitsConsumed,
		UnitPrice:     unitPrice,
		UnitType:      unitType,
	}
}

// WithTimeRange adds time range to usage details.
func (u *UsageDetails) WithTimeRange(startTime, endTime int64) *UsageDetails {
	u.StartTime = startTime
	u.EndTime = endTime
	return u
}

// WithMetadata adds metadata to usage details.
func (u *UsageDetails) WithMetadata(metadata map[string]interface{}) *UsageDetails {
	u.Metadata = metadata
	return u
}
