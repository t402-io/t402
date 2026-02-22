package erc8004

import (
	"encoding/json"
	"fmt"
	"math"
	"math/big"
	"strings"
	"time"
)

// ParseAgentRegistry parses an agent registry ID string into components.
//
// Format: "{namespace}:{chainId}:{address}"
//
// Example:
//
//	ParseAgentRegistry("eip155:8453:0x742d35Cc...")
//	// => AgentRegistry{Namespace: "eip155", ChainID: "8453", Address: "0x742d35Cc...", ID: "eip155:8453:0x742d35Cc..."}
func ParseAgentRegistry(registryID AgentRegistryID) (AgentRegistry, error) {
	parts := strings.SplitN(string(registryID), ":", 3)
	if len(parts) < 3 {
		return AgentRegistry{}, fmt.Errorf("invalid agent registry ID: %s. Expected format: namespace:chainId:address", registryID)
	}

	namespace := parts[0]
	chainID := parts[1]
	address := parts[2]

	if namespace == "" || chainID == "" || address == "" {
		return AgentRegistry{}, fmt.Errorf("invalid agent registry ID: %s. All parts must be non-empty", registryID)
	}

	return AgentRegistry{
		Namespace: namespace,
		ChainID:   chainID,
		Address:   address,
		ID:        registryID,
	}, nil
}

// DeclareExtension creates an ERC-8004 extension for inclusion in
// PaymentRequired.extensions.
func DeclareExtension(agentID int, agentRegistry AgentRegistryID, agentWallet ...string) ERC8004Extension {
	ext := ERC8004Extension{
		AgentID:       agentID,
		AgentRegistry: agentRegistry,
	}
	if len(agentWallet) > 0 && agentWallet[0] != "" {
		ext.AgentWallet = agentWallet[0]
	}
	return ext
}

// ParseExtension extracts ERC-8004 extension data from a PaymentRequired extensions map.
func ParseExtension(extensions map[string]interface{}) (*ERC8004Extension, error) {
	raw, ok := extensions[ExtensionKey]
	if !ok {
		return nil, fmt.Errorf("missing %s extension", ExtensionKey)
	}

	data, err := json.Marshal(raw)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal erc8004 extension: %w", err)
	}

	var ext ERC8004Extension
	if err := json.Unmarshal(data, &ext); err != nil {
		return nil, fmt.Errorf("failed to unmarshal erc8004 extension: %w", err)
	}

	if ext.AgentRegistry == "" {
		return nil, fmt.Errorf("invalid erc8004 extension: missing agentRegistry")
	}

	return &ext, nil
}

// ParsePayloadExtension extracts ERC-8004 payload extension data from a
// PaymentPayload extensions map.
func ParsePayloadExtension(extensions map[string]interface{}) (*ERC8004PayloadExtension, error) {
	raw, ok := extensions[ExtensionKey]
	if !ok {
		return nil, fmt.Errorf("missing %s extension", ExtensionKey)
	}

	data, err := json.Marshal(raw)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal erc8004 payload extension: %w", err)
	}

	var ext ERC8004PayloadExtension
	if err := json.Unmarshal(data, &ext); err != nil {
		return nil, fmt.Errorf("failed to unmarshal erc8004 payload extension: %w", err)
	}

	if ext.AgentRegistry == "" {
		return nil, fmt.Errorf("invalid erc8004 payload extension: missing agentRegistry")
	}

	return &ext, nil
}

// CreatePayloadExtension creates a client-side ERC-8004 payload extension
// after verifying identity.
func CreatePayloadExtension(agentID int, agentRegistry AgentRegistryID, verified bool) ERC8004PayloadExtension {
	return ERC8004PayloadExtension{
		IdentityVerified: verified,
		AgentID:          agentID,
		AgentRegistry:    agentRegistry,
	}
}

// NormalizeReputationScore normalizes a raw summary value and decimals to a 0-100 score.
func NormalizeReputationScore(summaryValue *big.Int, summaryValueDecimals int, count uint64) int {
	if count == 0 {
		return 0
	}

	divisor := math.Pow(10, float64(summaryValueDecimals))
	raw := float64(summaryValue.Int64()) / divisor
	score := int(math.Min(100, math.Max(0, raw)))
	return score
}

// BuildFeedbackFile creates an off-chain feedback file with optional proof of payment.
func BuildFeedbackFile(
	agentID int,
	agentRegistry AgentRegistryID,
	clientAddress string,
	value int,
	valueDecimals int,
	tag1 string,
	tag2 string,
	proofOfPayment *ProofOfPayment,
) FeedbackFile {
	f := FeedbackFile{
		AgentRegistry: agentRegistry,
		AgentID:       agentID,
		ClientAddress: clientAddress,
		CreatedAt:     time.Now().UTC().Format(time.RFC3339),
		Value:         value,
		ValueDecimals: valueDecimals,
		Tag1:          tag1,
		Tag2:          tag2,
	}
	if proofOfPayment != nil {
		f.ProofOfPayment = proofOfPayment
	}
	return f
}

// RegistryAddressFromID extracts the contract address from an AgentRegistryID.
func RegistryAddressFromID(registryID AgentRegistryID) (string, error) {
	parts := strings.SplitN(string(registryID), ":", 3)
	if len(parts) < 3 || parts[2] == "" {
		return "", fmt.Errorf("invalid agent registry ID: %s", registryID)
	}
	return parts[2], nil
}

// VerifyPayToMatchesExtension checks whether the payTo address in the extension
// matches the declared agentWallet. This is a local check that does not query
// on-chain state. Returns true if agentWallet is set and matches payTo
// (case-insensitive).
func VerifyPayToMatchesExtension(ext *ERC8004Extension, payTo string) bool {
	if ext.AgentWallet == "" || payTo == "" {
		return false
	}
	return strings.EqualFold(ext.AgentWallet, payTo)
}

// extensionSchema is the JSON Schema for ERC-8004 extension validation.
var extensionSchema = map[string]interface{}{
	"type":     "object",
	"required": []string{"agentId", "agentRegistry"},
	"properties": map[string]interface{}{
		"agentId":         map[string]interface{}{"type": "number"},
		"agentRegistry":   map[string]interface{}{"type": "string"},
		"agentWallet":     map[string]interface{}{"type": "string"},
		"reputationScore": map[string]interface{}{"type": "number"},
		"feedbackCount":   map[string]interface{}{"type": "number"},
		"validationScore": map[string]interface{}{"type": "number"},
	},
}

// payloadExtensionSchema is the JSON Schema for ERC-8004 payload extension validation.
var payloadExtensionSchema = map[string]interface{}{
	"type":     "object",
	"required": []string{"identityVerified", "agentId", "agentRegistry"},
	"properties": map[string]interface{}{
		"identityVerified": map[string]interface{}{"type": "boolean"},
		"agentId":          map[string]interface{}{"type": "number"},
		"agentRegistry":    map[string]interface{}{"type": "string"},
	},
}

// ExtensionSchema returns the JSON Schema for the ERC-8004 extension.
func ExtensionSchema() map[string]interface{} {
	return extensionSchema
}

// PayloadExtensionSchema returns the JSON Schema for the ERC-8004 payload extension.
func PayloadExtensionSchema() map[string]interface{} {
	return payloadExtensionSchema
}
