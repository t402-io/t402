package main

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	t402 "github.com/t402-io/t402/sdks/go"
	evmmech "github.com/t402-io/t402/sdks/go/mechanisms/evm"
	evm "github.com/t402-io/t402/sdks/go/mechanisms/evm/exact/facilitator"
	evmlegacy "github.com/t402-io/t402/sdks/go/mechanisms/evm/exact-legacy/facilitator"
	evmupto "github.com/t402-io/t402/sdks/go/mechanisms/evm/upto"
	"github.com/t402-io/t402/sdks/go/mechanisms/ton"
	tonfac "github.com/t402-io/t402/sdks/go/mechanisms/ton/exact/facilitator"
	tonuptofac "github.com/t402-io/t402/sdks/go/mechanisms/ton/upto/facilitator"
	"github.com/t402-io/t402/sdks/go/mechanisms/tron"
	tronfac "github.com/t402-io/t402/sdks/go/mechanisms/tron/exact/facilitator"
	tronuptofac "github.com/t402-io/t402/sdks/go/mechanisms/tron/upto/facilitator"
	"github.com/t402-io/t402/sdks/go/mechanisms/svm"
	svmfac "github.com/t402-io/t402/sdks/go/mechanisms/svm/exact/facilitator"
	svmuptofac "github.com/t402-io/t402/sdks/go/mechanisms/svm/upto/facilitator"
	"github.com/t402-io/t402/sdks/go/mechanisms/near"
	nearfac "github.com/t402-io/t402/sdks/go/mechanisms/near/exact-direct/facilitator"
	"github.com/t402-io/t402/sdks/go/mechanisms/aptos"
	aptosfac "github.com/t402-io/t402/sdks/go/mechanisms/aptos/exact-direct/facilitator"
	"github.com/t402-io/t402/sdks/go/mechanisms/tezos"
	tezosfac "github.com/t402-io/t402/sdks/go/mechanisms/tezos/exact-direct/facilitator"
	"github.com/t402-io/t402/sdks/go/mechanisms/polkadot"
	polkadotfac "github.com/t402-io/t402/sdks/go/mechanisms/polkadot/exact-direct/facilitator"
	"github.com/t402-io/t402/sdks/go/mechanisms/stacks"
	stacksfac "github.com/t402-io/t402/sdks/go/mechanisms/stacks/exact-direct/facilitator"
	"github.com/t402-io/t402/sdks/go/mechanisms/cosmos"
	cosmosfac "github.com/t402-io/t402/sdks/go/mechanisms/cosmos/exact-direct/facilitator"
	"github.com/t402-io/t402/services/facilitator/internal/cache"
	"github.com/t402-io/t402/services/facilitator/internal/config"
	"github.com/t402-io/t402/services/facilitator/internal/persistence"
	"github.com/t402-io/t402/services/facilitator/internal/server"
	"github.com/t402-io/t402/services/facilitator/internal/tracing"
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

	// Initialize Database (optional)
	var db *persistence.DB
	if cfg.DatabaseURL != "" {
		dbConfig := &persistence.DBConfig{
			URL:             cfg.DatabaseURL,
			MaxConnections:  cfg.DatabaseMaxConns,
			IdleConnections: cfg.DatabaseIdleConns,
			AutoMigrate:     cfg.DatabaseAutoMigrate,
		}
		db, err = persistence.NewDB(dbConfig)
		if err != nil {
			log.Printf("Warning: Database connection failed: %v", err)
			log.Printf("Continuing without database (audit logging disabled)")
			db = nil
		} else {
			log.Printf("Database connected")
			defer db.Close()
		}
	} else {
		log.Printf("DATABASE_URL not set, audit logging disabled")
	}

	// Initialize OpenTelemetry tracing (optional)
	var tracer *tracing.Provider
	if cfg.OTELEnabled {
		tracingConfig := &tracing.Config{
			Enabled:        true,
			ServiceName:    "facilitator",
			ServiceVersion: server.Version,
			Environment:    cfg.Environment,
			Endpoint:       cfg.OTELEndpoint,
			Protocol:       cfg.OTELProtocol,
			Insecure:       cfg.OTELInsecure,
			SampleRate:     cfg.OTELSampleRate,
		}
		tracer, err = tracing.NewProvider(context.Background(), tracingConfig)
		if err != nil {
			log.Printf("Warning: Failed to initialize tracing: %v", err)
			log.Printf("Continuing without distributed tracing")
			tracer = nil
		} else {
			log.Printf("OpenTelemetry tracing enabled (endpoint: %s)", cfg.OTELEndpoint)
			defer func() {
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				if err := tracer.Shutdown(ctx); err != nil {
					log.Printf("Warning: Failed to shutdown tracer: %v", err)
				}
			}()
		}
	} else {
		log.Printf("OpenTelemetry tracing disabled (set OTEL_ENABLED=true to enable)")
	}

	// Create facilitator
	facilitator, cleanupFn, err := setupFacilitator(cfg)
	if err != nil {
		log.Fatalf("Failed to setup facilitator: %v", err)
	}

	// Create and start server
	srv := server.NewWithTracing(facilitator, redisClient, cfg, db, tracer)

	// SECURITY: Register shutdown hook to zeroize private keys
	if cleanupFn != nil {
		srv.OnShutdown(cleanupFn)
	}

	srv.Start()
}

// Zeroizable is implemented by signers that hold private key material
type Zeroizable interface {
	Zeroize()
}

// setupFacilitator creates and configures the t402 facilitator.
// Returns the facilitator, a cleanup function for zeroizing keys, and any error.
func setupFacilitator(cfg *config.Config) (server.Facilitator, func(), error) {
	facilitator := t402.Newt402Facilitator()

	// Track configured networks and signers that need cleanup
	var configuredNetworks []string
	var zeroizables []Zeroizable

	// Setup EVM chains if private key is provided
	if cfg.EvmPrivateKey != "" {
		// Networks to register with their RPC endpoints
		type networkInfo struct {
			network t402.Network
			rpc     string
			name    string
		}

		networks := []networkInfo{
			// Core Networks
			{t402.Network("eip155:1"), cfg.EthRPC, "Ethereum"},
			{t402.Network("eip155:42161"), cfg.ArbitrumRPC, "Arbitrum"},
			{t402.Network("eip155:8453"), cfg.BaseRPC, "Base"},
			{t402.Network("eip155:10"), cfg.OptimismRPC, "Optimism"},
			{t402.Network("eip155:57073"), cfg.InkRPC, "Ink"},
			{t402.Network("eip155:80094"), cfg.BerachainRPC, "Berachain"},
			{t402.Network("eip155:130"), cfg.UnichainRPC, "Unichain"},
			// Phase 1: High Priority USDT0 Networks
			{t402.Network("eip155:137"), cfg.PolygonRPC, "Polygon"},
			{t402.Network("eip155:5000"), cfg.MantleRPC, "Mantle"},
			{t402.Network("eip155:9745"), cfg.PlasmaRPC, "Plasma"},
			{t402.Network("eip155:1329"), cfg.SeiRPC, "Sei"},
			{t402.Network("eip155:1030"), cfg.ConfluxRPC, "Conflux"},
			{t402.Network("eip155:143"), cfg.MonadRPC, "Monad"},
			// Phase 2: Medium Priority USDT0 Networks
			{t402.Network("eip155:14"), cfg.FlareRPC, "Flare"},
			{t402.Network("eip155:30"), cfg.RootstockRPC, "Rootstock"},
			{t402.Network("eip155:196"), cfg.XLayerRPC, "XLayer"},
			{t402.Network("eip155:988"), cfg.StableRPC, "Stable"},
			{t402.Network("eip155:999"), cfg.HyperEvmRPC, "HyperEVM"},
			{t402.Network("eip155:4326"), cfg.MegaEthRPC, "MegaETH"},
			{t402.Network("eip155:21000000"), cfg.CornRPC, "Corn"},
			// Testnet Networks
			{t402.Network("eip155:11155111"), cfg.SepoliaRPC, "Ethereum Sepolia"},
			{t402.Network("eip155:84532"), cfg.BaseSepoliaRPC, "Base Sepolia"},
			{t402.Network("eip155:421614"), cfg.ArbitrumSepoliaRPC, "Arbitrum Sepolia"},
		}

		// Legacy USDT networks (no EIP-3009 support)
		legacyNetworks := []networkInfo{
			{t402.Network("eip155:56"), cfg.BnbRPC, "BNB Chain"},
			{t402.Network("eip155:43114"), cfg.AvalancheRPC, "Avalanche"},
			{t402.Network("eip155:250"), cfg.FantomRPC, "Fantom"},
			{t402.Network("eip155:42220"), cfg.CeloRPC, "Celo"},
			{t402.Network("eip155:8217"), cfg.KaiaRPC, "Kaia"},
		}

		// Create per-network EVM signers with dedicated RPC connections
		// Each network needs its own ethclient connected to the correct chain RPC
		// so that ReadContract, WriteContract, and GetChainID operate on the right chain
		evmConfig := &evm.ExactEvmSchemeConfig{
			DeployERC4337WithEIP6492: true,
		}
		uptoConfig := &evmupto.UptoEvmFacilitatorConfig{
			SettleFullAmount: false,
		}
		legacyConfig := &evmlegacy.ExactLegacyEvmSchemeConfig{
			MinAllowanceRatio: 1.0,
		}

		var addressLogged bool
		var evmCount, legacyCount int

		// Register standard EVM networks (exact + upto schemes per network)
		for _, n := range networks {
			if n.rpc == "" {
				continue
			}
			netSigner, err := newFacilitatorEvmSigner(cfg.EvmPrivateKey, n.rpc)
			if err != nil {
				log.Printf("Warning: Failed to create EVM signer for %s: %v", n.name, err)
				continue
			}
			facilitator.Register([]t402.Network{n.network}, evm.NewExactEvmScheme(netSigner, evmConfig))
			facilitator.Register([]t402.Network{n.network}, evmupto.NewUptoEvmFacilitator(netSigner, uptoConfig))
			zeroizables = append(zeroizables, netSigner)
			configuredNetworks = append(configuredNetworks, n.name)
			evmCount++
			if !addressLogged {
				log.Printf("EVM facilitator address: %s", netSigner.GetAddresses()[0])
				addressLogged = true
			}
		}

		// Register legacy USDT networks (exact-legacy scheme, no EIP-3009)
		for _, n := range legacyNetworks {
			if n.rpc == "" {
				continue
			}
			netSigner, err := newFacilitatorEvmSigner(cfg.EvmPrivateKey, n.rpc)
			if err != nil {
				log.Printf("Warning: Failed to create EVM signer for %s: %v", n.name, err)
				continue
			}
			facilitator.Register([]t402.Network{n.network}, evmlegacy.NewExactLegacyEvmScheme(netSigner, legacyConfig))
			zeroizables = append(zeroizables, netSigner)
			configuredNetworks = append(configuredNetworks, n.name+" (legacy)")
			legacyCount++
			if !addressLogged {
				log.Printf("EVM facilitator address: %s", netSigner.GetAddresses()[0])
				addressLogged = true
			}
		}

		if addressLogged {
			log.Printf("EVM registered %d standard + %d legacy networks (per-network RPC)", evmCount, legacyCount)
		} else {
			log.Printf("Warning: No RPC endpoint configured for EVM chains")
		}
	} else {
		log.Printf("Warning: EVM_PRIVATE_KEY not set, EVM chains disabled")
	}

	// Setup TON chains if mnemonic is provided
	if cfg.TonMnemonic != "" {
		tonSigner, err := newFacilitatorTonSignerWithAddresses(
			cfg.TonMnemonic,
			cfg.TonRPC,
			cfg.TonTestnetRPC,
			cfg.TonMainnetAddress,
			cfg.TonTestnetAddress,
		)
		if err != nil {
			log.Printf("Warning: Failed to create TON signer: %v", err)
		} else {
			var tonNetworks []t402.Network

			// Add mainnet if RPC and address are configured
			if cfg.TonRPC != "" && cfg.TonMainnetAddress != "" {
				tonNetworks = append(tonNetworks, t402.Network(ton.TonMainnetCAIP2))
				configuredNetworks = append(configuredNetworks, "TON Mainnet")
				log.Printf("TON mainnet address: %s", cfg.TonMainnetAddress)
			} else if cfg.TonRPC != "" {
				log.Printf("Warning: TON_MAINNET_ADDRESS not set, TON mainnet disabled")
			}

			// Add testnet if RPC and address are configured
			if cfg.TonTestnetRPC != "" && cfg.TonTestnetAddress != "" {
				tonNetworks = append(tonNetworks, t402.Network(ton.TonTestnetCAIP2))
				configuredNetworks = append(configuredNetworks, "TON Testnet")
				log.Printf("TON testnet address: %s", cfg.TonTestnetAddress)
			} else if cfg.TonTestnetRPC != "" {
				log.Printf("Warning: TON_TESTNET_ADDRESS not set, TON testnet disabled")
			}

			if len(tonNetworks) > 0 {
				facilitator.Register(tonNetworks, tonfac.NewExactTonScheme(tonSigner))
				facilitator.Register(tonNetworks, tonuptofac.NewUptoTonScheme(&facilitatorTonUptoAdapter{inner: tonSigner}))
				zeroizables = append(zeroizables, tonSigner)
				log.Printf("TON upto scheme registered for %d networks", len(tonNetworks))
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

			// Register TRON upto scheme (needs adapter for context-free interface)
			tronUptoAdapter, err := newFacilitatorTronUptoAdapter(cfg.TronPrivateKey, cfg.TronRPC)
			if err != nil {
				log.Printf("Warning: Failed to create TRON upto adapter: %v", err)
			} else {
				facilitator.Register(tronNetworks, tronuptofac.NewUptoTronScheme(tronUptoAdapter))
				log.Printf("TRON upto scheme registered for %d networks", len(tronNetworks))
			}

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

			// Add testnet
			solanaNetworks = append(solanaNetworks, t402.Network(svm.SolanaTestnetCAIP2))
			configuredNetworks = append(configuredNetworks, "Solana Testnet")

			facilitator.Register(solanaNetworks, svmfac.NewExactSvmScheme(solanaSigner))
			facilitator.Register(solanaNetworks, svmuptofac.NewUptoSvmScheme(solanaSigner))
			zeroizables = append(zeroizables, solanaSigner)
			addrs := solanaSigner.GetAddresses(context.Background(), svm.SolanaMainnetCAIP2)
			if len(addrs) > 0 {
				log.Printf("Solana facilitator address: %s", addrs[0].String())
			}
			log.Printf("Solana upto scheme registered for %d networks", len(solanaNetworks))
		}
	} else {
		log.Printf("Warning: SVM_PRIVATE_KEY not set, Solana chains disabled")
	}

	// Setup NEAR chains if RPC is configured
	if cfg.NearRPC != "" {
		nearSigner := newFacilitatorNearSigner(cfg.NearRPC, cfg.NearTestnetRPC)

		var nearNetworks []t402.Network

		// Add mainnet
		nearNetworks = append(nearNetworks, t402.Network(near.NearMainnetCAIP2))
		configuredNetworks = append(configuredNetworks, "NEAR Mainnet")

		// Add testnet if configured
		if cfg.NearTestnetRPC != "" {
			nearNetworks = append(nearNetworks, t402.Network(near.NearTestnetCAIP2))
			configuredNetworks = append(configuredNetworks, "NEAR Testnet")
		}

		facilitator.Register(nearNetworks, nearfac.NewExactDirectNearScheme(nearSigner, nil))
		log.Printf("NEAR facilitator configured for %d networks", len(nearNetworks))
	} else {
		log.Printf("Warning: NEAR_RPC not set, NEAR chains disabled")
	}

	// Setup Aptos chains - each network gets its own signer instance
	// (the FacilitatorAptosSigner interface doesn't pass network to QueryTransaction/GetBalance,
	// so we register separate signer instances per network for correct RPC routing)
	{
		var aptosCount int
		if cfg.AptosRPC != "" {
			mainnetSigner := newFacilitatorAptosSigner(cfg.AptosRPC, "")
			facilitator.Register([]t402.Network{t402.Network(aptos.AptosMainnetCAIP2)}, aptosfac.NewExactDirectAptosScheme(mainnetSigner, nil))
			configuredNetworks = append(configuredNetworks, "Aptos Mainnet")
			aptosCount++
		}
		if cfg.AptosTestnetRPC != "" {
			testnetSigner := newFacilitatorAptosSigner(cfg.AptosTestnetRPC, "")
			facilitator.Register([]t402.Network{t402.Network(aptos.AptosTestnetCAIP2)}, aptosfac.NewExactDirectAptosScheme(testnetSigner, nil))
			configuredNetworks = append(configuredNetworks, "Aptos Testnet")
			aptosCount++
		}
		if cfg.AptosDevnetRPC != "" {
			devnetSigner := newFacilitatorAptosSigner(cfg.AptosDevnetRPC, "")
			facilitator.Register([]t402.Network{t402.Network(aptos.AptosDevnetCAIP2)}, aptosfac.NewExactDirectAptosScheme(devnetSigner, nil))
			configuredNetworks = append(configuredNetworks, "Aptos Devnet")
			aptosCount++
		}
		if aptosCount > 0 {
			log.Printf("Aptos facilitator configured for %d networks", aptosCount)
		} else {
			log.Printf("Warning: APTOS_RPC not set, Aptos chains disabled")
		}
	}

	// Setup Tezos chains if RPC is configured
	if cfg.TezosRPC != "" {
		tezosSigner := newFacilitatorTezosSigner(cfg.TezosRPC, cfg.TezosTestnetRPC)

		var tezosNetworks []t402.Network

		// Add mainnet
		tezosNetworks = append(tezosNetworks, t402.Network(tezos.TezosMainnetCAIP2))
		configuredNetworks = append(configuredNetworks, "Tezos Mainnet")

		// Add testnet (Ghostnet) if configured
		if cfg.TezosTestnetRPC != "" {
			tezosNetworks = append(tezosNetworks, t402.Network(tezos.TezosGhostnetCAIP2))
			configuredNetworks = append(configuredNetworks, "Tezos Ghostnet")
		}

		facilitator.Register(tezosNetworks, tezosfac.NewExactDirectTezosScheme(tezosSigner, nil))
		log.Printf("Tezos facilitator configured for %d networks", len(tezosNetworks))
	} else {
		log.Printf("Warning: TEZOS_RPC not set, Tezos chains disabled")
	}

	// Setup Polkadot Asset Hub chains - each network gets its own signer instance
	// (the FacilitatorPolkadotSigner interface doesn't pass network to QueryExtrinsic/GetBalance,
	// so we register separate signer instances per network for correct indexer routing)
	{
		var polkadotCount int
		if cfg.PolkadotAssetHubIndexer != "" {
			mainnetSigner := newFacilitatorPolkadotSigner(cfg.PolkadotAssetHubIndexer, "")
			facilitator.Register([]t402.Network{t402.Network(polkadot.PolkadotAssetHubCAIP2)}, polkadotfac.NewExactDirectPolkadotScheme(mainnetSigner, nil))
			configuredNetworks = append(configuredNetworks, "Polkadot Asset Hub")
			polkadotCount++
		}
		if cfg.KusamaAssetHubIndexer != "" {
			kusamaSigner := newFacilitatorPolkadotSigner(cfg.KusamaAssetHubIndexer, "")
			facilitator.Register([]t402.Network{t402.Network(polkadot.KusamaAssetHubCAIP2)}, polkadotfac.NewExactDirectPolkadotScheme(kusamaSigner, nil))
			configuredNetworks = append(configuredNetworks, "Kusama Asset Hub")
			polkadotCount++
		}
		if cfg.WestendAssetHubIndexer != "" {
			westendSigner := newFacilitatorPolkadotSigner(cfg.WestendAssetHubIndexer, "")
			facilitator.Register([]t402.Network{t402.Network(polkadot.WestendAssetHubCAIP2)}, polkadotfac.NewExactDirectPolkadotScheme(westendSigner, nil))
			configuredNetworks = append(configuredNetworks, "Westend Asset Hub")
			polkadotCount++
		}
		if polkadotCount > 0 {
			log.Printf("Polkadot facilitator configured for %d networks", polkadotCount)
		} else {
			log.Printf("Warning: No Polkadot indexers configured, Polkadot chains disabled")
		}
	}

	// Setup Stacks chains if address is configured
	if cfg.StacksAddress != "" {
		stacksSigner := newFacilitatorStacksSigner(cfg)

		var stacksNetworks []t402.Network

		// Add mainnet
		stacksNetworks = append(stacksNetworks, t402.Network(stacks.StacksMainnetCAIP2))
		configuredNetworks = append(configuredNetworks, "Stacks Mainnet")

		// Add testnet if testnet API URL is configured
		if cfg.StacksTestnetAPIURL != "" {
			stacksNetworks = append(stacksNetworks, t402.Network(stacks.StacksTestnetCAIP2))
			configuredNetworks = append(configuredNetworks, "Stacks Testnet")
		}

		facilitator.Register(stacksNetworks, stacksfac.NewExactDirectStacksScheme(stacksSigner, nil))
		log.Printf("Stacks facilitator configured for %d networks (address: %s)", len(stacksNetworks), cfg.StacksAddress)
	} else {
		log.Printf("Warning: STACKS_ADDRESS not set, Stacks chains disabled")
	}

	// Setup Cosmos/Noble chains if address is configured
	if cfg.CosmosMainnetAddress != "" || cfg.CosmosTestnetAddress != "" {
		cosmosSigner := newFacilitatorCosmosSigner(
			cfg.CosmosMainnetREST,
			cfg.CosmosTestnetREST,
			cfg.CosmosMainnetAddress,
			cfg.CosmosTestnetAddress,
		)

		var cosmosNetworks []t402.Network

		// Add mainnet if address configured
		if cfg.CosmosMainnetAddress != "" {
			cosmosNetworks = append(cosmosNetworks, t402.Network(cosmos.NobleMainnetCAIP2))
			configuredNetworks = append(configuredNetworks, "Noble Mainnet")
		}

		// Add testnet if address configured
		if cfg.CosmosTestnetAddress != "" {
			cosmosNetworks = append(cosmosNetworks, t402.Network(cosmos.NobleTestnetCAIP2))
			configuredNetworks = append(configuredNetworks, "Noble Testnet")
		}

		if len(cosmosNetworks) > 0 {
			facilitator.Register(cosmosNetworks, cosmosfac.NewExactDirectCosmosScheme(cosmosSigner, nil))
			log.Printf("Cosmos/Noble facilitator configured for %d networks", len(cosmosNetworks))
		}
	} else {
		log.Printf("Warning: COSMOS_MAINNET_ADDRESS and COSMOS_TESTNET_ADDRESS not set, Cosmos/Noble chains disabled")
	}

	// Register protocol extensions
	facilitator.RegisterExtension("bazaar")
	facilitator.RegisterExtension("siwx")
	log.Printf("Registered extensions: bazaar, siwx")

	// Log configured networks
	if len(configuredNetworks) == 0 {
		return nil, nil, fmt.Errorf("no networks configured - at least one private key is required")
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

	// Build cleanup function that zeroizes all signers holding private keys
	cleanupFn := func() {
		log.Printf("Zeroizing %d signer(s)...", len(zeroizables))
		for _, z := range zeroizables {
			z.Zeroize()
		}
		log.Printf("All signers zeroized")
	}

	return facilitator, cleanupFn, nil
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
	nonceMu    sync.Mutex // Serializes nonce acquisition to prevent race conditions
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

// Zeroize securely clears the private key from memory
// SECURITY: Should be called when the signer is no longer needed (e.g., on shutdown)
func (s *facilitatorEvmSigner) Zeroize() {
	if s.privateKey != nil {
		// SECURITY: Clear the private key's D value (the actual 256-bit secret)
		// Note: big.Int.Bytes() returns a copy, so we must use SetInt64(0) to
		// clear the internal abs slice directly.
		if s.privateKey.D != nil {
			s.privateKey.D.SetInt64(0)
		}
		// SECURITY: Clear public key coordinates (derived from private key)
		if s.privateKey.X != nil {
			s.privateKey.X.SetInt64(0)
		}
		if s.privateKey.Y != nil {
			s.privateKey.Y.SetInt64(0)
		}
		s.privateKey = nil
	}
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
	// Compute EIP-712 hash from the typed data
	hash, err := evmmech.HashTypedData(domain, typesMap, primaryType, message)
	if err != nil {
		return false, fmt.Errorf("failed to hash typed data: %w", err)
	}

	// Verify the signature using ECDSA recovery
	expectedAddress := common.HexToAddress(address)
	return evmmech.VerifyEOASignature(hash, signature, expectedAddress)
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

// defaultGasLimit is used as fallback when gas estimation fails
const defaultGasLimit = uint64(300000)

// gasLimitMultiplier adds a safety margin to estimated gas (20% buffer)
const gasLimitMultiplier = 1.2

// maxGasLimit prevents excessive gas usage
const maxGasLimit = uint64(3000000)

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

	// SECURITY: Serialize nonce acquisition to prevent race conditions
	// under concurrent settlements for the same chain
	s.nonceMu.Lock()
	defer s.nonceMu.Unlock()

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

	// Estimate gas for the transaction
	to := common.HexToAddress(contractAddress)
	gasLimit, err := s.estimateGas(ctx, &to, data)
	if err != nil {
		// Fall back to default gas limit if estimation fails
		log.Printf("Gas estimation failed, using default: %v", err)
		gasLimit = defaultGasLimit
	}

	// Create transaction
	tx := types.NewTransaction(
		nonce,
		to,
		big.NewInt(0), // value
		gasLimit,
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

// estimateGas estimates the gas required for a transaction with a safety buffer
func (s *facilitatorEvmSigner) estimateGas(ctx context.Context, to *common.Address, data []byte) (uint64, error) {
	msg := ethereum.CallMsg{
		From: s.address,
		To:   to,
		Data: data,
	}

	estimatedGas, err := s.client.EstimateGas(ctx, msg)
	if err != nil {
		return 0, fmt.Errorf("failed to estimate gas: %w", err)
	}

	// Add safety buffer (20%)
	gasWithBuffer := uint64(float64(estimatedGas) * gasLimitMultiplier)

	// Cap at max gas limit
	if gasWithBuffer > maxGasLimit {
		gasWithBuffer = maxGasLimit
	}

	// Ensure minimum gas limit
	if gasWithBuffer < defaultGasLimit {
		gasWithBuffer = defaultGasLimit
	}

	return gasWithBuffer, nil
}

func (s *facilitatorEvmSigner) SendTransaction(
	ctx context.Context,
	to string,
	data []byte,
) (string, error) {
	// SECURITY: Serialize nonce acquisition to prevent race conditions
	s.nonceMu.Lock()
	defer s.nonceMu.Unlock()

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

	// Estimate gas for the transaction
	toAddr := common.HexToAddress(to)
	gasLimit, err := s.estimateGas(ctx, &toAddr, data)
	if err != nil {
		// Fall back to default gas limit if estimation fails
		log.Printf("Gas estimation failed, using default: %v", err)
		gasLimit = defaultGasLimit
	}

	// Create transaction with raw data
	tx := types.NewTransaction(
		nonce,
		toAddr,
		big.NewInt(0), // value
		gasLimit,
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

// ============================================================================
// NEAR Facilitator Signer
// ============================================================================

// facilitatorNearSigner implements the FacilitatorNearSigner interface
type facilitatorNearSigner struct {
	mainnetRPC string
	testnetRPC string
}

// newFacilitatorNearSigner creates a new NEAR facilitator signer
func newFacilitatorNearSigner(mainnetRPC, testnetRPC string) *facilitatorNearSigner {
	return &facilitatorNearSigner{
		mainnetRPC: mainnetRPC,
		testnetRPC: testnetRPC,
	}
}

func (s *facilitatorNearSigner) GetAddresses(ctx context.Context, network string) []string {
	// NEAR exact-direct scheme doesn't require a facilitator address
	// The client executes the transfer directly
	return []string{}
}

func (s *facilitatorNearSigner) QueryTransaction(ctx context.Context, txHash string, senderID string) (*near.TransactionResult, error) {
	// Determine RPC endpoint based on sender account
	rpcURL := s.mainnetRPC
	if strings.HasSuffix(senderID, ".testnet") {
		rpcURL = s.testnetRPC
	}

	// Build RPC request
	reqBody := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      "t402",
		"method":  "tx",
		"params":  []interface{}{txHash, senderID},
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Make HTTP request with context propagation
	req, err := http.NewRequestWithContext(ctx, "POST", rpcURL, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to query transaction: %w", err)
	}
	defer resp.Body.Close()

	// Parse response
	var rpcResp struct {
		Result near.TransactionResult `json:"result"`
		Error  *struct {
			Message string `json:"message"`
		} `json:"error"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&rpcResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if rpcResp.Error != nil {
		return nil, fmt.Errorf("RPC error: %s", rpcResp.Error.Message)
	}

	return &rpcResp.Result, nil
}

func (s *facilitatorNearSigner) GetBalance(ctx context.Context, accountID string, tokenContract string) (string, error) {
	// Determine RPC endpoint
	rpcURL := s.mainnetRPC
	if strings.HasSuffix(accountID, ".testnet") || strings.HasSuffix(tokenContract, ".testnet") {
		rpcURL = s.testnetRPC
	}

	// Build ft_balance_of view call
	args := map[string]string{"account_id": accountID}
	argsJSON, _ := json.Marshal(args)
	argsBase64 := base64.StdEncoding.EncodeToString(argsJSON)

	reqBody := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      "t402",
		"method":  "query",
		"params": map[string]interface{}{
			"request_type": "call_function",
			"finality":     "final",
			"account_id":   tokenContract,
			"method_name":  "ft_balance_of",
			"args_base64":  argsBase64,
		},
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return "0", fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", rpcURL, bytes.NewReader(body))
	if err != nil {
		return "0", fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "0", fmt.Errorf("failed to query balance: %w", err)
	}
	defer resp.Body.Close()

	var rpcResp struct {
		Result struct {
			Result []byte `json:"result"`
		} `json:"result"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&rpcResp); err != nil {
		return "0", fmt.Errorf("failed to decode response: %w", err)
	}

	if rpcResp.Error != nil {
		return "0", fmt.Errorf("RPC error: %s", rpcResp.Error.Message)
	}

	// Parse the balance from the result bytes (JSON string)
	balance := strings.Trim(string(rpcResp.Result.Result), "\"")
	return balance, nil
}

// ============================================================================
// Aptos Facilitator Signer
// ============================================================================

// facilitatorAptosSigner implements the FacilitatorAptosSigner interface
type facilitatorAptosSigner struct {
	mainnetRPC string
	testnetRPC string
}

// newFacilitatorAptosSigner creates a new Aptos facilitator signer
func newFacilitatorAptosSigner(mainnetRPC, testnetRPC string) *facilitatorAptosSigner {
	return &facilitatorAptosSigner{
		mainnetRPC: mainnetRPC,
		testnetRPC: testnetRPC,
	}
}

func (s *facilitatorAptosSigner) GetAddresses(ctx context.Context, network string) []string {
	// Aptos exact-direct scheme doesn't require a facilitator address
	// The client executes the transfer directly
	return []string{}
}

func (s *facilitatorAptosSigner) QueryTransaction(ctx context.Context, txHash string) (*aptos.TransactionResult, error) {
	// Determine RPC endpoint based on hash prefix or use mainnet by default
	rpcURL := s.mainnetRPC

	// Build REST API URL for transaction query
	reqURL := fmt.Sprintf("%s/transactions/by_hash/%s", strings.TrimSuffix(rpcURL, "/"), txHash)

	// Make HTTP request with context propagation
	req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to query transaction: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("transaction not found")
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	// Parse response
	var txResult aptos.TransactionResult
	if err := json.NewDecoder(resp.Body).Decode(&txResult); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &txResult, nil
}

func (s *facilitatorAptosSigner) GetBalance(ctx context.Context, address string, metadataAddress string) (string, error) {
	// Determine RPC endpoint
	rpcURL := s.mainnetRPC

	// Build REST API URL for account resource
	// For FA (Fungible Asset) balance, we need to query the primary fungible store
	reqURL := fmt.Sprintf("%s/accounts/%s/resource/0x1::fungible_asset::FungibleStore",
		strings.TrimSuffix(rpcURL, "/"), address)

	req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return "0", fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "0", fmt.Errorf("failed to query balance: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		// Account or resource doesn't exist, balance is 0
		return "0", nil
	}

	if resp.StatusCode != http.StatusOK {
		return "0", fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var resource struct {
		Data struct {
			Balance string `json:"balance"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&resource); err != nil {
		return "0", fmt.Errorf("failed to decode response: %w", err)
	}

	return resource.Data.Balance, nil
}

// ============================================================================
// Tezos Facilitator Signer
// ============================================================================

// facilitatorTezosSigner implements the FacilitatorTezosSigner interface
type facilitatorTezosSigner struct {
	mainnetIndexer string
	testnetIndexer string
}

// newFacilitatorTezosSigner creates a new Tezos facilitator signer
func newFacilitatorTezosSigner(mainnetRPC, testnetRPC string) *facilitatorTezosSigner {
	// Use TzKT indexer URLs based on RPC configuration
	mainnetIndexer := "https://api.tzkt.io"
	testnetIndexer := "https://api.ghostnet.tzkt.io"

	return &facilitatorTezosSigner{
		mainnetIndexer: mainnetIndexer,
		testnetIndexer: testnetIndexer,
	}
}

func (s *facilitatorTezosSigner) GetAddresses(ctx context.Context, network string) []string {
	// Tezos exact-direct scheme doesn't require a facilitator address
	// The client executes the transfer directly
	return []string{}
}

func (s *facilitatorTezosSigner) QueryOperation(ctx context.Context, opHash string) (*tezos.OperationResult, error) {
	// Use mainnet indexer by default
	indexerURL := s.mainnetIndexer

	// Build TzKT API URL for operation query
	reqURL := fmt.Sprintf("%s/v1/operations/transactions/%s", indexerURL, opHash)

	// Make HTTP request with context propagation
	req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to query operation: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("operation not found")
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	// Parse response - TzKT returns an array of operations
	var operations []tezos.OperationResult
	if err := json.NewDecoder(resp.Body).Decode(&operations); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if len(operations) == 0 {
		return nil, fmt.Errorf("operation not found")
	}

	return &operations[0], nil
}

func (s *facilitatorTezosSigner) GetBalance(ctx context.Context, contractAddress string, tokenID int, address string) (string, error) {
	// Use mainnet indexer by default
	indexerURL := s.mainnetIndexer

	// Build TzKT API URL for token balance
	reqURL := fmt.Sprintf("%s/v1/tokens/balances?token.contract=%s&token.tokenId=%d&account=%s",
		indexerURL, contractAddress, tokenID, address)

	req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return "0", fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "0", fmt.Errorf("failed to query balance: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return "0", nil
	}

	if resp.StatusCode != http.StatusOK {
		return "0", fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var balances []struct {
		Balance string `json:"balance"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&balances); err != nil {
		return "0", fmt.Errorf("failed to decode response: %w", err)
	}

	if len(balances) == 0 {
		return "0", nil
	}

	return balances[0].Balance, nil
}

// ============================================================================
// Polkadot Facilitator Signer
// ============================================================================

// facilitatorPolkadotSigner implements the FacilitatorPolkadotSigner interface
type facilitatorPolkadotSigner struct {
	mainnetIndexer string
	testnetIndexer string
}

// newFacilitatorPolkadotSigner creates a new Polkadot facilitator signer
func newFacilitatorPolkadotSigner(mainnetIndexer, testnetIndexer string) *facilitatorPolkadotSigner {
	return &facilitatorPolkadotSigner{
		mainnetIndexer: mainnetIndexer,
		testnetIndexer: testnetIndexer,
	}
}

func (s *facilitatorPolkadotSigner) GetAddresses(ctx context.Context, network string) []string {
	// Polkadot exact-direct scheme doesn't require a facilitator address
	// The client executes the transfer directly
	return []string{}
}

func (s *facilitatorPolkadotSigner) QueryExtrinsic(ctx context.Context, extrinsicHash string, blockHash string, extrinsicIndex int) (*polkadot.ExtrinsicResult, error) {
	// Use mainnet indexer by default
	indexerURL := s.mainnetIndexer

	// Build Subscan API URL for extrinsic query
	url := fmt.Sprintf("%s/api/scan/extrinsic", indexerURL)

	// Build request body
	requestBody := map[string]interface{}{}
	if extrinsicHash != "" {
		requestBody["hash"] = extrinsicHash
	} else if blockHash != "" {
		requestBody["block_hash"] = blockHash
		requestBody["extrinsic_index"] = extrinsicIndex
	} else {
		return nil, fmt.Errorf("either extrinsicHash or blockHash must be provided")
	}

	jsonBody, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Make HTTP request
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to query extrinsic: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var response struct {
		Code    int                      `json:"code"`
		Message string                   `json:"message"`
		Data    *polkadot.ExtrinsicResult `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if response.Code != 0 {
		return nil, fmt.Errorf("Subscan API error: %s", response.Message)
	}

	if response.Data == nil {
		return nil, nil
	}

	return response.Data, nil
}

func (s *facilitatorPolkadotSigner) GetBalance(ctx context.Context, assetID int, address string) (string, error) {
	// Use mainnet indexer by default
	indexerURL := s.mainnetIndexer

	// Build Subscan API URL for asset balance query
	url := fmt.Sprintf("%s/api/scan/account/tokens", indexerURL)

	// Build request body
	requestBody := map[string]interface{}{
		"address": address,
	}

	jsonBody, err := json.Marshal(requestBody)
	if err != nil {
		return "0", fmt.Errorf("failed to marshal request: %w", err)
	}

	// Make HTTP request
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonBody))
	if err != nil {
		return "0", fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "0", fmt.Errorf("failed to query balance: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "0", fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var response struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    struct {
			Assets []struct {
				AssetID int    `json:"asset_id"`
				Balance string `json:"balance"`
			} `json:"assets"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return "0", fmt.Errorf("failed to decode response: %w", err)
	}

	if response.Code != 0 {
		return "0", nil // Account may not exist
	}

	// Find the specific asset
	for _, asset := range response.Data.Assets {
		if asset.AssetID == assetID {
			return asset.Balance, nil
		}
	}

	return "0", nil
}
