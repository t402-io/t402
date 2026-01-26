package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"text/tabwriter"
	"time"

	"github.com/joho/godotenv"
)

// Version is set at build time
var Version = "dev"

// Config holds CLI configuration
type Config struct {
	FacilitatorURL string
	Timeout        time.Duration
}

func main() {
	// Load .env if present
	_ = godotenv.Load()

	cfg := &Config{
		FacilitatorURL: getEnv("FACILITATOR_URL", "http://localhost:8080"),
		Timeout:        30 * time.Second,
	}

	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	cmd := os.Args[1]
	args := os.Args[2:]

	var err error
	switch cmd {
	case "health":
		err = cmdHealth(cfg)
	case "ready":
		err = cmdReady(cfg)
	case "supported":
		err = cmdSupported(cfg, args)
	case "stats":
		if len(args) < 1 {
			fmt.Println("Usage: facilitator-cli stats <requests|settlements>")
			os.Exit(1)
		}
		switch args[0] {
		case "requests":
			err = cmdStatsRequests(cfg, args[1:])
		case "settlements":
			err = cmdStatsSettlements(cfg, args[1:])
		default:
			fmt.Printf("Unknown stats command: %s\n", args[0])
			os.Exit(1)
		}
	case "networks":
		err = cmdNetworks(cfg, args)
	case "version":
		fmt.Printf("facilitator-cli version %s\n", Version)
	case "help", "-h", "--help":
		printUsage()
	default:
		fmt.Printf("Unknown command: %s\n", cmd)
		printUsage()
		os.Exit(1)
	}

	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println(`T402 Facilitator CLI

Usage: facilitator-cli <command> [options]

Commands:
  health              Check facilitator health status
  ready               Check facilitator readiness
  supported           List supported networks and schemes
  networks            List supported networks (alias for supported)
  stats requests      Show request statistics
  stats settlements   Show settlement statistics
  version             Show CLI version
  help                Show this help message

Environment Variables:
  FACILITATOR_URL     Facilitator API URL (default: http://localhost:8080)

Examples:
  facilitator-cli health
  facilitator-cli supported
  facilitator-cli supported --network eip155:1
  facilitator-cli stats requests
  facilitator-cli stats settlements --network eip155:8453`)
}

// cmdHealth checks the health endpoint
func cmdHealth(cfg *Config) error {
	ctx, cancel := context.WithTimeout(context.Background(), cfg.Timeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "GET", cfg.FacilitatorURL+"/health", nil)
	if err != nil {
		return err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to connect to facilitator: %w", err)
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return fmt.Errorf("failed to decode response: %w", err)
	}

	status := "unknown"
	if s, ok := result["status"].(string); ok {
		status = s
	}

	if status == "ok" || status == "healthy" {
		fmt.Printf("✓ Facilitator is healthy\n")
		if version, ok := result["version"].(string); ok {
			fmt.Printf("  Version: %s\n", version)
		}
		return nil
	}

	fmt.Printf("✗ Facilitator is unhealthy: %s\n", status)
	return fmt.Errorf("unhealthy status: %s", status)
}

// cmdReady checks the readiness endpoint
func cmdReady(cfg *Config) error {
	ctx, cancel := context.WithTimeout(context.Background(), cfg.Timeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "GET", cfg.FacilitatorURL+"/ready", nil)
	if err != nil {
		return err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to connect to facilitator: %w", err)
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return fmt.Errorf("failed to decode response: %w", err)
	}

	ready := false
	if r, ok := result["ready"].(bool); ok {
		ready = r
	}

	if ready {
		fmt.Printf("✓ Facilitator is ready\n")
		return nil
	}

	fmt.Printf("✗ Facilitator is not ready\n")
	if checks, ok := result["checks"].(map[string]interface{}); ok {
		for name, status := range checks {
			fmt.Printf("  %s: %v\n", name, status)
		}
	}
	return fmt.Errorf("not ready")
}

// cmdSupported lists supported networks and schemes
func cmdSupported(cfg *Config, args []string) error {
	ctx, cancel := context.WithTimeout(context.Background(), cfg.Timeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "GET", cfg.FacilitatorURL+"/supported", nil)
	if err != nil {
		return err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to connect to facilitator: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Kinds []struct {
			Network string   `json:"network"`
			Scheme  string   `json:"scheme"`
			Signers []string `json:"signers"`
		} `json:"kinds"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return fmt.Errorf("failed to decode response: %w", err)
	}

	// Parse filter flags
	var filterNetwork string
	var filterScheme string
	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "--network", "-n":
			if i+1 < len(args) {
				filterNetwork = args[i+1]
				i++
			}
		case "--scheme", "-s":
			if i+1 < len(args) {
				filterScheme = args[i+1]
				i++
			}
		}
	}

	// Create tabwriter for aligned output
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "NETWORK\tSCHEME\tSIGNERS")
	fmt.Fprintln(w, "-------\t------\t-------")

	count := 0
	for _, kind := range result.Kinds {
		// Apply filters
		if filterNetwork != "" && kind.Network != filterNetwork {
			continue
		}
		if filterScheme != "" && kind.Scheme != filterScheme {
			continue
		}

		signers := "-"
		if len(kind.Signers) > 0 {
			signers = strings.Join(kind.Signers, ", ")
			if len(signers) > 50 {
				signers = signers[:47] + "..."
			}
		}
		fmt.Fprintf(w, "%s\t%s\t%s\n", kind.Network, kind.Scheme, signers)
		count++
	}
	w.Flush()

	fmt.Printf("\nTotal: %d supported network/scheme combinations\n", count)
	return nil
}

// cmdNetworks is an alias for cmdSupported
func cmdNetworks(cfg *Config, args []string) error {
	return cmdSupported(cfg, args)
}

// cmdStatsRequests shows request statistics
func cmdStatsRequests(cfg *Config, args []string) error {
	ctx, cancel := context.WithTimeout(context.Background(), cfg.Timeout)
	defer cancel()

	url := cfg.FacilitatorURL + "/stats/requests"

	// Parse filter flags
	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "--network", "-n":
			if i+1 < len(args) {
				url += "?network=" + args[i+1]
				i++
			}
		}
	}

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to connect to facilitator: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return fmt.Errorf("stats endpoint not available (database not configured)")
	}

	var stats struct {
		TotalRequests      int64   `json:"totalRequests"`
		SuccessfulRequests int64   `json:"successfulRequests"`
		FailedRequests     int64   `json:"failedRequests"`
		AvgDurationMs      float64 `json:"avgDurationMs"`
		MaxDurationMs      int     `json:"maxDurationMs"`
		MinDurationMs      int     `json:"minDurationMs"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&stats); err != nil {
		return fmt.Errorf("failed to decode response: %w", err)
	}

	fmt.Println("Request Statistics")
	fmt.Println("==================")
	fmt.Printf("Total Requests:      %d\n", stats.TotalRequests)
	fmt.Printf("Successful:          %d\n", stats.SuccessfulRequests)
	fmt.Printf("Failed:              %d\n", stats.FailedRequests)

	if stats.TotalRequests > 0 {
		successRate := float64(stats.SuccessfulRequests) / float64(stats.TotalRequests) * 100
		fmt.Printf("Success Rate:        %.1f%%\n", successRate)
	}

	fmt.Printf("\nLatency:\n")
	fmt.Printf("  Average:           %.2f ms\n", stats.AvgDurationMs)
	fmt.Printf("  Min:               %d ms\n", stats.MinDurationMs)
	fmt.Printf("  Max:               %d ms\n", stats.MaxDurationMs)

	return nil
}

// cmdStatsSettlements shows settlement statistics
func cmdStatsSettlements(cfg *Config, args []string) error {
	ctx, cancel := context.WithTimeout(context.Background(), cfg.Timeout)
	defer cancel()

	url := cfg.FacilitatorURL + "/stats/settlements"

	// Parse filter flags
	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "--network", "-n":
			if i+1 < len(args) {
				url += "?network=" + args[i+1]
				i++
			}
		}
	}

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to connect to facilitator: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return fmt.Errorf("stats endpoint not available (database not configured)")
	}

	var stats struct {
		Pending   int64 `json:"pending"`
		Confirmed int64 `json:"confirmed"`
		Failed    int64 `json:"failed"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&stats); err != nil {
		return fmt.Errorf("failed to decode response: %w", err)
	}

	total := stats.Pending + stats.Confirmed + stats.Failed

	fmt.Println("Settlement Statistics")
	fmt.Println("=====================")
	fmt.Printf("Total Settlements:   %d\n", total)
	fmt.Printf("Pending:             %d\n", stats.Pending)
	fmt.Printf("Confirmed:           %d\n", stats.Confirmed)
	fmt.Printf("Failed:              %d\n", stats.Failed)

	if total > 0 {
		confirmRate := float64(stats.Confirmed) / float64(total) * 100
		fmt.Printf("Confirmation Rate:   %.1f%%\n", confirmRate)
	}

	return nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
