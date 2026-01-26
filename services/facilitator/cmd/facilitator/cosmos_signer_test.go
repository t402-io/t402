package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/t402-io/t402/sdks/go/mechanisms/cosmos"
)

func TestNewFacilitatorCosmosSigner(t *testing.T) {
	signer := newFacilitatorCosmosSigner(
		"https://noble-api.polkachu.com",
		"https://api.testnet.noble.strange.love",
		"noble1mainnetaddr",
		"noble1testnetaddr",
	)

	if signer == nil {
		t.Fatal("expected non-nil signer")
	}

	// Check addresses
	mainnetAddrs := signer.GetAddresses(context.Background(), cosmos.NobleMainnetCAIP2)
	if len(mainnetAddrs) != 1 || mainnetAddrs[0] != "noble1mainnetaddr" {
		t.Errorf("mainnet addresses = %v, want [noble1mainnetaddr]", mainnetAddrs)
	}

	testnetAddrs := signer.GetAddresses(context.Background(), cosmos.NobleTestnetCAIP2)
	if len(testnetAddrs) != 1 || testnetAddrs[0] != "noble1testnetaddr" {
		t.Errorf("testnet addresses = %v, want [noble1testnetaddr]", testnetAddrs)
	}
}

func TestFacilitatorCosmosSigner_GetAddresses_Empty(t *testing.T) {
	signer := newFacilitatorCosmosSigner("", "", "", "")

	addrs := signer.GetAddresses(context.Background(), cosmos.NobleMainnetCAIP2)
	if len(addrs) != 0 {
		t.Errorf("expected empty addresses, got %v", addrs)
	}
}

func TestFacilitatorCosmosSigner_QueryTransaction(t *testing.T) {
	// Create mock server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/cosmos/tx/v1beta1/txs/txhash123" {
			resp := cosmos.RESTTxResponse{
				TxResponse: cosmos.TxResponse{
					TxHash:    "txhash123",
					Height:    "12345",
					Code:      0,
					GasWanted: "100000",
					GasUsed:   "80000",
				},
				Tx: cosmos.TxWrapper{
					Body: cosmos.TxBody{
						Messages: []json.RawMessage{
							json.RawMessage(`{"@type": "/cosmos.bank.v1beta1.MsgSend", "from_address": "noble1sender", "to_address": "noble1receiver", "amount": [{"denom": "uusdc", "amount": "1000000"}]}`),
						},
					},
				},
			}
			json.NewEncoder(w).Encode(resp)
			return
		}
		http.NotFound(w, r)
	}))
	defer server.Close()

	signer := newFacilitatorCosmosSigner(server.URL, "", "", "")

	tx, err := signer.QueryTransaction(context.Background(), cosmos.NobleMainnetCAIP2, "txhash123")
	if err != nil {
		t.Fatalf("QueryTransaction() error = %v", err)
	}
	if tx == nil {
		t.Fatal("expected non-nil transaction")
	}
	if tx.TxHash != "txhash123" {
		t.Errorf("TxHash = %v, want txhash123", tx.TxHash)
	}
	if tx.Height != "12345" {
		t.Errorf("Height = %v, want 12345", tx.Height)
	}
	if !tx.IsSuccess() {
		t.Error("expected IsSuccess() = true")
	}
}

func TestFacilitatorCosmosSigner_QueryTransaction_NotFound(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	}))
	defer server.Close()

	signer := newFacilitatorCosmosSigner(server.URL, "", "", "")

	tx, err := signer.QueryTransaction(context.Background(), cosmos.NobleMainnetCAIP2, "notfound")
	if err != nil {
		t.Fatalf("QueryTransaction() error = %v", err)
	}
	if tx != nil {
		t.Error("expected nil transaction for not found")
	}
}

func TestFacilitatorCosmosSigner_GetBalance(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/cosmos/bank/v1beta1/balances/noble1addr/by_denom" {
			resp := cosmos.BalanceResponse{
				Balance: cosmos.Coin{
					Denom:  "uusdc",
					Amount: "5000000",
				},
			}
			json.NewEncoder(w).Encode(resp)
			return
		}
		http.NotFound(w, r)
	}))
	defer server.Close()

	signer := newFacilitatorCosmosSigner(server.URL, "", "", "")

	balance, err := signer.GetBalance(context.Background(), cosmos.NobleMainnetCAIP2, "noble1addr", "uusdc")
	if err != nil {
		t.Fatalf("GetBalance() error = %v", err)
	}
	if balance != "5000000" {
		t.Errorf("balance = %v, want 5000000", balance)
	}
}

func TestFacilitatorCosmosSigner_GetRESTURL_Default(t *testing.T) {
	signer := newFacilitatorCosmosSigner("", "", "", "")

	// Should fall back to default URLs from constants
	url, err := signer.getRESTURL(cosmos.NobleMainnetCAIP2)
	if err != nil {
		t.Fatalf("getRESTURL() error = %v", err)
	}
	if url != cosmos.NobleMainnetREST {
		t.Errorf("url = %v, want %v", url, cosmos.NobleMainnetREST)
	}
}

func TestFacilitatorCosmosSigner_GetRESTURL_Unsupported(t *testing.T) {
	signer := newFacilitatorCosmosSigner("", "", "", "")

	_, err := signer.getRESTURL("cosmos:unknown")
	if err == nil {
		t.Error("expected error for unsupported network")
	}
}
