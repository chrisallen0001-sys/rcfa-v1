-- AlterEnum
ALTER TYPE "ActionItemStatus" ADD VALUE 'draft' BEFORE 'open';

-- AlterTable
ALTER TABLE "rcfa_action_item" ADD COLUMN "work_completed_date" DATE;
