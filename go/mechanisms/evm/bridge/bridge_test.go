package bridge

import (
	"math/big"
	"testing"
)

func TestGetEndpointID(t *testing.T) {
	tests := []struct {
		chain    string
		expected uint32
		found    bool
	}{
		{"ethereum", 30101, true},
		{"arbitrum", 30110, true},
		{"ink", 30291, true},
		{"berachain", 30362, true},
		{"unichain", 30320, true},
		{"Ethereum", 30101, true}, // Case insensitive
		{"ARBITRUM", 30110, true}, // Case insensitive
		{"unknown", 0, false},
	}

	for _, tt := range tests {
		t.Run(tt.chain, func(t *testing.T) {
			eid, found := GetEndpointID(tt.chain)
			if found != tt.found {
				t.Errorf("GetEndpointID(%s) found = %v, want %v", tt.chain, found, tt.found)
			}
			if found && eid != tt.expected {
				t.Errorf("GetEndpointID(%s) = %d, want %d", tt.chain, eid, tt.expected)
			}
		})
	}
}

func TestGetUSDT0OFTAddress(t *testing.T) {
	tests := []struct {
		chain    string
		expected string
		found    bool
	}{
		{"ethereum", "0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee", true},
		{"arbitrum", "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", true},
		{"ink", "0x0200C29006150606B650577BBE7B6248F58470c1", true},
		{"berachain", "0x779Ded0c9e1022225f8E0630b35a9b54bE713736", true},
		{"unichain", "0x588ce4F028D8e7B53B687865d6A67b3A54C75518", true},
		{"unknown", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.chain, func(t *testing.T) {
			addr, found := GetUSDT0OFTAddress(tt.chain)
			if found != tt.found {
				t.Errorf("GetUSDT0OFTAddress(%s) found = %v, want %v", tt.chain, found, tt.found)
			}
			if found && addr != tt.expected {
				t.Errorf("GetUSDT0OFTAddress(%s) = %s, want %s", tt.chain, addr, tt.expected)
			}
		})
	}
}

func TestSupportsBridging(t *testing.T) {
	tests := []struct {
		chain    string
		expected bool
	}{
		{"ethereum", true},
		{"arbitrum", true},
		{"ink", true},
		{"berachain", true},
		{"unichain", true},
		{"Ethereum", true}, // Case insensitive
		{"unknown", false},
		{"base", false},
	}

	for _, tt := range tests {
		t.Run(tt.chain, func(t *testing.T) {
			result := SupportsBridging(tt.chain)
			if result != tt.expected {
				t.Errorf("SupportsBridging(%s) = %v, want %v", tt.chain, result, tt.expected)
			}
		})
	}
}

func TestGetBridgeableChains(t *testing.T) {
	chains := GetBridgeableChains()

	if len(chains) != 5 {
		t.Errorf("GetBridgeableChains() returned %d chains, want 5", len(chains))
	}

	// Check all expected chains are present
	expected := map[string]bool{
		"ethereum":  false,
		"arbitrum":  false,
		"ink":       false,
		"berachain": false,
		"unichain":  false,
	}

	for _, chain := range chains {
		if _, ok := expected[chain]; ok {
			expected[chain] = true
		}
	}

	for chain, found := range expected {
		if !found {
			t.Errorf("GetBridgeableChains() missing chain: %s", chain)
		}
	}
}

func TestAddressToBytes32(t *testing.T) {
	tests := []struct {
		name     string
		address  string
		wantErr  bool
	}{
		{
			name:    "valid address with 0x",
			address: "0x1234567890123456789012345678901234567890",
			wantErr: false,
		},
		{
			name:    "valid address without 0x",
			address: "1234567890123456789012345678901234567890",
			wantErr: false,
		},
		{
			name:    "invalid hex",
			address: "0xGGGG",
			wantErr: true,
		},
		{
			name:    "wrong length",
			address: "0x1234",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := AddressToBytes32(tt.address)
			if (err != nil) != tt.wantErr {
				t.Errorf("AddressToBytes32() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestBytes32ToAddress(t *testing.T) {
	// Create a bytes32 with an address in the last 20 bytes
	var b [32]byte
	// Set last 20 bytes to represent 0x1234...
	b[12] = 0x12
	b[13] = 0x34
	b[14] = 0x56
	b[15] = 0x78
	// ... rest zeros

	result := Bytes32ToAddress(b)

	if len(result) != 42 { // 0x + 40 hex chars
		t.Errorf("Bytes32ToAddress() returned %d chars, want 42", len(result))
	}

	if result[:2] != "0x" {
		t.Errorf("Bytes32ToAddress() should start with 0x, got %s", result[:2])
	}
}

func TestAddressRoundTrip(t *testing.T) {
	address := "0x1234567890abcdef1234567890ABCDEF12345678"

	b, err := AddressToBytes32(address)
	if err != nil {
		t.Fatalf("AddressToBytes32() error = %v", err)
	}

	result := Bytes32ToAddress(b)

	// Compare lowercase
	if result != "0x1234567890abcdef1234567890abcdef12345678" {
		t.Errorf("Round trip failed: got %s, want %s", result, address)
	}
}

func TestLayerZeroMessageStatus(t *testing.T) {
	tests := []struct {
		status   LayerZeroMessageStatus
		expected string
	}{
		{LayerZeroStatusInflight, "INFLIGHT"},
		{LayerZeroStatusConfirming, "CONFIRMING"},
		{LayerZeroStatusDelivered, "DELIVERED"},
		{LayerZeroStatusFailed, "FAILED"},
		{LayerZeroStatusBlocked, "BLOCKED"},
	}

	for _, tt := range tests {
		t.Run(tt.expected, func(t *testing.T) {
			if string(tt.status) != tt.expected {
				t.Errorf("LayerZeroMessageStatus = %s, want %s", tt.status, tt.expected)
			}
		})
	}
}

func TestMapAPIResponse(t *testing.T) {
	data := map[string]interface{}{
		"guid":           "0x1234",
		"srcEid":         float64(30101),
		"dstEid":         float64(30110),
		"srcUaAddress":   "0xabc",
		"dstUaAddress":   "0xdef",
		"srcTxHash":      "0xtx1",
		"dstTxHash":      "0xtx2",
		"status":         "DELIVERED",
		"srcBlockNumber": float64(12345),
		"dstBlockNumber": float64(67890),
		"created":        "2024-01-01T00:00:00Z",
		"updated":        "2024-01-01T01:00:00Z",
	}

	msg := mapAPIResponse(data)

	if msg.GUID != "0x1234" {
		t.Errorf("GUID = %s, want 0x1234", msg.GUID)
	}
	if msg.SrcEid != 30101 {
		t.Errorf("SrcEid = %d, want 30101", msg.SrcEid)
	}
	if msg.DstEid != 30110 {
		t.Errorf("DstEid = %d, want 30110", msg.DstEid)
	}
	if msg.Status != LayerZeroStatusDelivered {
		t.Errorf("Status = %s, want DELIVERED", msg.Status)
	}
}

func TestMapAPIResponseAlternativeFields(t *testing.T) {
	// Test alternative field names
	data := map[string]interface{}{
		"messageGuid": "0x5678",
		"srcChainId":  float64(30101),
		"dstChainId":  float64(30110),
		"srcAddress":  "0xabc",
		"dstAddress":  "0xdef",
		"createdAt":   "2024-01-01T00:00:00Z",
		"updatedAt":   "2024-01-01T01:00:00Z",
	}

	msg := mapAPIResponse(data)

	if msg.GUID != "0x5678" {
		t.Errorf("GUID = %s, want 0x5678", msg.GUID)
	}
	if msg.SrcEid != 30101 {
		t.Errorf("SrcEid = %d, want 30101", msg.SrcEid)
	}
	if msg.SrcUaAddress != "0xabc" {
		t.Errorf("SrcUaAddress = %s, want 0xabc", msg.SrcUaAddress)
	}
}

func TestParseMessagingFee(t *testing.T) {
	// Test with MessagingFee struct
	fee1 := &MessagingFee{
		NativeFee:  big.NewInt(1000),
		LzTokenFee: big.NewInt(0),
	}

	result, err := parseMessagingFee(fee1)
	if err != nil {
		t.Errorf("parseMessagingFee() error = %v", err)
	}
	if result.NativeFee.Cmp(big.NewInt(1000)) != 0 {
		t.Errorf("NativeFee = %s, want 1000", result.NativeFee.String())
	}

	// Test with map
	feeMap := map[string]interface{}{
		"nativeFee":  big.NewInt(2000),
		"lzTokenFee": big.NewInt(100),
	}

	result2, err := parseMessagingFee(feeMap)
	if err != nil {
		t.Errorf("parseMessagingFee(map) error = %v", err)
	}
	if result2.NativeFee.Cmp(big.NewInt(2000)) != 0 {
		t.Errorf("NativeFee from map = %s, want 2000", result2.NativeFee.String())
	}
}

func TestExtractMessageGUID(t *testing.T) {
	// Test successful extraction
	receipt := &BridgeTransactionReceipt{
		Status:          1,
		TransactionHash: "0xabc",
		Logs: []TransactionLog{
			{
				Address: "0x123",
				Topics: []string{
					OFTSentEventTopic,
					"0xguid123",
				},
				Data: "0x",
			},
		},
	}

	guid, err := extractMessageGUID(receipt)
	if err != nil {
		t.Errorf("extractMessageGUID() error = %v", err)
	}
	if guid != "0xguid123" {
		t.Errorf("extractMessageGUID() = %s, want 0xguid123", guid)
	}

	// Test missing event
	receipt2 := &BridgeTransactionReceipt{
		Status:          1,
		TransactionHash: "0xabc",
		Logs:            []TransactionLog{},
	}

	_, err = extractMessageGUID(receipt2)
	if err == nil {
		t.Error("extractMessageGUID() expected error for missing event")
	}
}

func TestNetworkMappings(t *testing.T) {
	// Test NetworkToChain
	if chain, ok := NetworkToChain["eip155:1"]; !ok || chain != "ethereum" {
		t.Errorf("NetworkToChain[eip155:1] = %s, want ethereum", chain)
	}

	if chain, ok := NetworkToChain["eip155:42161"]; !ok || chain != "arbitrum" {
		t.Errorf("NetworkToChain[eip155:42161] = %s, want arbitrum", chain)
	}

	// Test ChainToNetwork
	if network, ok := ChainToNetwork["ethereum"]; !ok || network != "eip155:1" {
		t.Errorf("ChainToNetwork[ethereum] = %s, want eip155:1", network)
	}

	if network, ok := ChainToNetwork["arbitrum"]; !ok || network != "eip155:42161" {
		t.Errorf("ChainToNetwork[arbitrum] = %s, want eip155:42161", network)
	}
}

func TestGetEndpointIDFromNetwork(t *testing.T) {
	tests := []struct {
		network  string
		expected uint32
		found    bool
	}{
		{"eip155:1", 30101, true},
		{"eip155:42161", 30110, true},
		{"eip155:57073", 30291, true},
		{"unknown", 0, false},
	}

	for _, tt := range tests {
		t.Run(tt.network, func(t *testing.T) {
			eid, found := GetEndpointIDFromNetwork(tt.network)
			if found != tt.found {
				t.Errorf("GetEndpointIDFromNetwork(%s) found = %v, want %v", tt.network, found, tt.found)
			}
			if found && eid != tt.expected {
				t.Errorf("GetEndpointIDFromNetwork(%s) = %d, want %d", tt.network, eid, tt.expected)
			}
		})
	}
}
