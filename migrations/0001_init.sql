-- Bloomlab D1 schema, migration 0001 (spec §92–§93, TA§65; DATA-004, DATA-005).
--
-- Git = what Bloomlab teaches. D1 = what the learner has done. No table here stores skills,
-- units, exercises or registry content.
--
-- Learner-data tables share the sync envelope (spec §91, SYNC-007): id, learner_id, created_at,
-- updated_at, revision, device_id, deleted_at. Entity-specific fields travel in `payload`
-- (a small JSON object per row); later phases add real columns when a query needs them.
-- Timestamps are ISO 8601 text.

-- ---------------------------------------------------------------- Identity

CREATE TABLE learners (
  learner_id   TEXT PRIMARY KEY,
  key_hash     TEXT NOT NULL UNIQUE,          -- SHA-256(secret + pepper); never the secret
  created_at   TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE devices (
  device_id    TEXT PRIMARY KEY,
  learner_id   TEXT NOT NULL REFERENCES learners(learner_id),
  token_hash   TEXT,                          -- SHA-256 of the current session token
  created_at   TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  revoked_at   TEXT,
  device_label TEXT NOT NULL
);
CREATE INDEX devices_learner ON devices(learner_id);
CREATE INDEX devices_token ON devices(token_hash);

CREATE TABLE sync_sessions (
  session_id   TEXT PRIMARY KEY,
  device_id    TEXT NOT NULL REFERENCES devices(device_id),
  learner_id   TEXT NOT NULL REFERENCES learners(learner_id),
  token_hash   TEXT NOT NULL UNIQUE,
  created_at   TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  revoked_at   TEXT
);
CREATE INDEX sync_sessions_device ON sync_sessions(device_id);

-- ---------------------------------------------------------------- Learning

CREATE TABLE skill_progress (
  id TEXT PRIMARY KEY, learner_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL, device_id TEXT NOT NULL, deleted_at TEXT, payload TEXT NOT NULL
);
CREATE INDEX skill_progress_learner ON skill_progress(learner_id, updated_at);

CREATE TABLE skill_evidence (
  id TEXT PRIMARY KEY, learner_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL, device_id TEXT NOT NULL, deleted_at TEXT, payload TEXT NOT NULL
);
CREATE INDEX skill_evidence_learner ON skill_evidence(learner_id, updated_at);

CREATE TABLE campaign_progress (
  id TEXT PRIMARY KEY, learner_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL, device_id TEXT NOT NULL, deleted_at TEXT, payload TEXT NOT NULL
);
CREATE INDEX campaign_progress_learner ON campaign_progress(learner_id, updated_at);

CREATE TABLE exercise_attempts (
  id TEXT PRIMARY KEY, learner_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL, device_id TEXT NOT NULL, deleted_at TEXT, payload TEXT NOT NULL
);
CREATE INDEX exercise_attempts_learner ON exercise_attempts(learner_id, updated_at);

CREATE TABLE review_queue (
  id TEXT PRIMARY KEY, learner_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL, device_id TEXT NOT NULL, deleted_at TEXT, payload TEXT NOT NULL
);
CREATE INDEX review_queue_learner ON review_queue(learner_id, updated_at);

CREATE TABLE fieldwork (
  id TEXT PRIMARY KEY, learner_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL, device_id TEXT NOT NULL, deleted_at TEXT, payload TEXT NOT NULL
);
CREATE INDEX fieldwork_learner ON fieldwork(learner_id, updated_at);

-- Learner notes: listed by spec §150 (export) and TA§7, absent from the §93 table list (D-029).
CREATE TABLE notes (
  id TEXT PRIMARY KEY, learner_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL, device_id TEXT NOT NULL, deleted_at TEXT, payload TEXT NOT NULL
);
CREATE INDEX notes_learner ON notes(learner_id, updated_at);

-- ---------------------------------------------------------------- Simulation

CREATE TABLE sim_projects (
  id TEXT PRIMARY KEY, learner_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL, device_id TEXT NOT NULL, deleted_at TEXT, payload TEXT NOT NULL
);
CREATE INDEX sim_projects_learner ON sim_projects(learner_id, updated_at);

CREATE TABLE sim_snapshots (
  id TEXT PRIMARY KEY, learner_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL, device_id TEXT NOT NULL, deleted_at TEXT, payload TEXT NOT NULL
);
CREATE INDEX sim_snapshots_learner ON sim_snapshots(learner_id, updated_at);

CREATE TABLE sim_events (
  id TEXT PRIMARY KEY, learner_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL, device_id TEXT NOT NULL, deleted_at TEXT, payload TEXT NOT NULL
);
CREATE INDEX sim_events_learner ON sim_events(learner_id, updated_at);

CREATE TABLE client_progress (
  id TEXT PRIMARY KEY, learner_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL, device_id TEXT NOT NULL, deleted_at TEXT, payload TEXT NOT NULL
);
CREATE INDEX client_progress_learner ON client_progress(learner_id, updated_at);

-- ---------------------------------------------------------------- Portfolio

CREATE TABLE portfolio_projects (
  id TEXT PRIMARY KEY, learner_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL, device_id TEXT NOT NULL, deleted_at TEXT, payload TEXT NOT NULL
);
CREATE INDEX portfolio_projects_learner ON portfolio_projects(learner_id, updated_at);

CREATE TABLE portfolio_assets (
  id TEXT PRIMARY KEY, learner_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL, device_id TEXT NOT NULL, deleted_at TEXT, payload TEXT NOT NULL
);
CREATE INDEX portfolio_assets_learner ON portfolio_assets(learner_id, updated_at);

-- ---------------------------------------------------------------- AI (written by the Worker, Phase 19+)

CREATE TABLE ai_usage (
  usage_id      TEXT PRIMARY KEY,
  learner_id    TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  purpose       TEXT NOT NULL,
  model         TEXT NOT NULL,
  input_tokens  INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd      REAL NOT NULL DEFAULT 0
);
CREATE INDEX ai_usage_learner ON ai_usage(learner_id, created_at);

CREATE TABLE ai_feedback (
  feedback_id TEXT PRIMARY KEY,
  learner_id  TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  target_kind TEXT NOT NULL,
  target_ref  TEXT NOT NULL,
  rating      INTEGER,
  comment     TEXT
);
CREATE INDEX ai_feedback_learner ON ai_feedback(learner_id, created_at);

CREATE TABLE rubric_runs (
  run_id         TEXT PRIMARY KEY,
  learner_id     TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  rubric_id      TEXT NOT NULL,
  rubric_version TEXT NOT NULL,
  attempt_id     TEXT,
  result         TEXT NOT NULL
);
CREATE INDEX rubric_runs_learner ON rubric_runs(learner_id, created_at);

-- ---------------------------------------------------------------- System

CREATE TABLE content_versions (
  content_version   TEXT PRIMARY KEY,
  app_version       TEXT NOT NULL,
  simulator_version TEXT NOT NULL,
  published_at      TEXT NOT NULL,
  notes             TEXT
);

-- The per-learner change log every accepted sync write appends to; `pull` reads from a cursor.
CREATE TABLE sync_operations (
  op_seq     INTEGER PRIMARY KEY AUTOINCREMENT,
  learner_id TEXT NOT NULL,
  entity     TEXT NOT NULL,
  entity_id  TEXT NOT NULL,
  revision   INTEGER NOT NULL,
  device_id  TEXT NOT NULL,
  applied_at TEXT NOT NULL
);
CREATE INDEX sync_operations_learner ON sync_operations(learner_id, op_seq);

CREATE TABLE feature_flags (
  flag       TEXT NOT NULL,
  learner_id TEXT NOT NULL DEFAULT '',        -- '' = every learner
  enabled    INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (flag, learner_id)
);
