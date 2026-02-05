package gasless

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

// Client provides gasless ERC-4337 payment capabilities.
type Client struct {
	config Config
}

// NewClient creates a new gasless payment client.
func NewClient(config Config) *Client {
	return &Client{config: config}
}

// Pay executes a gasless payment via ERC-4337.
func (c *Client) Pay(ctx context.Context, params PaymentParams) (*PaymentResult, error) {
	// Validate network supports gasless
	if !IsGaslessNetwork(params.Network) {
		return nil, fmt.Errorf("network %s does not support ERC-4337 gasless transactions", params.Network)
	}

	if c.config.BundlerURL == "" {
		return nil, fmt.Errorf("bundler URL not configured")
	}

	// Get token address
	tokenAddr, ok := GetTokenAddress(params.Network, params.Token)
	if !ok {
		return nil, fmt.Errorf("token %s not supported on %s", params.Token, params.Network)
	}

	// Parse amount
	amount, err := ParseTokenAmount(params.Amount, TokenDecimals)
	if err != nil {
		return nil, fmt.Errorf("invalid amount: %w", err)
	}

	// Connect to RPC
	rpcURL := c.getRPCURL(params.Network)
	client, err := ethclient.DialContext(ctx, rpcURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to %s: %w", params.Network, err)
	}
	defer client.Close()

	// Parse private key
	privateKey, err := crypto.HexToECDSA(strings.TrimPrefix(c.config.PrivateKey, "0x"))
	if err != nil {
		return nil, fmt.Errorf("invalid private key: %w", err)
	}
	fromAddress := crypto.PubkeyToAddress(privateKey.PublicKey)

	// Get nonce and gas price
	nonce, err := client.PendingNonceAt(ctx, fromAddress)
	if err != nil {
		return nil, fmt.Errorf("failed to get nonce: %w", err)
	}

	gasPrice, err := client.SuggestGasPrice(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get gas price: %w", err)
	}

	// Encode transfer call data
	transferSelector := crypto.Keccak256([]byte("transfer(address,uint256)"))[:4]
	toAddr := common.HexToAddress(params.To)
	_ = common.HexToAddress(tokenAddr) // validate token address
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
		CallGasLimit:         "0x186a0",
		VerificationGasLimit: "0x186a0",
		PreVerificationGas:   "0xc350",
		MaxFeePerGas:         fmt.Sprintf("0x%x", gasPrice),
		MaxPriorityFeePerGas: fmt.Sprintf("0x%x", new(big.Int).Div(gasPrice, big.NewInt(10))),
		PaymasterAndData:     "0x",
		Signature:            "0x",
	}

	// Get paymaster sponsorship if configured
	sponsored := false
	if c.config.PaymasterURL != "" {
		chainID := ChainIDs[params.Network]
		paymasterData, err := c.getPaymasterSponsorship(ctx, userOp, chainID)
		if err != nil {
			return nil, fmt.Errorf("failed to get paymaster sponsorship: %w", err)
		}
		userOp.PaymasterAndData = paymasterData
		sponsored = true
	}

	// Sign the user operation
	chainID := ChainIDs[params.Network]
	userOpHash, err := hashUserOperation(userOp, chainID)
	if err != nil {
		return nil, fmt.Errorf("failed to hash user operation: %w", err)
	}

	signature, err := crypto.Sign(userOpHash, privateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to sign user operation: %w", err)
	}
	if signature[64] < 27 {
		signature[64] += 27
	}
	userOp.Signature = fmt.Sprintf("0x%x", signature)

	// Submit to bundler
	submittedHash, err := c.submitUserOperation(ctx, userOp, chainID)
	if err != nil {
		return nil, fmt.Errorf("failed to submit user operation: %w", err)
	}

	// Wait for receipt
	receipt, err := c.waitForReceipt(ctx, submittedHash)
	if err != nil {
		return nil, fmt.Errorf("failed to wait for receipt: %w", err)
	}

	return &PaymentResult{
		TxHash:      receipt.TransactionHash,
		UserOpHash:  submittedHash,
		Network:     params.Network,
		Amount:      params.Amount,
		Token:       params.Token,
		To:          params.To,
		Sponsored:   sponsored,
		ExplorerURL: GetExplorerTxURL(params.Network, receipt.TransactionHash),
	}, nil
}

func (c *Client) getRPCURL(network string) string {
	if c.config.RPCURLs != nil {
		if url, ok := c.config.RPCURLs[network]; ok && url != "" {
			return url
		}
	}
	return DefaultRPCURLs[network]
}

func (c *Client) getPaymasterSponsorship(ctx context.Context, userOp UserOperation, chainID int64) (string, error) {
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

	req, err := http.NewRequestWithContext(ctx, "POST", c.config.PaymasterURL, bytes.NewReader(body))
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

func (c *Client) submitUserOperation(ctx context.Context, userOp UserOperation, chainID int64) (string, error) {
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

	req, err := http.NewRequestWithContext(ctx, "POST", c.config.BundlerURL, bytes.NewReader(body))
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

func (c *Client) waitForReceipt(ctx context.Context, userOpHash string) (*UserOperationReceipt, error) {
	for i := 0; i < 30; i++ {
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

		req, err := http.NewRequestWithContext(ctx, "POST", c.config.BundlerURL, bytes.NewReader(body))
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

func hashUserOperation(userOp UserOperation, chainID int64) ([]byte, error) {
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
