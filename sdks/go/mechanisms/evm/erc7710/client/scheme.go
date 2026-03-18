// Package client implements the ERC-7710 client-side payment scheme.
// The client provides a pre-existing delegation (permissionContext)
// that authorizes the facilitator to execute token transfers.
package client

import (
	"fmt"

	"github.com/t402-io/t402/sdks/go/mechanisms/evm"
	"github.com/t402-io/t402/sdks/go/types"
)

// Config holds the delegation parameters for ERC-7710 payments.
type Config struct {
	DelegationManager string
	PermissionContext  string
	Delegator         string
}

// ERC7710ClientScheme creates payment payloads for ERC-7710 delegation payments.
type ERC7710ClientScheme struct {
	config Config
}

// NewERC7710ClientScheme creates a new ERC-7710 client scheme.
func NewERC7710ClientScheme(config Config) (*ERC7710ClientScheme, error) {
	if config.DelegationManager == "" {
		return nil, fmt.Errorf("delegationManager is required")
	}
	if config.PermissionContext == "" {
		return nil, fmt.Errorf("permissionContext is required")
	}
	if config.Delegator == "" {
		return nil, fmt.Errorf("delegator is required")
	}
	return &ERC7710ClientScheme{config: config}, nil
}

// Scheme returns the scheme identifier.
func (c *ERC7710ClientScheme) Scheme() string {
	return evm.SchemeExact
}

// CaipFamily returns the CAIP family pattern.
func (c *ERC7710ClientScheme) CaipFamily() string {
	return "eip155:*"
}

// CreatePaymentPayload creates a payload containing the delegation proof.
func (c *ERC7710ClientScheme) CreatePaymentPayload(
	t402Version int,
	requirements types.PaymentRequirements,
) (*types.PaymentPayload, error) {
	payload := &evm.ExactERC7710Payload{
		DelegationManager: c.config.DelegationManager,
		PermissionContext:  c.config.PermissionContext,
		Delegator:         c.config.Delegator,
	}

	return &types.PaymentPayload{
		T402Version: t402Version,
		Payload:     payload.ToMap(),
	}, nil
}
