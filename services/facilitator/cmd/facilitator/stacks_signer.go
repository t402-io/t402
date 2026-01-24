package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/t402-io/t402/sdks/go/mechanisms/stacks"
	"github.com/t402-io/t402/services/facilitator/internal/config"
)

// facilitatorStacksSigner implements the FacilitatorStacksSigner interface
type facilitatorStacksSigner struct {
	addresses map[string][]string // network -> addresses
	apiURLs   map[string]string   // network -> Hiro API URL
	client    *http.Client
}

// newFacilitatorStacksSigner creates a new Stacks facilitator signer
func newFacilitatorStacksSigner(cfg *config.Config) *facilitatorStacksSigner {
	addresses := make(map[string][]string)
	apiURLs := make(map[string]string)

	if cfg.StacksAddress != "" {
		addresses[stacks.StacksMainnetCAIP2] = []string{cfg.StacksAddress}
		addresses[stacks.StacksTestnetCAIP2] = []string{cfg.StacksAddress}
	}

	apiURLs[stacks.StacksMainnetCAIP2] = cfg.StacksAPIURL
	apiURLs[stacks.StacksTestnetCAIP2] = cfg.StacksTestnetAPIURL

	return &facilitatorStacksSigner{
		addresses: addresses,
		apiURLs:   apiURLs,
		client:    &http.Client{Timeout: 30 * time.Second},
	}
}

func (s *facilitatorStacksSigner) GetAddresses(network string) []string {
	return s.addresses[network]
}

func (s *facilitatorStacksSigner) QueryTransaction(ctx context.Context, txId string) (*stacks.StacksTransactionResult, error) {
	// Determine API URL based on network - default to mainnet
	apiURL := s.apiURLs[stacks.StacksMainnetCAIP2]

	url := fmt.Sprintf("%s/extended/v1/tx/%s", apiURL, txId)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to query transaction: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, nil
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("unexpected status %d: %s", resp.StatusCode, string(body))
	}

	var result stacks.StacksTransactionResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}
