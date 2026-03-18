// Package swappay implements atomic token conversion payments.
// Payer sends any ERC-20 token, merchant receives exact stablecoins.
package swappay

// SwapPayPayload is the payment payload for swap+pay transactions.
type SwapPayPayload struct {
	// Input token address (what payer is sending)
	InputToken string `json:"inputToken"`
	// Output token address (what merchant wants, e.g., USDC)
	OutputToken string `json:"outputToken"`
	// Exact amount merchant receives (in outputToken smallest unit)
	OutputAmount string `json:"outputAmount"`
	// Maximum input tokens payer will spend (slippage protection)
	MaxInputAmount string `json:"maxInputAmount"`
	// Uniswap pool fee tier: 500 (0.05%), 3000 (0.3%), 10000 (1%)
	PoolFee uint32 `json:"poolFee"`
	// Payer address
	Payer string `json:"payer"`
	// T402SwapPay contract address
	SwapPayContract string `json:"swapPayContract"`
}

// SwapPayConfig holds deployment addresses.
type SwapPayConfig struct {
	// T402SwapPay contract address per network
	ContractAddresses map[string]string
	// Uniswap V3 SwapRouter address per network
	RouterAddresses map[string]string
}

// DefaultConfig returns known contract addresses.
func DefaultConfig() *SwapPayConfig {
	return &SwapPayConfig{
		ContractAddresses: map[string]string{
			// To be populated after deployment
		},
		RouterAddresses: map[string]string{
			"eip155:1":     "0xE592427A0AEce92De3Edee1F18E0157C05861564", // Ethereum
			"eip155:42161": "0xE592427A0AEce92De3Edee1F18E0157C05861564", // Arbitrum
			"eip155:10":    "0xE592427A0AEce92De3Edee1F18E0157C05861564", // Optimism
			"eip155:137":   "0xE592427A0AEce92De3Edee1F18E0157C05861564", // Polygon
			"eip155:8453":  "0x2626664c2603336E57B271c5C0b26F421741e481", // Base
		},
	}
}

// Well-known pool fee tiers
const (
	PoolFee005  uint32 = 500   // 0.05% - stablecoin pairs
	PoolFee030  uint32 = 3000  // 0.3% - standard pairs
	PoolFee100  uint32 = 10000 // 1.0% - exotic pairs
)
