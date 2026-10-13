-- DATA-006: private scenario files and staged binary recovery packages.
-- D1 is the ownership/index layer only; every byte payload lives in private R2.
CREATE TABLE scenario_attachments (
  attachment_id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(learner_id),
  scenario_id TEXT NOT NULL,
  name TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL CHECK(mime_type IN ('application/pdf','text/plain','text/csv')),
  byte_length INTEGER NOT NULL CHECK(byte_length BETWEEN 1 AND 8388608),
  checksum TEXT NOT NULL CHECK(length(checksum) = 64),
  status TEXT NOT NULL CHECK(status IN ('pending','uploading','ready','deleting','deleted')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX scenario_attachments_owner ON scenario_attachments(learner_id, scenario_id, created_at);

CREATE TABLE recovery_stages (
  stage_id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(learner_id),
  backup_id TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  byte_length INTEGER NOT NULL,
  checksum TEXT NOT NULL CHECK(length(checksum) = 64),
  asset_count INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('uploading','staged','restoring','failed','restored','cancelled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX recovery_stages_owner ON recovery_stages(learner_id, created_at);
