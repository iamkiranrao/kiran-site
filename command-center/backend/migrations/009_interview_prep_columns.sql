-- Add interview prep columns to evidence_gap_items.
-- interview_questions: JSON array of likely interview questions for this gap area
-- prepared_answers: JSON array of STAR-format answers (populated after gap closure)

ALTER TABLE evidence_gap_items
  ADD COLUMN IF NOT EXISTS interview_questions JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS prepared_answers JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN evidence_gap_items.interview_questions IS 'Array of likely interview questions related to this gap skill area';
COMMENT ON COLUMN evidence_gap_items.prepared_answers IS 'Array of STAR-format prepared answers (situation, task, action, result)';
