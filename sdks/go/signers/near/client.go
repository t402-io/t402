// Package near provides a NEAR signer implementation using Ed25519 for t402 payments.
//
// This package enables NEP-141 fungible token transfers for the t402 payment protocol.
// NEAR uses Ed25519 for transaction signing and Borsh serialization.
package near

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/mr-tron/base58"
)

// DefaultFtTransferGas is the default gas for ft_transfer (30 TGas)
const DefaultFtTransferGas = 30_000_000_000_000

// FtTransferDeposit is the required deposit for ft_transfer (1 yoctoNEAR)
const FtTransferDeposit = "1"

// DefaultTimeout is the default transaction validity duration
const DefaultTimeout = 300 // 5 minutes

// ClientSigner implements the NEAR client signer interface using an Ed25519 private key.
type ClientSigner struct {
	privateKey ed25519.PrivateKey
	publicKey  ed25519.PublicKey
	accountID  string
	endpoint   string
	httpClient *http.Client
}

// Config contains configuration for creating a ClientSigner
type Config struct {
	// AccountID is the NEAR account ID (e.g., "alice.near")
	AccountID string
	// Endpoint is the NEAR RPC endpoint URL or "mainnet"/"testnet" for default endpoints
	Endpoint string
}

// NewClientSignerFromPrivateKey creates a client signer from a base58-encoded Ed25519 private key.
//
// Args:
//
//	privateKeyBase58: Base58-encoded Ed25519 private key (or "ed25519:" prefixed)
//	config: Configuration with account ID and endpoint
//
// Returns:
//
//	ClientSigner implementation
//	Error if private key is invalid
//
// Example:
//
//	signer, err := near.NewClientSignerFromPrivateKey("ed25519:...", &near.Config{
//	    AccountID: "alice.near",
//	    Endpoint:  "mainnet",
//	})
func NewClientSignerFromPrivateKey(privateKeyBase58 string, config *Config) (*ClientSigner, error) {
	if config == nil || config.AccountID == "" {
		return nil, fmt.Errorf("account ID is required")
	}

	// Strip ed25519: prefix if present
	privateKeyBase58 = strings.TrimPrefix(privateKeyBase58, "ed25519:")

	// Decode base58
	privateKeyBytes, err := base58.Decode(privateKeyBase58)
	if err != nil {
		return nil, fmt.Errorf("invalid base58 private key: %w", err)
	}

	// NEAR private keys are 64 bytes (seed + public key) or 32 bytes (seed only)
	var privateKey ed25519.PrivateKey
	if len(privateKeyBytes) == 64 {
		privateKey = ed25519.PrivateKey(privateKeyBytes)
	} else if len(privateKeyBytes) == 32 {
		privateKey = ed25519.NewKeyFromSeed(privateKeyBytes)
	} else {
		return nil, fmt.Errorf("invalid private key length: expected 32 or 64 bytes, got %d", len(privateKeyBytes))
	}

	return newClientSignerFromKey(privateKey, config)
}

// NewClientSignerFromSeed creates a client signer from a hex-encoded 32-byte seed.
//
// Args:
//
//	seedHex: Hex-encoded 32-byte seed (with or without "0x" prefix)
//	config: Configuration with account ID and endpoint
//
// Returns:
//
//	ClientSigner implementation
//	Error if seed is invalid
func NewClientSignerFromSeed(seedHex string, config *Config) (*ClientSigner, error) {
	if config == nil || config.AccountID == "" {
		return nil, fmt.Errorf("account ID is required")
	}

	// Strip 0x prefix if present
	seedHex = strings.TrimPrefix(seedHex, "0x")

	// Decode hex
	seedBytes, err := hex.DecodeString(seedHex)
	if err != nil {
		return nil, fmt.Errorf("invalid hex seed: %w", err)
	}

	if len(seedBytes) != 32 {
		return nil, fmt.Errorf("invalid seed length: expected 32 bytes, got %d", len(seedBytes))
	}

	privateKey := ed25519.NewKeyFromSeed(seedBytes)
	return newClientSignerFromKey(privateKey, config)
}

// newClientSignerFromKey creates a client signer from an Ed25519 private key
func newClientSignerFromKey(privateKey ed25519.PrivateKey, config *Config) (*ClientSigner, error) {
	// Extract public key
	publicKey := privateKey.Public().(ed25519.PublicKey)

	// Validate account ID
	if !IsValidAccountID(config.AccountID) {
		return nil, fmt.Errorf("invalid account ID: %s", config.AccountID)
	}

	// Select endpoint
	endpoint := resolveEndpoint(config.Endpoint)

	return &ClientSigner{
		privateKey: privateKey,
		publicKey:  publicKey,
		accountID:  config.AccountID,
		endpoint:   endpoint,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}, nil
}

// AccountID returns the signer's NEAR account ID.
func (s *ClientSigner) AccountID() string {
	return s.accountID
}

// PublicKeyBase58 returns the public key in NEAR's base58 format with ed25519: prefix.
func (s *ClientSigner) PublicKeyBase58() string {
	return "ed25519:" + base58.Encode(s.publicKey)
}

// SignAndSendTransaction signs and sends a function call transaction to NEAR.
//
// Args:
//
//	ctx: Context for cancellation
//	receiverID: Contract to call
//	methodName: Method to call
//	args: Method arguments (will be JSON-encoded)
//	gas: Gas to attach (in gas units)
//	deposit: yoctoNEAR to attach
//
// Returns:
//
//	Transaction hash (base58 encoded)
//	Error if transaction fails
func (s *ClientSigner) SignAndSendTransaction(
	ctx context.Context,
	receiverID string,
	methodName string,
	args map[string]interface{},
	gas uint64,
	deposit string,
) (string, error) {
	// Get access key nonce
	nonce, blockHash, err := s.getAccessKeyNonce(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to get access key: %w", err)
	}

	// Encode args as JSON
	argsJSON, err := json.Marshal(args)
	if err != nil {
		return "", fmt.Errorf("failed to encode args: %w", err)
	}

	// Build the transaction
	tx, err := s.buildTransaction(receiverID, nonce+1, blockHash, methodName, argsJSON, gas, deposit)
	if err != nil {
		return "", fmt.Errorf("failed to build transaction: %w", err)
	}

	// Sign the transaction
	signedTx, err := s.signTransaction(tx)
	if err != nil {
		return "", fmt.Errorf("failed to sign transaction: %w", err)
	}

	// Broadcast the transaction
	txHash, err := s.broadcastTransaction(ctx, signedTx)
	if err != nil {
		return "", fmt.Errorf("failed to broadcast transaction: %w", err)
	}

	return txHash, nil
}

// getAccessKeyNonce retrieves the current nonce for the account's access key
func (s *ClientSigner) getAccessKeyNonce(ctx context.Context) (uint64, []byte, error) {
	reqBody := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      "t402",
		"method":  "query",
		"params": map[string]interface{}{
			"request_type": "view_access_key",
			"finality":     "final",
			"account_id":   s.accountID,
			"public_key":   s.PublicKeyBase58(),
		},
	}

	reqBytes, err := json.Marshal(reqBody)
	if err != nil {
		return 0, nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", s.endpoint, bytes.NewReader(reqBytes))
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Result struct {
			Nonce     uint64 `json:"nonce"`
			BlockHash string `json:"block_hash"`
		} `json:"result"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, nil, err
	}

	if result.Error != nil {
		return 0, nil, fmt.Errorf("RPC error: %s", result.Error.Message)
	}

	// Decode block hash from base58
	blockHash, err := base58.Decode(result.Result.BlockHash)
	if err != nil {
		return 0, nil, fmt.Errorf("invalid block hash: %w", err)
	}

	return result.Result.Nonce, blockHash, nil
}

// buildTransaction builds a NEAR transaction (Borsh serialized)
func (s *ClientSigner) buildTransaction(
	receiverID string,
	nonce uint64,
	blockHash []byte,
	methodName string,
	args []byte,
	gas uint64,
	deposit string,
) ([]byte, error) {
	var buf bytes.Buffer

	// Signer ID (string)
	writeString(&buf, s.accountID)

	// Public key (1 byte key type + 32 bytes key)
	buf.WriteByte(0) // ED25519 key type
	buf.Write(s.publicKey)

	// Nonce (u64)
	binary.Write(&buf, binary.LittleEndian, nonce)

	// Receiver ID (string)
	writeString(&buf, receiverID)

	// Block hash (32 bytes)
	buf.Write(blockHash)

	// Actions (vec of actions, we have 1 FunctionCall action)
	binary.Write(&buf, binary.LittleEndian, uint32(1)) // 1 action

	// FunctionCall action
	buf.WriteByte(2) // FunctionCall action type

	// Method name (string)
	writeString(&buf, methodName)

	// Args (bytes)
	writeBytes(&buf, args)

	// Gas (u64)
	binary.Write(&buf, binary.LittleEndian, gas)

	// Deposit (u128 as 16 bytes little-endian)
	depositBytes := parseU128(deposit)
	buf.Write(depositBytes)

	return buf.Bytes(), nil
}

// signTransaction signs a transaction and returns the signed transaction bytes
func (s *ClientSigner) signTransaction(txBytes []byte) ([]byte, error) {
	// Hash the transaction
	hash := sha256.Sum256(txBytes)

	// Sign with Ed25519
	signature := ed25519.Sign(s.privateKey, hash[:])

	// Build signed transaction
	var buf bytes.Buffer

	// Transaction bytes
	buf.Write(txBytes)

	// Signature (1 byte key type + 64 bytes signature)
	buf.WriteByte(0) // ED25519 key type
	buf.Write(signature)

	return buf.Bytes(), nil
}

// broadcastTransaction broadcasts a signed transaction to the network
func (s *ClientSigner) broadcastTransaction(ctx context.Context, signedTx []byte) (string, error) {
	// Encode as base64
	signedTxBase64 := base64.StdEncoding.EncodeToString(signedTx)

	reqBody := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      "t402",
		"method":  "broadcast_tx_commit",
		"params":  []string{signedTxBase64},
	}

	reqBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", s.endpoint, bytes.NewReader(reqBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	var result struct {
		Result struct {
			Status struct {
				SuccessValue *string         `json:"SuccessValue"`
				Failure      json.RawMessage `json:"Failure"`
			} `json:"status"`
			Transaction struct {
				Hash string `json:"hash"`
			} `json:"transaction"`
		} `json:"result"`
		Error *struct {
			Message string          `json:"message"`
			Data    json.RawMessage `json:"data"`
		} `json:"error"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("failed to decode response: %w, body: %s", err, string(body))
	}

	if result.Error != nil {
		return "", fmt.Errorf("RPC error: %s", result.Error.Message)
	}

	if len(result.Result.Status.Failure) > 0 {
		return "", fmt.Errorf("transaction failed: %s", string(result.Result.Status.Failure))
	}

	return result.Result.Transaction.Hash, nil
}

// IsValidAccountID validates a NEAR account ID
func IsValidAccountID(accountID string) bool {
	if len(accountID) < 2 || len(accountID) > 64 {
		return false
	}
	// NEAR account ID regex: lowercase alphanumeric, underscores, hyphens, dots
	// Must not start/end with special chars
	regex := regexp.MustCompile(`^[a-z0-9]([a-z0-9_-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9_-]*[a-z0-9])?)*$`)
	return regex.MatchString(accountID)
}

// resolveEndpoint converts endpoint shortcuts to full URLs
func resolveEndpoint(endpoint string) string {
	switch endpoint {
	case "mainnet", "":
		return "https://rpc.mainnet.near.org"
	case "testnet":
		return "https://rpc.testnet.near.org"
	default:
		return endpoint
	}
}

// writeString writes a Borsh-encoded string (u32 length + bytes)
func writeString(buf *bytes.Buffer, s string) {
	binary.Write(buf, binary.LittleEndian, uint32(len(s)))
	buf.WriteString(s)
}

// writeBytes writes Borsh-encoded bytes (u32 length + bytes)
func writeBytes(buf *bytes.Buffer, b []byte) {
	binary.Write(buf, binary.LittleEndian, uint32(len(b)))
	buf.Write(b)
}

// parseU128 parses a decimal string to 16-byte little-endian representation
func parseU128(s string) []byte {
	result := make([]byte, 16)

	// Simple decimal parsing for small values
	var value uint64
	fmt.Sscanf(s, "%d", &value)

	binary.LittleEndian.PutUint64(result[0:8], value)
	// High 8 bytes are 0 for small values

	return result
}

// GetEndpoint returns the RPC endpoint
func (s *ClientSigner) GetEndpoint() string {
	return s.endpoint
}
