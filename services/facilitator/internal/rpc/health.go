package rpc

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// HealthChecker periodically checks the health of RPC providers.
type HealthChecker struct {
	manager *Manager
	config  *Config
	client  *http.Client
}

// NewHealthChecker creates a new health checker.
func NewHealthChecker(manager *Manager, config *Config) *HealthChecker {
	return &HealthChecker{
		manager: manager,
		config:  config,
		client: &http.Client{
			Timeout: config.HealthCheckTimeout,
		},
	}
}

// Start begins periodic health checking.
func (h *HealthChecker) Start(ctx context.Context) {
	ticker := time.NewTicker(h.config.HealthCheckInterval)
	defer ticker.Stop()

	// Initial check
	h.checkAll(ctx)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			h.checkAll(ctx)
		}
	}
}

// checkAll checks the health of all providers.
func (h *HealthChecker) checkAll(ctx context.Context) {
	networks := h.manager.GetNetworks()

	for _, network := range networks {
		providers := h.manager.GetAllProviders(network)
		for _, p := range providers {
			go h.checkProvider(ctx, p)
		}
	}
}

// checkProvider checks the health of a single provider.
func (h *HealthChecker) checkProvider(ctx context.Context, p *Provider) {
	start := time.Now()

	var healthy bool
	var err error

	// Determine health check method based on URL pattern
	switch {
	case strings.Contains(p.URL, "toncenter"):
		healthy, err = h.checkTON(ctx, p.URL)
	case strings.Contains(p.URL, "trongrid") || strings.Contains(p.URL, "tron"):
		healthy, err = h.checkTRON(ctx, p.URL)
	case strings.Contains(p.URL, "solana"):
		healthy, err = h.checkSolana(ctx, p.URL)
	case strings.Contains(p.URL, "near"):
		healthy, err = h.checkNEAR(ctx, p.URL)
	case strings.Contains(p.URL, "aptos"):
		healthy, err = h.checkAptos(ctx, p.URL)
	case strings.Contains(p.URL, "tezos") || strings.Contains(p.URL, "tzkt") || strings.Contains(p.URL, "teztnets"):
		healthy, err = h.checkTezos(ctx, p.URL)
	case strings.Contains(p.URL, "polkadot") || strings.Contains(p.URL, "subscan"):
		healthy, err = h.checkPolkadot(ctx, p.URL)
	case strings.Contains(p.URL, "stacks") || strings.Contains(p.URL, "hiro"):
		healthy, err = h.checkStacks(ctx, p.URL)
	default:
		// Default to EVM JSON-RPC check
		healthy, err = h.checkEVM(ctx, p.URL)
	}

	latency := time.Since(start)

	if err != nil {
		healthy = false
	}

	p.SetHealthy(healthy, latency)

	// Update circuit breaker
	if healthy {
		h.manager.ReportSuccess(p.URL)
	} else {
		h.manager.ReportFailure(p.URL)
	}
}

// checkEVM checks an EVM RPC endpoint.
func (h *HealthChecker) checkEVM(ctx context.Context, url string) (bool, error) {
	payload := map[string]interface{}{
		"jsonrpc": "2.0",
		"method":  "eth_blockNumber",
		"params":  []interface{}{},
		"id":      1,
	}
	return h.doJSONRPCRequest(ctx, url, payload)
}

// checkTON checks a TON RPC endpoint.
func (h *HealthChecker) checkTON(ctx context.Context, url string) (bool, error) {
	// TON uses REST-style API
	checkURL := strings.TrimSuffix(url, "/") + "/api/v2/getMasterchainInfo"
	if strings.Contains(url, "/api/") {
		// URL already contains API path
		checkURL = url
		if !strings.HasSuffix(checkURL, "getMasterchainInfo") {
			checkURL = strings.TrimSuffix(checkURL, "/") + "/getMasterchainInfo"
		}
	}

	resp, err := h.doHTTPGet(ctx, checkURL)
	if err != nil {
		return false, err
	}

	var result map[string]interface{}
	if err := json.Unmarshal(resp, &result); err != nil {
		return false, err
	}

	ok, _ := result["ok"].(bool)
	return ok, nil
}

// checkTRON checks a TRON RPC endpoint.
func (h *HealthChecker) checkTRON(ctx context.Context, url string) (bool, error) {
	checkURL := strings.TrimSuffix(url, "/") + "/wallet/getnowblock"

	resp, err := h.doHTTPGet(ctx, checkURL)
	if err != nil {
		return false, err
	}

	var result map[string]interface{}
	if err := json.Unmarshal(resp, &result); err != nil {
		return false, err
	}

	_, hasBlockID := result["blockID"]
	return hasBlockID, nil
}

// checkSolana checks a Solana RPC endpoint.
func (h *HealthChecker) checkSolana(ctx context.Context, url string) (bool, error) {
	payload := map[string]interface{}{
		"jsonrpc": "2.0",
		"method":  "getSlot",
		"params":  []interface{}{},
		"id":      1,
	}
	return h.doJSONRPCRequest(ctx, url, payload)
}

// checkNEAR checks a NEAR RPC endpoint.
func (h *HealthChecker) checkNEAR(ctx context.Context, url string) (bool, error) {
	payload := map[string]interface{}{
		"jsonrpc": "2.0",
		"method":  "status",
		"params":  []interface{}{},
		"id":      1,
	}
	return h.doJSONRPCRequest(ctx, url, payload)
}

// checkAptos checks an Aptos RPC endpoint.
func (h *HealthChecker) checkAptos(ctx context.Context, url string) (bool, error) {
	checkURL := strings.TrimSuffix(url, "/")
	if !strings.HasSuffix(checkURL, "/v1") {
		checkURL += "/v1"
	}

	resp, err := h.doHTTPGet(ctx, checkURL)
	if err != nil {
		return false, err
	}

	var result map[string]interface{}
	if err := json.Unmarshal(resp, &result); err != nil {
		return false, err
	}

	_, hasChainID := result["chain_id"]
	return hasChainID, nil
}

// checkTezos checks a Tezos RPC endpoint.
func (h *HealthChecker) checkTezos(ctx context.Context, url string) (bool, error) {
	checkURL := strings.TrimSuffix(url, "/") + "/chains/main/chain_id"

	resp, err := h.doHTTPGet(ctx, checkURL)
	if err != nil {
		return false, err
	}

	// Response should be a quoted string like "NetXdQprcVkpaWU"
	return len(resp) > 2 && resp[0] == '"', nil
}

// checkPolkadot checks a Polkadot RPC endpoint.
func (h *HealthChecker) checkPolkadot(ctx context.Context, url string) (bool, error) {
	payload := map[string]interface{}{
		"jsonrpc": "2.0",
		"method":  "system_chain",
		"params":  []interface{}{},
		"id":      1,
	}
	return h.doJSONRPCRequest(ctx, url, payload)
}

// checkStacks checks a Stacks RPC endpoint.
func (h *HealthChecker) checkStacks(ctx context.Context, url string) (bool, error) {
	checkURL := strings.TrimSuffix(url, "/") + "/v2/info"

	resp, err := h.doHTTPGet(ctx, checkURL)
	if err != nil {
		return false, err
	}

	var result map[string]interface{}
	if err := json.Unmarshal(resp, &result); err != nil {
		return false, err
	}

	_, hasNetworkID := result["network_id"]
	return hasNetworkID, nil
}

// doJSONRPCRequest performs a JSON-RPC request and checks for a valid response.
func (h *HealthChecker) doJSONRPCRequest(ctx context.Context, url string, payload interface{}) (bool, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return false, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return false, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := h.client.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return false, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return false, err
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return false, err
	}

	// Check for JSON-RPC error
	if _, hasError := result["error"]; hasError {
		return false, fmt.Errorf("RPC error in response")
	}

	// Check for result
	_, hasResult := result["result"]
	return hasResult, nil
}

// doHTTPGet performs an HTTP GET request.
func (h *HealthChecker) doHTTPGet(ctx context.Context, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := h.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	return io.ReadAll(resp.Body)
}
