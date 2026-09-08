-- DATA-006: bytes live only in private R2. Authored text/configuration remain in Git.
CREATE TABLE media_assets (
  asset_id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK(scope IN ('authored', 'learner')),
  kind TEXT NOT NULL CHECK(kind = 'voice'),
  learner_id TEXT REFERENCES learners(learner_id),
  client_id TEXT NOT NULL,
  voice_character_id TEXT NOT NULL,
  line_id TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL CHECK(mime_type = 'audio/mpeg'),
  byte_length INTEGER NOT NULL CHECK(byte_length > 0 AND byte_length <= 2097152),
  checksum TEXT NOT NULL CHECK(length(checksum) = 64),
  source_hash TEXT NOT NULL CHECK(length(source_hash) = 64),
  provider TEXT NOT NULL,
  provider_model TEXT NOT NULL,
  provider_voice_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  content_version TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  generation_version TEXT NOT NULL,
  CHECK((scope = 'authored' AND learner_id IS NULL) OR (scope = 'learner' AND learner_id IS NOT NULL))
);
CREATE INDEX media_assets_owner ON media_assets(learner_id, asset_id);

-- A durable atomic claim prevents two Worker isolates from purchasing the same line.
-- Uncertain outcomes remain claimed until an operator reconciles provider history with R2.
CREATE TABLE voice_generation_jobs (
  asset_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK(status IN ('active', 'retryable', 'uncertain', 'complete')),
  provider_attempts INTEGER NOT NULL DEFAULT 0,
  provider_request_id TEXT,
  billed_characters INTEGER,
  updated_at TEXT NOT NULL
);
