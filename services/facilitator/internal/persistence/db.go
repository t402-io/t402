package persistence

import (
	"context"
	"database/sql"
	"embed"
	"fmt"
	"log"
	"time"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	_ "github.com/lib/pq"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

// DBConfig holds database configuration
type DBConfig struct {
	// URL is the database connection URL
	URL string
	// MaxConnections is the maximum number of open connections
	MaxConnections int
	// IdleConnections is the maximum number of idle connections
	IdleConnections int
	// ConnMaxLifetime is the maximum lifetime of a connection
	ConnMaxLifetime time.Duration
	// AutoMigrate runs migrations on startup if true
	AutoMigrate bool
}

// DefaultDBConfig returns default database configuration
func DefaultDBConfig() *DBConfig {
	return &DBConfig{
		MaxConnections:  25,
		IdleConnections: 5,
		ConnMaxLifetime: 5 * time.Minute,
		AutoMigrate:     true,
	}
}

// DB wraps the database connection pool
type DB struct {
	*sql.DB
	config *DBConfig
}

// NewDB creates a new database connection
func NewDB(config *DBConfig) (*DB, error) {
	if config == nil {
		config = DefaultDBConfig()
	}

	if config.URL == "" {
		return nil, fmt.Errorf("database URL is required")
	}

	db, err := sql.Open("postgres", config.URL)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Configure connection pool
	db.SetMaxOpenConns(config.MaxConnections)
	db.SetMaxIdleConns(config.IdleConnections)
	if config.ConnMaxLifetime > 0 {
		db.SetConnMaxLifetime(config.ConnMaxLifetime)
	}

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	wrapper := &DB{
		DB:     db,
		config: config,
	}

	// Run migrations if enabled
	if config.AutoMigrate {
		if err := wrapper.Migrate(); err != nil {
			db.Close()
			return nil, fmt.Errorf("failed to run migrations: %w", err)
		}
	}

	return wrapper, nil
}

// Migrate runs database migrations
func (db *DB) Migrate() error {
	// Create migration source from embedded files
	source, err := iofs.New(migrationsFS, "migrations")
	if err != nil {
		return fmt.Errorf("failed to create migration source: %w", err)
	}

	// Create migration driver
	driver, err := postgres.WithInstance(db.DB, &postgres.Config{})
	if err != nil {
		return fmt.Errorf("failed to create migration driver: %w", err)
	}

	// Create migrator
	m, err := migrate.NewWithInstance("iofs", source, "postgres", driver)
	if err != nil {
		return fmt.Errorf("failed to create migrator: %w", err)
	}

	// Run migrations
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	version, dirty, err := m.Version()
	if err != nil && err != migrate.ErrNilVersion {
		return fmt.Errorf("failed to get migration version: %w", err)
	}

	if dirty {
		log.Printf("Warning: database migration state is dirty at version %d", version)
	} else if err != migrate.ErrNilVersion {
		log.Printf("Database migrated to version %d", version)
	}

	return nil
}

// MigrateDown rolls back one migration
func (db *DB) MigrateDown() error {
	source, err := iofs.New(migrationsFS, "migrations")
	if err != nil {
		return fmt.Errorf("failed to create migration source: %w", err)
	}

	driver, err := postgres.WithInstance(db.DB, &postgres.Config{})
	if err != nil {
		return fmt.Errorf("failed to create migration driver: %w", err)
	}

	m, err := migrate.NewWithInstance("iofs", source, "postgres", driver)
	if err != nil {
		return fmt.Errorf("failed to create migrator: %w", err)
	}

	if err := m.Steps(-1); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("failed to rollback migration: %w", err)
	}

	return nil
}

// Health checks the database health
func (db *DB) Health(ctx context.Context) error {
	return db.PingContext(ctx)
}

// Close closes the database connection
func (db *DB) Close() error {
	return db.DB.Close()
}

// Stats returns database connection pool statistics
func (db *DB) Stats() sql.DBStats {
	return db.DB.Stats()
}
