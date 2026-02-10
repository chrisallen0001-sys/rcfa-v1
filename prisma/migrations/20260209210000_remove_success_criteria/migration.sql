-- DropColumn: Remove success_criteria from action item tables
ALTER TABLE "rcfa_action_item_candidate" DROP COLUMN IF EXISTS "success_criteria";
ALTER TABLE "rcfa_action_item" DROP COLUMN IF EXISTS "success_criteria";
