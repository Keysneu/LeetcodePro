CREATE INDEX IF NOT EXISTS idx_submissions_mastery_lookup
ON submissions(user_id, problem_id, mode, language, created_at, id);
