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

// AlchemyConfig contains configuration for Alchemy bundler client.
type AlchemyConfig struct {
	// APIKey is the Alchemy API key
	APIKey string `json:"apiKey"`
	// ChainID is the chain ID
	ChainID int64 `json:"chainId"`
	// BundlerURL is an optional custom bundler URL
	BundlerURL string `json:"bundlerUrl,omitempty"`
	// EntryPoint is the EntryPoint contract address (optional, defaults to v0.7)
	EntryPoint common.Address `json:"entryPoint,omitempty"`
	// PolicyID is the Alchemy gas manager policy ID for sponsorship
	PolicyID string `json:"policyId,omitempty"`
}

// AssetChange represents an asset change from simulation.
type AssetChange struct {
	// AssetType: native, erc20, erc721, erc1155
	AssetType string `json:"assetType"`
	// ChangeType: transfer_in, transfer_out
	ChangeType string `json:"changeType"`
	// From account
	From common.Address `json:"from"`
	// To account
	To common.Address `json:"to"`
	// Amount (for native/erc20) or empty
	Amount *big.Int `json:"amount,omitempty"`
	// TokenID (for erc721)
	TokenID *big.Int `json:"tokenId,omitempty"`
	// ContractAddress (for tokens)
	ContractAddress common.Address `json:"contractAddress,omitempty"`
	// Symbol
	Symbol string `json:"symbol,omitempty"`
	// Name
	Name string `json:"name,omitempty"`
	// Decimals
	Decimals int `json:"decimals,omitempty"`
}

// SimulationResult contains the result of asset simulation.
type SimulationResult struct {
	// Success indicates if simulation succeeded
	Success bool `json:"success"`
	// Error message if failed
	Error string `json:"error,omitempty"`
	// Changes from the operation
	Changes []AssetChange `json:"changes"`
}

// GasAndPaymasterResult contains combined gas + paymaster data.
type GasAndPaymasterResult struct {
	// GasEstimate from the bundler
	GasEstimate *GasEstimate `json:"gasEstimate"`
	// PaymasterData if sponsorship is enabled
	PaymasterData *PaymasterData `json:"paymasterData,omitempty"`
	// MaxFeePerGas recommended
	MaxFeePerGas *big.Int `json:"maxFeePerGas"`
	// MaxPriorityFeePerGas recommended
	MaxPriorityFeePerGas *big.Int `json:"maxPriorityFeePerGas"`
}

// AlchemyBundlerClient is an Alchemy-specific bundler client.
type AlchemyBundlerClient struct {
	*GenericBundlerClient
	apiKey     string
	alchemyURL string
	policyID   string
}

// NewAlchemyBundlerClient creates a new Alchemy bundler client.
func NewAlchemyBundlerClient(config AlchemyConfig) *AlchemyBundlerClient {
	bundlerURL := config.BundlerURL
	if bundlerURL == "" {
		network, _ := GetAlchemyNetwork(config.ChainID)
		bundlerURL = fmt.Sprintf("https://%s.g.alchemy.com/v2/%s", network, config.APIKey)
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

	return &AlchemyBundlerClient{
		GenericBundlerClient: genericClient,
		apiKey:               config.APIKey,
		alchemyURL:           bundlerURL,
		policyID:             config.PolicyID,
	}
}

// RequestGasAndPaymasterAndData requests gas estimates and paymaster data in one call.
func (c *AlchemyBundlerClient) RequestGasAndPaymasterAndData(
	userOp *UserOperation,
	overrides *GasOverrides,
) (*GasAndPaymasterResult, error) {
	if c.policyID == "" {
		return nil, fmt.Errorf("Alchemy policy ID required for gas sponsorship")
	}

	packed := c.packPartialUserOp(userOp)

	request := map[string]interface{}{
		"policyId":      c.policyID,
		"entryPoint":    c.entryPoint.Hex(),
		"userOperation": packed,
		"dummySignature": getDummySignature(),
	}

	if overrides != nil {
		overridesMap := make(map[string]string)
		if overrides.MaxFeePerGas != nil {
			overridesMap["maxFeePerGas"] = bigIntToHex(overrides.MaxFeePerGas)
		}
		if overrides.MaxPriorityFeePerGas != nil {
			overridesMap["maxPriorityFeePerGas"] = bigIntToHex(overrides.MaxPriorityFeePerGas)
		}
		if overrides.CallGasLimit != nil {
			overridesMap["callGasLimit"] = bigIntToHex(overrides.CallGasLimit)
		}
		if overrides.VerificationGasLimit != nil {
			overridesMap["verificationGasLimit"] = bigIntToHex(overrides.VerificationGasLimit)
		}
		if overrides.PreVerificationGas != nil {
			overridesMap["preVerificationGas"] = bigIntToHex(overrides.PreVerificationGas)
		}
		if len(overridesMap) > 0 {
			request["overrides"] = overridesMap
		}
	}

	var result struct {
		PaymasterAndData     string `json:"paymasterAndData"`
		CallGasLimit         string `json:"callGasLimit"`
		VerificationGasLimit string `json:"verificationGasLimit"`
		PreVerificationGas   string `json:"preVerificationGas"`
		MaxFeePerGas         string `json:"maxFeePerGas"`
		MaxPriorityFeePerGas string `json:"maxPriorityFeePerGas"`
	}

	err := c.alchemyRPCCall("alchemy_requestGasAndPaymasterAndData", []interface{}{request}, &result)
	if err != nil {
		return nil, err
	}

	gasResult := &GasAndPaymasterResult{
		GasEstimate: &GasEstimate{
			VerificationGasLimit: hexToBigInt(result.VerificationGasLimit),
			CallGasLimit:         hexToBigInt(result.CallGasLimit),
			PreVerificationGas:   hexToBigInt(result.PreVerificationGas),
		},
		MaxFeePerGas:         hexToBigInt(result.MaxFeePerGas),
		MaxPriorityFeePerGas: hexToBigInt(result.MaxPriorityFeePerGas),
	}

	// Parse paymasterAndData into PaymasterData
	if result.PaymasterAndData != "" && result.PaymasterAndData != "0x" && len(result.PaymasterAndData) >= 106 {
		paymasterData := &PaymasterData{
			Paymaster: common.HexToAddress(result.PaymasterAndData[0:42]),
		}
		// Parse verification gas limit (bytes 20-36)
		if len(result.PaymasterAndData) >= 74 {
			paymasterData.PaymasterVerificationGasLimit = hexToBigInt(result.PaymasterAndData[42:74])
		}
		// Parse post-op gas limit (bytes 36-52)
		if len(result.PaymasterAndData) >= 106 {
			paymasterData.PaymasterPostOpGasLimit = hexToBigInt(result.PaymasterAndData[74:106])
		}
		// Parse data (bytes 52+)
		if len(result.PaymasterAndData) > 106 {
			paymasterData.PaymasterData = hexToBytes(result.PaymasterAndData[106:])
		}
		gasResult.PaymasterData = paymasterData
		gasResult.GasEstimate.PaymasterVerificationGasLimit = paymasterData.PaymasterVerificationGasLimit
		gasResult.GasEstimate.PaymasterPostOpGasLimit = paymasterData.PaymasterPostOpGasLimit
	}

	return gasResult, nil
}

// SimulateUserOperationAssetChanges simulates asset changes from a UserOperation.
func (c *AlchemyBundlerClient) SimulateUserOperationAssetChanges(userOp *UserOperation) (*SimulationResult, error) {
	packed := c.packUserOp(userOp)

	request := map[string]interface{}{
		"entryPoint":    c.entryPoint.Hex(),
		"userOperation": packed,
	}

	var result struct {
		Changes []struct {
			AssetType       string `json:"assetType"`
			ChangeType      string `json:"changeType"`
			From            string `json:"from"`
			To              string `json:"to"`
			Amount          string `json:"amount,omitempty"`
			TokenID         string `json:"tokenId,omitempty"`
			ContractAddress string `json:"contractAddress,omitempty"`
			Symbol          string `json:"symbol,omitempty"`
			Name            string `json:"name,omitempty"`
			Decimals        int    `json:"decimals,omitempty"`
		} `json:"changes"`
	}

	err := c.alchemyRPCCall("alchemy_simulateUserOperationAssetChanges", []interface{}{request}, &result)
	if err != nil {
		return &SimulationResult{
			Success: false,
			Error:   err.Error(),
			Changes: []AssetChange{},
		}, nil
	}

	changes := make([]AssetChange, len(result.Changes))
	for i, change := range result.Changes {
		changes[i] = AssetChange{
			AssetType:       change.AssetType,
			ChangeType:      change.ChangeType,
			From:            common.HexToAddress(change.From),
			To:              common.HexToAddress(change.To),
			Symbol:          change.Symbol,
			Name:            change.Name,
			Decimals:        change.Decimals,
		}
		if change.Amount != "" {
			changes[i].Amount = hexToBigInt(change.Amount)
		}
		if change.TokenID != "" {
			changes[i].TokenID = hexToBigInt(change.TokenID)
		}
		if change.ContractAddress != "" {
			changes[i].ContractAddress = common.HexToAddress(change.ContractAddress)
		}
	}

	return &SimulationResult{
		Success: true,
		Changes: changes,
	}, nil
}

// GetFeeHistory gets fee history for gas estimation.
func (c *AlchemyBundlerClient) GetFeeHistory() (*FeeHistory, error) {
	var result struct {
		BaseFeePerGas []string   `json:"baseFeePerGas"`
		Reward        [][]string `json:"reward"`
	}

	err := c.alchemyRPCCall("eth_feeHistory", []interface{}{"0x5", "latest", []int{25, 50, 75}}, &result)
	if err != nil {
		return nil, err
	}

	if len(result.BaseFeePerGas) == 0 {
		return nil, fmt.Errorf("empty fee history response")
	}

	latestBaseFee := hexToBigInt(result.BaseFeePerGas[len(result.BaseFeePerGas)-1])

	var medianPriorityFee *big.Int
	if len(result.Reward) > 0 {
		midIdx := len(result.Reward) / 2
		if len(result.Reward[midIdx]) > 1 {
			medianPriorityFee = hexToBigInt(result.Reward[midIdx][1])
		} else if len(result.Reward[midIdx]) > 0 {
			medianPriorityFee = hexToBigInt(result.Reward[midIdx][0])
		}
	}
	if medianPriorityFee == nil {
		medianPriorityFee = big.NewInt(1000000000) // 1 gwei default
	}

	// maxFeePerGas = baseFee * 2 + priorityFee
	maxFeePerGas := new(big.Int).Mul(latestBaseFee, big.NewInt(2))
	maxFeePerGas.Add(maxFeePerGas, medianPriorityFee)

	return &FeeHistory{
		BaseFeePerGas:        latestBaseFee,
		MaxPriorityFeePerGas: medianPriorityFee,
		MaxFeePerGas:         maxFeePerGas,
	}, nil
}

// FeeHistory contains fee history data.
type FeeHistory struct {
	BaseFeePerGas        *big.Int `json:"baseFeePerGas"`
	MaxPriorityFeePerGas *big.Int `json:"maxPriorityFeePerGas"`
	MaxFeePerGas         *big.Int `json:"maxFeePerGas"`
}

// GasOverrides contains optional gas overrides for estimation.
type GasOverrides struct {
	MaxFeePerGas         *big.Int
	MaxPriorityFeePerGas *big.Int
	CallGasLimit         *big.Int
	VerificationGasLimit *big.Int
	PreVerificationGas   *big.Int
}

// packPartialUserOp packs a partial UserOperation for estimation.
func (c *AlchemyBundlerClient) packPartialUserOp(userOp *UserOperation) map[string]interface{} {
	result := map[string]interface{}{
		"sender":   userOp.Sender.Hex(),
		"callData": bytesToHex(userOp.CallData),
	}

	if userOp.Nonce != nil {
		result["nonce"] = bigIntToHex(userOp.Nonce)
	} else {
		result["nonce"] = "0x0"
	}

	if len(userOp.InitCode) > 0 {
		result["initCode"] = bytesToHex(userOp.InitCode)
	} else {
		result["initCode"] = "0x"
	}

	if userOp.VerificationGasLimit != nil {
		result["verificationGasLimit"] = bigIntToHex(userOp.VerificationGasLimit)
	}
	if userOp.CallGasLimit != nil {
		result["callGasLimit"] = bigIntToHex(userOp.CallGasLimit)
	}
	if userOp.PreVerificationGas != nil {
		result["preVerificationGas"] = bigIntToHex(userOp.PreVerificationGas)
	}
	if userOp.MaxFeePerGas != nil {
		result["maxFeePerGas"] = bigIntToHex(userOp.MaxFeePerGas)
	}
	if userOp.MaxPriorityFeePerGas != nil {
		result["maxPriorityFeePerGas"] = bigIntToHex(userOp.MaxPriorityFeePerGas)
	}

	if len(userOp.PaymasterAndData) > 0 {
		result["paymasterAndData"] = bytesToHex(userOp.PaymasterAndData)
	} else {
		result["paymasterAndData"] = "0x"
	}

	if len(userOp.Signature) > 0 {
		result["signature"] = bytesToHex(userOp.Signature)
	} else {
		result["signature"] = getDummySignature()
	}

	return result
}

// alchemyRPCCall makes an Alchemy-specific RPC call.
func (c *AlchemyBundlerClient) alchemyRPCCall(method string, params []interface{}, result interface{}) error {
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
	resp, err := httpClient.Post(c.alchemyURL, "application/json", bytes.NewReader(body))
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

// getDummySignature returns a dummy signature for gas estimation.
func getDummySignature() string {
	return "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c"
}
