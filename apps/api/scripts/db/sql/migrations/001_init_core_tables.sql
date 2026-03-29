CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nickname TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  tags TEXT[] NOT NULL DEFAULT '{}',
  mode_support TEXT NOT NULL CHECK (mode_support IN ('CORE', 'ACM', 'BOTH')),
  description_md TEXT NOT NULL,
  input_spec TEXT NOT NULL,
  output_spec TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS test_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  input_data TEXT NOT NULL,
  expected_output TEXT NOT NULL,
  is_hidden BOOLEAN NOT NULL DEFAULT TRUE,
  weight INTEGER NOT NULL DEFAULT 1 CHECK (weight > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  problem_id UUID NOT NULL REFERENCES problems(id),
  language TEXT NOT NULL CHECK (language IN ('cpp', 'python')),
  mode TEXT NOT NULL CHECK (mode IN ('core', 'acm')),
  code TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('QUEUED', 'RUNNING', 'AC', 'WA', 'TLE', 'RE', 'CE')),
  runtime_ms INTEGER,
  memory_kb INTEGER,
  passed_count INTEGER NOT NULL DEFAULT 0 CHECK (passed_count >= 0),
  total_count INTEGER NOT NULL DEFAULT 0 CHECK (total_count >= 0),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS submission_case_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES test_cases(id),
  status TEXT NOT NULL CHECK (status IN ('AC', 'WA', 'TLE', 'RE', 'CE')),
  runtime_ms INTEGER,
  memory_kb INTEGER,
  stderr TEXT
);

CREATE INDEX IF NOT EXISTS idx_problems_slug ON problems(slug);
CREATE INDEX IF NOT EXISTS idx_test_cases_problem_id ON test_cases(problem_id);
CREATE INDEX IF NOT EXISTS idx_submissions_problem_id ON submissions(problem_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON submissions(user_id);
