
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname, conrelid::regclass::text AS tbl,
           (SELECT a.attname FROM pg_attribute a WHERE a.attrelid = c.conrelid AND a.attnum = c.conkey[1]) AS col
    FROM pg_constraint c
    WHERE confrelid = 'auth.users'::regclass
      AND contype = 'f'
      AND connamespace = 'public'::regnamespace
      AND confdeltype = 'a'  -- NO ACTION
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE SET NULL',
                   r.tbl, r.conname, r.col);
  END LOOP;
END $$;
