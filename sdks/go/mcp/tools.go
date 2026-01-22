package mcp

import (
	"context"
	"crypto/ecdsa"
	"encoding/json"
	"fmt"
	"math/big"
	"strings"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
)

// ERC20 ABI function selectors
var (
	balanceOfSelector = crypto.Keccak256([]byte("balanceOf(address)"))[:4]
	decimalsSelector  = crypto.Keccak256([]byte("decimals()"))[:4]
	transferSelector  = crypto.Keccak256([]byte("transfer(address,uint256)"))[:4]
)

// handleGetBalance handles the t402/getBalance tool.
func (s *Server) handleGetBalance(ctx context.Context, args json.RawMessage) *ToolResult {
	var input GetBalanceInput
	if err := json.Unmarshal(args, &input); err != nil {
		return errorResult(fmt.Sprintf("Invalid input: %v", err))
	}

	if !IsValidNetwork(string(input.Network)) {
		return errorResult(fmt.Sprintf("Invalid network: %s", input.Network))
	}

	address := common.HexToAddress(input.Address)
	network := SupportedNetwork(input.Network)

	// Get RPC client
	client, err := ethclient.DialContext(ctx, GetRPCURL(s.config, network))
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect to %s: %v", network, err))
	}
	defer client.Close()

	// Get native balance
	nativeBalance, err := client.BalanceAt(ctx, address, nil)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to get native balance: %v", err))
	}

	// Build result
	result := NetworkBalance{
		Network: string(network),
		Native: BalanceInfo{
			Token:   NativeSymbols[network],
			Balance: FormatTokenAmount(nativeBalance, NativeDecimals),
			Raw:     nativeBalance.String(),
		},
		Tokens: []BalanceInfo{},
	}

	// Get token balances
	tokens := []SupportedToken{TokenUSDC, TokenUSDT, TokenUSDT0}
	for _, token := range tokens {
		tokenAddr, ok := GetTokenAddress(network, token)
		if !ok {
			continue
		}

		balance, err := getERC20Balance(ctx, client, tokenAddr, address.Hex())
		if err != nil {
			continue
		}

		if balance.Cmp(big.NewInt(0)) > 0 {
			result.Tokens = append(result.Tokens, BalanceInfo{
				Token:   string(token),
				Balance: FormatTokenAmount(balance, TokenDecimals),
				Raw:     balance.String(),
			})
		}
	}

	return textResult(formatBalanceResult(result))
}

// handleGetAllBalances handles the t402/getAllBalances tool.
func (s *Server) handleGetAllBalances(ctx context.Context, args json.RawMessage) *ToolResult {
	var input GetAllBalancesInput
	if err := json.Unmarshal(args, &input); err != nil {
		return errorResult(fmt.Sprintf("Invalid input: %v", err))
	}

	address := common.HexToAddress(input.Address)
	networks := AllNetworks()

	// Query all networks in parallel
	var wg sync.WaitGroup
	results := make([]NetworkBalance, len(networks))
	var mu sync.Mutex

	for i, network := range networks {
		wg.Add(1)
		go func(idx int, net SupportedNetwork) {
			defer wg.Done()

			result := NetworkBalance{
				Network: string(net),
				Tokens:  []BalanceInfo{},
			}

			client, err := ethclient.DialContext(ctx, GetRPCURL(s.config, net))
			if err != nil {
				result.Error = fmt.Sprintf("Connection failed: %v", err)
				mu.Lock()
				results[idx] = result
				mu.Unlock()
				return
			}
			defer client.Close()

			// Get native balance
			nativeBalance, err := client.BalanceAt(ctx, address, nil)
			if err != nil {
				result.Error = fmt.Sprintf("Failed to get balance: %v", err)
				mu.Lock()
				results[idx] = result
				mu.Unlock()
				return
			}

			result.Native = BalanceInfo{
				Token:   NativeSymbols[net],
				Balance: FormatTokenAmount(nativeBalance, NativeDecimals),
				Raw:     nativeBalance.String(),
			}

			// Get token balances
			tokens := []SupportedToken{TokenUSDC, TokenUSDT, TokenUSDT0}
			for _, token := range tokens {
				tokenAddr, ok := GetTokenAddress(net, token)
				if !ok {
					continue
				}

				balance, err := getERC20Balance(ctx, client, tokenAddr, address.Hex())
				if err != nil || balance.Cmp(big.NewInt(0)) == 0 {
					continue
				}

				result.Tokens = append(result.Tokens, BalanceInfo{
					Token:   string(token),
					Balance: FormatTokenAmount(balance, TokenDecimals),
					Raw:     balance.String(),
				})
			}

			mu.Lock()
			results[idx] = result
			mu.Unlock()
		}(i, network)
	}

	wg.Wait()

	return textResult(formatAllBalancesResult(results))
}

// handlePay handles the t402/pay tool.
func (s *Server) handlePay(ctx context.Context, args json.RawMessage) *ToolResult {
	var input PayInput
	if err := json.Unmarshal(args, &input); err != nil {
		return errorResult(fmt.Sprintf("Invalid input: %v", err))
	}

	// Validate inputs
	if !IsValidNetwork(string(input.Network)) {
		return errorResult(fmt.Sprintf("Invalid network: %s", input.Network))
	}

	tokenAddr, ok := GetTokenAddress(input.Network, input.Token)
	if !ok {
		return errorResult(fmt.Sprintf("Token %s not supported on %s", input.Token, input.Network))
	}

	// Check if private key is configured
	if s.config.PrivateKey == "" && !s.config.DemoMode {
		return errorResult("Private key not configured. Set T402_PRIVATE_KEY or enable T402_DEMO_MODE")
	}

	amount, err := ParseTokenAmount(input.Amount, TokenDecimals)
	if err != nil {
		return errorResult(fmt.Sprintf("Invalid amount: %v", err))
	}

	// Demo mode - simulate the transaction
	if s.config.DemoMode {
		result := PaymentResult{
			TxHash:      "0x" + strings.Repeat("0", 64) + "_demo",
			From:        "0x" + strings.Repeat("0", 40),
			To:          input.To,
			Amount:      input.Amount,
			Token:       string(input.Token),
			Network:     string(input.Network),
			ExplorerURL: GetExplorerTxURL(input.Network, "0x_demo"),
			DemoMode:    true,
		}
		return textResult(formatPaymentResult(result))
	}

	// Execute real transaction
	client, err := ethclient.DialContext(ctx, GetRPCURL(s.config, input.Network))
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to connect: %v", err))
	}
	defer client.Close()

	// Get private key
	privateKey, err := crypto.HexToECDSA(strings.TrimPrefix(s.config.PrivateKey, "0x"))
	if err != nil {
		return errorResult(fmt.Sprintf("Invalid private key: %v", err))
	}

	fromAddress := crypto.PubkeyToAddress(privateKey.PublicKey)

	// Check balance
	balance, err := getERC20Balance(ctx, client, tokenAddr, fromAddress.Hex())
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to check balance: %v", err))
	}

	if balance.Cmp(amount) < 0 {
		return errorResult(fmt.Sprintf("Insufficient balance: have %s, need %s %s",
			FormatTokenAmount(balance, TokenDecimals), input.Amount, input.Token))
	}

	// Build and send transaction
	txHash, err := sendERC20Transfer(ctx, client, s.config, input.Network, tokenAddr, input.To, amount, privateKey)
	if err != nil {
		return errorResult(fmt.Sprintf("Transaction failed: %v", err))
	}

	result := PaymentResult{
		TxHash:      txHash,
		From:        fromAddress.Hex(),
		To:          input.To,
		Amount:      input.Amount,
		Token:       string(input.Token),
		Network:     string(input.Network),
		ExplorerURL: GetExplorerTxURL(input.Network, txHash),
	}

	return textResult(formatPaymentResult(result))
}

// handlePayGasless handles the t402/payGasless tool.
func (s *Server) handlePayGasless(ctx context.Context, args json.RawMessage) *ToolResult {
	var input PayGaslessInput
	if err := json.Unmarshal(args, &input); err != nil {
		return errorResult(fmt.Sprintf("Invalid input: %v", err))
	}

	// Validate inputs
	if !IsGaslessNetwork(string(input.Network)) {
		return errorResult(fmt.Sprintf("Network %s does not support gasless payments", input.Network))
	}

	if s.config.BundlerURL == "" && !s.config.DemoMode {
		return errorResult("Bundler URL not configured. Set T402_BUNDLER_URL or enable T402_DEMO_MODE")
	}

	// Demo mode
	if s.config.DemoMode {
		result := PaymentResult{
			TxHash:      "0x" + strings.Repeat("0", 64) + "_gasless_demo",
			From:        "0x" + strings.Repeat("0", 40),
			To:          input.To,
			Amount:      input.Amount,
			Token:       string(input.Token),
			Network:     string(input.Network),
			ExplorerURL: GetExplorerTxURL(SupportedNetwork(input.Network), "0x_demo"),
			DemoMode:    true,
		}
		return textResult(formatPaymentResult(result))
	}

	// Execute real ERC-4337 gasless payment
	result, err := ExecuteGaslessPayment(ctx, s.config, input)
	if err != nil {
		return errorResult(fmt.Sprintf("Gasless payment failed: %v", err))
	}

	return textResult(formatGaslessPaymentResult(result))
}

// handleGetBridgeFee handles the t402/getBridgeFee tool.
func (s *Server) handleGetBridgeFee(ctx context.Context, args json.RawMessage) *ToolResult {
	var input GetBridgeFeeInput
	if err := json.Unmarshal(args, &input); err != nil {
		return errorResult(fmt.Sprintf("Invalid input: %v", err))
	}

	// Validate chains
	if !IsBridgeableChain(input.FromChain) {
		return errorResult(fmt.Sprintf("Chain %s does not support USDT0 bridging", input.FromChain))
	}
	if !IsBridgeableChain(input.ToChain) {
		return errorResult(fmt.Sprintf("Chain %s does not support USDT0 bridging", input.ToChain))
	}
	if input.FromChain == input.ToChain {
		return errorResult("Source and destination chains must be different")
	}

	amount, err := ParseTokenAmount(input.Amount, TokenDecimals)
	if err != nil {
		return errorResult(fmt.Sprintf("Invalid amount: %v", err))
	}

	// Demo mode - return estimated fee
	if s.config.DemoMode {
		result := BridgeFeeResult{
			NativeFee:     "0.001",
			NativeSymbol:  NativeSymbols[SupportedNetwork(input.FromChain)],
			FromChain:     input.FromChain,
			ToChain:       input.ToChain,
			Amount:        FormatTokenAmount(amount, TokenDecimals),
			EstimatedTime: 300, // 5 minutes
		}
		return textResult(formatBridgeFeeResult(result))
	}

	// Query actual LayerZero fee from contract
	result, err := GetBridgeFee(ctx, s.config, input)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to get bridge fee: %v", err))
	}

	return textResult(formatBridgeFeeResult(*result))
}

// handleBridge handles the t402/bridge tool.
func (s *Server) handleBridge(ctx context.Context, args json.RawMessage) *ToolResult {
	var input BridgeInput
	if err := json.Unmarshal(args, &input); err != nil {
		return errorResult(fmt.Sprintf("Invalid input: %v", err))
	}

	// Validate chains
	if !IsBridgeableChain(input.FromChain) {
		return errorResult(fmt.Sprintf("Chain %s does not support USDT0 bridging", input.FromChain))
	}
	if !IsBridgeableChain(input.ToChain) {
		return errorResult(fmt.Sprintf("Chain %s does not support USDT0 bridging", input.ToChain))
	}
	if input.FromChain == input.ToChain {
		return errorResult("Source and destination chains must be different")
	}

	if s.config.PrivateKey == "" && !s.config.DemoMode {
		return errorResult("Private key not configured. Set T402_PRIVATE_KEY or enable T402_DEMO_MODE")
	}

	// Demo mode
	if s.config.DemoMode {
		demoGuid := "0x" + strings.Repeat("a", 64)
		result := BridgeResult{
			TxHash:        "0x" + strings.Repeat("0", 64) + "_bridge_demo",
			MessageGUID:   demoGuid,
			FromChain:     input.FromChain,
			ToChain:       input.ToChain,
			Amount:        input.Amount,
			ExplorerURL:   GetExplorerTxURL(SupportedNetwork(input.FromChain), "0x_demo"),
			TrackingURL:   LayerZeroScanURL + demoGuid,
			EstimatedTime: 300,
			DemoMode:      true,
		}
		return textResult(formatBridgeResult(result))
	}

	// Execute real LayerZero bridge
	result, err := ExecuteBridge(ctx, s.config, input)
	if err != nil {
		return errorResult(fmt.Sprintf("Bridge failed: %v", err))
	}

	return textResult(formatBridgeResult(*result))
}

// Helper functions

func getERC20Balance(ctx context.Context, client *ethclient.Client, tokenAddress, ownerAddress string) (*big.Int, error) {
	tokenAddr := common.HexToAddress(tokenAddress)
	ownerAddr := common.HexToAddress(ownerAddress)

	// Encode balanceOf(address) call
	data := append(balanceOfSelector, common.LeftPadBytes(ownerAddr.Bytes(), 32)...)

	msg := ethereum.CallMsg{
		To:   &tokenAddr,
		Data: data,
	}

	result, err := client.CallContract(ctx, msg, nil)
	if err != nil {
		return nil, err
	}

	if len(result) == 0 {
		return big.NewInt(0), nil
	}

	return new(big.Int).SetBytes(result), nil
}

func sendERC20Transfer(ctx context.Context, client *ethclient.Client, config *ServerConfig, network SupportedNetwork, tokenAddress, toAddress string, amount *big.Int, privateKey *ecdsa.PrivateKey) (string, error) {
	fromAddress := crypto.PubkeyToAddress(privateKey.PublicKey)
	tokenAddr := common.HexToAddress(tokenAddress)
	toAddr := common.HexToAddress(toAddress)

	// Encode transfer(address,uint256) call data
	callData := append(transferSelector,
		common.LeftPadBytes(toAddr.Bytes(), 32)...)
	callData = append(callData,
		common.LeftPadBytes(amount.Bytes(), 32)...)

	// Get nonce
	nonce, err := client.PendingNonceAt(ctx, fromAddress)
	if err != nil {
		return "", fmt.Errorf("failed to get nonce: %w", err)
	}

	// Estimate gas
	gasLimit, err := client.EstimateGas(ctx, ethereum.CallMsg{
		From: fromAddress,
		To:   &tokenAddr,
		Data: callData,
	})
	if err != nil {
		return "", fmt.Errorf("failed to estimate gas: %w", err)
	}
	gasLimit = gasLimit * 120 / 100 // Add 20% buffer

	// Get gas price
	gasPrice, err := client.SuggestGasPrice(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to get gas price: %w", err)
	}

	// Get chain ID
	chainID := big.NewInt(ChainIDs[network])

	// Create transaction
	tx := types.NewTransaction(nonce, tokenAddr, big.NewInt(0), gasLimit, gasPrice, callData)

	// Sign transaction
	signedTx, err := types.SignTx(tx, types.NewEIP155Signer(chainID), privateKey)
	if err != nil {
		return "", fmt.Errorf("failed to sign transaction: %w", err)
	}

	// Send transaction
	err = client.SendTransaction(ctx, signedTx)
	if err != nil {
		return "", fmt.Errorf("failed to send transaction: %w", err)
	}

	txHash := signedTx.Hash().Hex()

	// Wait for receipt
	for i := 0; i < 60; i++ {
		receipt, err := client.TransactionReceipt(ctx, signedTx.Hash())
		if err == nil {
			if receipt.Status != types.ReceiptStatusSuccessful {
				return txHash, fmt.Errorf("transaction failed")
			}
			return txHash, nil
		}
		if err != ethereum.NotFound {
			return txHash, fmt.Errorf("failed to get receipt: %w", err)
		}
		select {
		case <-ctx.Done():
			return txHash, ctx.Err()
		case <-time.After(2 * time.Second):
		}
	}

	return txHash, fmt.Errorf("timeout waiting for receipt")
}

// Result formatting functions

func textResult(text string) *ToolResult {
	return &ToolResult{
		Content: []ContentBlock{{Type: "text", Text: text}},
	}
}

func errorResult(message string) *ToolResult {
	return &ToolResult{
		Content: []ContentBlock{{Type: "text", Text: fmt.Sprintf("Error: %s", message)}},
		IsError: true,
	}
}

func formatBalanceResult(result NetworkBalance) string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("## Balance on %s\n\n", result.Network))

	if result.Error != "" {
		sb.WriteString(fmt.Sprintf("Error: %s\n", result.Error))
		return sb.String()
	}

	sb.WriteString(fmt.Sprintf("**Native (%s):** %s\n\n", result.Native.Token, result.Native.Balance))

	if len(result.Tokens) > 0 {
		sb.WriteString("**Tokens:**\n")
		for _, token := range result.Tokens {
			sb.WriteString(fmt.Sprintf("- %s: %s\n", token.Token, token.Balance))
		}
	} else {
		sb.WriteString("No token balances found.\n")
	}

	return sb.String()
}

func formatAllBalancesResult(results []NetworkBalance) string {
	var sb strings.Builder

	sb.WriteString("## Balances Across All Networks\n\n")

	totalUSDC := big.NewInt(0)
	totalUSDT := big.NewInt(0)
	totalUSDT0 := big.NewInt(0)

	for _, result := range results {
		if result.Error != "" {
			sb.WriteString(fmt.Sprintf("### %s\n❌ %s\n\n", result.Network, result.Error))
			continue
		}

		sb.WriteString(fmt.Sprintf("### %s\n", result.Network))
		sb.WriteString(fmt.Sprintf("- Native (%s): %s\n", result.Native.Token, result.Native.Balance))

		for _, token := range result.Tokens {
			sb.WriteString(fmt.Sprintf("- %s: %s\n", token.Token, token.Balance))

			rawAmount := new(big.Int)
			rawAmount.SetString(token.Raw, 10)

			switch token.Token {
			case "USDC":
				totalUSDC.Add(totalUSDC, rawAmount)
			case "USDT":
				totalUSDT.Add(totalUSDT, rawAmount)
			case "USDT0":
				totalUSDT0.Add(totalUSDT0, rawAmount)
			}
		}
		sb.WriteString("\n")
	}

	// Add totals
	sb.WriteString("### Totals\n")
	if totalUSDC.Cmp(big.NewInt(0)) > 0 {
		sb.WriteString(fmt.Sprintf("- USDC: %s\n", FormatTokenAmount(totalUSDC, TokenDecimals)))
	}
	if totalUSDT.Cmp(big.NewInt(0)) > 0 {
		sb.WriteString(fmt.Sprintf("- USDT: %s\n", FormatTokenAmount(totalUSDT, TokenDecimals)))
	}
	if totalUSDT0.Cmp(big.NewInt(0)) > 0 {
		sb.WriteString(fmt.Sprintf("- USDT0: %s\n", FormatTokenAmount(totalUSDT0, TokenDecimals)))
	}

	return sb.String()
}

func formatPaymentResult(result PaymentResult) string {
	var sb strings.Builder

	if result.DemoMode {
		sb.WriteString("## Payment (Demo Mode)\n\n")
		sb.WriteString("⚠️ This is a simulated transaction. No actual tokens were transferred.\n\n")
	} else {
		sb.WriteString("## Payment Successful\n\n")
	}

	sb.WriteString(fmt.Sprintf("- **Amount:** %s %s\n", result.Amount, result.Token))
	sb.WriteString(fmt.Sprintf("- **To:** %s\n", result.To))
	sb.WriteString(fmt.Sprintf("- **Network:** %s\n", result.Network))
	sb.WriteString(fmt.Sprintf("- **Transaction:** [%s](%s)\n", truncateHash(result.TxHash), result.ExplorerURL))

	return sb.String()
}

func formatBridgeFeeResult(result BridgeFeeResult) string {
	var sb strings.Builder

	sb.WriteString("## Bridge Fee Quote\n\n")
	sb.WriteString(fmt.Sprintf("- **From:** %s\n", result.FromChain))
	sb.WriteString(fmt.Sprintf("- **To:** %s\n", result.ToChain))
	sb.WriteString(fmt.Sprintf("- **Amount:** %s USDT0\n", result.Amount))
	sb.WriteString(fmt.Sprintf("- **Fee:** %s %s\n", result.NativeFee, result.NativeSymbol))
	sb.WriteString(fmt.Sprintf("- **Estimated Time:** ~%d seconds\n", result.EstimatedTime))

	return sb.String()
}

func formatBridgeResult(result BridgeResult) string {
	var sb strings.Builder

	if result.DemoMode {
		sb.WriteString("## Bridge (Demo Mode)\n\n")
		sb.WriteString("⚠️ This is a simulated bridge. No actual tokens were transferred.\n\n")
	} else {
		sb.WriteString("## Bridge Initiated\n\n")
	}

	sb.WriteString(fmt.Sprintf("- **Amount:** %s USDT0\n", result.Amount))
	sb.WriteString(fmt.Sprintf("- **From:** %s\n", result.FromChain))
	sb.WriteString(fmt.Sprintf("- **To:** %s\n", result.ToChain))
	sb.WriteString(fmt.Sprintf("- **Transaction:** [%s](%s)\n", truncateHash(result.TxHash), result.ExplorerURL))
	sb.WriteString(fmt.Sprintf("- **Track:** [LayerZero Scan](%s)\n", result.TrackingURL))
	sb.WriteString(fmt.Sprintf("- **Estimated Delivery:** ~%d seconds\n", result.EstimatedTime))

	return sb.String()
}

func truncateHash(hash string) string {
	if len(hash) <= 16 {
		return hash
	}
	return hash[:8] + "..." + hash[len(hash)-6:]
}
