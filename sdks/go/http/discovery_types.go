package http

import "time"

// DiscoveryPaymentOption represents a single payment option for a discovery resource.
type DiscoveryPaymentOption struct {
	Scheme            string                 `json:"scheme"`
	Network           string                 `json:"network"`
	Amount            string                 `json:"amount"`
	Asset             string                 `json:"asset"`
	PayTo             string                 `json:"payTo"`
	MaxTimeoutSeconds int                    `json:"maxTimeoutSeconds"`
	Extra             map[string]interface{} `json:"extra,omitempty"`
}

// ResourceMetadata contains optional metadata about a discovery resource.
type ResourceMetadata struct {
	Category    string            `json:"category,omitempty"`
	Provider    string            `json:"provider,omitempty"`
	Description string            `json:"description,omitempty"`
	Tags        []string          `json:"tags,omitempty"`
	Custom      map[string]string `json:"custom,omitempty"`
}

// DiscoveryItem is a single resource in the discovery response.
type DiscoveryItem struct {
	ID          string            `json:"id"`
	Resource    string            `json:"resource"`
	Type        string            `json:"type"`
	T402Version int               `json:"t402Version"`
	Accepts     []DiscoveryPaymentOption `json:"accepts"`
	LastUpdated int64                    `json:"lastUpdated"`
	Metadata    *ResourceMetadata `json:"metadata,omitempty"`
}

// PaginationInfo contains pagination metadata.
type PaginationInfo struct {
	Limit  int `json:"limit"`
	Offset int `json:"offset"`
	Total  int `json:"total"`
}

// DiscoveryResponse is the response format for resource listing.
type DiscoveryResponse struct {
	T402Version int             `json:"t402Version"`
	Items       []DiscoveryItem `json:"items"`
	Pagination  PaginationInfo  `json:"pagination"`
}

// ListResourcesParams contains query parameters for listing resources.
type ListResourcesParams struct {
	Type       string
	Network    string
	Scheme     string
	Category   string
	Provider   string
	MinAmount  string
	MaxAmount  string
	Limit      int
	Offset     int
	ActiveOnly *bool
}

// RegisterResourceRequest is the request body for registering a new resource.
type RegisterResourceRequest struct {
	Resource    string                   `json:"resource"`
	Type        string                   `json:"type"`
	T402Version int                      `json:"t402Version,omitempty"`
	Accepts     []DiscoveryPaymentOption `json:"accepts"`
	Metadata    *ResourceMetadata        `json:"metadata,omitempty"`
}

// RegisterResourceResponse is the response after registering a resource.
type RegisterResourceResponse struct {
	ID          string    `json:"id"`
	Resource    string    `json:"resource"`
	Type        string    `json:"type"`
	T402Version int       `json:"t402Version"`
	CreatedAt   time.Time `json:"createdAt"`
}

// UpdateResourceRequest is the request body for updating a resource.
type UpdateResourceRequest struct {
	Accepts  []DiscoveryPaymentOption `json:"accepts,omitempty"`
	Metadata *ResourceMetadata `json:"metadata,omitempty"`
	Active   *bool             `json:"active,omitempty"`
}
