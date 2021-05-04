SELECT
  'CREATE INDEX CONCURRENTLY ' || table_name || '_' || column_name || ' ON ' || table_name || ' ("' || column_name || '");' 
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'vmadd';
