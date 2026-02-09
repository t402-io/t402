package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
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

func TestFacilitatorStacksSigner_QueryTransaction(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/extended/v1/tx/0xabc123" {
			http.NotFound(w, r)
			return
		}

		resp := stacks.StacksTransactionResult{
			TxId:          "0xabc123",
			TxStatus:      "success",
			TxType:        "contract_call",
			SenderAddress: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
			BlockHeight:   150000,
			BurnBlockTime: 1700000000,
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	cfg := &config.Config{
		StacksAddress:       "SP000000000000000000002Q6VF78",
		StacksAPIURL:        server.URL,
		StacksTestnetAPIURL: "https://api.testnet.hiro.so",
	}
	signer := newFacilitatorStacksSigner(cfg)

	result, err := signer.QueryTransaction(context.Background(), "0xabc123")
	if err != nil {
		t.Fatalf("QueryTransaction() error = %v", err)
	}
	if result == nil {
		t.Fatal("expected non-nil result")
	}
	if result.TxId != "0xabc123" {
		t.Errorf("TxId = %v, want 0xabc123", result.TxId)
	}
	if result.TxStatus != "success" {
		t.Errorf("TxStatus = %v, want success", result.TxStatus)
	}
	if result.TxType != "contract_call" {
		t.Errorf("TxType = %v, want contract_call", result.TxType)
	}
	if result.SenderAddress != "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K" {
		t.Errorf("SenderAddress = %v, want SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K", result.SenderAddress)
	}
	if result.BlockHeight != 150000 {
		t.Errorf("BlockHeight = %v, want 150000", result.BlockHeight)
	}
	if result.BurnBlockTime != 1700000000 {
		t.Errorf("BurnBlockTime = %v, want 1700000000", result.BurnBlockTime)
	}
}

func TestFacilitatorStacksSigner_QueryTransaction_NotFound(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		w.Write([]byte("transaction not found"))
	}))
	defer server.Close()

	cfg := &config.Config{
		StacksAddress:       "SP000000000000000000002Q6VF78",
		StacksAPIURL:        server.URL,
		StacksTestnetAPIURL: "https://api.testnet.hiro.so",
	}
	signer := newFacilitatorStacksSigner(cfg)

	result, err := signer.QueryTransaction(context.Background(), "0xnonexistent")
	if err != nil {
		t.Fatalf("QueryTransaction() error = %v, expected nil for not found", err)
	}
	if result != nil {
		t.Error("expected nil result for not found transaction")
	}
}

func TestFacilitatorStacksSigner_QueryTransaction_ServerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("internal server error"))
	}))
	defer server.Close()

	cfg := &config.Config{
		StacksAddress:       "SP000000000000000000002Q6VF78",
		StacksAPIURL:        server.URL,
		StacksTestnetAPIURL: "https://api.testnet.hiro.so",
	}
	signer := newFacilitatorStacksSigner(cfg)

	result, err := signer.QueryTransaction(context.Background(), "0xerror")
	if err == nil {
		t.Fatal("expected error for server error response")
	}
	if result != nil {
		t.Error("expected nil result on error")
	}
}

func TestFacilitatorStacksSigner_QueryTransaction_InvalidJSON(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("this is not valid json{{{"))
	}))
	defer server.Close()

	cfg := &config.Config{
		StacksAddress:       "SP000000000000000000002Q6VF78",
		StacksAPIURL:        server.URL,
		StacksTestnetAPIURL: "https://api.testnet.hiro.so",
	}
	signer := newFacilitatorStacksSigner(cfg)

	result, err := signer.QueryTransaction(context.Background(), "0xbadjson")
	if err == nil {
		t.Fatal("expected error for invalid JSON response")
	}
	if result != nil {
		t.Error("expected nil result on JSON decode error")
	}
}

func TestFacilitatorStacksSigner_QueryTransaction_WithContractCall(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/extended/v1/tx/0xtransfer456" {
			http.NotFound(w, r)
			return
		}

		resp := stacks.StacksTransactionResult{
			TxId:          "0xtransfer456",
			TxStatus:      "success",
			TxType:        "contract_call",
			SenderAddress: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
			BlockHeight:   160000,
			BurnBlockTime: 1700100000,
			ContractCall: &stacks.ContractCallInfo{
				ContractID:   "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
				FunctionName: "transfer",
				FunctionArgs: []stacks.FunctionArg{
					{Name: "amount", Type: "uint", Repr: "u1000000"},
					{Name: "sender", Type: "principal", Repr: "'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K"},
					{Name: "recipient", Type: "principal", Repr: "'SP000000000000000000002Q6VF78"},
				},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	cfg := &config.Config{
		StacksAddress:       "SP000000000000000000002Q6VF78",
		StacksAPIURL:        server.URL,
		StacksTestnetAPIURL: "https://api.testnet.hiro.so",
	}
	signer := newFacilitatorStacksSigner(cfg)

	result, err := signer.QueryTransaction(context.Background(), "0xtransfer456")
	if err != nil {
		t.Fatalf("QueryTransaction() error = %v", err)
	}
	if result == nil {
		t.Fatal("expected non-nil result")
	}
	if result.ContractCall == nil {
		t.Fatal("expected non-nil ContractCall")
	}
	if result.ContractCall.ContractID != "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc" {
		t.Errorf("ContractID = %v, want SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc", result.ContractCall.ContractID)
	}
	if result.ContractCall.FunctionName != "transfer" {
		t.Errorf("FunctionName = %v, want transfer", result.ContractCall.FunctionName)
	}
	if len(result.ContractCall.FunctionArgs) != 3 {
		t.Fatalf("expected 3 function args, got %d", len(result.ContractCall.FunctionArgs))
	}

	// Verify amount arg
	amountArg := result.ContractCall.FunctionArgs[0]
	if amountArg.Name != "amount" {
		t.Errorf("FunctionArgs[0].Name = %v, want amount", amountArg.Name)
	}
	if amountArg.Type != "uint" {
		t.Errorf("FunctionArgs[0].Type = %v, want uint", amountArg.Type)
	}
	if amountArg.Repr != "u1000000" {
		t.Errorf("FunctionArgs[0].Repr = %v, want u1000000", amountArg.Repr)
	}

	// Verify recipient arg
	recipientArg := result.ContractCall.FunctionArgs[2]
	if recipientArg.Name != "recipient" {
		t.Errorf("FunctionArgs[2].Name = %v, want recipient", recipientArg.Name)
	}
	if recipientArg.Repr != "'SP000000000000000000002Q6VF78" {
		t.Errorf("FunctionArgs[2].Repr = %v, want 'SP000000000000000000002Q6VF78", recipientArg.Repr)
	}
}
