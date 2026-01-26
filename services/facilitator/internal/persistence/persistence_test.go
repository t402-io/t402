package persistence

import (
	"context"
	"encoding/json"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// skipIfNoDatabase skips the test if DATABASE_TEST_URL is not set
func skipIfNoDatabase(t *testing.T) *DB {
	t.Helper()
	url := os.Getenv("DATABASE_TEST_URL")
	if url == "" {
		t.Skip("DATABASE_TEST_URL not set, skipping database integration test")
	}

	db, err := NewDB(&DBConfig{
		URL:             url,
		MaxConnections:  5,
		IdleConnections: 2,
		AutoMigrate:     true,
	})
	require.NoError(t, err)
	return db
}

// cleanupDatabase removes all test data
func cleanupDatabase(t *testing.T, db *DB) {
	t.Helper()
	ctx := context.Background()
	_, _ = db.ExecContext(ctx, "DELETE FROM audit_logs")
	_, _ = db.ExecContext(ctx, "DELETE FROM settlements")
}

func TestSettlementRepository_Create(t *testing.T) {
	db := skipIfNoDatabase(t)
	defer db.Close()
	defer cleanupDatabase(t, db)

	repo := NewSettlementRepository(db)
	ctx := context.Background()

	settlement := &Settlement{
		Network:     "eip155:1",
		Scheme:      "exact",
		FromAddress: "0x1234567890123456789012345678901234567890",
		ToAddress:   "0x0987654321098765432109876543210987654321",
		Amount:      "1000000",
		Asset:       "0xdAC17F958D2ee523a2206206994597C13D831ec7",
		Status:      SettlementStatusPending,
		CreatedAt:   time.Now().UTC(),
		Metadata:    json.RawMessage(`{"requestId": "test-123"}`),
	}

	err := repo.Create(ctx, settlement)
	require.NoError(t, err)
	assert.NotEmpty(t, settlement.ID)

	// Verify we can retrieve it
	retrieved, err := repo.GetByID(ctx, settlement.ID)
	require.NoError(t, err)
	require.NotNil(t, retrieved)
	assert.Equal(t, settlement.Network, retrieved.Network)
	assert.Equal(t, settlement.Scheme, retrieved.Scheme)
	assert.Equal(t, settlement.FromAddress, retrieved.FromAddress)
	assert.Equal(t, settlement.ToAddress, retrieved.ToAddress)
	assert.Equal(t, settlement.Amount, retrieved.Amount)
	assert.Equal(t, settlement.Status, retrieved.Status)
}

func TestSettlementRepository_UpdateStatus(t *testing.T) {
	db := skipIfNoDatabase(t)
	defer db.Close()
	defer cleanupDatabase(t, db)

	repo := NewSettlementRepository(db)
	ctx := context.Background()

	// Create a settlement
	settlement := &Settlement{
		Network:     "eip155:8453",
		Scheme:      "exact",
		FromAddress: "0x1234567890123456789012345678901234567890",
		ToAddress:   "0x0987654321098765432109876543210987654321",
		Amount:      "500000",
		Asset:       "USDT",
		Status:      SettlementStatusPending,
		CreatedAt:   time.Now().UTC(),
	}

	err := repo.Create(ctx, settlement)
	require.NoError(t, err)

	// Update to confirmed
	err = repo.UpdateStatus(ctx, settlement.ID, SettlementStatusConfirmed, "")
	require.NoError(t, err)

	// Verify update
	retrieved, err := repo.GetByID(ctx, settlement.ID)
	require.NoError(t, err)
	assert.Equal(t, SettlementStatusConfirmed, retrieved.Status)
	assert.NotNil(t, retrieved.ConfirmedAt)
}

func TestSettlementRepository_UpdateTxHash(t *testing.T) {
	db := skipIfNoDatabase(t)
	defer db.Close()
	defer cleanupDatabase(t, db)

	repo := NewSettlementRepository(db)
	ctx := context.Background()

	// Create a settlement
	settlement := &Settlement{
		Network:     "eip155:1",
		Scheme:      "exact",
		FromAddress: "0x1234567890123456789012345678901234567890",
		ToAddress:   "0x0987654321098765432109876543210987654321",
		Amount:      "1000000",
		Asset:       "USDT",
		Status:      SettlementStatusPending,
		CreatedAt:   time.Now().UTC(),
	}

	err := repo.Create(ctx, settlement)
	require.NoError(t, err)

	// Update tx hash
	txHash := "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
	err = repo.UpdateTxHash(ctx, settlement.ID, txHash)
	require.NoError(t, err)

	// Verify
	retrieved, err := repo.GetByTxHash(ctx, "eip155:1", txHash)
	require.NoError(t, err)
	require.NotNil(t, retrieved)
	assert.Equal(t, txHash, retrieved.TxHash)
}

func TestSettlementRepository_List(t *testing.T) {
	db := skipIfNoDatabase(t)
	defer db.Close()
	defer cleanupDatabase(t, db)

	repo := NewSettlementRepository(db)
	ctx := context.Background()

	// Create multiple settlements
	for i := 0; i < 5; i++ {
		settlement := &Settlement{
			Network:     "eip155:1",
			Scheme:      "exact",
			FromAddress: "0x1234567890123456789012345678901234567890",
			ToAddress:   "0x0987654321098765432109876543210987654321",
			Amount:      "1000000",
			Asset:       "USDT",
			Status:      SettlementStatusPending,
			CreatedAt:   time.Now().UTC(),
		}
		err := repo.Create(ctx, settlement)
		require.NoError(t, err)
	}

	// List with filter
	settlements, err := repo.List(ctx, SettlementFilter{
		Network: "eip155:1",
		Status:  SettlementStatusPending,
		Limit:   10,
	})
	require.NoError(t, err)
	assert.Len(t, settlements, 5)
}

func TestSettlementRepository_CountByStatus(t *testing.T) {
	db := skipIfNoDatabase(t)
	defer db.Close()
	defer cleanupDatabase(t, db)

	repo := NewSettlementRepository(db)
	ctx := context.Background()

	// Create settlements with different statuses
	for _, status := range []SettlementStatus{SettlementStatusPending, SettlementStatusPending, SettlementStatusConfirmed} {
		settlement := &Settlement{
			Network:     "eip155:1",
			Scheme:      "exact",
			FromAddress: "0x1234567890123456789012345678901234567890",
			ToAddress:   "0x0987654321098765432109876543210987654321",
			Amount:      "1000000",
			Asset:       "USDT",
			Status:      status,
			CreatedAt:   time.Now().UTC(),
		}
		err := repo.Create(ctx, settlement)
		require.NoError(t, err)
	}

	counts, err := repo.CountByStatus(ctx, "")
	require.NoError(t, err)
	assert.Equal(t, int64(2), counts[SettlementStatusPending])
	assert.Equal(t, int64(1), counts[SettlementStatusConfirmed])
}

func TestAuditRepository_Log(t *testing.T) {
	db := skipIfNoDatabase(t)
	defer db.Close()
	defer cleanupDatabase(t, db)

	repo := NewAuditRepository(db)
	ctx := context.Background()

	entry := &AuditEntry{
		Timestamp:    time.Now().UTC(),
		Action:       AuditActionVerify,
		Network:      "eip155:1",
		RequestID:    "req-123",
		IPAddress:    "192.168.1.1",
		RequestBody:  json.RawMessage(`{"amount": "1000000"}`),
		ResponseBody: json.RawMessage(`{"valid": true}`),
		DurationMs:   150,
		StatusCode:   200,
	}

	err := repo.Log(ctx, entry)
	require.NoError(t, err)
	assert.NotEmpty(t, entry.ID)

	// Verify retrieval
	retrieved, err := repo.GetByID(ctx, entry.ID)
	require.NoError(t, err)
	require.NotNil(t, retrieved)
	assert.Equal(t, AuditActionVerify, retrieved.Action)
	assert.Equal(t, "eip155:1", retrieved.Network)
	assert.Equal(t, "req-123", retrieved.RequestID)
	assert.Equal(t, 150, retrieved.DurationMs)
	assert.Equal(t, 200, retrieved.StatusCode)
}

func TestAuditRepository_List(t *testing.T) {
	db := skipIfNoDatabase(t)
	defer db.Close()
	defer cleanupDatabase(t, db)

	repo := NewAuditRepository(db)
	ctx := context.Background()

	// Create multiple entries
	actions := []AuditAction{AuditActionVerify, AuditActionSettle, AuditActionHealth}
	for _, action := range actions {
		entry := &AuditEntry{
			Timestamp:  time.Now().UTC(),
			Action:     action,
			Network:    "eip155:1",
			DurationMs: 100,
			StatusCode: 200,
		}
		err := repo.Log(ctx, entry)
		require.NoError(t, err)
	}

	// List by action
	entries, err := repo.List(ctx, AuditFilter{
		Action: AuditActionVerify,
		Limit:  10,
	})
	require.NoError(t, err)
	assert.Len(t, entries, 1)
	assert.Equal(t, AuditActionVerify, entries[0].Action)
}

func TestAuditRepository_GetRequestStats(t *testing.T) {
	db := skipIfNoDatabase(t)
	defer db.Close()
	defer cleanupDatabase(t, db)

	repo := NewAuditRepository(db)
	ctx := context.Background()

	// Create entries with various status codes
	statusCodes := []int{200, 200, 400, 500}
	durations := []int{100, 200, 150, 50}
	for i, code := range statusCodes {
		entry := &AuditEntry{
			Timestamp:  time.Now().UTC(),
			Action:     AuditActionVerify,
			Network:    "eip155:1",
			DurationMs: durations[i],
			StatusCode: code,
		}
		err := repo.Log(ctx, entry)
		require.NoError(t, err)
	}

	stats, err := repo.GetRequestStats(ctx, AuditFilter{})
	require.NoError(t, err)
	assert.Equal(t, int64(4), stats.TotalRequests)
	assert.Equal(t, int64(2), stats.SuccessfulRequests)
	assert.Equal(t, int64(2), stats.FailedRequests)
	assert.Equal(t, 200, stats.MaxDurationMs)
	assert.Equal(t, 50, stats.MinDurationMs)
}

func TestAuditRepository_CountByAction(t *testing.T) {
	db := skipIfNoDatabase(t)
	defer db.Close()
	defer cleanupDatabase(t, db)

	repo := NewAuditRepository(db)
	ctx := context.Background()

	// Create entries
	entries := []AuditAction{AuditActionVerify, AuditActionVerify, AuditActionSettle, AuditActionHealth}
	for _, action := range entries {
		entry := &AuditEntry{
			Timestamp:  time.Now().UTC(),
			Action:     action,
			DurationMs: 100,
			StatusCode: 200,
		}
		err := repo.Log(ctx, entry)
		require.NoError(t, err)
	}

	counts, err := repo.CountByAction(ctx, "")
	require.NoError(t, err)
	assert.Equal(t, int64(2), counts[AuditActionVerify])
	assert.Equal(t, int64(1), counts[AuditActionSettle])
	assert.Equal(t, int64(1), counts[AuditActionHealth])
}

func TestDB_Health(t *testing.T) {
	db := skipIfNoDatabase(t)
	defer db.Close()

	ctx := context.Background()
	err := db.Health(ctx)
	assert.NoError(t, err)
}

func TestDB_Stats(t *testing.T) {
	db := skipIfNoDatabase(t)
	defer db.Close()

	stats := db.Stats()
	assert.GreaterOrEqual(t, stats.MaxOpenConnections, 0)
}

// Unit tests that don't require a database

func TestDefaultDBConfig(t *testing.T) {
	config := DefaultDBConfig()
	assert.Equal(t, 25, config.MaxConnections)
	assert.Equal(t, 5, config.IdleConnections)
	assert.Equal(t, 5*time.Minute, config.ConnMaxLifetime)
	assert.True(t, config.AutoMigrate)
}

func TestNewDB_MissingURL(t *testing.T) {
	_, err := NewDB(&DBConfig{URL: ""})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "database URL is required")
}

func TestSettlementStatus_Values(t *testing.T) {
	assert.Equal(t, SettlementStatus("pending"), SettlementStatusPending)
	assert.Equal(t, SettlementStatus("confirmed"), SettlementStatusConfirmed)
	assert.Equal(t, SettlementStatus("failed"), SettlementStatusFailed)
}

func TestAuditAction_Values(t *testing.T) {
	assert.Equal(t, AuditAction("verify"), AuditActionVerify)
	assert.Equal(t, AuditAction("settle"), AuditActionSettle)
	assert.Equal(t, AuditAction("error"), AuditActionError)
	assert.Equal(t, AuditAction("health"), AuditActionHealth)
	assert.Equal(t, AuditAction("supported"), AuditActionSupport)
}

func TestNullString_Helper(t *testing.T) {
	// Empty string
	ns := nullString("")
	assert.False(t, ns.Valid)

	// Non-empty string
	ns = nullString("test")
	assert.True(t, ns.Valid)
	assert.Equal(t, "test", ns.String)
}

func TestNullTime_Helper(t *testing.T) {
	// Nil time
	nt := nullTime(nil)
	assert.False(t, nt.Valid)

	// Non-nil time
	now := time.Now()
	nt = nullTime(&now)
	assert.True(t, nt.Valid)
	assert.Equal(t, now, nt.Time)
}

func TestNullJSON_Helper(t *testing.T) {
	// Nil data
	result := nullJSON(nil)
	assert.Nil(t, result)

	// Empty slice
	result = nullJSON([]byte{})
	assert.Nil(t, result)

	// Valid data
	data := []byte(`{"key": "value"}`)
	result = nullJSON(data)
	assert.Equal(t, data, result)
}

// Middleware tests

func TestDefaultAuditMiddlewareConfig(t *testing.T) {
	config := DefaultAuditMiddlewareConfig()
	assert.Contains(t, config.SkipPaths, "/health")
	assert.Contains(t, config.SkipPaths, "/ready")
	assert.Contains(t, config.SkipPaths, "/metrics")
	assert.Equal(t, 64*1024, config.MaxBodySize)
}

func TestDetermineAction(t *testing.T) {
	tests := []struct {
		path     string
		expected AuditAction
	}{
		{"/verify", AuditActionVerify},
		{"/settle", AuditActionSettle},
		{"/health", AuditActionHealth},
		{"/ready", AuditActionHealth},
		{"/supported", AuditActionSupport},
		{"/unknown", AuditActionError},
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			result := determineAction(tt.path)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestExtractNetworkFromBody(t *testing.T) {
	tests := []struct {
		name     string
		body     []byte
		expected string
	}{
		{
			name:     "empty body",
			body:     nil,
			expected: "",
		},
		{
			name:     "invalid JSON",
			body:     []byte("not json"),
			expected: "",
		},
		{
			name:     "network at top level",
			body:     []byte(`{"network": "eip155:1"}`),
			expected: "eip155:1",
		},
		{
			name:     "network in requirements",
			body:     []byte(`{"requirements": {"network": "eip155:8453"}}`),
			expected: "eip155:8453",
		},
		{
			name:     "no network field",
			body:     []byte(`{"amount": "1000000"}`),
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := extractNetworkFromBody(tt.body)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestSanitizeJSON(t *testing.T) {
	tests := []struct {
		name     string
		data     []byte
		expected bool // true if result should be non-nil
	}{
		{
			name:     "nil data",
			data:     nil,
			expected: false,
		},
		{
			name:     "empty data",
			data:     []byte{},
			expected: false,
		},
		{
			name:     "invalid JSON",
			data:     []byte("not json"),
			expected: false,
		},
		{
			name:     "valid JSON object",
			data:     []byte(`{"key": "value"}`),
			expected: true,
		},
		{
			name:     "valid JSON array",
			data:     []byte(`[1, 2, 3]`),
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := sanitizeJSON(tt.data)
			if tt.expected {
				assert.NotNil(t, result)
			} else {
				assert.Nil(t, result)
			}
		})
	}
}
