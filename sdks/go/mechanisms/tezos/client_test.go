package tezos

import (
	"context"
	"fmt"
	"math/big"
	"testing"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/types"
)

// mockClientTezosSigner implements ClientTezosSigner for testing
type mockClientTezosSigner struct {
	address       string
	balance       string
	balanceErr    error
	opHash        string
	transferErr   error
	lastContract  string
	lastTokenID   int
	lastTo        string
	lastAmount    *big.Int
	lastNetwork   t402.Network
	transferCalls int
}

func (m *mockClientTezosSigner) Address() string {
	return m.address
}

func (m *mockClientTezosSigner) GetBalance(ctx context.Context, contractAddress string, tokenID int) (string, error) {
	return m.balance, m.balanceErr
}

func (m *mockClientTezosSigner) Transfer(ctx context.Context, contractAddress string, tokenID int, to string, amount *big.Int, network t402.Network) (string, error) {
	m.transferCalls++
	m.lastContract = contractAddress
	m.lastTokenID = tokenID
	m.lastTo = to
	m.lastAmount = amount
	m.lastNetwork = network
	return m.opHash, m.transferErr
}

func TestExactDirectTezosClient_Scheme(t *testing.T) {
	signer := &mockClientTezosSigner{address: "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb"}
	client := NewExactDirectTezosClient(signer)

	if client.Scheme() != "exact-direct" {
		t.Errorf("expected scheme 'exact-direct', got '%s'", client.Scheme())
	}
}

func TestExactDirectTezosClient_CreatePaymentPayload(t *testing.T) {
	tests := []struct {
		name         string
		signer       *mockClientTezosSigner
		requirements types.PaymentRequirements
		wantErr      bool
		errContains  string
		validate     func(t *testing.T, payload types.PaymentPayload, signer *mockClientTezosSigner)
	}{
		{
			name: "successful transfer with CAIP-19 asset",
			signer: &mockClientTezosSigner{
				address: "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
				balance: "5000000",
				opHash:  "oo7TSyLzXuiMxZjGp5Z4P4VBUXuc6MNr8PhJNcLX8yY1jyMhMNH",
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "tezos:NetXdQprcVkpaWU",
				Asset:   "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0",
				Amount:  "1000000",
				PayTo:   "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m",
			},
			wantErr: false,
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockClientTezosSigner) {
				if payload.T402Version != 2 {
					t.Errorf("expected t402Version 2, got %d", payload.T402Version)
				}
				if payload.Payload == nil {
					t.Fatal("expected non-nil payload")
				}
				if payload.Payload["opHash"] != "oo7TSyLzXuiMxZjGp5Z4P4VBUXuc6MNr8PhJNcLX8yY1jyMhMNH" {
					t.Errorf("expected opHash, got %v", payload.Payload["opHash"])
				}
				if payload.Payload["from"] != "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb" {
					t.Errorf("expected from address, got %v", payload.Payload["from"])
				}
				if payload.Payload["to"] != "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m" {
					t.Errorf("expected to address, got %v", payload.Payload["to"])
				}
				if payload.Payload["amount"] != "1000000" {
					t.Errorf("expected amount '1000000', got %v", payload.Payload["amount"])
				}
				if payload.Payload["contractAddress"] != "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o" {
					t.Errorf("expected contract address, got %v", payload.Payload["contractAddress"])
				}
				if payload.Payload["tokenId"] != 0 {
					t.Errorf("expected tokenId 0, got %v", payload.Payload["tokenId"])
				}

				// Verify signer was called correctly
				if signer.lastContract != "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o" {
					t.Errorf("expected contract KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o, got %s", signer.lastContract)
				}
				if signer.lastTokenID != 0 {
					t.Errorf("expected tokenID 0, got %d", signer.lastTokenID)
				}
				if signer.lastTo != "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m" {
					t.Errorf("expected to tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m, got %s", signer.lastTo)
				}
				expectedAmount := big.NewInt(1000000)
				if signer.lastAmount.Cmp(expectedAmount) != 0 {
					t.Errorf("expected amount %s, got %s", expectedAmount, signer.lastAmount)
				}
			},
		},
		{
			name: "successful transfer with simple asset format",
			signer: &mockClientTezosSigner{
				address: "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
				balance: "10000000",
				opHash:  "oo7TSyLzXuiMxZjGp5Z4P4VBUXuc6MNr8PhJNcLX8yY1jyMhMNH",
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "tezos:NetXdQprcVkpaWU",
				Asset:   "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0",
				Amount:  "2000000",
				PayTo:   "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
			},
			wantErr: false,
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockClientTezosSigner) {
				if payload.Payload["contractAddress"] != "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o" {
					t.Errorf("expected contract address, got %v", payload.Payload["contractAddress"])
				}
				if payload.Payload["tokenId"] != 0 {
					t.Errorf("expected tokenId 0, got %v", payload.Payload["tokenId"])
				}
			},
		},
		{
			name: "successful transfer with KT1-only asset format",
			signer: &mockClientTezosSigner{
				address: "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
				balance: "5000000",
				opHash:  "oo7TSyLzXuiMxZjGp5Z4P4VBUXuc6MNr8PhJNcLX8yY1jyMhMNH",
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "tezos:NetXdQprcVkpaWU",
				Asset:   "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o",
				Amount:  "500000",
				PayTo:   "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m",
			},
			wantErr: false,
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockClientTezosSigner) {
				if signer.lastTokenID != 0 {
					t.Errorf("expected default tokenID 0, got %d", signer.lastTokenID)
				}
			},
		},
		{
			name: "wrong scheme",
			signer: &mockClientTezosSigner{
				address: "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
				balance: "5000000",
			},
			requirements: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "tezos:NetXdQprcVkpaWU",
				Asset:   "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0",
				Amount:  "1000000",
				PayTo:   "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m",
			},
			wantErr:     true,
			errContains: "invalid scheme",
		},
		{
			name: "non-Tezos network",
			signer: &mockClientTezosSigner{
				address: "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
				balance: "5000000",
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "eip155:1",
				Asset:   "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0",
				Amount:  "1000000",
				PayTo:   "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m",
			},
			wantErr:     true,
			errContains: "invalid network",
		},
		{
			name: "invalid payTo address",
			signer: &mockClientTezosSigner{
				address: "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
				balance: "5000000",
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "tezos:NetXdQprcVkpaWU",
				Asset:   "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0",
				Amount:  "1000000",
				PayTo:   "invalid-address",
			},
			wantErr:     true,
			errContains: "invalid payTo address",
		},
		{
			name: "zero amount",
			signer: &mockClientTezosSigner{
				address: "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
				balance: "5000000",
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "tezos:NetXdQprcVkpaWU",
				Asset:   "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0",
				Amount:  "0",
				PayTo:   "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m",
			},
			wantErr:     true,
			errContains: "invalid amount",
		},
		{
			name: "negative amount",
			signer: &mockClientTezosSigner{
				address: "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
				balance: "5000000",
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "tezos:NetXdQprcVkpaWU",
				Asset:   "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0",
				Amount:  "-1000000",
				PayTo:   "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m",
			},
			wantErr:     true,
			errContains: "invalid amount",
		},
		{
			name: "non-numeric amount",
			signer: &mockClientTezosSigner{
				address: "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
				balance: "5000000",
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "tezos:NetXdQprcVkpaWU",
				Asset:   "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0",
				Amount:  "not-a-number",
				PayTo:   "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m",
			},
			wantErr:     true,
			errContains: "invalid amount",
		},
		{
			name: "empty asset",
			signer: &mockClientTezosSigner{
				address: "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
				balance: "5000000",
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "tezos:NetXdQprcVkpaWU",
				Asset:   "",
				Amount:  "1000000",
				PayTo:   "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m",
			},
			wantErr:     true,
			errContains: "asset is required",
		},
		{
			name: "invalid asset format",
			signer: &mockClientTezosSigner{
				address: "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
				balance: "5000000",
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "tezos:NetXdQprcVkpaWU",
				Asset:   "invalid-asset-format",
				Amount:  "1000000",
				PayTo:   "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m",
			},
			wantErr:     true,
			errContains: "invalid asset",
		},
		{
			name: "insufficient balance",
			signer: &mockClientTezosSigner{
				address: "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
				balance: "500000", // Less than required 1000000
				opHash:  "oo7TSyLzXuiMxZjGp5Z4P4VBUXuc6MNr8PhJNcLX8yY1jyMhMNH",
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "tezos:NetXdQprcVkpaWU",
				Asset:   "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0",
				Amount:  "1000000",
				PayTo:   "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m",
			},
			wantErr:     true,
			errContains: "insufficient balance",
		},
		{
			name: "balance query error",
			signer: &mockClientTezosSigner{
				address:    "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
				balanceErr: fmt.Errorf("RPC connection failed"),
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "tezos:NetXdQprcVkpaWU",
				Asset:   "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0",
				Amount:  "1000000",
				PayTo:   "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m",
			},
			wantErr:     true,
			errContains: "failed to get balance",
		},
		{
			name: "transfer execution error",
			signer: &mockClientTezosSigner{
				address:     "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
				balance:     "5000000",
				transferErr: fmt.Errorf("gas estimation failed"),
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "tezos:NetXdQprcVkpaWU",
				Asset:   "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0",
				Amount:  "1000000",
				PayTo:   "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m",
			},
			wantErr:     true,
			errContains: "failed to execute transfer",
		},
		{
			name: "ghostnet network",
			signer: &mockClientTezosSigner{
				address: "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
				balance: "5000000",
				opHash:  "oo7TSyLzXuiMxZjGp5Z4P4VBUXuc6MNr8PhJNcLX8yY1jyMhMNH",
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "tezos:NetXnHfVqm9iesp",
				Asset:   "tezos:NetXnHfVqm9iesp/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0",
				Amount:  "1000000",
				PayTo:   "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m",
			},
			wantErr: false,
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockClientTezosSigner) {
				if string(signer.lastNetwork) != "tezos:NetXnHfVqm9iesp" {
					t.Errorf("expected ghostnet network, got %s", signer.lastNetwork)
				}
			},
		},
		{
			name: "exact balance equal to amount",
			signer: &mockClientTezosSigner{
				address: "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
				balance: "1000000", // Exactly equal to required amount
				opHash:  "oo7TSyLzXuiMxZjGp5Z4P4VBUXuc6MNr8PhJNcLX8yY1jyMhMNH",
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "tezos:NetXdQprcVkpaWU",
				Asset:   "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0",
				Amount:  "1000000",
				PayTo:   "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m",
			},
			wantErr: false,
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockClientTezosSigner) {
				if payload.Payload["opHash"] != "oo7TSyLzXuiMxZjGp5Z4P4VBUXuc6MNr8PhJNcLX8yY1jyMhMNH" {
					t.Errorf("expected opHash, got %v", payload.Payload["opHash"])
				}
			},
		},
		{
			name: "non-zero token ID",
			signer: &mockClientTezosSigner{
				address: "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
				balance: "5000000",
				opHash:  "oo7TSyLzXuiMxZjGp5Z4P4VBUXuc6MNr8PhJNcLX8yY1jyMhMNH",
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "tezos:NetXdQprcVkpaWU",
				Asset:   "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/5",
				Amount:  "1000000",
				PayTo:   "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m",
			},
			wantErr: false,
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockClientTezosSigner) {
				if signer.lastTokenID != 5 {
					t.Errorf("expected tokenID 5, got %d", signer.lastTokenID)
				}
				if payload.Payload["tokenId"] != 5 {
					t.Errorf("expected tokenId 5 in payload, got %v", payload.Payload["tokenId"])
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := NewExactDirectTezosClient(tt.signer)

			payload, err := client.CreatePaymentPayload(context.Background(), tt.requirements)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				if tt.errContains != "" && !contains(err.Error(), tt.errContains) {
					t.Errorf("expected error containing '%s', got '%s'", tt.errContains, err.Error())
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if tt.validate != nil {
				tt.validate(t, payload, tt.signer)
			}
		})
	}
}

func TestExactDirectTezosClient_TransferCallCount(t *testing.T) {
	signer := &mockClientTezosSigner{
		address: "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
		balance: "5000000",
		opHash:  "oo7TSyLzXuiMxZjGp5Z4P4VBUXuc6MNr8PhJNcLX8yY1jyMhMNH",
	}
	client := NewExactDirectTezosClient(signer)

	requirements := types.PaymentRequirements{
		Scheme:  "exact-direct",
		Network: "tezos:NetXdQprcVkpaWU",
		Asset:   "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0",
		Amount:  "1000000",
		PayTo:   "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m",
	}

	_, err := client.CreatePaymentPayload(context.Background(), requirements)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if signer.transferCalls != 1 {
		t.Errorf("expected 1 transfer call, got %d", signer.transferCalls)
	}
}

func TestParseAssetIdentifier(t *testing.T) {
	tests := []struct {
		name            string
		asset           string
		wantErr         bool
		wantContract    string
		wantTokenID     int
	}{
		{
			name:         "CAIP-19 format mainnet USDt",
			asset:        "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0",
			wantErr:      false,
			wantContract: "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o",
			wantTokenID:  0,
		},
		{
			name:         "CAIP-19 format ghostnet",
			asset:        "tezos:NetXnHfVqm9iesp/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/3",
			wantErr:      false,
			wantContract: "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o",
			wantTokenID:  3,
		},
		{
			name:         "simple format with token ID",
			asset:        "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0",
			wantErr:      false,
			wantContract: "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o",
			wantTokenID:  0,
		},
		{
			name:         "simple format with non-zero token ID",
			asset:        "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/7",
			wantErr:      false,
			wantContract: "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o",
			wantTokenID:  7,
		},
		{
			name:         "simple format without token ID defaults to 0",
			asset:        "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o",
			wantErr:      false,
			wantContract: "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o",
			wantTokenID:  0,
		},
		{
			name:    "empty string",
			asset:   "",
			wantErr: true,
		},
		{
			name:    "invalid format",
			asset:   "invalid-asset",
			wantErr: true,
		},
		{
			name:    "Ethereum address",
			asset:   "0x1234567890123456789012345678901234567890",
			wantErr: true,
		},
		{
			name:    "CAIP-19 wrong namespace",
			asset:   "eip155:1/erc20:0x1234567890123456789012345678901234567890",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ParseAssetIdentifier(tt.asset)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if result.ContractAddress != tt.wantContract {
				t.Errorf("expected contract %s, got %s", tt.wantContract, result.ContractAddress)
			}
			if result.TokenID != tt.wantTokenID {
				t.Errorf("expected tokenID %d, got %d", tt.wantTokenID, result.TokenID)
			}
		})
	}
}

func TestIsTezosNetwork(t *testing.T) {
	tests := []struct {
		name    string
		network string
		want    bool
	}{
		{
			name:    "Tezos mainnet",
			network: "tezos:NetXdQprcVkpaWU",
			want:    true,
		},
		{
			name:    "Tezos ghostnet",
			network: "tezos:NetXnHfVqm9iesp",
			want:    true,
		},
		{
			name:    "Tezos with custom chain",
			network: "tezos:CustomChainID",
			want:    true,
		},
		{
			name:    "EVM network",
			network: "eip155:1",
			want:    false,
		},
		{
			name:    "Solana network",
			network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
			want:    false,
		},
		{
			name:    "empty string",
			network: "",
			want:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := IsTezosNetwork(tt.network)
			if got != tt.want {
				t.Errorf("IsTezosNetwork(%s) = %v, want %v", tt.network, got, tt.want)
			}
		})
	}
}

func TestCreateAssetIdentifier(t *testing.T) {
	tests := []struct {
		name     string
		network  string
		contract string
		tokenID  int
		want     string
	}{
		{
			name:     "mainnet USDt",
			network:  "tezos:NetXdQprcVkpaWU",
			contract: "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o",
			tokenID:  0,
			want:     "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0",
		},
		{
			name:     "ghostnet with non-zero token ID",
			network:  "tezos:NetXnHfVqm9iesp",
			contract: "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o",
			tokenID:  5,
			want:     "tezos:NetXnHfVqm9iesp/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/5",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CreateAssetIdentifier(tt.network, tt.contract, tt.tokenID)
			if got != tt.want {
				t.Errorf("CreateAssetIdentifier() = %s, want %s", got, tt.want)
			}
		})
	}
}

// contains checks if s contains substr (helper for error message checking)
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsSubstr(s, substr))
}

func containsSubstr(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
