-- Restore the rcfa_number_seq sequence that was accidentally dropped
-- Start from max existing rcfa_number + 1 to avoid conflicts
DO $$
DECLARE
  max_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(rcfa_number), 0) + 1 INTO max_num FROM rcfa;
  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS rcfa_number_seq START %s', max_num);
END
$$;
