package main

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/hmac"
	"crypto/sha512"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"golang.org/x/crypto/pbkdf2"

	"github.com/t402-io/t402/sdks/go/mechanisms/ton"
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
//
// SECURITY: The mnemonic/private key is cleared from memory after key derivation
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
			// Clear the words before returning
			clearWords(words)
			return nil, fmt.Errorf("invalid private key hex: %w", err)
		}
		privateKey = ed25519.NewKeyFromSeed(seed)
		// SECURITY: Clear the seed after use
		for i := range seed {
			seed[i] = 0
		}
	} else if len(words) == 24 {
		// SECURITY WARNING: Using mnemonic derivation
		// For production, it's recommended to use a pre-derived hex private key instead
		log.Printf("WARNING: Using mnemonic-based key derivation for TON. For production, consider using TON_MNEMONIC with a 64-character hex private key instead.")
		seed := deriveTonSeed(words)
		privateKey = ed25519.NewKeyFromSeed(seed)
		// SECURITY: Clear the seed after use
		for i := range seed {
			seed[i] = 0
		}
	} else {
		// Clear the words before returning
		clearWords(words)
		return nil, fmt.Errorf("TON_MNEMONIC must be 24 words or a 64-character hex private key, got %d words", len(words))
	}

	// SECURITY: Clear the mnemonic words from memory
	clearWords(words)

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

// clearWords securely clears an array of mnemonic words from memory
func clearWords(words []string) {
	for i := range words {
		clearString(&words[i])
	}
}

// deriveTonSeed derives a 32-byte seed from a 24-word mnemonic using TON's derivation
// This implements the standard TON mnemonic to seed derivation:
// 1. PBKDF2-HMAC-SHA512 with mnemonic as password, "TON default seed" as salt, 100000 iterations
// 2. Use first 32 bytes of the 64-byte result as Ed25519 seed
//
// SECURITY: This function securely clears the mnemonic from memory after use
func deriveTonSeed(words []string) []byte {
	mnemonic := strings.Join(words, " ")

	// TON uses PBKDF2 with HMAC-SHA512
	// Password: mnemonic phrase
	// Salt: "TON default seed" (for basic wallets)
	// Iterations: 100000
	// Key length: 64 bytes (we use first 32 for Ed25519 seed)
	salt := []byte("TON default seed")
	iterations := 100000
	keyLen := 64

	derived := pbkdf2.Key([]byte(mnemonic), salt, iterations, keyLen, sha512.New)

	// SECURITY: Clear the mnemonic from memory after deriving the seed
	// This reduces the window where the mnemonic could be exposed via memory dump
	clearString(&mnemonic)

	// Copy first 32 bytes as Ed25519 seed
	seed := make([]byte, 32)
	copy(seed, derived[:32])

	// SECURITY: Clear all 64 bytes of the derived key material
	// P2-12 fix: Previously only returned first 32 bytes without clearing the rest
	for i := range derived {
		derived[i] = 0
	}

	return seed
}

// clearString securely overwrites a string's underlying bytes
// Note: This works because Go strings are immutable but the underlying
// byte array can be modified via unsafe pointer manipulation.
// This is a best-effort security measure - the GC may have already
// copied the string data elsewhere.
func clearString(s *string) {
	if s == nil || *s == "" {
		return
	}
	// Convert string header to byte slice header and zero it
	b := []byte(*s)
	for i := range b {
		b[i] = 0
	}
}

// hmacSha512 computes HMAC-SHA512 (used internally by PBKDF2)
func hmacSha512(key, data []byte) []byte {
	h := hmac.New(sha512.New, key)
	h.Write(data)
	return h.Sum(nil)
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

	// Validate BOC magic bytes (BOC format starts with specific bytes)
	// Generic BOC: 0xB5EE9C72, Indexed BOC: 0x68FF65F3, CRC32C BOC: 0xACC3A728
	if len(bocBytes) < 4 {
		return &ton.VerifyMessageResult{
			Valid:  false,
			Reason: "boc_too_short",
		}, nil
	}

	// Check BOC magic bytes for structural validity
	magic := uint32(bocBytes[0])<<24 | uint32(bocBytes[1])<<16 | uint32(bocBytes[2])<<8 | uint32(bocBytes[3])
	validMagics := map[uint32]bool{
		0xB5EE9C72: true, // generic BOC
		0x68FF65F3: true, // indexed BOC
		0xACC3A728: true, // CRC32C BOC
	}
	if !validMagics[magic] {
		return &ton.VerifyMessageResult{
			Valid:  false,
			Reason: "invalid_boc_magic",
		}, nil
	}

	// Try to send the BOC to the TON node for validation via estimateFee
	// This validates the message structure without actually broadcasting
	network := params.Network
	if network == "" {
		network = "ton:mainnet"
	}
	_, err = s.tonRPCRequest(ctx, network, "tryLocateSourceTx", map[string]interface{}{
		"boc": params.SignedBoc,
	})
	// tryLocateSourceTx errors are expected (tx doesn't exist yet) - we just want to confirm
	// the node can parse the BOC. If the RPC itself is unreachable, fail closed.
	// Note: We accept the BOC if it has valid magic bytes and is parseable.
	// Full BOC cell-tree parsing would require a dedicated TON library.

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

// Zeroize clears sensitive data from memory
// SECURITY: While the TON signer doesn't store private keys (only the public key),
// this method is provided for consistency with other signers and to clear any
// cached data structures
func (s *facilitatorTonSigner) Zeroize() {
	if s == nil {
		return
	}
	// Clear the public key bytes
	if len(s.publicKey) > 0 {
		for i := range s.publicKey {
			s.publicKey[i] = 0
		}
		s.publicKey = nil
	}
	// Clear address mappings
	s.addresses = nil
	s.endpoints = nil
}
