// USDT0 Cross-Chain Bridge Example
//
// This example demonstrates how to:
// 1. Check supported bridging chains
// 2. Get a bridge quote
// 3. Execute a bridge transaction
// 4. Track message delivery via LayerZero Scan
//
// Prerequisites:
// - Private key with USDT0 balance on source chain
// - Native token for gas fees on source chain
//
// Usage:
//
//	PRIVATE_KEY=0x... go run main.go
package main

import (
	"context"
	"fmt"
	"log"
	"math/big"
	"os"
	"strings"

	"github.com/t402-io/t402/go/mechanisms/evm/bridge"
)

// demoMode - set to false to execute real transactions
const demoMode = true

// bridgeAmount - 100 USDT0 (6 decimals)
var bridgeAmount = big.NewInt(100_000000)

func main() {
	fmt.Println("=== USDT0 Cross-Chain Bridge Example ===")
	fmt.Println()

	// 1. Check supported chains
	fmt.Println("Supported bridging chains:")
	chains := bridge.GetBridgeableChains()
	for _, chain := range chains {
		fmt.Printf("  - %s\n", chain)
	}
	fmt.Println()

	// 2. Verify chain support
	fmt.Println("Checking chain support:")
	fmt.Printf("  Arbitrum supports bridging: %v\n", bridge.SupportsBridging("arbitrum"))
	fmt.Printf("  Ethereum supports bridging: %v\n", bridge.SupportsBridging("ethereum"))
	fmt.Printf("  Base supports bridging: %v\n", bridge.SupportsBridging("base"))
	fmt.Println()

	// 3. Get LayerZero endpoint IDs
	fmt.Println("LayerZero Endpoint IDs:")
	for _, chain := range chains {
		eid, _ := bridge.GetEndpointID(chain)
		fmt.Printf("  %s: %d\n", chain, eid)
	}
	fmt.Println()

	// 4. Get USDT0 OFT addresses
	fmt.Println("USDT0 OFT Addresses:")
	for _, chain := range chains {
		addr, _ := bridge.GetUSDT0OFTAddress(chain)
		fmt.Printf("  %s: %s\n", chain, addr)
	}
	fmt.Println()

	if demoMode {
		fmt.Println("[DEMO MODE] Showing example flow without real transactions")
		fmt.Println()
		demonstrateDemoMode()
		return
	}

	// Real transaction mode
	privateKey := os.Getenv("PRIVATE_KEY")
	if privateKey == "" {
		log.Fatal("ERROR: PRIVATE_KEY environment variable required")
	}

	ctx := context.Background()

	// Create bridge signer (you would implement this with your preferred Ethereum client)
	signer := createDemoSigner(privateKey)

	// Create bridge client
	bridgeClient, err := bridge.NewUsdt0Bridge(signer, "arbitrum")
	if err != nil {
		log.Fatalf("Failed to create bridge client: %v", err)
	}

	fmt.Println("Created bridge client for Arbitrum")
	fmt.Printf("Supported destinations: %s\n", strings.Join(bridgeClient.GetSupportedDestinations(), ", "))
	fmt.Println()

	// Get quote
	fmt.Println("Getting bridge quote...")
	quote, err := bridgeClient.Quote(ctx, &bridge.BridgeQuoteParams{
		FromChain: "arbitrum",
		ToChain:   "ethereum",
		Amount:    bridgeAmount,
		Recipient: signer.Address(),
	})
	if err != nil {
		log.Fatalf("Failed to get quote: %v", err)
	}

	fmt.Println("Bridge Quote:")
	fmt.Printf("  Amount to send: %s\n", quote.AmountToSend.String())
	fmt.Printf("  Min amount to receive: %s\n", quote.MinAmountToReceive.String())
	fmt.Printf("  Native fee: %s wei\n", quote.NativeFee.String())
	fmt.Printf("  Estimated time: %d seconds\n", quote.EstimatedTime)
	fmt.Println()

	// Execute bridge (uncomment to run)
	fmt.Println("Executing bridge transaction...")
	result, err := bridgeClient.Send(ctx, &bridge.BridgeExecuteParams{
		BridgeQuoteParams: bridge.BridgeQuoteParams{
			FromChain: "arbitrum",
			ToChain:   "ethereum",
			Amount:    bridgeAmount,
			Recipient: signer.Address(),
		},
		SlippageTolerance: 0.5,
	})
	if err != nil {
		log.Fatalf("Failed to execute bridge: %v", err)
	}

	fmt.Println("Bridge Result:")
	fmt.Printf("  TX Hash: %s\n", result.TxHash)
	fmt.Printf("  Message GUID: %s\n", result.MessageGUID)
	fmt.Printf("  Amount sent: %s\n", result.AmountSent.String())
	fmt.Printf("  Amount to receive: %s\n", result.AmountToReceive.String())
	fmt.Println()

	// Track message delivery
	fmt.Println("Tracking message delivery via LayerZero Scan...")
	scanClient := bridge.NewLayerZeroScanClient()

	message, err := scanClient.WaitForDelivery(ctx, result.MessageGUID, &bridge.WaitForDeliveryOptions{
		Timeout:      600000, // 10 minutes
		PollInterval: 10000,  // 10 seconds
		OnStatusChange: func(status bridge.LayerZeroMessageStatus) {
			fmt.Printf("  Status changed: %s\n", status)
		},
	})
	if err != nil {
		log.Fatalf("Failed to wait for delivery: %v", err)
	}

	fmt.Println()
	fmt.Println("Delivery complete!")
	fmt.Printf("  Final status: %s\n", message.Status)
	fmt.Printf("  Destination TX: %s\n", message.DstTxHash)
}

func demonstrateDemoMode() {
	fmt.Println("Example: Get Bridge Quote")
	fmt.Println(`
  bridgeClient, _ := bridge.NewUsdt0Bridge(signer, "arbitrum")

  quote, _ := bridgeClient.Quote(ctx, &bridge.BridgeQuoteParams{
    FromChain: "arbitrum",
    ToChain:   "ethereum",
    Amount:    big.NewInt(100_000000), // 100 USDT0
    Recipient: "0x...",
  })

  fmt.Println("Fee:", quote.NativeFee, "wei")
`)

	fmt.Println("Example: Execute Bridge")
	fmt.Println(`
  result, _ := bridgeClient.Send(ctx, &bridge.BridgeExecuteParams{
    BridgeQuoteParams: bridge.BridgeQuoteParams{
      FromChain: "arbitrum",
      ToChain:   "ethereum",
      Amount:    big.NewInt(100_000000),
      Recipient: "0x...",
    },
    SlippageTolerance: 0.5,
  })

  fmt.Println("TX:", result.TxHash)
  fmt.Println("GUID:", result.MessageGUID)
`)

	fmt.Println("Example: Track Delivery")
	fmt.Println(`
  scanClient := bridge.NewLayerZeroScanClient()

  message, _ := scanClient.WaitForDelivery(ctx, result.MessageGUID, &bridge.WaitForDeliveryOptions{
    OnStatusChange: func(status bridge.LayerZeroMessageStatus) {
      fmt.Println("Status:", status)
    },
  })

  fmt.Println("Delivered! Dest TX:", message.DstTxHash)
`)

	fmt.Println("Example: Cross-Chain Payment Router")
	fmt.Println(`
  router, _ := bridge.NewCrossChainPaymentRouter(signer, "arbitrum")

  paymentResult, _ := router.RoutePayment(ctx, &bridge.CrossChainPaymentParams{
    SourceChain:      "arbitrum",
    DestinationChain: "ethereum",
    Amount:           big.NewInt(100_000000),
    PayTo:            recipientAddress,
    Payer:            userAddress,
  })

  // Wait for delivery
  router.WaitForDelivery(ctx, paymentResult.MessageGUID, nil)
`)
}

// Demo signer - replace with real implementation
type demoSigner struct {
	address string
}

func createDemoSigner(privateKey string) *demoSigner {
	return &demoSigner{address: "0x1234567890123456789012345678901234567890"}
}

func (s *demoSigner) Address() string {
	return s.address
}

func (s *demoSigner) ReadContract(ctx context.Context, address string, abi []byte, functionName string, args ...interface{}) (interface{}, error) {
	return nil, fmt.Errorf("demo signer: not implemented")
}

func (s *demoSigner) WriteContract(ctx context.Context, address string, abi []byte, functionName string, value *big.Int, args ...interface{}) (string, error) {
	return "", fmt.Errorf("demo signer: not implemented")
}

func (s *demoSigner) WaitForTransactionReceipt(ctx context.Context, txHash string) (*bridge.BridgeTransactionReceipt, error) {
	return nil, fmt.Errorf("demo signer: not implemented")
}
