-- CALL-002/006, VOI-006. Audio bytes live only in private R2; D1 holds claims and text.
CREATE TABLE call_attempts (
  attempt_id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(learner_id),
  exercise_id TEXT NOT NULL,
  content_version TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  state_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX call_attempts_owner ON call_attempts(learner_id);
CREATE TABLE call_recordings (
  recording_id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(learner_id),
  attempt_id TEXT NOT NULL REFERENCES call_attempts(attempt_id),
  exercise_id TEXT NOT NULL,
  turn INTEGER NOT NULL CHECK(turn BETWEEN 0 AND 19),
  object_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  byte_length INTEGER NOT NULL CHECK(byte_length BETWEEN 1 AND 8388608),
  duration_ms INTEGER NOT NULL CHECK(duration_ms BETWEEN 1 AND 55000),
  checksum TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('uploaded','transcribing','stt_failed','review','confirmed','deleting','deleted')),
  original_transcript TEXT,
  confirmed_transcript TEXT,
  retain INTEGER NOT NULL DEFAULT 0 CHECK(retain IN (0,1)),
  deleted_at TEXT
);
CREATE INDEX call_recordings_attempt ON call_recordings(learner_id,attempt_id,turn);
CREATE TABLE call_turns (
  attempt_id TEXT NOT NULL REFERENCES call_attempts(attempt_id),
  turn INTEGER NOT NULL,
  request_hash TEXT NOT NULL,
  recording_id TEXT NOT NULL REFERENCES call_recordings(recording_id),
  status TEXT NOT NULL CHECK(status IN ('processing','complete')),
  lease TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  result_json TEXT,
  PRIMARY KEY(attempt_id,turn)
);
CREATE TABLE call_voice_assets (
  asset_id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(learner_id),
  attempt_id TEXT NOT NULL REFERENCES call_attempts(attempt_id),
  object_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK(status IN ('processing','ready','uncertain')),
  byte_length INTEGER,
  checksum TEXT,
  created_at TEXT NOT NULL
);
