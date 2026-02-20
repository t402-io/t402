package http

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
)

// ListResources lists discoverable resources from the Bazaar.
func (c *HTTPFacilitatorClient) ListResources(ctx context.Context, params *ListResourcesParams) (*DiscoveryResponse, error) {
	u, err := url.Parse(c.url + "/v1/discovery/resources")
	if err != nil {
		return nil, fmt.Errorf("failed to parse URL: %w", err)
	}

	if params != nil {
		q := u.Query()
		if params.Type != "" {
			q.Set("type", params.Type)
		}
		if params.Network != "" {
			q.Set("network", params.Network)
		}
		if params.Scheme != "" {
			q.Set("scheme", params.Scheme)
		}
		if params.Category != "" {
			q.Set("category", params.Category)
		}
		if params.Provider != "" {
			q.Set("provider", params.Provider)
		}
		if params.MinAmount != "" {
			q.Set("minAmount", params.MinAmount)
		}
		if params.MaxAmount != "" {
			q.Set("maxAmount", params.MaxAmount)
		}
		if params.Limit > 0 {
			q.Set("limit", strconv.Itoa(params.Limit))
		}
		if params.Offset > 0 {
			q.Set("offset", strconv.Itoa(params.Offset))
		}
		if params.ActiveOnly != nil {
			q.Set("activeOnly", strconv.FormatBool(*params.ActiveOnly))
		}
		u.RawQuery = q.Encode()
	}

	req, err := http.NewRequestWithContext(ctx, "GET", u.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create list request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("list resources request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("list resources failed (%d): %s", resp.StatusCode, string(body))
	}

	var result DiscoveryResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode list response: %w", err)
	}

	return &result, nil
}

// GetResource gets details of a specific discoverable resource.
func (c *HTTPFacilitatorClient) GetResource(ctx context.Context, id string) (*DiscoveryItem, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.url+"/v1/discovery/resources/"+url.PathEscape(id), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create get request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("get resource request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("get resource failed (%d): %s", resp.StatusCode, string(body))
	}

	var item DiscoveryItem
	if err := json.NewDecoder(resp.Body).Decode(&item); err != nil {
		return nil, fmt.Errorf("failed to decode resource: %w", err)
	}

	return &item, nil
}

// RegisterResource registers a new resource in the Bazaar.
func (c *HTTPFacilitatorClient) RegisterResource(ctx context.Context, registration *RegisterResourceRequest) (*RegisterResourceResponse, error) {
	body, err := json.Marshal(registration)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal register request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.url+"/v1/discovery/register", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create register request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("register resource request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("register resource failed (%d): %s", resp.StatusCode, string(respBody))
	}

	var result RegisterResourceResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode register response: %w", err)
	}

	return &result, nil
}

// UpdateResource updates an existing resource in the Bazaar.
func (c *HTTPFacilitatorClient) UpdateResource(ctx context.Context, id string, update *UpdateResourceRequest) (*DiscoveryItem, error) {
	body, err := json.Marshal(update)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal update request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "PUT", c.url+"/v1/discovery/resources/"+url.PathEscape(id), bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create update request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("update resource request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("update resource failed (%d): %s", resp.StatusCode, string(respBody))
	}

	var item DiscoveryItem
	if err := json.NewDecoder(resp.Body).Decode(&item); err != nil {
		return nil, fmt.Errorf("failed to decode update response: %w", err)
	}

	return &item, nil
}

// DeleteResource deletes a resource from the Bazaar.
func (c *HTTPFacilitatorClient) DeleteResource(ctx context.Context, id string) error {
	req, err := http.NewRequestWithContext(ctx, "DELETE", c.url+"/v1/discovery/resources/"+url.PathEscape(id), nil)
	if err != nil {
		return fmt.Errorf("failed to create delete request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("delete resource request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("delete resource failed (%d): %s", resp.StatusCode, string(body))
	}

	return nil
}
