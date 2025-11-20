-- Check if functions are accessible to PostgREST
-- Run these queries to diagnose the issue

-- 1. Check function ownership and schema
SELECT 
    n.nspname as schema,
    p.proname as function_name,
    pg_get_userbyid(p.proowner) as owner,
    p.prosecdef as is_security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname LIKE 'get_dashboard%'
ORDER BY p.proname;

-- 2. Check if functions are in the api schema or public schema
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name IN ('public', 'api');

-- 3. Try calling a function directly (this should work)
SELECT get_dashboard_basic_stats();

-- If the above works but the API doesn't, we need to expose the functions to PostgREST
-- by adding them to the exposed schemas in Supabase settings
