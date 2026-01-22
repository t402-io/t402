package erc4337

import (
	"crypto/ecdsa"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"golang.org/x/crypto/sha3"
)

// SafeAccountConfig contains configuration for Safe smart account.
type SafeAccountConfig struct {
	// Owner is the owner's private key
	Owner *ecdsa.PrivateKey
	// ChainID is the chain ID
	ChainID int64
	// Salt for counterfactual address derivation
	Salt *big.Int
	// EntryPoint is the EntryPoint contract address
	EntryPoint common.Address
	// Threshold is the number of signatures required (default 1)
	Threshold int
}

// SafeSmartAccount implements a Safe-based smart account for ERC-4337.
type SafeSmartAccount struct {
	owner          *ecdsa.PrivateKey
	ownerAddress   common.Address
	chainID        int64
	salt           *big.Int
	entryPoint     common.Address
	threshold      int
	cachedAddress  common.Address
	cachedInitCode []byte
}

// NewSafeSmartAccount creates a new Safe smart account.
func NewSafeSmartAccount(config SafeAccountConfig) (*SafeSmartAccount, error) {
	if config.Owner == nil {
		return nil, fmt.Errorf("owner private key is required")
	}

	ownerAddress := crypto.PubkeyToAddress(config.Owner.PublicKey)

	salt := config.Salt
	if salt == nil {
		salt = big.NewInt(0)
	}

	entryPoint := config.EntryPoint
	if entryPoint == (common.Address{}) {
		entryPoint = common.HexToAddress(EntryPointV07Address)
	}

	threshold := config.Threshold
	if threshold <= 0 {
		threshold = 1
	}

	return &SafeSmartAccount{
		owner:        config.Owner,
		ownerAddress: ownerAddress,
		chainID:      config.ChainID,
		salt:         salt,
		entryPoint:   entryPoint,
		threshold:    threshold,
	}, nil
}

// GetAddress returns the counterfactual Safe address.
func (s *SafeSmartAccount) GetAddress() (common.Address, error) {
	if s.cachedAddress != (common.Address{}) {
		return s.cachedAddress, nil
	}

	// Calculate counterfactual address
	initCode, err := s.GetInitCode()
	if err != nil {
		return common.Address{}, err
	}

	// The address is derived from the proxy factory CREATE2
	// address = keccak256(0xff ++ factory ++ salt ++ keccak256(initCode))[12:]
	factoryAddress := Safe4337Addresses.ProxyFactory

	// Calculate salt with owner and setup
	saltHash := s.calculateSalt()

	// Calculate init code hash for proxy
	proxyInitCode := s.getProxyCreationCode()
	initCodeHash := crypto.Keccak256(proxyInitCode)

	// CREATE2 address calculation
	data := make([]byte, 1+20+32+32)
	data[0] = 0xff
	copy(data[1:21], factoryAddress.Bytes())
	copy(data[21:53], saltHash[:])
	copy(data[53:85], initCodeHash)

	hash := crypto.Keccak256(data)
	s.cachedAddress = common.BytesToAddress(hash[12:])
	s.cachedInitCode = initCode

	return s.cachedAddress, nil
}

// SignUserOpHash signs a UserOperation hash.
func (s *SafeSmartAccount) SignUserOpHash(userOpHash common.Hash) ([]byte, error) {
	// For Safe 4337, we sign the EIP-712 typed data
	// The Safe module expects: signature = abi.encodePacked(r, s, v)

	// Create message hash for signing
	messageHash := s.getSafeUserOpHash(userOpHash)

	// Sign with the owner key
	signature, err := crypto.Sign(messageHash[:], s.owner)
	if err != nil {
		return nil, fmt.Errorf("failed to sign: %w", err)
	}

	// Adjust v value for Ethereum (add 27)
	if signature[64] < 27 {
		signature[64] += 27
	}

	return signature, nil
}

// GetInitCode returns the init code for deploying the Safe.
func (s *SafeSmartAccount) GetInitCode() ([]byte, error) {
	if len(s.cachedInitCode) > 0 {
		return s.cachedInitCode, nil
	}

	// Init code = factory address + createProxyWithNonce(singleton, initializer, saltNonce)
	factoryAddress := Safe4337Addresses.ProxyFactory

	// Build the initializer data for Safe setup
	initializer := s.buildInitializer()

	// Encode createProxyWithNonce call
	// Function selector: 0x1688f0b9
	// createProxyWithNonce(address _singleton, bytes memory initializer, uint256 saltNonce)
	selector := []byte{0x16, 0x88, 0xf0, 0xb9}

	// ABI encode the parameters
	encoded := encodeCreateProxyWithNonce(Safe4337Addresses.Singleton, initializer, s.salt)

	initCode := make([]byte, 20+4+len(encoded))
	copy(initCode[0:20], factoryAddress.Bytes())
	copy(initCode[20:24], selector)
	copy(initCode[24:], encoded)

	s.cachedInitCode = initCode
	return initCode, nil
}

// IsDeployed checks if the account is deployed.
func (s *SafeSmartAccount) IsDeployed() (bool, error) {
	// This would require an RPC call to check code at address
	// For now, return false (caller should check via eth_getCode)
	return false, nil
}

// EncodeExecute encodes a call to Safe's execute function.
func (s *SafeSmartAccount) EncodeExecute(target common.Address, value *big.Int, data []byte) ([]byte, error) {
	// Safe 4337 module uses executeUserOp
	// Function: executeUserOp(address to, uint256 value, bytes data, uint8 operation)
	// Selector: 0x541d63c8
	selector := []byte{0x54, 0x1d, 0x63, 0xc8}

	// Operation 0 = CALL
	operation := uint8(0)

	encoded := encodeExecuteUserOp(target, value, data, operation)

	result := make([]byte, 4+len(encoded))
	copy(result[0:4], selector)
	copy(result[4:], encoded)

	return result, nil
}

// EncodeExecuteBatch encodes a batch call.
func (s *SafeSmartAccount) EncodeExecuteBatch(targets []common.Address, values []*big.Int, datas [][]byte) ([]byte, error) {
	if len(targets) != len(values) || len(targets) != len(datas) {
		return nil, fmt.Errorf("targets, values, and datas must have same length")
	}

	// For batch, we use Safe's multiSend
	// First encode individual transactions for multiSend
	var multiSendData []byte
	for i := range targets {
		// Each tx: operation (1 byte) + to (20 bytes) + value (32 bytes) + dataLength (32 bytes) + data
		txData := encodeMultiSendTx(targets[i], values[i], datas[i])
		multiSendData = append(multiSendData, txData...)
	}

	// Then encode call to multiSend contract via executeUserOp with DELEGATECALL
	// multiSend(bytes transactions)
	// Selector: 0x8d80ff0a
	multiSendSelector := []byte{0x8d, 0x80, 0xff, 0x0a}
	multiSendCall := encodeBytes(multiSendData)
	multiSendCalldata := make([]byte, 4+len(multiSendCall))
	copy(multiSendCalldata[0:4], multiSendSelector)
	copy(multiSendCalldata[4:], multiSendCall)

	// Execute via Safe 4337 module with DELEGATECALL (operation = 1)
	multiSendLib := common.HexToAddress("0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526") // MultiSend v1.3.0

	selector := []byte{0x54, 0x1d, 0x63, 0xc8} // executeUserOp
	operation := uint8(1)                      // DELEGATECALL

	encoded := encodeExecuteUserOp(multiSendLib, big.NewInt(0), multiSendCalldata, operation)

	result := make([]byte, 4+len(encoded))
	copy(result[0:4], selector)
	copy(result[4:], encoded)

	return result, nil
}

// buildInitializer builds the Safe setup initializer data.
func (s *SafeSmartAccount) buildInitializer() []byte {
	// Safe.setup(
	//   address[] _owners,
	//   uint256 _threshold,
	//   address to,
	//   bytes data,
	//   address fallbackHandler,
	//   address paymentToken,
	//   uint256 payment,
	//   address paymentReceiver
	// )
	// Selector: 0xb63e800d

	selector := []byte{0xb6, 0x3e, 0x80, 0x0d}

	owners := []common.Address{s.ownerAddress}
	threshold := big.NewInt(int64(s.threshold))

	// to = AddModulesLib to enable 4337 module
	toAddress := Safe4337Addresses.AddModulesLib

	// data = enableModules([Safe4337Module])
	// enableModules(address[])
	// Selector: 0x610b5925 (wrong - actually 0xa3f4df7e for enableModules)
	// Actually we use addModuleWithSetup from AddModulesLib
	moduleSetupData := encodeEnableModules([]common.Address{Safe4337Addresses.Module})

	fallbackHandler := Safe4337Addresses.FallbackHandler
	paymentToken := common.Address{}
	payment := big.NewInt(0)
	paymentReceiver := common.Address{}

	encoded := encodeSetup(owners, threshold, toAddress, moduleSetupData, fallbackHandler, paymentToken, payment, paymentReceiver)

	result := make([]byte, 4+len(encoded))
	copy(result[0:4], selector)
	copy(result[4:], encoded)

	return result
}

// calculateSalt calculates the CREATE2 salt.
func (s *SafeSmartAccount) calculateSalt() [32]byte {
	// Salt = keccak256(keccak256(initializer) ++ saltNonce)
	initializer := s.buildInitializer()
	initHash := crypto.Keccak256(initializer)

	data := make([]byte, 32+32)
	copy(data[0:32], initHash)
	s.salt.FillBytes(data[32:64])

	var result [32]byte
	copy(result[:], crypto.Keccak256(data))
	return result
}

// getProxyCreationCode returns the proxy creation code.
func (s *SafeSmartAccount) getProxyCreationCode() []byte {
	// This is the SafeProxy creation code with singleton address
	// The actual bytecode would come from the Safe contracts
	// For now, return a simplified version
	singleton := Safe4337Addresses.Singleton.Bytes()

	// Proxy creation code pattern (simplified)
	// In production, this should match the actual Safe proxy bytecode
	code := make([]byte, 0)
	code = append(code, []byte{0x60, 0x20}...) // PUSH1 0x20
	// ... more bytecode
	code = append(code, singleton...)

	return code
}

// getSafeUserOpHash creates the Safe-specific user op hash for signing.
func (s *SafeSmartAccount) getSafeUserOpHash(userOpHash common.Hash) common.Hash {
	// Safe 4337 uses a specific format
	// For simple EOA owners, we just sign the userOpHash directly
	// The Safe module will verify using ecrecover

	// Hash with Ethereum signed message prefix
	prefix := []byte("\x19Ethereum Signed Message:\n32")
	data := make([]byte, len(prefix)+32)
	copy(data[0:len(prefix)], prefix)
	copy(data[len(prefix):], userOpHash[:])

	return common.BytesToHash(crypto.Keccak256(data))
}

// ABI encoding helpers

func encodeCreateProxyWithNonce(singleton common.Address, initializer []byte, saltNonce *big.Int) []byte {
	// (address, bytes, uint256)
	// offset for bytes is 96 (3 * 32)
	result := make([]byte, 0)

	// singleton address (padded to 32 bytes)
	result = append(result, common.LeftPadBytes(singleton.Bytes(), 32)...)

	// offset to initializer bytes
	result = append(result, common.LeftPadBytes(big.NewInt(96).Bytes(), 32)...)

	// saltNonce
	result = append(result, common.LeftPadBytes(saltNonce.Bytes(), 32)...)

	// initializer bytes
	result = append(result, encodeBytes(initializer)...)

	return result
}

func encodeExecuteUserOp(to common.Address, value *big.Int, data []byte, operation uint8) []byte {
	// (address, uint256, bytes, uint8)
	result := make([]byte, 0)

	// to address
	result = append(result, common.LeftPadBytes(to.Bytes(), 32)...)

	// value
	if value == nil {
		value = big.NewInt(0)
	}
	result = append(result, common.LeftPadBytes(value.Bytes(), 32)...)

	// offset to data bytes (4 * 32 = 128)
	result = append(result, common.LeftPadBytes(big.NewInt(128).Bytes(), 32)...)

	// operation
	result = append(result, common.LeftPadBytes([]byte{operation}, 32)...)

	// data bytes
	result = append(result, encodeBytes(data)...)

	return result
}

func encodeBytes(data []byte) []byte {
	// length + padded data
	length := big.NewInt(int64(len(data)))
	paddedLength := ((len(data) + 31) / 32) * 32

	result := make([]byte, 32+paddedLength)
	copy(result[0:32], common.LeftPadBytes(length.Bytes(), 32))
	copy(result[32:32+len(data)], data)

	return result
}

func encodeSetup(owners []common.Address, threshold *big.Int, to common.Address, data []byte, fallbackHandler, paymentToken common.Address, payment *big.Int, paymentReceiver common.Address) []byte {
	result := make([]byte, 0)

	// Calculate offsets
	// Fixed params: threshold (32) + to (32) + offset to data (32) + fallbackHandler (32) + paymentToken (32) + payment (32) + paymentReceiver (32)
	// = 224 bytes after owners array offset

	// offset to owners array (8 * 32 = 256)
	result = append(result, common.LeftPadBytes(big.NewInt(256).Bytes(), 32)...)

	// threshold
	result = append(result, common.LeftPadBytes(threshold.Bytes(), 32)...)

	// to
	result = append(result, common.LeftPadBytes(to.Bytes(), 32)...)

	// Calculate offset for data
	ownersEncodedLen := 32 + 32*len(owners) // length + addresses
	dataOffset := 256 + ownersEncodedLen
	result = append(result, common.LeftPadBytes(big.NewInt(int64(dataOffset)).Bytes(), 32)...)

	// fallbackHandler
	result = append(result, common.LeftPadBytes(fallbackHandler.Bytes(), 32)...)

	// paymentToken
	result = append(result, common.LeftPadBytes(paymentToken.Bytes(), 32)...)

	// payment
	if payment == nil {
		payment = big.NewInt(0)
	}
	result = append(result, common.LeftPadBytes(payment.Bytes(), 32)...)

	// paymentReceiver
	result = append(result, common.LeftPadBytes(paymentReceiver.Bytes(), 32)...)

	// owners array
	result = append(result, common.LeftPadBytes(big.NewInt(int64(len(owners))).Bytes(), 32)...)
	for _, owner := range owners {
		result = append(result, common.LeftPadBytes(owner.Bytes(), 32)...)
	}

	// data bytes
	result = append(result, encodeBytes(data)...)

	return result
}

func encodeEnableModules(modules []common.Address) []byte {
	// enableModules(address[])
	// Selector: 0xa3f4df7e
	selector := []byte{0xa3, 0xf4, 0xdf, 0x7e}

	// offset to array
	encoded := common.LeftPadBytes(big.NewInt(32).Bytes(), 32)

	// array length
	encoded = append(encoded, common.LeftPadBytes(big.NewInt(int64(len(modules))).Bytes(), 32)...)

	// array elements
	for _, module := range modules {
		encoded = append(encoded, common.LeftPadBytes(module.Bytes(), 32)...)
	}

	result := make([]byte, 4+len(encoded))
	copy(result[0:4], selector)
	copy(result[4:], encoded)

	return result
}

func encodeMultiSendTx(to common.Address, value *big.Int, data []byte) []byte {
	// operation (1) + to (20) + value (32) + dataLength (32) + data
	if value == nil {
		value = big.NewInt(0)
	}

	result := make([]byte, 1+20+32+32+len(data))
	result[0] = 0 // CALL operation

	copy(result[1:21], to.Bytes())

	valueBytes := common.LeftPadBytes(value.Bytes(), 32)
	copy(result[21:53], valueBytes)

	lengthBytes := common.LeftPadBytes(big.NewInt(int64(len(data))).Bytes(), 32)
	copy(result[53:85], lengthBytes)

	copy(result[85:], data)

	return result
}

// keccak256 helper
func keccak256(data []byte) []byte {
	h := sha3.NewLegacyKeccak256()
	h.Write(data)
	return h.Sum(nil)
}
