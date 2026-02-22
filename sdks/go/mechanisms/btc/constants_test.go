package btc

import "testing"

func TestIsBtcNetwork(t *testing.T) {
	tests := []struct {
		network string
		want    bool
	}{
		{BtcMainnetCAIP2, true},
		{BtcTestnetCAIP2, true},
		{"bip122:custom", true},
		{LightningMainnetCAIP2, false},
		{"eip155:1", false},
		{"", false},
	}

	for _, tt := range tests {
		t.Run(tt.network, func(t *testing.T) {
			if got := IsBtcNetwork(tt.network); got != tt.want {
				t.Errorf("IsBtcNetwork(%q) = %v, want %v", tt.network, got, tt.want)
			}
		})
	}
}

func TestIsLightningNetwork(t *testing.T) {
	tests := []struct {
		network string
		want    bool
	}{
		{LightningMainnetCAIP2, true},
		{LightningTestnetCAIP2, true},
		{"lightning:custom", true},
		{BtcMainnetCAIP2, false},
		{"eip155:1", false},
		{"", false},
	}

	for _, tt := range tests {
		t.Run(tt.network, func(t *testing.T) {
			if got := IsLightningNetwork(tt.network); got != tt.want {
				t.Errorf("IsLightningNetwork(%q) = %v, want %v", tt.network, got, tt.want)
			}
		})
	}
}

func TestIsSupportedBtcNetwork(t *testing.T) {
	tests := []struct {
		network string
		want    bool
	}{
		{BtcMainnetCAIP2, true},
		{BtcTestnetCAIP2, true},
		{"bip122:custom", false},
		{LightningMainnetCAIP2, false},
	}

	for _, tt := range tests {
		t.Run(tt.network, func(t *testing.T) {
			if got := IsSupportedBtcNetwork(tt.network); got != tt.want {
				t.Errorf("IsSupportedBtcNetwork(%q) = %v, want %v", tt.network, got, tt.want)
			}
		})
	}
}

func TestIsSupportedLightningNetwork(t *testing.T) {
	tests := []struct {
		network string
		want    bool
	}{
		{LightningMainnetCAIP2, true},
		{LightningTestnetCAIP2, true},
		{"lightning:custom", false},
		{BtcMainnetCAIP2, false},
	}

	for _, tt := range tests {
		t.Run(tt.network, func(t *testing.T) {
			if got := IsSupportedLightningNetwork(tt.network); got != tt.want {
				t.Errorf("IsSupportedLightningNetwork(%q) = %v, want %v", tt.network, got, tt.want)
			}
		})
	}
}

func TestValidateBitcoinAddress(t *testing.T) {
	tests := []struct {
		address string
		want    bool
	}{
		// Mainnet addresses
		{"bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4", true},
		{"1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2", true},
		{"3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy", true},
		// Testnet addresses
		{"tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx", true},
		{"mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn", true},
		{"n1wSKSdrKn43aXQ31hmzqEE8e27jrwMNPY", true},
		{"2MzQwSSnBHWHqSAqtTVQ6v47XtaisrJa1Vc", true},
		// Invalid
		{"", false},
		{"short", false},
		{"invalidaddress", false},
		{"xyznotreal123456", false},
	}

	for _, tt := range tests {
		t.Run(tt.address, func(t *testing.T) {
			if got := ValidateBitcoinAddress(tt.address); got != tt.want {
				t.Errorf("ValidateBitcoinAddress(%q) = %v, want %v", tt.address, got, tt.want)
			}
		})
	}
}

func TestIsMainnetAddress(t *testing.T) {
	if !IsMainnetAddress("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4") {
		t.Error("bc1 address should be mainnet")
	}
	if !IsMainnetAddress("1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2") {
		t.Error("1-prefix address should be mainnet")
	}
	if IsMainnetAddress("tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx") {
		t.Error("tb1 address should not be mainnet")
	}
}

func TestIsTestnetAddress(t *testing.T) {
	if !IsTestnetAddress("tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx") {
		t.Error("tb1 address should be testnet")
	}
	if !IsTestnetAddress("mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn") {
		t.Error("m-prefix address should be testnet")
	}
	if IsTestnetAddress("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4") {
		t.Error("bc1 address should not be testnet")
	}
}

func TestValidateBolt11Invoice(t *testing.T) {
	tests := []struct {
		invoice string
		want    bool
	}{
		{"lnbc1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq", true},
		{"lntb1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq", true},
		{"lnbcrt1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq", true},
		{"LNBC1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq", true}, // uppercase
		{"", false},
		{"short", false},
		{"invalid_long_string_that_is_not_an_invoice", false},
	}

	for _, tt := range tests {
		t.Run(tt.invoice[:min(len(tt.invoice), 20)], func(t *testing.T) {
			if got := ValidateBolt11Invoice(tt.invoice); got != tt.want {
				t.Errorf("ValidateBolt11Invoice() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestIsValidHex(t *testing.T) {
	tests := []struct {
		hex        string
		byteLen    int
		want       bool
	}{
		{"abcdef0123456789", 8, true},
		{"ABCDEF0123456789", 8, true},
		{"0000000000000000000000000000000000000000000000000000000000000000", 32, true},
		{"abc", 0, true},  // no length check
		{"abc", 2, false}, // wrong length
		{"xyz", 0, false}, // invalid chars
		{"", 0, false},
	}

	for _, tt := range tests {
		t.Run(tt.hex, func(t *testing.T) {
			if got := IsValidHex(tt.hex, tt.byteLen); got != tt.want {
				t.Errorf("IsValidHex(%q, %d) = %v, want %v", tt.hex, tt.byteLen, got, tt.want)
			}
		})
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
