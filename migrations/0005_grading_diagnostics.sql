-- CALL-003: bounded, content-free outcome metadata for each paid grading response.
-- Never store rejected provider text, transcripts, credentials or request headers here.
ALTER TABLE ai_usage ADD COLUMN diagnostic_json TEXT;
