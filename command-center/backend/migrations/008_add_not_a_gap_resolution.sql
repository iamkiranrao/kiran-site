-- Add 'not-a-gap' to the resolution_type CHECK constraint on evidence_gap_items.
-- "not-a-gap" = table stakes / conversation-ready skills that need no evidence.

-- Drop the existing check constraint and recreate with the new value.
-- Supabase auto-names CHECK constraints as: evidence_gap_items_resolution_type_check
ALTER TABLE evidence_gap_items
  DROP CONSTRAINT IF EXISTS evidence_gap_items_resolution_type_check;

ALTER TABLE evidence_gap_items
  ADD CONSTRAINT evidence_gap_items_resolution_type_check
    CHECK (resolution_type IN ('have-it', 'reframed', 'built-proof', 'certified', 'not-pursuing', 'not-a-gap'));
