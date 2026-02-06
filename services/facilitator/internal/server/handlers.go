package server

import (
	"encoding/json"
	"io"
	"log"
	"math/big"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/t402-io/t402/services/facilitator/internal/idempotency"
)

// ErrorCode represents a structured error code for API responses
type ErrorCode string

const (
	ErrCodeInvalidRequest     ErrorCode = "INVALID_REQUEST"
	ErrCodeVerificationFailed ErrorCode = "VERIFICATION_FAILED"
	ErrCodeSettlementFailed   ErrorCode = "SETTLEMENT_FAILED"
	ErrCodeRequestInProgress  ErrorCode = "REQUEST_IN_PROGRESS"
	ErrCodePayloadMismatch    ErrorCode = "PAYLOAD_MISMATCH"
)

// APIError represents a structured error response
type APIError struct {
	Code    ErrorCode `json:"code"`
	Message string    `json:"message"`
}

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

// handleVerify handles POST /verify
func (s *Server) handleVerify(c *gin.Context) {
	var req VerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// Log detailed error internally
		log.Printf("Invalid verify request body: %v", err)
		c.JSON(http.StatusBadRequest, APIError{
			Code:    ErrCodeInvalidRequest,
			Message: "Invalid request body",
		})
		return
	}

	// Extract network/scheme for metrics from requirements
	network, scheme := extractNetworkScheme(req.PaymentRequirements)

	// P1-10: Check signature expiration
	if deadline, hasDeadline := extractDeadline(req.PaymentPayload); hasDeadline {
		now := time.Now().Unix()
		if deadline < now {
			log.Printf("Signature expired for network=%s scheme=%s: deadline=%d now=%d", network, scheme, deadline, now)
			c.JSON(http.StatusBadRequest, APIError{
				Code:    "SIGNATURE_EXPIRED",
				Message: "Payment signature has expired",
			})
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
		c.JSON(http.StatusInternalServerError, APIError{
			Code:    ErrCodeVerificationFailed,
			Message: "Payment verification failed",
		})
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
		c.JSON(http.StatusBadRequest, APIError{
			Code:    ErrCodeInvalidRequest,
			Message: "Invalid request body",
		})
		return
	}

	// Extract network/scheme for metrics from requirements
	network, scheme := extractNetworkScheme(req.PaymentRequirements)

	// P1-10: Check signature expiration before settlement
	if deadline, hasDeadline := extractDeadline(req.PaymentPayload); hasDeadline {
		now := time.Now().Unix()
		if deadline < now {
			log.Printf("Signature expired for settlement network=%s scheme=%s: deadline=%d now=%d", network, scheme, deadline, now)
			c.JSON(http.StatusBadRequest, APIError{
				Code:    "SIGNATURE_EXPIRED",
				Message: "Payment signature has expired",
			})
			return
		}
	}

	// P1-2: Validate payment amount meets requirements
	payloadAmount, requiredAmount, amountErr := extractAmounts(req.PaymentPayload, req.PaymentRequirements)
	if amountErr == nil && payloadAmount != nil && requiredAmount != nil {
		if payloadAmount.Cmp(requiredAmount) < 0 {
			log.Printf("Insufficient payment amount for network=%s scheme=%s: payload=%s required=%s",
				network, scheme, payloadAmount.String(), requiredAmount.String())
			c.JSON(http.StatusBadRequest, APIError{
				Code:    "INSUFFICIENT_AMOUNT",
				Message: "Payment amount is less than required amount",
			})
			return
		}
	}

	// P1-1: Check for nonce replay before settlement
	if s.nonceStore != nil {
		payloadHash := idempotency.ComputePayloadHash(req.PaymentPayload, req.PaymentRequirements)
		if err := s.nonceStore.CheckAndMark(c.Request.Context(), network, scheme, payloadHash); err != nil {
			if err == idempotency.ErrNonceAlreadyUsed {
				log.Printf("Nonce replay detected for network=%s scheme=%s", network, scheme)
				c.JSON(http.StatusConflict, APIError{
					Code:    "NONCE_REPLAY",
					Message: "This payment authorization has already been used",
				})
				return
			}
			// Log other errors but don't block - fail open for availability
			log.Printf("Nonce check error for network=%s scheme=%s: %v", network, scheme, err)
		}
	}

	// Get idempotency key from header
	idempotencyKey := c.GetHeader("Idempotency-Key")
	ctx := c.Request.Context()

	// SECURITY: Validate idempotency key format to prevent DoS and Redis memory issues
	if idempotencyKey != "" && !isValidIdempotencyKey(idempotencyKey) {
		c.JSON(http.StatusBadRequest, APIError{
			Code:    "INVALID_IDEMPOTENCY_KEY",
			Message: "Invalid idempotency key format (max 64 chars, alphanumeric and hyphens only)",
		})
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
				c.JSON(http.StatusConflict, APIError{
					Code:    ErrCodePayloadMismatch,
					Message: "Request payload does not match previous request with this idempotency key",
				})
				return
			}
			// Idempotency store error - fail closed to prevent double settlement
			log.Printf("Idempotency check-and-create failed for key=%s: %v", idempotencyKey, err)
			c.JSON(http.StatusServiceUnavailable, APIError{
				Code:    "IDEMPOTENCY_UNAVAILABLE",
				Message: "Idempotency service temporarily unavailable",
			})
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
				c.JSON(http.StatusConflict, APIError{
					Code:    ErrCodeRequestInProgress,
					Message: "A request with this idempotency key is already being processed",
				})
				return
			case idempotency.StatusFailed:
				// Previous request failed - for now, still reject to be safe
				// A separate retry mechanism should handle failed entries
				log.Printf("Previous request failed for idempotency key=%s, rejecting duplicate", idempotencyKey)
				c.JSON(http.StatusConflict, APIError{
					Code:    "PREVIOUS_REQUEST_FAILED",
					Message: "Previous request with this idempotency key failed. Use a new key to retry.",
				})
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

		c.JSON(http.StatusInternalServerError, APIError{
			Code:    ErrCodeSettlementFailed,
			Message: "Payment settlement failed",
		})
		return
	}

	// Record metrics
	s.metrics.RecordSettle(network, scheme, settleResult.Success)

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
			return nil, nil, nil // Can't parse, let downstream handle
		}
	}

	requiredAmt := new(big.Int)
	if r.Amount != "" {
		if _, ok := requiredAmt.SetString(r.Amount, 10); !ok {
			return nil, nil, nil // Can't parse, let downstream handle
		}
	}

	return payloadAmt, requiredAmt, nil
}

// readBody reads the request body (helper for raw body handling)
func readBody(c *gin.Context) ([]byte, error) {
	return io.ReadAll(c.Request.Body)
}
