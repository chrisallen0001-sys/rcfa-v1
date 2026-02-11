-- Create sequence for action item numbers
CREATE SEQUENCE action_item_number_seq START 1;

-- Add action_item_number column to rcfa_action_item (nullable initially for backfill)
ALTER TABLE "rcfa_action_item" ADD COLUMN "action_item_number" INTEGER;

-- Add assigned_action_item_number column to rcfa_action_item_candidate
ALTER TABLE "rcfa_action_item_candidate" ADD COLUMN "assigned_action_item_number" INTEGER;

-- Backfill existing action items with sequential numbers by creation order
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS rn
  FROM rcfa_action_item
)
UPDATE rcfa_action_item
SET action_item_number = numbered.rn
FROM numbered
WHERE rcfa_action_item.id = numbered.id;

-- Backfill candidate numbers for already-promoted items
-- This stores the action item number on the candidate for potential re-promotion
UPDATE rcfa_action_item_candidate c
SET assigned_action_item_number = ai.action_item_number
FROM rcfa_action_item ai
WHERE ai.selected_from_candidate_id = c.id;

-- Set the sequence to continue from max number + 1
SELECT setval('action_item_number_seq',
  COALESCE((SELECT MAX(action_item_number) FROM rcfa_action_item), 0) + 1, false);

-- Make action_item_number NOT NULL
ALTER TABLE "rcfa_action_item" ALTER COLUMN "action_item_number" SET NOT NULL;

-- Add unique constraint
ALTER TABLE "rcfa_action_item" ADD CONSTRAINT "rcfa_action_item_action_item_number_key"
  UNIQUE ("action_item_number");

-- Add partial index on assigned_action_item_number for re-promotion lookups
CREATE INDEX "rcfa_action_item_candidate_assigned_action_item_number_idx"
  ON "rcfa_action_item_candidate" ("assigned_action_item_number")
  WHERE assigned_action_item_number IS NOT NULL;
