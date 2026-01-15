// Package main provides a CLI for the T402 payment protocol.
//
// Usage:
//
//	t402 verify <base64-payload>           Verify a payment payload
//	t402 settle <base64-payload>           Settle a payment
//	t402 supported                         List supported networks and schemes
//	t402 encode <json-file>                Encode a JSON file to base64
//	t402 decode <base64-string>            Decode base64 payload to JSON
//	t402 info <network>                    Show information about a network
//	t402 version                           Show version information
package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	t402 "github.com/t402-io/t402/go"
	t402http "github.com/t402-io/t402/go/http"
	"github.com/t402-io/t402/go/mechanisms/evm"
	"github.com/t402-io/t402/go/mechanisms/svm"
	"github.com/t402-io/t402/go/mechanisms/ton"
	"github.com/t402-io/t402/go/mechanisms/tron"
)

const (
	defaultFacilitator = "https://facilitator.t402.io"
)

// CLI flags
var (
	facilitatorURL string
	outputFormat   string // "json" or "text"
)

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(0)
	}

	// Parse global flags
	args := parseGlobalFlags(os.Args[1:])

	if len(args) == 0 {
		printUsage()
		os.Exit(0)
	}

	command := args[0]
	cmdArgs := args[1:]

	var err error
	switch command {
	case "verify":
		err = cmdVerify(cmdArgs)
	case "settle":
		err = cmdSettle(cmdArgs)
	case "supported":
		err = cmdSupported()
	case "encode":
		err = cmdEncode(cmdArgs)
	case "decode":
		err = cmdDecode(cmdArgs)
	case "info":
		err = cmdInfo(cmdArgs)
	case "version":
		cmdVersion()
	case "-h", "--help", "help":
		printUsage()
	default:
		fmt.Fprintf(os.Stderr, "Error: Unknown command '%s'\n\n", command)
		printUsage()
		os.Exit(1)
	}

	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

func parseGlobalFlags(args []string) []string {
	facilitatorURL = defaultFacilitator
	outputFormat = "text"

	var remaining []string
	i := 0
	for i < len(args) {
		switch args[i] {
		case "-f", "--facilitator":
			if i+1 < len(args) {
				facilitatorURL = args[i+1]
				i += 2
			} else {
				fmt.Fprintln(os.Stderr, "Error: --facilitator requires a URL")
				os.Exit(1)
			}
		case "-o", "--output":
			if i+1 < len(args) {
				outputFormat = args[i+1]
				if outputFormat != "json" && outputFormat != "text" {
					fmt.Fprintln(os.Stderr, "Error: --output must be 'json' or 'text'")
					os.Exit(1)
				}
				i += 2
			} else {
				fmt.Fprintln(os.Stderr, "Error: --output requires a format")
				os.Exit(1)
			}
		default:
			remaining = append(remaining, args[i])
			i++
		}
	}
	return remaining
}

func printUsage() {
	fmt.Println(`T402 CLI - Command-line interface for the T402 payment protocol

Usage:
    t402 [flags] <command> [arguments]

Commands:
    verify <base64-payload>     Verify a payment payload
    settle <base64-payload>     Settle a payment
    supported                   List supported networks and schemes
    encode <json-file>          Encode a JSON file to base64
    decode <base64-string>      Decode base64 payload to JSON
    info <network>              Show information about a network
    version                     Show version information

Flags:
    -f, --facilitator URL       Facilitator URL (default: https://facilitator.t402.io)
    -o, --output FORMAT         Output format: json, text (default: text)
    -h, --help                  Show this help message

Examples:
    # Verify a payment
    t402 verify eyJ0NDAyVmVyc2lvbiI6MiwuLi59

    # Settle a payment
    t402 settle eyJ0NDAyVmVyc2lvbiI6MiwuLi59

    # List supported networks
    t402 supported

    # Encode payment to base64
    t402 encode payment.json

    # Decode base64 payload
    t402 decode eyJ0NDAyVmVyc2lvbiI6MiwuLi59

    # Show network info
    t402 info eip155:1`)
}

func cmdVerify(args []string) error {
	if len(args) < 1 {
		return fmt.Errorf("usage: t402 verify <base64-payload>")
	}

	payload, err := decodeBase64Payload(args[0])
	if err != nil {
		return err
	}

	// Create facilitator client
	client := t402http.NewHTTPFacilitatorClient(&t402http.FacilitatorConfig{
		URL:     facilitatorURL,
		Timeout: 30 * time.Second,
	})

	ctx := context.Background()

	// For verification, we need both payload and requirements
	// For CLI, we'll use an empty requirements (facilitator should handle this)
	emptyReq := []byte(`{}`)

	result, err := client.Verify(ctx, payload, emptyReq)
	if err != nil {
		return fmt.Errorf("verification failed: %w", err)
	}

	if outputFormat == "json" {
		output, _ := json.MarshalIndent(result, "", "  ")
		fmt.Println(string(output))
	} else {
		if result.IsValid {
			fmt.Println("Payment is VALID")
			if result.Payer != "" {
				fmt.Printf("Payer: %s\n", result.Payer)
			}
		} else {
			fmt.Printf("Payment is INVALID: %s\n", result.InvalidReason)
		}
	}

	if !result.IsValid {
		return fmt.Errorf("payment invalid")
	}
	return nil
}

func cmdSettle(args []string) error {
	if len(args) < 1 {
		return fmt.Errorf("usage: t402 settle <base64-payload>")
	}

	payload, err := decodeBase64Payload(args[0])
	if err != nil {
		return err
	}

	// Create facilitator client
	client := t402http.NewHTTPFacilitatorClient(&t402http.FacilitatorConfig{
		URL:     facilitatorURL,
		Timeout: 60 * time.Second,
	})

	ctx := context.Background()

	// For settlement, we need both payload and requirements
	emptyReq := []byte(`{}`)

	result, err := client.Settle(ctx, payload, emptyReq)
	if err != nil {
		return fmt.Errorf("settlement failed: %w", err)
	}

	if outputFormat == "json" {
		output, _ := json.MarshalIndent(result, "", "  ")
		fmt.Println(string(output))
	} else {
		if result.Success {
			fmt.Println("Payment settled successfully!")
			fmt.Printf("Transaction: %s\n", result.Transaction)
			fmt.Printf("Network: %s\n", result.Network)
			if result.Payer != "" {
				fmt.Printf("Payer: %s\n", result.Payer)
			}
		} else {
			fmt.Printf("Settlement failed: %s\n", result.ErrorReason)
		}
	}

	if !result.Success {
		return fmt.Errorf("settlement failed")
	}
	return nil
}

func cmdSupported() error {
	// Create facilitator client
	client := t402http.NewHTTPFacilitatorClient(&t402http.FacilitatorConfig{
		URL:     facilitatorURL,
		Timeout: 30 * time.Second,
	})

	ctx := context.Background()

	result, err := client.GetSupported(ctx)
	if err != nil {
		return fmt.Errorf("failed to get supported: %w", err)
	}

	if outputFormat == "json" {
		output, _ := json.MarshalIndent(result, "", "  ")
		fmt.Println(string(output))
	} else {
		fmt.Println("Supported Payment Kinds:")
		fmt.Println(strings.Repeat("-", 50))
		for _, kind := range result.Kinds {
			fmt.Printf("  Scheme: %s\n", kind.Scheme)
			fmt.Printf("  Network: %s\n", kind.Network)
			fmt.Printf("  Version: %d\n", kind.T402Version)
			if kind.Extra != nil {
				for k, v := range kind.Extra {
					fmt.Printf("  %s: %v\n", k, v)
				}
			}
			fmt.Println()
		}

		if len(result.Signers) > 0 {
			fmt.Println("Supported Signers:")
			for family, signers := range result.Signers {
				fmt.Printf("  %s:\n", family)
				for _, signer := range signers {
					fmt.Printf("    - %s\n", signer)
				}
			}
			fmt.Println()
		}

		if len(result.Extensions) > 0 {
			fmt.Println("Supported Extensions:")
			for _, ext := range result.Extensions {
				fmt.Printf("  - %s\n", ext)
			}
		}
	}

	return nil
}

func cmdEncode(args []string) error {
	if len(args) < 1 {
		return fmt.Errorf("usage: t402 encode <json-file>")
	}

	filename := args[0]

	data, err := os.ReadFile(filename)
	if err != nil {
		return fmt.Errorf("failed to read file: %w", err)
	}

	// Validate it's valid JSON
	var payload map[string]interface{}
	if err := json.Unmarshal(data, &payload); err != nil {
		return fmt.Errorf("invalid JSON: %w", err)
	}

	// Re-marshal to compact JSON
	compactJSON, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal JSON: %w", err)
	}

	// Encode to base64
	encoded := base64.StdEncoding.EncodeToString(compactJSON)
	fmt.Println(encoded)

	return nil
}

func cmdDecode(args []string) error {
	if len(args) < 1 {
		return fmt.Errorf("usage: t402 decode <base64-string>")
	}

	payload, err := decodeBase64Payload(args[0])
	if err != nil {
		return err
	}

	// Pretty print JSON
	var data interface{}
	if err := json.Unmarshal(payload, &data); err != nil {
		return fmt.Errorf("failed to parse decoded JSON: %w", err)
	}

	output, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to format JSON: %w", err)
	}

	fmt.Println(string(output))
	return nil
}

func cmdInfo(args []string) error {
	if len(args) < 1 {
		return fmt.Errorf("usage: t402 info <network>")
	}

	network := args[0]

	info := map[string]interface{}{
		"network": network,
		"is_evm":  isEVMNetwork(network),
		"is_ton":  isTONNetwork(network),
		"is_tron": isTRONNetwork(network),
		"is_svm":  isSVMNetwork(network),
	}

	// Add chain-specific info for EVM
	if isEVMNetwork(network) {
		if netConfig, exists := evm.NetworkConfigs[network]; exists {
			info["chain_id"] = netConfig.ChainID.String()
			info["default_asset"] = netConfig.DefaultAsset.Address
			info["asset_name"] = netConfig.DefaultAsset.Name
		}
	}

	// Add chain-specific info for TON
	if isTONNetwork(network) {
		if netConfig, exists := ton.NetworkConfigs[network]; exists {
			info["chain_name"] = netConfig.Name
			info["default_asset"] = netConfig.DefaultAsset.MasterAddress
			info["asset_symbol"] = netConfig.DefaultAsset.Symbol
		}
	}

	// Add chain-specific info for TRON
	if isTRONNetwork(network) {
		if netConfig, exists := tron.NetworkConfigs[network]; exists {
			info["chain_name"] = netConfig.Name
			info["default_asset"] = netConfig.DefaultAsset.ContractAddress
			info["asset_symbol"] = netConfig.DefaultAsset.Symbol
		}
	}

	// Add chain-specific info for SVM
	if isSVMNetwork(network) {
		if netConfig, exists := svm.NetworkConfigs[network]; exists {
			info["chain_name"] = netConfig.Name
			info["default_asset"] = netConfig.DefaultAsset.Address
			info["asset_symbol"] = netConfig.DefaultAsset.Symbol
		}
	}

	if outputFormat == "json" {
		output, _ := json.MarshalIndent(info, "", "  ")
		fmt.Println(string(output))
	} else {
		fmt.Printf("Network: %s\n", network)
		fmt.Printf("Is EVM: %v\n", info["is_evm"])
		fmt.Printf("Is TON: %v\n", info["is_ton"])
		fmt.Printf("Is TRON: %v\n", info["is_tron"])
		fmt.Printf("Is SVM: %v\n", info["is_svm"])
		if chainName, ok := info["chain_name"]; ok {
			fmt.Printf("Chain Name: %s\n", chainName)
		}
		if chainID, ok := info["chain_id"]; ok {
			fmt.Printf("Chain ID: %s\n", chainID)
		}
		if defaultAsset, ok := info["default_asset"]; ok {
			fmt.Printf("Default Asset: %s\n", defaultAsset)
		}
		if assetName, ok := info["asset_name"]; ok {
			fmt.Printf("Asset Name: %s\n", assetName)
		}
		if assetSymbol, ok := info["asset_symbol"]; ok {
			fmt.Printf("Asset Symbol: %s\n", assetSymbol)
		}
	}

	return nil
}

func cmdVersion() {
	if outputFormat == "json" {
		info := map[string]interface{}{
			"version":          t402.Version,
			"protocol_version": t402.ProtocolVersion,
		}
		output, _ := json.MarshalIndent(info, "", "  ")
		fmt.Println(string(output))
	} else {
		fmt.Printf("T402 CLI v%s\n", t402.Version)
		fmt.Printf("Protocol Version: %d\n", t402.ProtocolVersion)
	}
}

// Helper functions

func decodeBase64Payload(encoded string) ([]byte, error) {
	// Try standard base64 first
	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		// Try URL-safe base64
		decoded, err = base64.URLEncoding.DecodeString(encoded)
		if err != nil {
			// Try raw URL-safe base64
			decoded, err = base64.RawURLEncoding.DecodeString(encoded)
			if err != nil {
				return nil, fmt.Errorf("failed to decode base64: %w", err)
			}
		}
	}
	return decoded, nil
}

func isEVMNetwork(network string) bool {
	return strings.HasPrefix(network, "eip155:")
}

func isTONNetwork(network string) bool {
	return network == ton.TonMainnetCAIP2 || network == ton.TonTestnetCAIP2 ||
		strings.HasPrefix(network, "ton:")
}

func isTRONNetwork(network string) bool {
	return network == tron.TronMainnetCAIP2 ||
		network == tron.TronNileCAIP2 ||
		network == tron.TronShastaCAIP2 ||
		strings.HasPrefix(network, "tron:")
}

func isSVMNetwork(network string) bool {
	return strings.HasPrefix(network, "solana:") ||
		network == svm.SolanaMainnetCAIP2 ||
		network == svm.SolanaDevnetCAIP2
}
