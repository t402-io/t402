-- Streaming payments tables

-- Streams table
CREATE TABLE IF NOT EXISTS streams (
    id                  VARCHAR(36) PRIMARY KEY,
    network             VARCHAR(50) NOT NULL,
    scheme              VARCHAR(30) NOT NULL,
    payer               VARCHAR(100) NOT NULL,
    payee               VARCHAR(100) NOT NULL,
    asset               VARCHAR(100) NOT NULL,
    max_amount          VARCHAR(78) NOT NULL,  -- Max uint256 is 78 digits
    current_amount      VARCHAR(78) NOT NULL DEFAULT '0',
    settled_amount      VARCHAR(78) NOT NULL DEFAULT '0',
    rate_per_second     VARCHAR(78),
    status              VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at          TIMESTAMP NOT NULL,
    activated_at        TIMESTAMP,
    last_updated_at     TIMESTAMP NOT NULL,
    expires_at          TIMESTAMP,
    closed_at           TIMESTAMP,
    deposit_tx_hash     VARCHAR(100),
    settlement_tx_hash  VARCHAR(100),
    metadata            JSONB DEFAULT '{}',

    -- Constraints
    CONSTRAINT chk_status CHECK (status IN ('pending', 'active', 'paused', 'closing', 'closed', 'cancelled', 'expired'))
);

-- Indexes for streams
CREATE INDEX IF NOT EXISTS idx_streams_network ON streams(network);
CREATE INDEX IF NOT EXISTS idx_streams_payer ON streams(payer);
CREATE INDEX IF NOT EXISTS idx_streams_payee ON streams(payee);
CREATE INDEX IF NOT EXISTS idx_streams_status ON streams(status);
CREATE INDEX IF NOT EXISTS idx_streams_created_at ON streams(created_at);
CREATE INDEX IF NOT EXISTS idx_streams_expires_at ON streams(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_streams_active ON streams(status, expires_at) WHERE status IN ('pending', 'active', 'paused');

-- Stream updates table
CREATE TABLE IF NOT EXISTS stream_updates (
    id              VARCHAR(36) PRIMARY KEY,
    stream_id       VARCHAR(36) NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
    amount          VARCHAR(78) NOT NULL,
    signature       TEXT NOT NULL,
    timestamp       TIMESTAMP NOT NULL,
    sequence_num    BIGINT NOT NULL,
    resource_units  BIGINT DEFAULT 0,

    -- Unique constraint on stream_id + sequence_num
    CONSTRAINT uq_stream_sequence UNIQUE (stream_id, sequence_num)
);

-- Indexes for stream_updates
CREATE INDEX IF NOT EXISTS idx_stream_updates_stream_id ON stream_updates(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_updates_timestamp ON stream_updates(timestamp);
CREATE INDEX IF NOT EXISTS idx_stream_updates_sequence ON stream_updates(stream_id, sequence_num DESC);

-- Stream events table
CREATE TABLE IF NOT EXISTS stream_events (
    id          VARCHAR(36) PRIMARY KEY,
    stream_id   VARCHAR(36) NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
    type        VARCHAR(20) NOT NULL,
    data        JSONB DEFAULT '{}',
    timestamp   TIMESTAMP NOT NULL
);

-- Indexes for stream_events
CREATE INDEX IF NOT EXISTS idx_stream_events_stream_id ON stream_events(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_events_type ON stream_events(type);
CREATE INDEX IF NOT EXISTS idx_stream_events_timestamp ON stream_events(timestamp);

-- Comments
COMMENT ON TABLE streams IS 'Payment streams for streaming payments';
COMMENT ON TABLE stream_updates IS 'Individual payment updates within a stream';
COMMENT ON TABLE stream_events IS 'Stream lifecycle events for auditing';

COMMENT ON COLUMN streams.max_amount IS 'Maximum authorized amount for this stream';
COMMENT ON COLUMN streams.current_amount IS 'Current cumulative streamed amount';
COMMENT ON COLUMN streams.settled_amount IS 'Amount already settled on-chain';
COMMENT ON COLUMN streams.rate_per_second IS 'Optional rate for time-based streaming';
COMMENT ON COLUMN stream_updates.sequence_num IS 'Monotonic sequence number for ordering updates';
COMMENT ON COLUMN stream_updates.resource_units IS 'Optional resource units consumed with this update';
