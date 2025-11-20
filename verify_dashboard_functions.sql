-- Verification script for Dashboard functions
-- Run this in your Supabase SQL Editor to check if functions exist

-- Check if all 7 functions exist
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_name LIKE 'get_dashboard%'
ORDER BY routine_name;

-- Expected output should show 7 functions:
-- get_dashboard_age_distribution
-- get_dashboard_basic_stats
-- get_dashboard_birth_distribution
-- get_dashboard_lgu_stats
-- get_dashboard_paid_by_age
-- get_dashboard_payment_stats
-- get_dashboard_province_stats

-- If you see fewer than 7 functions, the migration didn't run completely.
-- In that case, you need to run the full migration SQL again.
