package erc4337

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"time"

	"github.com/ethereum/go-ethereum/common"
)

// PimlicoConfig contains configuration for Pimlico bundler client.
type PimlicoConfig struct {
	// APIKey is the Pimlico API key
	APIKey string `json:"apiKey"`
	// ChainID is the chain ID
	ChainID int64 `json:"chainId"`
	// BundlerURL is an optional custom bundler URL
	BundlerURL string `json:"bundlerUrl,omitempty"`
	// EntryPoint is the EntryPoint contract address (optional, defaults to v0.7)
	EntryPoint common.Address `json:"entryPoint,omitempty"`
}

// PimlicoGasPrice contains gas price estimates from Pimlico.
type PimlicoGasPrice struct {
	Slow struct {
		MaxFeePerGas         *big.Int `json:"maxFeePerGas"`
		MaxPriorityFeePerGas *big.Int `json:"maxPriorityFeePerGas"`
	} `json:"slow"`
	Standard struct {
		MaxFeePerGas         *big.Int `json:"maxFeePerGas"`
		MaxPriorityFeePerGas *big.Int `json:"maxPriorityFeePerGas"`
	} `json:"standard"`
	Fast struct {
		MaxFeePerGas         *big.Int `json:"maxFeePerGas"`
		MaxPriorityFeePerGas *big.Int `json:"maxPriorityFeePerGas"`
	} `json:"fast"`
}

// PimlicoBundlerClient is a Pimlico-specific bundler client.
type PimlicoBundlerClient struct {
	*GenericBundlerClient
	apiKey     string
	pimlicoURL string
}

// NewPimlicoBundlerClient creates a new Pimlico bundler client.
func NewPimlicoBundlerClient(config PimlicoConfig) *PimlicoBundlerClient {
	bundlerURL := config.BundlerURL
	if bundlerURL == "" {
		network := getPimlicoNetwork(config.ChainID)
		bundlerURL = fmt.Sprintf("https://api.pimlico.io/v2/%s/rpc?apikey=%s", network, config.APIKey)
	}

	entryPoint := config.EntryPoint
	if entryPoint == (common.Address{}) {
		entryPoint = common.HexToAddress(EntryPointV07Address)
	}

	genericClient := NewBundlerClient(BundlerConfig{
		BundlerURL: bundlerURL,
		EntryPoint: entryPoint,
		ChainID:    config.ChainID,
	})

	return &PimlicoBundlerClient{
		GenericBundlerClient: genericClient,
		apiKey:               config.APIKey,
		pimlicoURL:           bundlerURL,
	}
}

// GetUserOperationGasPrice retrieves gas prices from Pimlico.
func (c *PimlicoBundlerClient) GetUserOperationGasPrice() (*PimlicoGasPrice, error) {
	var result struct {
		Slow struct {
			MaxFeePerGas         string `json:"maxFeePerGas"`
			MaxPriorityFeePerGas string `json:"maxPriorityFeePerGas"`
		} `json:"slow"`
		Standard struct {
			MaxFeePerGas         string `json:"maxFeePerGas"`
			MaxPriorityFeePerGas string `json:"maxPriorityFeePerGas"`
		} `json:"standard"`
		Fast struct {
			MaxFeePerGas         string `json:"maxFeePerGas"`
			MaxPriorityFeePerGas string `json:"maxPriorityFeePerGas"`
		} `json:"fast"`
	}

	err := c.pimlicoRPCCall("pimlico_getUserOperationGasPrice", []interface{}{}, &result)
	if err != nil {
		return nil, err
	}

	return &PimlicoGasPrice{
		Slow: struct {
			MaxFeePerGas         *big.Int `json:"maxFeePerGas"`
			MaxPriorityFeePerGas *big.Int `json:"maxPriorityFeePerGas"`
		}{
			MaxFeePerGas:         hexToBigInt(result.Slow.MaxFeePerGas),
			MaxPriorityFeePerGas: hexToBigInt(result.Slow.MaxPriorityFeePerGas),
		},
		Standard: struct {
			MaxFeePerGas         *big.Int `json:"maxFeePerGas"`
			MaxPriorityFeePerGas *big.Int `json:"maxPriorityFeePerGas"`
		}{
			MaxFeePerGas:         hexToBigInt(result.Standard.MaxFeePerGas),
			MaxPriorityFeePerGas: hexToBigInt(result.Standard.MaxPriorityFeePerGas),
		},
		Fast: struct {
			MaxFeePerGas         *big.Int `json:"maxFeePerGas"`
			MaxPriorityFeePerGas *big.Int `json:"maxPriorityFeePerGas"`
		}{
			MaxFeePerGas:         hexToBigInt(result.Fast.MaxFeePerGas),
			MaxPriorityFeePerGas: hexToBigInt(result.Fast.MaxPriorityFeePerGas),
		},
	}, nil
}

// SendCompressedUserOperation sends a compressed UserOperation for gas savings.
func (c *PimlicoBundlerClient) SendCompressedUserOperation(
	compressedCalldata []byte,
	inflatorAddress common.Address,
) (common.Hash, error) {
	var result string
	err := c.pimlicoRPCCall("pimlico_sendCompressedUserOperation", []interface{}{
		bytesToHex(compressedCalldata),
		inflatorAddress.Hex(),
		c.entryPoint.Hex(),
	}, &result)
	if err != nil {
		return common.Hash{}, err
	}

	return common.HexToHash(result), nil
}

// GetUserOperationStatus gets the status of a UserOperation.
func (c *PimlicoBundlerClient) GetUserOperationStatus(userOpHash common.Hash) (*UserOperationStatus, error) {
	var result struct {
		Status        string `json:"status"`
		TransactionHash string `json:"transactionHash,omitempty"`
	}

	err := c.pimlicoRPCCall("pimlico_getUserOperationStatus", []interface{}{userOpHash.Hex()}, &result)
	if err != nil {
		return nil, err
	}

	status := &UserOperationStatus{
		Status: result.Status,
	}
	if result.TransactionHash != "" {
		status.TransactionHash = common.HexToHash(result.TransactionHash)
	}

	return status, nil
}

// UserOperationStatus represents the status of a UserOperation.
type UserOperationStatus struct {
	// Status: "not_found", "submitted", "pending", "included", "failed"
	Status          string      `json:"status"`
	TransactionHash common.Hash `json:"transactionHash,omitempty"`
}

// pimlicoRPCCall makes a Pimlico-specific RPC call.
func (c *PimlicoBundlerClient) pimlicoRPCCall(method string, params []interface{}, result interface{}) error {
	c.requestID++

	request := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      c.requestID,
		"method":  method,
		"params":  params,
	}

	body, err := json.Marshal(request)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	httpClient := &http.Client{Timeout: 30 * time.Second}
	resp, err := httpClient.Post(c.pimlicoURL, "application/json", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("HTTP error %d: %s", resp.StatusCode, string(body))
	}

	var response struct {
		Result json.RawMessage `json:"result"`
		Error  *struct {
			Code    int             `json:"code"`
			Message string          `json:"message"`
			Data    json.RawMessage `json:"data,omitempty"`
		} `json:"error"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return fmt.Errorf("failed to decode response: %w", err)
	}

	if response.Error != nil {
		return fmt.Errorf("RPC error %d: %s", response.Error.Code, response.Error.Message)
	}

	if result != nil && len(response.Result) > 0 {
		if err := json.Unmarshal(response.Result, result); err != nil {
			return fmt.Errorf("failed to unmarshal result: %w", err)
		}
	}

	return nil
}

// getPimlicoNetwork returns the Pimlico network name for a chain ID.
func getPimlicoNetwork(chainID int64) string {
	networks := map[int64]string{
		1:        "ethereum",
		11155111: "sepolia",
		137:      "polygon",
		80001:    "mumbai",
		10:       "optimism",
		420:      "optimism-goerli",
		42161:    "arbitrum",
		421613:   "arbitrum-goerli",
		8453:     "base",
		84532:    "base-sepolia",
	}

	if network, ok := networks[chainID]; ok {
		return network
	}
	return fmt.Sprintf("%d", chainID)
}
