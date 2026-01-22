package bridge

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"
)

// LayerZeroScanClient provides tracking for cross-chain messages via LayerZero Scan.
type LayerZeroScanClient struct {
	baseURL    string
	httpClient *http.Client
}

// NewLayerZeroScanClient creates a new LayerZero Scan client.
func NewLayerZeroScanClient() *LayerZeroScanClient {
	return &LayerZeroScanClient{
		baseURL: LayerZeroScanBaseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// NewLayerZeroScanClientWithURL creates a new client with a custom base URL.
func NewLayerZeroScanClientWithURL(baseURL string) *LayerZeroScanClient {
	return &LayerZeroScanClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// GetMessage retrieves a message by its GUID.
func (c *LayerZeroScanClient) GetMessage(ctx context.Context, guid string) (*LayerZeroMessage, error) {
	url := fmt.Sprintf("%s/messages/guid/%s", c.baseURL, guid)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch message: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("message not found: %s", guid)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("LayerZero Scan API error: %d %s", resp.StatusCode, resp.Status)
	}

	var data map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return mapAPIResponse(data), nil
}

// GetMessagesByWallet retrieves messages by wallet address.
func (c *LayerZeroScanClient) GetMessagesByWallet(ctx context.Context, address string, limit int) ([]*LayerZeroMessage, error) {
	if limit <= 0 {
		limit = 20
	}

	url := fmt.Sprintf("%s/messages/wallet/%s?limit=%d", c.baseURL, address, limit)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch messages: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("LayerZero Scan API error: %d %s", resp.StatusCode, resp.Status)
	}

	var data map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	// Extract messages array
	var messagesData []interface{}
	if msgs, ok := data["messages"].([]interface{}); ok {
		messagesData = msgs
	} else if msgs, ok := data["data"].([]interface{}); ok {
		messagesData = msgs
	}

	messages := make([]*LayerZeroMessage, 0, len(messagesData))
	for _, msgData := range messagesData {
		if msg, ok := msgData.(map[string]interface{}); ok {
			messages = append(messages, mapAPIResponse(msg))
		}
	}

	return messages, nil
}

// WaitForDelivery polls message status until delivered or failed.
func (c *LayerZeroScanClient) WaitForDelivery(ctx context.Context, guid string, opts *WaitForDeliveryOptions) (*LayerZeroMessage, error) {
	timeout := int64(DefaultTimeout)
	pollInterval := int64(DefaultPollInterval)
	var onStatusChange func(LayerZeroMessageStatus)

	if opts != nil {
		if opts.Timeout > 0 {
			timeout = opts.Timeout
		}
		if opts.PollInterval > 0 {
			pollInterval = opts.PollInterval
		}
		onStatusChange = opts.OnStatusChange
	}

	deadline := time.Now().Add(time.Duration(timeout) * time.Millisecond)
	pollDuration := time.Duration(pollInterval) * time.Millisecond
	var lastStatus LayerZeroMessageStatus

	for time.Now().Before(deadline) {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		message, err := c.GetMessage(ctx, guid)
		if err != nil {
			// Message not yet indexed, retry
			if isNotFoundError(err) {
				time.Sleep(pollDuration)
				continue
			}
			return nil, err
		}

		// Notify on status change
		if message.Status != lastStatus {
			lastStatus = message.Status
			if onStatusChange != nil {
				onStatusChange(message.Status)
			}
		}

		// Check terminal states
		switch message.Status {
		case LayerZeroStatusDelivered:
			return message, nil
		case LayerZeroStatusFailed:
			return nil, fmt.Errorf("bridge message failed: %s", guid)
		case LayerZeroStatusBlocked:
			return nil, fmt.Errorf("bridge message blocked by DVN: %s", guid)
		}

		// Continue polling for INFLIGHT/CONFIRMING
		time.Sleep(pollDuration)
	}

	return nil, fmt.Errorf("timeout waiting for message delivery: %s", guid)
}

// IsDelivered checks if a message has been delivered.
func (c *LayerZeroScanClient) IsDelivered(ctx context.Context, guid string) (bool, error) {
	message, err := c.GetMessage(ctx, guid)
	if err != nil {
		if isNotFoundError(err) {
			return false, nil
		}
		return false, err
	}
	return message.Status == LayerZeroStatusDelivered, nil
}

// mapAPIResponse maps the API response to LayerZeroMessage.
func mapAPIResponse(data map[string]interface{}) *LayerZeroMessage {
	msg := &LayerZeroMessage{}

	if v, ok := data["guid"].(string); ok {
		msg.GUID = v
	} else if v, ok := data["messageGuid"].(string); ok {
		msg.GUID = v
	}

	if v, ok := data["srcEid"].(float64); ok {
		msg.SrcEid = int(v)
	} else if v, ok := data["srcChainId"].(float64); ok {
		msg.SrcEid = int(v)
	}

	if v, ok := data["dstEid"].(float64); ok {
		msg.DstEid = int(v)
	} else if v, ok := data["dstChainId"].(float64); ok {
		msg.DstEid = int(v)
	}

	if v, ok := data["srcUaAddress"].(string); ok {
		msg.SrcUaAddress = v
	} else if v, ok := data["srcAddress"].(string); ok {
		msg.SrcUaAddress = v
	}

	if v, ok := data["dstUaAddress"].(string); ok {
		msg.DstUaAddress = v
	} else if v, ok := data["dstAddress"].(string); ok {
		msg.DstUaAddress = v
	}

	if v, ok := data["srcTxHash"].(string); ok {
		msg.SrcTxHash = v
	}

	if v, ok := data["dstTxHash"].(string); ok {
		msg.DstTxHash = v
	}

	if v, ok := data["status"].(string); ok {
		msg.Status = LayerZeroMessageStatus(v)
	} else {
		msg.Status = LayerZeroStatusInflight
	}

	if v, ok := data["srcBlockNumber"].(float64); ok {
		msg.SrcBlockNumber = int64(v)
	}

	if v, ok := data["dstBlockNumber"].(float64); ok {
		msg.DstBlockNumber = int64(v)
	}

	if v, ok := data["created"].(string); ok {
		msg.Created = v
	} else if v, ok := data["createdAt"].(string); ok {
		msg.Created = v
	}

	if v, ok := data["updated"].(string); ok {
		msg.Updated = v
	} else if v, ok := data["updatedAt"].(string); ok {
		msg.Updated = v
	}

	return msg
}

// isNotFoundError checks if the error is a "not found" error.
func isNotFoundError(err error) bool {
	if err == nil {
		return false
	}
	return errors.Is(err, errors.New("message not found")) ||
		(len(err.Error()) > 0 && (err.Error()[:min(len(err.Error()), 17)] == "message not found"))
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
