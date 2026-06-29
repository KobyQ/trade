CREATE TYPE retry_status AS ENUM ('PENDING', 'SUCCESS', 'DEAD_LETTER');
CREATE TYPE retry_request_type AS ENUM ('ORDER_CREATE', 'POSITION_MODIFY', 'POSITION_CLOSE');

CREATE TABLE meta_api_retry_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_risk_settings(user_id) ON DELETE CASCADE,
    meta_api_account_id TEXT NOT NULL,
    request_type retry_request_type NOT NULL,
    api_payload JSONB NOT NULL,
    retry_count INT DEFAULT 0,
    next_retry_at TIMESTAMPTZ DEFAULT NOW(),
    status retry_status DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_error TEXT
);

-- Index for fast queue sweeping
CREATE INDEX idx_meta_api_retry_queue_sweep ON meta_api_retry_queue(status, next_retry_at) WHERE status = 'PENDING';
