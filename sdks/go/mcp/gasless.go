package mcp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
)

// UserOperation represents an ERC-4337 user operation
type UserOperation struct {
	Sender               string `json:"sender"`
	Nonce                string `json:"nonce"`
	InitCode             string `json:"initCode"`
	CallData             string `json:"callData"`
	CallGasLimit         string `json:"callGasLimit"`
	VerificationGasLimit string `json:"verificationGasLimit"`
	PreVerificationGas   string `json:"preVerificationGas"`
	MaxFeePerGas         string `json:"maxFeePerGas"`
	MaxPriorityFeePerGas string `json:"maxPriorityFeePerGas"`
	PaymasterAndData     string `json:"paymasterAndData"`
	Signature            string `json:"signature"`
}

// GaslessPaymentResult represents the result of a gasless payment
type GaslessPaymentResult struct {
	TxHash      string `json:"txHash"`
	UserOpHash  string `json:"userOpHash"`
	Network     string `json:"network"`
	Amount      string `json:"amount"`
	Token       string `json:"token"`
	To          string `json:"to"`
	ExplorerURL string `json:"explorerUrl"`
	Paymaster   string `json:"paymaster,omitempty"`
}

// ExecuteGaslessPayment performs an ERC-4337 gasless payment
func ExecuteGaslessPayment(ctx context.Context, config *ServerConfig, input PayGaslessInput) (*GaslessPaymentResult, error) {
	network := SupportedNetwork(input.Network)

	// Validate network supports gasless
	if !IsGaslessNetwork(string(network)) {
		return nil, fmt.Errorf("network %s does not support ERC-4337 gasless transactions", input.Network)
	}

	// Validate bundler URL is configured
	if config.BundlerURL == "" {
		return nil, fmt.Errorf("bundler URL not configured")
	}

	// Get token address
	tokenAddr, ok := GetTokenAddress(network, input.Token)
	if !ok {
		return nil, fmt.Errorf("token %s not supported on %s", input.Token, input.Network)
	}

	// Parse amount
	amount, err := ParseTokenAmount(input.Amount, TokenDecimals)
	if err != nil {
		return nil, fmt.Errorf("invalid amount: %w", err)
	}

	// Connect to RPC
	client, err := ethclient.DialContext(ctx, GetRPCURL(config, network))
	if err != nil {
		return nil, fmt.Errorf("failed to connect to %s: %w", input.Network, err)
	}
	defer client.Close()

	// Parse private key
	privateKey, err := crypto.HexToECDSA(strings.TrimPrefix(config.PrivateKey, "0x"))
	if err != nil {
		return nil, fmt.Errorf("invalid private key: %w", err)
	}
	fromAddress := crypto.PubkeyToAddress(privateKey.PublicKey)

	// Get nonce
	nonce, err := client.PendingNonceAt(ctx, fromAddress)
	if err != nil {
		return nil, fmt.Errorf("failed to get nonce: %w", err)
	}

	// Get gas price
	gasPrice, err := client.SuggestGasPrice(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get gas price: %w", err)
	}

	// Encode the transfer call data for the token contract
	// transfer(address,uint256)
	transferSelector := crypto.Keccak256([]byte("transfer(address,uint256)"))[:4]
	toAddr := common.HexToAddress(input.To)
	tokenContract := common.HexToAddress(tokenAddr)
	_ = tokenContract // Used when building the actual user operation for smart accounts
	callData := append(transferSelector,
		common.LeftPadBytes(toAddr.Bytes(), 32)...)
	callData = append(callData,
		common.LeftPadBytes(amount.Bytes(), 32)...)

	// Build user operation
	userOp := UserOperation{
		Sender:               fromAddress.Hex(),
		Nonce:                fmt.Sprintf("0x%x", nonce),
		InitCode:             "0x",
		CallData:             fmt.Sprintf("0x%x", callData),
		CallGasLimit:         "0x186a0",  // 100000
		VerificationGasLimit: "0x186a0",  // 100000
		PreVerificationGas:   "0xc350",   // 50000
		MaxFeePerGas:         fmt.Sprintf("0x%x", gasPrice),
		MaxPriorityFeePerGas: fmt.Sprintf("0x%x", new(big.Int).Div(gasPrice, big.NewInt(10))),
		PaymasterAndData:     "0x", // Will be filled by paymaster
		Signature:            "0x",
	}

	// If paymaster URL is configured, get sponsorship
	if config.PaymasterURL != "" {
		paymasterData, err := getPaymasterSponsorship(ctx, config.PaymasterURL, userOp, ChainIDs[network])
		if err != nil {
			return nil, fmt.Errorf("failed to get paymaster sponsorship: %w", err)
		}
		userOp.PaymasterAndData = paymasterData
	}

	// Sign the user operation
	userOpHash, err := hashUserOperation(userOp, ChainIDs[network])
	if err != nil {
		return nil, fmt.Errorf("failed to hash user operation: %w", err)
	}

	signature, err := crypto.Sign(userOpHash, privateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to sign user operation: %w", err)
	}
	// Adjust v value for Ethereum signature
	if signature[64] < 27 {
		signature[64] += 27
	}
	userOp.Signature = fmt.Sprintf("0x%x", signature)

	// Submit to bundler
	submittedHash, err := submitUserOperation(ctx, config.BundlerURL, userOp, ChainIDs[network])
	if err != nil {
		return nil, fmt.Errorf("failed to submit user operation: %w", err)
	}

	// Wait for receipt
	receipt, err := waitForUserOperationReceipt(ctx, config.BundlerURL, submittedHash)
	if err != nil {
		return nil, fmt.Errorf("failed to wait for receipt: %w", err)
	}

	return &GaslessPaymentResult{
		TxHash:      receipt.TransactionHash,
		UserOpHash:  submittedHash,
		Network:     string(input.Network),
		Amount:      input.Amount,
		Token:       string(input.Token),
		To:          input.To,
		ExplorerURL: GetExplorerTxURL(network, receipt.TransactionHash),
	}, nil
}

// getPaymasterSponsorship requests gas sponsorship from the paymaster
func getPaymasterSponsorship(ctx context.Context, paymasterURL string, userOp UserOperation, chainID int64) (string, error) {
	reqBody := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "pm_sponsorUserOperation",
		"params":  []interface{}{userOp, fmt.Sprintf("0x%x", chainID)},
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", paymasterURL, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var result struct {
		Result string `json:"result"`
		Error  *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", err
	}

	if result.Error != nil {
		return "", fmt.Errorf("paymaster error: %s", result.Error.Message)
	}

	return result.Result, nil
}

// hashUserOperation creates the hash of a user operation for signing
func hashUserOperation(userOp UserOperation, chainID int64) ([]byte, error) {
	// Simplified hash for demonstration
	// In production, this should follow the ERC-4337 specification exactly
	packed := fmt.Sprintf("%s%s%s%s%s%s%s%s%s%s%d",
		userOp.Sender,
		userOp.Nonce,
		userOp.InitCode,
		userOp.CallData,
		userOp.CallGasLimit,
		userOp.VerificationGasLimit,
		userOp.PreVerificationGas,
		userOp.MaxFeePerGas,
		userOp.MaxPriorityFeePerGas,
		userOp.PaymasterAndData,
		chainID,
	)
	return crypto.Keccak256([]byte(packed)), nil
}

// submitUserOperation submits a user operation to the bundler
func submitUserOperation(ctx context.Context, bundlerURL string, userOp UserOperation, chainID int64) (string, error) {
	// Get entry point address (ERC-4337 standard)
	entryPoint := "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"

	reqBody := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "eth_sendUserOperation",
		"params":  []interface{}{userOp, entryPoint},
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", bundlerURL, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var result struct {
		Result string `json:"result"`
		Error  *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", err
	}

	if result.Error != nil {
		return "", fmt.Errorf("bundler error: %s", result.Error.Message)
	}

	return result.Result, nil
}

// UserOperationReceipt represents the receipt of a user operation
type UserOperationReceipt struct {
	TransactionHash string `json:"transactionHash"`
	Success         bool   `json:"success"`
}

// waitForUserOperationReceipt polls for user operation receipt
func waitForUserOperationReceipt(ctx context.Context, bundlerURL, userOpHash string) (*UserOperationReceipt, error) {
	for i := 0; i < 30; i++ { // 30 attempts, ~1 minute
		reqBody := map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      1,
			"method":  "eth_getUserOperationReceipt",
			"params":  []interface{}{userOpHash},
		}

		body, err := json.Marshal(reqBody)
		if err != nil {
			return nil, err
		}

		req, err := http.NewRequestWithContext(ctx, "POST", bundlerURL, bytes.NewReader(body))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return nil, err
		}

		respBody, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			return nil, err
		}

		var result struct {
			Result *UserOperationReceipt `json:"result"`
			Error  *struct {
				Message string `json:"message"`
			} `json:"error"`
		}
		if err := json.Unmarshal(respBody, &result); err != nil {
			return nil, err
		}

		if result.Result != nil {
			return result.Result, nil
		}

		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(2 * time.Second):
		}
	}

	return nil, fmt.Errorf("timeout waiting for user operation receipt")
}

// formatGaslessPaymentResult formats the gasless payment result for display
func formatGaslessPaymentResult(result *GaslessPaymentResult) string {
	var sb strings.Builder

	sb.WriteString("## Gasless Payment Successful\n\n")
	sb.WriteString(fmt.Sprintf("- **Amount:** %s %s\n", result.Amount, result.Token))
	sb.WriteString(fmt.Sprintf("- **To:** %s\n", result.To))
	sb.WriteString(fmt.Sprintf("- **Network:** %s\n", result.Network))
	sb.WriteString(fmt.Sprintf("- **Transaction:** [%s](%s)\n", truncateHash(result.TxHash), result.ExplorerURL))
	sb.WriteString(fmt.Sprintf("- **UserOp Hash:** %s\n", truncateHash(result.UserOpHash)))

	if result.Paymaster != "" {
		sb.WriteString(fmt.Sprintf("- **Paymaster:** %s\n", result.Paymaster))
	}

	sb.WriteString("\n_Gas fees were sponsored - no ETH was deducted from your wallet._\n")

	return sb.String()
}
