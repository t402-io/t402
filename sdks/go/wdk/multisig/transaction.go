package multisig

import (
	"math/big"

	"github.com/ethereum/go-ethereum/common"
)

// TransactionBuilder helps construct Safe transactions.
type TransactionBuilder struct {
	to             common.Address
	value          *big.Int
	data           []byte
	operation      uint8
	safeTxGas      *big.Int
	baseGas        *big.Int
	gasPrice       *big.Int
	gasToken       common.Address
	refundReceiver common.Address
	nonce          *big.Int
}

// NewTransactionBuilder creates a new transaction builder.
func NewTransactionBuilder() *TransactionBuilder {
	return &TransactionBuilder{
		value:     big.NewInt(0),
		data:      []byte{},
		operation: OperationCall,
		safeTxGas: big.NewInt(0),
		baseGas:   big.NewInt(0),
		gasPrice:  big.NewInt(0),
	}
}

// To sets the target address.
func (b *TransactionBuilder) To(addr common.Address) *TransactionBuilder {
	b.to = addr
	return b
}

// Value sets the ETH value to send.
func (b *TransactionBuilder) Value(value *big.Int) *TransactionBuilder {
	if value != nil {
		b.value = value
	}
	return b
}

// Data sets the calldata.
func (b *TransactionBuilder) Data(data []byte) *TransactionBuilder {
	b.data = data
	return b
}

// Operation sets the operation type (Call or DelegateCall).
func (b *TransactionBuilder) Operation(op uint8) *TransactionBuilder {
	b.operation = op
	return b
}

// DelegateCall sets the operation to delegate call.
func (b *TransactionBuilder) DelegateCall() *TransactionBuilder {
	b.operation = OperationDelegateCall
	return b
}

// SafeTxGas sets the gas for the Safe transaction.
func (b *TransactionBuilder) SafeTxGas(gas *big.Int) *TransactionBuilder {
	if gas != nil {
		b.safeTxGas = gas
	}
	return b
}

// BaseGas sets the base gas.
func (b *TransactionBuilder) BaseGas(gas *big.Int) *TransactionBuilder {
	if gas != nil {
		b.baseGas = gas
	}
	return b
}

// GasPrice sets the gas price for refund.
func (b *TransactionBuilder) GasPrice(price *big.Int) *TransactionBuilder {
	if price != nil {
		b.gasPrice = price
	}
	return b
}

// GasToken sets the token for gas refund (zero address for ETH).
func (b *TransactionBuilder) GasToken(token common.Address) *TransactionBuilder {
	b.gasToken = token
	return b
}

// RefundReceiver sets the address to receive gas refund.
func (b *TransactionBuilder) RefundReceiver(receiver common.Address) *TransactionBuilder {
	b.refundReceiver = receiver
	return b
}

// Nonce sets the Safe nonce.
func (b *TransactionBuilder) Nonce(nonce *big.Int) *TransactionBuilder {
	b.nonce = nonce
	return b
}

// Build creates the SafeTransaction.
func (b *TransactionBuilder) Build() *SafeTransaction {
	return &SafeTransaction{
		To:             b.to,
		Value:          b.value,
		Data:           b.data,
		Operation:      b.operation,
		SafeTxGas:      b.safeTxGas,
		BaseGas:        b.baseGas,
		GasPrice:       b.gasPrice,
		GasToken:       b.gasToken,
		RefundReceiver: b.refundReceiver,
		Nonce:          b.nonce,
	}
}

// ERC20Transfer creates a transaction for ERC20 token transfer.
func ERC20Transfer(token, to common.Address, amount *big.Int) *SafeTransaction {
	// transfer(address,uint256) selector: 0xa9059cbb
	data := make([]byte, 68)
	copy(data[0:4], []byte{0xa9, 0x05, 0x9c, 0xbb})

	// Pad to address to 32 bytes
	copy(data[16:36], to.Bytes())

	// Pad amount to 32 bytes
	amountBytes := amount.Bytes()
	copy(data[68-len(amountBytes):68], amountBytes)

	return NewTransactionBuilder().
		To(token).
		Data(data).
		Build()
}

// ETHTransfer creates a transaction for sending ETH.
func ETHTransfer(to common.Address, amount *big.Int) *SafeTransaction {
	return NewTransactionBuilder().
		To(to).
		Value(amount).
		Build()
}

// ContractCall creates a transaction for calling a contract.
func ContractCall(target common.Address, data []byte) *SafeTransaction {
	return NewTransactionBuilder().
		To(target).
		Data(data).
		Build()
}

// BatchTransactionBuilder builds multiple transactions for batch execution.
type BatchTransactionBuilder struct {
	transactions []*SafeTransaction
}

// NewBatchTransactionBuilder creates a new batch transaction builder.
func NewBatchTransactionBuilder() *BatchTransactionBuilder {
	return &BatchTransactionBuilder{
		transactions: make([]*SafeTransaction, 0),
	}
}

// Add adds a transaction to the batch.
func (b *BatchTransactionBuilder) Add(tx *SafeTransaction) *BatchTransactionBuilder {
	b.transactions = append(b.transactions, tx)
	return b
}

// AddTransfer adds an ERC20 transfer to the batch.
func (b *BatchTransactionBuilder) AddTransfer(token, to common.Address, amount *big.Int) *BatchTransactionBuilder {
	return b.Add(ERC20Transfer(token, to, amount))
}

// AddETHTransfer adds an ETH transfer to the batch.
func (b *BatchTransactionBuilder) AddETHTransfer(to common.Address, amount *big.Int) *BatchTransactionBuilder {
	return b.Add(ETHTransfer(to, amount))
}

// Build returns all transactions in the batch.
func (b *BatchTransactionBuilder) Build() []*SafeTransaction {
	return b.transactions
}

// BuildMultiSend creates a single transaction that executes all batch transactions via MultiSend.
func (b *BatchTransactionBuilder) BuildMultiSend() *SafeTransaction {
	// Encode multiSend data
	// multiSend(bytes transactions)
	// Each transaction is encoded as:
	// operation (1 byte) + to (20 bytes) + value (32 bytes) + dataLength (32 bytes) + data (variable)

	var packedTxs []byte
	for _, tx := range b.transactions {
		// Operation (1 byte)
		packedTxs = append(packedTxs, tx.Operation)

		// To (20 bytes)
		packedTxs = append(packedTxs, tx.To.Bytes()...)

		// Value (32 bytes)
		value := tx.Value
		if value == nil {
			value = big.NewInt(0)
		}
		valueBytes := make([]byte, 32)
		value.FillBytes(valueBytes)
		packedTxs = append(packedTxs, valueBytes...)

		// Data length (32 bytes)
		dataLen := big.NewInt(int64(len(tx.Data)))
		dataLenBytes := make([]byte, 32)
		dataLen.FillBytes(dataLenBytes)
		packedTxs = append(packedTxs, dataLenBytes...)

		// Data
		packedTxs = append(packedTxs, tx.Data...)
	}

	// multiSend(bytes) selector: 0x8d80ff0a
	calldata := make([]byte, 0)
	calldata = append(calldata, []byte{0x8d, 0x80, 0xff, 0x0a}...)

	// Encode bytes parameter (offset + length + data)
	offset := make([]byte, 32)
	offset[31] = 32 // Offset to data
	calldata = append(calldata, offset...)

	length := make([]byte, 32)
	big.NewInt(int64(len(packedTxs))).FillBytes(length)
	calldata = append(calldata, length...)

	// Pad to 32-byte boundary
	paddedLen := ((len(packedTxs) + 31) / 32) * 32
	paddedData := make([]byte, paddedLen)
	copy(paddedData, packedTxs)
	calldata = append(calldata, paddedData...)

	return NewTransactionBuilder().
		To(SafeMultiSend).
		Data(calldata).
		DelegateCall().
		Build()
}
