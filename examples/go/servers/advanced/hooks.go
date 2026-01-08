package main

import (
	"fmt"
	"net/http"
	"os"

	t402 "github.com/coinbase/t402/go"
	t402http "github.com/coinbase/t402/go/http"
	ginmw "github.com/coinbase/t402/go/http/gin"
	evm "github.com/coinbase/t402/go/mechanisms/evm/exact/server"
	ginfw "github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

const DefaultPort = "4021"

/**
 * Lifecycle Hooks Example
 *
 * This example demonstrates how to register hooks at different stages
 * of the payment verification and settlement lifecycle. Hooks are useful
 * for logging, custom validation, error recovery, and side effects.
 */

func main() {
	godotenv.Load()

	evmPayeeAddress := os.Getenv("EVM_PAYEE_ADDRESS")
	if evmPayeeAddress == "" {
		fmt.Println("❌ EVM_PAYEE_ADDRESS environment variable is required")
		os.Exit(1)
	}

	facilitatorURL := os.Getenv("FACILITATOR_URL")
	if facilitatorURL == "" {
		fmt.Println("❌ FACILITATOR_URL environment variable is required")
		os.Exit(1)
	}

	evmNetwork := t402.Network("eip155:84532") // Base Sepolia

	// Create facilitator client
	facilitatorClient := t402http.NewHTTPFacilitatorClient(&t402http.FacilitatorConfig{
		URL: facilitatorURL,
	})

	// Create EVM scheme server
	evmScheme := evm.NewExactEvmScheme()

	// Create t402 resource server with hooks 
	server := t402.Newt402ResourceServer(
		t402.WithFacilitatorClient(facilitatorClient),
	).
		Register(evmNetwork, evmScheme).
		// Hook 1: Before Verify - Called before payment verification
		// Can abort verification by returning &BeforeHookResult{Abort: true, Reason: "..."}
		OnBeforeVerify(func(ctx t402.VerifyContext) (*t402.BeforeHookResult, error) {
			fmt.Printf("🔵 Before verify hook - Scheme: %s, Network: %s\n",
				ctx.Requirements.GetScheme(), ctx.Requirements.GetNetwork())
			// Example: Abort verification
			// return &t402.BeforeHookResult{Abort: true, Reason: "Custom validation failed"}, nil
			return nil, nil
		}).
		// Hook 2: After Verify - Called after successful payment verification
		OnAfterVerify(func(ctx t402.VerifyResultContext) error {
			fmt.Printf("🟢 After verify hook - IsValid: %v\n", ctx.Result.IsValid)
			return nil
		}).
		// Hook 3: Verify Failure - Called when payment verification fails
		// Can recover from failure by returning &VerifyFailureHookResult{Recovered: true, Result: ...}
		OnVerifyFailure(func(ctx t402.VerifyFailureContext) (*t402.VerifyFailureHookResult, error) {
			fmt.Printf("🔴 Verify failure hook - Error: %v\n", ctx.Error)
			// Example: Recover from failure
			// return &t402.VerifyFailureHookResult{
			// 	Recovered: true,
			// 	Result:    &t402.VerifyResponse{IsValid: true, InvalidReason: "Recovered from failure"},
			// }, nil
			return nil, nil
		}).
		// Hook 4: Before Settle - Called before payment settlement
		// Can abort settlement by returning &BeforeHookResult{Abort: true, Reason: "..."}
		OnBeforeSettle(func(ctx t402.SettleContext) (*t402.BeforeHookResult, error) {
			fmt.Printf("🔵 Before settle hook - Scheme: %s, Network: %s\n",
				ctx.Requirements.GetScheme(), ctx.Requirements.GetNetwork())
			// Example: Abort settlement
			// return &t402.BeforeHookResult{Abort: true, Reason: "Settlement temporarily disabled"}, nil
			return nil, nil
		}).
		// Hook 5: After Settle - Called after successful payment settlement
		OnAfterSettle(func(ctx t402.SettleResultContext) error {
			fmt.Printf("🟢 After settle hook - Success: %v, Transaction: %s\n",
				ctx.Result.Success, ctx.Result.Transaction)
			return nil
		}).
		// Hook 6: Settle Failure - Called when payment settlement fails
		// Can recover from failure by returning &SettleFailureHookResult{Recovered: true, Result: ...}
		OnSettleFailure(func(ctx t402.SettleFailureContext) (*t402.SettleFailureHookResult, error) {
			fmt.Printf("🔴 Settle failure hook - Error: %v\n", ctx.Error)
			// Example: Recover from failure
			// return &t402.SettleFailureHookResult{
			// 	Recovered: true,
			// 	Result:    &t402.SettleResponse{Success: true, Transaction: "0x123..."},
			// }, nil
			return nil, nil
		})

	// Define routes
	routes := t402http.RoutesConfig{
		"GET /weather": {
			Accepts: t402http.PaymentOptions{
				{
					Scheme:  "exact",
					PayTo:   evmPayeeAddress,
					Price:   "$0.001",
					Network: evmNetwork,
				},
			},
			Description: "Weather data",
			MimeType:    "application/json",
		},
	}

	// Create Gin router with t402 payment middleware
	r := ginfw.Default()
	r.Use(ginmw.PaymentMiddleware(routes, server))

	r.GET("/weather", func(c *ginfw.Context) {
		c.JSON(http.StatusOK, ginfw.H{
			"report": ginfw.H{
				"weather":     "sunny",
				"temperature": 70,
			},
		})
	})

	fmt.Printf("🚀 Lifecycle Hooks example running on http://localhost:%s\n", DefaultPort)
	fmt.Printf("   Watch the console for hook execution logs\n")

	if err := r.Run(":" + DefaultPort); err != nil {
		fmt.Printf("Error starting server: %v\n", err)
		os.Exit(1)
	}
}
