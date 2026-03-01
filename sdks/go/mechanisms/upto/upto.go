// Package upto provides shared types and constants for the Up-To payment scheme.
//
// The upto scheme authorizes transfer of up to a maximum amount, enabling
// usage-based billing where the final settlement amount is determined by
// actual usage. This is useful for AI inference billing, metered API access,
// streaming services, and data transfer billing.
//
// Chain-specific implementations live in their respective mechanism packages
// (e.g., mechanisms/evm/upto, mechanisms/svm/upto).
package upto

// Scheme is the identifier for the upto payment scheme.
const Scheme = "upto"

// DefaultMinAmount is the default minimum settlement amount (prevents dust).
const DefaultMinAmount = "1000"

// DefaultMaxTimeoutSeconds is the default maximum timeout in seconds.
const DefaultMaxTimeoutSeconds = 300

// SupportedUnits lists the valid billing unit types.
var SupportedUnits = []string{
	"token",
	"request",
	"second",
	"minute",
	"byte",
	"kb",
	"mb",
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

// Extra contains scheme-specific extra fields for upto payment requirements.
type Extra struct {
	// Unit is the billing unit (e.g., "token", "request", "second", "byte")
	Unit string `json:"unit,omitempty"`

	// UnitPrice is the price per unit in smallest denomination
	UnitPrice string `json:"unitPrice,omitempty"`

	// Name is the EIP-712 domain name (for EVM)
	Name string `json:"name,omitempty"`

	// Version is the EIP-712 domain version (for EVM)
	Version string `json:"version,omitempty"`

	// RouterAddress is the upto router contract address (for EVM)
	RouterAddress string `json:"routerAddress,omitempty"`
}

// PaymentRequirements represents payment requirements for the upto scheme.
type PaymentRequirements struct {
	// Scheme is always "upto"
	Scheme string `json:"scheme"`

	// Network is the network identifier in CAIP-2 format
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

	// Extra contains scheme-specific data
	Extra *Extra `json:"extra,omitempty"`
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

	// Metadata contains additional tracking data
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// Settlement represents a settlement request for the upto scheme.
type Settlement struct {
	// SettleAmount is the actual amount to settle (must be <= maxAmount)
	SettleAmount string `json:"settleAmount"`

	// UsageDetails contains optional usage information
	UsageDetails *UsageDetails `json:"usageDetails,omitempty"`
}

// SettlementResponse represents a settlement response for the upto scheme.
type SettlementResponse struct {
	// Success indicates whether settlement was successful
	Success bool `json:"success"`

	// TransactionHash is the on-chain transaction hash (if applicable)
	TransactionHash string `json:"transactionHash,omitempty"`

	// SettledAmount is the actual amount settled
	SettledAmount string `json:"settledAmount"`

	// MaxAmount is the maximum amount that was authorized
	MaxAmount string `json:"maxAmount"`

	// BlockNumber is the block number (if on-chain)
	BlockNumber *int64 `json:"blockNumber,omitempty"`

	// GasUsed is the gas used (if on-chain)
	GasUsed string `json:"gasUsed,omitempty"`

	// Error is the error message if settlement failed
	Error string `json:"error,omitempty"`
}

// ValidationResult represents a validation result for an upto payment.
type ValidationResult struct {
	// IsValid indicates whether the payment is valid
	IsValid bool `json:"isValid"`

	// InvalidReason is the reason if invalid
	InvalidReason string `json:"invalidReason,omitempty"`

	// ValidatedMaxAmount is the verified maximum amount
	ValidatedMaxAmount string `json:"validatedMaxAmount,omitempty"`

	// Payer is the payer address
	Payer string `json:"payer,omitempty"`

	// ExpiresAt is the expiration timestamp
	ExpiresAt *int64 `json:"expiresAt,omitempty"`
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
	}
}

// NewSettlement creates a new Settlement.
func NewSettlement(settleAmount string) *Settlement {
	return &Settlement{
		SettleAmount: settleAmount,
	}
}

// NewSettlementWithUsage creates a new Settlement with usage details.
func NewSettlementWithUsage(settleAmount string, unitsConsumed int, unitPrice, unitType string) *Settlement {
	return &Settlement{
		SettleAmount: settleAmount,
		UsageDetails: &UsageDetails{
			UnitsConsumed: unitsConsumed,
			UnitPrice:     unitPrice,
			UnitType:      unitType,
		},
	}
}

// SuccessResponse creates a successful settlement response.
func SuccessResponse(settledAmount, maxAmount, txHash string) *SettlementResponse {
	return &SettlementResponse{
		Success:         true,
		SettledAmount:   settledAmount,
		MaxAmount:       maxAmount,
		TransactionHash: txHash,
	}
}

// FailureResponse creates a failed settlement response.
func FailureResponse(maxAmount, errMsg string) *SettlementResponse {
	return &SettlementResponse{
		Success:       false,
		SettledAmount: "0",
		MaxAmount:     maxAmount,
		Error:         errMsg,
	}
}

// Valid creates a valid ValidationResult.
func Valid(validatedMaxAmount, payer string, expiresAt int64) *ValidationResult {
	return &ValidationResult{
		IsValid:            true,
		ValidatedMaxAmount: validatedMaxAmount,
		Payer:              payer,
		ExpiresAt:          &expiresAt,
	}
}

// Invalid creates an invalid ValidationResult.
func Invalid(reason string) *ValidationResult {
	return &ValidationResult{
		IsValid:       false,
		InvalidReason: reason,
	}
}

// IsUptoRequirements checks if the given data represents upto payment requirements.
func IsUptoRequirements(data map[string]interface{}) bool {
	scheme, ok := data["scheme"].(string)
	if !ok || scheme != Scheme {
		return false
	}
	_, hasMaxAmount := data["maxAmount"]
	return hasMaxAmount
}
