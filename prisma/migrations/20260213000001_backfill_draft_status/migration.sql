-- Backfill: set existing action items in investigation-phase RCFAs to draft.
-- This runs in a separate migration because PostgreSQL requires ALTER TYPE ADD VALUE
-- to be committed before the new enum value can be referenced in DML.
UPDATE "rcfa_action_item" ai
SET "status" = 'draft'
FROM "rcfa" r
WHERE ai."rcfa_id" = r."id"
  AND r."status" = 'investigation'
  AND r."deleted_at" IS NULL
  AND ai."status" = 'open';
