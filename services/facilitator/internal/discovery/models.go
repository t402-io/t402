// Package discovery implements the Bazaar resource discovery API.
// It allows clients to register, discover, and browse t402-enabled resources.
package discovery

import (
	"time"
)

// DiscoverableResource represents a t402-enabled resource in the Bazaar.
type DiscoverableResource struct {
	ID          string    `json:"id"`
	Resource    string    `json:"resource"`
	Type        string    `json:"type"`
	T402Version int       `json:"t402Version"`
	Accepts     string    `json:"-"` // JSON string stored in DB
	Metadata    string    `json:"-"` // JSON string stored in DB
	OwnerID     string    `json:"ownerId,omitempty"`
	Active      bool      `json:"active"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"lastUpdated"`
}

// PaymentOption represents a single payment option in the accepts array.
type PaymentOption struct {
	Scheme            string                 `json:"scheme"`
	Network           string                 `json:"network"`
	Amount            string                 `json:"amount"`
	Asset             string                 `json:"asset"`
	PayTo             string                 `json:"payTo"`
	MaxTimeoutSeconds int                    `json:"maxTimeoutSeconds"`
	Extra             map[string]interface{} `json:"extra,omitempty"`
}

// ResourceMetadata contains optional metadata about the resource.
type ResourceMetadata struct {
	Category    string            `json:"category,omitempty"`
	Provider    string            `json:"provider,omitempty"`
	Description string            `json:"description,omitempty"`
	Tags        []string          `json:"tags,omitempty"`
	Custom      map[string]string `json:"custom,omitempty"`
}

// DiscoveryResponse is the response format for resource listing.
type DiscoveryResponse struct {
	T402Version int            `json:"t402Version"`
	Items       []DiscoveryItem `json:"items"`
	Pagination  PaginationInfo `json:"pagination"`
}

// DiscoveryItem is a single resource item in the discovery response.
type DiscoveryItem struct {
	ID          string            `json:"id"`
	Resource    string            `json:"resource"`
	Type        string            `json:"type"`
	T402Version int               `json:"t402Version"`
	Accepts     []PaymentOption   `json:"accepts"`
	LastUpdated int64             `json:"lastUpdated"`
	Metadata    *ResourceMetadata `json:"metadata,omitempty"`
}

// PaginationInfo contains pagination metadata.
type PaginationInfo struct {
	Limit  int `json:"limit"`
	Offset int `json:"offset"`
	Total  int `json:"total"`
}

// RegisterResourceRequest is the request body for registering a new resource.
type RegisterResourceRequest struct {
	Resource    string            `json:"resource" binding:"required"`
	Type        string            `json:"type" binding:"required"`
	T402Version int               `json:"t402Version"`
	Accepts     []PaymentOption   `json:"accepts" binding:"required,min=1"`
	Metadata    *ResourceMetadata `json:"metadata,omitempty"`
}

// RegisterResourceResponse is the response after registering a resource.
type RegisterResourceResponse struct {
	ID          string    `json:"id"`
	Resource    string    `json:"resource"`
	Type        string    `json:"type"`
	T402Version int       `json:"t402Version"`
	CreatedAt   time.Time `json:"createdAt"`
}

// ListResourcesParams contains query parameters for listing resources.
type ListResourcesParams struct {
	Type       string `form:"type"`
	Network    string `form:"network"`
	Scheme     string `form:"scheme"`
	Category   string `form:"category"`
	Provider   string `form:"provider"`
	MinAmount  string `form:"minAmount"`
	MaxAmount  string `form:"maxAmount"`
	Limit      int    `form:"limit,default=20"`
	Offset     int    `form:"offset,default=0"`
	ActiveOnly bool   `form:"activeOnly,default=true"`
}

// Validate validates the list parameters.
func (p *ListResourcesParams) Validate() {
	if p.Limit <= 0 {
		p.Limit = 20
	}
	if p.Limit > 100 {
		p.Limit = 100
	}
	if p.Offset < 0 {
		p.Offset = 0
	}
}

// UpdateResourceRequest is the request body for updating a resource.
type UpdateResourceRequest struct {
	Accepts  []PaymentOption   `json:"accepts,omitempty"`
	Metadata *ResourceMetadata `json:"metadata,omitempty"`
	Active   *bool             `json:"active,omitempty"`
}
