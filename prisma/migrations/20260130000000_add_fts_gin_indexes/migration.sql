-- Full-text search GIN indexes on rcfa table
-- Individual column indexes for single-column queries
CREATE INDEX rcfa_equipment_description_fts ON rcfa USING gin (to_tsvector('english', equipment_description));
CREATE INDEX rcfa_failure_description_fts ON rcfa USING gin (to_tsvector('english', failure_description));

-- Combined expression index for cross-column FTS queries (used by dashboard search)
CREATE INDEX IF NOT EXISTS rcfa_fts_combined ON rcfa USING gin (
  (to_tsvector('english', equipment_description) || to_tsvector('english', failure_description))
);
