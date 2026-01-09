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

// PimlicoPaymasterConfig contains configuration for Pimlico paymaster.
type PimlicoPaymasterConfig struct {
	// APIKey is the Pimlico API key
	APIKey string `json:"apiKey"`
	// ChainID is the chain ID
	ChainID int64 `json:"chainId"`
	// PaymasterURL is an optional custom paymaster URL
	PaymasterURL string `json:"paymasterUrl,omitempty"`
	// EntryPoint is the EntryPoint contract address
	EntryPoint common.Address `json:"entryPoint,omitempty"`
	// SponsorshipPolicyID is the optional sponsorship policy ID
	SponsorshipPolicyID string `json:"sponsorshipPolicyId,omitempty"`
}

// TokenQuote contains quote information for token paymaster.
type TokenQuote struct {
	// Token address
	Token common.Address `json:"token"`
	// Symbol
	Symbol string `json:"symbol"`
	// Decimals
	Decimals int `json:"decimals"`
	// Fee in token
	Fee *big.Int `json:"fee"`
	// Exchange rate
	ExchangeRate *big.Int `json:"exchangeRate"`
}

// PimlicoPaymaster is a Pimlico paymaster client.
type PimlicoPaymaster struct {
	apiKey              string
	chainID             int64
	paymasterURL        string
	entryPoint          common.Address
	sponsorshipPolicyID string
	httpClient          *http.Client
	requestID           int
}

// NewPimlicoPaymaster creates a new Pimlico paymaster client.
func NewPimlicoPaymaster(config PimlicoPaymasterConfig) *PimlicoPaymaster {
	paymasterURL := config.PaymasterURL
	if paymasterURL == "" {
		network := getPimlicoNetwork(config.ChainID)
		paymasterURL = fmt.Sprintf("https://api.pimlico.io/v2/%s/rpc?apikey=%s", network, config.APIKey)
	}

	entryPoint := config.EntryPoint
	if entryPoint == (common.Address{}) {
		entryPoint = common.HexToAddress(EntryPointV07Address)
	}

	return &PimlicoPaymaster{
		apiKey:              config.APIKey,
		chainID:             config.ChainID,
		paymasterURL:        paymasterURL,
		entryPoint:          entryPoint,
		sponsorshipPolicyID: config.SponsorshipPolicyID,
		httpClient:          &http.Client{Timeout: 30 * time.Second},
	}
}

// SponsorUserOperation sponsors a UserOperation.
func (p *PimlicoPaymaster) SponsorUserOperation(userOp *UserOperation) (*PaymasterData, error) {
	packed := packUserOpForPaymaster(userOp)

	params := []interface{}{packed, p.entryPoint.Hex()}
	if p.sponsorshipPolicyID != "" {
		params = append(params, map[string]string{
			"sponsorshipPolicyId": p.sponsorshipPolicyID,
		})
	}

	var result struct {
		PaymasterAndData              string `json:"paymasterAndData"`
		Paymaster                     string `json:"paymaster,omitempty"`
		PaymasterVerificationGasLimit string `json:"paymasterVerificationGasLimit,omitempty"`
		PaymasterPostOpGasLimit       string `json:"paymasterPostOpGasLimit,omitempty"`
		PaymasterData                 string `json:"paymasterData,omitempty"`
	}

	err := p.rpcCall("pm_sponsorUserOperation", params, &result)
	if err != nil {
		return nil, err
	}

	paymasterData := &PaymasterData{}

	// Try v0.7 format first (separate fields)
	if result.Paymaster != "" {
		paymasterData.Paymaster = common.HexToAddress(result.Paymaster)
		if result.PaymasterVerificationGasLimit != "" {
			paymasterData.PaymasterVerificationGasLimit = hexToBigInt(result.PaymasterVerificationGasLimit)
		}
		if result.PaymasterPostOpGasLimit != "" {
			paymasterData.PaymasterPostOpGasLimit = hexToBigInt(result.PaymasterPostOpGasLimit)
		}
		if result.PaymasterData != "" {
			paymasterData.PaymasterData = hexToBytes(result.PaymasterData)
		}
	} else if result.PaymasterAndData != "" && result.PaymasterAndData != "0x" {
		// Fall back to v0.6 format (packed)
		data := hexToBytes(result.PaymasterAndData)
		if len(data) >= 20 {
			paymasterData.Paymaster = common.BytesToAddress(data[:20])
		}
		if len(data) > 20 {
			paymasterData.PaymasterData = data[20:]
		}
	}

	return paymasterData, nil
}

// GetTokenQuotes gets quotes for paying gas with tokens.
func (p *PimlicoPaymaster) GetTokenQuotes(userOp *UserOperation, tokens []common.Address) ([]TokenQuote, error) {
	packed := packUserOpForPaymaster(userOp)

	tokenStrings := make([]string, len(tokens))
	for i, token := range tokens {
		tokenStrings[i] = token.Hex()
	}

	var result []struct {
		Token        string `json:"token"`
		Symbol       string `json:"symbol"`
		Decimals     int    `json:"decimals"`
		Fee          string `json:"fee"`
		ExchangeRate string `json:"exchangeRate"`
	}

	err := p.rpcCall("pimlico_getTokenQuotes", []interface{}{
		packed,
		p.entryPoint.Hex(),
		tokenStrings,
	}, &result)
	if err != nil {
		return nil, err
	}

	quotes := make([]TokenQuote, len(result))
	for i, r := range result {
		quotes[i] = TokenQuote{
			Token:        common.HexToAddress(r.Token),
			Symbol:       r.Symbol,
			Decimals:     r.Decimals,
			Fee:          hexToBigInt(r.Fee),
			ExchangeRate: hexToBigInt(r.ExchangeRate),
		}
	}

	return quotes, nil
}

// GetPaymasterData implements PaymasterClient interface.
func (p *PimlicoPaymaster) GetPaymasterData(userOp *UserOperation, chainID int64, entryPoint common.Address) (*PaymasterData, error) {
	return p.SponsorUserOperation(userOp)
}

// WillSponsor checks if the paymaster will sponsor this operation.
func (p *PimlicoPaymaster) WillSponsor(userOp *UserOperation, chainID int64, entryPoint common.Address) (bool, error) {
	_, err := p.SponsorUserOperation(userOp)
	return err == nil, nil
}

func (p *PimlicoPaymaster) rpcCall(method string, params []interface{}, result interface{}) error {
	p.requestID++

	request := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      p.requestID,
		"method":  method,
		"params":  params,
	}

	body, err := json.Marshal(request)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	resp, err := p.httpClient.Post(p.paymasterURL, "application/json", bytes.NewReader(body))
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

// BiconomyPaymasterConfig contains configuration for Biconomy paymaster.
type BiconomyPaymasterConfig struct {
	// APIKey is the Biconomy API key
	APIKey string `json:"apiKey"`
	// ChainID is the chain ID
	ChainID int64 `json:"chainId"`
	// PaymasterURL is the paymaster URL
	PaymasterURL string `json:"paymasterUrl"`
	// Mode is the paymaster mode: "sponsored" or "erc20"
	Mode string `json:"mode"`
}

// BiconomyPaymaster is a Biconomy paymaster client.
type BiconomyPaymaster struct {
	apiKey       string
	chainID      int64
	paymasterURL string
	mode         string
	httpClient   *http.Client
	requestID    int
}

// NewBiconomyPaymaster creates a new Biconomy paymaster client.
func NewBiconomyPaymaster(config BiconomyPaymasterConfig) *BiconomyPaymaster {
	return &BiconomyPaymaster{
		apiKey:       config.APIKey,
		chainID:      config.ChainID,
		paymasterURL: config.PaymasterURL,
		mode:         config.Mode,
		httpClient:   &http.Client{Timeout: 30 * time.Second},
	}
}

// GetPaymasterData gets paymaster data for a UserOperation.
func (p *BiconomyPaymaster) GetPaymasterData(userOp *UserOperation, chainID int64, entryPoint common.Address) (*PaymasterData, error) {
	packed := packUserOpForPaymaster(userOp)

	request := map[string]interface{}{
		"method":        "pm_sponsorUserOperation",
		"userOperation": packed,
		"entryPoint":    entryPoint.Hex(),
		"chainId":       chainID,
		"mode":          p.mode,
	}

	var result struct {
		PaymasterAndData              string `json:"paymasterAndData"`
		Paymaster                     string `json:"paymaster,omitempty"`
		PaymasterVerificationGasLimit string `json:"paymasterVerificationGasLimit,omitempty"`
		PaymasterPostOpGasLimit       string `json:"paymasterPostOpGasLimit,omitempty"`
		PaymasterData                 string `json:"paymasterData,omitempty"`
	}

	err := p.rpcCall("pm_sponsorUserOperation", []interface{}{request}, &result)
	if err != nil {
		return nil, err
	}

	paymasterData := &PaymasterData{}
	if result.Paymaster != "" {
		paymasterData.Paymaster = common.HexToAddress(result.Paymaster)
		if result.PaymasterVerificationGasLimit != "" {
			paymasterData.PaymasterVerificationGasLimit = hexToBigInt(result.PaymasterVerificationGasLimit)
		}
		if result.PaymasterPostOpGasLimit != "" {
			paymasterData.PaymasterPostOpGasLimit = hexToBigInt(result.PaymasterPostOpGasLimit)
		}
		if result.PaymasterData != "" {
			paymasterData.PaymasterData = hexToBytes(result.PaymasterData)
		}
	} else if result.PaymasterAndData != "" && result.PaymasterAndData != "0x" {
		data := hexToBytes(result.PaymasterAndData)
		if len(data) >= 20 {
			paymasterData.Paymaster = common.BytesToAddress(data[:20])
		}
		if len(data) > 20 {
			paymasterData.PaymasterData = data[20:]
		}
	}

	return paymasterData, nil
}

// WillSponsor checks if the paymaster will sponsor this operation.
func (p *BiconomyPaymaster) WillSponsor(userOp *UserOperation, chainID int64, entryPoint common.Address) (bool, error) {
	_, err := p.GetPaymasterData(userOp, chainID, entryPoint)
	return err == nil, nil
}

// GetFeeQuotes gets fee quotes for ERC20 token payment.
func (p *BiconomyPaymaster) GetFeeQuotes(userOp *UserOperation, tokens []common.Address) ([]TokenQuote, error) {
	packed := packUserOpForPaymaster(userOp)

	tokenStrings := make([]string, len(tokens))
	for i, token := range tokens {
		tokenStrings[i] = token.Hex()
	}

	var result []struct {
		Token        string `json:"token"`
		Symbol       string `json:"symbol"`
		Decimals     int    `json:"decimals"`
		Fee          string `json:"fee"`
		ExchangeRate string `json:"exchangeRate"`
	}

	err := p.rpcCall("pm_getFeeQuotes", []interface{}{
		packed,
		tokenStrings,
	}, &result)
	if err != nil {
		return nil, err
	}

	quotes := make([]TokenQuote, len(result))
	for i, r := range result {
		quotes[i] = TokenQuote{
			Token:        common.HexToAddress(r.Token),
			Symbol:       r.Symbol,
			Decimals:     r.Decimals,
			Fee:          hexToBigInt(r.Fee),
			ExchangeRate: hexToBigInt(r.ExchangeRate),
		}
	}

	return quotes, nil
}

func (p *BiconomyPaymaster) rpcCall(method string, params []interface{}, result interface{}) error {
	p.requestID++

	request := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      p.requestID,
		"method":  method,
		"params":  params,
	}

	body, err := json.Marshal(request)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", p.paymasterURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", p.apiKey)

	resp, err := p.httpClient.Do(req)
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

// StackupPaymasterConfig contains configuration for Stackup paymaster.
type StackupPaymasterConfig struct {
	// APIKey is the Stackup API key
	APIKey string `json:"apiKey"`
	// ChainID is the chain ID
	ChainID int64 `json:"chainId"`
	// PaymasterURL is the paymaster URL
	PaymasterURL string `json:"paymasterUrl"`
	// Type is the paymaster type
	Type string `json:"type,omitempty"`
}

// StackupPaymaster is a Stackup paymaster client.
type StackupPaymaster struct {
	apiKey       string
	chainID      int64
	paymasterURL string
	pmType       string
	httpClient   *http.Client
	requestID    int
}

// NewStackupPaymaster creates a new Stackup paymaster client.
func NewStackupPaymaster(config StackupPaymasterConfig) *StackupPaymaster {
	return &StackupPaymaster{
		apiKey:       config.APIKey,
		chainID:      config.ChainID,
		paymasterURL: config.PaymasterURL,
		pmType:       config.Type,
		httpClient:   &http.Client{Timeout: 30 * time.Second},
	}
}

// GetPaymasterData gets paymaster data for a UserOperation.
func (p *StackupPaymaster) GetPaymasterData(userOp *UserOperation, chainID int64, entryPoint common.Address) (*PaymasterData, error) {
	packed := packUserOpForPaymaster(userOp)

	context := map[string]interface{}{}
	if p.pmType != "" {
		context["type"] = p.pmType
	}

	var result struct {
		PaymasterAndData              string `json:"paymasterAndData"`
		Paymaster                     string `json:"paymaster,omitempty"`
		PaymasterVerificationGasLimit string `json:"paymasterVerificationGasLimit,omitempty"`
		PaymasterPostOpGasLimit       string `json:"paymasterPostOpGasLimit,omitempty"`
		PaymasterData                 string `json:"paymasterData,omitempty"`
	}

	err := p.rpcCall("pm_getPaymasterStubData", []interface{}{
		packed,
		entryPoint.Hex(),
		fmt.Sprintf("0x%x", chainID),
		context,
	}, &result)
	if err != nil {
		return nil, err
	}

	paymasterData := &PaymasterData{}
	if result.Paymaster != "" {
		paymasterData.Paymaster = common.HexToAddress(result.Paymaster)
		if result.PaymasterVerificationGasLimit != "" {
			paymasterData.PaymasterVerificationGasLimit = hexToBigInt(result.PaymasterVerificationGasLimit)
		}
		if result.PaymasterPostOpGasLimit != "" {
			paymasterData.PaymasterPostOpGasLimit = hexToBigInt(result.PaymasterPostOpGasLimit)
		}
		if result.PaymasterData != "" {
			paymasterData.PaymasterData = hexToBytes(result.PaymasterData)
		}
	} else if result.PaymasterAndData != "" && result.PaymasterAndData != "0x" {
		data := hexToBytes(result.PaymasterAndData)
		if len(data) >= 20 {
			paymasterData.Paymaster = common.BytesToAddress(data[:20])
		}
		if len(data) > 20 {
			paymasterData.PaymasterData = data[20:]
		}
	}

	return paymasterData, nil
}

// WillSponsor checks if the paymaster will sponsor this operation.
func (p *StackupPaymaster) WillSponsor(userOp *UserOperation, chainID int64, entryPoint common.Address) (bool, error) {
	_, err := p.GetPaymasterData(userOp, chainID, entryPoint)
	return err == nil, nil
}

func (p *StackupPaymaster) rpcCall(method string, params []interface{}, result interface{}) error {
	p.requestID++

	request := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      p.requestID,
		"method":  method,
		"params":  params,
	}

	body, err := json.Marshal(request)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", p.paymasterURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+p.apiKey)

	resp, err := p.httpClient.Do(req)
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

// Helper function to pack UserOperation for paymaster
func packUserOpForPaymaster(userOp *UserOperation) map[string]interface{} {
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
	} else {
		result["verificationGasLimit"] = bigIntToHex(DefaultGasLimits.VerificationGasLimit)
	}

	if userOp.CallGasLimit != nil {
		result["callGasLimit"] = bigIntToHex(userOp.CallGasLimit)
	} else {
		result["callGasLimit"] = bigIntToHex(DefaultGasLimits.CallGasLimit)
	}

	if userOp.PreVerificationGas != nil {
		result["preVerificationGas"] = bigIntToHex(userOp.PreVerificationGas)
	} else {
		result["preVerificationGas"] = bigIntToHex(DefaultGasLimits.PreVerificationGas)
	}

	if userOp.MaxFeePerGas != nil {
		result["maxFeePerGas"] = bigIntToHex(userOp.MaxFeePerGas)
	} else {
		result["maxFeePerGas"] = "0x0"
	}

	if userOp.MaxPriorityFeePerGas != nil {
		result["maxPriorityFeePerGas"] = bigIntToHex(userOp.MaxPriorityFeePerGas)
	} else {
		result["maxPriorityFeePerGas"] = "0x0"
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
