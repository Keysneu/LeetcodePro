ALTER TABLE problems
ADD COLUMN IF NOT EXISTS leetcode_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_problems_leetcode_id ON problems(leetcode_id);
