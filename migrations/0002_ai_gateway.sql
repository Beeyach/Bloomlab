-- AI-002/003: canonical learner policy. AI tables remain Worker-owned.
ALTER TABLE learners ADD COLUMN ai_mode TEXT NOT NULL DEFAULT 'Limited' CHECK(ai_mode IN ('Off','Limited','Full'));
ALTER TABLE learners ADD COLUMN ai_monthly_limit_usd REAL NOT NULL DEFAULT 20 CHECK(ai_monthly_limit_usd >= 0);
ALTER TABLE ai_usage ADD COLUMN cached_input_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_usage ADD COLUMN cache_creation_input_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_usage ADD COLUMN exercise_id TEXT;
ALTER TABLE ai_usage ADD COLUMN reserved_usd REAL NOT NULL DEFAULT 0;
ALTER TABLE ai_usage ADD COLUMN status TEXT NOT NULL DEFAULT 'complete';
ALTER TABLE ai_usage ADD COLUMN run_id TEXT;
ALTER TABLE ai_feedback ADD COLUMN submission TEXT;
ALTER TABLE ai_feedback ADD COLUMN rubric_id TEXT;
ALTER TABLE ai_feedback ADD COLUMN rubric_version TEXT;
ALTER TABLE ai_feedback ADD COLUMN model TEXT;
ALTER TABLE ai_feedback ADD COLUMN result TEXT;
ALTER TABLE ai_feedback ADD COLUMN cost_usd REAL;
ALTER TABLE rubric_runs ADD COLUMN request_hash TEXT;
ALTER TABLE rubric_runs ADD COLUMN status TEXT NOT NULL DEFAULT 'complete';
CREATE UNIQUE INDEX rubric_runs_attempt ON rubric_runs(learner_id, attempt_id) WHERE attempt_id IS NOT NULL;
