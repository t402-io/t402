package main

import (
	"testing"

	"github.com/t402-io/t402/sdks/go/mechanisms/stacks"
	"github.com/t402-io/t402/services/facilitator/internal/config"
)

func TestNewFacilitatorStacksSigner(t *testing.T) {
	tests := []struct {
		name    string
		cfg     *config.Config
		wantLen int // expected number of address entries
	}{
		{
			name: "with address",
			cfg: &config.Config{
				StacksAddress:       "SP000000000000000000002Q6VF78",
				StacksAPIURL:        "https://api.mainnet.hiro.so",
				StacksTestnetAPIURL: "https://api.testnet.hiro.so",
			},
			wantLen: 2, // mainnet + testnet
		},
		{
			name: "without address",
			cfg: &config.Config{
				StacksAPIURL:        "https://api.mainnet.hiro.so",
				StacksTestnetAPIURL: "https://api.testnet.hiro.so",
			},
			wantLen: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			signer := newFacilitatorStacksSigner(tt.cfg)
			if signer == nil {
				t.Fatal("Expected non-nil signer")
			}

			if len(signer.addresses) != tt.wantLen {
				t.Errorf("Got %d address entries, want %d", len(signer.addresses), tt.wantLen)
			}

			if signer.client == nil {
				t.Error("Expected non-nil HTTP client")
			}
		})
	}
}

func TestFacilitatorStacksSignerGetAddresses(t *testing.T) {
	cfg := &config.Config{
		StacksAddress:       "SP000000000000000000002Q6VF78",
		StacksAPIURL:        "https://api.mainnet.hiro.so",
		StacksTestnetAPIURL: "https://api.testnet.hiro.so",
	}

	signer := newFacilitatorStacksSigner(cfg)

	// Test mainnet
	mainnetAddrs := signer.GetAddresses(stacks.StacksMainnetCAIP2)
	if len(mainnetAddrs) != 1 {
		t.Errorf("Expected 1 mainnet address, got %d", len(mainnetAddrs))
	}
	if len(mainnetAddrs) > 0 && mainnetAddrs[0] != cfg.StacksAddress {
		t.Errorf("Expected address %s, got %s", cfg.StacksAddress, mainnetAddrs[0])
	}

	// Test testnet
	testnetAddrs := signer.GetAddresses(stacks.StacksTestnetCAIP2)
	if len(testnetAddrs) != 1 {
		t.Errorf("Expected 1 testnet address, got %d", len(testnetAddrs))
	}

	// Test unknown network
	unknownAddrs := signer.GetAddresses("unknown:network")
	if len(unknownAddrs) != 0 {
		t.Errorf("Expected 0 addresses for unknown network, got %d", len(unknownAddrs))
	}
}
