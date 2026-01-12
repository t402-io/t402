package main

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/t402-io/t402/go/mechanisms/ton"
)

// facilitatorTonSigner implements the FacilitatorTonSigner interface
type facilitatorTonSigner struct {
	addresses map[string]string // network -> address
	endpoints map[string]string // network -> RPC endpoint
	publicKey ed25519.PublicKey
}

// TonSignerConfig configures the TON signer
type TonSignerConfig struct {
	// Mnemonic is the 24-word mnemonic phrase (if using mnemonic-based derivation)
	Mnemonic string
	// PrivateKeyHex is the 64-character hex-encoded Ed25519 private key (alternative to mnemonic)
	PrivateKeyHex string
	// MainnetAddress is the pre-computed mainnet wallet address (required if using mnemonic)
	MainnetAddress string
	// TestnetAddress is the pre-computed testnet wallet address (required if using mnemonic)
	TestnetAddress string
	// MainnetRPC is the TON mainnet RPC endpoint
	MainnetRPC string
	// TestnetRPC is the TON testnet RPC endpoint
	TestnetRPC string
}

// newFacilitatorTonSigner creates a new TON facilitator signer
//
// Due to the complexity of TON wallet address derivation (which requires wallet
// contract code hash computation and StateInit cell creation), this implementation
// requires pre-computed wallet addresses to be provided via environment variables:
//   - TON_MAINNET_ADDRESS: Your TON mainnet wallet address
//   - TON_TESTNET_ADDRESS: Your TON testnet wallet address
//
// The mnemonic or private key is used for signing operations.
func newFacilitatorTonSigner(mnemonic string, mainnetRPC string, testnetRPC string) (*facilitatorTonSigner, error) {
	if mnemonic == "" {
		return nil, fmt.Errorf("TON_MNEMONIC is required")
	}

	// Parse the mnemonic to derive the Ed25519 keypair
	var privateKey ed25519.PrivateKey

	words := strings.Fields(mnemonic)
	if len(words) == 1 && len(words[0]) == 64 {
		// Treat as hex-encoded private key
		seed, err := hex.DecodeString(words[0])
		if err != nil {
			return nil, fmt.Errorf("invalid private key hex: %w", err)
		}
		privateKey = ed25519.NewKeyFromSeed(seed)
	} else if len(words) == 24 {
		// Derive key from mnemonic using simplified derivation
		// Note: This uses a simplified derivation for compatibility.
		// For production with specific wallet types, use external tools to derive the key.
		seed := deriveTonSeed(words)
		privateKey = ed25519.NewKeyFromSeed(seed)
	} else {
		return nil, fmt.Errorf("TON_MNEMONIC must be 24 words or a 64-character hex private key, got %d words", len(words))
	}

	publicKey := privateKey.Public().(ed25519.PublicKey)

	signer := &facilitatorTonSigner{
		addresses: make(map[string]string),
		endpoints: make(map[string]string),
		publicKey: publicKey,
	}

	// Set up endpoints and addresses
	// Addresses should be set via environment variables for production use
	if mainnetRPC != "" {
		signer.endpoints[ton.TonMainnetCAIP2] = mainnetRPC
	}
	if testnetRPC != "" {
		signer.endpoints[ton.TonTestnetCAIP2] = testnetRPC
	}

	return signer, nil
}

// deriveTonSeed derives a 32-byte seed from a 24-word mnemonic
// This is a simplified derivation - for production wallets, use proper TON SDK
func deriveTonSeed(words []string) []byte {
	// Join words and hash to create deterministic seed
	// Note: Real TON uses PBKDF2 with HMAC-SHA512, 100000 iterations
	// This simplified version is for basic functionality
	joined := strings.Join(words, " ")
	seed := make([]byte, 32)
	copy(seed, []byte(joined))
	return seed
}

// newFacilitatorTonSignerWithAddresses creates a TON signer with explicit addresses
func newFacilitatorTonSignerWithAddresses(mnemonic, mainnetRPC, testnetRPC, mainnetAddr, testnetAddr string) (*facilitatorTonSigner, error) {
	signer, err := newFacilitatorTonSigner(mnemonic, mainnetRPC, testnetRPC)
	if err != nil {
		return nil, err
	}

	// Set explicit addresses
	if mainnetAddr != "" {
		signer.addresses[ton.TonMainnetCAIP2] = mainnetAddr
	}
	if testnetAddr != "" {
		signer.addresses[ton.TonTestnetCAIP2] = testnetAddr
	}

	return signer, nil
}

func (s *facilitatorTonSigner) GetAddresses(ctx context.Context, network string) []string {
	if addr, ok := s.addresses[network]; ok {
		return []string{addr}
	}
	// Return addresses for all networks if specific network not found
	addrs := make([]string, 0, len(s.addresses))
	for _, addr := range s.addresses {
		addrs = append(addrs, addr)
	}
	return addrs
}

func (s *facilitatorTonSigner) getEndpoint(network string) (string, error) {
	if endpoint, ok := s.endpoints[network]; ok {
		return endpoint, nil
	}
	config, err := ton.GetNetworkConfig(network)
	if err != nil {
		return "", err
	}
	return config.Endpoint, nil
}

// tonRPCRequest makes a JSON-RPC request to the TON API
func (s *facilitatorTonSigner) tonRPCRequest(ctx context.Context, network string, method string, params map[string]interface{}) (json.RawMessage, error) {
	endpoint, err := s.getEndpoint(network)
	if err != nil {
		return nil, err
	}

	reqBody := map[string]interface{}{
		"id":      1,
		"jsonrpc": "2.0",
		"method":  method,
		"params":  params,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", endpoint, bytes.NewReader(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var rpcResp struct {
		Result json.RawMessage `json:"result"`
		Error  *struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}

	if err := json.Unmarshal(body, &rpcResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if rpcResp.Error != nil {
		return nil, fmt.Errorf("RPC error %d: %s", rpcResp.Error.Code, rpcResp.Error.Message)
	}

	return rpcResp.Result, nil
}

func (s *facilitatorTonSigner) GetJettonBalance(ctx context.Context, params ton.GetJettonBalanceParams) (string, error) {
	// First get the Jetton wallet address
	jettonWallet, err := s.GetJettonWalletAddress(ctx, ton.GetJettonWalletParams{
		OwnerAddress:        params.OwnerAddress,
		JettonMasterAddress: params.JettonMasterAddress,
		Network:             params.Network,
	})
	if err != nil {
		return "0", nil // No wallet means 0 balance
	}

	// Then get the wallet state to read balance
	result, err := s.tonRPCRequest(ctx, params.Network, "runGetMethod", map[string]interface{}{
		"address": jettonWallet,
		"method":  "get_wallet_data",
		"stack":   []interface{}{},
	})
	if err != nil {
		return "0", nil // Contract might not exist
	}

	var methodResult struct {
		ExitCode int           `json:"exit_code"`
		Stack    []interface{} `json:"stack"`
	}
	if err := json.Unmarshal(result, &methodResult); err != nil {
		return "0", nil
	}

	if methodResult.ExitCode != 0 || len(methodResult.Stack) == 0 {
		return "0", nil
	}

	// First element is balance
	if balanceData, ok := methodResult.Stack[0].([]interface{}); ok && len(balanceData) >= 2 {
		if balanceStr, ok := balanceData[1].(string); ok {
			// Parse hex balance
			if strings.HasPrefix(balanceStr, "0x") {
				balanceStr = balanceStr[2:]
			}
			balance, err := strconv.ParseUint(balanceStr, 16, 64)
			if err == nil {
				return strconv.FormatUint(balance, 10), nil
			}
		}
	}

	return "0", nil
}

func (s *facilitatorTonSigner) GetJettonWalletAddress(ctx context.Context, params ton.GetJettonWalletParams) (string, error) {
	// Call get_wallet_address on Jetton master
	result, err := s.tonRPCRequest(ctx, params.Network, "runGetMethod", map[string]interface{}{
		"address": params.JettonMasterAddress,
		"method":  "get_wallet_address",
		"stack": []interface{}{
			[]interface{}{"tvm.Slice", params.OwnerAddress},
		},
	})
	if err != nil {
		return "", fmt.Errorf("failed to get wallet address: %w", err)
	}

	var methodResult struct {
		ExitCode int           `json:"exit_code"`
		Stack    []interface{} `json:"stack"`
	}
	if err := json.Unmarshal(result, &methodResult); err != nil {
		return "", fmt.Errorf("failed to parse result: %w", err)
	}

	if methodResult.ExitCode != 0 {
		return "", fmt.Errorf("get_wallet_address failed with exit code %d", methodResult.ExitCode)
	}

	if len(methodResult.Stack) == 0 {
		return "", fmt.Errorf("empty stack returned")
	}

	// Parse the cell address from stack
	if sliceData, ok := methodResult.Stack[0].([]interface{}); ok && len(sliceData) >= 2 {
		if addrStr, ok := sliceData[1].(string); ok {
			return addrStr, nil
		}
	}

	return "", fmt.Errorf("failed to parse wallet address from response")
}

func (s *facilitatorTonSigner) VerifyMessage(ctx context.Context, params ton.VerifyMessageParams) (*ton.VerifyMessageResult, error) {
	// Decode the BOC
	bocBytes, err := base64.StdEncoding.DecodeString(params.SignedBoc)
	if err != nil {
		return &ton.VerifyMessageResult{
			Valid:  false,
			Reason: "invalid_boc_encoding",
		}, nil
	}

	// Basic validation - BOC should be at least 4 bytes
	if len(bocBytes) < 4 {
		return &ton.VerifyMessageResult{
			Valid:  false,
			Reason: "boc_too_short",
		}, nil
	}

	// For now, we do basic validation
	// Full implementation would parse the BOC and verify:
	// - Message structure
	// - Sender address matches expectedFrom
	// - Transfer details match expectedTransfer

	return &ton.VerifyMessageResult{
		Valid: true,
	}, nil
}

func (s *facilitatorTonSigner) SendExternalMessage(ctx context.Context, signedBoc string, network string) (string, error) {
	result, err := s.tonRPCRequest(ctx, network, "sendBoc", map[string]interface{}{
		"boc": signedBoc,
	})
	if err != nil {
		return "", fmt.Errorf("failed to send message: %w", err)
	}

	var sendResult struct {
		Hash string `json:"hash"`
	}
	if err := json.Unmarshal(result, &sendResult); err != nil {
		// Some APIs return just success
		return "pending", nil
	}

	if sendResult.Hash != "" {
		return sendResult.Hash, nil
	}

	return "pending", nil
}

func (s *facilitatorTonSigner) WaitForTransaction(ctx context.Context, params ton.WaitForTransactionParams) (*ton.TransactionConfirmation, error) {
	timeout := params.Timeout
	if timeout == 0 {
		timeout = 60000 // 60 seconds default
	}

	deadline := time.Now().Add(time.Duration(timeout) * time.Millisecond)
	interval := 2 * time.Second

	for time.Now().Before(deadline) {
		// Check if seqno has increased
		currentSeqno, err := s.GetSeqno(ctx, params.Address, params.Network)
		if err == nil && currentSeqno >= params.Seqno {
			// Transaction confirmed
			return &ton.TransactionConfirmation{
				Success: true,
			}, nil
		}

		select {
		case <-ctx.Done():
			return &ton.TransactionConfirmation{
				Success: false,
				Error:   "context cancelled",
			}, nil
		case <-time.After(interval):
			continue
		}
	}

	return &ton.TransactionConfirmation{
		Success: false,
		Error:   "timeout waiting for transaction",
	}, nil
}

func (s *facilitatorTonSigner) GetSeqno(ctx context.Context, address string, network string) (int64, error) {
	result, err := s.tonRPCRequest(ctx, network, "runGetMethod", map[string]interface{}{
		"address": address,
		"method":  "seqno",
		"stack":   []interface{}{},
	})
	if err != nil {
		return 0, fmt.Errorf("failed to get seqno: %w", err)
	}

	var methodResult struct {
		ExitCode int           `json:"exit_code"`
		Stack    []interface{} `json:"stack"`
	}
	if err := json.Unmarshal(result, &methodResult); err != nil {
		return 0, fmt.Errorf("failed to parse result: %w", err)
	}

	if methodResult.ExitCode != 0 {
		return 0, nil // Wallet might not be deployed yet
	}

	if len(methodResult.Stack) == 0 {
		return 0, nil
	}

	// Parse seqno from stack
	if numData, ok := methodResult.Stack[0].([]interface{}); ok && len(numData) >= 2 {
		switch v := numData[1].(type) {
		case float64:
			return int64(v), nil
		case string:
			// Parse hex
			if strings.HasPrefix(v, "0x") {
				v = v[2:]
			}
			seqno, err := strconv.ParseInt(v, 16, 64)
			if err == nil {
				return seqno, nil
			}
		}
	}

	return 0, nil
}

func (s *facilitatorTonSigner) IsDeployed(ctx context.Context, address string, network string) (bool, error) {
	result, err := s.tonRPCRequest(ctx, network, "getAddressInformation", map[string]interface{}{
		"address": address,
	})
	if err != nil {
		return false, nil // Assume not deployed if we can't check
	}

	var addrInfo struct {
		State string `json:"state"`
	}
	if err := json.Unmarshal(result, &addrInfo); err != nil {
		return false, nil
	}

	return addrInfo.State == "active", nil
}
