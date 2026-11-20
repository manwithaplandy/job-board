-- Catalog fingerprint queries, read by tools/migrations/fingerprint.py.
--
-- Each section starts with a "-- section: <name>" line and holds exactly one
-- read-only SELECT returning (section, key, value) text rows. An optional
-- "-- requires: <relation>" line right after the header makes fingerprint.py
-- skip the section (zero rows) when to_regclass(<relation>) is NULL.
--
-- Rules every query follows:
--   * schema public unless the section says otherwise;
--   * keys are unique within a section and values are deterministic
--     (arrays are sorted before being joined);
--   * objects that belong to an extension (pg_depend deptype 'e') are left out;
--   * fingerprint.py pins search_path to pg_catalog, so names that live in
--     public are always printed schema-qualified, whatever the server default.

-- section: columns
SELECT 'columns' AS section,
       c.relname || '.' || a.attname AS key,
       concat_ws(' | ',
         format_type(a.atttypid, a.atttypmod),
         CASE WHEN a.attnotnull THEN 'not null' ELSE 'null' END,
         'default=' || coalesce(pg_get_expr(d.adbin, d.adrelid), ''),
         'generated=' || a.attgenerated::text,
         'identity=' || a.attidentity::text) AS value
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
  AND a.attnum > 0
  AND NOT a.attisdropped
  AND NOT EXISTS (SELECT 1 FROM pg_depend dep
                  WHERE dep.classid = 'pg_class'::regclass AND dep.objid = c.oid
                    AND dep.deptype = 'e');

-- section: constraints
SELECT 'constraints',
       cl.relname || '.' || con.conname,
       pg_get_constraintdef(con.oid) || ' | validated=' || con.convalidated::text
FROM pg_constraint con
JOIN pg_class cl ON cl.oid = con.conrelid
JOIN pg_namespace n ON n.oid = cl.relnamespace
WHERE n.nspname = 'public'
  AND con.contype <> 'n'  -- PG18+ catalogs NOT NULL here; columns covers it
  AND NOT EXISTS (SELECT 1 FROM pg_depend dep
                  WHERE dep.classid = 'pg_class'::regclass AND dep.objid = cl.oid
                    AND dep.deptype = 'e');

-- section: indexes
SELECT 'indexes',
       i.tablename || '.' || i.indexname,
       i.indexdef
FROM pg_indexes i
JOIN pg_class t ON t.relname = i.tablename AND t.relnamespace = 'public'::regnamespace
WHERE i.schemaname = 'public'
  AND NOT EXISTS (SELECT 1 FROM pg_depend dep
                  WHERE dep.classid = 'pg_class'::regclass AND dep.objid = t.oid
                    AND dep.deptype = 'e');

-- section: functions
SELECT 'functions',
       p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
       concat_ws(' | ',
         'kind=' || p.prokind::text,
         'md5=' || CASE WHEN p.prokind = 'a' THEN 'aggregate'
                        ELSE md5(pg_get_functiondef(p.oid)) END,
         'secdef=' || p.prosecdef::text,
         'config=' || coalesce(array_to_string(
             ARRAY(SELECT x FROM unnest(p.proconfig) AS x ORDER BY x), ','), ''))
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND NOT EXISTS (SELECT 1 FROM pg_depend dep
                  WHERE dep.classid = 'pg_proc'::regclass AND dep.objid = p.oid
                    AND dep.deptype = 'e');

-- section: triggers
SELECT 'triggers',
       c.relname || '.' || t.tgname,
       pg_get_triggerdef(t.oid) || ' | enabled=' || t.tgenabled::text
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND NOT t.tgisinternal;

-- section: views
SELECT 'views',
       c.relname,
       'kind=' || c.relkind::text || ' | md5=' || md5(pg_get_viewdef(c.oid))
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('v', 'm')
  AND NOT EXISTS (SELECT 1 FROM pg_depend dep
                  WHERE dep.classid = 'pg_class'::regclass AND dep.objid = c.oid
                    AND dep.deptype = 'e');

-- section: policies
SELECT 'policies',
       p.tablename || '.' || p.policyname,
       concat_ws(' | ',
         'cmd=' || p.cmd,
         'permissive=' || p.permissive,
         'roles=' || array_to_string(ARRAY(SELECT r FROM unnest(p.roles) AS r ORDER BY r), ','),
         'qual=' || coalesce(p.qual, ''),
         'with_check=' || coalesce(p.with_check, ''))
FROM pg_policies p
WHERE p.schemaname = 'public';

-- section: rls
SELECT 'rls',
       c.relname,
       'rls=' || c.relrowsecurity::text || ' | force=' || c.relforcerowsecurity::text
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
  AND NOT EXISTS (SELECT 1 FROM pg_depend dep
                  WHERE dep.classid = 'pg_class'::regclass AND dep.objid = c.oid
                    AND dep.deptype = 'e');

-- section: sequences
SELECT 'sequences',
       c.relname,
       concat_ws(' | ',
         format_type(s.seqtypid, NULL),
         'increment=' || s.seqincrement::text,
         'min=' || s.seqmin::text,
         'max=' || s.seqmax::text,
         'cycle=' || s.seqcycle::text)
FROM pg_sequence s
JOIN pg_class c ON c.oid = s.seqrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND NOT EXISTS (SELECT 1 FROM pg_depend dep
                  WHERE dep.classid = 'pg_class'::regclass AND dep.objid = c.oid
                    AND dep.deptype = 'e');

-- section: types
SELECT 'types',
       t.typname,
       CASE t.typtype
         WHEN 'e' THEN 'enum: ' || coalesce((
             SELECT string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder)
             FROM pg_enum e WHERE e.enumtypid = t.oid), '')
         WHEN 'c' THEN 'composite: ' || coalesce((
             SELECT string_agg(a.attname || ' ' || format_type(a.atttypid, a.atttypmod),
                               ', ' ORDER BY a.attnum)
             FROM pg_attribute a
             WHERE a.attrelid = t.typrelid AND a.attnum > 0 AND NOT a.attisdropped), '')
         ELSE concat_ws(' | ',
             'domain: ' || format_type(t.typbasetype, t.typtypmod),
             CASE WHEN t.typnotnull THEN 'not null' ELSE 'null' END,
             'default=' || coalesce(t.typdefault, ''),
             'checks=' || coalesce((
                 SELECT string_agg(con.conname || ' ' || pg_get_constraintdef(con.oid),
                                   '; ' ORDER BY con.conname)
                 FROM pg_constraint con WHERE con.contypid = t.oid), ''))
       END
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
  AND (t.typtype IN ('e', 'd')
       OR (t.typtype = 'c'
           AND (SELECT c.relkind FROM pg_class c WHERE c.oid = t.typrelid) = 'c'))
  AND NOT EXISTS (SELECT 1 FROM pg_depend dep
                  WHERE dep.classid = 'pg_type'::regclass AND dep.objid = t.oid
                    AND dep.deptype = 'e');

-- section: owners
SELECT 'owners', key, owner
FROM (
  SELECT CASE WHEN c.relkind = 'S' THEN 'sequence:' ELSE 'relation:' END || c.relname AS key,
         pg_get_userbyid(c.relowner) AS owner
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
    AND NOT EXISTS (SELECT 1 FROM pg_depend dep
                    WHERE dep.classid = 'pg_class'::regclass AND dep.objid = c.oid
                      AND dep.deptype = 'e')
  UNION ALL
  SELECT 'function:' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
         pg_get_userbyid(p.proowner)
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND NOT EXISTS (SELECT 1 FROM pg_depend dep
                    WHERE dep.classid = 'pg_proc'::regclass AND dep.objid = p.oid
                      AND dep.deptype = 'e')
  UNION ALL
  SELECT 'schema:public', pg_get_userbyid(n.nspowner)
  FROM pg_namespace n WHERE n.nspname = 'public'
) owners;

-- section: grants
-- A NULL ACL means "the built-in default", so it is expanded with acldefault()
-- to make an implicit default and the same grants written out compare equal.
-- Grantor is left out; the same grant from two grantors folds into one key.
SELECT 'grants', key, bool_or(is_grantable)::text
FROM (
  SELECT CASE WHEN c.relkind = 'S' THEN 'sequence:' ELSE 'relation:' END || c.relname
           || ':' || CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END
           || ':' || x.privilege_type AS key,
         x.is_grantable
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault(
      CASE WHEN c.relkind = 'S' THEN 's'::"char" ELSE 'r'::"char" END, c.relowner))) x
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
    AND NOT EXISTS (SELECT 1 FROM pg_depend dep
                    WHERE dep.classid = 'pg_class'::regclass AND dep.objid = c.oid
                      AND dep.deptype = 'e')
  UNION ALL
  SELECT 'column:' || c.relname || '.' || a.attname
           || ':' || CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END
           || ':' || x.privilege_type,
         x.is_grantable
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  CROSS JOIN LATERAL aclexplode(a.attacl) x
  WHERE n.nspname = 'public'
    AND a.attacl IS NOT NULL
    AND a.attnum > 0
    AND NOT a.attisdropped
  UNION ALL
  SELECT 'function:' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
           || ':' || CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END
           || ':' || x.privilege_type,
         x.is_grantable
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x
  WHERE n.nspname = 'public'
    AND NOT EXISTS (SELECT 1 FROM pg_depend dep
                    WHERE dep.classid = 'pg_proc'::regclass AND dep.objid = p.oid
                      AND dep.deptype = 'e')
  UNION ALL
  SELECT 'schema:public'
           || ':' || CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END
           || ':' || x.privilege_type,
         x.is_grantable
  FROM pg_namespace n
  CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) x
  WHERE n.nspname = 'public'
) grants
GROUP BY key;

-- section: default_acl
SELECT 'default_acl', key, bool_or(is_grantable)::text
FROM (
  SELECT pg_get_userbyid(d.defaclrole) || ':' || d.defaclobjtype::text
           || ':' || CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END
           || ':' || x.privilege_type AS key,
         x.is_grantable
  FROM pg_default_acl d
  CROSS JOIN LATERAL aclexplode(d.defaclacl) x
  WHERE d.defaclnamespace = 'public'::regnamespace
) acl
GROUP BY key;

-- section: extensions
-- Version is deliberately left out: local and hosted images ship different
-- minor versions of the same extension.
SELECT 'extensions', e.extname, n.nspname::text
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace;

-- section: storage_policies
-- pg_policies always exists, so this is simply empty when storage is absent.
SELECT 'storage_policies',
       p.policyname,
       concat_ws(' | ',
         'cmd=' || p.cmd,
         'permissive=' || p.permissive,
         'roles=' || array_to_string(ARRAY(SELECT r FROM unnest(p.roles) AS r ORDER BY r), ','),
         'qual=' || coalesce(p.qual, ''),
         'with_check=' || coalesce(p.with_check, ''))
FROM pg_policies p
WHERE p.schemaname = 'storage' AND p.tablename = 'objects';

-- section: storage_buckets
-- requires: storage.buckets
SELECT 'storage_buckets',
       b.id::text,
       concat_ws(' | ',
         'public=' || coalesce(b.public::text, ''),
         'file_size_limit=' || coalesce(b.file_size_limit::text, ''),
         'allowed_mime_types=' || coalesce(array_to_string(
             ARRAY(SELECT m FROM unnest(b.allowed_mime_types) AS m ORDER BY m), ','), ''))
FROM storage.buckets b;
