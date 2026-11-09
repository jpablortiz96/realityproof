-- ============================================================================
-- RealityProof — PostgreSQL Transactional Schema & Uniqueness Constraints
-- Enforces strict financial sequence, idempotency, and cross-task hash uniqueness
-- ============================================================================

CREATE TABLE IF NOT EXISTS verification_tasks (
  task_id VARCHAR(64) PRIMARY KEY,
  status VARCHAR(48) NOT NULL,
  financial_sequence JSONB NOT NULL DEFAULT '[]'::jsonb,
  contract_json JSONB NOT NULL,
  voi_json JSONB NOT NULL,
  created_by VARCHAR(128) NOT NULL,
  assigned_verifier_id VARCHAR(128),
  ai_analysis_json JSONB,
  ai_blocked_reason TEXT,
  reviewer_decision_json JSONB,
  payout_eligibility_proof_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_separation_of_duties CHECK (
    assigned_verifier_id IS NULL
    OR reviewer_decision_json IS NULL
    OR assigned_verifier_id <> (reviewer_decision_json->>'reviewer_id')
  )
);

CREATE TABLE IF NOT EXISTS paypal_orders (
  order_id VARCHAR(64) PRIMARY KEY,
  task_id VARCHAR(64) NOT NULL UNIQUE REFERENCES verification_tasks(task_id) ON DELETE RESTRICT,
  paypal_request_id VARCHAR(128) NOT NULL UNIQUE,
  status VARCHAR(32) NOT NULL,
  amount_usd NUMERIC(10, 2) NOT NULL CHECK (amount_usd > 0),
  currency CHAR(3) NOT NULL CHECK (currency = 'USD'),
  approve_url TEXT,
  capture_id VARCHAR(64) UNIQUE,
  capture_status VARCHAR(32),
  raw_response JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evidence_artifacts (
  artifact_id VARCHAR(64) PRIMARY KEY,
  task_id VARCHAR(64) NOT NULL REFERENCES verification_tasks(task_id) ON DELETE RESTRICT,
  view_type VARCHAR(48) NOT NULL,
  mime_type VARCHAR(32) NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5242880),
  sha256_hex CHAR(64) NOT NULL UNIQUE,
  captured_at_declared TIMESTAMPTZ,
  received_at_server TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verifier_id VARCHAR(128) NOT NULL,
  verifier_declared_sku VARCHAR(128) NOT NULL,
  verifier_notes TEXT NOT NULL,
  consent_granted BOOLEAN NOT NULL CHECK (consent_granted = TRUE),
  no_prohibited_data_confirmed BOOLEAN NOT NULL CHECK (no_prohibited_data_confirmed = TRUE),
  storage_key VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS paypal_payouts (
  payout_batch_id VARCHAR(64) PRIMARY KEY,
  task_id VARCHAR(64) NOT NULL UNIQUE REFERENCES verification_tasks(task_id) ON DELETE RESTRICT,
  capture_id VARCHAR(64) NOT NULL UNIQUE REFERENCES paypal_orders(capture_id) ON DELETE RESTRICT,
  sender_batch_id VARCHAR(128) NOT NULL UNIQUE,
  payout_item_id VARCHAR(64),
  payout_status VARCHAR(48) NOT NULL,
  remote_batch_status VARCHAR(48) NOT NULL,
  item_transaction_status VARCHAR(48),
  amount_usd NUMERIC(10, 2) NOT NULL CHECK (amount_usd > 0),
  eligibility_proof_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS proof_passports (
  proof_id VARCHAR(64) PRIMARY KEY,
  task_id VARCHAR(64) NOT NULL UNIQUE REFERENCES verification_tasks(task_id) ON DELETE RESTRICT,
  capture_id VARCHAR(64) NOT NULL REFERENCES paypal_orders(capture_id) ON DELETE RESTRICT,
  manifest_sha256 CHAR(64) NOT NULL UNIQUE,
  status VARCHAR(32) NOT NULL CHECK (status IN ('VERIFIED', 'INCONCLUSIVE', 'REJECTED')),
  passport_json JSONB NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_events (
  event_id VARCHAR(128) PRIMARY KEY,
  event_type VARCHAR(128) NOT NULL,
  transmission_id VARCHAR(128) NOT NULL UNIQUE,
  verified BOOLEAN NOT NULL,
  payload_json JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_events (
  event_id VARCHAR(64) PRIMARY KEY,
  task_id VARCHAR(64),
  actor_role VARCHAR(48) NOT NULL,
  actor_id VARCHAR(128) NOT NULL,
  action VARCHAR(128) NOT NULL,
  from_status VARCHAR(48),
  to_status VARCHAR(48),
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

