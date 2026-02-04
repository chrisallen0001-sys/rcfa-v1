-- AlterTable
ALTER TABLE "rcfa" ADD COLUMN     "deleted_at" TIMESTAMPTZ,
ADD COLUMN     "deleted_by_user_id" UUID;

-- CreateIndex
CREATE INDEX "rcfa_deleted_at_idx" ON "rcfa"("deleted_at");

-- AddForeignKey
ALTER TABLE "rcfa" ADD CONSTRAINT "rcfa_deleted_by_user_id_fkey" FOREIGN KEY ("deleted_by_user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- UpdateView: rcfa_summary
-- Drop and recreate to add WHERE clause excluding soft-deleted records.
-- Note: This view now only shows non-deleted RCFAs.
DROP VIEW IF EXISTS rcfa_summary;
CREATE VIEW rcfa_summary AS
SELECT
  r.id,
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
  -- open_action_item_count: uses NOT IN ('done','canceled') so that any new
  -- non-terminal status is automatically counted as open. If a new terminal
  -- status is introduced, this VIEW must be updated to include it.
  (SELECT count(*) FROM rcfa_action_item a WHERE a.rcfa_id = r.id AND a.status NOT IN ('done','canceled')) AS open_action_item_count
FROM rcfa r
WHERE r.deleted_at IS NULL;
