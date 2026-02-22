package erc8004

import "math/big"

// AgentRegistryID is an ERC-8004 agent registry identifier: {namespace}:{chainId}:{contractAddress}
type AgentRegistryID string

// AgentRegistry is a parsed agent registry identifier.
type AgentRegistry struct {
	Namespace string `json:"namespace"`
	ChainID   string `json:"chainId"`
	Address   string `json:"address"`
	ID        AgentRegistryID `json:"id"`
}

// MetadataEntry is a key-value metadata entry for agent registration.
type MetadataEntry struct {
	MetadataKey   string `json:"metadataKey"`
	MetadataValue string `json:"metadataValue"`
}

// AgentIdentity is the on-chain agent identity from the Identity Registry.
type AgentIdentity struct {
	AgentID     *big.Int        `json:"agentId"`
	Owner       string          `json:"owner"`
	AgentURI    string          `json:"agentURI"`
	AgentWallet string          `json:"agentWallet"`
	Registry    AgentRegistry   `json:"registry"`
}

// RegistrationFile is the ERC-8004 off-chain registration file (JSON at agentURI).
type RegistrationFile struct {
	Type           string              `json:"type"`
	Name           string              `json:"name"`
	Description    string              `json:"description,omitempty"`
	Image          string              `json:"image,omitempty"`
	Services       []ServiceEntry      `json:"services"`
	X402Support    bool                `json:"x402Support"`
	Active         bool                `json:"active"`
	Registrations  []RegistrationEntry `json:"registrations"`
	SupportedTrust []string            `json:"supportedTrust,omitempty"`
}

// ServiceEntry describes a service endpoint in a registration file.
type ServiceEntry struct {
	Name     string   `json:"name"`
	Endpoint string   `json:"endpoint"`
	Version  string   `json:"version,omitempty"`
	Skills   []string `json:"skills,omitempty"`
	Domains  []string `json:"domains,omitempty"`
}

// RegistrationEntry links an agent to a registry.
type RegistrationEntry struct {
	AgentID       int             `json:"agentId"`
	AgentRegistry AgentRegistryID `json:"agentRegistry"`
}

// ResolvedAgent is an on-chain identity combined with a fetched registration file.
type ResolvedAgent struct {
	AgentIdentity
	Registration RegistrationFile `json:"registration"`
}

// FeedbackRecord is an on-chain feedback record.
type FeedbackRecord struct {
	Value          *big.Int `json:"value"`
	ValueDecimals  int      `json:"valueDecimals"`
	Tag1           string   `json:"tag1"`
	Tag2           string   `json:"tag2"`
	IsRevoked      bool     `json:"isRevoked"`
	FeedbackIndex  *big.Int `json:"feedbackIndex"`
	ClientAddress  string   `json:"clientAddress"`
}

// ReputationSummary is an aggregated reputation summary.
type ReputationSummary struct {
	AgentID              *big.Int `json:"agentId"`
	Count                uint64   `json:"count"`
	SummaryValue         *big.Int `json:"summaryValue"`
	SummaryValueDecimals int      `json:"summaryValueDecimals"`
	// NormalizedScore is a 0-100 score derived from summaryValue/summaryValueDecimals.
	NormalizedScore int `json:"normalizedScore"`
}

// FeedbackParams contains parameters for submitting feedback.
type FeedbackParams struct {
	AgentID       *big.Int `json:"agentId"`
	Value         *big.Int `json:"value"`
	ValueDecimals int      `json:"valueDecimals"`
	Tag1          string   `json:"tag1"`
	Tag2          string   `json:"tag2"`
	Endpoint      string   `json:"endpoint,omitempty"`
	FeedbackURI   string   `json:"feedbackURI,omitempty"`
	FeedbackHash  string   `json:"feedbackHash,omitempty"`
}

// FeedbackFile is the off-chain feedback file structure.
type FeedbackFile struct {
	AgentRegistry  AgentRegistryID `json:"agentRegistry"`
	AgentID        int             `json:"agentId"`
	ClientAddress  string          `json:"clientAddress"`
	CreatedAt      string          `json:"createdAt"`
	Value          int             `json:"value"`
	ValueDecimals  int             `json:"valueDecimals"`
	Tag1           string          `json:"tag1,omitempty"`
	Tag2           string          `json:"tag2,omitempty"`
	Endpoint       string          `json:"endpoint,omitempty"`
	ProofOfPayment *ProofOfPayment `json:"proofOfPayment,omitempty"`
}

// ProofOfPayment links feedback to a payment transaction.
type ProofOfPayment struct {
	FromAddress string `json:"fromAddress"`
	ToAddress   string `json:"toAddress"`
	ChainID     string `json:"chainId"`
	TxHash      string `json:"txHash"`
}

// ValidationRequestParams contains parameters for a validation request.
type ValidationRequestParams struct {
	ValidatorAddress string   `json:"validatorAddress"`
	AgentID          *big.Int `json:"agentId"`
	RequestURI       string   `json:"requestURI"`
	RequestHash      string   `json:"requestHash"`
}

// ValidationStatus is the status of a validation request.
type ValidationStatus struct {
	ValidatorAddress string   `json:"validatorAddress"`
	AgentID          *big.Int `json:"agentId"`
	Response         int      `json:"response"` // 0-100
	ResponseHash     string   `json:"responseHash"`
	Tag              string   `json:"tag"`
	LastUpdate       *big.Int `json:"lastUpdate"`
}

// ValidationSummary is an aggregated validation summary.
type ValidationSummary struct {
	Count           uint64 `json:"count"`
	AverageResponse int    `json:"averageResponse"` // 0-100
}

// ERC8004Extension is the extension data in PaymentRequired.extensions.
type ERC8004Extension struct {
	AgentID         int             `json:"agentId"`
	AgentRegistry   AgentRegistryID `json:"agentRegistry"`
	AgentWallet     string          `json:"agentWallet,omitempty"`
	ReputationScore *int            `json:"reputationScore,omitempty"`
	FeedbackCount   *int            `json:"feedbackCount,omitempty"`
	ValidationScore *int            `json:"validationScore,omitempty"`
}

// ERC8004PayloadExtension is the extension data echoed in PaymentPayload.extensions.
type ERC8004PayloadExtension struct {
	IdentityVerified bool            `json:"identityVerified"`
	AgentID          int             `json:"agentId"`
	AgentRegistry    AgentRegistryID `json:"agentRegistry"`
}
