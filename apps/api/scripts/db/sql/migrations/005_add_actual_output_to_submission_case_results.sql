ALTER TABLE submission_case_results
ADD COLUMN IF NOT EXISTS actual_output TEXT;
