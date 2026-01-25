package multisig

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"sort"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum/common"
)

// SignatureCollector manages pending multi-sig transactions and signature collection.
type SignatureCollector struct {
	mu              sync.RWMutex
	pendingRequests map[string]*TransactionRequest
	expirationSecs  int64
}

// SignatureCollectorConfig holds configuration for the collector.
type SignatureCollectorConfig struct {
	// ExpirationSeconds is the request expiration time (default: 3600)
	ExpirationSeconds int64
}

// NewSignatureCollector creates a new signature collector.
func NewSignatureCollector(config *SignatureCollectorConfig) *SignatureCollector {
	expSecs := int64(DefaultRequestExpirationSeconds)
	if config != nil && config.ExpirationSeconds > 0 {
		expSecs = config.ExpirationSeconds
	}

	return &SignatureCollector{
		pendingRequests: make(map[string]*TransactionRequest),
		expirationSecs:  expSecs,
	}
}

// CreateRequest creates a new signature collection request.
func (c *SignatureCollector) CreateRequest(
	safeAddress common.Address,
	tx *SafeTransaction,
	txHash common.Hash,
	owners []common.Address,
	threshold int,
) *TransactionRequest {
	c.mu.Lock()
	defer c.mu.Unlock()

	now := currentTimestamp()
	request := &TransactionRequest{
		ID:              generateRequestID(),
		SafeAddress:     safeAddress,
		Transaction:     tx,
		TransactionHash: txHash,
		Signatures:      make(map[common.Address]*SafeSignature),
		Threshold:       threshold,
		CreatedAt:       now,
		ExpiresAt:       now + c.expirationSecs,
	}

	c.pendingRequests[request.ID] = request
	return request
}

// AddSignature adds a signature to a request.
func (c *SignatureCollector) AddSignature(requestID string, sig *SafeSignature) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	request, exists := c.pendingRequests[requestID]
	if !exists {
		return errors.New("request not found")
	}

	// Check expiration
	if currentTimestamp() > request.ExpiresAt {
		delete(c.pendingRequests, requestID)
		return errors.New("request expired")
	}

	// Check if already signed by this signer
	if _, exists := request.Signatures[sig.Signer]; exists {
		return errors.New("already signed by this signer")
	}

	request.Signatures[sig.Signer] = sig
	return nil
}

// GetRequest retrieves a pending request.
func (c *SignatureCollector) GetRequest(requestID string) (*TransactionRequest, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	request, exists := c.pendingRequests[requestID]
	if !exists {
		return nil, errors.New("request not found")
	}

	// Check expiration
	if currentTimestamp() > request.ExpiresAt {
		return nil, errors.New("request expired")
	}

	return request, nil
}

// RemoveRequest removes a request.
func (c *SignatureCollector) RemoveRequest(requestID string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.pendingRequests, requestID)
}

// GetPendingRequests returns all non-expired pending requests.
func (c *SignatureCollector) GetPendingRequests() []*TransactionRequest {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.cleanupExpiredLocked()

	var requests []*TransactionRequest
	for _, request := range c.pendingRequests {
		requests = append(requests, request)
	}
	return requests
}

// GetPendingOwners returns owners who haven't signed a request yet.
func (c *SignatureCollector) GetPendingOwners(requestID string, owners []common.Address) ([]common.Address, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	request, exists := c.pendingRequests[requestID]
	if !exists {
		return nil, errors.New("request not found")
	}

	var pending []common.Address
	for _, owner := range owners {
		if _, signed := request.Signatures[owner]; !signed {
			pending = append(pending, owner)
		}
	}
	return pending, nil
}

// GetSignedOwners returns owners who have signed a request.
func (c *SignatureCollector) GetSignedOwners(requestID string) ([]common.Address, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	request, exists := c.pendingRequests[requestID]
	if !exists {
		return nil, errors.New("request not found")
	}

	var signed []common.Address
	for signer := range request.Signatures {
		signed = append(signed, signer)
	}
	return signed, nil
}

// GetCombinedSignature returns the packed signatures for execution.
func (c *SignatureCollector) GetCombinedSignature(requestID string) ([]byte, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	request, exists := c.pendingRequests[requestID]
	if !exists {
		return nil, errors.New("request not found")
	}

	if !request.IsReady() {
		return nil, errors.New("not enough signatures")
	}

	// Sort signers by address
	var signers []common.Address
	for signer := range request.Signatures {
		signers = append(signers, signer)
	}
	sortAddresses(signers)

	// Pack signatures
	var packed []byte
	for _, signer := range signers {
		sig := request.Signatures[signer]
		packed = append(packed, sig.Signature...)
	}

	return packed, nil
}

// Cleanup removes expired requests.
func (c *SignatureCollector) Cleanup() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cleanupExpiredLocked()
}

// cleanupExpiredLocked removes expired requests (must hold lock).
func (c *SignatureCollector) cleanupExpiredLocked() {
	now := currentTimestamp()
	for id, request := range c.pendingRequests {
		if now > request.ExpiresAt {
			delete(c.pendingRequests, id)
		}
	}
}

// Clear removes all pending requests.
func (c *SignatureCollector) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.pendingRequests = make(map[string]*TransactionRequest)
}

// Helper functions

// generateRequestID creates a unique request identifier.
func generateRequestID() string {
	timestamp := time.Now().UnixMilli()
	randomBytes := make([]byte, 4)
	rand.Read(randomBytes)
	return "msig_" + hex.EncodeToString([]byte{
		byte(timestamp >> 24), byte(timestamp >> 16),
		byte(timestamp >> 8), byte(timestamp),
	}) + "_" + hex.EncodeToString(randomBytes)
}

// currentTimestamp returns the current Unix timestamp in seconds.
func currentTimestamp() int64 {
	return time.Now().Unix()
}

// sortAddresses sorts addresses in ascending order.
func sortAddresses(addrs []common.Address) {
	sort.Slice(addrs, func(i, j int) bool {
		return addrs[i].Hex() < addrs[j].Hex()
	})
}

// CombineSignatures combines multiple signatures sorted by signer address.
func CombineSignatures(sigs map[common.Address]*SafeSignature) []byte {
	var signers []common.Address
	for signer := range sigs {
		signers = append(signers, signer)
	}
	sortAddresses(signers)

	var packed []byte
	for _, signer := range signers {
		sig := sigs[signer]
		packed = append(packed, sig.Signature...)
	}

	return packed
}

// IsValidThreshold checks if a threshold is valid for the given owner count.
func IsValidThreshold(threshold, ownerCount int) bool {
	return threshold >= MinThreshold && threshold <= ownerCount
}

// AreAddressesUnique checks if all addresses are unique.
func AreAddressesUnique(addrs []common.Address) bool {
	seen := make(map[common.Address]struct{})
	for _, addr := range addrs {
		if _, exists := seen[addr]; exists {
			return false
		}
		seen[addr] = struct{}{}
	}
	return true
}

// GetOwnerIndex returns the index of an owner in the list, or -1 if not found.
func GetOwnerIndex(owner common.Address, owners []common.Address) int {
	for i, o := range owners {
		if o == owner {
			return i
		}
	}
	return -1
}
