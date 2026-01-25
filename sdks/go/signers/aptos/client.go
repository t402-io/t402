// Package aptos provides an Aptos signer implementation using Ed25519 for t402 payments.
//
// This package enables fungible asset (FA) transfers for the t402 payment protocol.
// Aptos uses Ed25519 for transaction signing and BCS (Binary Canonical Serialization).
package aptos

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/aptos"
)

// DefaultGasLimit is the default maximum gas for transactions
const DefaultGasLimit = 200000

// DefaultGasPrice is the default gas unit price in Octas
const DefaultGasPrice = 100

// DefaultExpirationSecs is the default transaction expiration (5 minutes)
const DefaultExpirationSecs = 300

// ClientSigner implements the Aptos client signer interface using an Ed25519 private key.
type ClientSigner struct {
	privateKey ed25519.PrivateKey
	publicKey  ed25519.PublicKey
	address    string
	httpClient *http.Client
}

// Config contains configuration for creating a ClientSigner
type Config struct {
	// GasLimit is the maximum gas units for transactions (optional)
	GasLimit uint64
	// GasPrice is the gas unit price in Octas (optional)
	GasPrice uint64
}

// NewClientSignerFromPrivateKey creates a client signer from a hex-encoded Ed25519 private key.
//
// Args:
//
//	privateKeyHex: Hex-encoded Ed25519 private key (with or without "0x" prefix)
//	config: Optional configuration
//
// Returns:
//
//	ClientSigner implementation
//	Error if private key is invalid
func NewClientSignerFromPrivateKey(privateKeyHex string, config *Config) (*ClientSigner, error) {
	// Strip 0x prefix if present
	privateKeyHex = strings.TrimPrefix(privateKeyHex, "0x")

	// Decode hex
	privateKeyBytes, err := hex.DecodeString(privateKeyHex)
	if err != nil {
		return nil, fmt.Errorf("invalid hex private key: %w", err)
	}

	// Aptos private keys are 32 bytes (seed) or 64 bytes (full key)
	var privateKey ed25519.PrivateKey
	if len(privateKeyBytes) == 64 {
		privateKey = ed25519.PrivateKey(privateKeyBytes)
	} else if len(privateKeyBytes) == 32 {
		privateKey = ed25519.NewKeyFromSeed(privateKeyBytes)
	} else {
		return nil, fmt.Errorf("invalid private key length: expected 32 or 64 bytes, got %d", len(privateKeyBytes))
	}

	return newClientSignerFromKey(privateKey)
}

// NewClientSignerFromSeed creates a client signer from a hex-encoded 32-byte seed.
//
// Args:
//
//	seedHex: Hex-encoded 32-byte seed (with or without "0x" prefix)
//	config: Optional configuration
//
// Returns:
//
//	ClientSigner implementation
//	Error if seed is invalid
func NewClientSignerFromSeed(seedHex string, config *Config) (*ClientSigner, error) {
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
	return newClientSignerFromKey(privateKey)
}

// newClientSignerFromKey creates a client signer from an Ed25519 private key
func newClientSignerFromKey(privateKey ed25519.PrivateKey) (*ClientSigner, error) {
	// Extract public key
	publicKey := privateKey.Public().(ed25519.PublicKey)

	// Derive address from public key
	// Aptos address = SHA3-256(public_key || 0x00)[0:32]
	// The 0x00 suffix indicates single-signer scheme
	authKeyInput := append(publicKey, 0x00)
	hash := sha256.Sum256(authKeyInput)
	address := "0x" + hex.EncodeToString(hash[:])

	return &ClientSigner{
		privateKey: privateKey,
		publicKey:  publicKey,
		address:    address,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}, nil
}

// Address returns the signer's Aptos address.
func (s *ClientSigner) Address() string {
	return s.address
}

// PublicKeyHex returns the public key as hex string.
func (s *ClientSigner) PublicKeyHex() string {
	return "0x" + hex.EncodeToString(s.publicKey)
}

// SignAndSubmitTransaction signs and submits a transaction to the Aptos network.
// Returns the transaction hash on success.
func (s *ClientSigner) SignAndSubmitTransaction(
	ctx context.Context,
	payload aptos.TransactionPayload,
	network t402.Network,
) (string, error) {
	// Get network config
	config, ok := aptos.GetNetworkConfig(string(network))
	if !ok {
		return "", fmt.Errorf("unsupported network: %s", network)
	}

	// Get account info (sequence number)
	seqNum, err := s.getSequenceNumber(ctx, config.RPCURL)
	if err != nil {
		return "", fmt.Errorf("failed to get sequence number: %w", err)
	}

	// Get chain ID
	chainID, err := s.getChainID(ctx, config.RPCURL)
	if err != nil {
		return "", fmt.Errorf("failed to get chain ID: %w", err)
	}

	// Build the transaction
	expiration := uint64(time.Now().Unix() + DefaultExpirationSecs)
	rawTx := &RawTransaction{
		Sender:                  s.address,
		SequenceNumber:          seqNum,
		MaxGasAmount:            DefaultGasLimit,
		GasUnitPrice:            DefaultGasPrice,
		ExpirationTimestampSecs: expiration,
		Payload:                 payload,
		ChainID:                 chainID,
	}

	// Serialize the raw transaction for signing
	signingMessage, err := s.buildSigningMessage(rawTx)
	if err != nil {
		return "", fmt.Errorf("failed to build signing message: %w", err)
	}

	// Sign the transaction
	signature := ed25519.Sign(s.privateKey, signingMessage)

	// Submit the signed transaction
	txHash, err := s.submitTransaction(ctx, config.RPCURL, rawTx, signature)
	if err != nil {
		return "", fmt.Errorf("failed to submit transaction: %w", err)
	}

	// Wait for transaction confirmation
	if err := s.waitForTransaction(ctx, config.RPCURL, txHash); err != nil {
		return "", fmt.Errorf("transaction failed: %w", err)
	}

	return txHash, nil
}

// RawTransaction represents an Aptos raw transaction
type RawTransaction struct {
	Sender                  string
	SequenceNumber          uint64
	MaxGasAmount            uint64
	GasUnitPrice            uint64
	ExpirationTimestampSecs uint64
	Payload                 aptos.TransactionPayload
	ChainID                 uint8
}

// getSequenceNumber gets the current sequence number for the account
func (s *ClientSigner) getSequenceNumber(ctx context.Context, rpcURL string) (uint64, error) {
	url := fmt.Sprintf("%s/accounts/%s", rpcURL, s.address)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return 0, err
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == 404 {
		// Account doesn't exist yet, sequence number is 0
		return 0, nil
	}

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return 0, fmt.Errorf("API error: %s", string(body))
	}

	var result struct {
		SequenceNumber string `json:"sequence_number"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, err
	}

	var seqNum uint64
	fmt.Sscanf(result.SequenceNumber, "%d", &seqNum)
	return seqNum, nil
}

// getChainID gets the chain ID from the network
func (s *ClientSigner) getChainID(ctx context.Context, rpcURL string) (uint8, error) {
	url := fmt.Sprintf("%s", rpcURL)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return 0, err
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return 0, fmt.Errorf("API error: %s", string(body))
	}

	var result struct {
		ChainID uint8 `json:"chain_id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, err
	}

	return result.ChainID, nil
}

// buildSigningMessage builds the BCS-serialized signing message
func (s *ClientSigner) buildSigningMessage(tx *RawTransaction) ([]byte, error) {
	var buf bytes.Buffer

	// Prefix for signing: sha3-256("APTOS::RawTransaction")
	prefix := sha256.Sum256([]byte("APTOS::RawTransaction"))
	buf.Write(prefix[:])

	// Serialize the raw transaction
	if err := s.serializeRawTransaction(&buf, tx); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

// serializeRawTransaction serializes a raw transaction to BCS format
func (s *ClientSigner) serializeRawTransaction(buf *bytes.Buffer, tx *RawTransaction) error {
	// Sender (address as bytes)
	senderBytes, err := addressToBytes(tx.Sender)
	if err != nil {
		return fmt.Errorf("invalid sender address: %w", err)
	}
	buf.Write(senderBytes)

	// Sequence number (u64)
	binary.Write(buf, binary.LittleEndian, tx.SequenceNumber)

	// Payload (TransactionPayload)
	if err := s.serializePayload(buf, &tx.Payload); err != nil {
		return err
	}

	// Max gas amount (u64)
	binary.Write(buf, binary.LittleEndian, tx.MaxGasAmount)

	// Gas unit price (u64)
	binary.Write(buf, binary.LittleEndian, tx.GasUnitPrice)

	// Expiration timestamp (u64)
	binary.Write(buf, binary.LittleEndian, tx.ExpirationTimestampSecs)

	// Chain ID (u8)
	buf.WriteByte(tx.ChainID)

	return nil
}

// serializePayload serializes a transaction payload to BCS format
func (s *ClientSigner) serializePayload(buf *bytes.Buffer, payload *aptos.TransactionPayload) error {
	// Payload type: 2 = entry function
	buf.WriteByte(2)

	// Parse function: module::function
	parts := strings.Split(payload.Function, "::")
	if len(parts) != 3 {
		return fmt.Errorf("invalid function format: %s", payload.Function)
	}

	// Module address
	moduleAddr, err := addressToBytes(parts[0])
	if err != nil {
		return fmt.Errorf("invalid module address: %w", err)
	}
	buf.Write(moduleAddr)

	// Module name
	writeString(buf, parts[1])

	// Function name
	writeString(buf, parts[2])

	// Type arguments (vec<TypeTag>)
	binary.Write(buf, binary.LittleEndian, uint32(len(payload.TypeArguments)))
	// Skip type args serialization for simple FA transfers

	// Arguments (vec<bytes>)
	binary.Write(buf, binary.LittleEndian, uint32(len(payload.Arguments)))
	for _, arg := range payload.Arguments {
		switch v := arg.(type) {
		case string:
			// Check if it's an address or a number
			if strings.HasPrefix(v, "0x") {
				// Serialize as address
				addrBytes, err := addressToBytes(v)
				if err != nil {
					return err
				}
				writeBytes(buf, addrBytes)
			} else {
				// Serialize as u64
				var num uint64
				fmt.Sscanf(v, "%d", &num)
				numBytes := make([]byte, 8)
				binary.LittleEndian.PutUint64(numBytes, num)
				writeBytes(buf, numBytes)
			}
		default:
			return fmt.Errorf("unsupported argument type: %T", arg)
		}
	}

	return nil
}

// submitTransaction submits a signed transaction to the network
func (s *ClientSigner) submitTransaction(ctx context.Context, rpcURL string, tx *RawTransaction, signature []byte) (string, error) {
	// Build the signed transaction request
	reqBody := map[string]interface{}{
		"sender":                    tx.Sender,
		"sequence_number":           fmt.Sprintf("%d", tx.SequenceNumber),
		"max_gas_amount":            fmt.Sprintf("%d", tx.MaxGasAmount),
		"gas_unit_price":            fmt.Sprintf("%d", tx.GasUnitPrice),
		"expiration_timestamp_secs": fmt.Sprintf("%d", tx.ExpirationTimestampSecs),
		"payload":                   tx.Payload,
		"signature": map[string]interface{}{
			"type":       "ed25519_signature",
			"public_key": s.PublicKeyHex(),
			"signature":  "0x" + hex.EncodeToString(signature),
		},
	}

	reqBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	url := fmt.Sprintf("%s/transactions", rpcURL)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(reqBytes))
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

	if resp.StatusCode != 202 && resp.StatusCode != 200 {
		return "", fmt.Errorf("API error (%d): %s", resp.StatusCode, string(body))
	}

	var result struct {
		Hash string `json:"hash"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("failed to parse response: %w, body: %s", err, string(body))
	}

	return result.Hash, nil
}

// waitForTransaction waits for a transaction to be confirmed
func (s *ClientSigner) waitForTransaction(ctx context.Context, rpcURL string, txHash string) error {
	url := fmt.Sprintf("%s/transactions/by_hash/%s", rpcURL, txHash)

	for i := 0; i < 30; i++ {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(1 * time.Second):
		}

		req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
		if err != nil {
			return err
		}

		resp, err := s.httpClient.Do(req)
		if err != nil {
			continue
		}

		if resp.StatusCode == 404 {
			resp.Body.Close()
			continue
		}

		if resp.StatusCode != 200 {
			resp.Body.Close()
			continue
		}

		var result struct {
			Success  bool   `json:"success"`
			VMStatus string `json:"vm_status"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			resp.Body.Close()
			continue
		}
		resp.Body.Close()

		if result.Success {
			return nil
		}
		return fmt.Errorf("transaction failed: %s", result.VMStatus)
	}

	return fmt.Errorf("transaction not confirmed after 30 seconds")
}

// addressToBytes converts an address string to 32 bytes
func addressToBytes(addr string) ([]byte, error) {
	addr = strings.TrimPrefix(addr, "0x")
	// Pad to 64 hex chars (32 bytes)
	for len(addr) < 64 {
		addr = "0" + addr
	}
	return hex.DecodeString(addr)
}

// writeString writes a BCS string (ULEB128 length + bytes)
func writeString(buf *bytes.Buffer, s string) {
	writeULEB128(buf, uint64(len(s)))
	buf.WriteString(s)
}

// writeBytes writes BCS bytes (ULEB128 length + bytes)
func writeBytes(buf *bytes.Buffer, b []byte) {
	writeULEB128(buf, uint64(len(b)))
	buf.Write(b)
}

// writeULEB128 writes a ULEB128 encoded unsigned integer
func writeULEB128(buf *bytes.Buffer, value uint64) {
	for {
		byteVal := uint8(value & 0x7F)
		value >>= 7
		if value != 0 {
			byteVal |= 0x80
		}
		buf.WriteByte(byteVal)
		if value == 0 {
			break
		}
	}
}
