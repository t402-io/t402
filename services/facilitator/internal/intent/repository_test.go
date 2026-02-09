package intent

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/lib/pq"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// intentColumns is the standard column set returned by SELECT queries on the intents table.
var intentColumns = []string{
	"id", "payer", "payee", "amount", "asset",
	"source_networks", "target_network", "max_slippage", "max_gas_cost",
	"priority", "status", "selected_route", "available_routes",
	"created_at", "expires_at", "executed_at", "tx_hashes", "error_message", "metadata",
}

// testRoute returns a sample route for use in test fixtures.
func testRoute() *Route {
	return &Route{
		ID:             "route-1",
		SourceNetwork:  "eip155:1",
		TargetNetwork:  "eip155:8453",
		SourceAsset:    "0xdAC17F958D2ee523a2206206994597C13D831ec7",
		TargetAsset:    "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
		InputAmount:    "1000000",
		OutputAmount:   "999000",
		EstimatedGas:   "50000",
		EstimatedTime:  120,
		Slippage:       0.001,
		Score:          0.95,
		RequiresBridge: true,
		BridgeProtocol: "layerzero",
		ValidUntil:     time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC),
		Steps: []*RouteStep{
			{
				Order:     1,
				Type:      StepTypeBridge,
				Network:   "eip155:1",
				Protocol:  "layerzero",
				FromAsset: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
				ToAsset:   "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
				FromAmount: "1000000",
				ToAmount:   "999000",
			},
		},
	}
}

// testIntent returns a fully populated Intent for use in test fixtures.
func testIntent() *Intent {
	now := time.Date(2026, 2, 9, 12, 0, 0, 0, time.UTC)
	expiresAt := now.Add(5 * time.Minute)
	route := testRoute()
	return &Intent{
		ID:              "intent-123",
		Payer:           "0xAlice",
		Payee:           "0xBob",
		Amount:          "1000000",
		Asset:           "USDT",
		SourceNetworks:  []string{"eip155:1", "eip155:8453"},
		TargetNetwork:   "eip155:8453",
		MaxSlippage:     0.005,
		MaxGasCost:      "100000",
		Priority:        PriorityNormal,
		Status:          IntentStatusPending,
		SelectedRoute:   route,
		AvailableRoutes: []*Route{route},
		CreatedAt:       now,
		ExpiresAt:       expiresAt,
		TxHashes:        []string{"0xabc123"},
		ErrorMessage:    "",
		Metadata:        map[string]string{"source": "api"},
	}
}

// intentRow builds a sqlmock row from an Intent, marshaling JSON fields appropriately.
func intentRow(i *Intent) []driver.Value {
	selectedRouteJSON, _ := json.Marshal(i.SelectedRoute)
	routesJSON, _ := json.Marshal(i.AvailableRoutes)
	metadataJSON, _ := json.Marshal(i.Metadata)

	var executedAt driver.Value
	if i.ExecutedAt != nil {
		executedAt = *i.ExecutedAt
	} else {
		executedAt = nil
	}

	var targetNetwork driver.Value
	if i.TargetNetwork != "" {
		targetNetwork = i.TargetNetwork
	} else {
		targetNetwork = nil
	}

	var maxGasCost driver.Value
	if i.MaxGasCost != "" {
		maxGasCost = i.MaxGasCost
	} else {
		maxGasCost = nil
	}

	var errorMessage driver.Value
	if i.ErrorMessage != "" {
		errorMessage = i.ErrorMessage
	} else {
		errorMessage = nil
	}

	return []driver.Value{
		i.ID, i.Payer, i.Payee, i.Amount, i.Asset,
		pq.Array(i.SourceNetworks), targetNetwork, i.MaxSlippage, maxGasCost,
		string(i.Priority), string(i.Status), selectedRouteJSON, routesJSON,
		i.CreatedAt, i.ExpiresAt, executedAt, pq.Array(i.TxHashes), errorMessage, metadataJSON,
	}
}

// ---------------------------------------------------------------------------
// NewRepository
// ---------------------------------------------------------------------------

func TestNewRepository(t *testing.T) {
	db, _, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := NewRepository(db)
	require.NotNil(t, repo)
	assert.Equal(t, db, repo.db)
}

// ---------------------------------------------------------------------------
// BeginTx
// ---------------------------------------------------------------------------

func TestBeginTx_Success(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	mock.ExpectBegin()
	repo := &Repository{db: db}

	tx, err := repo.BeginTx(context.Background())
	require.NoError(t, err)
	require.NotNil(t, tx)
	require.NotNil(t, tx.tx)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestBeginTx_Error(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	mock.ExpectBegin().WillReturnError(errors.New("connection lost"))
	repo := &Repository{db: db}

	tx, err := repo.BeginTx(context.Background())
	require.Error(t, err)
	assert.Nil(t, tx)
	assert.Contains(t, err.Error(), "failed to begin transaction")
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---------------------------------------------------------------------------
// Tx Commit / Rollback
// ---------------------------------------------------------------------------

func TestTx_Commit(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	mock.ExpectBegin()
	mock.ExpectCommit()

	repo := &Repository{db: db}
	tx, err := repo.BeginTx(context.Background())
	require.NoError(t, err)

	err = tx.Commit()
	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestTx_Rollback(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	mock.ExpectBegin()
	mock.ExpectRollback()

	repo := &Repository{db: db}
	tx, err := repo.BeginTx(context.Background())
	require.NoError(t, err)

	err = tx.Rollback()
	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

func TestCreate_Success(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}
	intent := testIntent()

	mock.ExpectExec("INSERT INTO intents").
		WithArgs(
			intent.ID, intent.Payer, intent.Payee, intent.Amount, intent.Asset,
			sqlmock.AnyArg(), intent.TargetNetwork, intent.MaxSlippage, intent.MaxGasCost,
			string(intent.Priority), string(intent.Status), sqlmock.AnyArg(), sqlmock.AnyArg(),
			sqlmock.AnyArg(), intent.ExpiresAt, intent.ExecutedAt, sqlmock.AnyArg(), intent.ErrorMessage, sqlmock.AnyArg(),
		).
		WillReturnResult(sqlmock.NewResult(0, 1))

	err = repo.Create(context.Background(), intent)
	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestCreate_GeneratesUUID_WhenIDEmpty(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}
	intent := testIntent()
	intent.ID = ""

	mock.ExpectExec("INSERT INTO intents").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err = repo.Create(context.Background(), intent)
	assert.NoError(t, err)
	assert.NotEmpty(t, intent.ID, "Create should auto-generate a UUID when ID is empty")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestCreate_SetsCreatedAt(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}
	intent := testIntent()
	before := time.Now().UTC().Add(-time.Second)

	mock.ExpectExec("INSERT INTO intents").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err = repo.Create(context.Background(), intent)
	require.NoError(t, err)
	assert.True(t, intent.CreatedAt.After(before) || intent.CreatedAt.Equal(before),
		"CreatedAt should be set to approximately now")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestCreate_DBError(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}
	intent := testIntent()

	mock.ExpectExec("INSERT INTO intents").
		WillReturnError(errors.New("duplicate key"))

	err = repo.Create(context.Background(), intent)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to create intent")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestCreate_NilRouteAndMetadata(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}
	intent := &Intent{
		ID:       "intent-nil-fields",
		Payer:    "0xAlice",
		Payee:    "0xBob",
		Amount:   "500000",
		Asset:    "USDT",
		Priority: PriorityLow,
		Status:   IntentStatusPending,
		// SelectedRoute, AvailableRoutes, Metadata all nil
	}

	mock.ExpectExec("INSERT INTO intents").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err = repo.Create(context.Background(), intent)
	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---------------------------------------------------------------------------
// GetByID
// ---------------------------------------------------------------------------

func TestGetByID_Success(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}
	expected := testIntent()
	row := intentRow(expected)

	mock.ExpectQuery("SELECT .+ FROM intents WHERE id = \\$1").
		WithArgs(expected.ID).
		WillReturnRows(sqlmock.NewRows(intentColumns).AddRow(row...))

	result, err := repo.GetByID(context.Background(), expected.ID)
	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, expected.ID, result.ID)
	assert.Equal(t, expected.Payer, result.Payer)
	assert.Equal(t, expected.Payee, result.Payee)
	assert.Equal(t, expected.Amount, result.Amount)
	assert.Equal(t, expected.Asset, result.Asset)
	assert.Equal(t, expected.TargetNetwork, result.TargetNetwork)
	assert.Equal(t, expected.MaxGasCost, result.MaxGasCost)
	assert.Equal(t, expected.MaxSlippage, result.MaxSlippage)
	assert.Equal(t, expected.Priority, result.Priority)
	assert.Equal(t, expected.Status, result.Status)
	assert.Equal(t, expected.SourceNetworks, result.SourceNetworks)
	assert.Equal(t, expected.TxHashes, result.TxHashes)
	assert.NotNil(t, result.SelectedRoute)
	assert.Equal(t, expected.SelectedRoute.ID, result.SelectedRoute.ID)
	assert.Len(t, result.AvailableRoutes, 1)
	assert.Equal(t, "api", result.Metadata["source"])
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestGetByID_NotFound(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}

	mock.ExpectQuery("SELECT .+ FROM intents WHERE id = \\$1").
		WithArgs("nonexistent").
		WillReturnError(sql.ErrNoRows)

	result, err := repo.GetByID(context.Background(), "nonexistent")
	assert.Nil(t, result)
	assert.ErrorIs(t, err, ErrIntentNotFound)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestGetByID_DBError(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}

	mock.ExpectQuery("SELECT .+ FROM intents WHERE id = \\$1").
		WithArgs("intent-1").
		WillReturnError(errors.New("connection reset"))

	result, err := repo.GetByID(context.Background(), "intent-1")
	assert.Nil(t, result)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to get intent")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestGetByID_NullOptionalFields(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}
	now := time.Date(2026, 2, 9, 12, 0, 0, 0, time.UTC)

	// Build a row with NULL for optional fields
	row := []driver.Value{
		"intent-null", "0xAlice", "0xBob", "1000000", "USDT",
		pq.Array([]string{"eip155:1"}),
		nil,   // target_network NULL
		0.005, // max_slippage
		nil,   // max_gas_cost NULL
		"normal", "pending",
		[]byte("null"), // selected_route NULL
		[]byte("[]"),   // available_routes empty
		now, now.Add(5 * time.Minute),
		nil,                      // executed_at NULL
		pq.Array([]string{}),     // tx_hashes empty
		nil,                      // error_message NULL
		[]byte("{}"),             // metadata empty
	}

	mock.ExpectQuery("SELECT .+ FROM intents WHERE id = \\$1").
		WithArgs("intent-null").
		WillReturnRows(sqlmock.NewRows(intentColumns).AddRow(row...))

	result, err := repo.GetByID(context.Background(), "intent-null")
	require.NoError(t, err)
	assert.Equal(t, "", result.TargetNetwork)
	assert.Equal(t, "", result.MaxGasCost)
	assert.Equal(t, "", result.ErrorMessage)
	assert.Nil(t, result.ExecutedAt)
	assert.Nil(t, result.SelectedRoute)
	assert.Empty(t, result.AvailableRoutes)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestGetByID_WithExecutedAt(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}
	expected := testIntent()
	executed := time.Date(2026, 2, 9, 12, 5, 0, 0, time.UTC)
	expected.ExecutedAt = &executed
	expected.Status = IntentStatusCompleted

	row := intentRow(expected)
	mock.ExpectQuery("SELECT .+ FROM intents WHERE id = \\$1").
		WithArgs(expected.ID).
		WillReturnRows(sqlmock.NewRows(intentColumns).AddRow(row...))

	result, err := repo.GetByID(context.Background(), expected.ID)
	require.NoError(t, err)
	require.NotNil(t, result.ExecutedAt)
	assert.Equal(t, executed.UTC(), result.ExecutedAt.UTC())
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---------------------------------------------------------------------------
// GetByIDForUpdate
// ---------------------------------------------------------------------------

func TestGetByIDForUpdate_Success(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}
	expected := testIntent()
	row := intentRow(expected)

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT .+ FROM intents WHERE id = \\$1 FOR UPDATE").
		WithArgs(expected.ID).
		WillReturnRows(sqlmock.NewRows(intentColumns).AddRow(row...))

	tx, err := repo.BeginTx(context.Background())
	require.NoError(t, err)

	result, err := repo.GetByIDForUpdate(context.Background(), tx, expected.ID)
	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, expected.ID, result.ID)
	assert.Equal(t, expected.Payer, result.Payer)
	assert.Equal(t, expected.TargetNetwork, result.TargetNetwork)
	assert.NotNil(t, result.SelectedRoute)
	assert.Equal(t, expected.SelectedRoute.ID, result.SelectedRoute.ID)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestGetByIDForUpdate_NotFound(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT .+ FROM intents WHERE id = \\$1 FOR UPDATE").
		WithArgs("missing").
		WillReturnError(sql.ErrNoRows)

	tx, err := repo.BeginTx(context.Background())
	require.NoError(t, err)

	result, err := repo.GetByIDForUpdate(context.Background(), tx, "missing")
	assert.Nil(t, result)
	assert.ErrorIs(t, err, ErrIntentNotFound)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestGetByIDForUpdate_DBError(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT .+ FROM intents WHERE id = \\$1 FOR UPDATE").
		WithArgs("intent-1").
		WillReturnError(errors.New("deadlock detected"))

	tx, err := repo.BeginTx(context.Background())
	require.NoError(t, err)

	result, err := repo.GetByIDForUpdate(context.Background(), tx, "intent-1")
	assert.Nil(t, result)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to get intent for update")
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

func TestUpdate_Success(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}
	intent := testIntent()
	intent.Status = IntentStatusRouted

	mock.ExpectExec("UPDATE intents SET").
		WithArgs(
			intent.ID, string(intent.Status),
			sqlmock.AnyArg(), sqlmock.AnyArg(), // selectedRouteJSON, routesJSON
			intent.ExecutedAt,
			sqlmock.AnyArg(), // pq.Array(TxHashes)
			intent.ErrorMessage,
			sqlmock.AnyArg(), // metadataJSON
		).
		WillReturnResult(sqlmock.NewResult(0, 1))

	err = repo.Update(context.Background(), intent)
	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestUpdate_NotFound(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}
	intent := testIntent()

	mock.ExpectExec("UPDATE intents SET").
		WithArgs(
			intent.ID, string(intent.Status),
			sqlmock.AnyArg(), sqlmock.AnyArg(),
			intent.ExecutedAt,
			sqlmock.AnyArg(),
			intent.ErrorMessage,
			sqlmock.AnyArg(),
		).
		WillReturnResult(sqlmock.NewResult(0, 0))

	err = repo.Update(context.Background(), intent)
	assert.ErrorIs(t, err, ErrIntentNotFound)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestUpdate_DBError(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}
	intent := testIntent()

	mock.ExpectExec("UPDATE intents SET").
		WillReturnError(errors.New("connection refused"))

	err = repo.Update(context.Background(), intent)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to update intent")
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---------------------------------------------------------------------------
// UpdateInTx
// ---------------------------------------------------------------------------

func TestUpdateInTx_Success(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}
	intent := testIntent()
	intent.Status = IntentStatusExecuting

	mock.ExpectBegin()
	mock.ExpectExec("UPDATE intents SET").
		WithArgs(
			intent.ID, string(intent.Status),
			sqlmock.AnyArg(), sqlmock.AnyArg(),
			intent.ExecutedAt,
			sqlmock.AnyArg(),
			intent.ErrorMessage,
			sqlmock.AnyArg(),
		).
		WillReturnResult(sqlmock.NewResult(0, 1))

	tx, err := repo.BeginTx(context.Background())
	require.NoError(t, err)

	err = repo.UpdateInTx(context.Background(), tx, intent)
	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestUpdateInTx_NotFound(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}
	intent := testIntent()

	mock.ExpectBegin()
	mock.ExpectExec("UPDATE intents SET").
		WillReturnResult(sqlmock.NewResult(0, 0))

	tx, err := repo.BeginTx(context.Background())
	require.NoError(t, err)

	err = repo.UpdateInTx(context.Background(), tx, intent)
	assert.ErrorIs(t, err, ErrIntentNotFound)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestUpdateInTx_DBError(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}
	intent := testIntent()

	mock.ExpectBegin()
	mock.ExpectExec("UPDATE intents SET").
		WillReturnError(errors.New("serialization failure"))

	tx, err := repo.BeginTx(context.Background())
	require.NoError(t, err)

	err = repo.UpdateInTx(context.Background(), tx, intent)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to update intent in transaction")
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---------------------------------------------------------------------------
// UpdateStatus
// ---------------------------------------------------------------------------

func TestUpdateStatus_Success(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}

	mock.ExpectExec("UPDATE intents SET").
		WithArgs("intent-123", string(IntentStatusFailed), "timeout exceeded").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err = repo.UpdateStatus(context.Background(), "intent-123", IntentStatusFailed, "timeout exceeded")
	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestUpdateStatus_NotFound(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}

	mock.ExpectExec("UPDATE intents SET").
		WithArgs("nonexistent", string(IntentStatusCancelled), "user cancelled").
		WillReturnResult(sqlmock.NewResult(0, 0))

	err = repo.UpdateStatus(context.Background(), "nonexistent", IntentStatusCancelled, "user cancelled")
	assert.ErrorIs(t, err, ErrIntentNotFound)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestUpdateStatus_DBError(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}

	mock.ExpectExec("UPDATE intents SET").
		WithArgs("intent-1", string(IntentStatusExpired), "").
		WillReturnError(errors.New("disk full"))

	err = repo.UpdateStatus(context.Background(), "intent-1", IntentStatusExpired, "")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to update intent status")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestUpdateStatus_AllStatuses(t *testing.T) {
	statuses := []struct {
		status IntentStatus
		errMsg string
	}{
		{IntentStatusPending, ""},
		{IntentStatusRouted, ""},
		{IntentStatusExecuting, ""},
		{IntentStatusCompleted, ""},
		{IntentStatusFailed, "execution error"},
		{IntentStatusCancelled, "user request"},
		{IntentStatusExpired, "deadline passed"},
	}

	for _, tc := range statuses {
		t.Run(string(tc.status), func(t *testing.T) {
			db, mock, err := sqlmock.New()
			require.NoError(t, err)
			defer db.Close()

			repo := &Repository{db: db}

			mock.ExpectExec("UPDATE intents SET").
				WithArgs("intent-1", string(tc.status), tc.errMsg).
				WillReturnResult(sqlmock.NewResult(0, 1))

			err = repo.UpdateStatus(context.Background(), "intent-1", tc.status, tc.errMsg)
			assert.NoError(t, err)
			assert.NoError(t, mock.ExpectationsWereMet())
		})
	}
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

func TestList_NoFilters(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}
	expected := testIntent()

	// Count query
	mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM intents WHERE 1=1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	// Select query
	row := intentRow(expected)
	mock.ExpectQuery("SELECT .+ FROM intents WHERE 1=1 ORDER BY created_at DESC LIMIT").
		WithArgs(20, 0). // default limit=20, offset=0
		WillReturnRows(sqlmock.NewRows(intentColumns).AddRow(row...))

	intents, total, err := repo.List(context.Background(), ListIntentsRequest{})
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	assert.Len(t, intents, 1)
	assert.Equal(t, expected.ID, intents[0].ID)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestList_WithPayerFilter(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}

	mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM intents WHERE 1=1 AND payer = \\$1").
		WithArgs("0xAlice").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))

	mock.ExpectQuery("SELECT .+ FROM intents WHERE 1=1 AND payer = \\$1 ORDER BY created_at DESC").
		WithArgs("0xAlice", 20, 0).
		WillReturnRows(sqlmock.NewRows(intentColumns))

	intents, total, err := repo.List(context.Background(), ListIntentsRequest{
		Payer: "0xAlice",
	})
	require.NoError(t, err)
	assert.Equal(t, int64(0), total)
	assert.Empty(t, intents)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestList_WithPayeeFilter(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}

	mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM intents WHERE 1=1 AND payee = \\$1").
		WithArgs("0xBob").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))

	mock.ExpectQuery("SELECT .+ FROM intents WHERE 1=1 AND payee = \\$1").
		WithArgs("0xBob", 20, 0).
		WillReturnRows(sqlmock.NewRows(intentColumns))

	intents, total, err := repo.List(context.Background(), ListIntentsRequest{
		Payee: "0xBob",
	})
	require.NoError(t, err)
	assert.Equal(t, int64(0), total)
	assert.Empty(t, intents)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestList_WithStatusFilter(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}

	mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM intents WHERE 1=1 AND status = ANY").
		WithArgs(sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))

	mock.ExpectQuery("SELECT .+ FROM intents WHERE 1=1 AND status = ANY").
		WithArgs(sqlmock.AnyArg(), 20, 0).
		WillReturnRows(sqlmock.NewRows(intentColumns))

	intents, total, err := repo.List(context.Background(), ListIntentsRequest{
		Status: []IntentStatus{IntentStatusPending, IntentStatusRouted},
	})
	require.NoError(t, err)
	assert.Equal(t, int64(0), total)
	assert.Empty(t, intents)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestList_AllFilters(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}

	mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM intents WHERE 1=1 AND payer = \\$1 AND payee = \\$2 AND status = ANY").
		WithArgs("0xAlice", "0xBob", sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))

	mock.ExpectQuery("SELECT .+ FROM intents WHERE 1=1 AND payer = \\$1 AND payee = \\$2 AND status = ANY").
		WithArgs("0xAlice", "0xBob", sqlmock.AnyArg(), 10, 5).
		WillReturnRows(sqlmock.NewRows(intentColumns))

	intents, total, err := repo.List(context.Background(), ListIntentsRequest{
		Payer:  "0xAlice",
		Payee:  "0xBob",
		Status: []IntentStatus{IntentStatusCompleted},
		Limit:  10,
		Offset: 5,
	})
	require.NoError(t, err)
	assert.Equal(t, int64(0), total)
	assert.Empty(t, intents)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestList_LimitClamping(t *testing.T) {
	tests := []struct {
		name          string
		inputLimit    int
		expectedLimit int
	}{
		{"zero defaults to 20", 0, 20},
		{"negative defaults to 20", -5, 20},
		{"over 100 clamped to 100", 200, 100},
		{"valid limit unchanged", 50, 50},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			db, mock, err := sqlmock.New()
			require.NoError(t, err)
			defer db.Close()

			repo := &Repository{db: db}

			mock.ExpectQuery("SELECT COUNT").
				WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))

			mock.ExpectQuery("SELECT .+ FROM intents").
				WithArgs(tc.expectedLimit, 0).
				WillReturnRows(sqlmock.NewRows(intentColumns))

			_, _, err = repo.List(context.Background(), ListIntentsRequest{Limit: tc.inputLimit})
			assert.NoError(t, err)
			assert.NoError(t, mock.ExpectationsWereMet())
		})
	}
}

func TestList_MultipleResults(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}
	intent1 := testIntent()
	intent1.ID = "intent-1"
	intent2 := testIntent()
	intent2.ID = "intent-2"
	intent2.Payer = "0xCharlie"

	mock.ExpectQuery("SELECT COUNT").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(2))

	rows := sqlmock.NewRows(intentColumns).
		AddRow(intentRow(intent1)...).
		AddRow(intentRow(intent2)...)
	mock.ExpectQuery("SELECT .+ FROM intents WHERE 1=1 ORDER BY").
		WithArgs(20, 0).
		WillReturnRows(rows)

	intents, total, err := repo.List(context.Background(), ListIntentsRequest{})
	require.NoError(t, err)
	assert.Equal(t, int64(2), total)
	assert.Len(t, intents, 2)
	assert.Equal(t, "intent-1", intents[0].ID)
	assert.Equal(t, "intent-2", intents[1].ID)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestList_CountQueryError(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}

	mock.ExpectQuery("SELECT COUNT").
		WillReturnError(errors.New("query timeout"))

	intents, total, err := repo.List(context.Background(), ListIntentsRequest{})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to count intents")
	assert.Nil(t, intents)
	assert.Equal(t, int64(0), total)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestList_SelectQueryError(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}

	mock.ExpectQuery("SELECT COUNT").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(5))

	mock.ExpectQuery("SELECT .+ FROM intents").
		WillReturnError(errors.New("query failed"))

	intents, total, err := repo.List(context.Background(), ListIntentsRequest{})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to list intents")
	assert.Nil(t, intents)
	assert.Equal(t, int64(0), total)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---------------------------------------------------------------------------
// GetExpiredIntents
// ---------------------------------------------------------------------------

func TestGetExpiredIntents_Success(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}
	expected := testIntent()
	expected.ID = "expired-1"
	expected.Status = IntentStatusPending

	// First query: get expired IDs
	mock.ExpectQuery("SELECT id FROM intents WHERE status IN").
		WithArgs(sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow("expired-1"))

	// Follow-up GetByID call for each ID
	row := intentRow(expected)
	mock.ExpectQuery("SELECT .+ FROM intents WHERE id = \\$1").
		WithArgs("expired-1").
		WillReturnRows(sqlmock.NewRows(intentColumns).AddRow(row...))

	intents, err := repo.GetExpiredIntents(context.Background())
	require.NoError(t, err)
	assert.Len(t, intents, 1)
	assert.Equal(t, "expired-1", intents[0].ID)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestGetExpiredIntents_MultipleResults(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}

	intent1 := testIntent()
	intent1.ID = "expired-1"
	intent2 := testIntent()
	intent2.ID = "expired-2"

	// First query: get expired IDs
	mock.ExpectQuery("SELECT id FROM intents WHERE status IN").
		WithArgs(sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).
			AddRow("expired-1").
			AddRow("expired-2"))

	// GetByID for each
	mock.ExpectQuery("SELECT .+ FROM intents WHERE id = \\$1").
		WithArgs("expired-1").
		WillReturnRows(sqlmock.NewRows(intentColumns).AddRow(intentRow(intent1)...))

	mock.ExpectQuery("SELECT .+ FROM intents WHERE id = \\$1").
		WithArgs("expired-2").
		WillReturnRows(sqlmock.NewRows(intentColumns).AddRow(intentRow(intent2)...))

	intents, err := repo.GetExpiredIntents(context.Background())
	require.NoError(t, err)
	assert.Len(t, intents, 2)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestGetExpiredIntents_NoResults(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}

	mock.ExpectQuery("SELECT id FROM intents WHERE status IN").
		WithArgs(sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"id"}))

	intents, err := repo.GetExpiredIntents(context.Background())
	require.NoError(t, err)
	assert.Empty(t, intents)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestGetExpiredIntents_QueryError(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}

	mock.ExpectQuery("SELECT id FROM intents WHERE status IN").
		WillReturnError(errors.New("table not found"))

	intents, err := repo.GetExpiredIntents(context.Background())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to get expired intents")
	assert.Nil(t, intents)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestGetExpiredIntents_SkipsGetByIDErrors(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}
	intent2 := testIntent()
	intent2.ID = "expired-2"

	// Return two IDs, but first one will fail on GetByID
	mock.ExpectQuery("SELECT id FROM intents WHERE status IN").
		WithArgs(sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).
			AddRow("expired-1").
			AddRow("expired-2"))

	// First GetByID fails (race condition: deleted between queries)
	mock.ExpectQuery("SELECT .+ FROM intents WHERE id = \\$1").
		WithArgs("expired-1").
		WillReturnError(sql.ErrNoRows)

	// Second GetByID succeeds
	mock.ExpectQuery("SELECT .+ FROM intents WHERE id = \\$1").
		WithArgs("expired-2").
		WillReturnRows(sqlmock.NewRows(intentColumns).AddRow(intentRow(intent2)...))

	intents, err := repo.GetExpiredIntents(context.Background())
	require.NoError(t, err)
	assert.Len(t, intents, 1)
	assert.Equal(t, "expired-2", intents[0].ID)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---------------------------------------------------------------------------
// GetPendingIntents
// ---------------------------------------------------------------------------

func TestGetPendingIntents_Success(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}
	expected := testIntent()
	expected.ID = "pending-1"
	expected.Status = IntentStatusRouted

	mock.ExpectQuery("SELECT id FROM intents WHERE status = 'routed'").
		WithArgs(sqlmock.AnyArg(), 10).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow("pending-1"))

	mock.ExpectQuery("SELECT .+ FROM intents WHERE id = \\$1").
		WithArgs("pending-1").
		WillReturnRows(sqlmock.NewRows(intentColumns).AddRow(intentRow(expected)...))

	intents, err := repo.GetPendingIntents(context.Background(), 10)
	require.NoError(t, err)
	assert.Len(t, intents, 1)
	assert.Equal(t, "pending-1", intents[0].ID)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestGetPendingIntents_DefaultLimit(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}

	// When limit <= 0, defaults to 100
	mock.ExpectQuery("SELECT id FROM intents WHERE status = 'routed'").
		WithArgs(sqlmock.AnyArg(), 100).
		WillReturnRows(sqlmock.NewRows([]string{"id"}))

	intents, err := repo.GetPendingIntents(context.Background(), 0)
	require.NoError(t, err)
	assert.Empty(t, intents)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestGetPendingIntents_NegativeLimit(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}

	mock.ExpectQuery("SELECT id FROM intents WHERE status = 'routed'").
		WithArgs(sqlmock.AnyArg(), 100).
		WillReturnRows(sqlmock.NewRows([]string{"id"}))

	intents, err := repo.GetPendingIntents(context.Background(), -5)
	require.NoError(t, err)
	assert.Empty(t, intents)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestGetPendingIntents_QueryError(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}

	mock.ExpectQuery("SELECT id FROM intents WHERE status = 'routed'").
		WillReturnError(errors.New("timeout"))

	intents, err := repo.GetPendingIntents(context.Background(), 10)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to get pending intents")
	assert.Nil(t, intents)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestGetPendingIntents_MultipleWithPriorityOrder(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}

	urgent := testIntent()
	urgent.ID = "urgent-1"
	urgent.Priority = PriorityUrgent
	urgent.Status = IntentStatusRouted

	normal := testIntent()
	normal.ID = "normal-1"
	normal.Priority = PriorityNormal
	normal.Status = IntentStatusRouted

	// IDs returned in priority order (urgent first)
	mock.ExpectQuery("SELECT id FROM intents WHERE status = 'routed'").
		WithArgs(sqlmock.AnyArg(), 50).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).
			AddRow("urgent-1").
			AddRow("normal-1"))

	mock.ExpectQuery("SELECT .+ FROM intents WHERE id = \\$1").
		WithArgs("urgent-1").
		WillReturnRows(sqlmock.NewRows(intentColumns).AddRow(intentRow(urgent)...))

	mock.ExpectQuery("SELECT .+ FROM intents WHERE id = \\$1").
		WithArgs("normal-1").
		WillReturnRows(sqlmock.NewRows(intentColumns).AddRow(intentRow(normal)...))

	intents, err := repo.GetPendingIntents(context.Background(), 50)
	require.NoError(t, err)
	assert.Len(t, intents, 2)
	assert.Equal(t, "urgent-1", intents[0].ID)
	assert.Equal(t, "normal-1", intents[1].ID)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---------------------------------------------------------------------------
// CountByStatus
// ---------------------------------------------------------------------------

func TestCountByStatus_Success(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}

	mock.ExpectQuery("SELECT status, COUNT\\(\\*\\) as count FROM intents GROUP BY status").
		WillReturnRows(sqlmock.NewRows([]string{"status", "count"}).
			AddRow("pending", 5).
			AddRow("routed", 3).
			AddRow("completed", 10).
			AddRow("failed", 2))

	counts, err := repo.CountByStatus(context.Background())
	require.NoError(t, err)
	assert.Equal(t, int64(5), counts[IntentStatusPending])
	assert.Equal(t, int64(3), counts[IntentStatusRouted])
	assert.Equal(t, int64(10), counts[IntentStatusCompleted])
	assert.Equal(t, int64(2), counts[IntentStatusFailed])
	assert.Len(t, counts, 4)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestCountByStatus_Empty(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}

	mock.ExpectQuery("SELECT status, COUNT\\(\\*\\) as count FROM intents GROUP BY status").
		WillReturnRows(sqlmock.NewRows([]string{"status", "count"}))

	counts, err := repo.CountByStatus(context.Background())
	require.NoError(t, err)
	assert.Empty(t, counts)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestCountByStatus_DBError(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}

	mock.ExpectQuery("SELECT status, COUNT\\(\\*\\) as count FROM intents GROUP BY status").
		WillReturnError(errors.New("permission denied"))

	counts, err := repo.CountByStatus(context.Background())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to count by status")
	assert.Nil(t, counts)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---------------------------------------------------------------------------
// RepositoryAdapter
// ---------------------------------------------------------------------------

func TestNewRepositoryAdapter(t *testing.T) {
	db, _, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := NewRepository(db)
	adapter := NewRepositoryAdapter(repo)
	require.NotNil(t, adapter)
	assert.Equal(t, repo, adapter.repo)
}

// Verify RepositoryAdapter satisfies RepositoryInterface at compile time.
var _ RepositoryInterface = (*RepositoryAdapter)(nil)

func TestRepositoryAdapter_Create(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	adapter := NewRepositoryAdapter(&Repository{db: db})
	intent := testIntent()

	mock.ExpectExec("INSERT INTO intents").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err = adapter.Create(context.Background(), intent)
	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestRepositoryAdapter_GetByID(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	adapter := NewRepositoryAdapter(&Repository{db: db})
	expected := testIntent()

	mock.ExpectQuery("SELECT .+ FROM intents WHERE id = \\$1").
		WithArgs(expected.ID).
		WillReturnRows(sqlmock.NewRows(intentColumns).AddRow(intentRow(expected)...))

	result, err := adapter.GetByID(context.Background(), expected.ID)
	require.NoError(t, err)
	assert.Equal(t, expected.ID, result.ID)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestRepositoryAdapter_BeginTx(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	adapter := NewRepositoryAdapter(&Repository{db: db})

	mock.ExpectBegin()

	tx, err := adapter.BeginTx(context.Background())
	require.NoError(t, err)
	require.NotNil(t, tx)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestRepositoryAdapter_GetByIDForUpdate(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	adapter := NewRepositoryAdapter(&Repository{db: db})
	expected := testIntent()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT .+ FROM intents WHERE id = \\$1 FOR UPDATE").
		WithArgs(expected.ID).
		WillReturnRows(sqlmock.NewRows(intentColumns).AddRow(intentRow(expected)...))

	tx, err := adapter.BeginTx(context.Background())
	require.NoError(t, err)

	result, err := adapter.GetByIDForUpdate(context.Background(), tx, expected.ID)
	require.NoError(t, err)
	assert.Equal(t, expected.ID, result.ID)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestRepositoryAdapter_GetByIDForUpdate_InvalidTxType(t *testing.T) {
	db, _, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	adapter := NewRepositoryAdapter(&Repository{db: db})

	// Pass a mock that is not *Tx
	fakeTx := &mockAdapterTx{}
	result, err := adapter.GetByIDForUpdate(context.Background(), fakeTx, "id-1")
	assert.Nil(t, result)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "invalid transaction type")
}

func TestRepositoryAdapter_Update(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	adapter := NewRepositoryAdapter(&Repository{db: db})
	intent := testIntent()

	mock.ExpectExec("UPDATE intents SET").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err = adapter.Update(context.Background(), intent)
	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestRepositoryAdapter_UpdateInTx(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	adapter := NewRepositoryAdapter(&Repository{db: db})
	intent := testIntent()

	mock.ExpectBegin()
	mock.ExpectExec("UPDATE intents SET").
		WillReturnResult(sqlmock.NewResult(0, 1))

	tx, err := adapter.BeginTx(context.Background())
	require.NoError(t, err)

	err = adapter.UpdateInTx(context.Background(), tx, intent)
	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestRepositoryAdapter_UpdateInTx_InvalidTxType(t *testing.T) {
	db, _, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	adapter := NewRepositoryAdapter(&Repository{db: db})

	fakeTx := &mockAdapterTx{}
	err = adapter.UpdateInTx(context.Background(), fakeTx, testIntent())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "invalid transaction type")
}

func TestRepositoryAdapter_UpdateStatus(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	adapter := NewRepositoryAdapter(&Repository{db: db})

	mock.ExpectExec("UPDATE intents SET").
		WithArgs("intent-1", string(IntentStatusCompleted), "").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err = adapter.UpdateStatus(context.Background(), "intent-1", IntentStatusCompleted, "")
	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestRepositoryAdapter_List(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	adapter := NewRepositoryAdapter(&Repository{db: db})

	mock.ExpectQuery("SELECT COUNT").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectQuery("SELECT .+ FROM intents").
		WillReturnRows(sqlmock.NewRows(intentColumns))

	intents, total, err := adapter.List(context.Background(), ListIntentsRequest{})
	require.NoError(t, err)
	assert.Equal(t, int64(0), total)
	assert.Empty(t, intents)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestRepositoryAdapter_GetExpiredIntents(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	adapter := NewRepositoryAdapter(&Repository{db: db})

	mock.ExpectQuery("SELECT id FROM intents WHERE status IN").
		WillReturnRows(sqlmock.NewRows([]string{"id"}))

	intents, err := adapter.GetExpiredIntents(context.Background())
	require.NoError(t, err)
	assert.Empty(t, intents)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestRepositoryAdapter_GetPendingIntents(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	adapter := NewRepositoryAdapter(&Repository{db: db})

	mock.ExpectQuery("SELECT id FROM intents WHERE status = 'routed'").
		WillReturnRows(sqlmock.NewRows([]string{"id"}))

	intents, err := adapter.GetPendingIntents(context.Background(), 10)
	require.NoError(t, err)
	assert.Empty(t, intents)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestRepositoryAdapter_CountByStatus(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	adapter := NewRepositoryAdapter(&Repository{db: db})

	mock.ExpectQuery("SELECT status, COUNT").
		WillReturnRows(sqlmock.NewRows([]string{"status", "count"}).AddRow("pending", 1))

	counts, err := adapter.CountByStatus(context.Background())
	require.NoError(t, err)
	assert.Equal(t, int64(1), counts[IntentStatusPending])
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---------------------------------------------------------------------------
// JSON round-trip edge cases
// ---------------------------------------------------------------------------

func TestGetByID_ComplexRouteRoundTrip(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}

	route1 := testRoute()
	route2 := &Route{
		ID:             "route-2",
		SourceNetwork:  "eip155:42161",
		TargetNetwork:  "eip155:8453",
		SourceAsset:    "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
		TargetAsset:    "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
		InputAmount:    "1000000",
		OutputAmount:   "998000",
		EstimatedGas:   "30000",
		EstimatedTime:  60,
		Slippage:       0.002,
		Score:          0.90,
		RequiresBridge: true,
		BridgeProtocol: "stargate",
		ValidUntil:     time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC),
		Steps: []*RouteStep{
			{Order: 1, Type: StepTypeApprove, Network: "eip155:42161"},
			{Order: 2, Type: StepTypeBridge, Network: "eip155:42161", Protocol: "stargate"},
		},
	}

	intent := testIntent()
	intent.SelectedRoute = route1
	intent.AvailableRoutes = []*Route{route1, route2}
	intent.Metadata = map[string]string{
		"source": "api",
		"ref":    "order-456",
	}

	row := intentRow(intent)
	mock.ExpectQuery("SELECT .+ FROM intents WHERE id = \\$1").
		WithArgs(intent.ID).
		WillReturnRows(sqlmock.NewRows(intentColumns).AddRow(row...))

	result, err := repo.GetByID(context.Background(), intent.ID)
	require.NoError(t, err)
	require.NotNil(t, result.SelectedRoute)
	assert.Equal(t, "route-1", result.SelectedRoute.ID)
	assert.Len(t, result.AvailableRoutes, 2)
	assert.Equal(t, "route-2", result.AvailableRoutes[1].ID)
	assert.Len(t, result.AvailableRoutes[1].Steps, 2)
	assert.Equal(t, "api", result.Metadata["source"])
	assert.Equal(t, "order-456", result.Metadata["ref"])
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---------------------------------------------------------------------------
// Full transaction workflow integration
// ---------------------------------------------------------------------------

func TestFullTransactionWorkflow(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}
	intent := testIntent()
	intent.Status = IntentStatusRouted

	// Begin transaction
	mock.ExpectBegin()

	// GetByIDForUpdate
	mock.ExpectQuery("SELECT .+ FROM intents WHERE id = \\$1 FOR UPDATE").
		WithArgs(intent.ID).
		WillReturnRows(sqlmock.NewRows(intentColumns).AddRow(intentRow(intent)...))

	// UpdateInTx
	mock.ExpectExec("UPDATE intents SET").
		WillReturnResult(sqlmock.NewResult(0, 1))

	// Commit
	mock.ExpectCommit()

	tx, err := repo.BeginTx(context.Background())
	require.NoError(t, err)

	fetched, err := repo.GetByIDForUpdate(context.Background(), tx, intent.ID)
	require.NoError(t, err)
	assert.Equal(t, intent.ID, fetched.ID)

	fetched.Status = IntentStatusExecuting
	now := time.Now().UTC()
	fetched.ExecutedAt = &now

	err = repo.UpdateInTx(context.Background(), tx, fetched)
	require.NoError(t, err)

	err = tx.Commit()
	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestFullTransactionWorkflow_RollbackOnError(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT .+ FROM intents WHERE id = \\$1 FOR UPDATE").
		WithArgs("intent-1").
		WillReturnError(errors.New("lock timeout"))
	mock.ExpectRollback()

	tx, err := repo.BeginTx(context.Background())
	require.NoError(t, err)

	_, err = repo.GetByIDForUpdate(context.Background(), tx, "intent-1")
	require.Error(t, err)

	err = tx.Rollback()
	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

func TestCreate_WithExecutedAt(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}
	intent := testIntent()
	executed := time.Date(2026, 2, 9, 12, 10, 0, 0, time.UTC)
	intent.ExecutedAt = &executed
	intent.Status = IntentStatusCompleted
	intent.TxHashes = []string{"0xabc", "0xdef"}

	mock.ExpectExec("INSERT INTO intents").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err = repo.Create(context.Background(), intent)
	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestCreate_EmptySlices(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}
	intent := &Intent{
		ID:             "intent-empty-slices",
		Payer:          "0xAlice",
		Payee:          "0xBob",
		Amount:         "100",
		Asset:          "USDT",
		SourceNetworks: []string{},
		TxHashes:       []string{},
		Priority:       PriorityNormal,
		Status:         IntentStatusPending,
	}

	mock.ExpectExec("INSERT INTO intents").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err = repo.Create(context.Background(), intent)
	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestUpdate_WithErrorMessage(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}
	intent := testIntent()
	intent.Status = IntentStatusFailed
	intent.ErrorMessage = "insufficient funds on source chain"

	mock.ExpectExec("UPDATE intents SET").
		WithArgs(
			intent.ID, string(intent.Status),
			sqlmock.AnyArg(), sqlmock.AnyArg(),
			intent.ExecutedAt,
			sqlmock.AnyArg(),
			intent.ErrorMessage,
			sqlmock.AnyArg(),
		).
		WillReturnResult(sqlmock.NewResult(0, 1))

	err = repo.Update(context.Background(), intent)
	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestGetByID_ErrorMessageField(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}
	intent := testIntent()
	intent.Status = IntentStatusFailed
	intent.ErrorMessage = "bridge timeout"

	row := intentRow(intent)
	mock.ExpectQuery("SELECT .+ FROM intents WHERE id = \\$1").
		WithArgs(intent.ID).
		WillReturnRows(sqlmock.NewRows(intentColumns).AddRow(row...))

	result, err := repo.GetByID(context.Background(), intent.ID)
	require.NoError(t, err)
	assert.Equal(t, "bridge timeout", result.ErrorMessage)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---------------------------------------------------------------------------
// mockAdapterTx is a fake TxInterface for testing adapter type assertions
// ---------------------------------------------------------------------------

type mockAdapterTx struct{}

func (m *mockAdapterTx) Commit() error   { return nil }
func (m *mockAdapterTx) Rollback() error { return nil }

// ---------------------------------------------------------------------------
// Table-driven tests for Update/UpdateInTx RowsAffected error path
// ---------------------------------------------------------------------------

func TestUpdate_RowsAffectedError(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}
	intent := testIntent()

	mock.ExpectExec("UPDATE intents SET").
		WillReturnResult(sqlmock.NewErrorResult(fmt.Errorf("rows affected error")))

	err = repo.Update(context.Background(), intent)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to get rows affected")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestUpdateInTx_RowsAffectedError(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}
	intent := testIntent()

	mock.ExpectBegin()
	mock.ExpectExec("UPDATE intents SET").
		WillReturnResult(sqlmock.NewErrorResult(fmt.Errorf("rows affected error")))

	tx, err := repo.BeginTx(context.Background())
	require.NoError(t, err)

	err = repo.UpdateInTx(context.Background(), tx, intent)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to get rows affected")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestUpdateStatus_RowsAffectedError(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := &Repository{db: db}

	mock.ExpectExec("UPDATE intents SET").
		WithArgs("intent-1", string(IntentStatusFailed), "err").
		WillReturnResult(sqlmock.NewErrorResult(fmt.Errorf("rows affected error")))

	err = repo.UpdateStatus(context.Background(), "intent-1", IntentStatusFailed, "err")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to get rows affected")
	assert.NoError(t, mock.ExpectationsWereMet())
}
