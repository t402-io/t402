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
	"github.com/t402-io/t402/sdks/go/mechanisms/tron"
	tronupto "github.com/t402-io/t402/sdks/go/mechanisms/tron/upto"
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

	// SECURITY: Clear private key bytes from memory after use
	defer func() {
		for i := range privateKeyBytes {
			privateKeyBytes[i] = 0
		}
	}()

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

// facilitatorTronUptoAdapter adapts the facilitatorTronSigner to the
// UptoFacilitatorTronSigner interface (no context.Context, plus GetAllowance
// and ExecuteTransferFrom).
type facilitatorTronUptoAdapter struct {
	inner      *facilitatorTronSigner
	privateKey *ecdsa.PrivateKey
}

// newFacilitatorTronUptoAdapter creates a TRON upto adapter that wraps
// the existing facilitatorTronSigner and retains the private key for signing
// transferFrom transactions during settlement.
func newFacilitatorTronUptoAdapter(privateKeyHex string, mainnetRPC string) (*facilitatorTronUptoAdapter, error) {
	if privateKeyHex == "" {
		return nil, fmt.Errorf("private key is required")
	}

	privateKeyHex = strings.TrimPrefix(privateKeyHex, "0x")

	privateKeyBytes, err := hex.DecodeString(privateKeyHex)
	if err != nil {
		return nil, fmt.Errorf("failed to decode private key: %w", err)
	}

	privateKey, err := crypto.ToECDSA(privateKeyBytes)
	if err != nil {
		// Clear key bytes on error
		for i := range privateKeyBytes {
			privateKeyBytes[i] = 0
		}
		return nil, fmt.Errorf("failed to parse private key: %w", err)
	}

	// Clear raw bytes; the parsed *ecdsa.PrivateKey is retained for signing
	for i := range privateKeyBytes {
		privateKeyBytes[i] = 0
	}

	address := publicKeyToTronAddress(&privateKey.PublicKey)

	inner := &facilitatorTronSigner{
		addresses: make(map[string]string),
		endpoints: make(map[string]string),
	}

	if mainnetRPC != "" {
		inner.endpoints[tron.TronMainnetCAIP2] = mainnetRPC
	} else {
		inner.endpoints[tron.TronMainnetCAIP2] = "https://api.trongrid.io"
	}
	inner.addresses[tron.TronMainnetCAIP2] = address

	inner.endpoints[tron.TronNileCAIP2] = "https://api.nileex.io"
	inner.addresses[tron.TronNileCAIP2] = address

	inner.endpoints[tron.TronShastaCAIP2] = "https://api.shasta.trongrid.io"
	inner.addresses[tron.TronShastaCAIP2] = address

	return &facilitatorTronUptoAdapter{
		inner:      inner,
		privateKey: privateKey,
	}, nil
}

// GetAddresses implements UptoFacilitatorTronSigner.
func (a *facilitatorTronUptoAdapter) GetAddresses(network string) []string {
	return a.inner.GetAddresses(context.Background(), network)
}

// GetBalance implements UptoFacilitatorTronSigner.
func (a *facilitatorTronUptoAdapter) GetBalance(params tronupto.GetBalanceParams) (string, error) {
	return a.inner.GetBalance(context.Background(), tron.GetBalanceParams{
		OwnerAddress:    params.OwnerAddress,
		ContractAddress: params.ContractAddress,
		Network:         params.Network,
	})
}

// GetAllowance implements UptoFacilitatorTronSigner.
// Calls TRC-20 allowance(owner, spender) via triggersmartcontract.
func (a *facilitatorTronUptoAdapter) GetAllowance(params tronupto.GetAllowanceParams) (string, error) {
	ownerHex, err := tronAddressToHex(params.OwnerAddress)
	if err != nil {
		return "0", fmt.Errorf("invalid owner address: %w", err)
	}
	spenderHex, err := tronAddressToHex(params.SpenderAddress)
	if err != nil {
		return "0", fmt.Errorf("invalid spender address: %w", err)
	}

	// ABI-encode: pad each 20-byte address to 32 bytes
	ownerParam := fmt.Sprintf("%064s", strings.TrimPrefix(ownerHex, "41"))
	spenderParam := fmt.Sprintf("%064s", strings.TrimPrefix(spenderHex, "41"))

	result, err := a.inner.tronAPIRequest(context.Background(), params.Network, "/wallet/triggersmartcontract", map[string]interface{}{
		"owner_address":     params.OwnerAddress,
		"contract_address":  params.ContractAddress,
		"function_selector": "allowance(address,address)",
		"parameter":         ownerParam + spenderParam,
		"visible":           true,
	})
	if err != nil {
		return "0", nil
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

	allowanceHex := triggerResult.ConstantResult[0]
	allowance := new(big.Int)
	allowance.SetString(allowanceHex, 16)

	return allowance.String(), nil
}

// VerifyApproveTransaction implements UptoFacilitatorTronSigner.
// Verifies the signer of a signed approve transaction using ECDSA recovery.
func (a *facilitatorTronUptoAdapter) VerifyApproveTransaction(params tronupto.VerifyApproveParams) (*tronupto.VerifyApproveResult, error) {
	txBytes, err := hex.DecodeString(params.SignedTransaction)
	if err != nil {
		return &tronupto.VerifyApproveResult{
			Valid:  false,
			Reason: "invalid_hex_encoding",
		}, nil
	}

	if len(txBytes) < 100 {
		return &tronupto.VerifyApproveResult{
			Valid:  false,
			Reason: "transaction_too_short",
		}, nil
	}

	rawData, signature, err := extractTronTxFields(txBytes)
	if err != nil {
		return &tronupto.VerifyApproveResult{
			Valid:  false,
			Reason: fmt.Sprintf("invalid_tx_structure: %v", err),
		}, nil
	}

	txHash := sha256.Sum256(rawData)

	if len(signature) != 65 {
		return &tronupto.VerifyApproveResult{
			Valid:  false,
			Reason: "invalid_signature_length",
		}, nil
	}

	pubKeyBytes, err := crypto.Ecrecover(txHash[:], signature)
	if err != nil {
		return &tronupto.VerifyApproveResult{
			Valid:  false,
			Reason: "signature_recovery_failed",
		}, nil
	}

	pubKey, err := crypto.UnmarshalPubkey(pubKeyBytes)
	if err != nil {
		return &tronupto.VerifyApproveResult{
			Valid:  false,
			Reason: "invalid_recovered_pubkey",
		}, nil
	}
	recoveredAddress := publicKeyToTronAddress(pubKey)

	if params.ExpectedOwner != "" && !tron.AddressesEqual(recoveredAddress, params.ExpectedOwner) {
		return &tronupto.VerifyApproveResult{
			Valid:  false,
			Reason: fmt.Sprintf("signer_mismatch: expected %s, got %s", params.ExpectedOwner, recoveredAddress),
		}, nil
	}

	return &tronupto.VerifyApproveResult{
		Valid: true,
		Owner: recoveredAddress,
	}, nil
}

// BroadcastTransaction implements UptoFacilitatorTronSigner.
func (a *facilitatorTronUptoAdapter) BroadcastTransaction(signedTransaction string, network string) (string, error) {
	return a.inner.BroadcastTransaction(context.Background(), signedTransaction, network)
}

// ExecuteTransferFrom implements UptoFacilitatorTronSigner.
// Builds a TRC-20 transferFrom(from, to, amount) transaction, signs it with
// the facilitator private key, and broadcasts it.
func (a *facilitatorTronUptoAdapter) ExecuteTransferFrom(params tronupto.TransferFromParams) (*tronupto.TransferFromResult, error) {
	ctx := context.Background()

	// ABI-encode transferFrom(address from, address to, uint256 amount)
	fromHex, err := tronAddressToHex(params.From)
	if err != nil {
		return &tronupto.TransferFromResult{Success: false, Error: fmt.Sprintf("invalid from address: %v", err)}, nil
	}
	toHex, err := tronAddressToHex(params.To)
	if err != nil {
		return &tronupto.TransferFromResult{Success: false, Error: fmt.Sprintf("invalid to address: %v", err)}, nil
	}

	amount := new(big.Int)
	if _, ok := amount.SetString(params.Amount, 10); !ok {
		return &tronupto.TransferFromResult{Success: false, Error: "invalid amount"}, nil
	}

	fromParam := fmt.Sprintf("%064s", strings.TrimPrefix(fromHex, "41"))
	toParam := fmt.Sprintf("%064s", strings.TrimPrefix(toHex, "41"))
	amountParam := fmt.Sprintf("%064x", amount)

	// Get the facilitator address for this network
	facilitatorAddrs := a.inner.GetAddresses(ctx, params.Network)
	if len(facilitatorAddrs) == 0 {
		return &tronupto.TransferFromResult{Success: false, Error: "no facilitator address for network"}, nil
	}

	// Trigger smart contract to build the unsigned transaction
	result, err := a.inner.tronAPIRequest(ctx, params.Network, "/wallet/triggersmartcontract", map[string]interface{}{
		"owner_address":     facilitatorAddrs[0],
		"contract_address":  params.ContractAddress,
		"function_selector": "transferFrom(address,address,uint256)",
		"parameter":         fromParam + toParam + amountParam,
		"fee_limit":         100000000, // 100 TRX
		"visible":           true,
	})
	if err != nil {
		return &tronupto.TransferFromResult{Success: false, Error: fmt.Sprintf("triggersmartcontract failed: %v", err)}, nil
	}

	var triggerResult struct {
		Result struct {
			Result  bool   `json:"result"`
			Message string `json:"message,omitempty"`
		} `json:"result"`
		Transaction struct {
			RawDataHex string `json:"raw_data_hex"`
			TxID       string `json:"txID"`
		} `json:"transaction"`
	}
	if err := json.Unmarshal(result, &triggerResult); err != nil {
		return &tronupto.TransferFromResult{Success: false, Error: fmt.Sprintf("failed to parse trigger result: %v", err)}, nil
	}

	if !triggerResult.Result.Result {
		return &tronupto.TransferFromResult{Success: false, Error: fmt.Sprintf("trigger failed: %s", triggerResult.Result.Message)}, nil
	}

	// Sign the transaction: SHA256(raw_data_hex) -> secp256k1 sign
	rawDataBytes, err := hex.DecodeString(triggerResult.Transaction.RawDataHex)
	if err != nil {
		return &tronupto.TransferFromResult{Success: false, Error: "invalid raw_data_hex"}, nil
	}

	txHash := sha256.Sum256(rawDataBytes)
	sig, err := crypto.Sign(txHash[:], a.privateKey)
	if err != nil {
		return &tronupto.TransferFromResult{Success: false, Error: fmt.Sprintf("signing failed: %v", err)}, nil
	}

	// Broadcast via /wallet/broadcasttransaction with the signed tx
	broadcastResult, err := a.inner.tronAPIRequest(ctx, params.Network, "/wallet/broadcasttransaction", map[string]interface{}{
		"raw_data_hex": triggerResult.Transaction.RawDataHex,
		"txID":         triggerResult.Transaction.TxID,
		"signature":    []string{hex.EncodeToString(sig)},
		"visible":      true,
	})
	if err != nil {
		return &tronupto.TransferFromResult{Success: false, Error: fmt.Sprintf("broadcast failed: %v", err)}, nil
	}

	var bResult struct {
		Result  bool   `json:"result"`
		TxId    string `json:"txid"`
		Code    string `json:"code"`
		Message string `json:"message"`
	}
	if err := json.Unmarshal(broadcastResult, &bResult); err != nil {
		return &tronupto.TransferFromResult{Success: false, Error: fmt.Sprintf("failed to parse broadcast result: %v", err)}, nil
	}

	if !bResult.Result {
		msg := bResult.Message
		if msg == "" {
			msg = bResult.Code
		}
		return &tronupto.TransferFromResult{Success: false, Error: fmt.Sprintf("broadcast failed: %s", msg)}, nil
	}

	txId := bResult.TxId
	if txId == "" {
		txId = triggerResult.Transaction.TxID
	}

	return &tronupto.TransferFromResult{
		Success: true,
		TxId:    txId,
	}, nil
}

// WaitForTransaction implements UptoFacilitatorTronSigner.
func (a *facilitatorTronUptoAdapter) WaitForTransaction(params tronupto.WaitForTransactionParams) (*tronupto.TransactionConfirmation, error) {
	result, err := a.inner.WaitForTransaction(context.Background(), tron.WaitForTransactionParams{
		TxId:    params.TxId,
		Network: params.Network,
		Timeout: params.Timeout,
	})
	if err != nil {
		return &tronupto.TransactionConfirmation{
			Success: false,
			Error:   err.Error(),
		}, nil
	}
	return &tronupto.TransactionConfirmation{
		Success:     result.Success,
		TxId:        result.TxId,
		BlockNumber: result.BlockNumber,
		Error:       result.Error,
	}, nil
}

// IsActivated implements UptoFacilitatorTronSigner.
func (a *facilitatorTronUptoAdapter) IsActivated(address string, network string) (bool, error) {
	return a.inner.IsActivated(context.Background(), address, network)
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

	// SECURITY: Extract raw_data and signature from protobuf-encoded transaction
	// and perform ECDSA signature recovery to verify the signer address.
	rawData, signature, err := extractTronTxFields(txBytes)
	if err != nil {
		return &tron.VerifyMessageResult{
			Valid:  false,
			Reason: fmt.Sprintf("invalid_tx_structure: %v", err),
		}, nil
	}

	// Hash the raw_data with SHA256 (TRON's signing scheme)
	txHash := sha256.Sum256(rawData)

	// Recover the public key from the signature
	// TRON uses secp256k1 (same as Ethereum), signature is 65 bytes [R || S || V]
	if len(signature) != 65 {
		return &tron.VerifyMessageResult{
			Valid:  false,
			Reason: "invalid_signature_length",
		}, nil
	}

	pubKeyBytes, err := crypto.Ecrecover(txHash[:], signature)
	if err != nil {
		return &tron.VerifyMessageResult{
			Valid:  false,
			Reason: "signature_recovery_failed",
		}, nil
	}

	// Convert recovered public key to TRON address
	pubKey, err := crypto.UnmarshalPubkey(pubKeyBytes)
	if err != nil {
		return &tron.VerifyMessageResult{
			Valid:  false,
			Reason: "invalid_recovered_pubkey",
		}, nil
	}
	recoveredAddress := publicKeyToTronAddress(pubKey)

	// Verify the recovered address matches the expected sender
	if params.ExpectedFrom != "" && recoveredAddress != params.ExpectedFrom {
		return &tron.VerifyMessageResult{
			Valid:  false,
			Reason: fmt.Sprintf("signer_mismatch: expected %s, got %s", params.ExpectedFrom, recoveredAddress),
		}, nil
	}

	return &tron.VerifyMessageResult{
		Valid: true,
	}, nil
}

// extractTronTxFields parses a protobuf-encoded TRON transaction to extract
// the raw_data bytes (field 1) and first signature (field 2).
// TRON Transaction protobuf: field 1 = raw_data (wire type 2), field 2 = signature (wire type 2)
func extractTronTxFields(data []byte) (rawData []byte, signature []byte, err error) {
	offset := 0
	for offset < len(data) {
		if offset >= len(data) {
			break
		}

		// Read tag (varint)
		tag, n := decodeVarint(data[offset:])
		if n == 0 {
			return nil, nil, fmt.Errorf("invalid varint at offset %d", offset)
		}
		offset += n

		fieldNumber := tag >> 3
		wireType := tag & 0x7

		switch wireType {
		case 0: // varint
			_, n = decodeVarint(data[offset:])
			if n == 0 {
				return nil, nil, fmt.Errorf("invalid varint value at offset %d", offset)
			}
			offset += n
		case 2: // length-delimited
			length, n := decodeVarint(data[offset:])
			if n == 0 {
				return nil, nil, fmt.Errorf("invalid length at offset %d", offset)
			}
			offset += n
			if offset+int(length) > len(data) {
				return nil, nil, fmt.Errorf("field extends beyond data at offset %d", offset)
			}
			fieldData := data[offset : offset+int(length)]
			offset += int(length)

			if fieldNumber == 1 && rawData == nil {
				rawData = fieldData
			} else if fieldNumber == 2 && signature == nil {
				signature = fieldData
			}
		default:
			return nil, nil, fmt.Errorf("unsupported wire type %d at offset %d", wireType, offset)
		}
	}

	if rawData == nil {
		return nil, nil, fmt.Errorf("raw_data field not found")
	}
	if signature == nil {
		return nil, nil, fmt.Errorf("signature field not found")
	}

	return rawData, signature, nil
}

// decodeVarint decodes a protobuf varint from the given bytes.
// Returns the value and number of bytes consumed, or 0 bytes on error.
func decodeVarint(data []byte) (uint64, int) {
	var value uint64
	for i := 0; i < len(data) && i < 10; i++ {
		b := data[i]
		value |= uint64(b&0x7F) << (7 * uint(i))
		if b&0x80 == 0 {
			return value, i + 1
		}
	}
	return 0, 0
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
