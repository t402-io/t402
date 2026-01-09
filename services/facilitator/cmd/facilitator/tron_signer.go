package main

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/crypto"
	"github.com/t402-io/t402/go/mechanisms/tron"
)

// facilitatorTronSigner implements the FacilitatorTronSigner interface
type facilitatorTronSigner struct {
	addresses map[string]string // network -> address
	endpoints map[string]string // network -> API endpoint
}

// newFacilitatorTronSigner creates a new TRON facilitator signer from a private key
func newFacilitatorTronSigner(privateKeyHex string, mainnetRPC string) (*facilitatorTronSigner, error) {
	if privateKeyHex == "" {
		return nil, fmt.Errorf("private key is required")
	}

	// Remove 0x prefix if present
	privateKeyHex = strings.TrimPrefix(privateKeyHex, "0x")

	// Parse private key
	privateKeyBytes, err := hex.DecodeString(privateKeyHex)
	if err != nil {
		return nil, fmt.Errorf("failed to decode private key: %w", err)
	}

	privateKey, err := crypto.ToECDSA(privateKeyBytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse private key: %w", err)
	}

	// Derive TRON address from public key
	address := publicKeyToTronAddress(&privateKey.PublicKey)

	signer := &facilitatorTronSigner{
		addresses: make(map[string]string),
		endpoints: make(map[string]string),
	}

	// Set up endpoints and addresses
	// Mainnet
	if mainnetRPC != "" {
		signer.endpoints[tron.TronMainnetCAIP2] = mainnetRPC
		signer.addresses[tron.TronMainnetCAIP2] = address
	} else {
		// Use default endpoint
		signer.endpoints[tron.TronMainnetCAIP2] = "https://api.trongrid.io"
		signer.addresses[tron.TronMainnetCAIP2] = address
	}

	// Nile testnet
	signer.endpoints[tron.TronNileCAIP2] = "https://api.nileex.io"
	signer.addresses[tron.TronNileCAIP2] = address

	// Shasta testnet
	signer.endpoints[tron.TronShastaCAIP2] = "https://api.shasta.trongrid.io"
	signer.addresses[tron.TronShastaCAIP2] = address

	return signer, nil
}

// publicKeyToTronAddress converts an ECDSA public key to a TRON address
func publicKeyToTronAddress(pub *ecdsa.PublicKey) string {
	// Get the Ethereum-style address bytes
	ethAddr := crypto.PubkeyToAddress(*pub).Bytes()

	// TRON addresses use 0x41 prefix instead of Ethereum's implicit 0x00
	tronBytes := append([]byte{0x41}, ethAddr...)

	// Base58Check encode with SHA256 checksum
	return base58CheckEncode(tronBytes)
}

// base58CheckEncode encodes bytes to TRON's base58check format
func base58CheckEncode(data []byte) string {
	// SHA256 twice for checksum
	hash1 := sha256.Sum256(data)
	hash2 := sha256.Sum256(hash1[:])
	checksum := hash2[:4]

	// Append checksum
	fullData := append(data, checksum...)

	// Base58 encode
	return base58Encode(fullData)
}

// base58Encode encodes bytes to base58
func base58Encode(data []byte) string {
	// Base58 alphabet (no 0, O, I, l)
	alphabet := "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

	// Convert to big int
	x := new(big.Int).SetBytes(data)
	base := big.NewInt(58)
	zero := big.NewInt(0)
	mod := new(big.Int)

	var result []byte
	for x.Cmp(zero) > 0 {
		x.DivMod(x, base, mod)
		result = append([]byte{alphabet[mod.Int64()]}, result...)
	}

	// Add leading '1's for leading zero bytes
	for _, b := range data {
		if b != 0 {
			break
		}
		result = append([]byte{alphabet[0]}, result...)
	}

	return string(result)
}

func (s *facilitatorTronSigner) GetAddresses(ctx context.Context, network string) []string {
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

func (s *facilitatorTronSigner) getEndpoint(network string) (string, error) {
	if endpoint, ok := s.endpoints[network]; ok {
		return endpoint, nil
	}
	config, err := tron.GetNetworkConfig(network)
	if err != nil {
		return "", err
	}
	return config.Endpoint, nil
}

// tronAPIRequest makes a REST API request to TronGrid
func (s *facilitatorTronSigner) tronAPIRequest(ctx context.Context, network string, path string, body map[string]interface{}) (json.RawMessage, error) {
	endpoint, err := s.getEndpoint(network)
	if err != nil {
		return nil, err
	}

	url := endpoint + path

	var reqBody io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request: %w", err)
		}
		reqBody = bytes.NewReader(jsonBody)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	return respBody, nil
}

func (s *facilitatorTronSigner) GetBalance(ctx context.Context, params tron.GetBalanceParams) (string, error) {
	// Call TRC20 balanceOf via triggersmartcontract
	// Convert TRON address to hex format for ABI encoding
	ownerHex, err := tronAddressToHex(params.OwnerAddress)
	if err != nil {
		return "0", fmt.Errorf("invalid owner address: %w", err)
	}

	// Remove 41 prefix and pad to 32 bytes (64 hex chars)
	addressParam := fmt.Sprintf("%064s", strings.TrimPrefix(ownerHex, "41"))

	result, err := s.tronAPIRequest(ctx, params.Network, "/wallet/triggersmartcontract", map[string]interface{}{
		"owner_address":     params.OwnerAddress,
		"contract_address":  params.ContractAddress,
		"function_selector": "balanceOf(address)",
		"parameter":         addressParam,
		"visible":           true,
	})
	if err != nil {
		return "0", nil // Return 0 on error
	}

	var triggerResult struct {
		Result struct {
			Result bool `json:"result"`
		} `json:"result"`
		ConstantResult []string `json:"constant_result"`
	}
	if err := json.Unmarshal(result, &triggerResult); err != nil {
		return "0", nil
	}

	if !triggerResult.Result.Result || len(triggerResult.ConstantResult) == 0 {
		return "0", nil
	}

	// Parse hex balance
	balanceHex := triggerResult.ConstantResult[0]
	balance := new(big.Int)
	balance.SetString(balanceHex, 16)

	return balance.String(), nil
}

func (s *facilitatorTronSigner) VerifyTransaction(ctx context.Context, params tron.VerifyTransactionParams) (*tron.VerifyMessageResult, error) {
	// Parse the signed transaction hex
	txBytes, err := hex.DecodeString(params.SignedTransaction)
	if err != nil {
		return &tron.VerifyMessageResult{
			Valid:  false,
			Reason: "invalid_hex_encoding",
		}, nil
	}

	// Basic validation - transaction should be at least 100 bytes
	if len(txBytes) < 100 {
		return &tron.VerifyMessageResult{
			Valid:  false,
			Reason: "transaction_too_short",
		}, nil
	}

	// For full verification, we need to decode the protobuf transaction
	// and verify the signature and transfer details.
	// For now, do basic validation and rely on broadcast to verify.

	return &tron.VerifyMessageResult{
		Valid: true,
	}, nil
}

func (s *facilitatorTronSigner) BroadcastTransaction(ctx context.Context, signedTransaction string, network string) (string, error) {
	result, err := s.tronAPIRequest(ctx, network, "/wallet/broadcasthex", map[string]interface{}{
		"transaction": signedTransaction,
	})
	if err != nil {
		return "", fmt.Errorf("failed to broadcast: %w", err)
	}

	var broadcastResult struct {
		Result  bool   `json:"result"`
		TxId    string `json:"txid"`
		Code    string `json:"code"`
		Message string `json:"message"`
	}
	if err := json.Unmarshal(result, &broadcastResult); err != nil {
		return "", fmt.Errorf("failed to parse broadcast result: %w", err)
	}

	if !broadcastResult.Result {
		msg := broadcastResult.Message
		if msg == "" {
			msg = broadcastResult.Code
		}
		return "", fmt.Errorf("broadcast failed: %s", msg)
	}

	return broadcastResult.TxId, nil
}

func (s *facilitatorTronSigner) WaitForTransaction(ctx context.Context, params tron.WaitForTransactionParams) (*tron.TransactionConfirmation, error) {
	timeout := params.Timeout
	if timeout == 0 {
		timeout = 60000 // 60 seconds default
	}

	deadline := time.Now().Add(time.Duration(timeout) * time.Millisecond)
	interval := 2 * time.Second

	for time.Now().Before(deadline) {
		// Query transaction from solidity node (confirmed transactions)
		result, err := s.tronAPIRequest(ctx, params.Network, "/walletsolidity/gettransactionbyid", map[string]interface{}{
			"value": params.TxId,
		})
		if err == nil {
			var txInfo struct {
				TxId string `json:"txID"`
				Ret  []struct {
					ContractRet string `json:"contractRet"`
				} `json:"ret"`
			}
			if err := json.Unmarshal(result, &txInfo); err == nil && txInfo.TxId != "" {
				// Transaction found
				success := true
				if len(txInfo.Ret) > 0 && txInfo.Ret[0].ContractRet != "SUCCESS" {
					success = false
				}
				return &tron.TransactionConfirmation{
					Success: success,
					TxId:    txInfo.TxId,
				}, nil
			}
		}

		select {
		case <-ctx.Done():
			return &tron.TransactionConfirmation{
				Success: false,
				Error:   "context cancelled",
			}, nil
		case <-time.After(interval):
			continue
		}
	}

	return &tron.TransactionConfirmation{
		Success: false,
		Error:   "timeout waiting for transaction",
	}, nil
}

func (s *facilitatorTronSigner) IsActivated(ctx context.Context, address string, network string) (bool, error) {
	result, err := s.tronAPIRequest(ctx, network, "/wallet/getaccount", map[string]interface{}{
		"address": address,
		"visible": true,
	})
	if err != nil {
		return false, nil // Assume not activated on error
	}

	var accountInfo struct {
		Address string `json:"address"`
	}
	if err := json.Unmarshal(result, &accountInfo); err != nil {
		return false, nil
	}

	// Account is activated if it has an address in the response
	return accountInfo.Address != "", nil
}

// tronAddressToHex converts a TRON T-prefix address to hex format
func tronAddressToHex(address string) (string, error) {
	if !tron.ValidateTronAddress(address) {
		return "", fmt.Errorf("invalid TRON address: %s", address)
	}

	// Decode base58check
	decoded, err := base58Decode(address)
	if err != nil {
		return "", err
	}

	// Remove checksum (last 4 bytes)
	if len(decoded) < 5 {
		return "", fmt.Errorf("address too short")
	}
	addressBytes := decoded[:len(decoded)-4]

	return hex.EncodeToString(addressBytes), nil
}

// base58Decode decodes a base58check string
func base58Decode(input string) ([]byte, error) {
	alphabet := "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

	result := big.NewInt(0)
	base := big.NewInt(58)

	for _, c := range input {
		idx := strings.IndexRune(alphabet, c)
		if idx == -1 {
			return nil, fmt.Errorf("invalid base58 character: %c", c)
		}
		result.Mul(result, base)
		result.Add(result, big.NewInt(int64(idx)))
	}

	// Convert to bytes
	decoded := result.Bytes()

	// Add leading zeros
	for _, c := range input {
		if c != '1' {
			break
		}
		decoded = append([]byte{0}, decoded...)
	}

	return decoded, nil
}
