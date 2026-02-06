package discovery

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	_ "github.com/mattn/go-sqlite3"
)

func setupTestDB(t *testing.T) *sql.DB {
	db, err := sql.Open("sqlite3", ":memory:")
	require.NoError(t, err)

	// Create schema (SQLite version - no JSONB, use TEXT)
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS discoverable_resources (
			id VARCHAR(255) PRIMARY KEY,
			resource TEXT NOT NULL UNIQUE,
			type VARCHAR(50) NOT NULL,
			t402_version INTEGER NOT NULL DEFAULT 2,
			accepts TEXT NOT NULL,
			metadata TEXT DEFAULT '{}',
			owner_id VARCHAR(255),
			active BOOLEAN NOT NULL DEFAULT 1,
			created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
		)
	`)
	require.NoError(t, err)

	// Create indexes
	_, err = db.Exec(`CREATE INDEX IF NOT EXISTS idx_discoverable_resources_type ON discoverable_resources(type)`)
	require.NoError(t, err)
	_, err = db.Exec(`CREATE INDEX IF NOT EXISTS idx_discoverable_resources_owner_id ON discoverable_resources(owner_id)`)
	require.NoError(t, err)
	_, err = db.Exec(`CREATE INDEX IF NOT EXISTS idx_discoverable_resources_active ON discoverable_resources(active)`)
	require.NoError(t, err)

	return db
}

func setupTestRouter(t *testing.T) (*gin.Engine, *Repository) {
	gin.SetMode(gin.TestMode)
	router := gin.New()

	db := setupTestDB(t)
	repo := NewRepository(db)
	handlers := NewHandlers(repo)

	v1 := router.Group("/v1")
	handlers.RegisterRoutes(v1)

	return router, repo
}

func TestListResources_Empty(t *testing.T) {
	router, _ := setupTestRouter(t)

	req, _ := http.NewRequest("GET", "/v1/discovery/resources", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response DiscoveryResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.Equal(t, 2, response.T402Version)
	assert.Empty(t, response.Items)
	assert.Equal(t, 0, response.Pagination.Total)
}

func TestRegisterResource_Success(t *testing.T) {
	router, _ := setupTestRouter(t)

	reqBody := RegisterResourceRequest{
		Resource:    "https://api.example.com/data",
		Type:        "http",
		T402Version: 2,
		Accepts: []PaymentOption{
			{
				Scheme:            "exact",
				Network:           "eip155:8453",
				Amount:            "1000000",
				Asset:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
				PayTo:             "0xTestPayTo",
				MaxTimeoutSeconds: 3600,
			},
		},
		Metadata: &ResourceMetadata{
			Category: "finance",
			Provider: "Example Corp",
		},
	}

	body, _ := json.Marshal(reqBody)
	req, _ := http.NewRequest("POST", "/v1/discovery/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)

	var response RegisterResourceResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.NotEmpty(t, response.ID)
	assert.Equal(t, "https://api.example.com/data", response.Resource)
	assert.Equal(t, "http", response.Type)
	assert.Equal(t, 2, response.T402Version)
}

func TestRegisterResource_MissingFields(t *testing.T) {
	router, _ := setupTestRouter(t)

	testCases := []struct {
		name    string
		request RegisterResourceRequest
	}{
		{
			name: "missing resource",
			request: RegisterResourceRequest{
				Type: "http",
				Accepts: []PaymentOption{
					{Scheme: "exact", Network: "eip155:8453", Amount: "100", Asset: "0x", PayTo: "0x"},
				},
			},
		},
		{
			name: "missing type",
			request: RegisterResourceRequest{
				Resource: "https://api.example.com",
				Accepts: []PaymentOption{
					{Scheme: "exact", Network: "eip155:8453", Amount: "100", Asset: "0x", PayTo: "0x"},
				},
			},
		},
		{
			name: "missing accepts",
			request: RegisterResourceRequest{
				Resource: "https://api.example.com",
				Type:     "http",
				Accepts:  []PaymentOption{},
			},
		},
		{
			name: "missing scheme in accepts",
			request: RegisterResourceRequest{
				Resource: "https://api.example.com",
				Type:     "http",
				Accepts: []PaymentOption{
					{Network: "eip155:8453", Amount: "100", Asset: "0x", PayTo: "0x"},
				},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			body, _ := json.Marshal(tc.request)
			req, _ := http.NewRequest("POST", "/v1/discovery/register", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, http.StatusBadRequest, w.Code)
		})
	}
}

func TestGetResource_Success(t *testing.T) {
	router, repo := setupTestRouter(t)

	// Create a resource first
	resource, err := repo.Create(nil, &RegisterResourceRequest{
		Resource:    "https://api.example.com/data",
		Type:        "http",
		T402Version: 2,
		Accepts: []PaymentOption{
			{Scheme: "exact", Network: "eip155:8453", Amount: "1000000", Asset: "0x", PayTo: "0x", MaxTimeoutSeconds: 3600},
		},
	}, "test-owner")
	require.NoError(t, err)

	// Get the resource
	req, _ := http.NewRequest("GET", "/v1/discovery/resources/"+resource.ID, nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response DiscoveryItem
	err = json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.Equal(t, resource.ID, response.ID)
	assert.Equal(t, "https://api.example.com/data", response.Resource)
}

func TestGetResource_NotFound(t *testing.T) {
	router, _ := setupTestRouter(t)

	req, _ := http.NewRequest("GET", "/v1/discovery/resources/nonexistent", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestListResources_WithTypeFilter(t *testing.T) {
	router, repo := setupTestRouter(t)

	// Create multiple resources
	_, err := repo.Create(nil, &RegisterResourceRequest{
		Resource:    "https://api.example.com/data1",
		Type:        "http",
		T402Version: 2,
		Accepts: []PaymentOption{
			{Scheme: "exact", Network: "eip155:8453", Amount: "1000000", Asset: "0x", PayTo: "0x", MaxTimeoutSeconds: 3600},
		},
		Metadata: &ResourceMetadata{Category: "finance"},
	}, "owner1")
	require.NoError(t, err)

	_, err = repo.Create(nil, &RegisterResourceRequest{
		Resource:    "https://api.example.com/data2",
		Type:        "mcp",
		T402Version: 2,
		Accepts: []PaymentOption{
			{Scheme: "upto", Network: "eip155:1", Amount: "2000000", Asset: "0x", PayTo: "0x", MaxTimeoutSeconds: 3600},
		},
		Metadata: &ResourceMetadata{Category: "analytics"},
	}, "owner2")
	require.NoError(t, err)

	// Test filter by type
	req, _ := http.NewRequest("GET", "/v1/discovery/resources?type=http", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response DiscoveryResponse
	err = json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.Len(t, response.Items, 1)
	assert.Equal(t, "http", response.Items[0].Type)
}

func TestListResources_Pagination(t *testing.T) {
	router, repo := setupTestRouter(t)

	// Create multiple resources
	for i := 0; i < 5; i++ {
		_, err := repo.Create(nil, &RegisterResourceRequest{
			Resource:    "https://api.example.com/data" + string(rune('0'+i)),
			Type:        "http",
			T402Version: 2,
			Accepts: []PaymentOption{
				{Scheme: "exact", Network: "eip155:8453", Amount: "1000000", Asset: "0x", PayTo: "0x", MaxTimeoutSeconds: 3600},
			},
		}, "owner")
		require.NoError(t, err)
	}

	// Test pagination
	req, _ := http.NewRequest("GET", "/v1/discovery/resources?limit=2&offset=0", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response DiscoveryResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.Len(t, response.Items, 2)
	assert.Equal(t, 5, response.Pagination.Total)
	assert.Equal(t, 2, response.Pagination.Limit)
	assert.Equal(t, 0, response.Pagination.Offset)
}

func TestUpdateResource_Success(t *testing.T) {
	router, repo := setupTestRouter(t)

	// Create a resource
	resource, err := repo.Create(nil, &RegisterResourceRequest{
		Resource:    "https://api.example.com/data",
		Type:        "http",
		T402Version: 2,
		Accepts: []PaymentOption{
			{Scheme: "exact", Network: "eip155:8453", Amount: "1000000", Asset: "0x", PayTo: "0x", MaxTimeoutSeconds: 3600},
		},
	}, "")
	require.NoError(t, err)

	// Update the resource
	updateReq := UpdateResourceRequest{
		Accepts: []PaymentOption{
			{Scheme: "exact", Network: "eip155:8453", Amount: "2000000", Asset: "0x", PayTo: "0x", MaxTimeoutSeconds: 7200},
		},
	}

	body, _ := json.Marshal(updateReq)
	req, _ := http.NewRequest("PUT", "/v1/discovery/resources/"+resource.ID, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response DiscoveryItem
	err = json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.Equal(t, "2000000", response.Accepts[0].Amount)
}

func TestDeleteResource_Success(t *testing.T) {
	router, repo := setupTestRouter(t)

	// Create a resource
	resource, err := repo.Create(nil, &RegisterResourceRequest{
		Resource:    "https://api.example.com/data",
		Type:        "http",
		T402Version: 2,
		Accepts: []PaymentOption{
			{Scheme: "exact", Network: "eip155:8453", Amount: "1000000", Asset: "0x", PayTo: "0x", MaxTimeoutSeconds: 3600},
		},
	}, "")
	require.NoError(t, err)

	// Delete the resource
	req, _ := http.NewRequest("DELETE", "/v1/discovery/resources/"+resource.ID, nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNoContent, w.Code)

	// Verify it's no longer listed (active = false)
	getReq, _ := http.NewRequest("GET", "/v1/discovery/resources", nil)
	getW := httptest.NewRecorder()
	router.ServeHTTP(getW, getReq)

	var response DiscoveryResponse
	err = json.Unmarshal(getW.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.Empty(t, response.Items)
}

func TestRegisterResource_Duplicate(t *testing.T) {
	router, _ := setupTestRouter(t)

	reqBody := RegisterResourceRequest{
		Resource:    "https://api.example.com/unique",
		Type:        "http",
		T402Version: 2,
		Accepts: []PaymentOption{
			{Scheme: "exact", Network: "eip155:8453", Amount: "1000000", Asset: "0x", PayTo: "0x", MaxTimeoutSeconds: 3600},
		},
	}

	body, _ := json.Marshal(reqBody)

	// First registration should succeed
	req1, _ := http.NewRequest("POST", "/v1/discovery/register", bytes.NewReader(body))
	req1.Header.Set("Content-Type", "application/json")
	w1 := httptest.NewRecorder()
	router.ServeHTTP(w1, req1)
	assert.Equal(t, http.StatusCreated, w1.Code)

	// Second registration should fail with conflict
	req2, _ := http.NewRequest("POST", "/v1/discovery/register", bytes.NewReader(body))
	req2.Header.Set("Content-Type", "application/json")
	w2 := httptest.NewRecorder()
	router.ServeHTTP(w2, req2)
	assert.Equal(t, http.StatusConflict, w2.Code)
}
