// Package main provides an interactive CLI chatbot that demonstrates the t402
// MCP payment tools in demo mode. It creates a local MCP server, sends JSON-RPC
// requests based on user input, and displays the results.
//
// Run with: go run main.go
package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"strings"

	"github.com/t402-io/t402/sdks/go/mcp"
)

func main() {
	// Configure server in demo mode
	config := &mcp.Config{
		DemoMode: true,
	}
	server := mcp.NewServer(config)

	ctx := context.Background()
	scanner := bufio.NewScanner(os.Stdin)

	fmt.Println("t402 MCP Chatbot (Go - Demo Mode)")
	fmt.Println(`Type "help" for commands, "quit" to exit.`)
	fmt.Println()

	for {
		fmt.Print("\n> ")
		if !scanner.Scan() {
			break
		}

		input := strings.TrimSpace(scanner.Text())
		if input == "" {
			continue
		}

		parts := strings.Fields(input)
		command := strings.ToLower(parts[0])

		switch command {
		case "balance":
			handleBalance(ctx, server, parts)
		case "pay":
			handlePay(ctx, server, input)
		case "fee":
			handleBridgeFee(ctx, server, parts)
		case "tools":
			handleListTools(ctx, server)
		case "help":
			printHelp()
		case "quit", "exit":
			fmt.Println("Goodbye!")
			return
		default:
			fmt.Printf("Unknown command: %s. Type \"help\" for available commands.\n", command)
		}
	}
}

func callTool(ctx context.Context, server *mcp.Server, toolName string, args map[string]interface{}) (string, error) {
	result, err := server.CallTool(ctx, toolName, args)
	if err != nil {
		return "", err
	}

	// Extract text content from result
	data, err := json.Marshal(result)
	if err != nil {
		return "", err
	}

	var parsed map[string]interface{}
	if err := json.Unmarshal(data, &parsed); err != nil {
		return string(data), nil
	}

	content, ok := parsed["content"].([]interface{})
	if !ok {
		return string(data), nil
	}

	var texts []string
	for _, block := range content {
		if m, ok := block.(map[string]interface{}); ok {
			if t, ok := m["text"].(string); ok {
				texts = append(texts, t)
			}
		}
	}

	if len(texts) > 0 {
		return strings.Join(texts, "\n"), nil
	}
	return string(data), nil
}

func handleBalance(ctx context.Context, server *mcp.Server, parts []string) {
	if len(parts) < 2 {
		fmt.Println("Usage: balance <address> <network>")
		return
	}

	address := parts[1]
	network := "ethereum"
	if len(parts) > 2 {
		network = parts[2]
	}

	fmt.Printf("Checking balance on %s...\n", network)
	result, err := callTool(ctx, server, "t402/getBalance", map[string]interface{}{
		"address": address,
		"network": network,
	})
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		return
	}
	fmt.Println(result)
}

func handlePay(ctx context.Context, server *mcp.Server, input string) {
	// Parse: pay <amount> <token> to <address> on <network>
	re := regexp.MustCompile(`(?i)^pay\s+(\S+)\s+(\S+)\s+to\s+(0x[a-fA-F0-9]{40})\s+on\s+(\S+)`)
	matches := re.FindStringSubmatch(input)
	if matches == nil {
		fmt.Println("Usage: pay <amount> <token> to <address> on <network>")
		fmt.Println("Example: pay 10 USDC to 0x1234...5678 on base")
		return
	}

	amount := matches[1]
	token := strings.ToUpper(matches[2])
	to := matches[3]
	network := matches[4]

	fmt.Printf("Sending %s %s to %s on %s...\n", amount, token, to, network)
	result, err := callTool(ctx, server, "t402/pay", map[string]interface{}{
		"to":      to,
		"amount":  amount,
		"token":   token,
		"network": network,
	})
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		return
	}
	fmt.Println(result)
	fmt.Println("\n(Demo mode - no real tokens transferred)")
}

func handleBridgeFee(ctx context.Context, server *mcp.Server, parts []string) {
	if len(parts) < 4 || parts[2] != "to" {
		fmt.Println("Usage: fee <fromChain> to <toChain> <amount>")
		fmt.Println("Example: fee arbitrum to ethereum 100")
		return
	}

	fromChain := parts[1]
	toChain := parts[3]
	amount := "100"
	if len(parts) > 4 {
		amount = parts[4]
	}
	recipient := "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"

	fmt.Printf("Getting bridge fee for %s USDT0: %s -> %s...\n", amount, fromChain, toChain)
	result, err := callTool(ctx, server, "t402/getBridgeFee", map[string]interface{}{
		"fromChain": fromChain,
		"toChain":   toChain,
		"amount":    amount,
		"recipient": recipient,
	})
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		return
	}
	fmt.Println(result)
}

func handleListTools(ctx context.Context, server *mcp.Server) {
	tools := server.ListTools()
	fmt.Println("Available tools:")
	for _, tool := range tools {
		desc := tool.Description
		if len(desc) > 80 {
			desc = desc[:80] + "..."
		}
		fmt.Printf("  %s - %s\n", tool.Name, desc)
	}
}

func printHelp() {
	fmt.Println(`
t402 MCP Chatbot (Go - Demo Mode)
===================================

Commands:
  balance <address> <network>         Check balance on a network
  pay <amount> <token> to <address> on <network>   Send a payment
  fee <fromChain> to <toChain> <amount>            Get bridge fee quote
  tools                               List available MCP tools
  help                                Show this help
  quit                                Exit

Networks: ethereum, base, arbitrum, optimism, polygon, avalanche, ink, berachain, unichain
Tokens: USDC, USDT, USDT0

All operations run in demo mode - no real transactions are executed.`)
}
