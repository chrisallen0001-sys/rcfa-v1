-- CreateView
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
  (SELECT count(*) FROM rcfa_action_item a WHERE a.rcfa_id = r.id AND a.status NOT IN ('done','canceled')) AS open_action_item_count
FROM rcfa r;
