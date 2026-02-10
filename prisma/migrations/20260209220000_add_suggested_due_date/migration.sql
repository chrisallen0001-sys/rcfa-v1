-- AddColumn: Add suggested_due_date to action item candidates
ALTER TABLE "rcfa_action_item_candidate" ADD COLUMN "suggested_due_date" DATE;
