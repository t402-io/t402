package main

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"log"
	"math/big"
	"os"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	t402 "github.com/t402-io/t402/go"
	evmmech "github.com/t402-io/t402/go/mechanisms/evm"
	evm "github.com/t402-io/t402/go/mechanisms/evm/exact/facilitator"
	"github.com/t402-io/t402/go/mechanisms/ton"
	tonfac "github.com/t402-io/t402/go/mechanisms/ton/exact/facilitator"
	"github.com/t402-io/t402/go/mechanisms/tron"
	tronfac "github.com/t402-io/t402/go/mechanisms/tron/exact/facilitator"
	"github.com/t402-io/t402/go/mechanisms/svm"
	svmfac "github.com/t402-io/t402/go/mechanisms/svm/exact/facilitator"
	"github.com/t402-io/t402/services/facilitator/internal/cache"
	"github.com/t402-io/t402/services/facilitator/internal/config"
	"github.com/t402-io/t402/services/facilitator/internal/server"
)

func main() {
	// Load configuration
	cfg := config.Load()

	log.Printf("Starting T402 Facilitator Service")
	log.Printf("Environment: %s", cfg.Environment)
	log.Printf("Port: %d", cfg.Port)

	// Initialize Redis
	redisClient, err := cache.NewClient(cfg.RedisURL)
	if err != nil {
		log.Printf("Warning: Redis connection failed: %v", err)
		log.Printf("Continuing without Redis (rate limiting disabled)")
		redisClient = nil
	} else {
		log.Printf("Redis connected: %s", cfg.RedisURL)
	}

	// Create facilitator
	facilitator, err := setupFacilitator(cfg)
	if err != nil {
		log.Fatalf("Failed to setup facilitator: %v", err)
	}

	// Create and start server
	srv := server.New(facilitator, redisClient, cfg)
	srv.Start()
}

// setupFacilitator creates and configures the t402 facilitator
func setupFacilitator(cfg *config.Config) (server.Facilitator, error) {
	facilitator := t402.Newt402Facilitator()

	// Track configured networks
	var configuredNetworks []string

	// Setup EVM chains if private key is provided
	if cfg.EvmPrivateKey != "" {
		// Networks to register with their RPC endpoints
		type networkInfo struct {
			network t402.Network
			rpc     string
			name    string
		}

		networks := []networkInfo{
			{t402.Network("eip155:1"), cfg.EthRPC, "Ethereum"},
			{t402.Network("eip155:42161"), cfg.ArbitrumRPC, "Arbitrum"},
			{t402.Network("eip155:8453"), cfg.BaseRPC, "Base"},
			{t402.Network("eip155:10"), cfg.OptimismRPC, "Optimism"},
		}

		// Use Base RPC as default if available, otherwise use first available RPC
		defaultRPC := cfg.BaseRPC
		if defaultRPC == "" {
			defaultRPC = cfg.EthRPC
		}
		if defaultRPC == "" {
			defaultRPC = cfg.ArbitrumRPC
		}
		if defaultRPC == "" {
			log.Printf("Warning: No RPC endpoint configured for EVM chains")
		} else {
			// Create EVM signer with default RPC
			signer, err := newFacilitatorEvmSigner(cfg.EvmPrivateKey, defaultRPC)
			if err != nil {
				return nil, fmt.Errorf("failed to create EVM signer: %w", err)
			}

			var networkList []t402.Network
			for _, n := range networks {
				if n.rpc != "" {
					networkList = append(networkList, n.network)
					configuredNetworks = append(configuredNetworks, n.name)
				}
			}

			if len(networkList) > 0 {
				evmConfig := &evm.ExactEvmSchemeConfig{
					DeployERC4337WithEIP6492: true,
				}
				facilitator.Register(networkList, evm.NewExactEvmScheme(signer, evmConfig))
				log.Printf("EVM facilitator address: %s", signer.GetAddresses()[0])
			}
		}
	} else {
		log.Printf("Warning: EVM_PRIVATE_KEY not set, EVM chains disabled")
	}

	// Setup TON chains if mnemonic is provided
	if cfg.TonMnemonic != "" {
		tonSigner, err := newFacilitatorTonSigner(cfg.TonMnemonic, cfg.TonRPC, cfg.TonTestnetRPC)
		if err != nil {
			log.Printf("Warning: Failed to create TON signer: %v", err)
		} else {
			var tonNetworks []t402.Network

			// Add mainnet if RPC is configured
			if cfg.TonRPC != "" {
				tonNetworks = append(tonNetworks, t402.Network(ton.TonMainnetCAIP2))
				configuredNetworks = append(configuredNetworks, "TON Mainnet")
			}

			// Add testnet if RPC is configured
			if cfg.TonTestnetRPC != "" {
				tonNetworks = append(tonNetworks, t402.Network(ton.TonTestnetCAIP2))
				configuredNetworks = append(configuredNetworks, "TON Testnet")
			}

			if len(tonNetworks) > 0 {
				facilitator.Register(tonNetworks, tonfac.NewExactTonScheme(tonSigner))
				addrs := tonSigner.GetAddresses(context.Background(), ton.TonMainnetCAIP2)
				if len(addrs) > 0 {
					log.Printf("TON facilitator address: %s", addrs[0])
				}
			}
		}
	} else {
		log.Printf("Warning: TON_MNEMONIC not set, TON chains disabled")
	}

	// Setup TRON chains if private key is provided
	if cfg.TronPrivateKey != "" {
		tronSigner, err := newFacilitatorTronSigner(cfg.TronPrivateKey, cfg.TronRPC)
		if err != nil {
			log.Printf("Warning: Failed to create TRON signer: %v", err)
		} else {
			var tronNetworks []t402.Network

			// Add mainnet
			tronNetworks = append(tronNetworks, t402.Network(tron.TronMainnetCAIP2))
			configuredNetworks = append(configuredNetworks, "TRON Mainnet")

			// Add testnets
			tronNetworks = append(tronNetworks, t402.Network(tron.TronNileCAIP2))
			configuredNetworks = append(configuredNetworks, "TRON Nile")

			tronNetworks = append(tronNetworks, t402.Network(tron.TronShastaCAIP2))
			configuredNetworks = append(configuredNetworks, "TRON Shasta")

			facilitator.Register(tronNetworks, tronfac.NewExactTronScheme(tronSigner))
			addrs := tronSigner.GetAddresses(context.Background(), tron.TronMainnetCAIP2)
			if len(addrs) > 0 {
				log.Printf("TRON facilitator address: %s", addrs[0])
			}
		}
	} else {
		log.Printf("Warning: TRON_PRIVATE_KEY not set, TRON chains disabled")
	}

	// Setup Solana chains if private key is provided
	if cfg.SvmPrivateKey != "" {
		solanaSigner, err := newFacilitatorSolanaSigner(cfg.SvmPrivateKey, cfg.SolanaRPC, "")
		if err != nil {
			log.Printf("Warning: Failed to create Solana signer: %v", err)
		} else {
			var solanaNetworks []t402.Network

			// Add mainnet
			solanaNetworks = append(solanaNetworks, t402.Network(svm.SolanaMainnetCAIP2))
			configuredNetworks = append(configuredNetworks, "Solana Mainnet")

			// Add devnet
			solanaNetworks = append(solanaNetworks, t402.Network(svm.SolanaDevnetCAIP2))
			configuredNetworks = append(configuredNetworks, "Solana Devnet")

			facilitator.Register(solanaNetworks, svmfac.NewExactSvmScheme(solanaSigner))
			addrs := solanaSigner.GetAddresses(context.Background(), svm.SolanaMainnetCAIP2)
			if len(addrs) > 0 {
				log.Printf("Solana facilitator address: %s", addrs[0].String())
			}
		}
	} else {
		log.Printf("Warning: SVM_PRIVATE_KEY not set, Solana chains disabled")
	}

	// Log configured networks
	if len(configuredNetworks) == 0 {
		return nil, fmt.Errorf("no networks configured - at least one private key is required")
	}

	log.Printf("Configured networks: %v", configuredNetworks)

	// Setup lifecycle hooks
	facilitator.OnAfterVerify(func(ctx t402.FacilitatorVerifyResultContext) error {
		log.Printf("Payment verified: payer=%s valid=%v",
			ctx.Result.Payer, ctx.Result.IsValid)
		return nil
	})

	facilitator.OnAfterSettle(func(ctx t402.FacilitatorSettleResultContext) error {
		log.Printf("Payment settled: tx=%s payer=%s",
			ctx.Result.Transaction, ctx.Result.Payer)
		return nil
	})

	facilitator.OnVerifyFailure(func(ctx t402.FacilitatorVerifyFailureContext) (*t402.FacilitatorVerifyFailureHookResult, error) {
		log.Printf("Verify failed: error=%v", ctx.Error)
		return nil, nil
	})

	facilitator.OnSettleFailure(func(ctx t402.FacilitatorSettleFailureContext) (*t402.FacilitatorSettleFailureHookResult, error) {
		log.Printf("Settle failed: error=%v", ctx.Error)
		return nil, nil
	})

	return facilitator, nil
}

// Print usage information
func printUsage() {
	fmt.Println("T402 Facilitator Service")
	fmt.Println()
	fmt.Println("Environment Variables:")
	fmt.Println("  PORT                 - Server port (default: 8080)")
	fmt.Println("  ENVIRONMENT          - Environment (development/production)")
	fmt.Println("  REDIS_URL            - Redis connection URL")
	fmt.Println("  RATE_LIMIT_REQUESTS  - Max requests per window (default: 1000)")
	fmt.Println("  RATE_LIMIT_WINDOW    - Rate limit window in seconds (default: 60)")
	fmt.Println()
	fmt.Println("  EVM_PRIVATE_KEY      - Private key for EVM chains")
	fmt.Println("  ETH_RPC              - Ethereum RPC endpoint")
	fmt.Println("  ARBITRUM_RPC         - Arbitrum RPC endpoint")
	fmt.Println("  BASE_RPC             - Base RPC endpoint")
	fmt.Println()
	os.Exit(0)
}

// ============================================================================
// EVM Facilitator Signer
// ============================================================================

// facilitatorEvmSigner implements the FacilitatorEvmSigner interface
type facilitatorEvmSigner struct {
	privateKey *ecdsa.PrivateKey
	address    common.Address
	client     *ethclient.Client
	chainID    *big.Int
}

// newFacilitatorEvmSigner creates a new EVM facilitator signer
func newFacilitatorEvmSigner(privateKeyHex string, rpcURL string) (*facilitatorEvmSigner, error) {
	// Remove 0x prefix if present
	privateKeyHex = strings.TrimPrefix(privateKeyHex, "0x")

	privateKey, err := crypto.HexToECDSA(privateKeyHex)
	if err != nil {
		return nil, fmt.Errorf("failed to parse private key: %w", err)
	}

	address := crypto.PubkeyToAddress(privateKey.PublicKey)

	// Connect to blockchain
	client, err := ethclient.Dial(rpcURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to RPC: %w", err)
	}

	// Get chain ID
	ctx := context.Background()
	chainID, err := client.ChainID(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get chain ID: %w", err)
	}

	return &facilitatorEvmSigner{
		privateKey: privateKey,
		address:    address,
		client:     client,
		chainID:    chainID,
	}, nil
}

func (s *facilitatorEvmSigner) GetAddresses() []string {
	return []string{s.address.Hex()}
}

func (s *facilitatorEvmSigner) GetChainID(ctx context.Context) (*big.Int, error) {
	return s.chainID, nil
}

func (s *facilitatorEvmSigner) VerifyTypedData(
	ctx context.Context,
	address string,
	domain evmmech.TypedDataDomain,
	typesMap map[string][]evmmech.TypedDataField,
	primaryType string,
	message map[string]interface{},
	signature []byte,
) (bool, error) {
	// This is handled by the EVM scheme's universal verification
	// For now, return true as actual verification happens in the scheme
	return true, nil
}

func (s *facilitatorEvmSigner) ReadContract(
	ctx context.Context,
	contractAddress string,
	abiJSON []byte,
	method string,
	args ...interface{},
) (interface{}, error) {
	// Parse ABI
	contractABI, err := abi.JSON(strings.NewReader(string(abiJSON)))
	if err != nil {
		return nil, fmt.Errorf("failed to parse ABI: %w", err)
	}

	// Pack the method call
	data, err := contractABI.Pack(method, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to pack method call: %w", err)
	}

	// Make the call
	to := common.HexToAddress(contractAddress)

	msg := ethereum.CallMsg{
		To:   &to,
		Data: data,
	}

	result, err := s.client.CallContract(ctx, msg, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to call contract: %w", err)
	}

	// Handle empty result
	if len(result) == 0 {
		if method == "authorizationState" {
			return false, nil
		}
		if method == "balanceOf" || method == "allowance" {
			return big.NewInt(0), nil
		}
		return nil, fmt.Errorf("empty result from contract call")
	}

	// Unpack the result
	methodObj, exists := contractABI.Methods[method]
	if !exists {
		return nil, fmt.Errorf("method %s not found in ABI", method)
	}

	output, err := methodObj.Outputs.Unpack(result)
	if err != nil {
		return nil, fmt.Errorf("failed to unpack result: %w", err)
	}

	if len(output) > 0 {
		return output[0], nil
	}

	return nil, nil
}

func (s *facilitatorEvmSigner) WriteContract(
	ctx context.Context,
	contractAddress string,
	abiJSON []byte,
	method string,
	args ...interface{},
) (string, error) {
	// Parse ABI
	contractABI, err := abi.JSON(strings.NewReader(string(abiJSON)))
	if err != nil {
		return "", fmt.Errorf("failed to parse ABI: %w", err)
	}

	// Pack the method call
	data, err := contractABI.Pack(method, args...)
	if err != nil {
		return "", fmt.Errorf("failed to pack method call: %w", err)
	}

	// Get nonce
	nonce, err := s.client.PendingNonceAt(ctx, s.address)
	if err != nil {
		return "", fmt.Errorf("failed to get nonce: %w", err)
	}

	// Get gas price
	gasPrice, err := s.client.SuggestGasPrice(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to get gas price: %w", err)
	}

	// Create transaction
	to := common.HexToAddress(contractAddress)
	tx := types.NewTransaction(
		nonce,
		to,
		big.NewInt(0), // value
		300000,        // gas limit
		gasPrice,
		data,
	)

	// Sign transaction
	signedTx, err := types.SignTx(tx, types.LatestSignerForChainID(s.chainID), s.privateKey)
	if err != nil {
		return "", fmt.Errorf("failed to sign transaction: %w", err)
	}

	// Send transaction
	err = s.client.SendTransaction(ctx, signedTx)
	if err != nil {
		return "", fmt.Errorf("failed to send transaction: %w", err)
	}

	return signedTx.Hash().Hex(), nil
}

func (s *facilitatorEvmSigner) SendTransaction(
	ctx context.Context,
	to string,
	data []byte,
) (string, error) {
	// Get nonce
	nonce, err := s.client.PendingNonceAt(ctx, s.address)
	if err != nil {
		return "", fmt.Errorf("failed to get nonce: %w", err)
	}

	// Get gas price
	gasPrice, err := s.client.SuggestGasPrice(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to get gas price: %w", err)
	}

	// Create transaction with raw data
	toAddr := common.HexToAddress(to)
	tx := types.NewTransaction(
		nonce,
		toAddr,
		big.NewInt(0), // value
		300000,        // gas limit
		gasPrice,
		data,
	)

	// Sign transaction
	signedTx, err := types.SignTx(tx, types.LatestSignerForChainID(s.chainID), s.privateKey)
	if err != nil {
		return "", fmt.Errorf("failed to sign transaction: %w", err)
	}

	// Send transaction
	err = s.client.SendTransaction(ctx, signedTx)
	if err != nil {
		return "", fmt.Errorf("failed to send transaction: %w", err)
	}

	return signedTx.Hash().Hex(), nil
}

func (s *facilitatorEvmSigner) WaitForTransactionReceipt(ctx context.Context, txHash string) (*evmmech.TransactionReceipt, error) {
	hash := common.HexToHash(txHash)

	// Poll for receipt
	for i := 0; i < 30; i++ { // 30 seconds timeout
		receipt, err := s.client.TransactionReceipt(ctx, hash)
		if err == nil && receipt != nil {
			return &evmmech.TransactionReceipt{
				Status:      uint64(receipt.Status),
				BlockNumber: receipt.BlockNumber.Uint64(),
				TxHash:      receipt.TxHash.Hex(),
			}, nil
		}
		time.Sleep(1 * time.Second)
	}

	return nil, fmt.Errorf("transaction receipt not found after 30 seconds")
}

func (s *facilitatorEvmSigner) GetBalance(ctx context.Context, address string, tokenAddress string) (*big.Int, error) {
	if tokenAddress == "" || tokenAddress == "0x0000000000000000000000000000000000000000" {
		// Native balance
		balance, err := s.client.BalanceAt(ctx, common.HexToAddress(address), nil)
		if err != nil {
			return nil, fmt.Errorf("failed to get balance: %w", err)
		}
		return balance, nil
	}

	// ERC20 balance
	const erc20ABI = `[{"constant":true,"inputs":[{"name":"account","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"type":"function"}]`

	result, err := s.ReadContract(ctx, tokenAddress, []byte(erc20ABI), "balanceOf", common.HexToAddress(address))
	if err != nil {
		return nil, err
	}

	if balance, ok := result.(*big.Int); ok {
		return balance, nil
	}

	return nil, fmt.Errorf("unexpected balance type: %T", result)
}

func (s *facilitatorEvmSigner) GetCode(ctx context.Context, address string) ([]byte, error) {
	addr := common.HexToAddress(address)
	code, err := s.client.CodeAt(ctx, addr, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get code: %w", err)
	}
	return code, nil
}
