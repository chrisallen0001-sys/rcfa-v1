-- Full-text search GIN indexes on rcfa table
CREATE INDEX rcfa_equipment_description_fts ON rcfa USING gin (to_tsvector('english', equipment_description));
CREATE INDEX rcfa_failure_description_fts ON rcfa USING gin (to_tsvector('english', failure_description));
