-- AlterEnum
ALTER TYPE "ActionItemStatus" ADD VALUE 'draft' BEFORE 'open';

-- AlterTable
ALTER TABLE "rcfa_action_item" ADD COLUMN "work_completed_date" DATE;

-- Data migration: set existing action items in investigation-phase RCFAs to draft
UPDATE "rcfa_action_item" ai
SET "status" = 'draft'
FROM "rcfa" r
WHERE ai."rcfa_id" = r."id"
  AND r."status" = 'investigation'
  AND r."deleted_at" IS NULL
  AND ai."status" = 'open';
