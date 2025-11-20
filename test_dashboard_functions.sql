-- Test each dashboard function to ensure they work
-- Run these one at a time in Supabase SQL Editor

-- Test 1: Basic Stats
SELECT get_dashboard_basic_stats();

-- Test 2: Age Distribution
SELECT get_dashboard_age_distribution();

-- Test 3: Birth Distribution
SELECT get_dashboard_birth_distribution();

-- Test 4: Payment Stats
SELECT get_dashboard_payment_stats();

-- Test 5: Province Stats
SELECT get_dashboard_province_stats();

-- Test 6: Paid by Age
SELECT get_dashboard_paid_by_age();

-- Test 7: LGU Stats (requires province code)
SELECT get_dashboard_lgu_stats('01'); -- Replace '01' with an actual province code from your database

-- If any of these fail, there's a problem with the function itself
-- If they all work, the issue is with how the frontend is calling them
