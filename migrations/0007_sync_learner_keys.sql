-- Sync IDs are learner-local (for example cp:CL-glowhaus-medspa), not globally unique.
-- Preserve every envelope and payload byte while replacing the global ID primary key.
-- These tables have no inbound or outbound foreign keys. Identity/media/call tables and
-- the append-only sync_operations cursor log are unchanged. Wrangler applies this migration
-- transactionally; do not deploy the composite-key writer before this schema.
-- This prevents future collisions; it cannot reconstruct payloads overwritten before 0007.

CREATE TABLE skill_progress_v7 (
  id TEXT NOT NULL, learner_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL, device_id TEXT NOT NULL, deleted_at TEXT, payload TEXT NOT NULL,
  PRIMARY KEY (learner_id, id)
);
INSERT INTO skill_progress_v7 (id, learner_id, created_at, updated_at, revision, device_id, deleted_at, payload)
  SELECT id, learner_id, created_at, updated_at, revision, device_id, deleted_at, payload FROM skill_progress;
DROP TABLE skill_progress;
ALTER TABLE skill_progress_v7 RENAME TO skill_progress;
CREATE INDEX skill_progress_learner ON skill_progress(learner_id, updated_at);

CREATE TABLE skill_evidence_v7 (
  id TEXT NOT NULL, learner_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL, device_id TEXT NOT NULL, deleted_at TEXT, payload TEXT NOT NULL,
  PRIMARY KEY (learner_id, id)
);
INSERT INTO skill_evidence_v7 (id, learner_id, created_at, updated_at, revision, device_id, deleted_at, payload)
  SELECT id, learner_id, created_at, updated_at, revision, device_id, deleted_at, payload FROM skill_evidence;
DROP TABLE skill_evidence;
ALTER TABLE skill_evidence_v7 RENAME TO skill_evidence;
CREATE INDEX skill_evidence_learner ON skill_evidence(learner_id, updated_at);

CREATE TABLE campaign_progress_v7 (
  id TEXT NOT NULL, learner_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL, device_id TEXT NOT NULL, deleted_at TEXT, payload TEXT NOT NULL,
  PRIMARY KEY (learner_id, id)
);
INSERT INTO campaign_progress_v7 (id, learner_id, created_at, updated_at, revision, device_id, deleted_at, payload)
  SELECT id, learner_id, created_at, updated_at, revision, device_id, deleted_at, payload FROM campaign_progress;
DROP TABLE campaign_progress;
ALTER TABLE campaign_progress_v7 RENAME TO campaign_progress;
CREATE INDEX campaign_progress_learner ON campaign_progress(learner_id, updated_at);

CREATE TABLE exercise_attempts_v7 (
  id TEXT NOT NULL, learner_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL, device_id TEXT NOT NULL, deleted_at TEXT, payload TEXT NOT NULL,
  PRIMARY KEY (learner_id, id)
);
INSERT INTO exercise_attempts_v7 (id, learner_id, created_at, updated_at, revision, device_id, deleted_at, payload)
  SELECT id, learner_id, created_at, updated_at, revision, device_id, deleted_at, payload FROM exercise_attempts;
DROP TABLE exercise_attempts;
ALTER TABLE exercise_attempts_v7 RENAME TO exercise_attempts;
CREATE INDEX exercise_attempts_learner ON exercise_attempts(learner_id, updated_at);

CREATE TABLE review_queue_v7 (
  id TEXT NOT NULL, learner_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL, device_id TEXT NOT NULL, deleted_at TEXT, payload TEXT NOT NULL,
  PRIMARY KEY (learner_id, id)
);
INSERT INTO review_queue_v7 (id, learner_id, created_at, updated_at, revision, device_id, deleted_at, payload)
  SELECT id, learner_id, created_at, updated_at, revision, device_id, deleted_at, payload FROM review_queue;
DROP TABLE review_queue;
ALTER TABLE review_queue_v7 RENAME TO review_queue;
CREATE INDEX review_queue_learner ON review_queue(learner_id, updated_at);

CREATE TABLE fieldwork_v7 (
  id TEXT NOT NULL, learner_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL, device_id TEXT NOT NULL, deleted_at TEXT, payload TEXT NOT NULL,
  PRIMARY KEY (learner_id, id)
);
INSERT INTO fieldwork_v7 (id, learner_id, created_at, updated_at, revision, device_id, deleted_at, payload)
  SELECT id, learner_id, created_at, updated_at, revision, device_id, deleted_at, payload FROM fieldwork;
DROP TABLE fieldwork;
ALTER TABLE fieldwork_v7 RENAME TO fieldwork;
CREATE INDEX fieldwork_learner ON fieldwork(learner_id, updated_at);

CREATE TABLE notes_v7 (
  id TEXT NOT NULL, learner_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL, device_id TEXT NOT NULL, deleted_at TEXT, payload TEXT NOT NULL,
  PRIMARY KEY (learner_id, id)
);
INSERT INTO notes_v7 (id, learner_id, created_at, updated_at, revision, device_id, deleted_at, payload)
  SELECT id, learner_id, created_at, updated_at, revision, device_id, deleted_at, payload FROM notes;
DROP TABLE notes;
ALTER TABLE notes_v7 RENAME TO notes;
CREATE INDEX notes_learner ON notes(learner_id, updated_at);

CREATE TABLE sim_projects_v7 (
  id TEXT NOT NULL, learner_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL, device_id TEXT NOT NULL, deleted_at TEXT, payload TEXT NOT NULL,
  PRIMARY KEY (learner_id, id)
);
INSERT INTO sim_projects_v7 (id, learner_id, created_at, updated_at, revision, device_id, deleted_at, payload)
  SELECT id, learner_id, created_at, updated_at, revision, device_id, deleted_at, payload FROM sim_projects;
DROP TABLE sim_projects;
ALTER TABLE sim_projects_v7 RENAME TO sim_projects;
CREATE INDEX sim_projects_learner ON sim_projects(learner_id, updated_at);

CREATE TABLE sim_snapshots_v7 (
  id TEXT NOT NULL, learner_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL, device_id TEXT NOT NULL, deleted_at TEXT, payload TEXT NOT NULL,
  PRIMARY KEY (learner_id, id)
);
INSERT INTO sim_snapshots_v7 (id, learner_id, created_at, updated_at, revision, device_id, deleted_at, payload)
  SELECT id, learner_id, created_at, updated_at, revision, device_id, deleted_at, payload FROM sim_snapshots;
DROP TABLE sim_snapshots;
ALTER TABLE sim_snapshots_v7 RENAME TO sim_snapshots;
CREATE INDEX sim_snapshots_learner ON sim_snapshots(learner_id, updated_at);

CREATE TABLE sim_events_v7 (
  id TEXT NOT NULL, learner_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL, device_id TEXT NOT NULL, deleted_at TEXT, payload TEXT NOT NULL,
  PRIMARY KEY (learner_id, id)
);
INSERT INTO sim_events_v7 (id, learner_id, created_at, updated_at, revision, device_id, deleted_at, payload)
  SELECT id, learner_id, created_at, updated_at, revision, device_id, deleted_at, payload FROM sim_events;
DROP TABLE sim_events;
ALTER TABLE sim_events_v7 RENAME TO sim_events;
CREATE INDEX sim_events_learner ON sim_events(learner_id, updated_at);

CREATE TABLE client_progress_v7 (
  id TEXT NOT NULL, learner_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL, device_id TEXT NOT NULL, deleted_at TEXT, payload TEXT NOT NULL,
  PRIMARY KEY (learner_id, id)
);
INSERT INTO client_progress_v7 (id, learner_id, created_at, updated_at, revision, device_id, deleted_at, payload)
  SELECT id, learner_id, created_at, updated_at, revision, device_id, deleted_at, payload FROM client_progress;
DROP TABLE client_progress;
ALTER TABLE client_progress_v7 RENAME TO client_progress;
CREATE INDEX client_progress_learner ON client_progress(learner_id, updated_at);

CREATE TABLE portfolio_projects_v7 (
  id TEXT NOT NULL, learner_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL, device_id TEXT NOT NULL, deleted_at TEXT, payload TEXT NOT NULL,
  PRIMARY KEY (learner_id, id)
);
INSERT INTO portfolio_projects_v7 (id, learner_id, created_at, updated_at, revision, device_id, deleted_at, payload)
  SELECT id, learner_id, created_at, updated_at, revision, device_id, deleted_at, payload FROM portfolio_projects;
DROP TABLE portfolio_projects;
ALTER TABLE portfolio_projects_v7 RENAME TO portfolio_projects;
CREATE INDEX portfolio_projects_learner ON portfolio_projects(learner_id, updated_at);

CREATE TABLE portfolio_assets_v7 (
  id TEXT NOT NULL, learner_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL, device_id TEXT NOT NULL, deleted_at TEXT, payload TEXT NOT NULL,
  PRIMARY KEY (learner_id, id)
);
INSERT INTO portfolio_assets_v7 (id, learner_id, created_at, updated_at, revision, device_id, deleted_at, payload)
  SELECT id, learner_id, created_at, updated_at, revision, device_id, deleted_at, payload FROM portfolio_assets;
DROP TABLE portfolio_assets;
ALTER TABLE portfolio_assets_v7 RENAME TO portfolio_assets;
CREATE INDEX portfolio_assets_learner ON portfolio_assets(learner_id, updated_at);
