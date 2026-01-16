// Command t402-mcp runs the T402 MCP server for AI agent integration.
//
// Usage:
//
//	t402-mcp
//
// Environment Variables:
//
//	T402_PRIVATE_KEY   - Hex wallet private key (0x...)
//	T402_DEMO_MODE     - Set to "true" to simulate transactions
//	T402_BUNDLER_URL   - ERC-4337 bundler endpoint for gasless payments
//	T402_PAYMASTER_URL - ERC-4337 paymaster endpoint
//	T402_RPC_<NETWORK> - Custom RPC URL for specific network (e.g., T402_RPC_ETHEREUM)
//
// Example Claude Desktop Configuration:
//
//	{
//	  "mcpServers": {
//	    "t402": {
//	      "command": "t402-mcp",
//	      "env": {
//	        "T402_DEMO_MODE": "true"
//	      }
//	    }
//	  }
//	}
package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/t402-io/t402/go/mcp"
)

func main() {
	// Load configuration from environment
	config := mcp.LoadConfigFromEnv()

	// Create server
	server := mcp.NewServer(config)

	// Setup signal handling for graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-sigCh
		fmt.Fprintln(os.Stderr, "Shutting down...")
		cancel()
	}()

	// Run server
	if err := server.Run(ctx); err != nil && err != context.Canceled {
		fmt.Fprintf(os.Stderr, "Server error: %v\n", err)
		os.Exit(1)
	}
}
