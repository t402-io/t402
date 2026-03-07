package stellar

import (
	"testing"
)

func TestNetworkConstants(t *testing.T) {
	if StellarPubnetCAIP2 != "stellar:pubnet" {
		t.Errorf("StellarPubnetCAIP2 = %v, want stellar:pubnet", StellarPubnetCAIP2)
	}
	if StellarTestnetCAIP2 != "stellar:testnet" {
		t.Errorf("StellarTestnetCAIP2 = %v, want stellar:testnet", StellarTestnetCAIP2)
	}
}

func TestNetworkPassphrases(t *testing.T) {
	if PubnetPassphrase != "Public Global Stellar Network ; September 2015" {
		t.Errorf("PubnetPassphrase = %v, want expected passphrase", PubnetPassphrase)
	}
	if TestnetPassphrase != "Test SDF Network ; September 2015" {
		t.Errorf("TestnetPassphrase = %v, want expected passphrase", TestnetPassphrase)
	}
}

func TestTokenAddresses(t *testing.T) {
	if USDCPubnetAddress != "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI" {
		t.Errorf("USDCPubnetAddress = %v, want expected address", USDCPubnetAddress)
	}
	if USDCTestnetAddress != "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA" {
		t.Errorf("USDCTestnetAddress = %v, want expected address", USDCTestnetAddress)
	}
}

func TestDefaultDecimals(t *testing.T) {
	if DefaultDecimals != 7 {
		t.Errorf("DefaultDecimals = %v, want 7", DefaultDecimals)
	}
}

func TestTimingConstants(t *testing.T) {
	if DefaultTimeoutSeconds != 60 {
		t.Errorf("DefaultTimeoutSeconds = %v, want 60", DefaultTimeoutSeconds)
	}
	if LedgerTimeSeconds != 5 {
		t.Errorf("LedgerTimeSeconds = %v, want 5", LedgerTimeSeconds)
	}
}

func TestSchemeExact(t *testing.T) {
	if SchemeExact != "exact" {
		t.Errorf("SchemeExact = %v, want exact", SchemeExact)
	}
}

func TestNetworkConfigs(t *testing.T) {
	tests := []struct {
		name              string
		caip2             string
		expectName        string
		expectPassphrase  string
		expectAssetSymbol string
	}{
		{
			name:              "pubnet config exists",
			caip2:             StellarPubnetCAIP2,
			expectName:        "Stellar Pubnet",
			expectPassphrase:  PubnetPassphrase,
			expectAssetSymbol: "USDC",
		},
		{
			name:              "testnet config exists",
			caip2:             StellarTestnetCAIP2,
			expectName:        "Stellar Testnet",
			expectPassphrase:  TestnetPassphrase,
			expectAssetSymbol: "USDC",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config, ok := NetworkConfigs[tt.caip2]
			if !ok {
				t.Fatalf("NetworkConfigs[%s] not found", tt.caip2)
			}
			if config.Name != tt.expectName {
				t.Errorf("Name = %v, want %v", config.Name, tt.expectName)
			}
			if config.CAIP2 != tt.caip2 {
				t.Errorf("CAIP2 = %v, want %v", config.CAIP2, tt.caip2)
			}
			if config.NetworkPassphrase != tt.expectPassphrase {
				t.Errorf("NetworkPassphrase = %v, want %v", config.NetworkPassphrase, tt.expectPassphrase)
			}
			if config.DefaultAsset.Symbol != tt.expectAssetSymbol {
				t.Errorf("DefaultAsset.Symbol = %v, want %v", config.DefaultAsset.Symbol, tt.expectAssetSymbol)
			}
			if config.HorizonURL == "" {
				t.Error("HorizonURL should not be empty")
			}
			if config.SorobanRPCURL == "" {
				t.Error("SorobanRPCURL should not be empty")
			}
		})
	}
}

func TestNetworkConfigs_SupportedAssets(t *testing.T) {
	for caip2, config := range NetworkConfigs {
		t.Run(caip2, func(t *testing.T) {
			usdc, ok := config.SupportedAssets["USDC"]
			if !ok {
				t.Fatal("USDC not found in SupportedAssets")
			}
			if usdc.Symbol != "USDC" {
				t.Errorf("USDC.Symbol = %v, want USDC", usdc.Symbol)
			}
			if usdc.Decimals != DefaultDecimals {
				t.Errorf("USDC.Decimals = %v, want %v", usdc.Decimals, DefaultDecimals)
			}
			if usdc.ContractAddress == "" {
				t.Error("USDC.ContractAddress should not be empty")
			}
		})
	}
}
