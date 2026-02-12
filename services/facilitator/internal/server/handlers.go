package server

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/big"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/t402-io/t402/services/facilitator/internal/errors"
	"github.com/t402-io/t402/services/facilitator/internal/idempotency"
)

// VerifyRequest is the request body for /verify
type VerifyRequest struct {
	PaymentPayload      json.RawMessage `json:"paymentPayload" binding:"required"`
	PaymentRequirements json.RawMessage `json:"paymentRequirements" binding:"required"`
}

// SettleRequest is the request body for /settle
type SettleRequest struct {
	PaymentPayload      json.RawMessage `json:"paymentPayload" binding:"required"`
	PaymentRequirements json.RawMessage `json:"paymentRequirements" binding:"required"`
}

// isValidIdempotencyKey validates that an idempotency key has a safe format
// SECURITY: Prevents DoS attacks via large keys and Redis memory issues
func isValidIdempotencyKey(key string) bool {
	// Max length check to prevent Redis memory abuse
	if len(key) > 64 || len(key) == 0 {
		return false
	}

	// Only allow alphanumeric characters, hyphens, and underscores
	for _, c := range key {
		if !((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
			(c >= '0' && c <= '9') || c == '-' || c == '_') {
			return false
		}
	}

	return true
}

// P1-5: validateNetwork checks that the network is in the supported list.
// Returns an error if the network is unknown, preventing silent failures
// when GetSigners returns nil/empty for unrecognized networks.
func (s *Server) validateNetwork(network string) *errors.APIError {
	if network == "" || network == "unknown" {
		return errors.NewUnsupportedNetworkError(network)
	}
	supported := s.facilitator.GetSupported()
	for _, kind := range supported.Kinds {
		if kind.Network == network {
			return nil
		}
	}
	return errors.NewUnsupportedNetworkError(network)
}

// handleVerify handles POST /verify
func (s *Server) handleVerify(c *gin.Context) {
	var req VerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// Log detailed error internally
		log.Printf("Invalid verify request body: %v", err)
		apiErr := errors.NewInvalidRequestError(err.Error())
		c.JSON(apiErr.HTTPStatus(), apiErr)
		return
	}

	// Extract network/scheme for metrics from requirements
	network, scheme := extractNetworkScheme(req.PaymentRequirements)

	// P1-5: Validate network is supported before proceeding
	if apiErr := s.validateNetwork(network); apiErr != nil {
		log.Printf("Unsupported network in verify request: %s", network)
		c.JSON(apiErr.HTTPStatus(), apiErr)
		return
	}

	// P1-10: Check signature expiration
	if deadline, hasDeadline := extractDeadline(req.PaymentPayload); hasDeadline {
		now := time.Now().Unix()
		if deadline < now {
			log.Printf("Signature expired for network=%s scheme=%s: deadline=%d now=%d", network, scheme, deadline, now)
			apiErr := errors.NewSignatureExpiredError()
			c.JSON(apiErr.HTTPStatus(), apiErr)
			return
		}
	}

	// Call facilitator verify
	result, err := s.facilitator.Verify(
		c.Request.Context(),
		req.PaymentPayload,
		req.PaymentRequirements,
	)

	if err != nil {
		s.metrics.RecordVerify(network, scheme, false)
		// Log detailed error internally, return generic message to client
		log.Printf("Verification failed for network=%s scheme=%s: %v", network, scheme, err)
		apiErr := errors.NewInternalError("verification service error")
		c.JSON(http.StatusInternalServerError, apiErr)
		return
	}

	// Record metrics
	s.metrics.RecordVerify(network, scheme, result.IsValid)

	c.JSON(http.StatusOK, result)
}

// handleSettle handles POST /settle
func (s *Server) handleSettle(c *gin.Context) {
	var req SettleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// Log detailed error internally
		log.Printf("Invalid settle request body: %v", err)
		apiErr := errors.NewInvalidRequestError(err.Error())
		c.JSON(apiErr.HTTPStatus(), apiErr)
		return
	}

	// Extract network/scheme for metrics from requirements
	network, scheme := extractNetworkScheme(req.PaymentRequirements)

	// P1-5: Validate network is supported before proceeding
	if apiErr := s.validateNetwork(network); apiErr != nil {
		log.Printf("Unsupported network in settle request: %s", network)
		c.JSON(apiErr.HTTPStatus(), apiErr)
		return
	}

	// P1-10: Check signature expiration before settlement
	if deadline, hasDeadline := extractDeadline(req.PaymentPayload); hasDeadline {
		now := time.Now().Unix()
		if deadline < now {
			log.Printf("Signature expired for settlement network=%s scheme=%s: deadline=%d now=%d", network, scheme, deadline, now)
			apiErr := errors.NewSignatureExpiredError()
			c.JSON(apiErr.HTTPStatus(), apiErr)
			return
		}
	}

	// P1-2: Validate payment amount meets requirements
	payloadAmount, requiredAmount, amountErr := extractAmounts(req.PaymentPayload, req.PaymentRequirements)
	if amountErr != nil {
		// P1-2: Reject malformed amounts instead of silently skipping validation
		log.Printf("Invalid amount format for network=%s scheme=%s: %v", network, scheme, amountErr)
		apiErr := errors.NewInvalidRequestError("invalid amount format in payload or requirements")
		c.JSON(apiErr.HTTPStatus(), apiErr)
		return
	}
	if payloadAmount != nil && requiredAmount != nil {
		if payloadAmount.Cmp(requiredAmount) < 0 {
			log.Printf("Insufficient payment amount for network=%s scheme=%s: payload=%s required=%s",
				network, scheme, payloadAmount.String(), requiredAmount.String())
			apiErr := errors.NewInsufficientAmountError(payloadAmount.String(), requiredAmount.String())
			c.JSON(apiErr.HTTPStatus(), apiErr)
			return
		}
	}

	// P1-1: Check for nonce replay before settlement
	if s.nonceStore != nil {
		payloadHash := idempotency.ComputePayloadHash(req.PaymentPayload, req.PaymentRequirements)
		if err := s.nonceStore.CheckAndMark(c.Request.Context(), network, scheme, payloadHash); err != nil {
			if err == idempotency.ErrNonceAlreadyUsed {
				log.Printf("Nonce replay detected for network=%s scheme=%s", network, scheme)
				apiErr := errors.NewNonceReplayError()
				c.JSON(http.StatusConflict, apiErr)
				return
			}
			// P1-1: Fail closed for /settle to prevent double settlement
			log.Printf("Nonce check error for network=%s scheme=%s: %v", network, scheme, err)
			apiErr := errors.NewInternalError("nonce verification unavailable")
			c.JSON(http.StatusServiceUnavailable, apiErr)
			return
		}
	}

	// Get idempotency key from header
	idempotencyKey := c.GetHeader("Idempotency-Key")
	ctx := c.Request.Context()

	// SECURITY: Validate idempotency key format to prevent DoS and Redis memory issues
	if idempotencyKey != "" && !isValidIdempotencyKey(idempotencyKey) {
		apiErr := errors.NewInvalidIdempotencyKeyError()
		c.JSON(apiErr.HTTPStatus(), apiErr)
		return
	}

	// Atomic idempotency check-and-create to prevent TOCTOU race condition
	// SECURITY: Warn when idempotency key is provided but store is unavailable
	if idempotencyKey != "" && s.idempotencyStore == nil {
		log.Printf("WARNING: Idempotency key provided but idempotency store is not configured. Request proceeding without idempotency protection.")
	}
	if idempotencyKey != "" && s.idempotencyStore != nil {
		payloadHash := idempotency.ComputePayloadHash(req.PaymentPayload, req.PaymentRequirements)

		// Atomic check-and-create operation
		result, err := s.idempotencyStore.CheckAndCreate(ctx, idempotencyKey, payloadHash)
		if err != nil {
			if err == idempotency.ErrPayloadMismatch {
				log.Printf("Idempotency payload mismatch for key=%s", idempotencyKey)
				apiErr := errors.NewIdempotencyConflictError()
				c.JSON(http.StatusConflict, apiErr)
				return
			}
			// Idempotency store error - fail closed to prevent double settlement
			log.Printf("Idempotency check-and-create failed for key=%s: %v", idempotencyKey, err)
			apiErr := errors.NewIdempotencyUnavailableError()
			c.JSON(http.StatusServiceUnavailable, apiErr)
			return
		}

		// If entry already exists, handle based on status
		if !result.Created && result.Entry != nil {
			switch result.Entry.Status {
			case idempotency.StatusCompleted:
				// Return cached result
				log.Printf("Returning cached result for idempotency key=%s", idempotencyKey)
				c.Header("X-Idempotency-Replayed", "true")
				c.Data(http.StatusOK, "application/json", result.Entry.Result)
				return
			case idempotency.StatusPending:
				// Request still in progress
				log.Printf("Request in progress for idempotency key=%s", idempotencyKey)
				apiErr := errors.NewRequestInProgressError()
				c.JSON(http.StatusConflict, apiErr)
				return
			case idempotency.StatusFailed:
				// Previous request failed - for now, still reject to be safe
				// A separate retry mechanism should handle failed entries
				log.Printf("Previous request failed for idempotency key=%s, rejecting duplicate", idempotencyKey)
				apiErr := errors.NewPreviousRequestFailedError()
				c.JSON(http.StatusConflict, apiErr)
				return
			}
		}
		// result.Created == true means we successfully created a pending entry
		// Proceed with settlement
	}

	// Call facilitator settle
	settleResult, err := s.facilitator.Settle(
		ctx,
		req.PaymentPayload,
		req.PaymentRequirements,
	)

	if err != nil {
		s.metrics.RecordSettle(network, scheme, false)
		// Log detailed error internally, return generic message to client
		log.Printf("Settlement failed for network=%s scheme=%s: %v", network, scheme, err)

		// Mark idempotency entry as failed
		if idempotencyKey != "" && s.idempotencyStore != nil {
			if markErr := s.idempotencyStore.Fail(ctx, idempotencyKey, "settlement_error"); markErr != nil {
				log.Printf("Failed to mark idempotency entry as failed for key=%s: %v", idempotencyKey, markErr)
			}
		}

		// SECURITY: Don't leak internal error details to the client
		apiErr := errors.NewSettlementFailedError("settlement processing failed")
		c.JSON(apiErr.HTTPStatus(), apiErr)
		return
	}

	// Record metrics
	s.metrics.RecordSettle(network, scheme, settleResult.Success)

	// P1-13: Set confirmations status for successful settlements.
	// Receipt confirmation is done by the SDK, but full finality (block depth)
	// is tracked asynchronously. Mark as "pending" to indicate finality not guaranteed.
	if settleResult.Success && settleResult.Transaction != "" {
		settleResult.Confirmations = "pending"
	}

	status := http.StatusOK
	if !settleResult.Success {
		status = http.StatusUnprocessableEntity
		// Mark as failed for unsuccessful settlements
		if idempotencyKey != "" && s.idempotencyStore != nil {
			if markErr := s.idempotencyStore.Fail(ctx, idempotencyKey, settleResult.ErrorReason); markErr != nil {
				log.Printf("Failed to mark idempotency entry as failed for key=%s: %v", idempotencyKey, markErr)
			}
		}
	} else {
		// Mark as completed for successful settlements
		if idempotencyKey != "" && s.idempotencyStore != nil {
			resultBytes, marshalErr := json.Marshal(settleResult)
			if marshalErr != nil {
				log.Printf("CRITICAL: Failed to marshal settlement result for key=%s: %v", idempotencyKey, marshalErr)
			} else if markErr := s.idempotencyStore.Complete(ctx, idempotencyKey, resultBytes); markErr != nil {
				log.Printf("CRITICAL: Failed to mark idempotency entry as completed for key=%s: %v", idempotencyKey, markErr)
			}
		}
	}

	c.JSON(status, settleResult)
}

// handleSupported handles GET /supported
func (s *Server) handleSupported(c *gin.Context) {
	supported := s.facilitator.GetSupported()
	c.JSON(http.StatusOK, supported)
}

// extractNetworkScheme extracts network and scheme from requirements JSON for metrics
func extractNetworkScheme(requirements json.RawMessage) (string, string) {
	var req struct {
		Network string `json:"network"`
		Scheme  string `json:"scheme"`
	}
	if err := json.Unmarshal(requirements, &req); err != nil {
		return "unknown", "unknown"
	}
	return req.Network, req.Scheme
}

// P1-10: extractDeadline extracts the deadline/validBefore field from payment payload
// Handles both T402 V1 (flat) and V2 (nested payload) formats
func extractDeadline(payload json.RawMessage) (int64, bool) {
	// T402 V2 format: {"t402Version":2,"payload":{"validBefore":...},...}
	// T402 V1 format: {"validBefore":...}
	var p struct {
		T402Version int `json:"t402Version"`
		Payload     struct {
			Deadline    int64 `json:"deadline"`
			ValidBefore int64 `json:"validBefore"`
		} `json:"payload"`
		// Top-level fields for V1 compatibility
		Deadline    int64 `json:"deadline"`
		ValidBefore int64 `json:"validBefore"`
	}
	if err := json.Unmarshal(payload, &p); err != nil {
		return 0, false
	}

	// Check V2 nested payload first
	if p.T402Version >= 2 {
		if p.Payload.ValidBefore > 0 {
			return p.Payload.ValidBefore, true
		}
		if p.Payload.Deadline > 0 {
			return p.Payload.Deadline, true
		}
	}

	// Fall back to top-level (V1 format)
	// Check validBefore first (EIP-3009 format)
	if p.ValidBefore > 0 {
		return p.ValidBefore, true
	}
	// Then check deadline
	if p.Deadline > 0 {
		return p.Deadline, true
	}
	return 0, false
}

// P1-2: extractAmounts extracts and compares amounts from payload and requirements
// Handles both T402 V1 (flat) and V2 (nested payload) formats
func extractAmounts(payload, requirements json.RawMessage) (payloadAmount, requiredAmount *big.Int, err error) {
	// T402 V2 format: {"t402Version":2,"payload":{"amount":"...",...},...}
	// T402 V1 format: {"amount":"...",...}
	var v2Payload struct {
		T402Version int `json:"t402Version"`
		Payload     struct {
			Amount string `json:"amount"`
			Value  string `json:"value"` // alternative field name
		} `json:"payload"`
		// Also check top level for V1 compatibility
		Amount string `json:"amount"`
		Value  string `json:"value"`
	}
	var r struct {
		Amount string `json:"amount"`
	}

	if err := json.Unmarshal(payload, &v2Payload); err != nil {
		return nil, nil, err
	}
	if err := json.Unmarshal(requirements, &r); err != nil {
		return nil, nil, err
	}

	// Get payload amount - check V2 nested payload first, then fall back to V1 top-level
	var amountStr string
	if v2Payload.T402Version >= 2 {
		// V2 format: look in nested payload
		amountStr = v2Payload.Payload.Amount
		if amountStr == "" {
			amountStr = v2Payload.Payload.Value
		}
	}
	// Fall back to top-level (V1 format or legacy)
	if amountStr == "" {
		amountStr = v2Payload.Amount
		if amountStr == "" {
			amountStr = v2Payload.Value
		}
	}

	payloadAmt := new(big.Int)
	if amountStr != "" {
		if _, ok := payloadAmt.SetString(amountStr, 10); !ok {
			// P1-2: Return error instead of silently skipping validation
			return nil, nil, fmt.Errorf("invalid payload amount: %s", amountStr)
		}
	}

	requiredAmt := new(big.Int)
	if r.Amount != "" {
		if _, ok := requiredAmt.SetString(r.Amount, 10); !ok {
			// P1-2: Return error instead of silently skipping validation
			return nil, nil, fmt.Errorf("invalid required amount: %s", r.Amount)
		}
	}

	return payloadAmt, requiredAmt, nil
}

// readBody reads the request body (helper for raw body handling)
func readBody(c *gin.Context) ([]byte, error) {
	return io.ReadAll(c.Request.Body)
}
