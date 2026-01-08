package main

import (
	"log"
	"sync"
	"time"

	t402 "github.com/coinbase/t402/go"
	exttypes "github.com/coinbase/t402/go/extensions/types"
)

type DiscoveredResource struct {
	Resource      string                     `json:"resource"`
	Type          string                     `json:"type"`
	T402Version   int                        `json:"t402Version"`
	Accepts       []t402.PaymentRequirements `json:"accepts"`
	DiscoveryInfo *exttypes.DiscoveryInfo    `json:"discoveryInfo,omitempty"`
	LastUpdated   string                     `json:"lastUpdated"`
	Metadata      map[string]interface{}     `json:"metadata,omitempty"`
}

type BazaarCatalog struct {
	discoveredResources map[string]DiscoveredResource
	mutex               *sync.RWMutex
}

func NewBazaarCatalog() *BazaarCatalog {
	return &BazaarCatalog{
		discoveredResources: make(map[string]DiscoveredResource),
		mutex:               &sync.RWMutex{},
	}
}

func (c *BazaarCatalog) CatalogResource(
	resourceURL string,
	method string,
	t402Version int,
	discoveryInfo *exttypes.DiscoveryInfo,
	paymentRequirements t402.PaymentRequirements,
) {
	log.Printf("📝 Discovered resource: %s", resourceURL)
	log.Printf("   Method: %s", method)
	log.Printf("   t402 Version: %d", t402Version)

	c.mutex.Lock()
	defer c.mutex.Unlock()

	c.discoveredResources[resourceURL] = DiscoveredResource{
		Resource:      resourceURL,
		Type:          "http",
		T402Version:   t402Version,
		Accepts:       []t402.PaymentRequirements{paymentRequirements},
		DiscoveryInfo: discoveryInfo,
		LastUpdated:   time.Now().Format(time.RFC3339),
		Metadata:      make(map[string]interface{}),
	}
}

func (c *BazaarCatalog) GetResources(limit, offset int) ([]DiscoveredResource, int) {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	all := make([]DiscoveredResource, 0, len(c.discoveredResources))
	for _, r := range c.discoveredResources {
		all = append(all, r)
	}

	total := len(all)
	if offset >= total {
		return []DiscoveredResource{}, total
	}

	end := offset + limit
	if end > total {
		end = total
	}

	return all[offset:end], total
}

func (c *BazaarCatalog) GetCount() int {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	return len(c.discoveredResources)
}
