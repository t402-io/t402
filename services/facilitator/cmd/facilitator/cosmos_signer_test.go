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

func TestFacilitatorCosmosSigner_QueryTxByEvent(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/cosmos/tx/v1beta1/txs" {
			http.NotFound(w, r)
			return
		}

		// Verify event query params are passed
		events := r.URL.Query()["events"]
		if len(events) != 2 {
			t.Errorf("expected 2 event params, got %d", len(events))
		}

		resp := struct {
			Txs         []cosmos.TxWrapper  `json:"txs"`
			TxResponses []cosmos.TxResponse `json:"tx_responses"`
		}{
			Txs: []cosmos.TxWrapper{
				{
					Body: cosmos.TxBody{
						Messages: []json.RawMessage{
							json.RawMessage(`{"@type": "/cosmos.bank.v1beta1.MsgSend"}`),
						},
					},
				},
				{
					Body: cosmos.TxBody{
						Messages: []json.RawMessage{
							json.RawMessage(`{"@type": "/cosmos.bank.v1beta1.MsgSend"}`),
						},
					},
				},
			},
			TxResponses: []cosmos.TxResponse{
				{
					TxHash:    "hash1",
					Height:    "100",
					Code:      0,
					GasWanted: "50000",
					GasUsed:   "40000",
					Timestamp: "2026-01-01T00:00:00Z",
				},
				{
					TxHash:    "hash2",
					Height:    "101",
					Code:      0,
					GasWanted: "60000",
					GasUsed:   "45000",
					Timestamp: "2026-01-01T00:01:00Z",
				},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	signer := newFacilitatorCosmosSigner(server.URL, "", "", "")

	results, err := signer.QueryTxByEvent(context.Background(), cosmos.NobleMainnetCAIP2, []string{
		"transfer.sender='noble1sender'",
		"transfer.recipient='noble1receiver'",
	})
	if err != nil {
		t.Fatalf("QueryTxByEvent() error = %v", err)
	}
	if len(results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(results))
	}
	if results[0].TxHash != "hash1" {
		t.Errorf("results[0].TxHash = %v, want hash1", results[0].TxHash)
	}
	if results[0].Height != "100" {
		t.Errorf("results[0].Height = %v, want 100", results[0].Height)
	}
	if results[0].GasWanted != "50000" {
		t.Errorf("results[0].GasWanted = %v, want 50000", results[0].GasWanted)
	}
	if results[0].GasUsed != "40000" {
		t.Errorf("results[0].GasUsed = %v, want 40000", results[0].GasUsed)
	}
	if results[0].Timestamp != "2026-01-01T00:00:00Z" {
		t.Errorf("results[0].Timestamp = %v, want 2026-01-01T00:00:00Z", results[0].Timestamp)
	}
	if results[1].TxHash != "hash2" {
		t.Errorf("results[1].TxHash = %v, want hash2", results[1].TxHash)
	}
	if results[1].Height != "101" {
		t.Errorf("results[1].Height = %v, want 101", results[1].Height)
	}
}

func TestFacilitatorCosmosSigner_QueryTxByEvent_Empty(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := struct {
			Txs         []cosmos.TxWrapper  `json:"txs"`
			TxResponses []cosmos.TxResponse `json:"tx_responses"`
		}{
			Txs:         []cosmos.TxWrapper{},
			TxResponses: []cosmos.TxResponse{},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	signer := newFacilitatorCosmosSigner(server.URL, "", "", "")

	results, err := signer.QueryTxByEvent(context.Background(), cosmos.NobleMainnetCAIP2, []string{"transfer.sender='noble1nobody'"})
	if err != nil {
		t.Fatalf("QueryTxByEvent() error = %v", err)
	}
	if len(results) != 0 {
		t.Errorf("expected 0 results, got %d", len(results))
	}
}

func TestFacilitatorCosmosSigner_QueryTxByEvent_Error(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("internal server error"))
	}))
	defer server.Close()

	signer := newFacilitatorCosmosSigner(server.URL, "", "", "")

	_, err := signer.QueryTxByEvent(context.Background(), cosmos.NobleMainnetCAIP2, []string{"transfer.sender='noble1sender'"})
	if err == nil {
		t.Fatal("expected error for server error response")
	}
}

func TestFacilitatorCosmosSigner_BroadcastTx(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/cosmos/tx/v1beta1/txs" {
			http.NotFound(w, r)
			return
		}
		if r.Method != http.MethodPost {
			t.Errorf("expected POST method, got %s", r.Method)
		}
		if r.Header.Get("Content-Type") != "application/json" {
			t.Errorf("expected Content-Type application/json, got %s", r.Header.Get("Content-Type"))
		}

		// Verify request body contains tx_bytes and mode
		var reqBody map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
			t.Errorf("failed to decode request body: %v", err)
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		if _, ok := reqBody["tx_bytes"]; !ok {
			t.Error("request body missing tx_bytes")
		}
		if mode, ok := reqBody["mode"].(string); !ok || mode != "BROADCAST_MODE_SYNC" {
			t.Errorf("mode = %v, want BROADCAST_MODE_SYNC", reqBody["mode"])
		}

		resp := struct {
			TxResponse cosmos.TxResponse `json:"tx_response"`
		}{
			TxResponse: cosmos.TxResponse{
				TxHash:    "broadcasthash123",
				Height:    "99999",
				Code:      0,
				RawLog:    "[]",
				GasWanted: "200000",
				GasUsed:   "150000",
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	signer := newFacilitatorCosmosSigner(server.URL, "", "", "")

	result, err := signer.BroadcastTx(context.Background(), cosmos.NobleMainnetCAIP2, []byte("fake-tx-bytes"), "BROADCAST_MODE_SYNC")
	if err != nil {
		t.Fatalf("BroadcastTx() error = %v", err)
	}
	if result == nil {
		t.Fatal("expected non-nil result")
	}
	if result.TxHash != "broadcasthash123" {
		t.Errorf("TxHash = %v, want broadcasthash123", result.TxHash)
	}
	if result.Height != "99999" {
		t.Errorf("Height = %v, want 99999", result.Height)
	}
	if result.Code != 0 {
		t.Errorf("Code = %v, want 0", result.Code)
	}
	if result.GasWanted != "200000" {
		t.Errorf("GasWanted = %v, want 200000", result.GasWanted)
	}
	if result.GasUsed != "150000" {
		t.Errorf("GasUsed = %v, want 150000", result.GasUsed)
	}
	if result.RawLog != "[]" {
		t.Errorf("RawLog = %v, want []", result.RawLog)
	}
}

func TestFacilitatorCosmosSigner_BroadcastTx_Error(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte("invalid transaction"))
	}))
	defer server.Close()

	signer := newFacilitatorCosmosSigner(server.URL, "", "", "")

	_, err := signer.BroadcastTx(context.Background(), cosmos.NobleMainnetCAIP2, []byte("bad-tx"), "BROADCAST_MODE_SYNC")
	if err == nil {
		t.Fatal("expected error for bad request response")
	}
}

func TestFacilitatorCosmosSigner_BroadcastTx_UnsupportedNetwork(t *testing.T) {
	signer := newFacilitatorCosmosSigner("", "", "", "")

	_, err := signer.BroadcastTx(context.Background(), "cosmos:unknown-chain", []byte("tx"), "BROADCAST_MODE_SYNC")
	if err == nil {
		t.Fatal("expected error for unsupported network")
	}
}

func TestFacilitatorCosmosSigner_GetAddresses_UnknownNetwork(t *testing.T) {
	signer := newFacilitatorCosmosSigner("", "", "noble1main", "noble1test")

	addrs := signer.GetAddresses(context.Background(), "cosmos:unknown-chain")
	if len(addrs) != 0 {
		t.Errorf("expected empty addresses for unknown network, got %v", addrs)
	}
}

func TestFacilitatorCosmosSigner_GetBalance_Error(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("internal server error"))
	}))
	defer server.Close()

	signer := newFacilitatorCosmosSigner(server.URL, "", "", "")

	balance, err := signer.GetBalance(context.Background(), cosmos.NobleMainnetCAIP2, "noble1addr", "uusdc")
	if err == nil {
		t.Fatal("expected error for server error response")
	}
	if balance != "0" {
		t.Errorf("balance = %v, want 0 on error", balance)
	}
}

func TestFacilitatorCosmosSigner_QueryTransaction_ServerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("transaction query failed"))
	}))
	defer server.Close()

	signer := newFacilitatorCosmosSigner(server.URL, "", "", "")

	tx, err := signer.QueryTransaction(context.Background(), cosmos.NobleMainnetCAIP2, "badhash")
	if err == nil {
		t.Fatal("expected error for server error response")
	}
	if tx != nil {
		t.Error("expected nil transaction on error")
	}
	// Verify the error message includes status information
	errMsg := err.Error()
	if len(errMsg) == 0 {
		t.Error("expected non-empty error message")
	}
	// The error should mention the status code or status text
	if !containsAny(errMsg, "500", "Internal Server Error") {
		t.Errorf("error message %q should include status information", errMsg)
	}
}

// containsAny returns true if s contains any of the substrings.
func containsAny(s string, substrs ...string) bool {
	for _, sub := range substrs {
		if len(sub) > 0 && len(s) >= len(sub) {
			for i := 0; i <= len(s)-len(sub); i++ {
				if s[i:i+len(sub)] == sub {
					return true
				}
			}
		}
	}
	return false
}
