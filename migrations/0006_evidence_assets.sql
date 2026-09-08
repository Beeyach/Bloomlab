-- Private screenshots only. Canonical proof stays in exercise_attempts.response.
CREATE TABLE evidence_assets (
  asset_id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(learner_id),
  attempt_id TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  item_key TEXT NOT NULL,
  object_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_length INTEGER NOT NULL,
  checksum TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','uploading','ready','deleting','deleted')),
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX evidence_assets_owner_attempt ON evidence_assets(learner_id, attempt_id);
