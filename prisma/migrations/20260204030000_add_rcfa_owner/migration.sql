-- Add owner_user_id column to rcfa table
-- Owner defaults to the creator but can be reassigned by admins
ALTER TABLE "rcfa" ADD COLUMN "owner_user_id" UUID;

-- Backfill: set owner to creator for all existing RCFAs
UPDATE rcfa SET owner_user_id = created_by_user_id;

-- Make the column NOT NULL after backfill
ALTER TABLE "rcfa" ALTER COLUMN "owner_user_id" SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE "rcfa" ADD CONSTRAINT "rcfa_owner_user_id_fkey"
  FOREIGN KEY ("owner_user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add index for efficient owner lookups
CREATE INDEX "rcfa_owner_user_id_idx" ON "rcfa"("owner_user_id");

-- Update rcfa_summary view to include owner information
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
  r.owner_user_id,
  owner.display_name AS owner_display_name,
  (SELECT count(*) FROM rcfa_root_cause_final f WHERE f.rcfa_id = r.id) AS final_root_cause_count,
  (SELECT count(*) FROM rcfa_action_item a WHERE a.rcfa_id = r.id) AS action_item_count,
  (SELECT count(*) FROM rcfa_action_item a WHERE a.rcfa_id = r.id AND a.status NOT IN ('done','canceled')) AS open_action_item_count
FROM rcfa r
JOIN app_user owner ON owner.id = r.owner_user_id
WHERE r.deleted_at IS NULL;
