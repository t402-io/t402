package intent

import "context"

// TxInterface defines transaction operations
type TxInterface interface {
	Commit() error
	Rollback() error
}

// RepositoryInterface defines all repository operations for intents
// This interface enables dependency injection for testing
type RepositoryInterface interface {
	// Transaction management
	BeginTx(ctx context.Context) (TxInterface, error)

	// Intent CRUD operations
	Create(ctx context.Context, intent *Intent) error
	GetByID(ctx context.Context, id string) (*Intent, error)
	GetByIDForUpdate(ctx context.Context, tx TxInterface, id string) (*Intent, error)
	Update(ctx context.Context, intent *Intent) error
	UpdateInTx(ctx context.Context, tx TxInterface, intent *Intent) error
	UpdateStatus(ctx context.Context, id string, status IntentStatus, errorMsg string) error
	List(ctx context.Context, filter ListIntentsRequest) ([]*Intent, int64, error)

	// Query operations
	GetExpiredIntents(ctx context.Context) ([]*Intent, error)
	GetPendingIntents(ctx context.Context, limit int) ([]*Intent, error)
	CountByStatus(ctx context.Context) (map[IntentStatus]int64, error)
}
