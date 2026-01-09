package main

import (
	"crypto/ecdsa"
	"fmt"
	"math/big"
	"os"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/joho/godotenv"
	"github.com/t402-io/t402/go/mechanisms/evm/erc4337"
)

/**
 * Example demonstrating ERC-4337 gasless transactions with T402.
 *
 * This example shows how to:
 * 1. Create a Safe smart account
 * 2. Connect to a Pimlico bundler
 * 3. Use a Pimlico paymaster for gas sponsorship
 * 4. Build and prepare a gasless UserOperation
 *
 * Required environment variables:
 * - OWNER_PRIVATE_KEY: EOA private key that owns the Safe (hex encoded without 0x prefix)
 * - PIMLICO_API_KEY: Your Pimlico API key
 * - CHAIN_ID: (optional) Chain ID, defaults to 84532 (Base Sepolia)
 */

func main() {
	// Load .env file if it exists
	if err := godotenv.Load(); err != nil {
		fmt.Println("No .env file found, using environment variables")
	}

	// Get configuration
	privateKeyHex := os.Getenv("OWNER_PRIVATE_KEY")
	if privateKeyHex == "" {
		fmt.Println("❌ OWNER_PRIVATE_KEY environment variable is required")
		fmt.Println("   Example: 'abc123...' (64 character hex string without 0x prefix)")
		os.Exit(1)
	}

	pimlicoAPIKey := os.Getenv("PIMLICO_API_KEY")
	if pimlicoAPIKey == "" {
		fmt.Println("❌ PIMLICO_API_KEY environment variable is required")
		fmt.Println("   Get one at: https://dashboard.pimlico.io/")
		os.Exit(1)
	}

	chainIDStr := os.Getenv("CHAIN_ID")
	chainID := int64(84532) // Default to Base Sepolia
	if chainIDStr != "" {
		fmt.Sscanf(chainIDStr, "%d", &chainID)
	}

	fmt.Println("🚀 ERC-4337 Gasless Transaction Example (Go)\n")

	// Parse private key
	privateKey, err := crypto.HexToECDSA(privateKeyHex)
	if err != nil {
		fmt.Printf("❌ Invalid private key: %v\n", err)
		os.Exit(1)
	}

	ownerAddress := crypto.PubkeyToAddress(privateKey.PublicKey)
	fmt.Printf("Owner EOA: %s\n", ownerAddress.Hex())
	fmt.Printf("Chain ID: %d\n\n", chainID)

	// Step 1: Create Safe smart account
	fmt.Println("📦 Creating Safe smart account...")
	safeAccount, err := erc4337.NewSafeSmartAccount(erc4337.SafeAccountConfig{
		Owner:   privateKey,
		ChainID: chainID,
		Salt:    big.NewInt(0),
	})
	if err != nil {
		fmt.Printf("❌ Failed to create Safe account: %v\n", err)
		os.Exit(1)
	}

	smartAccountAddress, err := safeAccount.GetAddress()
	if err != nil {
		fmt.Printf("❌ Failed to get account address: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("   Smart Account Address: %s\n\n", smartAccountAddress.Hex())

	// Step 2: Create Pimlico bundler client
	fmt.Println("🔗 Connecting to Pimlico bundler...")
	bundler := erc4337.NewPimlicoBundlerClient(erc4337.PimlicoConfig{
		APIKey:  pimlicoAPIKey,
		ChainID: chainID,
	})

	// Get current gas prices
	gasPrice, err := bundler.GetUserOperationGasPrice()
	if err != nil {
		fmt.Printf("   ⚠️  Could not fetch gas prices: %v\n", err)
	} else {
		fmt.Printf("   Fast gas price: %s wei\n", gasPrice.Fast.MaxFeePerGas.String())
	}
	fmt.Println()

	// Step 3: Create Pimlico paymaster for gas sponsorship
	fmt.Println("💰 Setting up Pimlico paymaster...")
	paymaster := erc4337.NewPimlicoPaymaster(erc4337.PimlicoPaymasterConfig{
		APIKey:  pimlicoAPIKey,
		ChainID: chainID,
	})
	fmt.Println("   Paymaster configured\n")

	// Step 4: Build UserOperation
	fmt.Println("📝 Building UserOperation...\n")

	// Example: encode a simple ETH transfer (0 value, no data = no-op)
	targetAddress := common.HexToAddress("0x0000000000000000000000000000000000000000")
	callData, err := safeAccount.EncodeExecute(targetAddress, big.NewInt(0), []byte{})
	if err != nil {
		fmt.Printf("❌ Failed to encode execute: %v\n", err)
		os.Exit(1)
	}

	// Get init code for account deployment
	initCode, err := safeAccount.GetInitCode()
	if err != nil {
		fmt.Printf("❌ Failed to get init code: %v\n", err)
		os.Exit(1)
	}

	// Set gas prices (use defaults if fetch failed)
	maxFeePerGas := big.NewInt(10000000000)         // 10 gwei
	maxPriorityFeePerGas := big.NewInt(1000000000)  // 1 gwei
	if gasPrice != nil {
		maxFeePerGas = gasPrice.Fast.MaxFeePerGas
		maxPriorityFeePerGas = gasPrice.Fast.MaxPriorityFeePerGas
	}

	// Build UserOperation
	userOp := &erc4337.UserOperation{
		Sender:               smartAccountAddress,
		Nonce:                big.NewInt(0),
		InitCode:             initCode,
		CallData:             callData,
		VerificationGasLimit: big.NewInt(150000),
		CallGasLimit:         big.NewInt(100000),
		PreVerificationGas:   big.NewInt(50000),
		MaxFeePerGas:         maxFeePerGas,
		MaxPriorityFeePerGas: maxPriorityFeePerGas,
		PaymasterAndData:     []byte{},
		Signature:            []byte{},
	}

	// Step 5: Estimate gas
	fmt.Println("⛽ Estimating gas...")
	gasEstimate, err := bundler.EstimateUserOperationGas(userOp)
	if err != nil {
		fmt.Printf("   ⚠️  Gas estimation failed (expected without funds): %v\n\n", err)
	} else {
		fmt.Printf("   Verification Gas: %s\n", gasEstimate.VerificationGasLimit.String())
		fmt.Printf("   Call Gas: %s\n", gasEstimate.CallGasLimit.String())
		fmt.Printf("   Pre-verification Gas: %s\n\n", gasEstimate.PreVerificationGas.String())

		userOp.VerificationGasLimit = gasEstimate.VerificationGasLimit
		userOp.CallGasLimit = gasEstimate.CallGasLimit
		userOp.PreVerificationGas = gasEstimate.PreVerificationGas
	}

	// Step 6: Get paymaster sponsorship
	fmt.Println("🎁 Requesting gas sponsorship...")
	paymasterData, err := paymaster.SponsorUserOperation(userOp)
	if err != nil {
		fmt.Printf("   ⚠️  Sponsorship not available: %v\n", err)
		fmt.Println("   (Configure a policy in Pimlico dashboard)\n")
	} else {
		fmt.Printf("   Paymaster: %s\n\n", paymasterData.Paymaster.Hex())
		// In production: set userOp.PaymasterAndData from paymasterData
	}

	// Step 7: Sign the UserOperation (placeholder for demo)
	fmt.Println("✍️  Signing UserOperation...")
	// In production:
	// userOpHash := computeUserOpHash(userOp, chainID, entryPoint)
	// signature, _ := safeAccount.SignUserOpHash(userOpHash)
	// userOp.Signature = signature
	userOp.Signature = make([]byte, 65)
	fmt.Println("   Signature created (placeholder for demo)\n")

	// Step 8: Ready to submit
	fmt.Println("📤 Ready to submit UserOperation!")
	fmt.Println("   (Submission disabled in demo mode)\n")

	/*
	// Uncomment to actually submit:
	userOpHash, err := bundler.SendUserOperation(userOp)
	if err != nil {
		fmt.Printf("❌ Failed to send UserOp: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("   UserOp Hash: %s\n", userOpHash.Hex())

	// Wait for receipt
	fmt.Println("⏳ Waiting for confirmation...")
	receipt, err := bundler.WaitForReceipt(userOpHash, 60*time.Second, 2*time.Second)
	if err != nil {
		fmt.Printf("❌ Failed to get receipt: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("   Success: %v\n", receipt.Success)
	fmt.Printf("   Transaction: %s\n", receipt.Receipt.TransactionHash.Hex())
	*/

	// Summary
	fmt.Println("📋 Summary:")
	fmt.Printf("   Smart Account: %s\n", smartAccountAddress.Hex())
	fmt.Printf("   Owner: %s\n", ownerAddress.Hex())
	fmt.Printf("   Chain: %d\n", chainID)
	fmt.Println("   Bundler: Pimlico")
	fmt.Println("   Paymaster: Pimlico (gas sponsorship)")
	fmt.Printf("   EntryPoint: %s\n", erc4337.EntryPointV07Address)
}

// computeUserOpHash would compute the EIP-712 hash of the UserOperation
func computeUserOpHash(userOp *erc4337.UserOperation, chainID int64, entryPoint common.Address) common.Hash {
	// Implementation would follow EIP-712 typed data hashing
	// This is a placeholder
	return common.Hash{}
}
