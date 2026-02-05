package mcp

import (
	"context"
	"fmt"
	"strings"

	"github.com/t402-io/t402/sdks/go/wdk/gasless"
)

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

// ExecuteGaslessPayment performs an ERC-4337 gasless payment using the WDK gasless client.
func ExecuteGaslessPayment(ctx context.Context, config *ServerConfig, input PayGaslessInput) (*GaslessPaymentResult, error) {
	client := gasless.NewClient(gasless.Config{
		PrivateKey:   config.PrivateKey,
		BundlerURL:   config.BundlerURL,
		PaymasterURL: config.PaymasterURL,
		RPCURLs:      config.RPCURLs,
	})

	result, err := client.Pay(ctx, gasless.PaymentParams{
		Network: string(input.Network),
		To:      input.To,
		Amount:  input.Amount,
		Token:   string(input.Token),
	})
	if err != nil {
		return nil, err
	}

	return &GaslessPaymentResult{
		TxHash:      result.TxHash,
		UserOpHash:  result.UserOpHash,
		Network:     result.Network,
		Amount:      result.Amount,
		Token:       result.Token,
		To:          result.To,
		ExplorerURL: result.ExplorerURL,
	}, nil
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
