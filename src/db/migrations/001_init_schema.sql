-- ============================================================
--  GramGyan — Master Schema Migration
--  Engine: PostgreSQL 15+
--  Run: psql -U gramgyan_user -d gramgyan_db -f 001_init_schema.sql
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- Trigram search

-- ── Enum Types ────────────────────────────────────────────────────────────────
CREATE TYPE demographic_zone AS ENUM ('RURAL', 'URBAN', 'SEMI_URBAN');
CREATE TYPE operation_type   AS ENUM ('CREATE', 'READ', 'UPDATE', 'DELETE');
CREATE TYPE sync_status      AS ENUM ('PENDING', 'APPLIED', 'CONFLICT', 'REJECTED');
CREATE TYPE kyb_status       AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED');

-- ═══════════════════════════════════════════════════════════════════════════════
--  TABLE: user_profiles
--  Stores student accounts, geolocation, demographics, and streak analytics.
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_profiles (
    -- Identity
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email                   VARCHAR(255) NOT NULL UNIQUE,
    phone                   VARCHAR(20),
    password_hash           TEXT NOT NULL,
    display_name            VARCHAR(120) NOT NULL,
    avatar_url              TEXT,
    preferred_language      VARCHAR(10) DEFAULT 'en',   -- BCP-47 (12 supported)

    -- Geolocation & Demographics
    geo_latitude            DECIMAL(10, 7),
    geo_longitude           DECIMAL(10, 7),
    geo_accuracy_m          SMALLINT,                   -- GPS accuracy radius (metres)
    geo_updated_at          TIMESTAMPTZ,
    demographic_zone        demographic_zone NOT NULL DEFAULT 'RURAL',
    state_code              CHAR(2),                    -- ISO 3166-2:IN state code
    district                VARCHAR(100),
    pin_code                CHAR(6),

    -- Active Study Timer (seconds elapsed in current session)
    active_study_timer_s    INTEGER NOT NULL DEFAULT 0,
    last_session_start      TIMESTAMPTZ,
    total_study_time_s      BIGINT NOT NULL DEFAULT 0,

    -- Streak Analytics
    current_streak          SMALLINT NOT NULL DEFAULT 0,
    longest_streak          SMALLINT NOT NULL DEFAULT 0,
    last_active_timestamp   TIMESTAMPTZ,
    grace_cushion_used      BOOLEAN NOT NULL DEFAULT FALSE,
    grace_cushion_resets_at TIMESTAMPTZ,               -- Grace window expiry
    streak_freeze_count     SMALLINT NOT NULL DEFAULT 0,

    -- Account metadata
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    is_email_verified       BOOLEAN NOT NULL DEFAULT FALSE,
    role                    VARCHAR(20) NOT NULL DEFAULT 'student', -- student | mentor | admin
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_email       ON user_profiles (email);
CREATE INDEX idx_user_profiles_geo         ON user_profiles (geo_latitude, geo_longitude);
CREATE INDEX idx_user_profiles_zone        ON user_profiles (demographic_zone);
CREATE INDEX idx_user_profiles_streak      ON user_profiles (current_streak DESC);


-- ═══════════════════════════════════════════════════════════════════════════════
--  TABLE: competency_ledger
--  Immutable audit log of every skill/module completion event.
--  Anti-gaming telemetry counters + cryptographic verification.
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS competency_ledger (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                 UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

    -- Competency Definition
    module_id               VARCHAR(100) NOT NULL,
    module_name             TEXT NOT NULL,
    subject_area            VARCHAR(80),               -- Math, Physics, Coding…
    difficulty_level        SMALLINT CHECK (difficulty_level BETWEEN 1 AND 5),

    -- Verified Completion
    is_verified             BOOLEAN NOT NULL DEFAULT FALSE,
    verified_at             TIMESTAMPTZ,
    verified_by             VARCHAR(50) DEFAULT 'system', -- 'system' | 'mentor' | 'admin'
    completion_percentage   DECIMAL(5,2) CHECK (completion_percentage BETWEEN 0 AND 100),

    -- Assessment Scores
    raw_score               DECIMAL(6,2),
    threshold_score         DECIMAL(6,2) NOT NULL DEFAULT 60.0,
    attempts                SMALLINT NOT NULL DEFAULT 1,
    passed                  BOOLEAN NOT NULL DEFAULT FALSE,

    -- Anti-Gaming Telemetry
    tab_switches            SMALLINT NOT NULL DEFAULT 0,
    submission_speed_ms     INTEGER NOT NULL DEFAULT 0,   -- Time from first render → submit
    copy_paste_events       SMALLINT NOT NULL DEFAULT 0,
    focus_lost_events       SMALLINT NOT NULL DEFAULT 0,
    suspicious_flag         BOOLEAN NOT NULL DEFAULT FALSE,
    flag_reason             TEXT,

    -- Cryptographic Verification
    verification_hash       TEXT,   -- HMAC-SHA256(user_id + module_id + score + timestamp)
    hash_algorithm          VARCHAR(20) DEFAULT 'HMAC-SHA256',

    -- Timestamps
    started_at              TIMESTAMPTZ,
    submitted_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_competency_user          ON competency_ledger (user_id);
CREATE INDEX idx_competency_module        ON competency_ledger (module_id);
CREATE INDEX idx_competency_verified      ON competency_ledger (is_verified, user_id);
CREATE INDEX idx_competency_suspicious    ON competency_ledger (suspicious_flag) WHERE suspicious_flag = TRUE;


-- ═══════════════════════════════════════════════════════════════════════════════
--  TABLE: offline_sync_journal
--  CRDT-style operation log. Each row = one client mutation pending server merge.
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS offline_sync_journal (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                 UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    device_id               VARCHAR(100) NOT NULL,

    -- Operation Details
    operation_type          operation_type NOT NULL,
    target_table            VARCHAR(100) NOT NULL,
    resource_id             UUID,                       -- PK of the mutated row
    payload                 JSONB NOT NULL DEFAULT '{}',

    -- Vector Clock (incremental timestamp per device)
    vector_clock            JSONB NOT NULL DEFAULT '{}',  -- { deviceId: lamportTimestamp }
    client_timestamp        TIMESTAMPTZ NOT NULL,
    server_timestamp        TIMESTAMPTZ,

    -- Sync Lifecycle
    sync_status             sync_status NOT NULL DEFAULT 'PENDING',
    conflict_resolution     TEXT,                       -- LWW rule applied
    retry_count             SMALLINT NOT NULL DEFAULT 0,
    error_message           TEXT,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    applied_at              TIMESTAMPTZ
);

CREATE INDEX idx_sync_user_pending        ON offline_sync_journal (user_id, sync_status) WHERE sync_status = 'PENDING';
CREATE INDEX idx_sync_device             ON offline_sync_journal (device_id);
CREATE INDEX idx_sync_target             ON offline_sync_journal (target_table, resource_id);
CREATE INDEX idx_sync_vector_clock       ON offline_sync_journal USING GIN (vector_clock);
CREATE INDEX idx_sync_payload            ON offline_sync_journal USING GIN (payload);


-- ═══════════════════════════════════════════════════════════════════════════════
--  TABLE: corporate_clients (B2B KYB)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS corporate_clients (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name            VARCHAR(255) NOT NULL,
    gstin                   CHAR(15) UNIQUE,             -- 15-char GSTIN
    corporate_domain        VARCHAR(255) NOT NULL UNIQUE,
    website_url             TEXT,
    contact_email           VARCHAR(255) NOT NULL,
    contact_name            VARCHAR(150),

    kyb_status              kyb_status NOT NULL DEFAULT 'PENDING',
    kyb_verified_at         TIMESTAMPTZ,
    kyb_rejection_reason    TEXT,

    api_key_hash            TEXT,                        -- Hashed API key for B2B access
    rate_limit_rpm          INTEGER DEFAULT 60,
    is_active               BOOLEAN NOT NULL DEFAULT FALSE,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_corp_gstin              ON corporate_clients (gstin);
CREATE INDEX idx_corp_domain             ON corporate_clients (corporate_domain);
CREATE INDEX idx_corp_kyb_status         ON corporate_clients (kyb_status);


-- ═══════════════════════════════════════════════════════════════════════════════
--  TABLE: chat_messages
--  Stores student ↔ mentor / corporate chat; anti-phishing flags stored here.
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS chat_messages (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id              UUID NOT NULL,
    sender_id               UUID NOT NULL REFERENCES user_profiles(id),
    receiver_id             UUID,                        -- NULL = AI/system

    original_content        TEXT NOT NULL,
    sanitized_content       TEXT NOT NULL,               -- Post-antiPhishing filter
    redacted_items          JSONB DEFAULT '[]',          -- [{type, original, replaced_with}]
    security_warning        TEXT,                        -- Injected warning if phishing detected

    is_ai_response          BOOLEAN NOT NULL DEFAULT FALSE,
    model_used              VARCHAR(100),
    tokens_used             INTEGER,
    latency_ms              INTEGER,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_session            ON chat_messages (session_id, created_at);
CREATE INDEX idx_chat_sender             ON chat_messages (sender_id);
CREATE INDEX idx_chat_redacted           ON chat_messages USING GIN (redacted_items);


-- ═══════════════════════════════════════════════════════════════════════════════
--  TABLE: scam_detection_log
--  Persists every async scam analysis result from the Bull worker.
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS scam_detection_log (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submitted_by_user_id    UUID REFERENCES user_profiles(id),
    payload_type            VARCHAR(50) NOT NULL,         -- 'link' | 'vacancy' | 'message'
    raw_payload             TEXT NOT NULL,

    -- Model Response
    is_scam                 BOOLEAN,
    confidence_score        DECIMAL(5,4),                -- 0.0000 → 1.0000
    flags                   TEXT[] DEFAULT '{}',         -- MLM, phishing, upfront_payment…
    model_used              VARCHAR(100),
    analysis_latency_ms     INTEGER,

    -- Processing State
    status                  VARCHAR(20) DEFAULT 'queued', -- queued | processing | done | failed
    error_message           TEXT,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at            TIMESTAMPTZ
);

CREATE INDEX idx_scam_user               ON scam_detection_log (submitted_by_user_id);
CREATE INDEX idx_scam_status             ON scam_detection_log (status);
CREATE INDEX idx_scam_is_scam            ON scam_detection_log (is_scam) WHERE is_scam = TRUE;


-- ═══════════════════════════════════════════════════════════════════════════════
--  Auto-update updated_at columns
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_user_profiles
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_corporate_clients
  BEFORE UPDATE ON corporate_clients
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
