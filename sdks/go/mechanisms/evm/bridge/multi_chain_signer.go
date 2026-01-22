package bridge

import (
	"context"
	"encoding/json"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
)

// WdkSigner defines the interface that a WDK Signer must implement.
// This allows the bridge package to work with WDK without importing it directly.
type WdkSigner interface {
	// GetEVMAddress returns the EVM address.
	GetEVMAddress() (common.Address, error)
	// GetConfiguredChains returns the list of configured chain names.
	GetConfiguredChains() []string
	// IsChainConfigured checks if a chain is configured.
	IsChainConfigured(chain string) bool
	// GetNativeBalance returns the native token balance for a chain.
	GetNativeBalance(ctx context.Context, chain string) (*big.Int, error)
	// GetUSDT0Balance returns the USDT0 token balance for a chain.
	GetUSDT0Balance(ctx context.Context, chain string) (*big.Int, error)
	// GetClient returns the ethclient for a chain.
	GetClient(ctx context.Context, chain string) (*ethclient.Client, error)
	// GetPrivateKey returns the private key bytes for signing.
	GetPrivateKeyBytes() ([]byte, error)
	// GetChainID returns the chain ID for a chain.
	GetChainID(chain string) int64
}

// WdkMultiChainSigner adapts a WDK Signer to the MultiChainSigner interface.
type WdkMultiChainSigner struct {
	signer WdkSigner
}

// NewWdkMultiChainSigner creates a new MultiChainSigner adapter for WDK Signer.
func NewWdkMultiChainSigner(signer WdkSigner) (*WdkMultiChainSigner, error) {
	if signer == nil {
		return nil, fmt.Errorf("signer is required")
	}

	return &WdkMultiChainSigner{signer: signer}, nil
}

// GetAddress returns the signer's address.
func (w *WdkMultiChainSigner) GetAddress() string {
	addr, err := w.signer.GetEVMAddress()
	if err != nil {
		return ""
	}
	return addr.Hex()
}

// GetConfiguredChains returns the list of configured chain names.
func (w *WdkMultiChainSigner) GetConfiguredChains() []string {
	return w.signer.GetConfiguredChains()
}

// IsChainConfigured checks if a chain is configured.
func (w *WdkMultiChainSigner) IsChainConfigured(chain string) bool {
	return w.signer.IsChainConfigured(chain)
}

// GetBridgeSigner returns a BridgeSigner for a specific chain.
func (w *WdkMultiChainSigner) GetBridgeSigner(chain string) (BridgeSigner, error) {
	if !w.signer.IsChainConfigured(chain) {
		return nil, fmt.Errorf("chain %q is not configured", chain)
	}

	return &WdkBridgeSignerAdapter{
		wdkSigner: w.signer,
		chain:     strings.ToLower(chain),
	}, nil
}

// GetNativeBalance returns the native token balance for a chain.
func (w *WdkMultiChainSigner) GetNativeBalance(ctx context.Context, chain string) (*big.Int, error) {
	return w.signer.GetNativeBalance(ctx, chain)
}

// GetUSDT0Balance returns the USDT0 token balance for a chain.
func (w *WdkMultiChainSigner) GetUSDT0Balance(ctx context.Context, chain string) (*big.Int, error) {
	return w.signer.GetUSDT0Balance(ctx, chain)
}

// WdkBridgeSignerAdapter adapts a WDK Signer to the BridgeSigner interface for a specific chain.
type WdkBridgeSignerAdapter struct {
	wdkSigner WdkSigner
	chain     string
}

// Address returns the signer's address.
func (a *WdkBridgeSignerAdapter) Address() string {
	addr, err := a.wdkSigner.GetEVMAddress()
	if err != nil {
		return ""
	}
	return addr.Hex()
}

// ReadContract reads data from a smart contract.
func (a *WdkBridgeSignerAdapter) ReadContract(ctx context.Context, address string, abiJSON []byte, functionName string, args ...interface{}) (interface{}, error) {
	client, err := a.wdkSigner.GetClient(ctx, a.chain)
	if err != nil {
		return nil, fmt.Errorf("failed to get client: %w", err)
	}

	// Parse ABI
	parsedABI, err := abi.JSON(strings.NewReader(string(abiJSON)))
	if err != nil {
		return nil, fmt.Errorf("failed to parse ABI: %w", err)
	}

	// Pack the function call
	data, err := parsedABI.Pack(functionName, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to pack function call: %w", err)
	}

	contractAddr := common.HexToAddress(address)
	msg := ethereum.CallMsg{
		To:   &contractAddr,
		Data: data,
	}

	result, err := client.CallContract(ctx, msg, nil)
	if err != nil {
		return nil, fmt.Errorf("contract call failed: %w", err)
	}

	// Unpack the result
	method, ok := parsedABI.Methods[functionName]
	if !ok {
		return nil, fmt.Errorf("method %s not found in ABI", functionName)
	}

	// Handle tuple outputs
	if len(method.Outputs) == 1 && method.Outputs[0].Type.T == abi.TupleTy {
		// For MessagingFee struct
		values, err := method.Outputs.Unpack(result)
		if err != nil {
			return nil, fmt.Errorf("failed to unpack result: %w", err)
		}
		if len(values) > 0 {
			return parseContractOutput(values[0])
		}
	}

	// Standard unpack
	values, err := method.Outputs.Unpack(result)
	if err != nil {
		return nil, fmt.Errorf("failed to unpack result: %w", err)
	}

	if len(values) == 1 {
		return values[0], nil
	}
	return values, nil
}

// WriteContract executes a smart contract transaction.
func (a *WdkBridgeSignerAdapter) WriteContract(ctx context.Context, address string, abiJSON []byte, functionName string, value *big.Int, args ...interface{}) (string, error) {
	client, err := a.wdkSigner.GetClient(ctx, a.chain)
	if err != nil {
		return "", fmt.Errorf("failed to get client: %w", err)
	}

	// Parse ABI
	parsedABI, err := abi.JSON(strings.NewReader(string(abiJSON)))
	if err != nil {
		return "", fmt.Errorf("failed to parse ABI: %w", err)
	}

	// Pack the function call
	data, err := parsedABI.Pack(functionName, args...)
	if err != nil {
		return "", fmt.Errorf("failed to pack function call: %w", err)
	}

	// Get sender address
	signerAddr, err := a.wdkSigner.GetEVMAddress()
	if err != nil {
		return "", fmt.Errorf("failed to get signer address: %w", err)
	}

	contractAddr := common.HexToAddress(address)

	// Get nonce
	nonce, err := client.PendingNonceAt(ctx, signerAddr)
	if err != nil {
		return "", fmt.Errorf("failed to get nonce: %w", err)
	}

	// Estimate gas
	gasLimit, err := client.EstimateGas(ctx, ethereum.CallMsg{
		From:  signerAddr,
		To:    &contractAddr,
		Value: value,
		Data:  data,
	})
	if err != nil {
		return "", fmt.Errorf("failed to estimate gas: %w", err)
	}

	// Add 20% buffer to gas limit
	gasLimit = gasLimit * 120 / 100

	// Get gas price
	gasPrice, err := client.SuggestGasPrice(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to get gas price: %w", err)
	}

	// Create transaction
	txValue := value
	if txValue == nil {
		txValue = big.NewInt(0)
	}

	tx := types.NewTransaction(nonce, contractAddr, txValue, gasLimit, gasPrice, data)

	// Get chain ID
	chainID := big.NewInt(a.wdkSigner.GetChainID(a.chain))

	// Sign transaction
	privateKeyBytes, err := a.wdkSigner.GetPrivateKeyBytes()
	if err != nil {
		return "", fmt.Errorf("failed to get private key: %w", err)
	}

	privateKey, err := crypto.ToECDSA(privateKeyBytes)
	if err != nil {
		return "", fmt.Errorf("failed to parse private key: %w", err)
	}

	signedTx, err := types.SignTx(tx, types.NewEIP155Signer(chainID), privateKey)
	if err != nil {
		return "", fmt.Errorf("failed to sign transaction: %w", err)
	}

	// Send transaction
	err = client.SendTransaction(ctx, signedTx)
	if err != nil {
		return "", fmt.Errorf("failed to send transaction: %w", err)
	}

	return signedTx.Hash().Hex(), nil
}

// WaitForTransactionReceipt waits for a transaction to be mined.
func (a *WdkBridgeSignerAdapter) WaitForTransactionReceipt(ctx context.Context, txHash string) (*BridgeTransactionReceipt, error) {
	client, err := a.wdkSigner.GetClient(ctx, a.chain)
	if err != nil {
		return nil, fmt.Errorf("failed to get client: %w", err)
	}

	hash := common.HexToHash(txHash)

	// Poll for receipt with timeout
	pollInterval := 2 * time.Second
	timeout := 5 * time.Minute

	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		receipt, err := client.TransactionReceipt(ctx, hash)
		if err != nil {
			// Transaction not yet mined, continue polling
			time.Sleep(pollInterval)
			continue
		}

		// Convert logs
		logs := make([]TransactionLog, len(receipt.Logs))
		for i, log := range receipt.Logs {
			topics := make([]string, len(log.Topics))
			for j, topic := range log.Topics {
				topics[j] = topic.Hex()
			}
			logs[i] = TransactionLog{
				Address: log.Address.Hex(),
				Topics:  topics,
				Data:    common.Bytes2Hex(log.Data),
			}
		}

		return &BridgeTransactionReceipt{
			Status:          receipt.Status,
			TransactionHash: receipt.TxHash.Hex(),
			Logs:            logs,
		}, nil
	}

	return nil, fmt.Errorf("timeout waiting for transaction %s", txHash)
}

// parseContractOutput converts a struct output to MessagingFee.
func parseContractOutput(value interface{}) (interface{}, error) {
	// Try to marshal and unmarshal to handle struct conversion
	data, err := json.Marshal(value)
	if err != nil {
		return value, nil
	}

	// Try to parse as MessagingFee
	var feeMap map[string]interface{}
	if err := json.Unmarshal(data, &feeMap); err == nil {
		if nativeFee, ok := feeMap["NativeFee"]; ok {
			fee := &MessagingFee{
				NativeFee:  big.NewInt(0),
				LzTokenFee: big.NewInt(0),
			}
			if nf, ok := nativeFee.(*big.Int); ok {
				fee.NativeFee = nf
			} else if nf, ok := nativeFee.(string); ok {
				fee.NativeFee, _ = new(big.Int).SetString(nf, 10)
			}
			if lzFee, ok := feeMap["LzTokenFee"]; ok {
				if lf, ok := lzFee.(*big.Int); ok {
					fee.LzTokenFee = lf
				} else if lf, ok := lzFee.(string); ok {
					fee.LzTokenFee, _ = new(big.Int).SetString(lf, 10)
				}
			}
			return fee, nil
		}
	}

	return value, nil
}

// SimpleBridgeSigner is a simple implementation of BridgeSigner for testing.
type SimpleBridgeSigner struct {
	addr          string
	readFunc      func(ctx context.Context, address string, abiJSON []byte, functionName string, args ...interface{}) (interface{}, error)
	writeFunc     func(ctx context.Context, address string, abiJSON []byte, functionName string, value *big.Int, args ...interface{}) (string, error)
	waitFunc      func(ctx context.Context, txHash string) (*BridgeTransactionReceipt, error)
}

// NewSimpleBridgeSigner creates a SimpleBridgeSigner for testing.
func NewSimpleBridgeSigner(address string) *SimpleBridgeSigner {
	return &SimpleBridgeSigner{addr: address}
}

// Address returns the signer's address.
func (s *SimpleBridgeSigner) Address() string {
	return s.addr
}

// ReadContract calls the configured read function.
func (s *SimpleBridgeSigner) ReadContract(ctx context.Context, address string, abiJSON []byte, functionName string, args ...interface{}) (interface{}, error) {
	if s.readFunc != nil {
		return s.readFunc(ctx, address, abiJSON, functionName, args...)
	}
	return nil, fmt.Errorf("read not implemented")
}

// WriteContract calls the configured write function.
func (s *SimpleBridgeSigner) WriteContract(ctx context.Context, address string, abiJSON []byte, functionName string, value *big.Int, args ...interface{}) (string, error) {
	if s.writeFunc != nil {
		return s.writeFunc(ctx, address, abiJSON, functionName, value, args...)
	}
	return "", fmt.Errorf("write not implemented")
}

// WaitForTransactionReceipt calls the configured wait function.
func (s *SimpleBridgeSigner) WaitForTransactionReceipt(ctx context.Context, txHash string) (*BridgeTransactionReceipt, error) {
	if s.waitFunc != nil {
		return s.waitFunc(ctx, txHash)
	}
	return nil, fmt.Errorf("wait not implemented")
}

// SetReadFunc sets the read function for testing.
func (s *SimpleBridgeSigner) SetReadFunc(f func(ctx context.Context, address string, abiJSON []byte, functionName string, args ...interface{}) (interface{}, error)) {
	s.readFunc = f
}

// SetWriteFunc sets the write function for testing.
func (s *SimpleBridgeSigner) SetWriteFunc(f func(ctx context.Context, address string, abiJSON []byte, functionName string, value *big.Int, args ...interface{}) (string, error)) {
	s.writeFunc = f
}

// SetWaitFunc sets the wait function for testing.
func (s *SimpleBridgeSigner) SetWaitFunc(f func(ctx context.Context, txHash string) (*BridgeTransactionReceipt, error)) {
	s.waitFunc = f
}
