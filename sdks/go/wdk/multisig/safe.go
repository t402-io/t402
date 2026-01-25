// Package multisig provides multi-sig (Safe) smart account support for T402.
package multisig

import (
	"context"
	"crypto/ecdsa"
	"errors"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
)

// SafeClient provides interaction with Safe multi-sig contracts.
type SafeClient struct {
	// Address of the Safe contract
	Address common.Address
	// ChainID for the network
	ChainID *big.Int
	// RPC client
	client *ethclient.Client
	// Cached Safe info
	cachedInfo *SafeInfo
}

// NewSafeClient creates a new Safe client.
func NewSafeClient(config SafeConfig) (*SafeClient, error) {
	if config.Address == (common.Address{}) {
		return nil, errors.New("safe address is required")
	}
	if config.RPCURL == "" {
		return nil, errors.New("RPC URL is required")
	}

	client, err := ethclient.Dial(config.RPCURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to RPC: %w", err)
	}

	chainID := config.ChainID
	if chainID == nil {
		chainID, err = client.ChainID(context.Background())
		if err != nil {
			return nil, fmt.Errorf("failed to get chain ID: %w", err)
		}
	}

	return &SafeClient{
		Address: config.Address,
		ChainID: chainID,
		client:  client,
	}, nil
}

// GetInfo retrieves current Safe information (owners, threshold, nonce).
func (s *SafeClient) GetInfo(ctx context.Context) (*SafeInfo, error) {
	owners, err := s.GetOwners(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get owners: %w", err)
	}

	threshold, err := s.GetThreshold(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get threshold: %w", err)
	}

	nonce, err := s.GetNonce(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get nonce: %w", err)
	}

	info := &SafeInfo{
		Address:   s.Address,
		Owners:    owners,
		Threshold: threshold,
		Nonce:     nonce,
		ChainID:   s.ChainID,
	}

	s.cachedInfo = info
	return info, nil
}

// GetOwners returns the list of Safe owners.
func (s *SafeClient) GetOwners(ctx context.Context) ([]common.Address, error) {
	data := GetOwnersSelector
	msg := ethereum.CallMsg{
		To:   &s.Address,
		Data: data,
	}

	result, err := s.client.CallContract(ctx, msg, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to call getOwners: %w", err)
	}

	// Decode the result (address[])
	addressArrayType, _ := abi.NewType("address[]", "", nil)
	args := abi.Arguments{{Type: addressArrayType}}
	decoded, err := args.Unpack(result)
	if err != nil {
		return nil, fmt.Errorf("failed to decode owners: %w", err)
	}

	owners := decoded[0].([]common.Address)
	return owners, nil
}

// GetThreshold returns the required number of signatures.
func (s *SafeClient) GetThreshold(ctx context.Context) (int, error) {
	data := GetThresholdSelector
	msg := ethereum.CallMsg{
		To:   &s.Address,
		Data: data,
	}

	result, err := s.client.CallContract(ctx, msg, nil)
	if err != nil {
		return 0, fmt.Errorf("failed to call getThreshold: %w", err)
	}

	// Decode the result (uint256)
	threshold := new(big.Int).SetBytes(result)
	return int(threshold.Int64()), nil
}

// GetNonce returns the current Safe nonce.
func (s *SafeClient) GetNonce(ctx context.Context) (*big.Int, error) {
	data := NonceSelector
	msg := ethereum.CallMsg{
		To:   &s.Address,
		Data: data,
	}

	result, err := s.client.CallContract(ctx, msg, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to call nonce: %w", err)
	}

	nonce := new(big.Int).SetBytes(result)
	return nonce, nil
}

// IsOwner checks if an address is a Safe owner.
func (s *SafeClient) IsOwner(ctx context.Context, address common.Address) (bool, error) {
	owners, err := s.GetOwners(ctx)
	if err != nil {
		return false, err
	}

	for _, owner := range owners {
		if owner == address {
			return true, nil
		}
	}
	return false, nil
}

// ProposeTransaction creates a new transaction proposal.
func (s *SafeClient) ProposeTransaction(ctx context.Context, tx *SafeTransaction) (*TransactionRequest, error) {
	// Get current nonce if not set
	if tx.Nonce == nil {
		nonce, err := s.GetNonce(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to get nonce: %w", err)
		}
		tx.Nonce = nonce
	}

	// Calculate transaction hash
	txHash, err := s.GetTransactionHash(ctx, tx)
	if err != nil {
		return nil, fmt.Errorf("failed to get transaction hash: %w", err)
	}

	// Get threshold
	threshold, err := s.GetThreshold(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get threshold: %w", err)
	}

	// Create request
	request := &TransactionRequest{
		ID:              generateRequestID(),
		SafeAddress:     s.Address,
		Transaction:     tx,
		TransactionHash: txHash,
		Signatures:      make(map[common.Address]*SafeSignature),
		Threshold:       threshold,
		CreatedAt:       currentTimestamp(),
		ExpiresAt:       currentTimestamp() + DefaultRequestExpirationSeconds,
	}

	return request, nil
}

// GetTransactionHash calculates the Safe transaction hash.
func (s *SafeClient) GetTransactionHash(ctx context.Context, tx *SafeTransaction) (common.Hash, error) {
	// Build calldata for getTransactionHash
	data := buildGetTransactionHashCalldata(tx)
	msg := ethereum.CallMsg{
		To:   &s.Address,
		Data: data,
	}

	result, err := s.client.CallContract(ctx, msg, nil)
	if err != nil {
		return common.Hash{}, fmt.Errorf("failed to call getTransactionHash: %w", err)
	}

	return common.BytesToHash(result), nil
}

// SignTransaction signs a transaction with the given private key.
func (s *SafeClient) SignTransaction(tx *SafeTransaction, privateKey *ecdsa.PrivateKey) (*SafeSignature, error) {
	// Calculate transaction hash
	txHash, err := s.GetTransactionHash(context.Background(), tx)
	if err != nil {
		return nil, fmt.Errorf("failed to get transaction hash: %w", err)
	}

	// Sign the hash
	signature, err := crypto.Sign(txHash.Bytes(), privateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to sign: %w", err)
	}

	// Adjust v value for Safe (add 4 for EOA signature)
	if signature[64] < 27 {
		signature[64] += 27
	}
	signature[64] += 4 // Safe EOA signature type

	signer := crypto.PubkeyToAddress(privateKey.PublicKey)

	return &SafeSignature{
		Signer:        signer,
		Signature:     signature,
		SignatureType: SignatureTypeEOA,
	}, nil
}

// AddSignature adds a signature to a transaction request.
func (s *SafeClient) AddSignature(request *TransactionRequest, sig *SafeSignature) error {
	if request.Signatures == nil {
		request.Signatures = make(map[common.Address]*SafeSignature)
	}

	// Check if signer is an owner
	isOwner, err := s.IsOwner(context.Background(), sig.Signer)
	if err != nil {
		return fmt.Errorf("failed to check owner: %w", err)
	}
	if !isOwner {
		return fmt.Errorf("signer %s is not an owner", sig.Signer.Hex())
	}

	request.Signatures[sig.Signer] = sig
	return nil
}

// ExecuteTransaction executes a Safe transaction with collected signatures.
func (s *SafeClient) ExecuteTransaction(ctx context.Context, request *TransactionRequest, executor *ecdsa.PrivateKey) (*ExecutionResult, error) {
	// Check if ready
	if !request.IsReady() {
		return nil, fmt.Errorf("not enough signatures: have %d, need %d", request.CollectedCount(), request.Threshold)
	}

	// Combine signatures (sorted by signer address)
	packedSigs := s.packSignatures(request.Signatures)

	// Build execTransaction calldata
	calldata := s.buildExecTransactionCalldata(request.Transaction, packedSigs)

	// Send transaction
	executorAddr := crypto.PubkeyToAddress(executor.PublicKey)
	nonce, err := s.client.PendingNonceAt(ctx, executorAddr)
	if err != nil {
		return nil, fmt.Errorf("failed to get executor nonce: %w", err)
	}

	gasPrice, err := s.client.SuggestGasPrice(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get gas price: %w", err)
	}

	// Estimate gas
	msg := ethereum.CallMsg{
		From: executorAddr,
		To:   &s.Address,
		Data: calldata,
	}
	gasLimit, err := s.client.EstimateGas(ctx, msg)
	if err != nil {
		return nil, fmt.Errorf("failed to estimate gas: %w", err)
	}

	// Create transaction
	tx := types.NewTransaction(nonce, s.Address, big.NewInt(0), gasLimit, gasPrice, calldata)

	// Sign transaction
	signedTx, err := types.SignTx(tx, types.NewEIP155Signer(s.ChainID), executor)
	if err != nil {
		return nil, fmt.Errorf("failed to sign transaction: %w", err)
	}

	// Send transaction
	err = s.client.SendTransaction(ctx, signedTx)
	if err != nil {
		return nil, fmt.Errorf("failed to send transaction: %w", err)
	}

	return &ExecutionResult{
		TxHash:  signedTx.Hash(),
		Success: true, // Will be updated after receipt
	}, nil
}

// WaitForExecution waits for a transaction to be mined and returns the result.
func (s *SafeClient) WaitForExecution(ctx context.Context, txHash common.Hash) (*ExecutionResult, error) {
	receipt, err := s.waitForReceipt(ctx, txHash)
	if err != nil {
		return nil, err
	}

	return &ExecutionResult{
		TxHash:      txHash,
		Success:     receipt.Status == types.ReceiptStatusSuccessful,
		GasUsed:     receipt.GasUsed,
		BlockNumber: receipt.BlockNumber.Uint64(),
	}, nil
}

// waitForReceipt waits for a transaction receipt.
func (s *SafeClient) waitForReceipt(ctx context.Context, txHash common.Hash) (*types.Receipt, error) {
	for {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
			receipt, err := s.client.TransactionReceipt(ctx, txHash)
			if err == nil {
				return receipt, nil
			}
			// Keep polling
		}
	}
}

// packSignatures packs signatures sorted by signer address.
func (s *SafeClient) packSignatures(sigs map[common.Address]*SafeSignature) []byte {
	// Sort signers by address
	var signers []common.Address
	for signer := range sigs {
		signers = append(signers, signer)
	}
	sortAddresses(signers)

	// Pack signatures
	var packed []byte
	for _, signer := range signers {
		sig := sigs[signer]
		packed = append(packed, sig.Signature...)
	}

	return packed
}

// buildExecTransactionCalldata builds the execTransaction calldata.
func (s *SafeClient) buildExecTransactionCalldata(tx *SafeTransaction, signatures []byte) []byte {
	// execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures)
	data := make([]byte, 0)
	data = append(data, ExecTransactionSelector...)

	// Encode parameters
	addressType, _ := abi.NewType("address", "", nil)
	uint256Type, _ := abi.NewType("uint256", "", nil)
	bytesType, _ := abi.NewType("bytes", "", nil)
	uint8Type, _ := abi.NewType("uint8", "", nil)

	args := abi.Arguments{
		{Type: addressType}, // to
		{Type: uint256Type}, // value
		{Type: bytesType},   // data
		{Type: uint8Type},   // operation
		{Type: uint256Type}, // safeTxGas
		{Type: uint256Type}, // baseGas
		{Type: uint256Type}, // gasPrice
		{Type: addressType}, // gasToken
		{Type: addressType}, // refundReceiver
		{Type: bytesType},   // signatures
	}

	value := tx.Value
	if value == nil {
		value = big.NewInt(0)
	}
	safeTxGas := tx.SafeTxGas
	if safeTxGas == nil {
		safeTxGas = big.NewInt(0)
	}
	baseGas := tx.BaseGas
	if baseGas == nil {
		baseGas = big.NewInt(0)
	}
	gasPrice := tx.GasPrice
	if gasPrice == nil {
		gasPrice = big.NewInt(0)
	}

	encoded, _ := args.Pack(
		tx.To,
		value,
		tx.Data,
		tx.Operation,
		safeTxGas,
		baseGas,
		gasPrice,
		tx.GasToken,
		tx.RefundReceiver,
		signatures,
	)

	data = append(data, encoded...)
	return data
}

// buildGetTransactionHashCalldata builds the getTransactionHash calldata.
func buildGetTransactionHashCalldata(tx *SafeTransaction) []byte {
	data := make([]byte, 0)
	data = append(data, GetTransactionHashSelector...)

	// Encode parameters
	addressType, _ := abi.NewType("address", "", nil)
	uint256Type, _ := abi.NewType("uint256", "", nil)
	bytesType, _ := abi.NewType("bytes", "", nil)
	uint8Type, _ := abi.NewType("uint8", "", nil)

	args := abi.Arguments{
		{Type: addressType}, // to
		{Type: uint256Type}, // value
		{Type: bytesType},   // data
		{Type: uint8Type},   // operation
		{Type: uint256Type}, // safeTxGas
		{Type: uint256Type}, // baseGas
		{Type: uint256Type}, // gasPrice
		{Type: addressType}, // gasToken
		{Type: addressType}, // refundReceiver
		{Type: uint256Type}, // nonce
	}

	value := tx.Value
	if value == nil {
		value = big.NewInt(0)
	}
	safeTxGas := tx.SafeTxGas
	if safeTxGas == nil {
		safeTxGas = big.NewInt(0)
	}
	baseGas := tx.BaseGas
	if baseGas == nil {
		baseGas = big.NewInt(0)
	}
	gasPrice := tx.GasPrice
	if gasPrice == nil {
		gasPrice = big.NewInt(0)
	}
	nonce := tx.Nonce
	if nonce == nil {
		nonce = big.NewInt(0)
	}

	encoded, _ := args.Pack(
		tx.To,
		value,
		tx.Data,
		tx.Operation,
		safeTxGas,
		baseGas,
		gasPrice,
		tx.GasToken,
		tx.RefundReceiver,
		nonce,
	)

	data = append(data, encoded...)
	return data
}
