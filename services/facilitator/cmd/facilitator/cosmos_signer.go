package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/t402-io/t402/sdks/go/mechanisms/cosmos"
)

// facilitatorCosmosSigner implements the FacilitatorCosmosSigner interface
type facilitatorCosmosSigner struct {
	addresses  map[string]string // network -> address
	restURLs   map[string]string // network -> REST API URL
	httpClient *http.Client
}

// CosmosSignerConfig configures the Cosmos signer
type CosmosSignerConfig struct {
	// MainnetAddress is the facilitator's Noble mainnet address
	MainnetAddress string
	// TestnetAddress is the facilitator's Noble testnet address
	TestnetAddress string
	// MainnetREST is the Noble mainnet REST API endpoint
	MainnetREST string
	// TestnetREST is the Noble testnet REST API endpoint
	TestnetREST string
}

// newFacilitatorCosmosSigner creates a new Cosmos facilitator signer
func newFacilitatorCosmosSigner(mainnetREST, testnetREST, mainnetAddr, testnetAddr string) *facilitatorCosmosSigner {
	signer := &facilitatorCosmosSigner{
		addresses:  make(map[string]string),
		restURLs:   make(map[string]string),
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}

	// Set up REST endpoints
	if mainnetREST != "" {
		signer.restURLs[cosmos.NobleMainnetCAIP2] = mainnetREST
	} else {
		signer.restURLs[cosmos.NobleMainnetCAIP2] = cosmos.NobleMainnetREST
	}

	if testnetREST != "" {
		signer.restURLs[cosmos.NobleTestnetCAIP2] = testnetREST
	} else {
		signer.restURLs[cosmos.NobleTestnetCAIP2] = cosmos.NobleTestnetREST
	}

	// Set up addresses
	if mainnetAddr != "" {
		signer.addresses[cosmos.NobleMainnetCAIP2] = mainnetAddr
	}
	if testnetAddr != "" {
		signer.addresses[cosmos.NobleTestnetCAIP2] = testnetAddr
	}

	return signer
}

// GetAddresses returns the facilitator's Cosmos addresses for a network
func (s *facilitatorCosmosSigner) GetAddresses(ctx context.Context, network string) []string {
	// For exact-direct scheme, we return the facilitator's receive address
	// This is used for verification that payments were sent to the correct address
	if addr, ok := s.addresses[network]; ok {
		return []string{addr}
	}
	return []string{}
}

// getRESTURL returns the REST API URL for a network
func (s *facilitatorCosmosSigner) getRESTURL(network string) (string, error) {
	if url, ok := s.restURLs[network]; ok && url != "" {
		return url, nil
	}

	config, ok := cosmos.GetNetworkConfig(network)
	if !ok {
		return "", fmt.Errorf("unsupported network: %s", network)
	}
	return config.RESTURL, nil
}

// QueryTransaction queries a transaction by hash using the REST API
func (s *facilitatorCosmosSigner) QueryTransaction(ctx context.Context, network, txHash string) (*cosmos.TransactionResult, error) {
	restURL, err := s.getRESTURL(network)
	if err != nil {
		return nil, err
	}

	// Build REST API request
	// Noble uses Cosmos SDK REST API: /cosmos/tx/v1beta1/txs/{hash}
	url := fmt.Sprintf("%s/cosmos/tx/v1beta1/txs/%s", restURL, txHash)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to query transaction: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, nil // Transaction not found
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("REST API error: %s - %s", resp.Status, string(body))
	}

	// Parse response
	var restResp cosmos.RESTTxResponse
	if err := json.NewDecoder(resp.Body).Decode(&restResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return restResp.ToTransactionResult(), nil
}

// GetBalance gets the token balance for an account
func (s *facilitatorCosmosSigner) GetBalance(ctx context.Context, network, address, denom string) (string, error) {
	restURL, err := s.getRESTURL(network)
	if err != nil {
		return "0", err
	}

	// Build REST API request
	// Noble uses Cosmos SDK REST API: /cosmos/bank/v1beta1/balances/{address}/by_denom?denom={denom}
	url := fmt.Sprintf("%s/cosmos/bank/v1beta1/balances/%s/by_denom?denom=%s", restURL, address, denom)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return "0", fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "0", fmt.Errorf("failed to query balance: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "0", fmt.Errorf("REST API error: %s - %s", resp.Status, string(body))
	}

	// Parse response
	var balanceResp cosmos.BalanceResponse
	if err := json.NewDecoder(resp.Body).Decode(&balanceResp); err != nil {
		return "0", fmt.Errorf("failed to decode response: %w", err)
	}

	return balanceResp.Balance.Amount, nil
}

// QueryTxByEvent queries transactions by events (useful for finding transfers)
func (s *facilitatorCosmosSigner) QueryTxByEvent(ctx context.Context, network string, events []string) ([]cosmos.TransactionResult, error) {
	restURL, err := s.getRESTURL(network)
	if err != nil {
		return nil, err
	}

	// Build query string
	eventQuery := ""
	for i, event := range events {
		if i > 0 {
			eventQuery += "&"
		}
		eventQuery += "events=" + event
	}

	url := fmt.Sprintf("%s/cosmos/tx/v1beta1/txs?%s", restURL, eventQuery)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to query transactions: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("REST API error: %s - %s", resp.Status, string(body))
	}

	// Parse response
	var txsResp struct {
		Txs         []cosmos.TxWrapper `json:"txs"`
		TxResponses []cosmos.TxResponse `json:"tx_responses"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&txsResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	results := make([]cosmos.TransactionResult, len(txsResp.TxResponses))
	for i, txResp := range txsResp.TxResponses {
		results[i] = cosmos.TransactionResult{
			TxHash:    txResp.TxHash,
			Height:    txResp.Height,
			Code:      txResp.Code,
			RawLog:    txResp.RawLog,
			Logs:      txResp.Logs,
			GasWanted: txResp.GasWanted,
			GasUsed:   txResp.GasUsed,
			Timestamp: txResp.Timestamp,
		}
		if i < len(txsResp.Txs) {
			results[i].Tx = txsResp.Txs[i]
		}
	}

	return results, nil
}

// BroadcastTx broadcasts a signed transaction
func (s *facilitatorCosmosSigner) BroadcastTx(ctx context.Context, network string, txBytes []byte, mode string) (*cosmos.TransactionResult, error) {
	restURL, err := s.getRESTURL(network)
	if err != nil {
		return nil, err
	}

	// Build broadcast request
	reqBody := map[string]interface{}{
		"tx_bytes": txBytes,
		"mode":     mode, // BROADCAST_MODE_SYNC, BROADCAST_MODE_ASYNC, BROADCAST_MODE_BLOCK
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/cosmos/tx/v1beta1/txs", restURL)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to broadcast transaction: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("REST API error: %s - %s", resp.Status, string(body))
	}

	// Parse response
	var broadcastResp struct {
		TxResponse cosmos.TxResponse `json:"tx_response"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&broadcastResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &cosmos.TransactionResult{
		TxHash:    broadcastResp.TxResponse.TxHash,
		Height:    broadcastResp.TxResponse.Height,
		Code:      broadcastResp.TxResponse.Code,
		RawLog:    broadcastResp.TxResponse.RawLog,
		GasWanted: broadcastResp.TxResponse.GasWanted,
		GasUsed:   broadcastResp.TxResponse.GasUsed,
	}, nil
}
