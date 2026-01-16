package main

import (
	"fmt"
	"net/http"
	"os"
	"time"

	t402http "github.com/t402-io/t402/go/http"
	ginmw "github.com/t402-io/t402/go/http/gin"
	tonserver "github.com/t402-io/t402/go/mechanisms/ton/exact/server"
	ginfw "github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

const (
	DefaultPort = "4021"
)

/**
 * Example demonstrating how to create a Gin server with t402 TON payment protection.
 *
 * This example shows how to:
 * 1. Configure payment routes with TON USDT Jetton requirements
 * 2. Register the TON exact scheme
 * 3. Protect endpoints with micropayments
 *
 * Required environment variables:
 * - TON_PAYEE_ADDRESS: TON wallet address to receive payments
 * - FACILITATOR_URL: URL of the t402 facilitator
 */

func main() {
	godotenv.Load()

	tonAddress := os.Getenv("TON_PAYEE_ADDRESS")
	if tonAddress == "" {
		fmt.Println("❌ TON_PAYEE_ADDRESS environment variable is required")
		fmt.Println("   Example: EQC... (your TON wallet address)")
		os.Exit(1)
	}

	facilitatorURL := os.Getenv("FACILITATOR_URL")
	if facilitatorURL == "" {
		fmt.Println("❌ FACILITATOR_URL environment variable is required")
		fmt.Println("   Example: https://facilitator.t402.io")
		os.Exit(1)
	}

	network := os.Getenv("TON_NETWORK")
	if network == "" {
		network = "ton:testnet"
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = DefaultPort
	}

	fmt.Printf("🚀 Starting TON t402 Gin server...\n")
	fmt.Printf("   TON Payee address: %s\n", tonAddress)
	fmt.Printf("   Network: %s\n", network)
	fmt.Printf("   Facilitator: %s\n", facilitatorURL)

	// Create Gin router
	r := ginfw.Default()

	// Create HTTP facilitator client
	facilitatorClient := t402http.NewHTTPFacilitatorClient(&t402http.FacilitatorConfig{
		URL: facilitatorURL,
	})

	/**
	 * Configure t402 payment routes
	 *
	 * Each route specifies:
	 * - scheme: Payment scheme to use (exact for precise amounts)
	 * - price: Amount to charge (parsed by the scheme)
	 * - network: TON network identifier (ton:mainnet or ton:testnet)
	 * - payTo: Address to receive payments
	 */
	routes := t402http.RoutesConfig{
		"GET /weather": {
			Accepts: t402http.PaymentOptions{
				{
					Scheme:  "exact",
					Price:   "$0.001",
					Network: network,
					PayTo:   tonAddress,
				},
			},
			Description: "Get weather data",
			MimeType:    "application/json",
		},
		"GET /premium": {
			Accepts: t402http.PaymentOptions{
				{
					Scheme:  "exact",
					Price:   "$0.01",
					Network: network,
					PayTo:   tonAddress,
				},
			},
			Description: "Premium content access",
			MimeType:    "application/json",
		},
		"POST /ai/generate": {
			Accepts: t402http.PaymentOptions{
				{
					Scheme:  "exact",
					Price:   "$0.05",
					Network: network,
					PayTo:   tonAddress,
				},
			},
			Description: "AI content generation",
			MimeType:    "application/json",
		},
	}

	// Apply t402 payment middleware with TON scheme
	r.Use(ginmw.T402Payment(ginmw.Config{
		Routes:      routes,
		Facilitator: facilitatorClient,
		Schemes: []ginmw.SchemeConfig{
			{Network: network, Server: tonserver.NewExactTonScheme()},
		},
		Timeout: 30 * time.Second,
	}))

	/**
	 * Weather endpoint - requires $0.001 USDT on TON
	 */
	r.GET("/weather", func(c *ginfw.Context) {
		city := c.DefaultQuery("city", "San Francisco")

		weatherData := map[string]map[string]interface{}{
			"San Francisco": {"weather": "foggy", "temperature": 60},
			"New York":      {"weather": "cloudy", "temperature": 55},
			"London":        {"weather": "rainy", "temperature": 50},
			"Tokyo":         {"weather": "clear", "temperature": 65},
		}

		data, exists := weatherData[city]
		if !exists {
			data = map[string]interface{}{"weather": "sunny", "temperature": 70}
		}

		c.JSON(http.StatusOK, ginfw.H{
			"city":        city,
			"weather":     data["weather"],
			"temperature": data["temperature"],
			"timestamp":   time.Now().Format(time.RFC3339),
		})
	})

	/**
	 * Premium endpoint - requires $0.01 USDT on TON
	 */
	r.GET("/premium", func(c *ginfw.Context) {
		c.JSON(http.StatusOK, ginfw.H{
			"content":   "This is premium content protected by TON USDT payments",
			"features":  []string{"Advanced analytics", "Priority support", "Extended history"},
			"timestamp": time.Now().Format(time.RFC3339),
		})
	})

	/**
	 * AI generation endpoint - requires $0.05 USDT on TON
	 */
	r.POST("/ai/generate", func(c *ginfw.Context) {
		var request struct {
			Prompt string `json:"prompt"`
		}
		if err := c.BindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, ginfw.H{"error": "Invalid request body"})
			return
		}

		c.JSON(http.StatusOK, ginfw.H{
			"prompt":    request.Prompt,
			"generated": "This is a placeholder for AI-generated content based on your prompt.",
			"model":     "example-model-v1",
			"timestamp": time.Now().Format(time.RFC3339),
		})
	})

	/**
	 * Health check - no payment required
	 */
	r.GET("/health", func(c *ginfw.Context) {
		c.JSON(http.StatusOK, ginfw.H{
			"status":  "ok",
			"network": network,
			"version": "2.1.0",
		})
	})

	fmt.Printf("   Server listening on http://localhost:%s\n\n", port)
	fmt.Println("Endpoints:")
	fmt.Printf("   GET  /weather     - $0.001 USDT (%s)\n", network)
	fmt.Printf("   GET  /premium     - $0.01 USDT (%s)\n", network)
	fmt.Printf("   POST /ai/generate - $0.05 USDT (%s)\n", network)
	fmt.Println("   GET  /health      - Free")

	if err := r.Run(":" + port); err != nil {
		fmt.Printf("Error starting server: %v\n", err)
		os.Exit(1)
	}
}
