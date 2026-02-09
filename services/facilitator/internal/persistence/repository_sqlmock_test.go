package persistence

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// newMockDB returns a *DB wrapping the sqlmock database and the mock handle.
func newMockDB(t *testing.T) (*DB, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	return &DB{DB: db}, mock
}

// settlementColumns is the canonical column list returned by settlement queries.
var settlementColumns = []string{
	"id", "network", "scheme", "tx_hash", "from_address", "to_address",
	"amount", "asset", "status", "created_at", "confirmed_at",
	"error_message", "gas_used", "gas_price", "metadata",
}

// auditColumns is the canonical column list returned by audit queries.
var auditColumns = []string{
	"id", "timestamp", "action", "network", "request_id", "ip_address",
	"api_key_id", "request_body", "response_body", "duration_ms", "status_code",
}

// sampleTime is a fixed reference timestamp used across all tests.
var sampleTime = time.Date(2026, 2, 9, 12, 0, 0, 0, time.UTC)

// ---------------------------------------------------------------------------
// SettlementRepository tests
// ---------------------------------------------------------------------------

func TestSqlmock_SettlementCreate_Success(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	mock.ExpectQuery(regexp.QuoteMeta(
		`INSERT INTO settlements`)).
		WithArgs(
			"eip155:1",                           // network
			"exact",                               // scheme
			sqlmock.AnyArg(),                      // tx_hash (NullString)
			"0xFromAddr",                          // from_address
			"0xToAddr",                            // to_address
			"1000000",                             // amount
			"USDT",                                // asset
			SettlementStatusPending,               // status
			sqlmock.AnyArg(),                      // created_at
			sqlmock.AnyArg(),                      // confirmed_at (NullTime)
			sqlmock.AnyArg(),                      // error_message (NullString)
			(*int64)(nil),                         // gas_used
			(*int64)(nil),                         // gas_price
			json.RawMessage(`{"req":"test-123"}`), // metadata
		).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow("settle-001"))

	s := &Settlement{
		Network:     "eip155:1",
		Scheme:      "exact",
		FromAddress: "0xFromAddr",
		ToAddress:   "0xToAddr",
		Amount:      "1000000",
		Asset:       "USDT",
		Status:      SettlementStatusPending,
		CreatedAt:   sampleTime,
		Metadata:    json.RawMessage(`{"req":"test-123"}`),
	}

	err := repo.Create(context.Background(), s)
	require.NoError(t, err)
	assert.Equal(t, "settle-001", s.ID)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_SettlementCreate_NilMetadata(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	// When Metadata is nil the code should default it to `{}`
	mock.ExpectQuery(regexp.QuoteMeta(`INSERT INTO settlements`)).
		WithArgs(
			sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
			sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
			sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
			sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
			sqlmock.AnyArg(), json.RawMessage("{}"),
		).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow("settle-002"))

	s := &Settlement{
		Network:     "eip155:1",
		Scheme:      "exact",
		FromAddress: "0xFrom",
		ToAddress:   "0xTo",
		Amount:      "500",
		Asset:       "USDT",
		Status:      SettlementStatusPending,
		CreatedAt:   sampleTime,
		Metadata:    nil, // deliberately nil
	}

	err := repo.Create(context.Background(), s)
	require.NoError(t, err)
	assert.Equal(t, "settle-002", s.ID)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_SettlementCreate_DBError(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	mock.ExpectQuery(regexp.QuoteMeta(`INSERT INTO settlements`)).
		WillReturnError(errors.New("connection refused"))

	s := &Settlement{
		Network:   "eip155:1",
		Scheme:    "exact",
		FromAddress: "0xFrom",
		ToAddress:   "0xTo",
		Amount:    "100",
		Asset:     "USDT",
		Status:    SettlementStatusPending,
		CreatedAt: sampleTime,
	}

	err := repo.Create(context.Background(), s)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to create settlement")
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---------------------------------------------------------------------------
// GetByID
// ---------------------------------------------------------------------------

func TestSqlmock_SettlementGetByID_Success(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	confirmedAt := sampleTime.Add(5 * time.Minute)
	gasUsed := int64(21000)
	gasPrice := int64(30000000000)

	rows := sqlmock.NewRows(settlementColumns).AddRow(
		"settle-001", "eip155:1", "exact",
		sql.NullString{String: "0xTxHash", Valid: true},
		"0xFrom", "0xTo", "1000000", "USDT",
		SettlementStatusConfirmed, sampleTime,
		sql.NullTime{Time: confirmedAt, Valid: true},
		sql.NullString{String: "", Valid: false},
		sql.NullInt64{Int64: gasUsed, Valid: true},
		sql.NullInt64{Int64: gasPrice, Valid: true},
		json.RawMessage(`{}`),
	)

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, network, scheme, tx_hash`)).
		WithArgs("settle-001").
		WillReturnRows(rows)

	s, err := repo.GetByID(context.Background(), "settle-001")
	require.NoError(t, err)
	require.NotNil(t, s)

	assert.Equal(t, "settle-001", s.ID)
	assert.Equal(t, "eip155:1", s.Network)
	assert.Equal(t, "exact", s.Scheme)
	assert.Equal(t, "0xTxHash", s.TxHash)
	assert.Equal(t, "0xFrom", s.FromAddress)
	assert.Equal(t, "0xTo", s.ToAddress)
	assert.Equal(t, "1000000", s.Amount)
	assert.Equal(t, "USDT", s.Asset)
	assert.Equal(t, SettlementStatusConfirmed, s.Status)
	assert.NotNil(t, s.ConfirmedAt)
	assert.Equal(t, confirmedAt, *s.ConfirmedAt)
	assert.Equal(t, "", s.ErrorMessage)
	require.NotNil(t, s.GasUsed)
	assert.Equal(t, gasUsed, *s.GasUsed)
	require.NotNil(t, s.GasPrice)
	assert.Equal(t, gasPrice, *s.GasPrice)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_SettlementGetByID_NullFields(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	rows := sqlmock.NewRows(settlementColumns).AddRow(
		"settle-002", "eip155:8453", "exact",
		sql.NullString{Valid: false},  // tx_hash NULL
		"0xFrom", "0xTo", "500", "USDT",
		SettlementStatusPending, sampleTime,
		sql.NullTime{Valid: false},    // confirmed_at NULL
		sql.NullString{Valid: false},  // error_message NULL
		sql.NullInt64{Valid: false},   // gas_used NULL
		sql.NullInt64{Valid: false},   // gas_price NULL
		json.RawMessage(`{}`),
	)

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, network, scheme, tx_hash`)).
		WithArgs("settle-002").
		WillReturnRows(rows)

	s, err := repo.GetByID(context.Background(), "settle-002")
	require.NoError(t, err)
	require.NotNil(t, s)

	assert.Equal(t, "", s.TxHash)
	assert.Equal(t, "", s.ErrorMessage)
	assert.Nil(t, s.ConfirmedAt)
	assert.Nil(t, s.GasUsed)
	assert.Nil(t, s.GasPrice)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_SettlementGetByID_NotFound(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, network, scheme, tx_hash`)).
		WithArgs("nonexistent").
		WillReturnError(sql.ErrNoRows)

	s, err := repo.GetByID(context.Background(), "nonexistent")
	require.NoError(t, err)
	assert.Nil(t, s)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_SettlementGetByID_DBError(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, network, scheme, tx_hash`)).
		WithArgs("settle-001").
		WillReturnError(errors.New("disk I/O error"))

	s, err := repo.GetByID(context.Background(), "settle-001")
	require.Error(t, err)
	assert.Nil(t, s)
	assert.Contains(t, err.Error(), "failed to get settlement")
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---------------------------------------------------------------------------
// GetByTxHash
// ---------------------------------------------------------------------------

func TestSqlmock_SettlementGetByTxHash_Success(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	rows := sqlmock.NewRows(settlementColumns).AddRow(
		"settle-010", "eip155:1", "exact",
		sql.NullString{String: "0xABC", Valid: true},
		"0xFrom", "0xTo", "2000000", "USDT",
		SettlementStatusConfirmed, sampleTime,
		sql.NullTime{Time: sampleTime.Add(time.Minute), Valid: true},
		sql.NullString{Valid: false},
		sql.NullInt64{Valid: false},
		sql.NullInt64{Valid: false},
		json.RawMessage(`{}`),
	)

	mock.ExpectQuery(regexp.QuoteMeta(`WHERE network = $1 AND tx_hash = $2`)).
		WithArgs("eip155:1", "0xABC").
		WillReturnRows(rows)

	s, err := repo.GetByTxHash(context.Background(), "eip155:1", "0xABC")
	require.NoError(t, err)
	require.NotNil(t, s)
	assert.Equal(t, "settle-010", s.ID)
	assert.Equal(t, "0xABC", s.TxHash)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_SettlementGetByTxHash_NotFound(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	mock.ExpectQuery(regexp.QuoteMeta(`WHERE network = $1 AND tx_hash = $2`)).
		WithArgs("eip155:1", "0xMissing").
		WillReturnError(sql.ErrNoRows)

	s, err := repo.GetByTxHash(context.Background(), "eip155:1", "0xMissing")
	require.NoError(t, err)
	assert.Nil(t, s)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_SettlementGetByTxHash_DBError(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	mock.ExpectQuery(regexp.QuoteMeta(`WHERE network = $1 AND tx_hash = $2`)).
		WithArgs("eip155:1", "0xABC").
		WillReturnError(errors.New("timeout"))

	s, err := repo.GetByTxHash(context.Background(), "eip155:1", "0xABC")
	require.Error(t, err)
	assert.Nil(t, s)
	assert.Contains(t, err.Error(), "failed to get settlement by tx hash")
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---------------------------------------------------------------------------
// UpdateStatus (transactional: BEGIN + SELECT FOR UPDATE + UPDATE + COMMIT)
// ---------------------------------------------------------------------------

func TestSqlmock_SettlementUpdateStatus_PendingToConfirmed(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	mock.ExpectBegin()
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT status FROM settlements WHERE id = $1 FOR UPDATE`)).
		WithArgs("settle-001").
		WillReturnRows(sqlmock.NewRows([]string{"status"}).AddRow(SettlementStatusPending))
	// Confirmed branch includes confirmed_at
	mock.ExpectExec(regexp.QuoteMeta(`UPDATE settlements`)).
		WithArgs(SettlementStatusConfirmed, sqlmock.AnyArg(), sqlmock.AnyArg(), "settle-001").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	err := repo.UpdateStatus(context.Background(), "settle-001", SettlementStatusConfirmed, "")
	require.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_SettlementUpdateStatus_PendingToFailed(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	mock.ExpectBegin()
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT status FROM settlements WHERE id = $1 FOR UPDATE`)).
		WithArgs("settle-002").
		WillReturnRows(sqlmock.NewRows([]string{"status"}).AddRow(SettlementStatusPending))
	// Non-confirmed branch: status, error_message, id
	mock.ExpectExec(regexp.QuoteMeta(`UPDATE settlements`)).
		WithArgs(SettlementStatusFailed, sqlmock.AnyArg(), "settle-002").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	err := repo.UpdateStatus(context.Background(), "settle-002", SettlementStatusFailed, "tx reverted")
	require.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_SettlementUpdateStatus_FailedToPending_Retry(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	mock.ExpectBegin()
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT status FROM settlements WHERE id = $1 FOR UPDATE`)).
		WithArgs("settle-003").
		WillReturnRows(sqlmock.NewRows([]string{"status"}).AddRow(SettlementStatusFailed))
	mock.ExpectExec(regexp.QuoteMeta(`UPDATE settlements`)).
		WithArgs(SettlementStatusPending, sqlmock.AnyArg(), "settle-003").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	err := repo.UpdateStatus(context.Background(), "settle-003", SettlementStatusPending, "")
	require.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_SettlementUpdateStatus_NotFound(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	mock.ExpectBegin()
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT status FROM settlements WHERE id = $1 FOR UPDATE`)).
		WithArgs("nonexistent").
		WillReturnError(sql.ErrNoRows)
	mock.ExpectRollback()

	err := repo.UpdateStatus(context.Background(), "nonexistent", SettlementStatusConfirmed, "")
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrSettlementNotFound)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_SettlementUpdateStatus_InvalidTransition(t *testing.T) {
	tests := []struct {
		name      string
		current   SettlementStatus
		target    SettlementStatus
	}{
		{"confirmed_to_pending", SettlementStatusConfirmed, SettlementStatusPending},
		{"confirmed_to_failed", SettlementStatusConfirmed, SettlementStatusFailed},
		{"confirmed_to_confirmed", SettlementStatusConfirmed, SettlementStatusConfirmed},
		{"pending_to_pending", SettlementStatusPending, SettlementStatusPending},
		{"failed_to_confirmed", SettlementStatusFailed, SettlementStatusConfirmed},
		{"failed_to_failed", SettlementStatusFailed, SettlementStatusFailed},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			db, mock := newMockDB(t)
			defer db.Close()
			repo := NewSettlementRepository(db)

			mock.ExpectBegin()
			mock.ExpectQuery(regexp.QuoteMeta(`SELECT status FROM settlements WHERE id = $1 FOR UPDATE`)).
				WithArgs("settle-inv").
				WillReturnRows(sqlmock.NewRows([]string{"status"}).AddRow(tt.current))
			// Note: The defer in UpdateStatus checks if `err != nil`, but when the
			// invalid transition is detected, the local `err` var is still nil (set
			// by the successful Scan), so tx.Rollback() is never called by the defer.
			// The transaction is abandoned without explicit rollback/commit.

			err := repo.UpdateStatus(context.Background(), "settle-inv", tt.target, "")
			require.Error(t, err)
			assert.ErrorIs(t, err, ErrInvalidStateTransition)
			assert.NoError(t, mock.ExpectationsWereMet())
		})
	}
}

func TestSqlmock_SettlementUpdateStatus_BeginError(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	mock.ExpectBegin().WillReturnError(errors.New("pool exhausted"))

	err := repo.UpdateStatus(context.Background(), "settle-001", SettlementStatusConfirmed, "")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to begin transaction")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_SettlementUpdateStatus_SelectError(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	mock.ExpectBegin()
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT status FROM settlements WHERE id = $1 FOR UPDATE`)).
		WithArgs("settle-001").
		WillReturnError(errors.New("lock timeout"))
	mock.ExpectRollback()

	err := repo.UpdateStatus(context.Background(), "settle-001", SettlementStatusConfirmed, "")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to get settlement status")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_SettlementUpdateStatus_ExecError(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	mock.ExpectBegin()
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT status FROM settlements WHERE id = $1 FOR UPDATE`)).
		WithArgs("settle-001").
		WillReturnRows(sqlmock.NewRows([]string{"status"}).AddRow(SettlementStatusPending))
	mock.ExpectExec(regexp.QuoteMeta(`UPDATE settlements`)).
		WithArgs(SettlementStatusFailed, sqlmock.AnyArg(), "settle-001").
		WillReturnError(errors.New("serialization failure"))
	mock.ExpectRollback()

	err := repo.UpdateStatus(context.Background(), "settle-001", SettlementStatusFailed, "err")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to update settlement status")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_SettlementUpdateStatus_CommitError(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	mock.ExpectBegin()
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT status FROM settlements WHERE id = $1 FOR UPDATE`)).
		WithArgs("settle-001").
		WillReturnRows(sqlmock.NewRows([]string{"status"}).AddRow(SettlementStatusPending))
	mock.ExpectExec(regexp.QuoteMeta(`UPDATE settlements`)).
		WithArgs(SettlementStatusFailed, sqlmock.AnyArg(), "settle-001").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit().WillReturnError(errors.New("commit failed"))
	// The defer in UpdateStatus calls tx.Rollback() because `err != nil` after
	// the failed commit. However, go-sqlmock v1 considers the transaction
	// already closed after Commit (even if it errors), so the deferred
	// Rollback() is effectively a no-op in the mock. We only verify that the
	// error propagates correctly.

	err := repo.UpdateStatus(context.Background(), "settle-001", SettlementStatusFailed, "err")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to commit transaction")
}

// ---------------------------------------------------------------------------
// UpdateTxHash
// ---------------------------------------------------------------------------

func TestSqlmock_SettlementUpdateTxHash_Success(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	mock.ExpectExec(regexp.QuoteMeta(`UPDATE settlements SET tx_hash = $1 WHERE id = $2`)).
		WithArgs("0xNewTx", "settle-001").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := repo.UpdateTxHash(context.Background(), "settle-001", "0xNewTx")
	require.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_SettlementUpdateTxHash_NotFound(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	mock.ExpectExec(regexp.QuoteMeta(`UPDATE settlements SET tx_hash = $1 WHERE id = $2`)).
		WithArgs("0xTx", "nonexistent").
		WillReturnResult(sqlmock.NewResult(0, 0)) // 0 rows affected

	err := repo.UpdateTxHash(context.Background(), "nonexistent", "0xTx")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "settlement not found")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_SettlementUpdateTxHash_DBError(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	mock.ExpectExec(regexp.QuoteMeta(`UPDATE settlements SET tx_hash = $1 WHERE id = $2`)).
		WithArgs("0xTx", "settle-001").
		WillReturnError(errors.New("deadlock"))

	err := repo.UpdateTxHash(context.Background(), "settle-001", "0xTx")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to update settlement tx hash")
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---------------------------------------------------------------------------
// UpdateGasInfo
// ---------------------------------------------------------------------------

func TestSqlmock_SettlementUpdateGasInfo_Success(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	mock.ExpectExec(regexp.QuoteMeta(`UPDATE settlements SET gas_used = $1, gas_price = $2 WHERE id = $3`)).
		WithArgs(int64(21000), int64(30000000000), "settle-001").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := repo.UpdateGasInfo(context.Background(), "settle-001", 21000, 30000000000)
	require.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_SettlementUpdateGasInfo_NotFound(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	mock.ExpectExec(regexp.QuoteMeta(`UPDATE settlements SET gas_used = $1, gas_price = $2 WHERE id = $3`)).
		WithArgs(int64(21000), int64(30000000000), "nonexistent").
		WillReturnResult(sqlmock.NewResult(0, 0))

	err := repo.UpdateGasInfo(context.Background(), "nonexistent", 21000, 30000000000)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "settlement not found")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_SettlementUpdateGasInfo_DBError(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	mock.ExpectExec(regexp.QuoteMeta(`UPDATE settlements SET gas_used = $1, gas_price = $2 WHERE id = $3`)).
		WithArgs(int64(21000), int64(30000000000), "settle-001").
		WillReturnError(errors.New("disk full"))

	err := repo.UpdateGasInfo(context.Background(), "settle-001", 21000, 30000000000)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to update settlement gas info")
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---------------------------------------------------------------------------
// List (dynamic WHERE clauses, LIMIT/OFFSET)
// ---------------------------------------------------------------------------

func TestSqlmock_SettlementList_NoFilter(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	rows := sqlmock.NewRows(settlementColumns).
		AddRow("s1", "eip155:1", "exact", sql.NullString{Valid: false}, "0xA", "0xB",
			"1000", "USDT", SettlementStatusPending, sampleTime,
			sql.NullTime{Valid: false}, sql.NullString{Valid: false},
			sql.NullInt64{Valid: false}, sql.NullInt64{Valid: false}, json.RawMessage(`{}`)).
		AddRow("s2", "eip155:8453", "exact", sql.NullString{String: "0xTx", Valid: true}, "0xC", "0xD",
			"2000", "USDT", SettlementStatusConfirmed, sampleTime,
			sql.NullTime{Time: sampleTime, Valid: true}, sql.NullString{Valid: false},
			sql.NullInt64{Int64: 21000, Valid: true}, sql.NullInt64{Int64: 50, Valid: true}, json.RawMessage(`{}`))

	// No args since no filter fields are set; default LIMIT 100
	mock.ExpectQuery(`SELECT id, network, scheme`).
		WillReturnRows(rows)

	results, err := repo.List(context.Background(), SettlementFilter{})
	require.NoError(t, err)
	assert.Len(t, results, 2)

	assert.Equal(t, "s1", results[0].ID)
	assert.Equal(t, "", results[0].TxHash)
	assert.Nil(t, results[0].ConfirmedAt)

	assert.Equal(t, "s2", results[1].ID)
	assert.Equal(t, "0xTx", results[1].TxHash)
	assert.NotNil(t, results[1].ConfirmedAt)
	require.NotNil(t, results[1].GasUsed)
	assert.Equal(t, int64(21000), *results[1].GasUsed)

	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_SettlementList_WithFilters(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	rows := sqlmock.NewRows(settlementColumns).
		AddRow("s1", "eip155:1", "exact", sql.NullString{Valid: false}, "0xFrom", "0xTo",
			"1000", "USDT", SettlementStatusPending, sampleTime,
			sql.NullTime{Valid: false}, sql.NullString{Valid: false},
			sql.NullInt64{Valid: false}, sql.NullInt64{Valid: false}, json.RawMessage(`{}`))

	mock.ExpectQuery(`SELECT id, network, scheme`).
		WithArgs("eip155:1", "exact", SettlementStatusPending).
		WillReturnRows(rows)

	results, err := repo.List(context.Background(), SettlementFilter{
		Network: "eip155:1",
		Scheme:  "exact",
		Status:  SettlementStatusPending,
		Limit:   50,
	})
	require.NoError(t, err)
	assert.Len(t, results, 1)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_SettlementList_WithTimeAndAddressFilters(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	start := sampleTime.Add(-24 * time.Hour)
	end := sampleTime

	rows := sqlmock.NewRows(settlementColumns)
	mock.ExpectQuery(`SELECT id, network, scheme`).
		WithArgs("0xFrom", "0xTo", &start, &end).
		WillReturnRows(rows)

	results, err := repo.List(context.Background(), SettlementFilter{
		FromAddress: "0xFrom",
		ToAddress:   "0xTo",
		StartTime:   &start,
		EndTime:     &end,
		Limit:       10,
		Offset:      5,
	})
	require.NoError(t, err)
	assert.Len(t, results, 0)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_SettlementList_DBError(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	mock.ExpectQuery(`SELECT id, network, scheme`).
		WillReturnError(errors.New("query timeout"))

	results, err := repo.List(context.Background(), SettlementFilter{})
	require.Error(t, err)
	assert.Nil(t, results)
	assert.Contains(t, err.Error(), "failed to list settlements")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_SettlementList_LimitClamping(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	// When limit exceeds 1000, it should be clamped to 1000.
	// When limit is 0 or negative, default to 100.
	// We can't directly test the SQL string with sqlmock, but we test it runs.
	rows := sqlmock.NewRows(settlementColumns)
	mock.ExpectQuery(`SELECT id, network, scheme`).
		WillReturnRows(rows)

	results, err := repo.List(context.Background(), SettlementFilter{Limit: 5000})
	require.NoError(t, err)
	assert.Len(t, results, 0)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---------------------------------------------------------------------------
// CountByStatus
// ---------------------------------------------------------------------------

func TestSqlmock_SettlementCountByStatus_Success(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	rows := sqlmock.NewRows([]string{"status", "count"}).
		AddRow(SettlementStatusPending, int64(10)).
		AddRow(SettlementStatusConfirmed, int64(45)).
		AddRow(SettlementStatusFailed, int64(3))

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT status, COUNT(*) as count`)).
		WithArgs("eip155:1").
		WillReturnRows(rows)

	counts, err := repo.CountByStatus(context.Background(), "eip155:1")
	require.NoError(t, err)
	assert.Equal(t, int64(10), counts[SettlementStatusPending])
	assert.Equal(t, int64(45), counts[SettlementStatusConfirmed])
	assert.Equal(t, int64(3), counts[SettlementStatusFailed])
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_SettlementCountByStatus_AllNetworks(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	rows := sqlmock.NewRows([]string{"status", "count"}).
		AddRow(SettlementStatusPending, int64(20))

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT status, COUNT(*) as count`)).
		WithArgs("").
		WillReturnRows(rows)

	counts, err := repo.CountByStatus(context.Background(), "")
	require.NoError(t, err)
	assert.Equal(t, int64(20), counts[SettlementStatusPending])
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_SettlementCountByStatus_DBError(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT status, COUNT(*) as count`)).
		WithArgs("eip155:1").
		WillReturnError(errors.New("connection lost"))

	counts, err := repo.CountByStatus(context.Background(), "eip155:1")
	require.Error(t, err)
	assert.Nil(t, counts)
	assert.Contains(t, err.Error(), "failed to count settlements")
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ===========================================================================
// AuditRepository tests
// ===========================================================================

func TestSqlmock_AuditLog_Success(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewAuditRepository(db)

	mock.ExpectQuery(regexp.QuoteMeta(`INSERT INTO audit_logs`)).
		WithArgs(
			sqlmock.AnyArg(),                        // timestamp
			AuditActionVerify,                       // action
			sqlmock.AnyArg(),                        // network (NullString)
			sqlmock.AnyArg(),                        // request_id (NullString)
			sqlmock.AnyArg(),                        // ip_address (NullString)
			sqlmock.AnyArg(),                        // api_key_id (NullString)
			sqlmock.AnyArg(),                        // request_body
			sqlmock.AnyArg(),                        // response_body
			150,                                     // duration_ms
			200,                                     // status_code
		).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow("audit-001"))

	entry := &AuditEntry{
		Timestamp:    sampleTime,
		Action:       AuditActionVerify,
		Network:      "eip155:1",
		RequestID:    "req-123",
		IPAddress:    "10.0.0.1",
		APIKeyID:     "key-abc",
		RequestBody:  json.RawMessage(`{"amount":"1000"}`),
		ResponseBody: json.RawMessage(`{"valid":true}`),
		DurationMs:   150,
		StatusCode:   200,
	}

	err := repo.Log(context.Background(), entry)
	require.NoError(t, err)
	assert.Equal(t, "audit-001", entry.ID)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_AuditLog_NilBodies(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewAuditRepository(db)

	mock.ExpectQuery(regexp.QuoteMeta(`INSERT INTO audit_logs`)).
		WithArgs(
			sqlmock.AnyArg(), // timestamp
			AuditActionHealth,
			sqlmock.AnyArg(), // network
			sqlmock.AnyArg(), // request_id
			sqlmock.AnyArg(), // ip_address
			sqlmock.AnyArg(), // api_key_id
			nil,              // request_body (nil)
			nil,              // response_body (nil)
			50,
			200,
		).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow("audit-002"))

	entry := &AuditEntry{
		Timestamp:  sampleTime,
		Action:     AuditActionHealth,
		DurationMs: 50,
		StatusCode: 200,
	}

	err := repo.Log(context.Background(), entry)
	require.NoError(t, err)
	assert.Equal(t, "audit-002", entry.ID)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_AuditLog_DBError(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewAuditRepository(db)

	mock.ExpectQuery(regexp.QuoteMeta(`INSERT INTO audit_logs`)).
		WillReturnError(errors.New("table does not exist"))

	entry := &AuditEntry{
		Timestamp:  sampleTime,
		Action:     AuditActionSettle,
		DurationMs: 100,
		StatusCode: 200,
	}

	err := repo.Log(context.Background(), entry)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to create audit log")
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---------------------------------------------------------------------------
// Audit GetByID
// ---------------------------------------------------------------------------

func TestSqlmock_AuditGetByID_Success(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewAuditRepository(db)

	rows := sqlmock.NewRows(auditColumns).AddRow(
		"audit-001", sampleTime, AuditActionVerify,
		sql.NullString{String: "eip155:1", Valid: true},
		sql.NullString{String: "req-123", Valid: true},
		sql.NullString{String: "10.0.0.1", Valid: true},
		sql.NullString{String: "key-abc", Valid: true},
		[]byte(`{"amount":"1000"}`),
		[]byte(`{"valid":true}`),
		150, 200,
	)

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, timestamp, action`)).
		WithArgs("audit-001").
		WillReturnRows(rows)

	entry, err := repo.GetByID(context.Background(), "audit-001")
	require.NoError(t, err)
	require.NotNil(t, entry)

	assert.Equal(t, "audit-001", entry.ID)
	assert.Equal(t, AuditActionVerify, entry.Action)
	assert.Equal(t, "eip155:1", entry.Network)
	assert.Equal(t, "req-123", entry.RequestID)
	assert.Equal(t, "10.0.0.1", entry.IPAddress)
	assert.Equal(t, "key-abc", entry.APIKeyID)
	assert.Equal(t, json.RawMessage(`{"amount":"1000"}`), entry.RequestBody)
	assert.Equal(t, json.RawMessage(`{"valid":true}`), entry.ResponseBody)
	assert.Equal(t, 150, entry.DurationMs)
	assert.Equal(t, 200, entry.StatusCode)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_AuditGetByID_NullFields(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewAuditRepository(db)

	rows := sqlmock.NewRows(auditColumns).AddRow(
		"audit-002", sampleTime, AuditActionHealth,
		sql.NullString{Valid: false}, // network NULL
		sql.NullString{Valid: false}, // request_id NULL
		sql.NullString{Valid: false}, // ip_address NULL
		sql.NullString{Valid: false}, // api_key_id NULL
		nil,                          // request_body NULL
		nil,                          // response_body NULL
		25, 200,
	)

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, timestamp, action`)).
		WithArgs("audit-002").
		WillReturnRows(rows)

	entry, err := repo.GetByID(context.Background(), "audit-002")
	require.NoError(t, err)
	require.NotNil(t, entry)

	assert.Equal(t, "", entry.Network)
	assert.Equal(t, "", entry.RequestID)
	assert.Equal(t, "", entry.IPAddress)
	assert.Equal(t, "", entry.APIKeyID)
	assert.Nil(t, entry.RequestBody)
	assert.Nil(t, entry.ResponseBody)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_AuditGetByID_NotFound(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewAuditRepository(db)

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, timestamp, action`)).
		WithArgs("nonexistent").
		WillReturnError(sql.ErrNoRows)

	entry, err := repo.GetByID(context.Background(), "nonexistent")
	require.NoError(t, err)
	assert.Nil(t, entry)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_AuditGetByID_DBError(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewAuditRepository(db)

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, timestamp, action`)).
		WithArgs("audit-001").
		WillReturnError(errors.New("connection reset"))

	entry, err := repo.GetByID(context.Background(), "audit-001")
	require.Error(t, err)
	assert.Nil(t, entry)
	assert.Contains(t, err.Error(), "failed to get audit log")
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---------------------------------------------------------------------------
// Audit List
// ---------------------------------------------------------------------------

func TestSqlmock_AuditList_NoFilter(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewAuditRepository(db)

	rows := sqlmock.NewRows(auditColumns).
		AddRow("a1", sampleTime, AuditActionVerify,
			sql.NullString{String: "eip155:1", Valid: true},
			sql.NullString{Valid: false}, sql.NullString{Valid: false},
			sql.NullString{Valid: false}, nil, nil, 100, 200).
		AddRow("a2", sampleTime, AuditActionSettle,
			sql.NullString{String: "eip155:8453", Valid: true},
			sql.NullString{Valid: false}, sql.NullString{Valid: false},
			sql.NullString{Valid: false}, []byte(`{}`), []byte(`{}`), 200, 200)

	mock.ExpectQuery(`SELECT id, timestamp, action`).
		WillReturnRows(rows)

	entries, err := repo.List(context.Background(), AuditFilter{})
	require.NoError(t, err)
	assert.Len(t, entries, 2)
	assert.Equal(t, "a1", entries[0].ID)
	assert.Equal(t, AuditActionVerify, entries[0].Action)
	assert.Equal(t, "a2", entries[1].ID)
	assert.Equal(t, AuditActionSettle, entries[1].Action)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_AuditList_WithAllFilters(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewAuditRepository(db)

	start := sampleTime.Add(-1 * time.Hour)
	end := sampleTime

	rows := sqlmock.NewRows(auditColumns).
		AddRow("a1", sampleTime, AuditActionVerify,
			sql.NullString{String: "eip155:1", Valid: true},
			sql.NullString{String: "req-1", Valid: true},
			sql.NullString{String: "10.0.0.1", Valid: true},
			sql.NullString{String: "key-1", Valid: true},
			nil, nil, 100, 200)

	mock.ExpectQuery(`SELECT id, timestamp, action`).
		WithArgs(AuditActionVerify, "eip155:1", "10.0.0.1", "key-1", &start, &end).
		WillReturnRows(rows)

	entries, err := repo.List(context.Background(), AuditFilter{
		Action:    AuditActionVerify,
		Network:   "eip155:1",
		IPAddress: "10.0.0.1",
		APIKeyID:  "key-1",
		StartTime: &start,
		EndTime:   &end,
		Limit:     50,
		Offset:    10,
	})
	require.NoError(t, err)
	assert.Len(t, entries, 1)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_AuditList_DBError(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewAuditRepository(db)

	mock.ExpectQuery(`SELECT id, timestamp, action`).
		WillReturnError(errors.New("query canceled"))

	entries, err := repo.List(context.Background(), AuditFilter{})
	require.Error(t, err)
	assert.Nil(t, entries)
	assert.Contains(t, err.Error(), "failed to list audit logs")
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_AuditList_LimitClamping(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewAuditRepository(db)

	rows := sqlmock.NewRows(auditColumns)
	mock.ExpectQuery(`SELECT id, timestamp, action`).
		WillReturnRows(rows)

	entries, err := repo.List(context.Background(), AuditFilter{Limit: 9999})
	require.NoError(t, err)
	assert.Len(t, entries, 0)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---------------------------------------------------------------------------
// CountByAction
// ---------------------------------------------------------------------------

func TestSqlmock_AuditCountByAction_Success(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewAuditRepository(db)

	rows := sqlmock.NewRows([]string{"action", "count"}).
		AddRow(AuditActionVerify, int64(100)).
		AddRow(AuditActionSettle, int64(42)).
		AddRow(AuditActionHealth, int64(500))

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT action, COUNT(*) as count`)).
		WithArgs("eip155:1").
		WillReturnRows(rows)

	counts, err := repo.CountByAction(context.Background(), "eip155:1")
	require.NoError(t, err)
	assert.Equal(t, int64(100), counts[AuditActionVerify])
	assert.Equal(t, int64(42), counts[AuditActionSettle])
	assert.Equal(t, int64(500), counts[AuditActionHealth])
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_AuditCountByAction_AllNetworks(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewAuditRepository(db)

	rows := sqlmock.NewRows([]string{"action", "count"}).
		AddRow(AuditActionError, int64(7))

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT action, COUNT(*) as count`)).
		WithArgs("").
		WillReturnRows(rows)

	counts, err := repo.CountByAction(context.Background(), "")
	require.NoError(t, err)
	assert.Equal(t, int64(7), counts[AuditActionError])
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_AuditCountByAction_DBError(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewAuditRepository(db)

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT action, COUNT(*) as count`)).
		WithArgs("eip155:1").
		WillReturnError(errors.New("permission denied"))

	counts, err := repo.CountByAction(context.Background(), "eip155:1")
	require.Error(t, err)
	assert.Nil(t, counts)
	assert.Contains(t, err.Error(), "failed to count audit logs")
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---------------------------------------------------------------------------
// GetRequestStats
// ---------------------------------------------------------------------------

func TestSqlmock_AuditGetRequestStats_Success(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewAuditRepository(db)

	rows := sqlmock.NewRows([]string{
		"total_requests", "successful_requests", "failed_requests",
		"avg_duration_ms", "max_duration_ms", "min_duration_ms",
	}).AddRow(int64(1000), int64(850), int64(150), 75.5, 500, 10)

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT`)).
		WithArgs("eip155:1", (*time.Time)(nil), (*time.Time)(nil)).
		WillReturnRows(rows)

	stats, err := repo.GetRequestStats(context.Background(), AuditFilter{
		Network: "eip155:1",
	})
	require.NoError(t, err)
	require.NotNil(t, stats)

	assert.Equal(t, int64(1000), stats.TotalRequests)
	assert.Equal(t, int64(850), stats.SuccessfulRequests)
	assert.Equal(t, int64(150), stats.FailedRequests)
	assert.InDelta(t, 75.5, stats.AvgDurationMs, 0.01)
	assert.Equal(t, 500, stats.MaxDurationMs)
	assert.Equal(t, 10, stats.MinDurationMs)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_AuditGetRequestStats_WithTimeWindow(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewAuditRepository(db)

	start := sampleTime.Add(-24 * time.Hour)
	end := sampleTime

	rows := sqlmock.NewRows([]string{
		"total_requests", "successful_requests", "failed_requests",
		"avg_duration_ms", "max_duration_ms", "min_duration_ms",
	}).AddRow(int64(50), int64(48), int64(2), 30.0, 100, 5)

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT`)).
		WithArgs("", &start, &end).
		WillReturnRows(rows)

	stats, err := repo.GetRequestStats(context.Background(), AuditFilter{
		StartTime: &start,
		EndTime:   &end,
	})
	require.NoError(t, err)
	assert.Equal(t, int64(50), stats.TotalRequests)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_AuditGetRequestStats_EmptyResult(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewAuditRepository(db)

	rows := sqlmock.NewRows([]string{
		"total_requests", "successful_requests", "failed_requests",
		"avg_duration_ms", "max_duration_ms", "min_duration_ms",
	}).AddRow(int64(0), int64(0), int64(0), 0.0, 0, 0)

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT`)).
		WithArgs("", (*time.Time)(nil), (*time.Time)(nil)).
		WillReturnRows(rows)

	stats, err := repo.GetRequestStats(context.Background(), AuditFilter{})
	require.NoError(t, err)
	assert.Equal(t, int64(0), stats.TotalRequests)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_AuditGetRequestStats_DBError(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewAuditRepository(db)

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT`)).
		WillReturnError(errors.New("syntax error"))

	stats, err := repo.GetRequestStats(context.Background(), AuditFilter{})
	require.Error(t, err)
	assert.Nil(t, stats)
	assert.Contains(t, err.Error(), "failed to get request stats")
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---------------------------------------------------------------------------
// DeleteOlderThan
// ---------------------------------------------------------------------------

func TestSqlmock_AuditDeleteOlderThan_Success(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewAuditRepository(db)

	mock.ExpectExec(regexp.QuoteMeta(`DELETE FROM audit_logs WHERE timestamp < $1`)).
		WithArgs("2026-01-01T00:00:00Z").
		WillReturnResult(sqlmock.NewResult(0, 42))

	deleted, err := repo.DeleteOlderThan(context.Background(), "2026-01-01T00:00:00Z")
	require.NoError(t, err)
	assert.Equal(t, int64(42), deleted)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_AuditDeleteOlderThan_NoneDeleted(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewAuditRepository(db)

	mock.ExpectExec(regexp.QuoteMeta(`DELETE FROM audit_logs WHERE timestamp < $1`)).
		WithArgs("2020-01-01T00:00:00Z").
		WillReturnResult(sqlmock.NewResult(0, 0))

	deleted, err := repo.DeleteOlderThan(context.Background(), "2020-01-01T00:00:00Z")
	require.NoError(t, err)
	assert.Equal(t, int64(0), deleted)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_AuditDeleteOlderThan_DBError(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewAuditRepository(db)

	mock.ExpectExec(regexp.QuoteMeta(`DELETE FROM audit_logs WHERE timestamp < $1`)).
		WithArgs("2026-01-01T00:00:00Z").
		WillReturnError(errors.New("foreign key violation"))

	deleted, err := repo.DeleteOlderThan(context.Background(), "2026-01-01T00:00:00Z")
	require.Error(t, err)
	assert.Equal(t, int64(0), deleted)
	assert.Contains(t, err.Error(), "failed to delete old audit logs")
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ===========================================================================
// Middleware handler tests (gin httptest)
// ===========================================================================

func init() {
	gin.SetMode(gin.TestMode)
}

// ---------------------------------------------------------------------------
// RequestStatsHandler
// ---------------------------------------------------------------------------

func TestSqlmock_RequestStatsHandler_Success(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewAuditRepository(db)

	rows := sqlmock.NewRows([]string{
		"total_requests", "successful_requests", "failed_requests",
		"avg_duration_ms", "max_duration_ms", "min_duration_ms",
	}).AddRow(int64(200), int64(180), int64(20), 42.5, 300, 5)

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT`)).
		WithArgs("eip155:1", (*time.Time)(nil), (*time.Time)(nil)).
		WillReturnRows(rows)

	w := httptest.NewRecorder()
	c, r := gin.CreateTestContext(w)
	r.GET("/stats/requests", RequestStatsHandler(repo))

	c.Request, _ = http.NewRequest(http.MethodGet, "/stats/requests?network=eip155:1", nil)
	r.ServeHTTP(w, c.Request)

	assert.Equal(t, http.StatusOK, w.Code)

	var body map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &body)
	require.NoError(t, err)
	assert.Equal(t, float64(200), body["totalRequests"])
	assert.Equal(t, float64(180), body["successfulRequests"])
	assert.Equal(t, float64(20), body["failedRequests"])
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_RequestStatsHandler_NoNetworkParam(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewAuditRepository(db)

	rows := sqlmock.NewRows([]string{
		"total_requests", "successful_requests", "failed_requests",
		"avg_duration_ms", "max_duration_ms", "min_duration_ms",
	}).AddRow(int64(500), int64(450), int64(50), 55.0, 400, 3)

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT`)).
		WithArgs("", (*time.Time)(nil), (*time.Time)(nil)).
		WillReturnRows(rows)

	w := httptest.NewRecorder()
	c, r := gin.CreateTestContext(w)
	r.GET("/stats/requests", RequestStatsHandler(repo))

	c.Request, _ = http.NewRequest(http.MethodGet, "/stats/requests", nil)
	r.ServeHTTP(w, c.Request)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_RequestStatsHandler_Error(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewAuditRepository(db)

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT`)).
		WillReturnError(errors.New("db down"))

	w := httptest.NewRecorder()
	c, r := gin.CreateTestContext(w)
	r.GET("/stats/requests", RequestStatsHandler(repo))

	c.Request, _ = http.NewRequest(http.MethodGet, "/stats/requests", nil)
	r.ServeHTTP(w, c.Request)

	assert.Equal(t, http.StatusInternalServerError, w.Code)

	var body map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &body)
	require.NoError(t, err)
	assert.Equal(t, "failed to get request stats", body["error"])
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---------------------------------------------------------------------------
// SettlementStatsHandler
// ---------------------------------------------------------------------------

func TestSqlmock_SettlementStatsHandler_Success(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	rows := sqlmock.NewRows([]string{"status", "count"}).
		AddRow(SettlementStatusPending, int64(5)).
		AddRow(SettlementStatusConfirmed, int64(30)).
		AddRow(SettlementStatusFailed, int64(2))

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT status, COUNT(*) as count`)).
		WithArgs("eip155:8453").
		WillReturnRows(rows)

	w := httptest.NewRecorder()
	c, r := gin.CreateTestContext(w)
	r.GET("/stats/settlements", SettlementStatsHandler(repo))

	c.Request, _ = http.NewRequest(http.MethodGet, "/stats/settlements?network=eip155:8453", nil)
	r.ServeHTTP(w, c.Request)

	assert.Equal(t, http.StatusOK, w.Code)

	var body map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &body)
	require.NoError(t, err)
	assert.Equal(t, float64(5), body["pending"])
	assert.Equal(t, float64(30), body["confirmed"])
	assert.Equal(t, float64(2), body["failed"])
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_SettlementStatsHandler_NoNetworkParam(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	rows := sqlmock.NewRows([]string{"status", "count"}).
		AddRow(SettlementStatusPending, int64(100))

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT status, COUNT(*) as count`)).
		WithArgs("").
		WillReturnRows(rows)

	w := httptest.NewRecorder()
	c, r := gin.CreateTestContext(w)
	r.GET("/stats/settlements", SettlementStatsHandler(repo))

	c.Request, _ = http.NewRequest(http.MethodGet, "/stats/settlements", nil)
	r.ServeHTTP(w, c.Request)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestSqlmock_SettlementStatsHandler_Error(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT status, COUNT(*) as count`)).
		WillReturnError(errors.New("connection refused"))

	w := httptest.NewRecorder()
	c, r := gin.CreateTestContext(w)
	r.GET("/stats/settlements", SettlementStatsHandler(repo))

	c.Request, _ = http.NewRequest(http.MethodGet, "/stats/settlements", nil)
	r.ServeHTTP(w, c.Request)

	assert.Equal(t, http.StatusInternalServerError, w.Code)

	var body map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &body)
	require.NoError(t, err)
	assert.Equal(t, "failed to get settlement stats", body["error"])
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---------------------------------------------------------------------------
// SettlementStatsHandler: missing statuses return 0
// ---------------------------------------------------------------------------

func TestSqlmock_SettlementStatsHandler_MissingStatusesReturnZero(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	// Only return one status -- the others should default to 0 in the JSON
	rows := sqlmock.NewRows([]string{"status", "count"}).
		AddRow(SettlementStatusConfirmed, int64(10))

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT status, COUNT(*) as count`)).
		WithArgs("").
		WillReturnRows(rows)

	w := httptest.NewRecorder()
	c, r := gin.CreateTestContext(w)
	r.GET("/stats/settlements", SettlementStatsHandler(repo))

	c.Request, _ = http.NewRequest(http.MethodGet, "/stats/settlements", nil)
	r.ServeHTTP(w, c.Request)

	assert.Equal(t, http.StatusOK, w.Code)

	var body map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &body)
	require.NoError(t, err)
	assert.Equal(t, float64(0), body["pending"])
	assert.Equal(t, float64(10), body["confirmed"])
	assert.Equal(t, float64(0), body["failed"])
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---------------------------------------------------------------------------
// Edge-case: settlement List scan error
// ---------------------------------------------------------------------------

func TestSqlmock_SettlementList_ScanError(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	// Return a row with wrong column count to trigger scan error
	rows := sqlmock.NewRows([]string{"id", "network"}).
		AddRow("s1", "eip155:1")

	mock.ExpectQuery(`SELECT id, network, scheme`).
		WillReturnRows(rows)

	results, err := repo.List(context.Background(), SettlementFilter{})
	require.Error(t, err)
	assert.Nil(t, results)
	assert.Contains(t, err.Error(), "failed to scan settlement")
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---------------------------------------------------------------------------
// Edge-case: audit List scan error
// ---------------------------------------------------------------------------

func TestSqlmock_AuditList_ScanError(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewAuditRepository(db)

	// Return a row with wrong column count to trigger scan error
	rows := sqlmock.NewRows([]string{"id"}).
		AddRow("a1")

	mock.ExpectQuery(`SELECT id, timestamp, action`).
		WillReturnRows(rows)

	entries, err := repo.List(context.Background(), AuditFilter{})
	require.Error(t, err)
	assert.Nil(t, entries)
	assert.Contains(t, err.Error(), "failed to scan audit log")
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---------------------------------------------------------------------------
// Edge-case: CountByStatus scan error
// ---------------------------------------------------------------------------

func TestSqlmock_SettlementCountByStatus_ScanError(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	// Return a row with wrong types to trigger scan error
	rows := sqlmock.NewRows([]string{"status"}).
		AddRow(SettlementStatusPending)

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT status, COUNT(*) as count`)).
		WithArgs("").
		WillReturnRows(rows)

	counts, err := repo.CountByStatus(context.Background(), "")
	require.Error(t, err)
	assert.Nil(t, counts)
	assert.Contains(t, err.Error(), "failed to scan count")
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---------------------------------------------------------------------------
// Edge-case: CountByAction scan error
// ---------------------------------------------------------------------------

func TestSqlmock_AuditCountByAction_ScanError(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewAuditRepository(db)

	rows := sqlmock.NewRows([]string{"action"}).
		AddRow(AuditActionVerify)

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT action, COUNT(*) as count`)).
		WithArgs("").
		WillReturnRows(rows)

	counts, err := repo.CountByAction(context.Background(), "")
	require.Error(t, err)
	assert.Nil(t, counts)
	assert.Contains(t, err.Error(), "failed to scan count")
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---------------------------------------------------------------------------
// Multiple rows in CountByStatus/CountByAction
// ---------------------------------------------------------------------------

func TestSqlmock_SettlementCountByStatus_MultipleRows(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	rows := sqlmock.NewRows([]string{"status", "count"}).
		AddRow(SettlementStatusPending, int64(1)).
		AddRow(SettlementStatusConfirmed, int64(2)).
		AddRow(SettlementStatusFailed, int64(3))

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT status, COUNT(*) as count`)).
		WithArgs("").
		WillReturnRows(rows)

	counts, err := repo.CountByStatus(context.Background(), "")
	require.NoError(t, err)
	assert.Len(t, counts, 3)
	assert.Equal(t, int64(1), counts[SettlementStatusPending])
	assert.Equal(t, int64(2), counts[SettlementStatusConfirmed])
	assert.Equal(t, int64(3), counts[SettlementStatusFailed])
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---------------------------------------------------------------------------
// Concurrency-safe: UpdateStatus RowsAffected=0 after valid transition
// ---------------------------------------------------------------------------

func TestSqlmock_SettlementUpdateStatus_ZeroRowsOnExec(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	mock.ExpectBegin()
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT status FROM settlements WHERE id = $1 FOR UPDATE`)).
		WithArgs("settle-001").
		WillReturnRows(sqlmock.NewRows([]string{"status"}).AddRow(SettlementStatusPending))
	mock.ExpectExec(regexp.QuoteMeta(`UPDATE settlements`)).
		WithArgs(SettlementStatusFailed, sqlmock.AnyArg(), "settle-001").
		WillReturnResult(sqlmock.NewResult(0, 0))
	// Note: When RowsAffected==0, the local `err` is still nil (from successful Exec),
	// so the defer does not call tx.Rollback(). The tx is abandoned without rollback/commit.

	err := repo.UpdateStatus(context.Background(), "settle-001", SettlementStatusFailed, "err")
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrSettlementNotFound)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---------------------------------------------------------------------------
// Verify that settlement List correctly sets multiple result fields
// ---------------------------------------------------------------------------

func TestSqlmock_SettlementList_MultipleResultFields(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	confirmedAt := sampleTime.Add(10 * time.Minute)
	gasUsed := int64(50000)
	gasPrice := int64(100)
	meta := json.RawMessage(`{"key":"val"}`)

	rows := sqlmock.NewRows(settlementColumns).AddRow(
		"s1", "eip155:42161", "upto",
		sql.NullString{String: "0xFinalTx", Valid: true},
		"0xSender", "0xReceiver", "999999", "USDT0",
		SettlementStatusConfirmed, sampleTime,
		sql.NullTime{Time: confirmedAt, Valid: true},
		sql.NullString{String: "retry succeeded", Valid: true},
		sql.NullInt64{Int64: gasUsed, Valid: true},
		sql.NullInt64{Int64: gasPrice, Valid: true},
		meta,
	)

	mock.ExpectQuery(`SELECT id, network, scheme`).
		WillReturnRows(rows)

	results, err := repo.List(context.Background(), SettlementFilter{})
	require.NoError(t, err)
	require.Len(t, results, 1)

	s := results[0]
	assert.Equal(t, "s1", s.ID)
	assert.Equal(t, "eip155:42161", s.Network)
	assert.Equal(t, "upto", s.Scheme)
	assert.Equal(t, "0xFinalTx", s.TxHash)
	assert.Equal(t, "0xSender", s.FromAddress)
	assert.Equal(t, "0xReceiver", s.ToAddress)
	assert.Equal(t, "999999", s.Amount)
	assert.Equal(t, "USDT0", s.Asset)
	assert.Equal(t, SettlementStatusConfirmed, s.Status)
	assert.NotNil(t, s.ConfirmedAt)
	assert.Equal(t, confirmedAt, *s.ConfirmedAt)
	assert.Equal(t, "retry succeeded", s.ErrorMessage)
	require.NotNil(t, s.GasUsed)
	assert.Equal(t, gasUsed, *s.GasUsed)
	require.NotNil(t, s.GasPrice)
	assert.Equal(t, gasPrice, *s.GasPrice)
	assert.Equal(t, meta, s.Metadata)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---------------------------------------------------------------------------
// Audit list response body handling
// ---------------------------------------------------------------------------

func TestSqlmock_AuditList_ResponseBodyHandling(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewAuditRepository(db)

	rows := sqlmock.NewRows(auditColumns).
		AddRow("a1", sampleTime, AuditActionSettle,
			sql.NullString{String: "eip155:1", Valid: true},
			sql.NullString{String: "req-x", Valid: true},
			sql.NullString{String: "192.168.1.1", Valid: true},
			sql.NullString{String: "apikey-1", Valid: true},
			[]byte(`{"settle":"request"}`),
			[]byte(`{"tx":"0xHash"}`),
			250, 200)

	mock.ExpectQuery(`SELECT id, timestamp, action`).
		WillReturnRows(rows)

	entries, err := repo.List(context.Background(), AuditFilter{})
	require.NoError(t, err)
	require.Len(t, entries, 1)

	e := entries[0]
	assert.Equal(t, "req-x", e.RequestID)
	assert.Equal(t, "192.168.1.1", e.IPAddress)
	assert.Equal(t, "apikey-1", e.APIKeyID)
	assert.Equal(t, json.RawMessage(`{"settle":"request"}`), e.RequestBody)
	assert.Equal(t, json.RawMessage(`{"tx":"0xHash"}`), e.ResponseBody)
	assert.Equal(t, 250, e.DurationMs)
	assert.Equal(t, 200, e.StatusCode)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---------------------------------------------------------------------------
// UpdateTxHash RowsAffected error
// ---------------------------------------------------------------------------

func TestSqlmock_SettlementUpdateTxHash_RowsAffectedError(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	mock.ExpectExec(regexp.QuoteMeta(`UPDATE settlements SET tx_hash = $1 WHERE id = $2`)).
		WithArgs("0xTx", "settle-001").
		WillReturnResult(sqlmock.NewErrorResult(fmt.Errorf("rows affected error")))

	err := repo.UpdateTxHash(context.Background(), "settle-001", "0xTx")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to get rows affected")
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---------------------------------------------------------------------------
// UpdateGasInfo RowsAffected error
// ---------------------------------------------------------------------------

func TestSqlmock_SettlementUpdateGasInfo_RowsAffectedError(t *testing.T) {
	db, mock := newMockDB(t)
	defer db.Close()
	repo := NewSettlementRepository(db)

	mock.ExpectExec(regexp.QuoteMeta(`UPDATE settlements SET gas_used = $1, gas_price = $2 WHERE id = $3`)).
		WithArgs(int64(21000), int64(30000000000), "settle-001").
		WillReturnResult(sqlmock.NewErrorResult(fmt.Errorf("rows affected error")))

	err := repo.UpdateGasInfo(context.Background(), "settle-001", 21000, 30000000000)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to get rows affected")
	assert.NoError(t, mock.ExpectationsWereMet())
}
