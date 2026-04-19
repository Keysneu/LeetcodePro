ALTER TABLE problems
  ADD COLUMN IF NOT EXISTS acm_input_spec TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS acm_output_spec TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS acm_sample_input TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS acm_sample_output TEXT NOT NULL DEFAULT '';

UPDATE problems
SET
  acm_input_spec = CASE
    WHEN acm_input_spec = '' THEN input_spec
    ELSE acm_input_spec
  END,
  acm_output_spec = CASE
    WHEN acm_output_spec = '' THEN output_spec
    ELSE acm_output_spec
  END;
