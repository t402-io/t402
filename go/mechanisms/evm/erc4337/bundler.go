package erc4337

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/common"
)

// GenericBundlerClient is a generic bundler client implementation.
type GenericBundlerClient struct {
	bundlerURL string
	entryPoint common.Address
	chainID    int64
	requestID  int
	httpClient *http.Client
}

// NewBundlerClient creates a new generic bundler client.
func NewBundlerClient(config BundlerConfig) *GenericBundlerClient {
	entryPoint := config.EntryPoint
	if entryPoint == (common.Address{}) {
		entryPoint = common.HexToAddress(EntryPointV07Address)
	}

	return &GenericBundlerClient{
		bundlerURL: config.BundlerURL,
		entryPoint: entryPoint,
		chainID:    config.ChainID,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// SendUserOperation submits a UserOperation to the bundler.
func (c *GenericBundlerClient) SendUserOperation(userOp *UserOperation) (common.Hash, error) {
	packed := c.packUserOp(userOp)

	var result string
	err := c.rpcCall(BundlerMethods.SendUserOperation, []interface{}{packed, c.entryPoint.Hex()}, &result)
	if err != nil {
		return common.Hash{}, err
	}

	return common.HexToHash(result), nil
}

// EstimateUserOperationGas estimates gas for a UserOperation.
func (c *GenericBundlerClient) EstimateUserOperationGas(userOp *UserOperation) (*GasEstimate, error) {
	packed := c.packUserOp(userOp)

	var result struct {
		VerificationGasLimit          string `json:"verificationGasLimit"`
		CallGasLimit                  string `json:"callGasLimit"`
		PreVerificationGas            string `json:"preVerificationGas"`
		PaymasterVerificationGasLimit string `json:"paymasterVerificationGasLimit,omitempty"`
		PaymasterPostOpGasLimit       string `json:"paymasterPostOpGasLimit,omitempty"`
	}

	err := c.rpcCall(BundlerMethods.EstimateUserOperationGas, []interface{}{packed, c.entryPoint.Hex()}, &result)
	if err != nil {
		return nil, err
	}

	estimate := &GasEstimate{
		VerificationGasLimit: hexToBigInt(result.VerificationGasLimit),
		CallGasLimit:         hexToBigInt(result.CallGasLimit),
		PreVerificationGas:   hexToBigInt(result.PreVerificationGas),
	}

	if result.PaymasterVerificationGasLimit != "" {
		estimate.PaymasterVerificationGasLimit = hexToBigInt(result.PaymasterVerificationGasLimit)
	}
	if result.PaymasterPostOpGasLimit != "" {
		estimate.PaymasterPostOpGasLimit = hexToBigInt(result.PaymasterPostOpGasLimit)
	}

	return estimate, nil
}

// GetUserOperationByHash retrieves a UserOperation by hash.
func (c *GenericBundlerClient) GetUserOperationByHash(hash common.Hash) (*UserOperation, error) {
	var result struct {
		UserOperation map[string]interface{} `json:"userOperation"`
		EntryPoint    string                 `json:"entryPoint"`
	}

	err := c.rpcCall(BundlerMethods.GetUserOperationByHash, []interface{}{hash.Hex()}, &result)
	if err != nil {
		return nil, err
	}

	if result.UserOperation == nil {
		return nil, nil
	}

	// Parse the UserOperation from the result
	return parseUserOp(result.UserOperation), nil
}

// GetUserOperationReceipt retrieves the receipt for a UserOperation.
func (c *GenericBundlerClient) GetUserOperationReceipt(hash common.Hash) (*UserOperationReceipt, error) {
	var result struct {
		UserOpHash    string `json:"userOpHash"`
		Sender        string `json:"sender"`
		Nonce         string `json:"nonce"`
		Paymaster     string `json:"paymaster,omitempty"`
		ActualGasCost string `json:"actualGasCost"`
		ActualGasUsed string `json:"actualGasUsed"`
		Success       bool   `json:"success"`
		Reason        string `json:"reason,omitempty"`
		Receipt       struct {
			TransactionHash string `json:"transactionHash"`
			BlockNumber     string `json:"blockNumber"`
			BlockHash       string `json:"blockHash"`
		} `json:"receipt"`
	}

	err := c.rpcCall(BundlerMethods.GetUserOperationReceipt, []interface{}{hash.Hex()}, &result)
	if err != nil {
		return nil, err
	}

	if result.UserOpHash == "" {
		return nil, nil
	}

	receipt := &UserOperationReceipt{
		UserOpHash:    common.HexToHash(result.UserOpHash),
		Sender:        common.HexToAddress(result.Sender),
		Nonce:         hexToBigInt(result.Nonce),
		ActualGasCost: hexToBigInt(result.ActualGasCost),
		ActualGasUsed: hexToBigInt(result.ActualGasUsed),
		Success:       result.Success,
		Reason:        result.Reason,
		Receipt: TransactionReceipt{
			TransactionHash: common.HexToHash(result.Receipt.TransactionHash),
			BlockNumber:     hexToBigInt(result.Receipt.BlockNumber),
			BlockHash:       common.HexToHash(result.Receipt.BlockHash),
		},
	}

	if result.Paymaster != "" && result.Paymaster != "0x" {
		paymaster := common.HexToAddress(result.Paymaster)
		receipt.Paymaster = &paymaster
	}

	return receipt, nil
}

// GetSupportedEntryPoints returns supported EntryPoint addresses.
func (c *GenericBundlerClient) GetSupportedEntryPoints() ([]common.Address, error) {
	var result []string
	err := c.rpcCall(BundlerMethods.SupportedEntryPoints, []interface{}{}, &result)
	if err != nil {
		return nil, err
	}

	addresses := make([]common.Address, len(result))
	for i, addr := range result {
		addresses[i] = common.HexToAddress(addr)
	}

	return addresses, nil
}

// WaitForReceipt waits for a UserOperation receipt with polling.
func (c *GenericBundlerClient) WaitForReceipt(hash common.Hash, timeout, pollingInterval time.Duration) (*UserOperationReceipt, error) {
	if timeout == 0 {
		timeout = 60 * time.Second
	}
	if pollingInterval == 0 {
		pollingInterval = 2 * time.Second
	}

	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		receipt, err := c.GetUserOperationReceipt(hash)
		if err != nil {
			return nil, err
		}
		if receipt != nil {
			return receipt, nil
		}
		time.Sleep(pollingInterval)
	}

	return nil, fmt.Errorf("timeout waiting for UserOperation receipt: %s", hash.Hex())
}

// packUserOp packs a UserOperation for RPC transmission.
func (c *GenericBundlerClient) packUserOp(userOp *UserOperation) map[string]interface{} {
	accountGasLimits := PackAccountGasLimits(userOp.VerificationGasLimit, userOp.CallGasLimit)
	gasFees := PackGasFees(userOp.MaxPriorityFeePerGas, userOp.MaxFeePerGas)

	return map[string]interface{}{
		"sender":             userOp.Sender.Hex(),
		"nonce":              bigIntToHex(userOp.Nonce),
		"initCode":           bytesToHex(userOp.InitCode),
		"callData":           bytesToHex(userOp.CallData),
		"accountGasLimits":   bytesToHex(accountGasLimits[:]),
		"preVerificationGas": bigIntToHex(userOp.PreVerificationGas),
		"gasFees":            bytesToHex(gasFees[:]),
		"paymasterAndData":   bytesToHex(userOp.PaymasterAndData),
		"signature":          bytesToHex(userOp.Signature),
	}
}

// rpcCall makes a JSON-RPC call to the bundler.
func (c *GenericBundlerClient) rpcCall(method string, params []interface{}, result interface{}) error {
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

	resp, err := c.httpClient.Post(c.bundlerURL, "application/json", bytes.NewReader(body))
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

// Helper functions

func bigIntToHex(n *big.Int) string {
	if n == nil {
		return "0x0"
	}
	return "0x" + n.Text(16)
}

func bytesToHex(b []byte) string {
	if len(b) == 0 {
		return "0x"
	}
	return "0x" + hex.EncodeToString(b)
}

func hexToBigInt(s string) *big.Int {
	s = strings.TrimPrefix(s, "0x")
	if s == "" {
		return big.NewInt(0)
	}
	n := new(big.Int)
	n.SetString(s, 16)
	return n
}

func hexToBytes(s string) []byte {
	s = strings.TrimPrefix(s, "0x")
	if s == "" {
		return nil
	}
	b, _ := hex.DecodeString(s)
	return b
}

func parseUserOp(data map[string]interface{}) *UserOperation {
	userOp := &UserOperation{}

	if sender, ok := data["sender"].(string); ok {
		userOp.Sender = common.HexToAddress(sender)
	}
	if nonce, ok := data["nonce"].(string); ok {
		userOp.Nonce = hexToBigInt(nonce)
	}
	if initCode, ok := data["initCode"].(string); ok {
		userOp.InitCode = hexToBytes(initCode)
	}
	if callData, ok := data["callData"].(string); ok {
		userOp.CallData = hexToBytes(callData)
	}
	if verificationGasLimit, ok := data["verificationGasLimit"].(string); ok {
		userOp.VerificationGasLimit = hexToBigInt(verificationGasLimit)
	}
	if callGasLimit, ok := data["callGasLimit"].(string); ok {
		userOp.CallGasLimit = hexToBigInt(callGasLimit)
	}
	if preVerificationGas, ok := data["preVerificationGas"].(string); ok {
		userOp.PreVerificationGas = hexToBigInt(preVerificationGas)
	}
	if maxPriorityFeePerGas, ok := data["maxPriorityFeePerGas"].(string); ok {
		userOp.MaxPriorityFeePerGas = hexToBigInt(maxPriorityFeePerGas)
	}
	if maxFeePerGas, ok := data["maxFeePerGas"].(string); ok {
		userOp.MaxFeePerGas = hexToBigInt(maxFeePerGas)
	}
	if paymasterAndData, ok := data["paymasterAndData"].(string); ok {
		userOp.PaymasterAndData = hexToBytes(paymasterAndData)
	}
	if signature, ok := data["signature"].(string); ok {
		userOp.Signature = hexToBytes(signature)
	}

	return userOp
}
