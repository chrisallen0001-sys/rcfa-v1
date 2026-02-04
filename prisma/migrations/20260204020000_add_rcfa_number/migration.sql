-- Create sequence for RCFA numbers
CREATE SEQUENCE rcfa_number_seq START 1;

-- Add rcfa_number column (initially nullable for backfill)
ALTER TABLE "rcfa" ADD COLUMN "rcfa_number" INTEGER;

-- Backfill existing RCFAs with sequential numbers based on creation date
-- This includes soft-deleted RCFAs to ensure numbers are never reused
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS rn
  FROM rcfa
)
UPDATE rcfa
SET rcfa_number = numbered.rn
FROM numbered
WHERE rcfa.id = numbered.id;

-- Set the sequence to continue from the max number + 1
SELECT setval('rcfa_number_seq', COALESCE((SELECT MAX(rcfa_number) FROM rcfa), 0) + 1, false);

-- Make the column NOT NULL and set default to use sequence
ALTER TABLE "rcfa" ALTER COLUMN "rcfa_number" SET NOT NULL;
ALTER TABLE "rcfa" ALTER COLUMN "rcfa_number" SET DEFAULT nextval('rcfa_number_seq');

-- Add unique constraint
ALTER TABLE "rcfa" ADD CONSTRAINT "rcfa_rcfa_number_key" UNIQUE ("rcfa_number");

-- Update rcfa_summary view to include rcfa_number
DROP VIEW IF EXISTS rcfa_summary;
CREATE VIEW rcfa_summary AS
SELECT
  r.id,
  r.rcfa_number,
  r.title,
  r.equipment_description,
  r.status,
  r.operating_context,
  r.created_at,
  r.updated_at,
  r.closed_at,
  r.created_by_user_id,
  (SELECT count(*) FROM rcfa_root_cause_final f WHERE f.rcfa_id = r.id) AS final_root_cause_count,
  (SELECT count(*) FROM rcfa_action_item a WHERE a.rcfa_id = r.id) AS action_item_count,
  (SELECT count(*) FROM rcfa_action_item a WHERE a.rcfa_id = r.id AND a.status NOT IN ('done','canceled')) AS open_action_item_count
FROM rcfa r
WHERE r.deleted_at IS NULL;
