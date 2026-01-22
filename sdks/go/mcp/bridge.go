package mcp

import (
	"context"
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

// Estimated bridge times in seconds
var EstimatedBridgeTimes = map[SupportedNetwork]int{
	NetworkEthereum:  900, // 15 minutes for L1
	NetworkArbitrum:  300, // 5 minutes
	NetworkInk:       300,
	NetworkBerachain: 300,
	NetworkUnichain:  300,
}

// OFTSent event topic for extracting message GUID
var oftSentEventTopic = crypto.Keccak256Hash([]byte("OFTSent(bytes32,uint32,address,uint256,uint256)"))

// SendParam represents the LayerZero OFT send parameters
type SendParam struct {
	DstEid       uint32
	To           [32]byte
	AmountLD     *big.Int
	MinAmountLD  *big.Int
	ExtraOptions []byte
	ComposeMsg   []byte
	OftCmd       []byte
}

// MessagingFee represents the LayerZero messaging fee
type MessagingFee struct {
	NativeFee  *big.Int
	LzTokenFee *big.Int
}

// QuoteSend calls the OFT contract to get a bridge fee quote
func QuoteSend(ctx context.Context, client *ethclient.Client, oftAddress string, sendParam SendParam) (*MessagingFee, error) {
	// Build the quoteSend call data
	// quoteSend((uint32,bytes32,uint256,uint256,bytes,bytes,bytes),bool)
	oftABI, err := abi.JSON(strings.NewReader(oftABIJSON))
	if err != nil {
		return nil, fmt.Errorf("failed to parse OFT ABI: %w", err)
	}

	callData, err := oftABI.Pack("quoteSend", sendParam, false)
	if err != nil {
		return nil, fmt.Errorf("failed to pack quoteSend call: %w", err)
	}

	tokenAddr := common.HexToAddress(oftAddress)
	msg := ethereum.CallMsg{
		To:   &tokenAddr,
		Data: callData,
	}

	result, err := client.CallContract(ctx, msg, nil)
	if err != nil {
		return nil, fmt.Errorf("quoteSend call failed: %w", err)
	}

	// Decode the result
	output, err := oftABI.Unpack("quoteSend", result)
	if err != nil {
		return nil, fmt.Errorf("failed to unpack quoteSend result: %w", err)
	}

	if len(output) < 1 {
		return nil, fmt.Errorf("unexpected quoteSend output length")
	}

	// The output is a struct with nativeFee and lzTokenFee
	feeStruct := output[0].(struct {
		NativeFee  *big.Int `abi:"nativeFee"`
		LzTokenFee *big.Int `abi:"lzTokenFee"`
	})

	return &MessagingFee{
		NativeFee:  feeStruct.NativeFee,
		LzTokenFee: feeStruct.LzTokenFee,
	}, nil
}

// ExecuteBridge performs a USDT0 bridge via LayerZero OFT
func ExecuteBridge(ctx context.Context, config *ServerConfig, input BridgeInput) (*BridgeResult, error) {
	fromNetwork := SupportedNetwork(input.FromChain)
	toNetwork := SupportedNetwork(input.ToChain)

	// Validate chains
	if !IsBridgeableChain(input.FromChain) {
		return nil, fmt.Errorf("chain %s does not support USDT0 bridging", input.FromChain)
	}
	if !IsBridgeableChain(input.ToChain) {
		return nil, fmt.Errorf("chain %s does not support USDT0 bridging", input.ToChain)
	}
	if input.FromChain == input.ToChain {
		return nil, fmt.Errorf("source and destination chains must be different")
	}

	// Get USDT0 address
	oftAddress, ok := USDT0Addresses[fromNetwork]
	if !ok {
		return nil, fmt.Errorf("USDT0 not found on %s", input.FromChain)
	}

	// Parse amount
	amount, err := ParseTokenAmount(input.Amount, TokenDecimals)
	if err != nil {
		return nil, fmt.Errorf("invalid amount: %w", err)
	}

	// Get LayerZero endpoint ID for destination
	dstEid, ok := LayerZeroEndpointIDs[toNetwork]
	if !ok {
		return nil, fmt.Errorf("no LayerZero endpoint for %s", input.ToChain)
	}

	// Connect to RPC
	client, err := ethclient.DialContext(ctx, GetRPCURL(config, fromNetwork))
	if err != nil {
		return nil, fmt.Errorf("failed to connect to %s: %w", input.FromChain, err)
	}
	defer client.Close()

	// Parse private key
	privateKey, err := crypto.HexToECDSA(strings.TrimPrefix(config.PrivateKey, "0x"))
	if err != nil {
		return nil, fmt.Errorf("invalid private key: %w", err)
	}
	fromAddress := crypto.PubkeyToAddress(privateKey.PublicKey)

	// Convert recipient to bytes32
	var toBytes32 [32]byte
	recipientAddr := common.HexToAddress(input.Recipient)
	copy(toBytes32[12:], recipientAddr.Bytes())

	// Build send parameters with 0.5% slippage
	minAmount := new(big.Int).Mul(amount, big.NewInt(995))
	minAmount = minAmount.Div(minAmount, big.NewInt(1000))

	sendParam := SendParam{
		DstEid:       dstEid,
		To:           toBytes32,
		AmountLD:     amount,
		MinAmountLD:  minAmount,
		ExtraOptions: []byte{},
		ComposeMsg:   []byte{},
		OftCmd:       []byte{},
	}

	// Get quote
	quote, err := QuoteSend(ctx, client, oftAddress, sendParam)
	if err != nil {
		return nil, fmt.Errorf("failed to get bridge quote: %w", err)
	}

	// Add 10% buffer to fee
	nativeFeeWithBuffer := new(big.Int).Mul(quote.NativeFee, big.NewInt(110))
	nativeFeeWithBuffer = nativeFeeWithBuffer.Div(nativeFeeWithBuffer, big.NewInt(100))

	// Check native balance for fee
	nativeBalance, err := client.BalanceAt(ctx, fromAddress, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to check native balance: %w", err)
	}
	if nativeBalance.Cmp(nativeFeeWithBuffer) < 0 {
		return nil, fmt.Errorf("insufficient %s for bridge fee: have %s, need %s",
			NativeSymbols[fromNetwork],
			FormatTokenAmount(nativeBalance, NativeDecimals),
			FormatTokenAmount(nativeFeeWithBuffer, NativeDecimals))
	}

	// Check USDT0 balance
	usdt0Balance, err := getERC20Balance(ctx, client, oftAddress, fromAddress.Hex())
	if err != nil {
		return nil, fmt.Errorf("failed to check USDT0 balance: %w", err)
	}
	if usdt0Balance.Cmp(amount) < 0 {
		return nil, fmt.Errorf("insufficient USDT0 balance: have %s, need %s",
			FormatTokenAmount(usdt0Balance, TokenDecimals),
			input.Amount)
	}

	// Build send transaction
	oftABI, err := abi.JSON(strings.NewReader(oftABIJSON))
	if err != nil {
		return nil, fmt.Errorf("failed to parse OFT ABI: %w", err)
	}

	fee := struct {
		NativeFee  *big.Int
		LzTokenFee *big.Int
	}{
		NativeFee:  nativeFeeWithBuffer,
		LzTokenFee: big.NewInt(0),
	}

	callData, err := oftABI.Pack("send", sendParam, fee, fromAddress)
	if err != nil {
		return nil, fmt.Errorf("failed to pack send call: %w", err)
	}

	// Get chain ID and nonce
	chainID := big.NewInt(ChainIDs[fromNetwork])
	nonce, err := client.PendingNonceAt(ctx, fromAddress)
	if err != nil {
		return nil, fmt.Errorf("failed to get nonce: %w", err)
	}

	// Estimate gas
	tokenAddr := common.HexToAddress(oftAddress)
	gasLimit, err := client.EstimateGas(ctx, ethereum.CallMsg{
		From:  fromAddress,
		To:    &tokenAddr,
		Value: nativeFeeWithBuffer,
		Data:  callData,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to estimate gas: %w", err)
	}
	gasLimit = gasLimit * 120 / 100 // Add 20% buffer

	// Get gas price
	gasPrice, err := client.SuggestGasPrice(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get gas price: %w", err)
	}

	// Create and sign transaction
	tx := types.NewTransaction(nonce, tokenAddr, nativeFeeWithBuffer, gasLimit, gasPrice, callData)
	signedTx, err := types.SignTx(tx, types.NewEIP155Signer(chainID), privateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to sign transaction: %w", err)
	}

	// Send transaction
	err = client.SendTransaction(ctx, signedTx)
	if err != nil {
		return nil, fmt.Errorf("failed to send transaction: %w", err)
	}

	txHash := signedTx.Hash().Hex()

	// Wait for receipt
	receipt, err := waitForReceipt(ctx, client, signedTx.Hash())
	if err != nil {
		return nil, fmt.Errorf("failed to wait for receipt: %w", err)
	}

	if receipt.Status != types.ReceiptStatusSuccessful {
		return nil, fmt.Errorf("bridge transaction failed: %s", txHash)
	}

	// Extract message GUID from OFTSent event
	messageGUID := ""
	for _, log := range receipt.Logs {
		if len(log.Topics) > 0 && log.Topics[0] == oftSentEventTopic {
			if len(log.Topics) > 1 {
				messageGUID = log.Topics[1].Hex()
				break
			}
		}
	}

	if messageGUID == "" {
		return nil, fmt.Errorf("failed to extract message GUID from transaction logs")
	}

	estimatedTime := EstimatedBridgeTimes[toNetwork]
	if estimatedTime == 0 {
		estimatedTime = 300
	}

	return &BridgeResult{
		TxHash:        txHash,
		MessageGUID:   messageGUID,
		FromChain:     input.FromChain,
		ToChain:       input.ToChain,
		Amount:        input.Amount,
		ExplorerURL:   GetExplorerTxURL(fromNetwork, txHash),
		TrackingURL:   LayerZeroScanURL + messageGUID,
		EstimatedTime: estimatedTime,
	}, nil
}

// GetBridgeFee queries the bridge fee for a USDT0 transfer
func GetBridgeFee(ctx context.Context, config *ServerConfig, input GetBridgeFeeInput) (*BridgeFeeResult, error) {
	fromNetwork := SupportedNetwork(input.FromChain)
	toNetwork := SupportedNetwork(input.ToChain)

	// Validate chains
	if !IsBridgeableChain(input.FromChain) {
		return nil, fmt.Errorf("chain %s does not support USDT0 bridging", input.FromChain)
	}
	if !IsBridgeableChain(input.ToChain) {
		return nil, fmt.Errorf("chain %s does not support USDT0 bridging", input.ToChain)
	}
	if input.FromChain == input.ToChain {
		return nil, fmt.Errorf("source and destination chains must be different")
	}

	// Get USDT0 address
	oftAddress, ok := USDT0Addresses[fromNetwork]
	if !ok {
		return nil, fmt.Errorf("USDT0 not found on %s", input.FromChain)
	}

	// Parse amount
	amount, err := ParseTokenAmount(input.Amount, TokenDecimals)
	if err != nil {
		return nil, fmt.Errorf("invalid amount: %w", err)
	}

	// Get LayerZero endpoint ID for destination
	dstEid, ok := LayerZeroEndpointIDs[toNetwork]
	if !ok {
		return nil, fmt.Errorf("no LayerZero endpoint for %s", input.ToChain)
	}

	// Connect to RPC
	client, err := ethclient.DialContext(ctx, GetRPCURL(config, fromNetwork))
	if err != nil {
		return nil, fmt.Errorf("failed to connect to %s: %w", input.FromChain, err)
	}
	defer client.Close()

	// Convert recipient to bytes32
	var toBytes32 [32]byte
	recipientAddr := common.HexToAddress(input.Recipient)
	copy(toBytes32[12:], recipientAddr.Bytes())

	// Build send parameters
	sendParam := SendParam{
		DstEid:       dstEid,
		To:           toBytes32,
		AmountLD:     amount,
		MinAmountLD:  amount, // No slippage for quote
		ExtraOptions: []byte{},
		ComposeMsg:   []byte{},
		OftCmd:       []byte{},
	}

	// Get quote
	quote, err := QuoteSend(ctx, client, oftAddress, sendParam)
	if err != nil {
		return nil, fmt.Errorf("failed to get bridge quote: %w", err)
	}

	estimatedTime := EstimatedBridgeTimes[toNetwork]
	if estimatedTime == 0 {
		estimatedTime = 300
	}

	return &BridgeFeeResult{
		NativeFee:     FormatTokenAmount(quote.NativeFee, NativeDecimals),
		NativeSymbol:  NativeSymbols[fromNetwork],
		FromChain:     input.FromChain,
		ToChain:       input.ToChain,
		Amount:        FormatTokenAmount(amount, TokenDecimals),
		EstimatedTime: estimatedTime,
	}, nil
}

// waitForReceipt polls for transaction receipt
func waitForReceipt(ctx context.Context, client *ethclient.Client, txHash common.Hash) (*types.Receipt, error) {
	for i := 0; i < 60; i++ { // 60 attempts, ~2 minutes
		receipt, err := client.TransactionReceipt(ctx, txHash)
		if err == nil {
			return receipt, nil
		}
		if err != ethereum.NotFound {
			return nil, err
		}
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(2 * time.Second):
		}
	}
	return nil, fmt.Errorf("timeout waiting for transaction receipt")
}

// OFT ABI JSON for quoteSend and send functions
const oftABIJSON = `[
	{
		"name": "quoteSend",
		"type": "function",
		"stateMutability": "view",
		"inputs": [
			{
				"name": "_sendParam",
				"type": "tuple",
				"components": [
					{"name": "dstEid", "type": "uint32"},
					{"name": "to", "type": "bytes32"},
					{"name": "amountLD", "type": "uint256"},
					{"name": "minAmountLD", "type": "uint256"},
					{"name": "extraOptions", "type": "bytes"},
					{"name": "composeMsg", "type": "bytes"},
					{"name": "oftCmd", "type": "bytes"}
				]
			},
			{"name": "_payInLzToken", "type": "bool"}
		],
		"outputs": [
			{
				"name": "msgFee",
				"type": "tuple",
				"components": [
					{"name": "nativeFee", "type": "uint256"},
					{"name": "lzTokenFee", "type": "uint256"}
				]
			}
		]
	},
	{
		"name": "send",
		"type": "function",
		"stateMutability": "payable",
		"inputs": [
			{
				"name": "_sendParam",
				"type": "tuple",
				"components": [
					{"name": "dstEid", "type": "uint32"},
					{"name": "to", "type": "bytes32"},
					{"name": "amountLD", "type": "uint256"},
					{"name": "minAmountLD", "type": "uint256"},
					{"name": "extraOptions", "type": "bytes"},
					{"name": "composeMsg", "type": "bytes"},
					{"name": "oftCmd", "type": "bytes"}
				]
			},
			{
				"name": "_fee",
				"type": "tuple",
				"components": [
					{"name": "nativeFee", "type": "uint256"},
					{"name": "lzTokenFee", "type": "uint256"}
				]
			},
			{"name": "_refundAddress", "type": "address"}
		],
		"outputs": [
			{
				"name": "msgReceipt",
				"type": "tuple",
				"components": [
					{"name": "guid", "type": "bytes32"},
					{"name": "nonce", "type": "uint64"},
					{
						"name": "fee",
						"type": "tuple",
						"components": [
							{"name": "nativeFee", "type": "uint256"},
							{"name": "lzTokenFee", "type": "uint256"}
						]
					}
				]
			},
			{
				"name": "oftReceipt",
				"type": "tuple",
				"components": [
					{"name": "amountSentLD", "type": "uint256"},
					{"name": "amountReceivedLD", "type": "uint256"}
				]
			}
		]
	}
]`
