package multisig

import (
	"math/big"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum/common"
)

func TestTransactionBuilder(t *testing.T) {
	to := common.HexToAddress("0x1234567890123456789012345678901234567890")
	value := big.NewInt(1000000)
	data := []byte{0xa9, 0x05, 0x9c, 0xbb}

	tx := NewTransactionBuilder().
		To(to).
		Value(value).
		Data(data).
		Build()

	if tx.To != to {
		t.Errorf("expected To %s, got %s", to.Hex(), tx.To.Hex())
	}
	if tx.Value.Cmp(value) != 0 {
		t.Errorf("expected Value %s, got %s", value.String(), tx.Value.String())
	}
	if len(tx.Data) != len(data) {
		t.Errorf("expected Data length %d, got %d", len(data), len(tx.Data))
	}
	if tx.Operation != OperationCall {
		t.Errorf("expected Operation %d, got %d", OperationCall, tx.Operation)
	}
}

func TestTransactionBuilderDelegateCall(t *testing.T) {
	tx := NewTransactionBuilder().
		To(common.HexToAddress("0x1234567890123456789012345678901234567890")).
		DelegateCall().
		Build()

	if tx.Operation != OperationDelegateCall {
		t.Errorf("expected Operation %d, got %d", OperationDelegateCall, tx.Operation)
	}
}

func TestERC20Transfer(t *testing.T) {
	token := common.HexToAddress("0xdAC17F958D2ee523a2206206994597C13D831ec7")
	to := common.HexToAddress("0x1234567890123456789012345678901234567890")
	amount := big.NewInt(1000000)

	tx := ERC20Transfer(token, to, amount)

	if tx.To != token {
		t.Errorf("expected To %s, got %s", token.Hex(), tx.To.Hex())
	}
	// Check transfer selector
	if tx.Data[0] != 0xa9 || tx.Data[1] != 0x05 || tx.Data[2] != 0x9c || tx.Data[3] != 0xbb {
		t.Error("expected transfer selector 0xa9059cbb")
	}
}

func TestETHTransfer(t *testing.T) {
	to := common.HexToAddress("0x1234567890123456789012345678901234567890")
	amount := big.NewInt(1000000000000000000) // 1 ETH

	tx := ETHTransfer(to, amount)

	if tx.To != to {
		t.Errorf("expected To %s, got %s", to.Hex(), tx.To.Hex())
	}
	if tx.Value.Cmp(amount) != 0 {
		t.Errorf("expected Value %s, got %s", amount.String(), tx.Value.String())
	}
	if len(tx.Data) != 0 {
		t.Errorf("expected empty Data, got length %d", len(tx.Data))
	}
}

func TestSignatureCollector(t *testing.T) {
	collector := NewSignatureCollector(nil)

	safeAddr := common.HexToAddress("0x1234567890123456789012345678901234567890")
	tx := NewTransactionBuilder().
		To(common.HexToAddress("0xabcdef1234567890123456789012345678901234")).
		Value(big.NewInt(1000)).
		Build()
	txHash := common.HexToHash("0x1234567890123456789012345678901234567890123456789012345678901234")
	owners := []common.Address{
		common.HexToAddress("0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA01"),
		common.HexToAddress("0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB02"),
		common.HexToAddress("0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC03"),
	}
	threshold := 2

	// Create request
	request := collector.CreateRequest(safeAddr, tx, txHash, owners, threshold)

	if request.ID == "" {
		t.Error("expected non-empty request ID")
	}
	if request.Threshold != threshold {
		t.Errorf("expected threshold %d, got %d", threshold, request.Threshold)
	}
	if request.IsReady() {
		t.Error("expected IsReady to be false initially")
	}

	// Add first signature
	sig1 := &SafeSignature{
		Signer:        owners[0],
		Signature:     make([]byte, 65),
		SignatureType: SignatureTypeEOA,
	}
	err := collector.AddSignature(request.ID, sig1)
	if err != nil {
		t.Errorf("unexpected error adding first signature: %v", err)
	}

	// Still not ready (need 2)
	req, _ := collector.GetRequest(request.ID)
	if req.IsReady() {
		t.Error("expected IsReady to be false with 1 signature")
	}
	if req.CollectedCount() != 1 {
		t.Errorf("expected 1 collected, got %d", req.CollectedCount())
	}

	// Add second signature with different signer
	sig2 := &SafeSignature{
		Signer:        owners[1],
		Signature:     make([]byte, 65),
		SignatureType: SignatureTypeEOA,
	}
	err = collector.AddSignature(request.ID, sig2)
	if err != nil {
		t.Errorf("unexpected error adding second signature: %v", err)
	}

	// Now ready
	req, _ = collector.GetRequest(request.ID)
	if !req.IsReady() {
		t.Error("expected IsReady to be true with 2 signatures")
	}
	if req.CollectedCount() != 2 {
		t.Errorf("expected 2 collected, got %d", req.CollectedCount())
	}
}

func TestSignatureCollectorDuplicateSignature(t *testing.T) {
	collector := NewSignatureCollector(nil)

	safeAddr := common.HexToAddress("0x1234567890123456789012345678901234567890")
	tx := NewTransactionBuilder().Build()
	txHash := common.HexToHash("0x1234567890123456789012345678901234567890123456789012345678901234")
	owners := []common.Address{
		common.HexToAddress("0xowner1000000000000000000000000000000001"),
	}

	request := collector.CreateRequest(safeAddr, tx, txHash, owners, 1)

	sig := &SafeSignature{
		Signer:        owners[0],
		Signature:     make([]byte, 65),
		SignatureType: SignatureTypeEOA,
	}

	// First signature should succeed
	err := collector.AddSignature(request.ID, sig)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	// Duplicate should fail
	err = collector.AddSignature(request.ID, sig)
	if err == nil {
		t.Error("expected error for duplicate signature")
	}
}

func TestSignatureCollectorExpiration(t *testing.T) {
	collector := NewSignatureCollector(&SignatureCollectorConfig{
		ExpirationSeconds: 1, // 1 second expiration
	})

	safeAddr := common.HexToAddress("0x1234567890123456789012345678901234567890")
	tx := NewTransactionBuilder().Build()
	txHash := common.HexToHash("0x1234567890123456789012345678901234567890123456789012345678901234")
	owners := []common.Address{
		common.HexToAddress("0xowner1000000000000000000000000000000001"),
	}

	request := collector.CreateRequest(safeAddr, tx, txHash, owners, 1)

	// Wait for expiration
	time.Sleep(2 * time.Second)

	// Should fail due to expiration
	_, err := collector.GetRequest(request.ID)
	if err == nil {
		t.Error("expected error for expired request")
	}
}

func TestTransactionRequestIsReady(t *testing.T) {
	tests := []struct {
		name           string
		signatureCount int
		threshold      int
		expected       bool
	}{
		{"no signatures", 0, 2, false},
		{"one of two", 1, 2, false},
		{"two of two", 2, 2, true},
		{"three of two", 3, 2, true},
		{"one of one", 1, 1, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			request := &TransactionRequest{
				Signatures: make(map[common.Address]*SafeSignature),
				Threshold:  tt.threshold,
			}

			for i := 0; i < tt.signatureCount; i++ {
				addr := common.HexToAddress("0x" + string(rune('1'+i)) + "234567890123456789012345678901234567890")
				request.Signatures[addr] = &SafeSignature{}
			}

			if request.IsReady() != tt.expected {
				t.Errorf("expected IsReady() = %v, got %v", tt.expected, request.IsReady())
			}
		})
	}
}

func TestBatchTransactionBuilder(t *testing.T) {
	token := common.HexToAddress("0xdAC17F958D2ee523a2206206994597C13D831ec7")
	to1 := common.HexToAddress("0x1111111111111111111111111111111111111111")
	to2 := common.HexToAddress("0x2222222222222222222222222222222222222222")
	amount := big.NewInt(1000000)

	batch := NewBatchTransactionBuilder().
		AddTransfer(token, to1, amount).
		AddTransfer(token, to2, amount)

	txs := batch.Build()
	if len(txs) != 2 {
		t.Errorf("expected 2 transactions, got %d", len(txs))
	}
}

func TestBatchTransactionBuilderMultiSend(t *testing.T) {
	token := common.HexToAddress("0xdAC17F958D2ee523a2206206994597C13D831ec7")
	to1 := common.HexToAddress("0x1111111111111111111111111111111111111111")
	to2 := common.HexToAddress("0x2222222222222222222222222222222222222222")
	amount := big.NewInt(1000000)

	batch := NewBatchTransactionBuilder().
		AddTransfer(token, to1, amount).
		AddTransfer(token, to2, amount)

	multiSendTx := batch.BuildMultiSend()

	if multiSendTx.To != SafeMultiSend {
		t.Errorf("expected MultiSend address %s, got %s", SafeMultiSend.Hex(), multiSendTx.To.Hex())
	}
	if multiSendTx.Operation != OperationDelegateCall {
		t.Errorf("expected DelegateCall operation, got %d", multiSendTx.Operation)
	}
	// Check multiSend selector
	if multiSendTx.Data[0] != 0x8d || multiSendTx.Data[1] != 0x80 || multiSendTx.Data[2] != 0xff || multiSendTx.Data[3] != 0x0a {
		t.Error("expected multiSend selector 0x8d80ff0a")
	}
}

func TestIsValidThreshold(t *testing.T) {
	tests := []struct {
		threshold  int
		ownerCount int
		expected   bool
	}{
		{0, 3, false},
		{1, 3, true},
		{2, 3, true},
		{3, 3, true},
		{4, 3, false},
		{1, 1, true},
		{0, 1, false},
	}

	for _, tt := range tests {
		result := IsValidThreshold(tt.threshold, tt.ownerCount)
		if result != tt.expected {
			t.Errorf("IsValidThreshold(%d, %d) = %v, expected %v", tt.threshold, tt.ownerCount, result, tt.expected)
		}
	}
}

func TestAreAddressesUnique(t *testing.T) {
	addr1 := common.HexToAddress("0x1111111111111111111111111111111111111111")
	addr2 := common.HexToAddress("0x2222222222222222222222222222222222222222")
	addr3 := common.HexToAddress("0x3333333333333333333333333333333333333333")

	tests := []struct {
		name     string
		addrs    []common.Address
		expected bool
	}{
		{"empty", []common.Address{}, true},
		{"single", []common.Address{addr1}, true},
		{"unique", []common.Address{addr1, addr2, addr3}, true},
		{"duplicate", []common.Address{addr1, addr2, addr1}, false},
		{"all same", []common.Address{addr1, addr1, addr1}, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := AreAddressesUnique(tt.addrs)
			if result != tt.expected {
				t.Errorf("expected %v, got %v", tt.expected, result)
			}
		})
	}
}

func TestGetOwnerIndex(t *testing.T) {
	owners := []common.Address{
		common.HexToAddress("0x1111111111111111111111111111111111111111"),
		common.HexToAddress("0x2222222222222222222222222222222222222222"),
		common.HexToAddress("0x3333333333333333333333333333333333333333"),
	}

	tests := []struct {
		owner    common.Address
		expected int
	}{
		{owners[0], 0},
		{owners[1], 1},
		{owners[2], 2},
		{common.HexToAddress("0x4444444444444444444444444444444444444444"), -1},
	}

	for _, tt := range tests {
		result := GetOwnerIndex(tt.owner, owners)
		if result != tt.expected {
			t.Errorf("GetOwnerIndex(%s) = %d, expected %d", tt.owner.Hex(), result, tt.expected)
		}
	}
}

func TestCombineSignatures(t *testing.T) {
	addr1 := common.HexToAddress("0x1111111111111111111111111111111111111111")
	addr2 := common.HexToAddress("0x2222222222222222222222222222222222222222")

	sig1 := make([]byte, 65)
	sig1[0] = 0x11
	sig2 := make([]byte, 65)
	sig2[0] = 0x22

	sigs := map[common.Address]*SafeSignature{
		addr2: {Signer: addr2, Signature: sig2}, // Intentionally out of order
		addr1: {Signer: addr1, Signature: sig1},
	}

	combined := CombineSignatures(sigs)

	// Should be sorted by address (addr1 < addr2)
	if len(combined) != 130 {
		t.Errorf("expected 130 bytes, got %d", len(combined))
	}
	// First signature should be addr1's (0x11)
	if combined[0] != 0x11 {
		t.Errorf("expected first sig byte 0x11, got 0x%02x", combined[0])
	}
	// Second signature should be addr2's (0x22)
	if combined[65] != 0x22 {
		t.Errorf("expected second sig byte 0x22, got 0x%02x", combined[65])
	}
}

func TestConstants(t *testing.T) {
	// Verify Safe contract addresses are set
	if Safe4337Module == (common.Address{}) {
		t.Error("Safe4337Module should not be zero address")
	}
	if SafeModuleSetup == (common.Address{}) {
		t.Error("SafeModuleSetup should not be zero address")
	}
	if SafeSingleton == (common.Address{}) {
		t.Error("SafeSingleton should not be zero address")
	}
	if SafeProxyFactory == (common.Address{}) {
		t.Error("SafeProxyFactory should not be zero address")
	}
	if EntryPointV07 == (common.Address{}) {
		t.Error("EntryPointV07 should not be zero address")
	}

	// Verify selectors are 4 bytes
	if len(GetOwnersSelector) != 4 {
		t.Errorf("GetOwnersSelector should be 4 bytes, got %d", len(GetOwnersSelector))
	}
	if len(GetThresholdSelector) != 4 {
		t.Errorf("GetThresholdSelector should be 4 bytes, got %d", len(GetThresholdSelector))
	}
	if len(NonceSelector) != 4 {
		t.Errorf("NonceSelector should be 4 bytes, got %d", len(NonceSelector))
	}
	if len(ExecTransactionSelector) != 4 {
		t.Errorf("ExecTransactionSelector should be 4 bytes, got %d", len(ExecTransactionSelector))
	}
}
