-- CreateView
--
-- NOTE: CREATE OR REPLACE VIEW can add columns but cannot remove or reorder
-- existing columns. If a future migration needs to drop or reorder columns,
-- use DROP VIEW + CREATE VIEW instead.
--
CREATE OR REPLACE VIEW rcfa_summary AS
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
FROM rcfa r;
