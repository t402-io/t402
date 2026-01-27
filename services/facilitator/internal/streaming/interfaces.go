package streaming

import "context"

// TxInterface defines transaction operations
type TxInterface interface {
	Commit() error
	Rollback() error
}

// RepositoryInterface defines all repository operations for streaming
// This interface enables dependency injection for testing
type RepositoryInterface interface {
	// Transaction management
	BeginTx(ctx context.Context) (TxInterface, error)

	// Stream CRUD operations
	Create(ctx context.Context, stream *Stream) error
	GetByID(ctx context.Context, id string) (*Stream, error)
	GetByIDForUpdate(ctx context.Context, tx TxInterface, id string) (*Stream, error)
	Update(ctx context.Context, stream *Stream) error
	UpdateInTx(ctx context.Context, tx TxInterface, stream *Stream) error
	UpdateStatus(ctx context.Context, id string, status StreamStatus) error
	List(ctx context.Context, filter ListStreamsRequest) ([]*Stream, int64, error)

	// Stream update operations
	CreateUpdate(ctx context.Context, update *StreamUpdate) error
	CreateUpdateInTx(ctx context.Context, tx TxInterface, update *StreamUpdate) error
	GetUpdates(ctx context.Context, streamID string, limit int) ([]*StreamUpdate, error)
	GetLatestUpdate(ctx context.Context, streamID string) (*StreamUpdate, error)
	GetLatestUpdateInTx(ctx context.Context, tx TxInterface, streamID string) (*StreamUpdate, error)

	// Statistics and queries
	GetStreamStats(ctx context.Context, streamID string) (*StreamStats, error)
	GetExpiredStreams(ctx context.Context) ([]*Stream, error)

	// Event logging
	CreateEvent(ctx context.Context, event *StreamEvent) error
}
